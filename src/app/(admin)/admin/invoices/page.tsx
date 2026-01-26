'use client';

/**
 * Admin Invoices List Page
 *
 * WHY: Central hub for managing all invoices (receivables and payables).
 * WHEN: Admin navigates to Finance > Invoices.
 * HOW: Displays invoice stats, aging report, filterable table with actions.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  AdminPageHeader,
  AdminDataTable,
  type TableColumn,
  type RowAction,
} from '@/components/admin/ui';
import { InvoiceStatusBadge } from '@/components/admin/invoices/InvoiceStatusBadge';
import { AgingReportCard, type AgingData } from '@/components/admin/invoices/AgingReportCard';
import {
  RefreshCw,
  Plus,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Eye,
  Send,
  XCircle,
  Building2,
  Users,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface Invoice {
  id: string;
  invoiceNumber: string;
  type: 'RECEIVABLE' | 'PAYABLE';
  status: string;
  buyerId: string | null;
  affiliateId: string | null;
  buyerName?: string;
  affiliateName?: string;
  periodStart: string;
  periodEnd: string;
  total: number | string;
  amountPaid: number | string;
  balance: number | string;
  dueDate: string | null;
  daysOverdue?: number;
  createdAt: string;
}

interface InvoiceStats {
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
  paidThisMonth: number;
  paidCountThisMonth: number;
  totalReceivable: number;
  totalPayable: number;
  aging: AgingData;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numAmount);
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invoicesRes, statsRes] = await Promise.all([
        fetch('/api/admin/invoices', {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
          },
        }),
        fetch('/api/admin/invoices/stats', {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
          },
        }),
      ]);

      const [invoicesData, statsData] = await Promise.all([
        invoicesRes.json(),
        statsRes.json(),
      ]);

      if (invoicesData.success) {
        setInvoices(invoicesData.data?.invoices || []);
      }

      if (statsData.success) {
        setStats(statsData.data);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching invoice data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleViewInvoice = (invoice: Invoice) => {
    router.push(`/admin/invoices/${invoice.id}`);
  };

  const handleSendInvoice = async (invoice: Invoice) => {
    if (!confirm(`Send invoice ${invoice.invoiceNumber}?`)) return;

    try {
      const response = await fetch(`/api/admin/invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });
      const data = await response.json();

      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to send invoice');
      }
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Failed to send invoice');
    }
  };

  const handleCancelInvoice = async (invoice: Invoice) => {
    const reason = prompt('Enter cancellation reason:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/admin/invoices/${invoice.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();

      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to cancel invoice');
      }
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      alert('Failed to cancel invoice');
    }
  };

  const handleDownloadPdf = async (invoice: Invoice) => {
    try {
      const response = await fetch(`/api/admin/invoices/${invoice.id}/pdf`, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error('PDF generation failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF');
    }
  };

  // Table columns
  const columns: TableColumn<Invoice>[] = useMemo(
    () => [
      {
        key: 'invoiceNumber',
        header: 'Invoice #',
        sortable: true,
        render: (invoice) => (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${invoice.type === 'RECEIVABLE' ? 'bg-blue-50' : 'bg-purple-50'}`}>
              {invoice.type === 'RECEIVABLE' ? (
                <Building2 className={`h-4 w-4 text-blue-600`} />
              ) : (
                <Users className={`h-4 w-4 text-purple-600`} />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {invoice.invoiceNumber}
              </div>
              <div className="text-xs text-gray-500">
                {invoice.type === 'RECEIVABLE' ? 'Receivable' : 'Payable'}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'recipient',
        header: 'Buyer/Affiliate',
        sortable: true,
        render: (invoice) => (
          <div className="text-sm">
            <div className="font-medium text-gray-900">
              {invoice.buyerName || invoice.affiliateName || '-'}
            </div>
          </div>
        ),
      },
      {
        key: 'period',
        header: 'Period',
        sortable: true,
        render: (invoice) => (
          <div className="text-sm text-gray-700">
            {formatDateRange(invoice.periodStart, invoice.periodEnd)}
          </div>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        sortable: true,
        align: 'right',
        render: (invoice) => (
          <div className="text-sm font-semibold text-gray-900">
            {formatCurrency(invoice.total)}
          </div>
        ),
      },
      {
        key: 'balance',
        header: 'Balance',
        sortable: true,
        align: 'right',
        render: (invoice) => {
          const balance = typeof invoice.balance === 'string' ? parseFloat(invoice.balance) : invoice.balance;
          return (
            <div className={`text-sm font-semibold ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {formatCurrency(invoice.balance)}
            </div>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (invoice) => (
          <InvoiceStatusBadge status={invoice.status} daysOverdue={invoice.daysOverdue} />
        ),
      },
      {
        key: 'dueDate',
        header: 'Due Date',
        sortable: true,
        render: (invoice) => (
          <div className="text-sm text-gray-600">
            {formatDate(invoice.dueDate)}
          </div>
        ),
      },
    ],
    []
  );

  // Row actions
  const rowActions: RowAction<Invoice>[] = useMemo(
    () => [
      {
        key: 'view',
        icon: <Eye className="h-4 w-4" />,
        label: 'View',
        onClick: handleViewInvoice,
      },
      {
        key: 'send',
        icon: <Send className="h-4 w-4" />,
        label: 'Send',
        onClick: handleSendInvoice,
        variant: 'success',
        show: (invoice) => invoice.status === 'DRAFT',
      },
      {
        key: 'download',
        icon: <Download className="h-4 w-4" />,
        label: 'Download PDF',
        onClick: handleDownloadPdf,
        show: (invoice) => invoice.status !== 'DRAFT',
      },
      {
        key: 'cancel',
        icon: <XCircle className="h-4 w-4" />,
        label: 'Cancel',
        onClick: handleCancelInvoice,
        variant: 'danger',
        show: (invoice) => !['PAID', 'CANCELLED'].includes(invoice.status),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        title="Invoice Management"
        description="Manage accounts receivable and payable invoices"
        lastUpdated={lastRefresh}
        actions={
          <div className="flex gap-2">
            <Button
              onClick={() => router.push('/admin/invoices/new')}
              className="gap-2 bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
            <Button
              variant="outline"
              onClick={fetchData}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats?.totalOutstanding || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Overdue Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats?.totalOverdue || 0)}
              </p>
              <p className="text-sm text-red-600">
                {stats?.overdueCount || 0} invoice{stats?.overdueCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Paid This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats?.paidThisMonth || 0)}
              </p>
              <p className="text-sm text-green-600">
                {stats?.paidCountThisMonth || 0} invoice{stats?.paidCountThisMonth !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Receivable / Payable</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(stats?.totalReceivable || 0)}
              </p>
              <p className="text-sm text-purple-600">
                {formatCurrency(stats?.totalPayable || 0)} payable
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Aging Report Card */}
      {stats?.aging && (
        <AgingReportCard data={stats.aging} loading={loading} />
      )}

      {/* Invoices Table */}
      <AdminDataTable<Invoice>
        data={invoices}
        loading={loading}
        keyField="id"
        columns={columns}
        title="Invoices"
        searchPlaceholder="Search by invoice number, buyer, or affiliate..."
        searchFields={['invoiceNumber', 'buyerName', 'affiliateName']}
        filters={[
          {
            key: 'status',
            label: 'All Status',
            options: [
              { value: 'DRAFT', label: 'Draft' },
              { value: 'SENT', label: 'Sent' },
              { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
              { value: 'PAID', label: 'Paid' },
              { value: 'OVERDUE', label: 'Overdue' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'DISPUTED', label: 'Disputed' },
            ],
          },
          {
            key: 'type',
            label: 'All Types',
            options: [
              { value: 'RECEIVABLE', label: 'Receivable (AR)' },
              { value: 'PAYABLE', label: 'Payable (AP)' },
            ],
          },
        ]}
        defaultSortField="createdAt"
        defaultSortDirection="desc"
        itemsPerPage={20}
        rowActions={rowActions}
        onRowClick={handleViewInvoice}
        emptyMessage="No invoices found. Create your first invoice to get started."
      />
    </div>
  );
}
