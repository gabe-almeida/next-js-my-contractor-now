'use client';

/**
 * Admin Dashboard Page
 *
 * WHY: Provides overview of platform metrics and analytics.
 * WHEN: Main landing page for admin users.
 * HOW: Fetches real data from API and displays in consistent UI components.
 */

import { useState, useEffect, useCallback } from 'react';
import { MetricCard } from '@/components/charts/MetricCard';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { AdminPageHeader, AdminSection } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import {
  FileText,
  DollarSign,
  TrendingUp,
  Shield,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { DashboardMetrics, ChartData } from '@/types';

// Helper to format percentages to 2 decimal places max
const formatPercent = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0';
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
};

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [leadsData, setLeadsData] = useState<ChartData[]>([]);
  const [revenueData, setRevenueData] = useState<ChartData[]>([]);
  const [serviceData, setServiceData] = useState<ChartData[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch real analytics from API
      const [analyticsResponse, allTimeResponse] = await Promise.all([
        fetch('/api/admin/leads?analytics=true&period=7d', {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
          }
        }),
        fetch('/api/admin/leads?analytics=true&period=30d', {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
          }
        })
      ]);

      if (!analyticsResponse.ok || !allTimeResponse.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const analyticsData = await analyticsResponse.json();
      const allTimeData = await allTimeResponse.json();

      const weeklyStats = analyticsData.data.summary;
      const allTimeStats = allTimeData.data.summary;
      const byStatus = analyticsData.data.byStatus || {};
      const byServiceType = analyticsData.data.byServiceType || {};
      const timeline = analyticsData.data.timeline || [];

      // Fetch today's leads count
      const today = new Date().toISOString().split('T')[0];
      const todayLeads = timeline.find((t: any) => t.date === today)?.leads || 0;

      // Calculate compliance metrics from all leads
      const allLeadsResponse = await fetch('/api/admin/leads?limit=1000', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      });

      let trustedFormCoverage = 0;
      let jornayaCoverage = 0;
      let fullComplianceRate = 0;

      if (allLeadsResponse.ok) {
        const allLeadsData = await allLeadsResponse.json();
        const leads = allLeadsData.data?.leads || [];
        if (leads.length > 0) {
          const withTF = leads.filter((l: any) => l.trustedFormCertUrl).length;
          const withJornaya = leads.filter((l: any) => l.jornayaLeadId).length;
          const withBoth = leads.filter((l: any) => l.trustedFormCertUrl && l.jornayaLeadId).length;

          trustedFormCoverage = (withTF / leads.length) * 100;
          jornayaCoverage = (withJornaya / leads.length) * 100;
          fullComplianceRate = (withBoth / leads.length) * 100;

          // Store recent leads for activity feed
          setRecentLeads(leads.slice(0, 5));
        }
      }

      setMetrics({
        totalLeads: allTimeStats.totalLeads || 0,
        leadsToday: todayLeads,
        successfulPosts: byStatus.sold || 0,
        totalRevenue: weeklyStats.totalRevenue || 0,
        averageBid: allTimeStats.averageValue || 0,
        conversionRate: parseFloat(weeklyStats.conversionRate) || 0,
        trustedFormCoverage: Math.round(trustedFormCoverage * 10) / 10,
        jornayaCoverage: Math.round(jornayaCoverage * 10) / 10,
        fullComplianceRate: Math.round(fullComplianceRate * 10) / 10
      });

      // Transform timeline data for charts (last 7 days)
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const chartLeadsData = timeline.map((t: any) => ({
        label: dayNames[new Date(t.date).getDay()],
        value: t.leads
      }));

      const chartRevenueData = timeline.map((t: any) => ({
        label: dayNames[new Date(t.date).getDay()],
        revenue: Number(t.revenue),
        leads: t.leads
      }));

      setLeadsData(chartLeadsData);
      setRevenueData(chartRevenueData);

      // Transform service type data
      const serviceChartData = Object.entries(byServiceType)
        .map(([label, value]) => ({
          label,
          value: value as number
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // Top 5 services

      setServiceData(serviceChartData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Helper to format time ago
  const timeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const statusColors: Record<string, string> = {
    SOLD: 'bg-emerald-500',
    PENDING: 'bg-amber-500',
    PROCESSING: 'bg-blue-500',
    REJECTED: 'bg-red-500',
    EXPIRED: 'bg-gray-500'
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        title="Dashboard Overview"
        description="Real-time platform metrics and analytics"
        lastUpdated={lastUpdated}
        actions={
          <Button
            variant="outline"
            onClick={fetchDashboardData}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Leads"
          value={metrics?.totalLeads || 0}
          description="All time"
          icon={<FileText className="h-4 w-4" />}
          loading={loading}
        />

        <MetricCard
          title="Leads Today"
          value={metrics?.leadsToday || 0}
          description="24h period"
          icon={<Clock className="h-4 w-4" />}
          loading={loading}
        />

        <MetricCard
          title="Total Revenue"
          value={`$${metrics?.totalRevenue?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}`}
          description="This week"
          icon={<DollarSign className="h-4 w-4" />}
          loading={loading}
        />

        <MetricCard
          title="Conversion Rate"
          value={`${formatPercent(metrics?.conversionRate)}%`}
          description="Lead to post"
          icon={<TrendingUp className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      {/* Compliance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="TrustedForm Coverage"
          value={`${formatPercent(metrics?.trustedFormCoverage)}%`}
          description="Leads with certificates"
          icon={<Shield className="h-4 w-4" />}
          loading={loading}
        />

        <MetricCard
          title="Jornaya Coverage"
          value={`${formatPercent(metrics?.jornayaCoverage)}%`}
          description="Leads with LeadID"
          icon={<CheckCircle className="h-4 w-4" />}
          loading={loading}
        />

        <MetricCard
          title="Full Compliance"
          value={`${formatPercent(metrics?.fullComplianceRate)}%`}
          description="Both TF & Jornaya"
          icon={<AlertTriangle className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineChart
          title="Lead Volume (Last 7 Days)"
          data={leadsData}
          xAxisKey="label"
          lines={[
            {
              dataKey: 'value',
              stroke: '#f97316',
              name: 'Leads',
              strokeWidth: 3
            }
          ]}
          loading={loading}
        />

        <BarChart
          title="Revenue & Lead Volume"
          data={revenueData}
          xAxisKey="label"
          bars={[
            {
              dataKey: 'revenue',
              fill: '#10b981',
              name: 'Revenue ($)'
            },
            {
              dataKey: 'leads',
              fill: '#f97316',
              name: 'Lead Count'
            }
          ]}
          loading={loading}
        />
      </div>

      {/* Service Performance & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart
          title="Top Performing Services"
          data={serviceData}
          xAxisKey="label"
          bars={[
            {
              dataKey: 'value',
              fill: '#f97316',
              name: 'Lead Count'
            }
          ]}
          loading={loading}
        />

        {/* Recent Activity */}
        <AdminSection title="Recent Leads">
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="h-2 w-2 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse flex-1"></div>
                </div>
              ))
            ) : recentLeads.length > 0 ? (
              recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center space-x-3 text-sm">
                  <div className={`h-2 w-2 ${statusColors[lead.status] || 'bg-gray-400'} rounded-full`}></div>
                  <span className="text-gray-900 flex-1">
                    {lead.serviceType?.displayName || lead.serviceType?.name || 'Lead'} - {lead.zipCode}
                    {lead.winningBid && (
                      <span className="text-emerald-600 ml-1">${Number(lead.winningBid).toFixed(2)}</span>
                    )}
                  </span>
                  <span className="text-gray-500 text-xs">{timeAgo(lead.createdAt)}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">No recent leads</div>
            )}
          </div>
        </AdminSection>
      </div>
    </div>
  );
}
