'use client';

import { useState, useEffect } from 'react';
import { MetricCard } from '@/components/charts/MetricCard';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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
  Calendar,
  Filter
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

  useEffect(() => {
    const fetchAnalytics = async () => {
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
    };

    fetchAnalytics();
  }, [timeframe]);

  const handleExport = () => {
    // Mock export functionality
    console.log('Exporting analytics data...');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500">Performance metrics and compliance analytics</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="1d">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
          
          <Button
            variant="outline"
            onClick={handleExport}
            className="flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* Compliance Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Compliance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="TrustedForm Coverage"
            value={`${complianceMetrics?.trustedFormCoverage || 0}%`}
            description="Leads with TF certificates"
            trend={{
              value: complianceMetrics?.complianceTrend || 0,
              label: 'vs last period',
              direction: 'up'
            }}
            icon={<Shield className="h-4 w-4" />}
            loading={loading}
          />
          
          <MetricCard
            title="Jornaya Coverage"
            value={`${complianceMetrics?.jornayaCoverage || 0}%`}
            description="Leads with LeadID"
            trend={{
              value: complianceMetrics?.complianceTrend || 0,
              label: 'vs last period',
              direction: 'up'
            }}
            icon={<CheckCircle className="h-4 w-4" />}
            loading={loading}
          />
          
          <MetricCard
            title="Full Compliance"
            value={`${complianceMetrics?.fullComplianceRate || 0}%`}
            description="Both TF & Jornaya"
            trend={{
              value: complianceMetrics?.complianceTrend || 0,
              label: 'vs last period',
              direction: 'up'
            }}
            icon={<AlertTriangle className="h-4 w-4" />}
            loading={loading}
          />
          
          <MetricCard
            title="Avg Quality Score"
            value={complianceMetrics?.avgQualityScore || 0}
            description="Lead quality rating"
            trend={{
              value: complianceMetrics?.qualityTrend || 0,
              label: 'vs last period',
              direction: 'up'
            }}
            icon={<Target className="h-4 w-4" />}
            loading={loading}
          />
        </div>
      </div>

      {/* Auction Performance */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Auction Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Average Bid"
            value={`$${auctionMetrics?.avgBidAmount || 0}`}
            description="Per lead"
            trend={{
              value: 3.2,
              label: 'vs last period',
              direction: 'up'
            }}
            icon={<DollarSign className="h-4 w-4" />}
            loading={loading}
          />
          
          <MetricCard
            title="Participation Rate"
            value={`${auctionMetrics?.bidParticipationRate || 0}%`}
            description="Buyers bidding"
            trend={{
              value: 1.8,
              label: 'vs last period',
              direction: 'up'
            }}
            icon={<Users className="h-4 w-4" />}
            loading={loading}
          />
          
          <MetricCard
            title="Success Rate"
            value={`${auctionMetrics?.auctionSuccessRate || 0}%`}
            description="Completed auctions"
            trend={{
              value: 2.5,
              label: 'vs last period',
              direction: 'up'
            }}
            icon={<TrendingUp className="h-4 w-4" />}
            loading={loading}
          />
          
          <MetricCard
            title="Avg Response Time"
            value={`${auctionMetrics?.avgResponseTime || 0}s`}
            description="Buyer response"
            trend={{
              value: -0.8,
              label: 'vs last period',
              direction: 'down'
            }}
            icon={<Activity className="h-4 w-4" />}
            loading={loading}
          />
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trends */}
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
              stroke: '#6366f1',
              name: 'Lead Count',
              strokeWidth: 2
            }
          ]}
          loading={loading}
        />

        {/* Compliance Trends */}
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
              stroke: '#f59e0b',
              name: 'Jornaya (%)',
              strokeWidth: 2
            },
            {
              dataKey: 'both',
              stroke: '#ef4444',
              name: 'Both (%)',
              strokeWidth: 3
            }
          ]}
          loading={loading}
        />
      </div>

      {/* Performance Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Buyer Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Buyer Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {buyerPerformance.map((buyer, index) => (
                  <div key={buyer.buyer} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{buyer.buyer}</div>
                      <div className="text-sm text-gray-500">
                        {buyer.volume} leads • {buyer.winRate}% win rate
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-green-600">${buyer.avgBid}</div>
                      <div className="text-sm text-gray-500">avg bid</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service Quality Scores */}
        <Card>
          <CardHeader>
            <CardTitle>Service Quality Scores</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {qualityScores.map((service, index) => (
                  <div key={service.service} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{service.service}</div>
                      <div className="text-sm text-gray-500">
                        {service.count} leads analyzed
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-blue-600">{service.avgScore}/10</div>
                      <div className="text-sm text-gray-500">quality score</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compliance Details */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {complianceMetrics?.totalLeadsAnalyzed || 0}
                </div>
                <div className="text-sm text-gray-500">Total Leads Analyzed</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {complianceMetrics?.highQualityLeads || 0}
                </div>
                <div className="text-sm text-gray-500">High Quality Leads</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {auctionMetrics?.topBuyer || 'N/A'}
                </div>
                <div className="text-sm text-gray-500">Top Performing Buyer</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}