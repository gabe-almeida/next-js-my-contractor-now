'use client';

/**
 * Affiliate Dashboard Page
 *
 * WHY: Main landing page for authenticated affiliates showing performance overview.
 * WHEN: After affiliate logs in, this is their home page.
 * HOW: Fetches stats from API, displays dashboard cards, quick link generator,
 *      and recent activity.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardStats } from '@/components/affiliate/DashboardStats';
import { Button } from '@/components/ui/Button';
import { Link as LinkIcon, Copy, Check, ExternalLink } from 'lucide-react';

interface StatsData {
  totalEarnings: number;
  pendingEarnings: number;
  availableBalance: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
}

interface AffiliateLink {
  id: string;
  name: string;
  code: string;
  clicks: number;
  conversions: number;
}

export default function AffiliateDashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('affiliate_token');
      if (!token) return;

      try {
        // Fetch stats and links in parallel
        const [statsRes, linksRes] = await Promise.all([
          fetch('/api/affiliates/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('/api/affiliates/links?limit=5', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        const [statsData, linksData] = await Promise.all([
          statsRes.json(),
          linksRes.json()
        ]);

        if (statsData.success) {
          setStats(statsData.data);
        }

        if (linksData.success) {
          setLinks(linksData.data);
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
      {/* Stats Overview */}
      <DashboardStats stats={stats} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Links Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Your Links
            </h3>
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
                        {link.clicks} clicks · {link.conversions} conversions
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(link)}
                    >
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

        {/* Quick Actions Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Quick Actions
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6 space-y-4">
            <Link href="/affiliate/links" className="block">
              <div className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 bg-emerald-100 rounded-lg p-3">
                  <LinkIcon className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="ml-4">
                  <p className="font-medium text-gray-900">Create New Link</p>
                  <p className="text-sm text-gray-500">
                    Generate a new tracking link for your campaigns
                  </p>
                </div>
                <ExternalLink className="h-5 w-5 text-gray-400 ml-auto" />
              </div>
            </Link>

            <Link href="/affiliate/withdrawals" className="block">
              <div className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="font-medium text-gray-900">Request Withdrawal</p>
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
                  <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="font-medium text-gray-900">Update Profile</p>
                  <p className="text-sm text-gray-500">
                    Manage your payment methods and settings
                  </p>
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
