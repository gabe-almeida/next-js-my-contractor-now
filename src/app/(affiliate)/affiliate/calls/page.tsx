'use client';

/**
 * Affiliate Calls Page
 *
 * WHY: Shows affiliate their call history with status, duration, and payout.
 *      Essential for tracking earnings and reviewing call performance.
 *
 * WHEN: User navigates to /affiliate/calls from the sidebar.
 *
 * HOW: Uses AdminDataTable for sortable, paginated call list with filters.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AdminDataTable, TableColumn, FilterOption } from '@/components/admin/ui/AdminDataTable';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { Button } from '@/components/ui/Button';
import { Play, Phone, Clock, AlertCircle } from 'lucide-react';

interface Call {
  id: string;
  createdAt: string;
  callerPhone: string;
  callerPhoneDisplay: string | null;
  callerCity: string | null;
  callerState: string | null;
  totalDurationSeconds: number | null;
  connectedDurationSeconds: number | null;
  status: string;
  isBillable: boolean;
  affiliatePayout: number | null;
  recordingStatus: string;
  campaign: {
    id: string;
    name: string;
    serviceType: string;
  } | null;
}

/**
 * WHY: Mask phone number for privacy in list view.
 * WHEN: Displaying caller phone in the table.
 * HOW: Show first 3 and last 4 digits only.
 */
function maskPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ***-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(1, 4)}) ***-${digits.slice(7)}`;
  }
  return phone.slice(0, 4) + '***' + phone.slice(-4);
}

/**
 * WHY: Format duration in MM:SS format.
 * WHEN: Displaying call duration in the table.
 * HOW: Simple math division and modulo.
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * WHY: Format relative time without external dependencies.
 * WHEN: Displaying "X minutes ago" style timestamps.
 * HOW: Calculate difference and return appropriate string.
 */
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(seconds / 86400);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

/**
 * WHY: Map call status to display color.
 * WHEN: Rendering status badge.
 * HOW: Return color based on status enum value.
 */
function getStatusColor(status: string): 'green' | 'red' | 'yellow' | 'gray' {
  const colors: Record<string, 'green' | 'red' | 'yellow' | 'gray'> = {
    COMPLETED: 'green',
    CONNECTED: 'green',
    NO_ANSWER: 'yellow',
    BUSY: 'yellow',
    CALLER_HANGUP: 'gray',
    FAILED: 'red',
    NO_BIDS: 'gray',
    REJECTED: 'red'
  };
  return colors[status] || 'gray';
}

/**
 * WHY: Format call status for display.
 * WHEN: Rendering status badge text.
 * HOW: Replace underscores with spaces, handle special cases.
 */
function formatCallStatus(status: string): string {
  const labels: Record<string, string> = {
    COMPLETED: 'Complete',
    CONNECTED: 'Connected',
    NO_ANSWER: 'No Answer',
    BUSY: 'Busy',
    CALLER_HANGUP: 'Caller Hangup',
    FAILED: 'Failed',
    NO_BIDS: 'No Buyer',
    REJECTED: 'Rejected',
    RINGING: 'Ringing',
    IVR: 'IVR',
    BIDDING: 'Bidding',
    CONNECTING: 'Connecting'
  };
  return labels[status] || status.replace(/_/g, ' ');
}

/**
 * WHY: Format currency for display.
 * WHEN: Displaying payout amounts.
 * HOW: Use Intl.NumberFormat for consistent USD formatting.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

export default function AffiliateCallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  /**
   * WHY: Fetch calls from API.
   * WHEN: Page load.
   * HOW: GET request with Bearer token authentication.
   */
  const fetchCalls = useCallback(async () => {
    const token = localStorage.getItem('affiliate_token');
    if (!token) {
      setError('Please log in to view your calls');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/affiliates/calls?limit=100', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch calls');
        return;
      }

      setCalls(data.data);
    } catch (err) {
      setError('Failed to load calls. Please try again.');
      console.error('Error fetching calls:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // Define columns for AdminDataTable
  const columns: TableColumn<Call>[] = [
    {
      key: 'createdAt',
      header: 'Time',
      sortable: true,
      render: (call) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {new Date(call.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
          <div className="text-xs text-gray-500">
            {formatTimeAgo(new Date(call.createdAt))}
          </div>
        </div>
      )
    },
    {
      key: 'callerPhone',
      header: 'Caller',
      render: (call) => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-gray-400" />
          <div>
            <span className="text-sm">{maskPhoneNumber(call.callerPhone)}</span>
            {(call.callerCity || call.callerState) && (
              <div className="text-xs text-gray-500">
                {[call.callerCity, call.callerState].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'campaign',
      header: 'Campaign',
      render: (call) => (
        <div>
          <span className="text-sm">{call.campaign?.name || '-'}</span>
          {call.campaign?.serviceType && (
            <div className="text-xs text-gray-500">{call.campaign.serviceType}</div>
          )}
        </div>
      )
    },
    {
      key: 'connectedDurationSeconds',
      header: 'Duration',
      sortable: true,
      render: (call) => (
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-mono">{formatDuration(call.connectedDurationSeconds)}</span>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (call) => (
        <AdminBadge color={call.isBillable ? 'green' : getStatusColor(call.status)}>
          {call.isBillable && call.affiliatePayout
            ? formatCurrency(call.affiliatePayout)
            : formatCallStatus(call.status)}
        </AdminBadge>
      )
    },
    {
      key: 'recording',
      header: '',
      align: 'center' as const,
      render: (call) =>
        call.recordingStatus === 'AVAILABLE' && (
          <Button
            variant="ghost"
            size="sm"
            className="text-emerald-600 hover:text-emerald-700"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/affiliate/calls/${call.id}`);
            }}
          >
            <Play className="h-4 w-4" />
          </Button>
        )
    }
  ];

  // Filter options
  const filters: FilterOption[] = [
    {
      key: 'isBillable',
      label: 'Status',
      options: [
        { value: 'true', label: 'Qualified' },
        { value: 'false', label: 'Not Qualified' }
      ]
    }
  ];

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Calls</h3>
        <p className="text-red-600">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <AdminDataTable
      data={calls}
      loading={loading}
      keyField="id"
      columns={columns}
      title="Call History"
      subtitle="View all your incoming calls and earnings"
      searchPlaceholder="Search by phone number..."
      searchFields={['callerPhone']}
      filters={filters}
      defaultSortField="createdAt"
      defaultSortDirection="desc"
      onRowClick={(call) => router.push(`/affiliate/calls/${call.id}`)}
      emptyMessage="No calls yet. Share your tracking numbers to start receiving calls!"
      emptyAction={
        <Button
          variant="outline"
          onClick={() => router.push('/affiliate/campaigns')}
          className="mt-2"
        >
          View Campaigns
        </Button>
      }
    />
  );
}
