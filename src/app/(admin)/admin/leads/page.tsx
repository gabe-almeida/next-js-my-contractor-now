'use client';

/**
 * Admin Leads Page
 *
 * WHY: Central management interface for all leads in the system.
 * WHEN: Accessed via Admin Dashboard → Leads navigation.
 * HOW: Fetches leads from API, displays in modern LeadTable with stats cards.
 */

import { useState, useEffect, useCallback } from 'react';
import { LeadTable } from '@/components/admin/LeadTable';
import { LeadDetailModal } from '@/components/admin/LeadDetailModal';
import { Lead } from '@/types';
import { Button } from '@/components/ui/Button';
import { AdminPageHeader, AdminCard } from '@/components/admin/ui';
import {
  RefreshCw,
  AlertCircle,
  DollarSign,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

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
    totalRevenue: 0,
  });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/leads?limit=100', {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }

      const data = await response.json();

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
        winningBuyer: lead.winningBuyer,
        winningBid: lead.winningBid ? Number(lead.winningBid) : undefined,
        pingCount: lead.pingCount,
        creditAmount: lead.creditAmount ? Number(lead.creditAmount) : undefined,
        leadQualityScore: lead.leadQualityScore,
        createdAt: new Date(lead.createdAt),
        updatedAt: new Date(lead.updatedAt),
      }));

      setLeads(transformedLeads);

      const pending = transformedLeads.filter((l) => l.status === 'PENDING').length;
      const sold = transformedLeads.filter((l) => l.status === 'SOLD').length;
      const scrubbed = transformedLeads.filter((l) => l.status === 'SCRUBBED').length;
      const revenue = transformedLeads
        .filter((l) => l.winningBid)
        .reduce((sum, l) => sum + (l.winningBid || 0), 0);

      setStats({
        totalLeads: transformedLeads.length,
        pendingLeads: pending,
        soldLeads: sold,
        scrubbedLeads: scrubbed,
        totalRevenue: revenue,
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
    fetchLeads();
  };

  const handleExport = async () => {
    const headers = ['ID', 'Service', 'ZIP', 'Status', 'Disposition', 'Winning Bid', 'Created'];
    const rows = leads.map((lead) => [
      lead.id,
      lead.serviceType?.name || '',
      lead.zipCode,
      lead.status,
      (lead as any).disposition || '',
      lead.winningBid?.toFixed(2) || '',
      new Date(lead.createdAt).toISOString(),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
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
      {/* Page Header */}
      <AdminPageHeader
        title="Lead Management"
        description="Monitor and manage all incoming leads"
        lastUpdated={lastRefresh}
        actions={
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-4">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Failed to load leads</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <Button variant="outline" onClick={handleRefresh} className="shrink-0">
            Retry
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <AdminCard
          title="Total Leads"
          value={stats.totalLeads}
          icon={FileText}
          accent="gray"
        />
        <AdminCard
          title="Pending"
          value={stats.pendingLeads}
          icon={Clock}
          accent="yellow"
        />
        <AdminCard
          title="Sold"
          value={stats.soldLeads}
          icon={CheckCircle}
          accent="green"
        />
        <AdminCard
          title="Scrubbed"
          value={stats.scrubbedLeads}
          icon={XCircle}
          accent="red"
        />
        <AdminCard
          title="Revenue"
          value={`$${stats.totalRevenue.toFixed(2)}`}
          icon={DollarSign}
          accent="orange"
        />
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
