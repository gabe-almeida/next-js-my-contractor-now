'use client';

/**
 * Admin Call Analytics Page
 *
 * WHY: Provides detailed call performance analytics for admin oversight.
 *      Shows affiliate rankings, buyer performance, and platform-wide metrics.
 *
 * WHEN: Admin navigates to /admin/analytics/calls from the sidebar.
 *
 * HOW: Fetches call analytics data from API, displays summary stats,
 *      time-series charts, and performance ranking tables.
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
import { AdminPageHeader } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import {
  Phone,
  DollarSign,
  Clock,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Download,
  Users,
  Building2,
} from 'lucide-react';

// =====================================
// TYPE DEFINITIONS
// =====================================

interface AdminCallAnalytics {
  summary: {
    totalCalls: number;
    qualifiedCalls: number;
    totalRevenue: number;
    totalPayouts: number;
    platformMargin: number;
    avgAuctionTime: number;
  };
  dailyData: {
    date: string;
    calls: number;
    qualifiedCalls: number;
    earnings: number;
    avgDuration: number;
  }[];
  topAffiliates: {
    affiliateId: string;
    name: string;
    email: string;
    calls: number;
    qualifiedCalls: number;
    earnings: number;
    conversionRate: number;
  }[];
  topBuyers: {
    buyerId: string;
    name: string;
    calls: number;
    acceptedCalls: number;
    totalSpend: number;
    avgBidAmount: number;
  }[];
  serviceBreakdown: {
    serviceTypeId: string;
    serviceName: string;
    calls: number;
    qualifiedCalls: number;
    revenue: number;
    avgBid: number;
  }[];
}

// =====================================
// UTILITY FUNCTIONS
// =====================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// =====================================
// COMPONENT
// =====================================

export default function AdminCallAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset('30d'));
  const [analytics, setAnalytics] = useState<AdminCallAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      });

      // Get admin token from localStorage
      const adminToken = localStorage.getItem('admin_token');

      const res = await fetch(`/api/admin/analytics/calls?${params}`, {
        headers: {
          Authorization: `Bearer ${adminToken || ''}`,
        },
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch analytics');
        return;
      }

      setAnalytics(data.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to load analytics. Please try again.');
      console.error('Error fetching call analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExport = () => {
    if (!analytics) return;

    const exportData = {
      exportDate: new Date().toISOString(),
      dateRange: {
        start: dateRange.startDate.toISOString(),
        end: dateRange.endDate.toISOString(),
      },
      ...analytics,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate derived metrics
  const conversionRate = analytics?.summary.totalCalls
    ? ((analytics.summary.qualifiedCalls / analytics.summary.totalCalls) * 100).toFixed(1)
    : '0';

  const marginRate = analytics?.summary.totalRevenue
    ? ((analytics.summary.platformMargin / analytics.summary.totalRevenue) * 100).toFixed(1)
    : '0';

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Call Analytics"
          description="Pay-per-call performance metrics and insights"
        />
        <div className="bg-red-50 rounded-xl p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Analytics</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        title="Call Analytics"
        description="Pay-per-call performance metrics and insights"
        lastUpdated={lastUpdated}
        actions={
          <div className="flex items-center gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <Button
              variant="outline"
              onClick={fetchAnalytics}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
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
          title="Conversion Rate"
          value={loading ? '-' : `${conversionRate}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Total Revenue"
          value={loading ? '-' : formatCurrency(analytics?.summary.totalRevenue || 0)}
          icon={<DollarSign className="h-5 w-5" />}
          color="emerald"
        />
        <StatCard
          title="Platform Margin"
          value={loading ? '-' : formatCurrency(analytics?.summary.platformMargin || 0)}
          icon={<DollarSign className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          title="Avg Auction Time"
          value={loading ? '-' : formatDuration(analytics?.summary.avgAuctionTime || 0)}
          icon={<Clock className="h-5 w-5" />}
          color="gray"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calls Over Time */}
        <ChartCard title="Call Volume Over Time" subtitle="Daily total and qualified calls">
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : analytics?.dailyData && analytics.dailyData.length > 0 ? (
            <AnalyticsLineChart
              data={analytics.dailyData}
              lines={[
                { dataKey: 'calls', name: 'Total Calls', color: CHART_COLORS.primary },
                { dataKey: 'qualifiedCalls', name: 'Qualified', color: CHART_COLORS.secondary },
              ]}
              height={300}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No call data for selected period
            </div>
          )}
        </ChartCard>

        {/* Revenue Over Time */}
        <ChartCard title="Revenue Over Time" subtitle="Daily buyer charges">
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : analytics?.dailyData && analytics.dailyData.length > 0 ? (
            <AnalyticsBarChart
              data={analytics.dailyData}
              bars={[{ dataKey: 'earnings', name: 'Revenue', color: CHART_COLORS.secondary }]}
              height={300}
              formatTooltip={(value) => formatCurrency(value)}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No revenue data for selected period
            </div>
          )}
        </ChartCard>
      </div>

      {/* Service Breakdown */}
      {analytics?.serviceBreakdown && analytics.serviceBreakdown.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard title="Revenue by Service" subtitle="Distribution of call revenue">
            <AnalyticsPieChart
              data={analytics.serviceBreakdown.map((s) => ({
                name: s.serviceName,
                value: s.revenue,
              }))}
              height={250}
              innerRadius={50}
              outerRadius={80}
              formatTooltip={(value) => formatCurrency(value)}
            />
          </ChartCard>

          <div className="lg:col-span-2">
            <ChartCard title="Service Performance" subtitle="Breakdown by service type">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="pb-3">Service</th>
                      <th className="pb-3 text-right">Calls</th>
                      <th className="pb-3 text-right">Qualified</th>
                      <th className="pb-3 text-right">Avg Bid</th>
                      <th className="pb-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {analytics.serviceBreakdown.map((service) => (
                      <tr key={service.serviceTypeId} className="hover:bg-gray-50">
                        <td className="py-3 font-medium text-gray-900">{service.serviceName}</td>
                        <td className="py-3 text-right text-gray-600">
                          {formatNumber(service.calls)}
                        </td>
                        <td className="py-3 text-right text-gray-600">
                          {formatNumber(service.qualifiedCalls)}
                        </td>
                        <td className="py-3 text-right text-gray-600">
                          {formatCurrency(service.avgBid)}
                        </td>
                        <td className="py-3 text-right font-medium text-emerald-600">
                          {formatCurrency(service.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </div>
        </div>
      )}

      {/* Performance Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Affiliates */}
        <ChartCard
          title="Top Affiliates"
          subtitle="By earnings"
          actions={
            <span className="text-xs text-gray-500">
              <Users className="h-4 w-4 inline mr-1" />
              {analytics?.topAffiliates?.length || 0} affiliates
            </span>
          }
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : analytics?.topAffiliates && analytics.topAffiliates.length > 0 ? (
            <div className="space-y-3">
              {analytics.topAffiliates.map((affiliate, index) => (
                <div
                  key={affiliate.affiliateId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0
                          ? 'bg-yellow-100 text-yellow-700'
                          : index === 1
                          ? 'bg-gray-200 text-gray-700'
                          : index === 2
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">{affiliate.name}</div>
                      <div className="text-xs text-gray-500">
                        {affiliate.calls} calls - {affiliate.conversionRate.toFixed(1)}% conv.
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-emerald-600">
                      {formatCurrency(affiliate.earnings)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {affiliate.qualifiedCalls} qualified
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No affiliate data available</div>
          )}
        </ChartCard>

        {/* Top Buyers */}
        <ChartCard
          title="Top Buyers"
          subtitle="By spend"
          actions={
            <span className="text-xs text-gray-500">
              <Building2 className="h-4 w-4 inline mr-1" />
              {analytics?.topBuyers?.length || 0} buyers
            </span>
          }
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : analytics?.topBuyers && analytics.topBuyers.length > 0 ? (
            <div className="space-y-3">
              {analytics.topBuyers.map((buyer, index) => (
                <div
                  key={buyer.buyerId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0
                          ? 'bg-yellow-100 text-yellow-700'
                          : index === 1
                          ? 'bg-gray-200 text-gray-700'
                          : index === 2
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">{buyer.name}</div>
                      <div className="text-xs text-gray-500">
                        {buyer.acceptedCalls} calls - {formatCurrency(buyer.avgBidAmount)} avg
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-blue-600">
                      {formatCurrency(buyer.totalSpend)}
                    </div>
                    <div className="text-xs text-gray-500">total spend</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No buyer data available</div>
          )}
        </ChartCard>
      </div>

      {/* Financial Summary */}
      <ChartCard title="Financial Summary">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-emerald-50 rounded-lg">
            <div className="text-2xl font-bold text-emerald-600">
              {loading ? '-' : formatCurrency(analytics?.summary.totalRevenue || 0)}
            </div>
            <div className="text-sm text-gray-600">Total Revenue</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {loading ? '-' : formatCurrency(analytics?.summary.totalPayouts || 0)}
            </div>
            <div className="text-sm text-gray-600">Affiliate Payouts</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {loading ? '-' : formatCurrency(analytics?.summary.platformMargin || 0)}
            </div>
            <div className="text-sm text-gray-600">Platform Margin</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {loading ? '-' : `${marginRate}%`}
            </div>
            <div className="text-sm text-gray-600">Margin Rate</div>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
