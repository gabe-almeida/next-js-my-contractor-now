'use client';

/**
 * Affiliate Call Detail Page
 *
 * WHY: Shows detailed call information with recording player and activity log.
 *      Allows affiliates to review individual calls for quality and earnings.
 *
 * WHEN: User clicks on a call from the calls list or navigates directly.
 *
 * HOW: Fetches call detail from API, displays info grid with recording player.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminInfoGrid, InfoItem } from '@/components/admin/ui/AdminInfoGrid';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { RecordingPlayer } from '@/components/affiliate/RecordingPlayer';
import { Button } from '@/components/ui/Button';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Clock,
  DollarSign,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';

interface CallDetail {
  id: string;
  createdAt: string;
  callerPhone: string;
  callerPhoneDisplay: string | null;
  callerCity: string | null;
  callerState: string | null;
  callerZip: string | null;
  answeredAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  totalDurationSeconds: number | null;
  connectedDurationSeconds: number | null;
  status: string;
  disposition: string | null;
  isBillable: boolean;
  affiliatePayout: number | null;
  recordingStatus: string;
  recordingUrl: string | null;
  recordingDurationSeconds: number | null;
  campaign: {
    id: string;
    name: string;
    minCallDuration: number;
    callBasePayout: number | null;
    serviceType: { id: string; name: string; displayName: string };
  } | null;
  trackingNumber: {
    id: string;
    phoneNumber: string;
    phoneNumberDisplay: string | null;
  } | null;
  activityLog: {
    id: string;
    timestamp: string;
    event: string;
    message: string;
    level: string;
  }[];
}

/**
 * WHY: Format phone number for display.
 * WHEN: Displaying caller phone number.
 * HOW: Use display version if available, otherwise format E.164.
 */
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

/**
 * WHY: Format duration in MM:SS format.
 * WHEN: Displaying call duration.
 * HOW: Simple math division and modulo.
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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

/**
 * WHY: Format date for display without external dependencies.
 * WHEN: Displaying timestamps.
 * HOW: Use Intl.DateTimeFormat for consistent formatting.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

/**
 * WHY: Format time only for activity log.
 * WHEN: Displaying activity timestamps.
 * HOW: Use Intl.DateTimeFormat for time only.
 */
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(date);
}

/**
 * WHY: Format relative time without external dependencies.
 * WHEN: Displaying "X minutes ago" style timestamps.
 * HOW: Calculate difference and return appropriate string.
 */
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
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
 * WHY: Get icon for activity log event level.
 * WHEN: Rendering activity timeline.
 * HOW: Return appropriate icon component based on level.
 */
function getActivityIcon(level: string) {
  switch (level) {
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'warn':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'info':
      return <Info className="h-4 w-4 text-blue-500" />;
    default:
      return <CheckCircle className="h-4 w-4 text-green-500" />;
  }
}

export default function AffiliateCallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.id as string;

  const [call, setCall] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * WHY: Fetch call detail from API.
   * WHEN: Page load.
   * HOW: GET request with Bearer token authentication.
   */
  const fetchCall = useCallback(async () => {
    const token = localStorage.getItem('affiliate_token');
    if (!token) {
      setError('Please log in to view call details');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/affiliates/calls/${callId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch call details');
        return;
      }

      setCall(data.data);
    } catch (err) {
      setError('Failed to load call details. Please try again.');
      console.error('Error fetching call:', err);
    } finally {
      setLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    fetchCall();
  }, [fetchCall]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
            <span className="ml-3 text-gray-500">Loading call details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="bg-red-50 rounded-xl p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Call</h3>
          <p className="text-red-600">{error || 'Call not found'}</p>
          <Button className="mt-4" onClick={() => router.push('/affiliate/calls')}>
            Back to Calls
          </Button>
        </div>
      </div>
    );
  }

  // Build info items for AdminInfoGrid
  const callInfoItems: InfoItem[] = [
    {
      label: 'Caller Phone',
      value: formatPhoneNumber(call.callerPhone, call.callerPhoneDisplay),
      icon: Phone
    },
    {
      label: 'Location',
      value: [call.callerCity, call.callerState, call.callerZip].filter(Boolean).join(', ') || 'Unknown',
      icon: MapPin
    },
    {
      label: 'Date & Time',
      value: formatDate(call.createdAt),
      icon: Calendar
    },
    {
      label: 'Duration',
      value: formatDuration(call.connectedDurationSeconds),
      icon: Clock
    },
    {
      label: 'Campaign',
      value: call.campaign?.name || 'Unknown'
    },
    {
      label: 'Service',
      value: call.campaign?.serviceType.displayName || 'Unknown'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Call Details</h1>
            <p className="text-sm text-gray-500">
              {formatTimeAgo(call.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AdminBadge color={getStatusColor(call.status)}>
            {call.status.replace(/_/g, ' ')}
          </AdminBadge>
          {call.isBillable && (
            <AdminBadge color="green">
              <DollarSign className="h-3 w-3 mr-1" />
              {call.affiliatePayout ? formatCurrency(call.affiliatePayout) : 'Qualified'}
            </AdminBadge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Call Info */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Call Information</h2>
            <AdminInfoGrid items={callInfoItems} columns={2} />
          </div>

          {/* Recording Player */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recording</h2>
            <RecordingPlayer
              recordingUrl={call.recordingUrl}
              recordingStatus={call.recordingStatus}
              duration={call.recordingDurationSeconds || call.connectedDurationSeconds || 0}
              callId={call.id}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payout Details */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payout Details</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status</span>
                <AdminBadge color={call.isBillable ? 'green' : 'gray'}>
                  {call.isBillable ? 'Qualified' : 'Not Qualified'}
                </AdminBadge>
              </div>
              {call.isBillable && call.affiliatePayout && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Payout</span>
                  <span className="text-xl font-bold text-emerald-600">
                    {formatCurrency(call.affiliatePayout)}
                  </span>
                </div>
              )}
              {call.campaign && (
                <>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-gray-500">Min Duration</span>
                    <span className="text-gray-900">
                      {formatDuration(call.campaign.minCallDuration)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Connected</span>
                    <span className={`font-medium ${
                      (call.connectedDurationSeconds || 0) >= call.campaign.minCallDuration
                        ? 'text-emerald-600'
                        : 'text-gray-500'
                    }`}>
                      {formatDuration(call.connectedDurationSeconds)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Activity Timeline */}
          {call.activityLog.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity</h2>
              <div className="space-y-3">
                {call.activityLog.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getActivityIcon(activity.level)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.message}</p>
                      <p className="text-xs text-gray-500">
                        {formatTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tracking Number Info */}
          {call.trackingNumber && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tracking Number</h2>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="font-mono text-gray-900">
                  {formatPhoneNumber(
                    call.trackingNumber.phoneNumber,
                    call.trackingNumber.phoneNumberDisplay
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
