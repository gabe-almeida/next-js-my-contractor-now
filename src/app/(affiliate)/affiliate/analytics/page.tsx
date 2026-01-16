'use client';

/**
 * Affiliate Analytics Page
 *
 * WHY: Provides detailed performance analytics for affiliates with visual charts.
 *      Shows trends, campaign breakdowns, and conversion metrics over time.
 *
 * WHEN: Affiliate navigates to /affiliate/analytics from the sidebar.
 *
 * HOW: Fetches analytics data from API with date range filtering,
 *      displays summary stats, line/bar charts, and campaign breakdown table.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AnalyticsLineChart,
  AnalyticsBarChart,
  AnalyticsPieChart,
  StatCard,
  ChartCard,
  CHART_COLORS,
} from '@/components/analytics/AnalyticsCharts';
import {
  DateRangePicker,
  DateRange,
  getDateRangeFromPreset,
} from '@/components/analytics/DateRangePicker';
import { AdminSelect } from '@/components/admin/ui/AdminSearch';
import { Phone, DollarSign, Clock, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// =====================================
// TYPE DEFINITIONS
// =====================================

interface AnalyticsData {
  summary: {
    totalCalls: number;
    qualifiedCalls: number;
    totalEarnings: number;
    avgCallDuration: number;
    conversionRate: number;
  };
  dailyData: {
    date: string;
    calls: number;
    qualifiedCalls: number;
    earnings: number;
    avgDuration: number;
  }[];
  campaignBreakdown: {
    campaignId: string;
    campaignName: string;
    serviceType: string;
    calls: number;
    qualifiedCalls: number;
    earnings: number;
    conversionRate: number;
  }[];
}

interface Campaign {
  id: string;
  campaignId: string;
  campaign: {
    id: string;
    name: string;
  };
}

// =====================================
// UTILITY FUNCTIONS
// =====================================

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format duration in MM:SS
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// =====================================
// COMPONENT
// =====================================

export default function AffiliateAnalyticsPage() {
  // State
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset('30d'));
  const [selectedCampaign, setSelectedCampaign] = useState<string>('ALL');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch campaigns for filter dropdown
   */
  const fetchCampaigns = useCallback(async () => {
    const token = localStorage.getItem('affiliate_token');
    if (!token) return;

    try {
      const res = await fetch('/api/affiliates/campaigns', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        setCampaigns(data.data.campaigns || []);
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    }
  }, []);

  /**
   * Fetch analytics data
   */
  const fetchAnalytics = useCallback(async () => {
    const token = localStorage.getItem('affiliate_token');
    if (!token) {
      setError('Please log in to view analytics');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      });

      if (selectedCampaign !== 'ALL') {
        params.append('campaignId', selectedCampaign);
      }

      const res = await fetch(`/api/affiliates/analytics?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch analytics');
        return;
      }

      setAnalytics(data.data);
    } catch (err) {
      setError('Failed to load analytics. Please try again.');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedCampaign]);

  // Fetch campaigns on mount
  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Fetch analytics when date range or campaign changes
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handle date range change
  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
  };

  // Handle campaign filter change
  const handleCampaignChange = (value: string) => {
    setSelectedCampaign(value);
  };

  // Error state
  if (error && !loading) {
    return (
      <div className="bg-red-50 rounded-xl p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Analytics</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={fetchAnalytics}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // Build campaign filter options
  const campaignOptions = [
    { value: 'ALL', label: 'All Campaigns' },
    ...campaigns.map((c) => ({
      value: c.campaign.id,
      label: c.campaign.name,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Page Header with Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500">Track your call performance and earnings</p>
        </div>
        <div className="flex items-center gap-3">
          {campaigns.length > 0 && (
            <AdminSelect
              value={selectedCampaign}
              onChange={handleCampaignChange}
              options={campaignOptions}
            />
          )}
          <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Calls"
          value={loading ? '-' : formatNumber(analytics?.summary.totalCalls || 0)}
          icon={<Phone className="h-5 w-5" />}
          color="orange"
        />
        <StatCard
          title="Qualified Calls"
          value={loading ? '-' : formatNumber(analytics?.summary.qualifiedCalls || 0)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="emerald"
        />
        <StatCard
          title="Total Earnings"
          value={loading ? '-' : formatCurrency(analytics?.summary.totalEarnings || 0)}
          icon={<DollarSign className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Avg Duration"
          value={loading ? '-' : formatDuration(analytics?.summary.avgCallDuration || 0)}
          icon={<Clock className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          title="Conversion Rate"
          value={
            loading ? '-' : `${(analytics?.summary.conversionRate || 0).toFixed(1)}%`
          }
          icon={<TrendingUp className="h-5 w-5" />}
          color="orange"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calls Over Time Chart */}
        <ChartCard title="Calls Over Time" subtitle="Daily call volume and qualified calls">
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : analytics?.dailyData && analytics.dailyData.length > 0 ? (
            <AnalyticsLineChart
              data={analytics.dailyData}
              lines={[
                { dataKey: 'calls', name: 'Total Calls', color: CHART_COLORS.primary },
                {
                  dataKey: 'qualifiedCalls',
                  name: 'Qualified',
                  color: CHART_COLORS.secondary,
                },
              ]}
              height={300}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No call data for selected period
            </div>
          )}
        </ChartCard>

        {/* Earnings Over Time Chart */}
        <ChartCard title="Earnings Over Time" subtitle="Daily earnings from qualified calls">
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : analytics?.dailyData && analytics.dailyData.length > 0 ? (
            <AnalyticsBarChart
              data={analytics.dailyData}
              bars={[
                { dataKey: 'earnings', name: 'Earnings', color: CHART_COLORS.secondary },
              ]}
              height={300}
              formatTooltip={(value) => formatCurrency(value)}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No earnings data for selected period
            </div>
          )}
        </ChartCard>
      </div>

      {/* Campaign Breakdown */}
      {analytics?.campaignBreakdown && analytics.campaignBreakdown.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Pie Chart */}
          <ChartCard title="Earnings by Campaign" subtitle="Distribution of earnings">
            <AnalyticsPieChart
              data={analytics.campaignBreakdown.map((c) => ({
                name: c.campaignName,
                value: c.earnings,
              }))}
              height={250}
              innerRadius={50}
              outerRadius={80}
              formatTooltip={(value) => formatCurrency(value)}
            />
          </ChartCard>

          {/* Campaign Table */}
          <div className="lg:col-span-2">
            <ChartCard title="Campaign Performance" subtitle="Detailed breakdown by campaign">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="pb-3">Campaign</th>
                      <th className="pb-3 text-right">Calls</th>
                      <th className="pb-3 text-right">Qualified</th>
                      <th className="pb-3 text-right">Conv. Rate</th>
                      <th className="pb-3 text-right">Earnings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {analytics.campaignBreakdown.map((campaign) => (
                      <tr key={campaign.campaignId} className="hover:bg-gray-50">
                        <td className="py-3">
                          <div>
                            <span className="font-medium text-gray-900">
                              {campaign.campaignName}
                            </span>
                            <span className="block text-xs text-gray-500">
                              {campaign.serviceType}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right text-gray-600">
                          {formatNumber(campaign.calls)}
                        </td>
                        <td className="py-3 text-right text-gray-600">
                          {formatNumber(campaign.qualifiedCalls)}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`font-medium ${
                              campaign.conversionRate >= 50
                                ? 'text-emerald-600'
                                : campaign.conversionRate >= 25
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}
                          >
                            {campaign.conversionRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 text-right font-medium text-emerald-600">
                          {formatCurrency(campaign.earnings)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals Row */}
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="py-3 font-semibold text-gray-900">Total</td>
                      <td className="py-3 text-right font-semibold text-gray-900">
                        {formatNumber(
                          analytics.campaignBreakdown.reduce((sum, c) => sum + c.calls, 0)
                        )}
                      </td>
                      <td className="py-3 text-right font-semibold text-gray-900">
                        {formatNumber(
                          analytics.campaignBreakdown.reduce(
                            (sum, c) => sum + c.qualifiedCalls,
                            0
                          )
                        )}
                      </td>
                      <td className="py-3 text-right font-semibold text-gray-900">
                        {(analytics.summary.conversionRate || 0).toFixed(1)}%
                      </td>
                      <td className="py-3 text-right font-semibold text-emerald-600">
                        {formatCurrency(analytics.summary.totalEarnings || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </ChartCard>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && analytics?.campaignBreakdown?.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-8 text-center">
          <Phone className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Call Data Yet</h3>
          <p className="text-gray-500 mb-4">
            Start driving calls to your campaigns to see analytics here.
          </p>
          <Button
            onClick={() => (window.location.href = '/affiliate/campaigns')}
            className="bg-orange-500 hover:bg-orange-600"
          >
            View Campaigns
          </Button>
        </div>
      )}
    </div>
  );
}
