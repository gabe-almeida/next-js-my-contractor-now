'use client';

import { useState, useEffect } from 'react';
import { MetricCard } from '@/components/charts/MetricCard';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { 
  Users, 
  FileText, 
  DollarSign, 
  TrendingUp,
  Shield,
  CheckCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { DashboardMetrics, ChartData } from '@/types';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [leadsData, setLeadsData] = useState<ChartData[]>([]);
  const [revenueData, setRevenueData] = useState<ChartData[]>([]);
  const [serviceData, setServiceData] = useState<ChartData[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
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
        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-500">Real-time platform metrics and analytics</p>
        </div>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Leads"
          value={metrics?.totalLeads || 0}
          description="All time"
          trend={{
            value: 12.5,
            label: 'vs last month',
            direction: 'up'
          }}
          icon={<FileText className="h-4 w-4" />}
          loading={loading}
        />
        
        <MetricCard
          title="Leads Today"
          value={metrics?.leadsToday || 0}
          description="24h period"
          trend={{
            value: 8.2,
            label: 'vs yesterday',
            direction: 'up'
          }}
          icon={<Clock className="h-4 w-4" />}
          loading={loading}
        />
        
        <MetricCard
          title="Total Revenue"
          value={`$${metrics?.totalRevenue?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}`}
          description="This month"
          trend={{
            value: 15.3,
            label: 'vs last month',
            direction: 'up'
          }}
          icon={<DollarSign className="h-4 w-4" />}
          loading={loading}
        />
        
        <MetricCard
          title="Conversion Rate"
          value={`${metrics?.conversionRate || 0}%`}
          description="Lead to post"
          trend={{
            value: 2.1,
            label: 'vs last week',
            direction: 'up'
          }}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      {/* Compliance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="TrustedForm Coverage"
          value={`${metrics?.trustedFormCoverage || 0}%`}
          description="Leads with certificates"
          trend={{
            value: 1.8,
            label: 'vs last week',
            direction: 'up'
          }}
          icon={<Shield className="h-4 w-4" />}
          loading={loading}
        />
        
        <MetricCard
          title="Jornaya Coverage"
          value={`${metrics?.jornayaCoverage || 0}%`}
          description="Leads with LeadID"
          trend={{
            value: 0.5,
            label: 'vs last week',
            direction: 'up'
          }}
          icon={<CheckCircle className="h-4 w-4" />}
          loading={loading}
        />
        
        <MetricCard
          title="Full Compliance"
          value={`${metrics?.fullComplianceRate || 0}%`}
          description="Both TF & Jornaya"
          trend={{
            value: -0.8,
            label: 'vs last week',
            direction: 'down'
          }}
          icon={<AlertTriangle className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Volume Chart */}
        <LineChart
          title="Lead Volume (Last 7 Days)"
          data={leadsData}
          xAxisKey="label"
          lines={[
            {
              dataKey: 'value',
              stroke: '#3b82f6',
              name: 'Leads',
              strokeWidth: 3
            }
          ]}
          loading={loading}
        />

        {/* Revenue Chart */}
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
              fill: '#6366f1',
              name: 'Lead Count'
            }
          ]}
          loading={loading}
        />
      </div>

      {/* Service Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart
          title="Top Performing Services"
          data={serviceData}
          xAxisKey="label"
          bars={[
            {
              dataKey: 'value',
              fill: '#f59e0b',
              name: 'Lead Count'
            }
          ]}
          loading={loading}
        />

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Leads</h3>
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="h-2 w-2 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse flex-1"></div>
                </div>
              ))
            ) : recentLeads.length > 0 ? (
              recentLeads.map((lead) => {
                const statusColors: Record<string, string> = {
                  SOLD: 'bg-green-500',
                  PENDING: 'bg-yellow-500',
                  PROCESSING: 'bg-blue-500',
                  REJECTED: 'bg-red-500',
                  EXPIRED: 'bg-gray-500'
                };
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
                return (
                  <div key={lead.id} className="flex items-center space-x-3 text-sm">
                    <div className={`h-2 w-2 ${statusColors[lead.status] || 'bg-gray-400'} rounded-full`}></div>
                    <span className="text-gray-900 flex-1">
                      {lead.serviceType?.displayName || lead.serviceType?.name || 'Lead'} - {lead.zipCode}
                      {lead.winningBid && <span className="text-green-600 ml-1">${Number(lead.winningBid).toFixed(2)}</span>}
                    </span>
                    <span className="text-gray-500 text-xs">{timeAgo(lead.createdAt)}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-gray-500">No recent leads</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}