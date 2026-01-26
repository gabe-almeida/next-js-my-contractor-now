'use client';

/**
 * Buyer Invoices Tab Page
 *
 * WHY: Shows all invoices for a specific buyer with summary stats.
 * WHEN: Admin clicks "Invoices" tab on buyer detail page.
 * HOW: Fetches buyer invoice data, displays summary and table.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  AdminDetailPageHeader,
  AdminSection,
  AdminStatGrid,
  AdminDataTable,
  type TableColumn,
  type RowAction,
} from '@/components/admin/ui';
import { InvoiceStatusBadge } from '@/components/admin/invoices/InvoiceStatusBadge';
import { BuyerScrubRateCard, type ScrubRateData } from '@/components/admin/invoices/BuyerScrubRateCard';
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
  ArrowRight,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface BuyerInvoice {
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

interface BuyerInvoiceSummary {
  buyer: {
    id: string;
    name: string;
    displayName: string | null;
  };
  stats: {
    totalInvoiced: number;
    totalPaid: number;
    outstandingBalance: number;
    invoiceCount: number;
    overdueCount: number;
  };
  scrubRate?: ScrubRateData;
  invoices: BuyerInvoice[];
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

export default function BuyerInvoicesPage() {
  const params = useParams();
  const router = useRouter();
  const buyerId = params.id as string;

  const [data, setData] = useState<BuyerInvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/buyers/${buyerId}/invoice-summary`, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Buyer not found');
        }
        throw new Error('Failed to fetch invoice data');
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
  }, [buyerId]);

  useEffect(() => {
    if (buyerId) {
      fetchData();
    }
  }, [buyerId, fetchData]);

  const handleViewInvoice = (invoice: BuyerInvoice) => {
    router.push(`/admin/invoices/${invoice.id}`);
  };

  const handleSendInvoice = async (invoice: BuyerInvoice) => {
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

  const handleDownloadPdf = async (invoice: BuyerInvoice) => {
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
  const columns: TableColumn<BuyerInvoice>[] = useMemo(
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
  const rowActions: RowAction<BuyerInvoice>[] = useMemo(
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
          title="Buyer Invoices"
          backHref={`/admin/buyers/${buyerId}`}
          backLabel="Back to Buyer"
        />

        <div className="bg-red-50 rounded-xl border border-red-200 p-6">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Failed to load invoice data</span>
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

  const buyerName = data.buyer.displayName || data.buyer.name;

  // Stats for the overview
  const stats = [
    {
      label: 'Total Invoiced',
      value: formatCurrency(data.stats.totalInvoiced),
      icon: FileText,
    },
    {
      label: 'Total Paid',
      value: formatCurrency(data.stats.totalPaid),
      icon: CreditCard,
      accent: 'green' as const,
    },
    {
      label: 'Outstanding',
      value: formatCurrency(data.stats.outstandingBalance),
      icon: DollarSign,
      accent: data.stats.outstandingBalance > 0 ? 'orange' as const : 'green' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminDetailPageHeader
        title={`${buyerName} - Invoices`}
        backHref={`/admin/buyers/${buyerId}`}
        backLabel="Back to Buyer"
        onRefresh={fetchData}
        actions={
          <div className="flex gap-2">
            <Button
              onClick={() => router.push(`/admin/invoices/new?buyerId=${buyerId}&type=RECEIVABLE`)}
              className="gap-2 bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
            <Link href={`/admin/buyers/${buyerId}/scrub-reconciliation`}>
              <Button variant="outline" className="gap-2">
                Scrub Reconciliation
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        }
      />

      {/* Stats Overview */}
      <AdminStatGrid stats={stats} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Invoice Table */}
        <div className="lg:col-span-2">
          <AdminDataTable<BuyerInvoice>
            data={data.invoices}
            loading={loading}
            keyField="id"
            columns={columns}
            title="Invoices"
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
                  { value: 'CANCELLED', label: 'Cancelled' },
                ],
              },
            ]}
            defaultSortField="createdAt"
            defaultSortDirection="desc"
            itemsPerPage={10}
            rowActions={rowActions}
            onRowClick={handleViewInvoice}
            emptyMessage="No invoices found for this buyer."
          />
        </div>

        {/* Right Column - Scrub Rate Card */}
        <div>
          {data.scrubRate ? (
            <BuyerScrubRateCard
              data={data.scrubRate}
              buyerName={buyerName}
              loading={loading}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
              <Clock className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                No Scrub Data Yet
              </h3>
              <p className="text-xs text-gray-500">
                Scrub rate data will appear once reconciliation is performed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
