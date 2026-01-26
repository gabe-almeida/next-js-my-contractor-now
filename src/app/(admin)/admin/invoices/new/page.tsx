'use client';

/**
 * Create Invoice Page
 *
 * WHY: Allows admins to create new invoices with lead selection.
 * WHEN: Admin clicks "Create Invoice" button.
 * HOW: Multi-step form with type selection, recipient, dates, and lead inclusion.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { AdminDetailPageHeader, AdminSection } from '@/components/admin/ui';
import { InvoiceForm, type InvoiceFormData, type Buyer, type Affiliate } from '@/components/admin/invoices/InvoiceForm';
import { LeadSelectorModal, type UninvoicedLead } from '@/components/admin/invoices/LeadSelectorModal';
import { InvoiceLineItemTable, type InvoiceLineItem } from '@/components/admin/invoices/InvoiceLineItemTable';
import { AlertCircle, FileText } from 'lucide-react';

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CreateInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-populate from URL params if coming from buyer/affiliate page
  const preselectedBuyerId = searchParams.get('buyerId');
  const preselectedAffiliateId = searchParams.get('affiliateId');
  const preselectedType = searchParams.get('type') as 'RECEIVABLE' | 'PAYABLE' | null;

  // Data states
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [uninvoicedLeads, setUninvoicedLeads] = useState<UninvoicedLead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [previewLineItems, setPreviewLineItems] = useState<InvoiceLineItem[]>([]);

  // UI states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLeadSelector, setShowLeadSelector] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Form data for tracking buyer/affiliate selection
  const [currentBuyerId, setCurrentBuyerId] = useState<string | null>(preselectedBuyerId);
  const [currentType, setCurrentType] = useState<'RECEIVABLE' | 'PAYABLE'>(preselectedType || 'RECEIVABLE');
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');

  // Fetch buyers and affiliates on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [buyersRes, affiliatesRes] = await Promise.all([
          fetch('/api/admin/buyers?active=true', {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
            },
          }),
          fetch('/api/admin/affiliates?status=ACTIVE', {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
            },
          }),
        ]);

        const [buyersData, affiliatesData] = await Promise.all([
          buyersRes.json(),
          affiliatesRes.json(),
        ]);

        if (buyersData.success) {
          setBuyers(buyersData.data || []);
        }

        if (affiliatesData.success) {
          setAffiliates(affiliatesData.data || []);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load buyers and affiliates');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch uninvoiced leads when buyer and period change
  const fetchUninvoicedLeads = useCallback(async (buyerId: string, start: string, end: string) => {
    if (!buyerId || !start || !end) return;

    setLoadingLeads(true);
    try {
      const params = new URLSearchParams({
        periodStart: start,
        periodEnd: end,
      });

      const response = await fetch(`/api/admin/buyers/${buyerId}/uninvoiced-leads?${params}`, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        const leads = data.data || [];
        setUninvoicedLeads(leads);
        // Auto-select all leads by default
        setSelectedLeadIds(leads.map((l: UninvoicedLead) => l.id));
        // Create preview line items
        setPreviewLineItems(leads.map((lead: UninvoicedLead) => ({
          id: lead.id,
          description: `Lead - ${lead.serviceType}`,
          quantity: 1,
          unitPrice: lead.amount,
          amount: lead.amount,
          itemType: 'LEAD' as const,
          leadId: lead.id,
          metadata: {
            serviceType: lead.serviceType,
            zipCode: lead.zipCode,
            date: lead.createdAt,
          },
        })));
      }
    } catch (err) {
      console.error('Error fetching uninvoiced leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  // Handle lead selection change
  const handleLeadSelectionConfirm = useCallback((selectedIds: string[]) => {
    setSelectedLeadIds(selectedIds);

    // Update preview line items based on selection
    const selectedLeads = uninvoicedLeads.filter(l => selectedIds.includes(l.id));
    setPreviewLineItems(selectedLeads.map(lead => ({
      id: lead.id,
      description: `Lead - ${lead.serviceType}`,
      quantity: 1,
      unitPrice: lead.amount,
      amount: lead.amount,
      itemType: 'LEAD' as const,
      leadId: lead.id,
      metadata: {
        serviceType: lead.serviceType,
        zipCode: lead.zipCode,
        date: lead.createdAt,
      },
    })));

    setShowLeadSelector(false);
  }, [uninvoicedLeads]);

  // Handle form submission
  const handleSubmit = async (formData: InvoiceFormData) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
        body: JSON.stringify({
          ...formData,
          leadIds: selectedLeadIds,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/admin/invoices/${data.data.id}`);
      } else {
        setError(data.error || 'Failed to create invoice');
      }
    } catch (err) {
      console.error('Error creating invoice:', err);
      setError('Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate totals from preview line items
  const subtotal = previewLineItems.reduce((sum, item) => {
    const amount = typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount;
    return sum + amount;
  }, 0);

  // Determine selected buyer name for modal
  const selectedBuyer = buyers.find(b => b.id === currentBuyerId);

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminDetailPageHeader
          title="Create Invoice"
          backHref="/admin/invoices"
          backLabel="Back to Invoices"
        />
        <div className="animate-pulse">
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminDetailPageHeader
        title="Create Invoice"
        backHref="/admin/invoices"
        backLabel="Back to Invoices"
      />

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form */}
        <div className="lg:col-span-2">
          <InvoiceForm
            initialData={{
              type: preselectedType || 'RECEIVABLE',
              buyerId: preselectedBuyerId || undefined,
              affiliateId: preselectedAffiliateId || undefined,
            }}
            buyers={buyers}
            affiliates={affiliates}
            onSubmit={handleSubmit}
            onAddLeads={() => {
              setShowLeadSelector(true);
            }}
            selectedLeadCount={selectedLeadIds.length}
            loading={submitting}
          />
        </div>

        {/* Right Column - Preview */}
        <div className="space-y-6">
          {/* Invoice Preview */}
          {previewLineItems.length > 0 ? (
            <InvoiceLineItemTable
              lineItems={previewLineItems}
              subtotal={subtotal}
              total={subtotal}
              loading={loadingLeads}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                No Leads Selected
              </h3>
              <p className="text-xs text-gray-500">
                {currentType === 'RECEIVABLE'
                  ? 'Select a buyer and date range, then add leads to the invoice.'
                  : 'Select an affiliate to create a payable invoice.'}
              </p>
            </div>
          )}

          {/* Quick Stats */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Invoice Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Line Items</span>
                <span className="text-sm font-medium text-gray-900">{previewLineItems.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(subtotal)}</span>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lead Selector Modal */}
      <LeadSelectorModal
        isOpen={showLeadSelector}
        onClose={() => setShowLeadSelector(false)}
        onConfirm={handleLeadSelectionConfirm}
        leads={uninvoicedLeads}
        initialSelectedIds={selectedLeadIds}
        buyerName={selectedBuyer?.name}
        periodStart={periodStart}
        periodEnd={periodEnd}
        loading={loadingLeads}
      />
    </div>
  );
}
