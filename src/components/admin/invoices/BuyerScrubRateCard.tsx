'use client';

/**
 * BuyerScrubRateCard - Card showing expected vs actual scrub rate with alert
 *
 * WHY: Helps admins monitor if a buyer's actual scrub rate exceeds their expected rate,
 *      which may indicate issues with lead quality or buyer behavior.
 * WHEN: Used on buyer detail pages and finance dashboard.
 * HOW: Displays a visual comparison of expected vs actual scrub rates with
 *      an alert if the actual rate exceeds expectations.
 *
 * Features:
 * - Expected vs Actual rate comparison
 * - Visual bar comparison
 * - Alert if actual > expected
 * - Trend indicator
 */

import { memo, useMemo } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface ScrubRateData {
  /** Buyer's expected scrub rate (0-1, e.g., 0.10 = 10%) */
  expectedRate: number;
  /** Actual scrub rate for the period */
  actualRate: number;
  /** Total leads in the period */
  totalLeads: number;
  /** Number of scrubbed leads */
  scrubbedLeads: number;
  /** Period description (e.g., "January 2024") */
  period?: string;
  /** Previous period's rate for trend comparison */
  previousRate?: number;
}

interface BuyerScrubRateCardProps {
  /** Scrub rate data */
  data: ScrubRateData;
  /** Buyer name for display */
  buyerName: string;
  /** Loading state */
  loading?: boolean;
  /** Compact mode */
  compact?: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function getRateStatus(actual: number, expected: number): 'good' | 'warning' | 'critical' {
  if (expected === 0) {
    return actual === 0 ? 'good' : 'critical';
  }

  const ratio = actual / expected;
  if (ratio <= 1) return 'good';
  if (ratio <= 1.5) return 'warning';
  return 'critical';
}

function getTrendDirection(current: number, previous: number | undefined): 'up' | 'down' | 'flat' {
  if (previous === undefined) return 'flat';
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

// ============================================
// MAIN COMPONENT
// ============================================

export const BuyerScrubRateCard = memo(function BuyerScrubRateCard({
  data,
  buyerName,
  loading = false,
  compact = false,
}: BuyerScrubRateCardProps) {
  // Calculate status and styling
  const status = useMemo(() => getRateStatus(data.actualRate, data.expectedRate), [data]);
  const trend = useMemo(() => getTrendDirection(data.actualRate, data.previousRate), [data]);

  // Calculate difference
  const difference = data.actualRate - data.expectedRate;
  const exceedsExpected = difference > 0;

  // Status colors
  const statusConfig = {
    good: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      barColor: 'bg-green-500',
      label: 'Within Expected Range',
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-700',
      barColor: 'bg-yellow-500',
      label: 'Above Expected',
    },
    critical: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
      barColor: 'bg-red-500',
      label: 'Significantly Above Expected',
    },
  };

  const config = statusConfig[status];

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 animate-pulse">
          <div className="h-6 bg-gray-100 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            <div className="h-8 bg-gray-50 rounded" />
            <div className="h-4 bg-gray-50 rounded w-2/3" />
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
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Scrub Rate Analysis</h3>
            {data.period && (
              <p className="text-xs text-gray-500 mt-0.5">{data.period}</p>
            )}
          </div>
          <div className={`flex items-center gap-1 text-xs font-medium ${config.textColor}`}>
            {status === 'good' && <Info className="h-3.5 w-3.5" />}
            {(status === 'warning' || status === 'critical') && <AlertTriangle className="h-3.5 w-3.5" />}
            <span>{config.label}</span>
          </div>
        </div>
      </div>

      <div className={compact ? 'p-4' : 'p-5'}>
        {/* Rate Comparison */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Expected Rate */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Expected Rate</p>
            <p className="text-2xl font-bold text-gray-400">
              {formatPercent(data.expectedRate)}
            </p>
          </div>

          {/* Actual Rate */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Actual Rate</p>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${exceedsExpected ? config.textColor : 'text-green-700'}`}>
                {formatPercent(data.actualRate)}
              </p>
              {/* Trend indicator */}
              {data.previousRate !== undefined && (
                <div className={`flex items-center ${
                  trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-green-500' : 'text-gray-400'
                }`}>
                  {trend === 'up' && <TrendingUp className="h-4 w-4" />}
                  {trend === 'down' && <TrendingDown className="h-4 w-4" />}
                  {trend === 'flat' && <Minus className="h-4 w-4" />}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Visual Bar Comparison */}
        <div className="space-y-3">
          {/* Expected bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Expected</span>
              <span>{formatPercent(data.expectedRate)}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-400 rounded-full"
                style={{ width: `${Math.min(data.expectedRate * 100 * 5, 100)}%` }}
              />
            </div>
          </div>

          {/* Actual bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Actual</span>
              <span>{formatPercent(data.actualRate)}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${config.barColor} rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(data.actualRate * 100 * 5, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Total Leads</p>
            <p className="text-sm font-semibold text-gray-900">{data.totalLeads.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Scrubbed Leads</p>
            <p className="text-sm font-semibold text-gray-900">{data.scrubbedLeads.toLocaleString()}</p>
          </div>
        </div>

        {/* Alert if exceeds expected */}
        {exceedsExpected && !compact && (
          <div className={`mt-4 p-3 rounded-lg border ${config.bgColor} ${config.borderColor}`}>
            <div className="flex items-start gap-2">
              <AlertTriangle className={`h-4 w-4 ${config.textColor} mt-0.5 flex-shrink-0`} />
              <div>
                <p className={`text-sm font-medium ${config.textColor}`}>
                  Scrub rate {formatPercent(difference)} above expected
                </p>
                <p className={`text-xs ${config.textColor} opacity-80 mt-0.5`}>
                  {status === 'warning'
                    ? 'Monitor this buyer for quality issues.'
                    : 'Consider reviewing lead quality with this buyer.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Good status message */}
        {!exceedsExpected && !compact && (
          <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-700">
                Scrub rate is within or below expectations for {buyerName}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default BuyerScrubRateCard;
