'use client';

/**
 * Invoice Detail Page
 *
 * WHY: Full invoice view with line items, payments, and actions.
 * WHEN: Admin clicks on an invoice from the list or navigates directly.
 * HOW: Fetches invoice data, displays using invoice components, provides actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  AdminDetailPageHeader,
  AdminSection,
  AdminStatGrid,
  AdminInfoGrid,
} from '@/components/admin/ui';
import { InvoiceStatusBadge } from '@/components/admin/invoices/InvoiceStatusBadge';
import { InvoiceLineItemTable, type InvoiceLineItem } from '@/components/admin/invoices/InvoiceLineItemTable';
import { PaymentHistoryTimeline, type Payment } from '@/components/admin/invoices/PaymentHistoryTimeline';
import { PaymentForm, type PaymentFormData } from '@/components/admin/invoices/PaymentForm';
import {
  AlertCircle,
  RefreshCw,
  Send,
  XCircle,
  Download,
  DollarSign,
  Calendar,
  Building2,
  Users,
  FileText,
  CreditCard,
  Clock,
  Mail,
  User,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  type: 'RECEIVABLE' | 'PAYABLE';
  status: string;
  buyerId: string | null;
  affiliateId: string | null;
  periodStart: string;
  periodEnd: string;
  subtotal: number | string;
  adjustments: number | string;
  taxAmount: number | string;
  total: number | string;
  amountPaid: number | string;
  balance: number | string;
  issuedAt: string | null;
  dueDate: string | null;
  paidInFullAt: string | null;
  paymentTermsDays: number;
  notes: string | null;
  buyerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  daysOverdue?: number;
  buyer?: {
    id: string;
    name: string;
    displayName: string | null;
    billingEmail: string | null;
    contactEmail: string | null;
    contactName: string | null;
  };
  affiliate?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
  };
  lineItems: InvoiceLineItem[];
  payments: Payment[];
  statusHistory: Array<{
    id: string;
    oldStatus: string | null;
    newStatus: string;
    reason: string | null;
    changedBy?: { name: string | null; email: string };
    createdAt: string;
  }>;
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

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchInvoice = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/invoices/${invoiceId}`, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Invoice not found');
        }
        throw new Error('Failed to fetch invoice');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch invoice');
      }

      setInvoice(result.data.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
    }
  }, [invoiceId, fetchInvoice]);

  const handleSendInvoice = async () => {
    if (!invoice || !confirm(`Send invoice ${invoice.invoiceNumber}?`)) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });
      const data = await response.json();

      if (data.success) {
        fetchInvoice();
      } else {
        alert(data.error || 'Failed to send invoice');
      }
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Failed to send invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!invoice) return;

    const reason = prompt('Enter cancellation reason:');
    if (!reason) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();

      if (data.success) {
        fetchInvoice();
      } else {
        alert(data.error || 'Failed to cancel invoice');
      }
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      alert('Failed to cancel invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;

    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/pdf`, {
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

  const handleRecordPayment = async (data: PaymentFormData) => {
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (result.success) {
        setShowPaymentForm(false);
        fetchInvoice();
      } else {
        alert(result.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-8 w-8 bg-gray-200 rounded-lg" />
            <div className="h-8 bg-gray-200 rounded w-1/3" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
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
          title="Invoice Details"
          backHref="/admin/invoices"
          backLabel="Back to Invoices"
        />

        <div className="bg-red-50 rounded-xl border border-red-200 p-6">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Failed to load invoice</span>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
          <Button
            variant="outline"
            onClick={fetchInvoice}
            className="mt-4 gap-2 border-red-300 text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-6">
        <AdminDetailPageHeader
          title="Invoice Not Found"
          backHref="/admin/invoices"
          backLabel="Back to Invoices"
        />

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Invoice Not Found
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            The invoice you are looking for does not exist or has been removed.
          </p>
          <Button
            onClick={() => router.push('/admin/invoices')}
            variant="outline"
          >
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  const balance = typeof invoice.balance === 'string' ? parseFloat(invoice.balance) : invoice.balance;
  const canRecordPayment = !['DRAFT', 'CANCELLED', 'PAID'].includes(invoice.status);

  // Prepare badges
  const badges = [
    {
      label: invoice.type === 'RECEIVABLE' ? 'Receivable' : 'Payable',
      variant: invoice.type === 'RECEIVABLE' ? 'blue' as const : 'purple' as const,
    },
  ];

  // Stats for the overview
  const stats = [
    {
      label: 'Total',
      value: formatCurrency(invoice.total),
      icon: DollarSign,
    },
    {
      label: 'Paid',
      value: formatCurrency(invoice.amountPaid),
      icon: CreditCard,
      accent: 'green' as const,
    },
    {
      label: 'Balance',
      value: formatCurrency(invoice.balance),
      icon: DollarSign,
      accent: balance > 0 ? 'orange' as const : 'green' as const,
    },
    {
      label: 'Due Date',
      value: formatDate(invoice.dueDate),
      icon: Calendar,
      accent: invoice.status === 'OVERDUE' ? 'red' as const : undefined,
    },
  ];

  // Recipient info
  const recipientName = invoice.buyer
    ? invoice.buyer.displayName || invoice.buyer.name
    : invoice.affiliate
      ? `${invoice.affiliate.firstName || ''} ${invoice.affiliate.lastName || ''}`.trim() || invoice.affiliate.email
      : '-';

  const recipientEmail = invoice.buyer
    ? invoice.buyer.billingEmail || invoice.buyer.contactEmail
    : invoice.affiliate?.email;

  const recipientInfoItems = [
    { label: 'Name', value: recipientName, icon: invoice.buyer ? Building2 : Users },
    recipientEmail && { label: 'Email', value: recipientEmail, icon: Mail },
    invoice.buyer?.contactName && { label: 'Contact', value: invoice.buyer.contactName, icon: User },
  ].filter(Boolean) as Array<{ label: string; value: string; icon: any }>;

  // Invoice info
  const invoiceInfoItems = [
    { label: 'Invoice Number', value: invoice.invoiceNumber, icon: FileText },
    { label: 'Period', value: `${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`, icon: Calendar },
    { label: 'Payment Terms', value: `Net ${invoice.paymentTermsDays}`, icon: Clock },
    invoice.issuedAt && { label: 'Issued', value: formatDateTime(invoice.issuedAt), icon: Send },
    invoice.paidInFullAt && { label: 'Paid in Full', value: formatDateTime(invoice.paidInFullAt), icon: CreditCard },
    invoice.createdBy && { label: 'Created By', value: invoice.createdBy.name || invoice.createdBy.email, icon: User },
  ].filter(Boolean) as Array<{ label: string; value: string; icon: any }>;

  // Header actions
  const headerActions = (
    <div className="flex gap-2">
      {invoice.status === 'DRAFT' && (
        <Button
          onClick={handleSendInvoice}
          disabled={actionLoading}
          className="gap-2 bg-emerald-500 hover:bg-emerald-600"
        >
          <Send className="h-4 w-4" />
          Send Invoice
        </Button>
      )}
      {canRecordPayment && (
        <Button
          onClick={() => setShowPaymentForm(true)}
          className="gap-2 bg-orange-500 hover:bg-orange-600"
        >
          <DollarSign className="h-4 w-4" />
          Record Payment
        </Button>
      )}
      {invoice.status !== 'DRAFT' && (
        <Button
          variant="outline"
          onClick={handleDownloadPdf}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      )}
      {!['PAID', 'CANCELLED'].includes(invoice.status) && (
        <Button
          variant="outline"
          onClick={handleCancelInvoice}
          disabled={actionLoading}
          className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
        >
          <XCircle className="h-4 w-4" />
          Cancel
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <AdminDetailPageHeader
          title={invoice.invoiceNumber}
          backHref="/admin/invoices"
          backLabel="Back to Invoices"
          badges={badges}
          onRefresh={fetchInvoice}
          actions={headerActions}
        />
        <div className="mt-2 ml-20">
          <InvoiceStatusBadge status={invoice.status} daysOverdue={invoice.daysOverdue} />
        </div>
      </div>

      {/* Stats Overview */}
      <AdminStatGrid stats={stats} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Invoice Details & Line Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recipient Info */}
          <AdminSection title={invoice.type === 'RECEIVABLE' ? 'Bill To' : 'Pay To'}>
            <AdminInfoGrid items={recipientInfoItems} columns={2} />
          </AdminSection>

          {/* Invoice Info */}
          <AdminSection title="Invoice Details">
            <AdminInfoGrid items={invoiceInfoItems} columns={2} />
          </AdminSection>

          {/* Line Items */}
          <InvoiceLineItemTable
            lineItems={invoice.lineItems}
            subtotal={invoice.subtotal}
            adjustments={invoice.adjustments}
            taxAmount={invoice.taxAmount}
            total={invoice.total}
            loading={loading}
          />

          {/* Notes */}
          {(invoice.notes || invoice.buyerNotes) && (
            <AdminSection title="Notes">
              {invoice.notes && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">Internal Notes</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                    {invoice.notes}
                  </p>
                </div>
              )}
              {invoice.buyerNotes && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Notes on Invoice</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                    {invoice.buyerNotes}
                  </p>
                </div>
              )}
            </AdminSection>
          )}
        </div>

        {/* Right Column - Payments & History */}
        <div className="space-y-6">
          {/* Payment History */}
          <PaymentHistoryTimeline
            payments={invoice.payments}
            loading={loading}
          />

          {/* Status History */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/30">
              <h3 className="text-sm font-semibold text-gray-900">Status History</h3>
            </div>
            <div className="p-5">
              {invoice.statusHistory.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No status changes</p>
              ) : (
                <div className="space-y-4">
                  {invoice.statusHistory.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 text-sm">
                      <div className="flex-shrink-0 mt-1">
                        <div className="h-2 w-2 rounded-full bg-gray-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900">
                          {entry.oldStatus ? (
                            <>
                              <span className="text-gray-500">{entry.oldStatus}</span>
                              <span className="mx-1 text-gray-400">→</span>
                            </>
                          ) : null}
                          <span className="font-medium">{entry.newStatus}</span>
                        </p>
                        {entry.reason && (
                          <p className="text-xs text-gray-500 mt-0.5">{entry.reason}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDateTime(entry.createdAt)}
                          {entry.changedBy && ` by ${entry.changedBy.name || entry.changedBy.email}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setShowPaymentForm(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl p-6">
              <PaymentForm
                maxAmount={balance}
                invoiceNumber={invoice.invoiceNumber}
                onSubmit={handleRecordPayment}
                onCancel={() => setShowPaymentForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
