'use client';

/**
 * PaymentForm - Form for recording payments against an invoice
 *
 * WHY: Provides a standardized way to record payments with proper validation.
 * WHEN: Used when admin clicks "Record Payment" on an invoice detail page.
 * HOW: Renders form with amount (max = balance), payment method, date, reference, and notes.
 *
 * Features:
 * - Amount validation (cannot exceed invoice balance)
 * - Payment method selection
 * - Payment date picker
 * - Optional reference number and notes
 * - Quick "Pay in Full" action
 */

import { useState, useCallback, memo } from 'react';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/fields/Select';
import { CurrencyInput } from '@/components/ui/fields/CurrencyInput';
import { DollarSign, Calendar, FileText, Hash } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type PaymentMethod = 'WIRE' | 'ACH' | 'CHECK' | 'PAYPAL' | 'CREDIT_CARD' | 'OTHER';

export interface PaymentFormData {
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  bankAccount?: string;
  notes?: string;
}

interface PaymentFormProps {
  /** Maximum payment amount (invoice balance) */
  maxAmount: number;
  /** Invoice number for display */
  invoiceNumber: string;
  /** Called when form is submitted */
  onSubmit: (data: PaymentFormData) => Promise<void>;
  /** Called when form is cancelled */
  onCancel: () => void;
  /** Loading state */
  loading?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const paymentMethodOptions: SelectOption[] = [
  { value: 'WIRE', label: 'Wire Transfer' },
  { value: 'ACH', label: 'ACH' },
  { value: 'CHECK', label: 'Check' },
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'OTHER', label: 'Other' },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

// ============================================
// MAIN COMPONENT
// ============================================

export const PaymentForm = memo(function PaymentForm({
  maxAmount,
  invoiceNumber,
  onSubmit,
  onCancel,
  loading = false,
}: PaymentFormProps) {
  // Form state
  const [formData, setFormData] = useState<PaymentFormData>({
    amount: '',
    paymentDate: getTodayDateString(),
    paymentMethod: 'ACH',
    referenceNumber: '',
    bankAccount: '',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Parse amount as number for validation
  const parsedAmount = parseFloat(formData.amount.replace(/[,$]/g, '')) || 0;

  // Handle field changes
  const handleChange = useCallback((field: keyof PaymentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }, []);

  // Pay in full
  const handlePayInFull = useCallback(() => {
    setFormData((prev) => ({ ...prev, amount: maxAmount.toFixed(2) }));
    setErrors((prev) => ({ ...prev, amount: '' }));
  }, [maxAmount]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || parsedAmount <= 0) {
      newErrors.amount = 'Please enter a payment amount';
    } else if (parsedAmount > maxAmount) {
      newErrors.amount = `Amount cannot exceed balance of ${formatCurrency(maxAmount)}`;
    }

    if (!formData.paymentDate) {
      newErrors.paymentDate = 'Payment date is required';
    }

    if (!formData.paymentMethod) {
      newErrors.paymentMethod = 'Please select a payment method';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, parsedAmount, maxAmount]);

  // Handle submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        amount: parsedAmount.toFixed(2),
      });
    } catch (error) {
      console.error('Error recording payment:', error);
    } finally {
      setSubmitting(false);
    }
  }, [formData, parsedAmount, onSubmit, validateForm]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
        <p className="text-sm text-gray-500 mt-1">
          Invoice: <span className="font-medium text-gray-700">{invoiceNumber}</span>
        </p>
        <p className="text-sm text-gray-500">
          Balance Due: <span className="font-semibold text-gray-900">{formatCurrency(maxAmount)}</span>
        </p>
      </div>

      {/* Amount */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Payment Amount <span className="text-red-500">*</span>
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePayInFull}
            className="text-xs text-orange-600 hover:text-orange-700"
          >
            Pay in Full
          </Button>
        </div>
        <CurrencyInput
          value={formData.amount}
          onChange={(v) => handleChange('amount', v)}
          max={maxAmount}
          error={errors.amount}
          placeholder="$0.00"
        />
        {!errors.amount && parsedAmount > 0 && parsedAmount < maxAmount && (
          <p className="mt-1 text-xs text-gray-500">
            Remaining balance after payment: {formatCurrency(maxAmount - parsedAmount)}
          </p>
        )}
      </div>

      {/* Payment Date and Method */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Date <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={formData.paymentDate}
              onChange={(e) => handleChange('paymentDate', e.target.value)}
              className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl text-sm focus:outline-none focus:ring-2 transition-colors ${
                errors.paymentDate
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-orange-300 focus:ring-orange-500 focus:border-orange-500'
              }`}
            />
          </div>
          {errors.paymentDate && (
            <p className="mt-1 text-sm text-red-600">{errors.paymentDate}</p>
          )}
        </div>

        <div>
          <Select
            value={formData.paymentMethod}
            onChange={(v) => handleChange('paymentMethod', v)}
            options={paymentMethodOptions}
            label={<>Payment Method <span className="text-red-500">*</span></>}
            error={errors.paymentMethod}
          />
        </div>
      </div>

      {/* Reference Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Reference Number
          <span className="text-xs text-gray-400 ml-1">(Check #, Wire Reference, etc.)</span>
        </label>
        <div className="relative">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={formData.referenceNumber}
            onChange={(e) => handleChange('referenceNumber', e.target.value)}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
            placeholder="e.g., CHK-12345 or WR-98765"
          />
        </div>
      </div>

      {/* Bank Account (last 4) */}
      {(formData.paymentMethod === 'ACH' || formData.paymentMethod === 'WIRE') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bank Account (last 4 digits)
          </label>
          <input
            type="text"
            value={formData.bankAccount}
            onChange={(e) => handleChange('bankAccount', e.target.value.slice(0, 4))}
            maxLength={4}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
            placeholder="e.g., 1234"
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={3}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none"
          placeholder="Any additional notes about this payment..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting || loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={submitting || loading}
          loadingText="Recording..."
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          Record Payment
        </Button>
      </div>
    </form>
  );
});

export default PaymentForm;
