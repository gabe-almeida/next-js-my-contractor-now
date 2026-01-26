'use client';

/**
 * InvoiceLineItemTable - Table showing invoice line items (leads/calls/adjustments)
 *
 * WHY: Displays the detailed breakdown of what's included in an invoice.
 * WHEN: Used on invoice detail pages and invoice preview modals.
 * HOW: Renders a formatted table with lead details, quantities, and amounts,
 *      plus a summary section showing subtotal, adjustments, and total.
 *
 * Features:
 * - Shows lead details (service type, zip, date) in description
 * - Supports different item types (LEAD, CALL, ADJUSTMENT, CREDIT, FEE, SCRUB_CREDIT)
 * - Displays subtotal, adjustments, and total at bottom
 * - Optional delete action for draft invoices
 */

import { memo, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ============================================
// TYPES
// ============================================

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number | string;
  amount: number | string;
  itemType: 'LEAD' | 'CALL' | 'ADJUSTMENT' | 'CREDIT' | 'FEE' | 'SCRUB_CREDIT';
  leadId?: string | null;
  callId?: string | null;
  metadata?: {
    serviceType?: string;
    zipCode?: string;
    date?: string;
    originalInvoiceId?: string;
    returnReason?: string;
    [key: string]: unknown;
  } | null;
}

interface InvoiceLineItemTableProps {
  /** Line items to display */
  lineItems: InvoiceLineItem[];
  /** Invoice subtotal */
  subtotal: number | string;
  /** Total adjustments (credits/debits) */
  adjustments?: number | string;
  /** Tax amount */
  taxAmount?: number | string;
  /** Invoice total */
  total: number | string;
  /** Show delete action (for draft invoices) */
  editable?: boolean;
  /** Called when delete is clicked on a line item */
  onDelete?: (lineItemId: string) => void;
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

// Item type colors for visual distinction
const itemTypeStyles: Record<string, string> = {
  LEAD: 'text-gray-600',
  CALL: 'text-blue-600',
  ADJUSTMENT: 'text-yellow-600',
  CREDIT: 'text-green-600',
  FEE: 'text-orange-600',
  SCRUB_CREDIT: 'text-purple-600',
};

// ============================================
// MAIN COMPONENT
// ============================================

export const InvoiceLineItemTable = memo(function InvoiceLineItemTable({
  lineItems,
  subtotal,
  adjustments = 0,
  taxAmount = 0,
  total,
  editable = false,
  onDelete,
  loading = false,
}: InvoiceLineItemTableProps) {
  // Calculate derived values
  const numSubtotal = typeof subtotal === 'string' ? parseFloat(subtotal) : subtotal;
  const numAdjustments = typeof adjustments === 'string' ? parseFloat(adjustments) : adjustments;
  const numTaxAmount = typeof taxAmount === 'string' ? parseFloat(taxAmount) : taxAmount;
  const numTotal = typeof total === 'string' ? parseFloat(total) : total;

  // Group items by type for summary
  const itemSummary = useMemo(() => {
    return lineItems.reduce((acc, item) => {
      const type = item.itemType;
      if (!acc[type]) {
        acc[type] = { count: 0, total: 0 };
      }
      acc[type].count += item.quantity;
      acc[type].total += typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);
  }, [lineItems]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 animate-pulse">
          <div className="h-8 bg-gray-100 rounded mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 rounded" />
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
        <h3 className="text-sm font-semibold text-gray-900">Line Items</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {lineItems.length} item{lineItems.length !== 1 ? 's' : ''}
          {Object.keys(itemSummary).length > 1 && (
            <span className="ml-2">
              ({Object.entries(itemSummary).map(([type, { count }]) =>
                `${count} ${type.toLowerCase()}${count !== 1 ? 's' : ''}`
              ).join(', ')})
            </span>
          )}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">
                Qty
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                Unit Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                Amount
              </th>
              {editable && (
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">

                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={editable ? 5 : 4} className="px-4 py-8 text-center text-gray-500">
                  No line items
                </td>
              </tr>
            ) : (
              lineItems.map((item) => {
                const numAmount = typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount;
                const isNegative = numAmount < 0;

                return (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className={`text-sm font-medium ${itemTypeStyles[item.itemType] || 'text-gray-900'}`}>
                          {item.description}
                        </span>
                        {item.metadata && (
                          <span className="text-xs text-gray-500 mt-0.5">
                            {[
                              item.metadata.serviceType,
                              item.metadata.zipCode && `ZIP: ${item.metadata.zipCode}`,
                              item.metadata.date && formatDate(item.metadata.date),
                            ].filter(Boolean).join(' | ')}
                          </span>
                        )}
                        {item.leadId && (
                          <span className="text-xs text-gray-400 mt-0.5">
                            Lead ID: {item.leadId.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-medium ${isNegative ? 'text-green-600' : 'text-gray-900'}`}>
                      {formatCurrency(item.amount)}
                    </td>
                    {editable && (
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete?.(item.id)}
                          className="p-1.5 h-auto text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Totals Section */}
      <div className="px-4 py-4 border-t border-gray-100 bg-gray-50/30">
        <div className="flex flex-col items-end space-y-2">
          {/* Subtotal */}
          <div className="flex justify-between w-64">
            <span className="text-sm text-gray-600">Subtotal</span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(numSubtotal)}
            </span>
          </div>

          {/* Adjustments (if any) */}
          {numAdjustments !== 0 && (
            <div className="flex justify-between w-64">
              <span className="text-sm text-gray-600">
                {numAdjustments < 0 ? 'Credits' : 'Adjustments'}
              </span>
              <span className={`text-sm font-medium ${numAdjustments < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                {formatCurrency(numAdjustments)}
              </span>
            </div>
          )}

          {/* Tax (if any) */}
          {numTaxAmount !== 0 && (
            <div className="flex justify-between w-64">
              <span className="text-sm text-gray-600">Tax</span>
              <span className="text-sm font-medium text-gray-900">
                {formatCurrency(numTaxAmount)}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="w-64 border-t border-gray-200 pt-2">
            <div className="flex justify-between">
              <span className="text-sm font-semibold text-gray-900">Total</span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(numTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default InvoiceLineItemTable;
