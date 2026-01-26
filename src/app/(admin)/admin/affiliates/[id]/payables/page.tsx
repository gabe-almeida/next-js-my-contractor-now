'use client';

/**
 * Affiliate Payables Tab Page
 *
 * WHY: Shows all payable invoices for a specific affiliate with summary stats.
 * WHEN: Admin clicks "Payables" tab on affiliate detail page.
 * HOW: Fetches affiliate payables data, displays summary and table.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  AdminDetailPageHeader,
  AdminStatGrid,
  AdminDataTable,
  type TableColumn,
  type RowAction,
} from '@/components/admin/ui';
import { InvoiceStatusBadge } from '@/components/admin/invoices/InvoiceStatusBadge';
import {
  AlertCircle,
  RefreshCw,
  Plus,
  DollarSign,
  CreditCard,
  Clock,
  FileText,
  Eye,
  Download,
  Send,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface AffiliatePayable {
  id: string;
  invoiceNumber: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  total: number | string;
  amountPaid: number | string;
  balance: number | string;
  dueDate: string | null;
  daysOverdue?: number;
  createdAt: string;
}

interface AffiliatePayablesSummary {
  affiliate: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  stats: {
    totalEarned: number;
    totalPaid: number;
    pendingAmount: number;
    invoiceCount: number;
  };
  invoices: AffiliatePayable[];
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

export default function AffiliatePayablesPage() {
  const params = useParams();
  const router = useRouter();
  const affiliateId = params.id as string;

  const [data, setData] = useState<AffiliatePayablesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/affiliates/${affiliateId}/payables`, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Affiliate not found');
        }
        throw new Error('Failed to fetch payables data');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch data');
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [affiliateId]);

  useEffect(() => {
    if (affiliateId) {
      fetchData();
    }
  }, [affiliateId, fetchData]);

  const handleViewInvoice = (invoice: AffiliatePayable) => {
    router.push(`/admin/invoices/${invoice.id}`);
  };

  const handleSendInvoice = async (invoice: AffiliatePayable) => {
    if (!confirm(`Send invoice ${invoice.invoiceNumber}?`)) return;

    try {
      const response = await fetch(`/api/admin/invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });
      const result = await response.json();

      if (result.success) {
        fetchData();
      } else {
        alert(result.error || 'Failed to send invoice');
      }
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Failed to send invoice');
    }
  };

  const handleDownloadPdf = async (invoice: AffiliatePayable) => {
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
  const columns: TableColumn<AffiliatePayable>[] = useMemo(
    () => [
      {
        key: 'invoiceNumber',
        header: 'Invoice #',
        sortable: true,
        render: (invoice) => (
          <div className="text-sm font-semibold text-gray-900">
            {invoice.invoiceNumber}
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
        header: 'Amount',
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
            <div className={`text-sm font-semibold ${balance > 0 ? 'text-purple-600' : 'text-green-600'}`}>
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
  const rowActions: RowAction<AffiliatePayable>[] = useMemo(
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
    ],
    []
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminDetailPageHeader
          title="Affiliate Payables"
          backHref={`/admin/affiliates/${affiliateId}`}
          backLabel="Back to Affiliate"
        />

        <div className="bg-red-50 rounded-xl border border-red-200 p-6">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Failed to load payables data</span>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
          <Button
            variant="outline"
            onClick={fetchData}
            className="mt-4 gap-2 border-red-300 text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const affiliateName = data.affiliate.firstName && data.affiliate.lastName
    ? `${data.affiliate.firstName} ${data.affiliate.lastName}`
    : data.affiliate.email;

  // Stats for the overview
  const stats = [
    {
      label: 'Total Earned',
      value: formatCurrency(data.stats.totalEarned),
      icon: FileText,
      accent: 'purple' as const,
    },
    {
      label: 'Total Paid',
      value: formatCurrency(data.stats.totalPaid),
      icon: CreditCard,
      accent: 'green' as const,
    },
    {
      label: 'Pending Amount',
      value: formatCurrency(data.stats.pendingAmount),
      icon: DollarSign,
      accent: data.stats.pendingAmount > 0 ? 'yellow' as const : 'green' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminDetailPageHeader
        title={`${affiliateName} - Payables`}
        backHref={`/admin/affiliates/${affiliateId}`}
        backLabel="Back to Affiliate"
        onRefresh={fetchData}
        actions={
          <Button
            onClick={() => router.push(`/admin/invoices/new?affiliateId=${affiliateId}&type=PAYABLE`)}
            className="gap-2 bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Create Payable Invoice
          </Button>
        }
      />

      {/* Stats Overview */}
      <AdminStatGrid stats={stats} />

      {/* Invoice Table */}
      <AdminDataTable<AffiliatePayable>
        data={data.invoices}
        loading={loading}
        keyField="id"
        columns={columns}
        title="Payable Invoices"
        searchPlaceholder="Search by invoice number..."
        searchFields={['invoiceNumber']}
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
            ],
          },
        ]}
        defaultSortField="createdAt"
        defaultSortDirection="desc"
        itemsPerPage={10}
        rowActions={rowActions}
        onRowClick={handleViewInvoice}
        emptyMessage="No payable invoices found for this affiliate."
      />

      {/* Period Breakdown */}
      {data.invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/30">
            <h3 className="text-sm font-semibold text-gray-900">Earnings by Period</h3>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {data.invoices.slice(0, 5).map((invoice) => {
                const total = typeof invoice.total === 'string' ? parseFloat(invoice.total) : invoice.total;
                const paid = typeof invoice.amountPaid === 'string' ? parseFloat(invoice.amountPaid) : invoice.amountPaid;
                const percent = total > 0 ? (paid / total) * 100 : 0;

                return (
                  <div key={invoice.id} className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {formatDateRange(invoice.periodStart, invoice.periodEnd)}
                        </span>
                        <span className="text-sm text-gray-600">
                          {formatCurrency(total)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <InvoiceStatusBadge status={invoice.status} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
