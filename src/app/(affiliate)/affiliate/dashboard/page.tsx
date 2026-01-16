'use client';

/**
 * Affiliate Dashboard Page
 *
 * WHY: Main landing page for authenticated affiliates showing performance overview.
 *      Combines lead stats with call stats for unified earnings view.
 *
 * WHEN: After affiliate logs in, this is their home page.
 *
 * HOW: Fetches stats from API, displays dashboard cards, quick link generator,
 *      recent calls section, and recent activity.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardStats } from '@/components/affiliate/DashboardStats';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { Button } from '@/components/ui/Button';
import {
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
  Phone,
  Play,
  Clock
} from 'lucide-react';

interface StatsData {
  // Lead stats
  totalEarnings: number;
  pendingEarnings: number;
  availableBalance: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  // Call stats
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
  callEarningsToday: number;
  callEarningsThisWeek: number;
  callEarningsThisMonth: number;
  qualifiedCallsToday: number;
  qualifiedCallsThisWeek: number;
  qualifiedCallsThisMonth: number;
}

interface AffiliateLink {
  id: string;
  name: string;
  code: string;
  clicks: number;
  conversions: number;
}

interface RecentCall {
  id: string;
  createdAt: string;
  callerPhone: string;
  status: string;
  isBillable: boolean;
  affiliatePayout: number | null;
  connectedDurationSeconds: number | null;
  recordingStatus: string;
  campaign: { name: string } | null;
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
 * WHY: Mask phone number for privacy.
 * WHEN: Displaying caller phone in recent calls.
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

export default function AffiliateDashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('affiliate_token');
      if (!token) return;

      try {
        // Fetch stats, links, and recent calls in parallel
        const [statsRes, linksRes, callsRes] = await Promise.all([
          fetch('/api/affiliates/stats', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch('/api/affiliates/links?limit=5', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch('/api/affiliates/calls?limit=5', {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const [statsData, linksData, callsData] = await Promise.all([
          statsRes.json(),
          linksRes.json(),
          callsRes.json()
        ]);

        if (statsData.success) {
          // Merge lead stats with call stats
          const leadStats = statsData.data;

          // Fetch call stats separately
          const callStatsRes = await fetch('/api/affiliates/calls/stats', {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null);

          let callStats = {
            callsToday: 0,
            callsThisWeek: 0,
            callsThisMonth: 0,
            callEarningsToday: 0,
            callEarningsThisWeek: 0,
            callEarningsThisMonth: 0,
            qualifiedCallsToday: 0,
            qualifiedCallsThisWeek: 0,
            qualifiedCallsThisMonth: 0
          };

          if (callStatsRes) {
            const callStatsData = await callStatsRes.json().catch(() => ({ success: false }));
            if (callStatsData.success) {
              callStats = callStatsData.data;
            }
          }

          // If call stats endpoint doesn't exist, calculate from recent calls
          if (callsData.success && callsData.data) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const todayCalls = callsData.data.filter(
              (c: RecentCall) => new Date(c.createdAt) >= todayStart
            );

            callStats.callsToday = todayCalls.length;
            callStats.qualifiedCallsToday = todayCalls.filter((c: RecentCall) => c.isBillable).length;
            callStats.callEarningsToday = todayCalls
              .filter((c: RecentCall) => c.isBillable && c.affiliatePayout)
              .reduce((sum: number, c: RecentCall) => sum + (c.affiliatePayout || 0), 0);
          }

          setStats({
            ...leadStats,
            ...callStats
          });
        }

        if (linksData.success) {
          setLinks(linksData.data);
        }

        if (callsData.success) {
          setRecentCalls(callsData.data.slice(0, 5));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const copyToClipboard = async (link: AffiliateLink) => {
    const url = `${window.location.origin}?ref=${link.code}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview with Call Stats */}
      <DashboardStats stats={stats} loading={loading} showCallStats={true} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Links Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Your Links</h3>
            <Link href="/affiliate/links">
              <Button variant="outline" size="sm">
                <LinkIcon className="h-4 w-4 mr-1" />
                Manage Links
              </Button>
            </Link>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center justify-between">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-8 bg-gray-200 rounded w-24"></div>
                  </div>
                ))}
              </div>
            ) : links.length === 0 ? (
              <div className="text-center py-6">
                <LinkIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No tracking links yet</p>
                <Link href="/affiliate/links">
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    Create Your First Link
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{link.name}</p>
                      <p className="text-sm text-gray-500">
                        {link.clicks} clicks - {link.conversions} conversions
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(link)}>
                      {copiedId === link.id ? (
                        <>
                          <Check className="h-4 w-4 mr-1 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Calls Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Calls</h3>
            <Link href="/affiliate/calls">
              <Button variant="outline" size="sm">
                <Phone className="h-4 w-4 mr-1" />
                View All
              </Button>
            </Link>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center justify-between">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-8 bg-gray-200 rounded w-24"></div>
                  </div>
                ))}
              </div>
            ) : recentCalls.length === 0 ? (
              <div className="text-center py-6">
                <Phone className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No calls yet</p>
                <Link href="/affiliate/campaigns">
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    Get Tracking Numbers
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCalls.map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => router.push(`/affiliate/calls/${call.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <Phone className="h-4 w-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {maskPhoneNumber(call.callerPhone)}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {formatDuration(call.connectedDurationSeconds)}
                          {call.campaign && (
                            <span className="text-gray-400">- {call.campaign.name}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {call.isBillable && call.affiliatePayout ? (
                        <AdminBadge color="green">{formatCurrency(call.affiliatePayout)}</AdminBadge>
                      ) : (
                        <AdminBadge color="gray">{call.status.replace(/_/g, ' ')}</AdminBadge>
                      )}
                      {call.recordingStatus === 'AVAILABLE' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-emerald-600 p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/affiliate/calls/${call.id}`);
                          }}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Quick Actions</h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/affiliate/links" className="block">
              <div className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 bg-emerald-100 rounded-lg p-3">
                  <LinkIcon className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="ml-4">
                  <p className="font-medium text-gray-900">Create Link</p>
                  <p className="text-sm text-gray-500">Generate tracking link</p>
                </div>
                <ExternalLink className="h-5 w-5 text-gray-400 ml-auto" />
              </div>
            </Link>

            <Link href="/affiliate/campaigns" className="block">
              <div className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 bg-orange-100 rounded-lg p-3">
                  <Phone className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="font-medium text-gray-900">Campaigns</p>
                  <p className="text-sm text-gray-500">Get tracking numbers</p>
                </div>
                <ExternalLink className="h-5 w-5 text-gray-400 ml-auto" />
              </div>
            </Link>

            <Link href="/affiliate/withdrawals" className="block">
              <div className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                  <svg
                    className="h-6 w-6 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="font-medium text-gray-900">Withdraw</p>
                  <p className="text-sm text-gray-500">
                    {stats && stats.availableBalance >= 50
                      ? `$${stats.availableBalance.toFixed(2)} available`
                      : 'Minimum $50 required'}
                  </p>
                </div>
                <ExternalLink className="h-5 w-5 text-gray-400 ml-auto" />
              </div>
            </Link>

            <Link href="/affiliate/settings" className="block">
              <div className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 bg-gray-100 rounded-lg p-3">
                  <svg
                    className="h-6 w-6 text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="font-medium text-gray-900">Settings</p>
                  <p className="text-sm text-gray-500">Manage your profile</p>
                </div>
                <ExternalLink className="h-5 w-5 text-gray-400 ml-auto" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
