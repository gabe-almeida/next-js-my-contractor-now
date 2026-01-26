'use client';

/**
 * PaymentHistoryTimeline - Vertical timeline showing payment history
 *
 * WHY: Provides a clear visual history of all payments made against an invoice.
 * WHEN: Used on invoice detail pages to show payment progression.
 * HOW: Renders a vertical timeline with dots and lines, showing each payment
 *      with date, amount, method, reference, and who recorded it.
 *
 * Features:
 * - Chronological payment display (newest first)
 * - Visual timeline with connecting lines
 * - Payment method icons
 * - Shows who recorded each payment
 */

import { memo } from 'react';
import {
  CreditCard,
  Building2,
  Banknote,
  Wallet,
  FileCheck,
  CircleDollarSign,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type PaymentMethod = 'WIRE' | 'ACH' | 'CHECK' | 'PAYPAL' | 'CREDIT_CARD' | 'OTHER';

export interface Payment {
  id: string;
  amount: number | string;
  paymentDate: string;
  paymentMethod: PaymentMethod | string;
  referenceNumber?: string | null;
  bankAccount?: string | null;
  notes?: string | null;
  recordedBy?: {
    id: string;
    name?: string | null;
    email: string;
  } | null;
  createdAt: string;
}

interface PaymentHistoryTimelineProps {
  /** List of payments to display */
  payments: Payment[];
  /** Show empty state message */
  showEmpty?: boolean;
  /** Loading state */
  loading?: boolean;
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Payment method icons and labels
const paymentMethodConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  WIRE: {
    icon: <Building2 className="h-4 w-4" />,
    label: 'Wire Transfer',
    color: 'text-blue-600 bg-blue-50',
  },
  ACH: {
    icon: <Building2 className="h-4 w-4" />,
    label: 'ACH',
    color: 'text-green-600 bg-green-50',
  },
  CHECK: {
    icon: <FileCheck className="h-4 w-4" />,
    label: 'Check',
    color: 'text-purple-600 bg-purple-50',
  },
  PAYPAL: {
    icon: <Wallet className="h-4 w-4" />,
    label: 'PayPal',
    color: 'text-blue-500 bg-blue-50',
  },
  CREDIT_CARD: {
    icon: <CreditCard className="h-4 w-4" />,
    label: 'Credit Card',
    color: 'text-orange-600 bg-orange-50',
  },
  OTHER: {
    icon: <CircleDollarSign className="h-4 w-4" />,
    label: 'Other',
    color: 'text-gray-600 bg-gray-50',
  },
};

// ============================================
// MAIN COMPONENT
// ============================================

export const PaymentHistoryTimeline = memo(function PaymentHistoryTimeline({
  payments,
  showEmpty = true,
  loading = false,
}: PaymentHistoryTimelineProps) {
  // Sort payments by date (newest first)
  const sortedPayments = [...payments].sort(
    (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
  );

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Payment History</h3>
        </div>
        <div className="p-5 animate-pulse">
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-8 w-8 bg-gray-100 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-50 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/30">
        <h3 className="text-sm font-semibold text-gray-900">Payment History</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {payments.length} payment{payments.length !== 1 ? 's' : ''} recorded
        </p>
      </div>

      {/* Timeline */}
      <div className="p-5">
        {sortedPayments.length === 0 ? (
          showEmpty && (
            <div className="text-center py-8">
              <Banknote className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No payments recorded yet</p>
            </div>
          )
        ) : (
          <div className="relative">
            {/* Vertical line */}
            {sortedPayments.length > 1 && (
              <div className="absolute left-4 top-8 bottom-8 w-0.5 bg-gray-200" />
            )}

            {/* Payment entries */}
            <div className="space-y-6">
              {sortedPayments.map((payment, index) => {
                const methodConfig = paymentMethodConfig[payment.paymentMethod] || paymentMethodConfig.OTHER;
                const isFirst = index === 0;
                const isLast = index === sortedPayments.length - 1;

                return (
                  <div key={payment.id} className="relative flex gap-4">
                    {/* Timeline dot */}
                    <div
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${methodConfig.color}`}
                    >
                      {methodConfig.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {methodConfig.label}
                            {payment.referenceNumber && (
                              <span className="ml-1">
                                | Ref: {payment.referenceNumber}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-medium text-gray-700">
                            {formatDate(payment.paymentDate)}
                          </p>
                          {payment.recordedBy && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              by {payment.recordedBy.name || payment.recordedBy.email.split('@')[0]}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      {payment.notes && (
                        <p className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                          {payment.notes}
                        </p>
                      )}

                      {/* Bank account info */}
                      {payment.bankAccount && (
                        <p className="mt-1 text-xs text-gray-400">
                          Account ending in {payment.bankAccount}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default PaymentHistoryTimeline;
