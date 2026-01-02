'use client';

/**
 * Buyer Activity Tab Component
 *
 * WHY: Display buyer's transaction history, win rate, and performance metrics
 * WHEN: Rendered in buyer detail page Activity tab
 * HOW: Fetch from activity API, display with reusable chart components
 */

import { useState, useEffect, useCallback } from 'react';
import { MetricCard } from '@/components/charts/MetricCard';
import { LineChart } from '@/components/charts/LineChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  TrendingUp,
  Clock,
  DollarSign,
  Target,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';

interface BuyerActivityTabProps {
  buyerId: string;
  buyerName: string;
}

type TimeframeOption = '24h' | '7d' | '30d' | '90d';

interface ActivitySummary {
  totalPings: number;
  totalPosts: number;
  leadsWon: number;
  leadsLost: number;
  winRate: number;
  avgBidAmount: number | null;
  avgResponseTime: number | null;
  totalRevenue: number;
}

interface TransactionItem {
  id: string;
  leadId: string;
  actionType: 'PING' | 'POST';
  status: string;
  bidAmount: number | null;
  responseTime: number | null;
  won: boolean;
  createdAt: string;
}

interface ActivityData {
  buyerId: string;
  buyerName: string;
  timeframe: TimeframeOption;
  summary: ActivitySummary;
  trends: {
    responseTime: Array<{ date: string; value: number }>;
  };
  recentTransactions: TransactionItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export function BuyerActivityTab({ buyerId, buyerName }: BuyerActivityTabProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>('7d');
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchActivity = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const currentPage = reset ? 1 : page;
      const response = await fetch(
        `/api/admin/buyers/${buyerId}/activity?timeframe=${timeframe}&page=${currentPage}&limit=20`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch activity data');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch activity data');
      }

      if (reset || page === 1) {
        setData(result.data);
      } else {
        // Append transactions for pagination
        setData(prev => prev ? {
          ...result.data,
          recentTransactions: [...prev.recentTransactions, ...result.data.recentTransactions]
        } : result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buyerId, timeframe, page]);

  useEffect(() => {
    fetchActivity(true);
  }, [buyerId, timeframe]);

  const handleLoadMore = () => {
    if (data?.pagination.hasMore && !loadingMore) {
      setPage(prev => prev + 1);
    }
  };

  useEffect(() => {
    if (page > 1) {
      fetchActivity(false);
    }
  }, [page]);

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatResponseTime = (ms: number | null) => {
    if (ms === null) return '-';
    return `${ms}ms`;
  };

  const timeframeButtons: { value: TimeframeOption; label: string }[] = [
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
    { value: '90d', label: '90d' }
  ];

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => fetchActivity(true)}
            className="mt-2 text-red-600 hover:text-red-800 flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Timeframe Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Activity for {buyerName}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Timeframe:</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {timeframeButtons.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTimeframe(value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  timeframe === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchActivity(true)}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Win Rate"
          value={`${data?.summary.winRate ?? 0}%`}
          description={`${data?.summary.leadsWon ?? 0} won / ${(data?.summary.leadsWon ?? 0) + (data?.summary.leadsLost ?? 0)} participated`}
          icon={<Target className="h-4 w-4" />}
          loading={loading}
        />
        <MetricCard
          title="Avg Bid"
          value={formatCurrency(data?.summary.avgBidAmount ?? null)}
          description="Per lead bid amount"
          icon={<DollarSign className="h-4 w-4" />}
          loading={loading}
        />
        <MetricCard
          title="Avg Response"
          value={formatResponseTime(data?.summary.avgResponseTime ?? null)}
          description="PING response time"
          icon={<Clock className="h-4 w-4" />}
          loading={loading}
        />
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(data?.summary.totalRevenue ?? 0)}
          description={`From ${data?.summary.leadsWon ?? 0} leads`}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      {/* Response Time Trend Chart */}
      {data?.trends.responseTime && data.trends.responseTime.length > 0 && (
        <LineChart
          title="Response Time Trend"
          data={data.trends.responseTime}
          xAxisKey="date"
          lines={[
            { dataKey: 'value', stroke: '#3b82f6', name: 'Response Time (ms)' }
          ]}
          height={250}
          loading={loading}
        />
      )}

      {/* Activity Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Total PINGs</div>
            <div className="text-2xl font-bold text-gray-900">
              {loading ? '-' : data?.summary.totalPings.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Total POSTs</div>
            <div className="text-2xl font-bold text-gray-900">
              {loading ? '-' : data?.summary.totalPosts.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Leads Won</div>
            <div className="text-2xl font-bold text-green-600">
              {loading ? '-' : data?.summary.leadsWon.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500">Leads Lost</div>
            <div className="text-2xl font-bold text-red-600">
              {loading ? '-' : data?.summary.leadsLost.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : data?.recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No transactions found for this timeframe
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Type</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Lead ID</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Status</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Bid</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Response</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Won?</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recentTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            tx.actionType === 'PING'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {tx.actionType}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <a
                            href={`/admin/leads/${tx.leadId}`}
                            className="text-blue-600 hover:text-blue-800 text-sm font-mono"
                          >
                            {tx.leadId.slice(0, 8)}...
                          </a>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            tx.status === 'SUCCESS'
                              ? 'bg-green-100 text-green-800'
                              : tx.status === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-900">
                          {tx.bidAmount ? formatCurrency(tx.bidAmount) : '-'}
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-600">
                          {tx.responseTime ? `${tx.responseTime}ms` : '-'}
                        </td>
                        <td className="py-3 px-2">
                          {tx.actionType === 'PING' ? (
                            tx.won ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-400" />
                            )
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-500">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Load More Button */}
              {data?.pagination.hasMore && (
                <div className="mt-4 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                  >
                    {loadingMore ? 'Loading...' : `Load More (${data.pagination.total - data.recentTransactions.length} remaining)`}
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
