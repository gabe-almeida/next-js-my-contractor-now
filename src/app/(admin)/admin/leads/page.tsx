'use client';

import { useState, useEffect } from 'react';
import { LeadTable } from '@/components/admin/LeadTable';
import { Lead } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  RefreshCw, 
  Filter,
  Calendar,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock lead data
      const mockLeads: Lead[] = Array.from({ length: 25 }, (_, i) => ({
        id: `lead-${String(i + 1).padStart(4, '0')}`,
        serviceTypeId: 'service-1',
        serviceType: {
          id: 'service-1',
          name: ['Windows', 'Bathrooms', 'Roofing', 'Kitchens', 'HVAC'][i % 5],
          description: 'Service description',
          formSchema: [],
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        formData: {
          customerName: `Customer ${i + 1}`,
          email: `customer${i + 1}@email.com`,
          phone: `555-${String(Math.floor(Math.random() * 9000) + 1000)}`
        },
        zipCode: String(Math.floor(Math.random() * 90000) + 10000),
        ownsHome: Math.random() > 0.3,
        timeframe: ['ASAP', '1-2 weeks', '1-3 months', '3+ months'][Math.floor(Math.random() * 4)],
        status: (['PENDING', 'PROCESSING', 'AUCTION_COMPLETE', 'POSTED', 'FAILED'] as const)[Math.floor(Math.random() * 5)],
        trustedFormCertUrl: Math.random() > 0.1 ? `https://cert.trustedform.com/cert${i}` : undefined,
        trustedFormCertId: Math.random() > 0.1 ? `cert${i}` : undefined,
        jornayaLeadId: Math.random() > 0.15 ? `jornaya${i}` : undefined,
        complianceData: {
          userAgent: 'Mozilla/5.0...',
          timestamp: new Date().toISOString(),
          ipAddress: `192.168.1.${i + 1}`,
          tcpaConsent: true,
          privacyPolicyAccepted: true,
          submissionSource: 'web_form'
        },
        auctionCompleted: Math.random() > 0.3,
        winningBuyerId: Math.random() > 0.3 ? `buyer-${Math.floor(Math.random() * 3) + 1}` : undefined,
        winningBid: Math.random() > 0.3 ? Math.floor(Math.random() * 100) + 20 : undefined,
        totalBids: Math.floor(Math.random() * 5) + 1,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      }));
      
      setLeads(mockLeads);
      setLoading(false);
      setLastRefresh(new Date());
    };

    fetchLeads();
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    // Simulate refresh
    setTimeout(() => {
      setLoading(false);
      setLastRefresh(new Date());
    }, 1000);
  };

  const handleViewDetails = (leadId: string) => {
    // Navigate to lead details page or open modal
    console.log('View details for lead:', leadId);
  };

  const handleExport = () => {
    // Export leads to CSV
    console.log('Exporting leads...');
  };

  // Calculate metrics
  const totalLeads = leads.length;
  const pendingLeads = leads.filter(l => l.status === 'PENDING').length;
  const completedAuctions = leads.filter(l => l.auctionCompleted).length;
  const failedLeads = leads.filter(l => l.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-gray-500">Monitor and manage all incoming leads</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Leads
            </CardTitle>
            <Filter className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-gray-500">
              All leads in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Pending Processing
            </CardTitle>
            <Calendar className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingLeads}</div>
            <p className="text-xs text-gray-500">
              Awaiting auction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Completed Auctions
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedAuctions}</div>
            <p className="text-xs text-gray-500">
              Successfully auctioned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Failed Leads
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedLeads}</div>
            <p className="text-xs text-gray-500">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lead Table */}
      <LeadTable
        leads={leads}
        loading={loading}
        onViewDetails={handleViewDetails}
        onExport={handleExport}
      />
    </div>
  );
}