'use client';

/**
 * Analytics Dashboard Page
 *
 * WHY: Provides detailed compliance and auction analytics.
 * WHEN: Admin needs to analyze platform performance metrics.
 * HOW: Fetches real data from API and displays in consistent UI components.
 */

import { useState, useEffect, useCallback } from 'react';
import { MetricCard } from '@/components/charts/MetricCard';
import { LineChart } from '@/components/charts/LineChart';
import { AdminPageHeader, AdminSection, AdminSelect } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  Activity,
  Download,
  RefreshCw
} from 'lucide-react';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('7d');
  const [complianceMetrics, setComplianceMetrics] = useState<any>(null);
  const [auctionMetrics, setAuctionMetrics] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [complianceData, setComplianceData] = useState<any[]>([]);
  const [buyerPerformance, setBuyerPerformance] = useState<any[]>([]);
  const [qualityScores, setQualityScores] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/analytics?period=${timeframe}`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      const analytics = data.data;

      // Set all analytics data from API
      setComplianceMetrics(analytics.complianceMetrics);
      setAuctionMetrics(analytics.auctionMetrics);
      setRevenueData(analytics.revenueData);
      setComplianceData(analytics.complianceData);
      setBuyerPerformance(analytics.buyerPerformance);
      setQualityScores(analytics.qualityScores);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Set empty defaults on error
      setComplianceMetrics(null);
      setAuctionMetrics(null);
      setRevenueData([]);
      setComplianceData([]);
      setBuyerPerformance([]);
      setQualityScores([]);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExport = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      timeframe,
      complianceMetrics,
      auctionMetrics,
      revenueData,
      complianceData,
      buyerPerformance,
      qualityScores
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${timeframe}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const timeframeOptions = [
    { value: '1d', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        title="Analytics Dashboard"
        description="Performance metrics and compliance analytics"
        lastUpdated={lastUpdated}
        actions={
          <div className="flex items-center gap-3">
            <AdminSelect
              value={timeframe}
              onChange={setTimeframe}
              options={timeframeOptions}
              icon={false}
            />
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

      {/* Compliance Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Compliance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="TrustedForm Coverage"
            value={`${complianceMetrics?.trustedFormCoverage || 0}%`}
            description="Leads with TF certificates"
            icon={<Shield className="h-4 w-4" />}
            loading={loading}
          />

          <MetricCard
            title="Jornaya Coverage"
            value={`${complianceMetrics?.jornayaCoverage || 0}%`}
            description="Leads with LeadID"
            icon={<CheckCircle className="h-4 w-4" />}
            loading={loading}
          />

          <MetricCard
            title="Full Compliance"
            value={`${complianceMetrics?.fullComplianceRate || 0}%`}
            description="Both TF & Jornaya"
            icon={<AlertTriangle className="h-4 w-4" />}
            loading={loading}
          />

          <MetricCard
            title="Avg Quality Score"
            value={complianceMetrics?.avgQualityScore || 0}
            description="Lead quality rating"
            icon={<Target className="h-4 w-4" />}
            loading={loading}
          />
        </div>
      </div>

      {/* Auction Performance */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Auction Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Average Bid"
            value={`$${auctionMetrics?.avgBidAmount || 0}`}
            description="Per lead"
            icon={<DollarSign className="h-4 w-4" />}
            loading={loading}
          />

          <MetricCard
            title="Participation Rate"
            value={`${auctionMetrics?.bidParticipationRate || 0}%`}
            description="Buyers bidding"
            icon={<Users className="h-4 w-4" />}
            loading={loading}
          />

          <MetricCard
            title="Success Rate"
            value={`${auctionMetrics?.auctionSuccessRate || 0}%`}
            description="Completed auctions"
            icon={<TrendingUp className="h-4 w-4" />}
            loading={loading}
          />

          <MetricCard
            title="Avg Response Time"
            value={`${auctionMetrics?.avgResponseTime || 0}s`}
            description="Buyer response"
            icon={<Activity className="h-4 w-4" />}
            loading={loading}
          />
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineChart
          title="Revenue & Lead Volume Trends"
          data={revenueData}
          xAxisKey="date"
          lines={[
            {
              dataKey: 'revenue',
              stroke: '#10b981',
              name: 'Revenue ($)',
              strokeWidth: 3
            },
            {
              dataKey: 'leads',
              stroke: '#f97316',
              name: 'Lead Count',
              strokeWidth: 2
            }
          ]}
          loading={loading}
        />

        <LineChart
          title="Compliance Coverage Trends"
          data={complianceData}
          xAxisKey="date"
          lines={[
            {
              dataKey: 'trustedForm',
              stroke: '#3b82f6',
              name: 'TrustedForm (%)',
              strokeWidth: 2
            },
            {
              dataKey: 'jornaya',
              stroke: '#f97316',
              name: 'Jornaya (%)',
              strokeWidth: 2
            },
            {
              dataKey: 'both',
              stroke: '#10b981',
              name: 'Both (%)',
              strokeWidth: 3
            }
          ]}
          loading={loading}
        />
      </div>

      {/* Performance Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminSection title="Buyer Performance">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4"></div>
                </div>
              ))}
            </div>
          ) : buyerPerformance.length > 0 ? (
            <div className="space-y-3">
              {buyerPerformance.map((buyer) => (
                <div key={buyer.buyer} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{buyer.buyer}</div>
                    <div className="text-sm text-gray-500">
                      {buyer.volume} leads • {buyer.winRate}% win rate
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-emerald-600">${buyer.avgBid}</div>
                    <div className="text-sm text-gray-500">avg bid</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-4">No buyer performance data available</div>
          )}
        </AdminSection>

        <AdminSection title="Service Quality Scores">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4"></div>
                </div>
              ))}
            </div>
          ) : qualityScores.length > 0 ? (
            <div className="space-y-3">
              {qualityScores.map((service) => (
                <div key={service.service} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{service.service}</div>
                    <div className="text-sm text-gray-500">
                      {service.count} leads analyzed
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-orange-600">{service.avgScore}/10</div>
                    <div className="text-sm text-gray-500">quality score</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-4">No quality score data available</div>
          )}
        </AdminSection>
      </div>

      {/* Compliance Summary */}
      <AdminSection title="Compliance Analysis Summary">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-emerald-50 rounded-lg">
              <div className="text-2xl font-bold text-emerald-600">
                {complianceMetrics?.totalLeadsAnalyzed || 0}
              </div>
              <div className="text-sm text-gray-600">Total Leads Analyzed</div>
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {complianceMetrics?.highQualityLeads || 0}
              </div>
              <div className="text-sm text-gray-600">High Quality Leads</div>
            </div>

            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {auctionMetrics?.topBuyer || 'N/A'}
              </div>
              <div className="text-sm text-gray-600">Top Performing Buyer</div>
            </div>
          </div>
        )}
      </AdminSection>
    </div>
  );
}
