'use client';

/**
 * Admin Leads Page
 *
 * WHY: Central management interface for all leads in the system.
 *      Allows admins to view, filter, and manage lead status.
 *
 * WHEN: Accessed via Admin Dashboard → Leads navigation.
 *
 * HOW: Fetches leads from API with filtering/pagination,
 *      displays in LeadTable, opens LeadDetailModal on click.
 */

import { useState, useEffect, useCallback } from 'react';
import { LeadTable } from '@/components/admin/LeadTable';
import { LeadDetailModal } from '@/components/admin/LeadDetailModal';
import { Lead } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  RefreshCw,
  Filter,
  TrendingUp,
  AlertCircle,
  DollarSign,
  FileText
} from 'lucide-react';

// Temporary admin user ID - in production this would come from auth context
const ADMIN_USER_ID = 'admin-user-1';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalLeads: 0,
    pendingLeads: 0,
    soldLeads: 0,
    scrubbedLeads: 0,
    totalRevenue: 0
  });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/leads?limit=100', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }

      const data = await response.json();

      // Transform API response to match Lead type
      const transformedLeads: Lead[] = (data.data?.leads || []).map((lead: any) => ({
        id: lead.id,
        serviceTypeId: lead.serviceTypeId,
        serviceType: lead.serviceType,
        formData: lead.formData || {},
        zipCode: lead.formData?.zipCode || '',
        ownsHome: lead.formData?.ownsHome || false,
        timeframe: lead.formData?.timeframe || '',
        status: lead.status,
        disposition: lead.disposition,
        trustedFormCertUrl: lead.trustedFormCertUrl,
        trustedFormCertId: lead.trustedFormCertId,
        jornayaLeadId: lead.jornayaLeadId,
        winningBuyerId: lead.winningBuyer?.id,
        winningBid: lead.winningBid ? Number(lead.winningBid) : undefined,
        creditAmount: lead.creditAmount ? Number(lead.creditAmount) : undefined,
        leadQualityScore: lead.leadQualityScore,
        createdAt: new Date(lead.createdAt),
        updatedAt: new Date(lead.updatedAt)
      }));

      setLeads(transformedLeads);

      // Calculate stats
      const pending = transformedLeads.filter(l => l.status === 'PENDING').length;
      const sold = transformedLeads.filter(l => l.status === 'SOLD').length;
      const scrubbed = transformedLeads.filter(l => l.status === 'SCRUBBED').length;
      const revenue = transformedLeads
        .filter(l => l.winningBid)
        .reduce((sum, l) => sum + (l.winningBid || 0), 0);

      setStats({
        totalLeads: transformedLeads.length,
        pendingLeads: pending,
        soldLeads: sold,
        scrubbedLeads: scrubbed,
        totalRevenue: revenue
      });

      setLastRefresh(new Date());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleRefresh = () => {
    fetchLeads();
  };

  const handleViewDetails = (leadId: string) => {
    setSelectedLeadId(leadId);
  };

  const handleCloseModal = () => {
    setSelectedLeadId(null);
  };

  const handleLeadUpdated = () => {
    // Refresh leads list when a lead is updated
    fetchLeads();
  };

  const handleExport = async () => {
    // Export leads to CSV
    const headers = ['ID', 'Service', 'ZIP', 'Status', 'Disposition', 'Winning Bid', 'Created'];
    const rows = leads.map(lead => [
      lead.id,
      lead.serviceType?.name || '',
      lead.zipCode,
      lead.status,
      (lead as any).disposition || '',
      lead.winningBid?.toFixed(2) || '',
      new Date(lead.createdAt).toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <div>
            <p className="text-red-800 font-medium">Failed to load leads</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
          <Button variant="outline" onClick={handleRefresh} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Leads
            </CardTitle>
            <FileText className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLeads}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Pending
            </CardTitle>
            <Filter className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingLeads}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Sold
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.soldLeads}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Scrubbed
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.scrubbedLeads}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats.totalRevenue.toFixed(2)}
            </div>
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

      {/* Lead Detail Modal */}
      {selectedLeadId && (
        <LeadDetailModal
          leadId={selectedLeadId}
          adminUserId={ADMIN_USER_ID}
          onClose={handleCloseModal}
          onLeadUpdated={handleLeadUpdated}
        />
      )}
    </div>
  );
}
