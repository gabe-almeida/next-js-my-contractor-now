'use client';

/**
 * Buyer Partner Offers Tab Component
 *
 * WHY: Display exit offer configuration, stats, and conversions for partner offers (e.g., ADT)
 * WHEN: Rendered in buyer detail page Partner Offers tab for NETWORK buyers like PX
 * HOW: Fetch stats/conversions from API, display with admin UI components
 */

import { useState, useEffect, useCallback } from 'react';
import { AdminSection, AdminStatGrid, StatusBadge } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import {
  MousePointerClick,
  TrendingUp,
  DollarSign,
  Percent,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Calendar
} from 'lucide-react';

interface BuyerPartnerOffersTabProps {
  buyerId: string;
  buyerName: string;
}

type TimeframeOption = '7d' | '30d' | '90d' | 'all';

interface ExitOfferStats {
  offerType: string;
  offerProvider: string;
  timeframe: TimeframeOption;
  clicks: number;
  conversions: number;
  conversionRate: number;
  totalRevenue: number;
  avgPayout: number | null;
  leadNotFoundCount: number;
  byTrafficSource: Array<{
    source: string;
    clicks: number;
    conversions: number;
    revenue: number;
  }>;
}

interface ConversionItem {
  id: string;
  receivedAt: string;
  convertedAt: string | null;
  transactionId: string;
  payout: number;
  status: string;
  affSub: string | null;
  affSub2: string | null;
  leadNotFound: boolean;
  lead: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    affiliateRef: string | null;
  } | null;
}

interface ConversionsData {
  conversions: ConversionItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    totalPages: number;
  };
}

// ADT Configuration constants
const ADT_CONFIG = {
  campaignId: 473,
  accountId: 15882,
  hostNameId: 23325,
  offerType: 'adt_home_security',
  offerProvider: 'px'
};

export function BuyerPartnerOffersTab({ buyerId, buyerName }: BuyerPartnerOffersTabProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>('30d');
  const [stats, setStats] = useState<ExitOfferStats | null>(null);
  const [conversions, setConversions] = useState<ConversionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingConversions, setLoadingConversions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);

  const postbackUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/postback/adt?token=YOUR_SECRET&aff_sub={aff_sub}&aff_sub2={aff_sub2}&transaction_id={transaction_id}&payout={payout}`;

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/admin/exit-offers/stats?offerType=${ADT_CONFIG.offerType}&timeframe=${timeframe}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch stats');
      }

      setStats(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  const fetchConversions = useCallback(async (pageNum: number) => {
    try {
      setLoadingConversions(true);

      const response = await fetch(
        `/api/admin/exit-offers/conversions?offerType=${ADT_CONFIG.offerType}&timeframe=${timeframe}&page=${pageNum}&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch conversions');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch conversions');
      }

      setConversions(result.data);
    } catch (err) {
      console.error('Conversions fetch error:', err);
    } finally {
      setLoadingConversions(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchConversions(page);
  }, [fetchConversions, page]);

  useEffect(() => {
    setPage(1);
  }, [timeframe]);

  const handleCopyPostbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(postbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const timeframeButtons: { value: TimeframeOption; label: string }[] = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: 'all', label: 'All Time' }
  ];

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => { fetchStats(); fetchConversions(page); }}
            className="mt-2 text-red-600 hover:text-red-800 flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Stats for AdminStatGrid
  const statItems = [
    {
      label: 'Clicks',
      value: loading ? '-' : stats?.clicks.toLocaleString() || '0',
      icon: MousePointerClick,
      accent: 'blue' as const
    },
    {
      label: 'Conversions',
      value: loading ? '-' : stats?.conversions.toLocaleString() || '0',
      icon: TrendingUp,
      accent: 'green' as const
    },
    {
      label: 'Conversion Rate',
      value: loading ? '-' : `${stats?.conversionRate || 0}%`,
      icon: Percent,
      accent: 'purple' as const
    },
    {
      label: 'Revenue',
      value: loading ? '-' : formatCurrency(stats?.totalRevenue || 0),
      icon: DollarSign,
      accent: 'orange' as const
    }
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Timeframe Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Partner Offers for {buyerName}
        </h3>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {timeframeButtons.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTimeframe(value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  timeframe === value
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { fetchStats(); fetchConversions(page); }}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Configuration Card */}
      <AdminSection title="ADT Home Security Offer">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status="ACTIVE" />
                <span className="text-sm text-gray-500">via PX Network</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Campaign ID:</span>
              <span className="ml-2 font-mono font-medium">{ADT_CONFIG.campaignId}</span>
            </div>
            <div>
              <span className="text-gray-500">Account ID:</span>
              <span className="ml-2 font-mono font-medium">{ADT_CONFIG.accountId}</span>
            </div>
            <div>
              <span className="text-gray-500">Host Name ID:</span>
              <span className="ml-2 font-mono font-medium">{ADT_CONFIG.hostNameId}</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Postback URL (share with PX):
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-mono text-xs text-gray-700 overflow-x-auto">
                {postbackUrl}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyPostbackUrl}
                className="gap-1 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </AdminSection>

      {/* Stats Summary */}
      <AdminStatGrid stats={statItems} loading={loading} />

      {/* Lead Not Found Warning */}
      {stats && stats.leadNotFoundCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {stats.leadNotFoundCount} conversion{stats.leadNotFoundCount !== 1 ? 's' : ''} with unmatched leads
            </p>
            <p className="text-xs text-amber-700 mt-1">
              These conversions have lead IDs that could not be matched to our database.
              This may indicate test postbacks or data issues.
            </p>
          </div>
        </div>
      )}

      {/* Revenue by Traffic Source */}
      {stats && stats.byTrafficSource.length > 0 && (
        <AdminSection title="Revenue by Traffic Source">
          <div className="space-y-3">
            {stats.byTrafficSource.map((source) => {
              const maxRevenue = Math.max(...stats.byTrafficSource.map(s => s.revenue));
              const percentage = maxRevenue > 0 ? (source.revenue / maxRevenue) * 100 : 0;

              return (
                <div key={source.source} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-gray-700 truncate" title={source.source}>
                    {source.source}
                  </div>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-24 text-right text-sm font-semibold text-gray-900">
                    {formatCurrency(source.revenue)}
                  </div>
                  <div className="w-16 text-right text-xs text-gray-500">
                    {source.conversions} conv
                  </div>
                </div>
              );
            })}
          </div>
        </AdminSection>
      )}

      {/* Recent Conversions Table */}
      <AdminSection
        title="Recent Conversions"
        actions={
          conversions && conversions.pagination.total > 0 && (
            <span className="text-sm text-gray-500">
              {conversions.pagination.total} total
            </span>
          )
        }
      >
        {loadingConversions && !conversions ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : conversions?.conversions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No conversions found for this timeframe
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Lead
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Payout
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Source
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Affiliate
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Transaction ID
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {conversions?.conversions.map((conv) => (
                    <tr
                      key={conv.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-2 text-sm text-gray-900">
                        {formatDate(conv.receivedAt)}
                      </td>
                      <td className="py-3 px-2">
                        {conv.leadNotFound ? (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <span className="text-sm text-amber-700">Not Found</span>
                            <span className="text-xs text-gray-400 font-mono ml-1">
                              {conv.affSub2?.slice(0, 8)}...
                            </span>
                          </div>
                        ) : conv.lead ? (
                          <div>
                            <a
                              href={`/admin/leads/${conv.lead.id}`}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                            >
                              {conv.lead.firstName} {conv.lead.lastName?.[0] || ''}.
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-sm font-medium text-green-600">
                        {formatCurrency(conv.payout)}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-600">
                        {conv.affSub || '-'}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-600">
                        {conv.lead?.affiliateRef || '-'}
                      </td>
                      <td className="py-3 px-2">
                        <span className="font-mono text-xs text-gray-500">
                          {conv.transactionId}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {conversions && conversions.pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Page {conversions.pagination.page} of {conversions.pagination.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loadingConversions}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={!conversions.pagination.hasMore || loadingConversions}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </AdminSection>
    </div>
  );
}
