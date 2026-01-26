'use client';

/**
 * AgingReportCard - Card showing aging buckets for receivables
 *
 * WHY: Provides a quick visual summary of outstanding invoices by age.
 * WHEN: Used on the invoices dashboard and finance overview pages.
 * HOW: Displays 4 aging buckets (0-30, 31-60, 61-90, 90+) with amounts and counts,
 *      color-coded from green to red for urgency.
 *
 * Features:
 * - 4 aging buckets with amount and count
 * - Color coding (green -> yellow -> orange -> red)
 * - Visual progress bars
 * - Total outstanding summary
 */

import { memo, useMemo } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays?: number;
  amount: number;
  count: number;
}

export interface AgingData {
  current: { amount: number; count: number };      // 0-30 days
  days31to60: { amount: number; count: number };   // 31-60 days
  days61to90: { amount: number; count: number };   // 61-90 days
  over90: { amount: number; count: number };       // 90+ days
  totalOutstanding: number;
  totalCount: number;
}

interface AgingReportCardProps {
  /** Aging data with bucket breakdowns */
  data: AgingData;
  /** Optional title override */
  title?: string;
  /** Loading state */
  loading?: boolean;
  /** Show compact version */
  compact?: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Bucket configuration with colors
const bucketConfig = [
  {
    key: 'current',
    label: 'Current (0-30)',
    shortLabel: '0-30',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    barColor: 'bg-emerald-500',
    borderColor: 'border-emerald-200',
  },
  {
    key: 'days31to60',
    label: '31-60 Days',
    shortLabel: '31-60',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    barColor: 'bg-yellow-500',
    borderColor: 'border-yellow-200',
  },
  {
    key: 'days61to90',
    label: '61-90 Days',
    shortLabel: '61-90',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    barColor: 'bg-orange-500',
    borderColor: 'border-orange-200',
  },
  {
    key: 'over90',
    label: '90+ Days',
    shortLabel: '90+',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    barColor: 'bg-red-500',
    borderColor: 'border-red-200',
  },
] as const;

// ============================================
// MAIN COMPONENT
// ============================================

export const AgingReportCard = memo(function AgingReportCard({
  data,
  title = 'Aging Report',
  loading = false,
  compact = false,
}: AgingReportCardProps) {
  // Calculate max amount for progress bar scaling
  const maxBucketAmount = useMemo(() => {
    return Math.max(
      data.current.amount,
      data.days31to60.amount,
      data.days61to90.amount,
      data.over90.amount,
      1 // Prevent division by zero
    );
  }, [data]);

  // Calculate overdue total (31+ days)
  const overdueTotal = data.days31to60.amount + data.days61to90.amount + data.over90.amount;
  const overdueCount = data.days31to60.count + data.days61to90.count + data.over90.count;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 animate-pulse">
          <div className="h-6 bg-gray-100 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          </div>
          {overdueTotal > 0 && (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{formatCurrency(overdueTotal)} overdue</span>
            </div>
          )}
        </div>
      </div>

      {/* Buckets */}
      <div className={compact ? 'p-4' : 'p-5'}>
        {/* Summary */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Total Outstanding</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(data.totalOutstanding)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Invoices</p>
            <p className="text-xl font-bold text-gray-900">{data.totalCount}</p>
          </div>
        </div>

        {/* Bucket Breakdown */}
        <div className="space-y-3">
          {bucketConfig.map((bucket) => {
            const bucketData = data[bucket.key];
            const percentage = maxBucketAmount > 0 ? (bucketData.amount / maxBucketAmount) * 100 : 0;

            return (
              <div key={bucket.key} className={`p-3 rounded-lg border ${bucket.bgColor} ${bucket.borderColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${bucket.textColor}`}>
                      {compact ? bucket.shortLabel : bucket.label}
                    </span>
                    {bucketData.count > 0 && (
                      <span className="text-xs text-gray-500">
                        ({bucketData.count} invoice{bucketData.count !== 1 ? 's' : ''})
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-semibold ${bucket.textColor}`}>
                    {formatCurrency(bucketData.amount)}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${bucket.barColor} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Overdue Warning */}
        {overdueCount > 0 && !compact && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  {overdueCount} invoice{overdueCount !== 1 ? 's' : ''} overdue
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  {formatCurrency(overdueTotal)} past due date. Follow up recommended.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default AgingReportCard;
