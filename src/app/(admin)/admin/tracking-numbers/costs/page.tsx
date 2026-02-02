'use client';

/**
 * Twilio Cost Dashboard
 *
 * WHY: Shows aggregate Twilio costs with breakdown by affiliate.
 * WHEN: Admin navigates to /admin/tracking-numbers/costs.
 * HOW: Fetches summary data and displays cost breakdowns.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AdminPageHeader, AdminSection, AdminStatGrid } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import {
  RefreshCw,
  AlertCircle,
  Phone,
  DollarSign,
  AlertTriangle,
  TrendingDown,
  User,
  ArrowLeft,
  PieChart
} from 'lucide-react';

interface AffiliateCost {
  affiliateId: string;
  name: string;
  count: number;
  cost: number;
  calls: number;
}

interface Summary {
  totalNumbers: number;
  tollFreeCount: number;
  localCount: number;
  totalMonthlyCost: number;
  inactiveNumbers: number;
  inactiveMonthlyCost: number;
  potentialSavings: number;
  totalCalls: number;
  totalQualifiedCalls: number;
  affiliateCostBreakdown: AffiliateCost[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function TwilioCostDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/tracking-numbers?summary=true', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSummary(data.data.summary);
      } else {
        setError(data.error || 'Failed to load cost data');
      }
    } catch (err) {
      setError('Failed to load cost data');
      console.error('Error fetching cost data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Stats for grid
  const statItems = summary ? [
    {
      label: 'Total Monthly Cost',
      value: formatCurrency(summary.totalMonthlyCost),
      icon: DollarSign,
      accent: 'blue' as const
    },
    {
      label: 'Active Numbers',
      value: summary.totalNumbers.toString(),
      icon: Phone,
      accent: 'green' as const
    },
    {
      label: 'Unused Numbers',
      value: summary.inactiveNumbers.toString(),
      icon: AlertTriangle,
      accent: 'yellow' as const
    },
    {
      label: 'Potential Savings',
      value: formatCurrency(summary.potentialSavings),
      icon: TrendingDown,
      accent: 'red' as const
    }
  ] : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Twilio Cost Dashboard"
          description="Monitor phone number costs and identify savings"
        />
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Twilio Cost Dashboard"
          description="Monitor phone number costs and identify savings"
        />
        <AdminSection>
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
            <p className="text-gray-500 mb-4">{error}</p>
            <Button onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </AdminSection>
      </div>
    );
  }

  if (!summary) return null;

  // Calculate percentages for visual breakdown
  const tollFreePercentage = summary.totalNumbers > 0
    ? Math.round((summary.tollFreeCount / summary.totalNumbers) * 100)
    : 0;
  const inactivePercentage = summary.totalNumbers > 0
    ? Math.round((summary.inactiveNumbers / summary.totalNumbers) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Twilio Cost Dashboard"
        description="Monitor phone number costs and identify savings"
        actions={
          <div className="flex gap-2">
            <Link href="/admin/tracking-numbers">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                All Numbers
              </Button>
            </Link>
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Main Stats */}
      <AdminStatGrid stats={statItems} columns={4} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Number Type Breakdown */}
        <AdminSection>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-gray-400" />
            Number Type Breakdown
          </h3>

          <div className="space-y-4">
            {/* Toll-Free vs Local */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Toll-Free Numbers</span>
                <span className="font-medium">{summary.tollFreeCount} ({tollFreePercentage}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-purple-500 h-3 rounded-full"
                  style={{ width: `${tollFreePercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(summary.tollFreeCount * 2.15)}/mo @ $2.15 each
              </p>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Local Numbers</span>
                <span className="font-medium">{summary.localCount} ({100 - tollFreePercentage}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full"
                  style={{ width: `${100 - tollFreePercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(summary.localCount * 1.15)}/mo @ $1.15 each
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between">
                <span className="font-medium text-gray-900">Total Monthly</span>
                <span className="font-bold text-lg text-gray-900">
                  {formatCurrency(summary.totalMonthlyCost)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Annual projection: {formatCurrency(summary.totalMonthlyCost * 12)}
              </p>
            </div>
          </div>
        </AdminSection>

        {/* Savings Opportunity */}
        <AdminSection>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-400" />
            Savings Opportunity
          </h3>

          {summary.inactiveNumbers > 0 ? (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">
                      {summary.inactiveNumbers} Unused Numbers Detected
                    </h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      These numbers have received 0 calls in the last 30 days.
                      Releasing them would save {formatCurrency(summary.potentialSavings)}/month.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{inactivePercentage}%</p>
                  <p className="text-sm text-gray-500">of numbers unused</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(summary.potentialSavings * 12)}
                  </p>
                  <p className="text-sm text-gray-500">annual savings</p>
                </div>
              </div>

              <Link href="/admin/tracking-numbers?filter=inactive">
                <Button className="w-full" variant="outline">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  View Inactive Numbers
                </Button>
              </Link>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Phone className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="font-medium text-green-800">All Numbers Active</h4>
              <p className="text-sm text-green-700 mt-1">
                All tracking numbers have received calls in the last 30 days.
              </p>
            </div>
          )}
        </AdminSection>
      </div>

      {/* Cost by Affiliate */}
      <AdminSection>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-gray-400" />
          Cost by Affiliate
        </h3>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Affiliate</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Numbers</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monthly Cost</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Calls</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost/Call</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {summary.affiliateCostBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No affiliate data available
                  </td>
                </tr>
              ) : (
                summary.affiliateCostBreakdown.map((aff) => {
                  const costPerCall = aff.calls > 0 ? aff.cost / aff.calls : 0;
                  const percentOfTotal = summary.totalMonthlyCost > 0
                    ? (aff.cost / summary.totalMonthlyCost) * 100
                    : 0;

                  return (
                    <tr key={aff.affiliateId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {aff.affiliateId !== 'unassigned' ? (
                          <Link
                            href={`/admin/affiliates/${aff.affiliateId}`}
                            className="text-sm text-blue-600 hover:underline font-medium"
                          >
                            {aff.name}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">{aff.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {aff.count}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(aff.cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {aff.calls.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        <span className={costPerCall > 1 ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(costPerCall)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${Math.min(percentOfTotal, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-12">
                            {percentOfTotal.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900">Total</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {summary.totalNumbers}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  {formatCurrency(summary.totalMonthlyCost)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {summary.totalCalls.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {summary.totalCalls > 0
                    ? formatCurrency(summary.totalMonthlyCost / summary.totalCalls)
                    : '-'}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </AdminSection>

      {/* Call Performance */}
      <AdminSection>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Performance</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">
              {summary.totalCalls.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">Total Calls</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">
              {summary.totalQualifiedCalls.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">Qualified Calls</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">
              {summary.totalCalls > 0
                ? ((summary.totalQualifiedCalls / summary.totalCalls) * 100).toFixed(1)
                : 0}%
            </p>
            <p className="text-sm text-gray-500">Qualification Rate</p>
          </div>
        </div>
      </AdminSection>
    </div>
  );
}
