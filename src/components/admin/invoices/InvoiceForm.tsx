'use client';

/**
 * InvoiceForm - Form for creating/editing invoices
 *
 * WHY: Provides a consistent interface for creating both AR (buyer) and AP (affiliate) invoices.
 * WHEN: Used on the new invoice page and invoice edit page.
 * HOW: Renders form fields for invoice type, buyer/affiliate selection, dates, terms, and notes.
 *      Integrates with LeadSelectorModal for adding leads to the invoice.
 *
 * Features:
 * - Type selector (RECEIVABLE/PAYABLE)
 * - Dynamic buyer OR affiliate selector based on type
 * - Date range picker for billing period
 * - Payment terms configuration
 * - Notes fields (internal and buyer-facing)
 * - Integration with LeadSelectorModal
 */

import { useState, useCallback, useMemo, memo } from 'react';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/fields/Select';
import { CurrencyInput } from '@/components/ui/fields/CurrencyInput';
import { Plus, FileText, Building2, Users, Calendar } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type InvoiceType = 'RECEIVABLE' | 'PAYABLE';

export interface InvoiceFormData {
  type: InvoiceType;
  buyerId?: string;
  affiliateId?: string;
  periodStart: string;
  periodEnd: string;
  paymentTermsDays: number;
  notes?: string;
  buyerNotes?: string;
  leadIds?: string[];
}

export interface Buyer {
  id: string;
  name: string;
  billingEmail?: string | null;
  paymentTermsDays?: number;
}

export interface Affiliate {
  id: string;
  name?: string | null;
  email: string;
  paymentTerms?: string | null;
}

interface InvoiceFormProps {
  /** Initial form data (for editing) */
  initialData?: Partial<InvoiceFormData>;
  /** Available buyers for selection */
  buyers: Buyer[];
  /** Available affiliates for selection */
  affiliates: Affiliate[];
  /** Called when form is submitted */
  onSubmit: (data: InvoiceFormData) => Promise<void>;
  /** Called when add leads button is clicked */
  onAddLeads?: () => void;
  /** Number of selected leads */
  selectedLeadCount?: number;
  /** Loading state */
  loading?: boolean;
  /** Whether editing an existing invoice */
  isEditing?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const invoiceTypeOptions: SelectOption[] = [
  { value: 'RECEIVABLE', label: 'Accounts Receivable (Invoice to Buyer)' },
  { value: 'PAYABLE', label: 'Accounts Payable (Pay to Affiliate)' },
];

const paymentTermsOptions: SelectOption[] = [
  { value: '7', label: 'Net 7' },
  { value: '15', label: 'Net 15' },
  { value: '30', label: 'Net 30' },
  { value: '45', label: 'Net 45' },
  { value: '60', label: 'Net 60' },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function getDefaultPeriodDates(): { start: string; end: string } {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    start: startOfMonth.toISOString().split('T')[0],
    end: endOfMonth.toISOString().split('T')[0],
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

export const InvoiceForm = memo(function InvoiceForm({
  initialData,
  buyers,
  affiliates,
  onSubmit,
  onAddLeads,
  selectedLeadCount = 0,
  loading = false,
  isEditing = false,
}: InvoiceFormProps) {
  const defaultDates = getDefaultPeriodDates();

  // Form state
  const [formData, setFormData] = useState<InvoiceFormData>({
    type: initialData?.type || 'RECEIVABLE',
    buyerId: initialData?.buyerId || '',
    affiliateId: initialData?.affiliateId || '',
    periodStart: initialData?.periodStart || defaultDates.start,
    periodEnd: initialData?.periodEnd || defaultDates.end,
    paymentTermsDays: initialData?.paymentTermsDays || 30,
    notes: initialData?.notes || '',
    buyerNotes: initialData?.buyerNotes || '',
    leadIds: initialData?.leadIds || [],
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Derived options
  const buyerOptions: SelectOption[] = useMemo(() => [
    { value: '', label: 'Select a buyer...' },
    ...buyers.map((b) => ({ value: b.id, label: b.name })),
  ], [buyers]);

  const affiliateOptions: SelectOption[] = useMemo(() => [
    { value: '', label: 'Select an affiliate...' },
    ...affiliates.map((a) => ({
      value: a.id,
      label: a.name || a.email,
    })),
  ], [affiliates]);

  // Get selected entity details
  const selectedBuyer = buyers.find((b) => b.id === formData.buyerId);
  const selectedAffiliate = affiliates.find((a) => a.id === formData.affiliateId);

  // Update payment terms when entity is selected
  const handleEntityChange = useCallback((field: 'buyerId' | 'affiliateId', value: string) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };

      // Auto-fill payment terms from entity
      if (field === 'buyerId' && value) {
        const buyer = buyers.find((b) => b.id === value);
        if (buyer?.paymentTermsDays) {
          newData.paymentTermsDays = buyer.paymentTermsDays;
        }
      }

      // Clear the other field
      if (field === 'buyerId') {
        newData.affiliateId = '';
      } else {
        newData.buyerId = '';
      }

      return newData;
    });
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }, [buyers]);

  // Handle type change
  const handleTypeChange = useCallback((value: string) => {
    setFormData((prev) => ({
      ...prev,
      type: value as InvoiceType,
      buyerId: '',
      affiliateId: '',
    }));
    setErrors({});
  }, []);

  // Handle field changes
  const handleChange = useCallback((field: keyof InvoiceFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }, []);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.type === 'RECEIVABLE' && !formData.buyerId) {
      newErrors.buyerId = 'Please select a buyer';
    }

    if (formData.type === 'PAYABLE' && !formData.affiliateId) {
      newErrors.affiliateId = 'Please select an affiliate';
    }

    if (!formData.periodStart) {
      newErrors.periodStart = 'Period start date is required';
    }

    if (!formData.periodEnd) {
      newErrors.periodEnd = 'Period end date is required';
    }

    if (formData.periodStart && formData.periodEnd && formData.periodStart > formData.periodEnd) {
      newErrors.periodEnd = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting invoice form:', error);
    } finally {
      setSubmitting(false);
    }
  }, [formData, onSubmit, validateForm]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Invoice Type */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-50 rounded-lg">
            <FileText className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Invoice Type</h3>
            <p className="text-xs text-gray-500">Select the type of invoice to create</p>
          </div>
        </div>

        <Select
          value={formData.type}
          onChange={handleTypeChange}
          options={invoiceTypeOptions}
          disabled={isEditing}
        />
      </div>

      {/* Buyer/Affiliate Selection */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-50 rounded-lg">
            {formData.type === 'RECEIVABLE' ? (
              <Building2 className="h-5 w-5 text-blue-600" />
            ) : (
              <Users className="h-5 w-5 text-blue-600" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {formData.type === 'RECEIVABLE' ? 'Invoice To' : 'Pay To'}
            </h3>
            <p className="text-xs text-gray-500">
              {formData.type === 'RECEIVABLE'
                ? 'Select the buyer to invoice'
                : 'Select the affiliate to pay'}
            </p>
          </div>
        </div>

        {formData.type === 'RECEIVABLE' ? (
          <Select
            value={formData.buyerId || ''}
            onChange={(v) => handleEntityChange('buyerId', v)}
            options={buyerOptions}
            error={errors.buyerId}
            disabled={isEditing}
          />
        ) : (
          <Select
            value={formData.affiliateId || ''}
            onChange={(v) => handleEntityChange('affiliateId', v)}
            options={affiliateOptions}
            error={errors.affiliateId}
            disabled={isEditing}
          />
        )}

        {/* Selected entity info */}
        {selectedBuyer && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            <p>Billing Email: {selectedBuyer.billingEmail || 'Not set'}</p>
            <p>Default Terms: Net {selectedBuyer.paymentTermsDays || 30}</p>
          </div>
        )}
        {selectedAffiliate && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            <p>Email: {selectedAffiliate.email}</p>
            <p>Payment Terms: {selectedAffiliate.paymentTerms || 'Net 30'}</p>
          </div>
        )}
      </div>

      {/* Billing Period */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Calendar className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Billing Period</h3>
            <p className="text-xs text-gray-500">Select the date range for this invoice</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Period Start
            </label>
            <input
              type="date"
              value={formData.periodStart}
              onChange={(e) => handleChange('periodStart', e.target.value)}
              className={`w-full px-4 py-3 border-2 rounded-xl text-sm focus:outline-none focus:ring-2 transition-colors ${
                errors.periodStart
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-orange-300 focus:ring-orange-500 focus:border-orange-500'
              }`}
            />
            {errors.periodStart && (
              <p className="mt-1 text-sm text-red-600">{errors.periodStart}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Period End
            </label>
            <input
              type="date"
              value={formData.periodEnd}
              onChange={(e) => handleChange('periodEnd', e.target.value)}
              className={`w-full px-4 py-3 border-2 rounded-xl text-sm focus:outline-none focus:ring-2 transition-colors ${
                errors.periodEnd
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-orange-300 focus:ring-orange-500 focus:border-orange-500'
              }`}
            />
            {errors.periodEnd && (
              <p className="mt-1 text-sm text-red-600">{errors.periodEnd}</p>
            )}
          </div>
        </div>

        {/* Payment Terms */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Terms
          </label>
          <Select
            value={String(formData.paymentTermsDays)}
            onChange={(v) => handleChange('paymentTermsDays', parseInt(v, 10))}
            options={paymentTermsOptions}
          />
        </div>
      </div>

      {/* Lead Selection (for RECEIVABLE only) */}
      {formData.type === 'RECEIVABLE' && formData.buyerId && onAddLeads && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Line Items</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedLeadCount > 0
                  ? `${selectedLeadCount} lead${selectedLeadCount !== 1 ? 's' : ''} selected`
                  : 'Add leads to this invoice'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onAddLeads}
              icon={<Plus className="h-4 w-4" />}
            >
              {selectedLeadCount > 0 ? 'Manage Leads' : 'Add Leads'}
            </Button>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Notes</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Internal Notes
              <span className="text-xs text-gray-400 ml-1">(not shown on invoice)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none"
              placeholder="Internal notes about this invoice..."
            />
          </div>

          {formData.type === 'RECEIVABLE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes for Buyer
                <span className="text-xs text-gray-400 ml-1">(shown on invoice PDF)</span>
              </label>
              <textarea
                value={formData.buyerNotes}
                onChange={(e) => handleChange('buyerNotes', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none"
                placeholder="Payment instructions or notes for the buyer..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3">
        <Button
          type="submit"
          loading={submitting || loading}
          loadingText={isEditing ? 'Saving...' : 'Creating...'}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {isEditing ? 'Save Changes' : 'Create Invoice'}
        </Button>
      </div>
    </form>
  );
});

export default InvoiceForm;
