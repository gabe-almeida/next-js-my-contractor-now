'use client';

/**
 * Admin Call Detail Page
 *
 * WHY: Shows comprehensive call audit trail including all bids, response times,
 *      cascade attempts, PING responses, and activity timeline.
 * WHEN: Admin clicks on a call from the calls list.
 * HOW: Fetches full call detail from API, displays in organized sections.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminInfoGrid, InfoItem } from '@/components/admin/ui/AdminInfoGrid';
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
  Info,
  Trophy,
  Users,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';

interface CallBid {
  rank: number;
  buyerId: string;
  buyerName: string;
  buyerType: string;
  bidAmount: number;
  responseTimeMs: number | null;
  bidStatus: string;
  transferNumber: string | null;
  isWinner: boolean;
  pingResponse: {
    bidId: string;
    expireInSeconds: number;
    expiresAt: string;
    phoneNumber: string;
    bidTerms: any[];
    warnings: any[];
    rawResponse: any;
  } | null;
  createdAt: string;
}

interface CallDetail {
  id: string;
  twilioCallSid: string;
  status: string;
  previousStatus: string | null;
  disposition: string | null;
  hangupReason: string | null;
  caller: {
    phone: string;
    phoneDisplay: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    name: string | null;
  };
  ivr: {
    responses: any;
    isQualified: boolean;
    completedAt: string | null;
  };
  source: {
    campaign: { id: string; name: string; minCallDuration: number; callBasePayout: number | null } | null;
    serviceType: { id: string; name: string; displayName: string } | null;
    trackingNumber: { id: string; phoneNumber: string; phoneNumberDisplay: string | null } | null;
    affiliate: { id: string; companyName: string; contactEmail: string } | null;
  };
  auction: {
    eligibleBuyersCount: number;
    bidsReceived: number;
    auctionDurationMs: number | null;
    auctionStartedAt: string | null;
    auctionCompletedAt: string | null;
    winningBid: number | null;
    winnerName: string | null;
    winnerId: string | null;
  };
  bids: CallBid[];
  cascade: {
    position: number;
    attempts: number;
    maxDepth: number;
  };
  timing: {
    createdAt: string;
    answeredAt: string | null;
    ivrCompletedAt: string | null;
    auctionStartedAt: string | null;
    auctionCompletedAt: string | null;
    connectedAt: string | null;
    buyerAnsweredAt: string | null;
    endedAt: string | null;
    totalDurationSeconds: number | null;
    connectedDurationSeconds: number | null;
    buyerRingDurationSeconds: number | null;
    recordingDurationSeconds: number | null;
  };
  recording: {
    sid: string | null;
    url: string | null;
    status: string;
    durationSeconds: number | null;
  };
  financials: {
    isBillable: boolean;
    buyerCharge: number | null;
    affiliatePayout: number | null;
    platformMargin: number | null;
  };
  postback: {
    sent: boolean;
    sentAt: string | null;
    response: string | null;
  };
  abandonment: {
    phase: string | null;
    reason: string | null;
  };
  activityLog: {
    id: string;
    timestamp: string;
    event: string;
    message: string;
    level: string;
    details: any;
  }[];
  createdAt: string;
  updatedAt: string;
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

function formatCurrency(amount: number | null): string {
  if (!amount) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date(dateStr));
}

function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date(dateStr));
}

function getStatusColor(status: string): 'green' | 'red' | 'yellow' | 'gray' | 'blue' {
  const colors: Record<string, 'green' | 'red' | 'yellow' | 'gray' | 'blue'> = {
    COMPLETED: 'green',
    CONNECTED: 'green',
    BIDDING: 'blue',
    CONNECTING: 'blue',
    CASCADING: 'yellow',
    NO_ANSWER: 'yellow',
    CALLER_HANGUP: 'gray',
    NO_BIDS: 'gray',
    FAILED: 'red',
    REJECTED: 'red',
  };
  return colors[status] || 'gray';
}

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

function getBidStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACCEPTED: 'bg-green-100 text-green-700',
    PENDING: 'bg-blue-100 text-blue-700',
    REJECTED: 'bg-red-100 text-red-700',
    EXPIRED: 'bg-gray-100 text-gray-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

export default function AdminCallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.id as string;

  const [call, setCall] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBid, setExpandedBid] = useState<string | null>(null);

  const fetchCall = useCallback(async () => {
    const adminToken = localStorage.getItem('admin_token');
    if (!adminToken) {
      setError('Please log in to view call details');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/calls/${callId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
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
          <Button className="mt-4" onClick={() => router.push('/admin/calls')}>
            Back to Calls
          </Button>
        </div>
      </div>
    );
  }

  const callerInfoItems: InfoItem[] = [
    { label: 'Phone', value: formatPhoneNumber(call.caller.phone, call.caller.phoneDisplay), icon: Phone },
    { label: 'Location', value: [call.caller.city, call.caller.state, call.caller.zip].filter(Boolean).join(', ') || 'Unknown', icon: MapPin },
    { label: 'CNAM', value: call.caller.name || 'Not available' },
    { label: 'Twilio SID', value: call.twilioCallSid },
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
            <h1 className="text-xl font-semibold text-gray-900">Call Detail</h1>
            <p className="text-sm text-gray-500">{formatDate(call.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AdminBadge color={getStatusColor(call.status)}>{call.status.replace(/_/g, ' ')}</AdminBadge>
          {call.financials.isBillable && (
            <AdminBadge color="green">
              <DollarSign className="h-3 w-3 mr-1" />
              Billable
            </AdminBadge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Caller Info */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Caller Information</h2>
            <AdminInfoGrid items={callerInfoItems} columns={2} />
          </div>

          {/* Auction Summary */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Auction Results</h2>
              {call.auction.auctionDurationMs && (
                <span className="text-sm text-gray-500">
                  <Clock className="h-4 w-4 inline mr-1" />
                  {call.auction.auctionDurationMs}ms
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">{call.auction.eligibleBuyersCount}</div>
                <div className="text-xs text-gray-500">Eligible Buyers</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">{call.auction.bidsReceived}</div>
                <div className="text-xs text-gray-500">Bids Received</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-600">{formatCurrency(call.auction.winningBid)}</div>
                <div className="text-xs text-gray-500">Winning Bid</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{call.cascade.attempts}</div>
                <div className="text-xs text-gray-500">Cascade Attempts</div>
              </div>
            </div>

            {/* Bids Table */}
            <h3 className="text-sm font-semibold text-gray-700 mb-3">All Bids (Ranked by Amount)</h3>
            <div className="space-y-2">
              {call.bids.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No bids received</p>
              ) : (
                call.bids.map((bid) => (
                  <div
                    key={bid.buyerId}
                    className={`border rounded-lg ${bid.isWinner ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}
                  >
                    <div
                      className="p-3 flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedBid(expandedBid === bid.buyerId ? null : bid.buyerId)}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            bid.rank === 1
                              ? 'bg-yellow-100 text-yellow-700'
                              : bid.rank === 2
                              ? 'bg-gray-200 text-gray-700'
                              : bid.rank === 3
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {bid.rank}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{bid.buyerName}</span>
                            {bid.isWinner && <Trophy className="h-4 w-4 text-yellow-500" />}
                          </div>
                          <div className="text-xs text-gray-500">
                            {bid.buyerType} {bid.responseTimeMs !== null && `• ${bid.responseTimeMs}ms response`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBidStatusColor(bid.bidStatus)}`}>
                          {bid.bidStatus}
                        </span>
                        <span className="font-semibold text-emerald-600">{formatCurrency(bid.bidAmount)}</span>
                        {bid.pingResponse ? (
                          expandedBid === bid.buyerId ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )
                        ) : null}
                      </div>
                    </div>

                    {/* Expanded PING Response */}
                    {expandedBid === bid.buyerId && bid.pingResponse && (
                      <div className="px-3 pb-3 border-t border-gray-200 mt-2 pt-3">
                        <h4 className="text-xs font-semibold text-gray-700 mb-2">PING Response Details</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Bid ID:</span>
                            <span className="ml-2 font-mono text-gray-700">{bid.pingResponse.bidId || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Transfer #:</span>
                            <span className="ml-2 font-mono text-gray-700">{bid.transferNumber || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Expires In:</span>
                            <span className="ml-2 text-gray-700">{bid.pingResponse.expireInSeconds}s</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Expires At:</span>
                            <span className="ml-2 text-gray-700">{formatDate(bid.pingResponse.expiresAt)}</span>
                          </div>
                        </div>
                        {bid.pingResponse.bidTerms && bid.pingResponse.bidTerms.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-500">Bid Terms:</span>
                            <div className="mt-1 space-y-1">
                              {bid.pingResponse.bidTerms.map((term: any, i: number) => (
                                <div key={i} className="text-xs bg-gray-100 rounded px-2 py-1">
                                  {term.description || JSON.stringify(term)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {bid.pingResponse.rawResponse && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer">Raw Response</summary>
                            <pre className="mt-1 text-xs bg-gray-100 rounded p-2 overflow-x-auto">
                              {JSON.stringify(bid.pingResponse.rawResponse, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recording */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recording</h2>
            <RecordingPlayer
              recordingUrl={call.recording.url}
              recordingStatus={call.recording.status}
              duration={call.recording.durationSeconds || call.timing.connectedDurationSeconds || 0}
              callId={call.id}
            />
          </div>

          {/* Timing Breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Call Timeline</h2>
            <div className="space-y-3">
              {[
                { label: 'Call Received', time: call.timing.createdAt, icon: Phone },
                { label: 'Answered (IVR)', time: call.timing.answeredAt, icon: Phone },
                { label: 'IVR Completed', time: call.timing.ivrCompletedAt, icon: CheckCircle },
                { label: 'Auction Started', time: call.timing.auctionStartedAt, icon: Zap },
                { label: 'Auction Completed', time: call.timing.auctionCompletedAt, icon: Trophy },
                { label: 'Connected to Buyer', time: call.timing.connectedAt, icon: Users },
                { label: 'Buyer Answered', time: call.timing.buyerAnsweredAt, icon: CheckCircle },
                { label: 'Call Ended', time: call.timing.endedAt, icon: XCircle },
              ]
                .filter((item) => item.time)
                .map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600 w-40">{item.label}</span>
                    <span className="text-sm font-mono text-gray-900">{formatTime(item.time!)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Sidebar - Right 1/3 */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Financials</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status</span>
                <AdminBadge color={call.financials.isBillable ? 'green' : 'gray'}>
                  {call.financials.isBillable ? 'Billable' : 'Not Billable'}
                </AdminBadge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Buyer Charge</span>
                <span className="text-xl font-bold text-blue-600">{formatCurrency(call.financials.buyerCharge)}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-4">
                <span className="text-gray-500">Affiliate Payout</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(call.financials.affiliatePayout)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Platform Margin</span>
                <span className="font-semibold text-purple-600">{formatCurrency(call.financials.platformMargin)}</span>
              </div>
            </div>
          </div>

          {/* Duration Stats */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Duration</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Duration</span>
                <span className="font-medium">{formatDuration(call.timing.totalDurationSeconds)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Connected Duration</span>
                <span className="font-medium text-emerald-600">{formatDuration(call.timing.connectedDurationSeconds)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Buyer Ring Time</span>
                <span className="font-medium">{formatDuration(call.timing.buyerRingDurationSeconds)}</span>
              </div>
              {call.source.campaign?.minCallDuration && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-500">Min Required</span>
                  <span className="font-medium">{formatDuration(call.source.campaign.minCallDuration)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Source Info */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Source</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Campaign</span>
                <div className="font-medium">{call.source.campaign?.name || 'Unknown'}</div>
              </div>
              <div>
                <span className="text-gray-500">Service</span>
                <div className="font-medium">{call.source.serviceType?.displayName || 'Unknown'}</div>
              </div>
              <div>
                <span className="text-gray-500">Affiliate</span>
                <div className="font-medium">{call.source.affiliate?.companyName || 'Unknown'}</div>
              </div>
              <div>
                <span className="text-gray-500">Tracking Number</span>
                <div className="font-mono text-xs">
                  {call.source.trackingNumber
                    ? formatPhoneNumber(call.source.trackingNumber.phoneNumber, call.source.trackingNumber.phoneNumberDisplay)
                    : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          {call.activityLog.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Log</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {call.activityLog.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">{getActivityIcon(activity.level)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.message}</p>
                      <p className="text-xs text-gray-500">{formatTime(activity.timestamp)}</p>
                      {activity.details && (
                        <details className="mt-1">
                          <summary className="text-xs text-gray-400 cursor-pointer">Details</summary>
                          <pre className="text-xs bg-gray-50 rounded p-1 mt-1 overflow-x-auto">
                            {JSON.stringify(activity.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
