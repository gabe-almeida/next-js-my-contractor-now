'use client';

/**
 * Admin Calls Management Page
 *
 * WHY: Central view for all calls with filtering, stats, and quick access to details.
 * WHEN: Admin navigates to /admin/calls from sidebar.
 * HOW: Fetches calls from API, displays in table with status filtering.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageHeader, AdminCard } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import {
  RefreshCw,
  AlertCircle,
  Phone,
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  Users,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface CallSummary {
  id: string;
  twilioCallSid: string;
  createdAt: string;
  status: string;
  disposition: string | null;
  callerPhone: string;
  callerPhoneDisplay: string | null;
  callerCity: string | null;
  callerState: string | null;
  totalDurationSeconds: number | null;
  connectedDurationSeconds: number | null;
  isBillable: boolean;
  winningBid: string | null;
  buyerCharge: string | null;
  auctionDurationMs: number | null;
  eligibleBuyersCount: number | null;
  cascadeAttempts: number | null;
  serviceType: { id: string; name: string; displayName: string } | null;
  affiliate: { id: string; companyName: string } | null;
  winningBuyer: { id: string; name: string; displayName: string; type: string } | null;
}

function formatPhoneNumber(phone: string, display?: string | null): string {
  if (display) return display;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatCurrency(amount: number | string | null): string {
  if (!amount) return '$0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700',
    CONNECTED: 'bg-green-100 text-green-700',
    BIDDING: 'bg-blue-100 text-blue-700',
    CONNECTING: 'bg-blue-100 text-blue-700',
    CASCADING: 'bg-yellow-100 text-yellow-700',
    NO_ANSWER: 'bg-yellow-100 text-yellow-700',
    CALLER_HANGUP: 'bg-gray-100 text-gray-700',
    NO_BIDS: 'bg-gray-100 text-gray-700',
    FAILED: 'bg-red-100 text-red-700',
    REJECTED: 'bg-red-100 text-red-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CONNECTED', label: 'Connected' },
  { value: 'CASCADING', label: 'Cascading' },
  { value: 'NO_ANSWER', label: 'No Answer' },
  { value: 'CALLER_HANGUP', label: 'Caller Hangup' },
  { value: 'NO_BIDS', label: 'No Bids' },
  { value: 'FAILED', label: 'Failed' },
];

export default function AdminCallsPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });
  const [stats, setStats] = useState({ total: 0, completed: 0, billable: 0, totalRevenue: 0 });

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const adminToken = localStorage.getItem('admin_token');
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/admin/calls?${params}`, {
        headers: { Authorization: `Bearer ${adminToken || ''}` },
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch calls');
        return;
      }

      setCalls(data.data.calls);
      setPagination((prev) => ({ ...prev, total: data.data.pagination.total }));
      setStats(data.data.stats);
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load calls. Please try again.');
      console.error('Error fetching calls:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, pagination.limit, pagination.offset]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const handleViewDetails = (callId: string) => {
    router.push(`/admin/calls/${callId}`);
  };

  const handlePageChange = (direction: 'prev' | 'next') => {
    setPagination((prev) => ({
      ...prev,
      offset: direction === 'next' ? prev.offset + prev.limit : Math.max(0, prev.offset - prev.limit),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        title="Call Management"
        description="Monitor and manage all pay-per-call traffic"
        lastUpdated={lastRefresh}
        actions={
          <Button variant="outline" onClick={fetchCalls} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-4">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Failed to load calls</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <Button variant="outline" onClick={fetchCalls}>
            Retry
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminCard title="Total Calls" value={stats.total} icon={Phone} accent="gray" />
        <AdminCard title="Completed" value={stats.completed} icon={CheckCircle} accent="green" />
        <AdminCard title="Billable" value={stats.billable} icon={DollarSign} accent="orange" />
        <AdminCard title="Revenue" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} accent="green" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, offset: 0 }));
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Calls Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Caller</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Winner</th>
                <th className="px-4 py-3 text-right">Bid</th>
                <th className="px-4 py-3 text-right">Duration</th>
                <th className="px-4 py-3 text-right">Auction</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-4">
                      <div className="h-8 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    No calls found
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr key={call.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleViewDetails(call.id)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {formatPhoneNumber(call.callerPhone, call.callerPhoneDisplay)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {[call.callerCity, call.callerState].filter(Boolean).join(', ') || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900">{call.serviceType?.displayName || 'Unknown'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                        {call.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {call.winningBuyer ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {call.winningBuyer.displayName || call.winningBuyer.name}
                          </div>
                          <div className="text-xs text-gray-500">{call.winningBuyer.type}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No winner</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {call.winningBid ? (
                        <span className="font-medium text-emerald-600">{formatCurrency(call.winningBid)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-gray-600">{formatDuration(call.connectedDurationSeconds)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-xs">
                        {call.auctionDurationMs ? (
                          <span className="text-gray-600">{call.auctionDurationMs}ms</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                        {call.eligibleBuyersCount && (
                          <span className="text-gray-400 ml-1">({call.eligibleBuyersCount} buyers)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{formatTimeAgo(call.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(call.id);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} of{' '}
            {pagination.total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange('prev')}
              disabled={pagination.offset === 0 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange('next')}
              disabled={pagination.offset + pagination.limit >= pagination.total || loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
