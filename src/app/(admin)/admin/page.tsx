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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API calls - replace with real endpoints
    const fetchDashboardData = async () => {
      try {
        // Mock data - replace with actual API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setMetrics({
          totalLeads: 1247,
          leadsToday: 89,
          successfulPosts: 1089,
          totalRevenue: 45678.90,
          averageBid: 36.70,
          conversionRate: 87.3,
          trustedFormCoverage: 94.2,
          jornayaCoverage: 91.8,
          fullComplianceRate: 89.5
        });

        setLeadsData([
          { label: 'Mon', value: 45 },
          { label: 'Tue', value: 52 },
          { label: 'Wed', value: 38 },
          { label: 'Thu', value: 61 },
          { label: 'Fri', value: 73 },
          { label: 'Sat', value: 67 },
          { label: 'Sun', value: 59 }
        ]);

        setRevenueData([
          { label: 'Mon', revenue: 1820, leads: 45 },
          { label: 'Tue', revenue: 2140, leads: 52 },
          { label: 'Wed', revenue: 1560, leads: 38 },
          { label: 'Thu', revenue: 2501, leads: 61 },
          { label: 'Fri', revenue: 2993, leads: 73 },
          { label: 'Sat', revenue: 2745, leads: 67 },
          { label: 'Sun', revenue: 2421, leads: 59 }
        ]);

        setServiceData([
          { label: 'Windows', value: 342, category: 'Home Improvement' },
          { label: 'Bathrooms', value: 289, category: 'Home Improvement' },
          { label: 'Roofing', value: 234, category: 'Exterior' },
          { label: 'Kitchens', value: 198, category: 'Home Improvement' },
          { label: 'HVAC', value: 184, category: 'Systems' }
        ]);

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
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="h-2 w-2 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse flex-1"></div>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-900">New lead submitted for Windows service</span>
                  <span className="text-gray-500">2 min ago</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-900">Auction completed - $42.50 winning bid</span>
                  <span className="text-gray-500">5 min ago</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-900">Lead posted to HomeAdvisor successfully</span>
                  <span className="text-gray-500">8 min ago</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-gray-900">New buyer configuration added</span>
                  <span className="text-gray-500">12 min ago</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-900">Bathroom service lead processed</span>
                  <span className="text-gray-500">15 min ago</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}