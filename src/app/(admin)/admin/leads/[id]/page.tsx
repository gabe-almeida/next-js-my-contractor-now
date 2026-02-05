'use client';

/**
 * Lead Detail Page
 *
 * WHY: Provides a dedicated page view for individual leads, enabling deep linking
 *      from emails, buyer activity tabs, and other referrers.
 *
 * WHEN: Accessed via /admin/leads/[id] URL directly or from links throughout the admin UI.
 *
 * HOW: Fetches lead details from API and displays using the same layout as LeadDetailModal
 *      but in a full-page format with navigation back to leads list.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader,
  AlertCircle,
  RefreshCw,
  FileText,
  DollarSign,
  Clock,
  User,
  MapPin,
  Home,
  CheckCircle,
  XCircle,
  Shield,
  TrendingUp,
  Globe,
  MousePointer,
  Activity,
  Eye,
  X,
  Trophy,
  Ban
} from 'lucide-react';
import { LeadStatusHistory } from '@/components/admin/LeadStatusHistory';
import { ChangeStatusModal } from '@/components/admin/ChangeStatusModal';
import { IssueCreditModal } from '@/components/admin/IssueCreditModal';
import { Button } from '@/components/ui/Button';
import { AdminPageHeader } from '@/components/admin/ui';

const ADMIN_USER_ID = 'admin-user-1';

interface AttributionData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  gclid?: string;
  wbraid?: string;
  gbraid?: string;
  msclkid?: string;
  ttclid?: string;
  li_fat_id?: string;
  twclid?: string;
  rdt_cid?: string;
  irclickid?: string;
  _ga?: string;
  _gid?: string;
  landing_page?: string;
  referrer?: string;
  referrer_domain?: string;
  first_touch_timestamp?: string;
  session_id?: string;
  raw_query_params?: Record<string, string>;
}

interface TransactionItem {
  id: string;
  buyerId: string;
  buyerName: string | null;
  actionType: 'PING' | 'POST' | 'PING_WEBHOOK' | 'POST_WEBHOOK' | 'STATUS_UPDATE';
  status: string;
  bidAmount: number | null;
  responseTime: number | null;
  errorMessage: string | null;
  payload: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
  isWinner: boolean | null;
  lostReason: string | null;
  cascadePosition: number | null;
  createdAt: string;
}

interface AuctionResults {
  winningBuyerId: string;
  winningBid: number;
  allBids: Array<{
    buyerId: string;
    bid: number;
    accepted: boolean;
    responseTime: number | null;
  }>;
  totalResponseTime: number;
  status: string;
}

interface LeadDetail {
  id: string;
  serviceType: {
    id: string;
    name: string;
    displayName: string;
  };
  status: string;
  disposition?: string;
  formData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    zipCode: string;
    ownsHome: boolean;
    timeframe: string;
  };
  winningBuyer?: {
    id: string;
    name: string;
  };
  winningBid?: number;
  creditAmount?: number;
  creditIssuedAt?: string;
  compliance: {
    trustedFormCertUrl?: string;
    trustedFormCertId?: string;
    jornayaLeadId?: string;
    leadQualityScore?: number;
    complianceData?: {
      ipAddress?: string;
      userAgent?: string;
      attribution?: AttributionData;
    };
  };
  transactions?: TransactionItem[];
  auctionResults?: AuctionResults | null;
  createdAt: string;
  updatedAt: string;
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChangeStatus, setShowChangeStatus] = useState(false);
  const [showIssueCredit, setShowIssueCredit] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionItem | null>(null);
  const [activePayloadTab, setActivePayloadTab] = useState<'request' | 'response'>('request');

  const fetchLeadDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/leads/${leadId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Lead not found');
        }
        throw new Error('Failed to fetch lead details');
      }

      const data = await response.json();
      setLead(data.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchLeadDetails();
  }, [fetchLeadDetails]);

  const handleStatusChangeSuccess = () => {
    setShowChangeStatus(false);
    fetchLeadDetails();
    setHistoryKey(prev => prev + 1);
  };

  const handleCreditSuccess = () => {
    setShowIssueCredit(false);
    fetchLeadDetails();
    setHistoryKey(prev => prev + 1);
  };

  const canIssueCredit = lead?.disposition === 'RETURNED' || lead?.disposition === 'DISPUTED';

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      SOLD: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      EXPIRED: 'bg-gray-100 text-gray-800',
      SCRUBBED: 'bg-red-100 text-red-800',
      DUPLICATE: 'bg-orange-100 text-orange-800',
      DELIVERY_FAILED: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getDispositionColor = (disposition: string) => {
    const colors: Record<string, string> = {
      NEW: 'bg-gray-100 text-gray-700',
      DELIVERED: 'bg-green-100 text-green-700',
      RETURNED: 'bg-yellow-100 text-yellow-700',
      DISPUTED: 'bg-orange-100 text-orange-700',
      CREDITED: 'bg-blue-100 text-blue-700',
      WRITTEN_OFF: 'bg-red-100 text-red-700'
    };
    return colors[disposition] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Link
          href="/admin/leads"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Leads
        </Link>
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-lg shadow">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchLeadDetails}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header with back navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/admin/leads"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Leads
          </Link>
          <div className="border-l border-gray-300 h-6" />
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Lead Details</h1>
              <p className="text-sm text-gray-500 font-mono">{leadId}</p>
            </div>
          </div>
        </div>
        <button
          onClick={fetchLeadDetails}
          className="p-2 text-gray-400 hover:text-gray-600 rounded"
          title="Refresh"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status & Actions Bar */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <div>
            <span className="text-xs text-gray-500 block mb-1">Status</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(lead.status)}`}>
              {lead.status}
            </span>
          </div>
          {lead.disposition && (
            <div>
              <span className="text-xs text-gray-500 block mb-1">Disposition</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDispositionColor(lead.disposition)}`}>
                {lead.disposition}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowChangeStatus(true)}
          >
            Change Status
          </Button>
          {canIssueCredit && (
            <Button
              variant="default"
              onClick={() => setShowIssueCredit(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Issue Credit
            </Button>
          )}
        </div>
      </div>

      {/* Lead Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Customer & Service Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <User className="h-4 w-4 mr-2" />
              Customer Information
            </h4>
            <div className="space-y-2 text-sm">
              {lead.formData.firstName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium">
                    {lead.formData.firstName} {lead.formData.lastName}
                  </span>
                </div>
              )}
              {lead.formData.email && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium">{lead.formData.email}</span>
                </div>
              )}
              {lead.formData.phone && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone</span>
                  <span className="font-medium">{lead.formData.phone}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              Location & Timing
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ZIP Code</span>
                <span className="font-mono font-medium">{lead.formData.zipCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Homeowner</span>
                <span className="font-medium flex items-center">
                  {lead.formData.ownsHome ? (
                    <><Home className="h-3 w-3 mr-1 text-green-600" /> Yes</>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Timeframe</span>
                <span className="font-medium">{lead.formData.timeframe}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Compliance
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Quality Score</span>
                <span className="font-medium">
                  {lead.compliance.leadQualityScore ?? 'N/A'}
                </span>
              </div>

              {/* TrustedForm Section */}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-500">TrustedForm</span>
                  {lead.compliance.trustedFormCertId ? (
                    <span className="text-green-600 flex items-center text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Verified
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">Missing</span>
                  )}
                </div>
                {lead.compliance.trustedFormCertId && (
                  <div className="space-y-1 pl-2 border-l-2 border-green-200">
                    <div>
                      <span className="text-xs text-gray-400 block">Cert ID</span>
                      <span className="font-mono text-xs text-gray-700 break-all">
                        {lead.compliance.trustedFormCertId}
                      </span>
                    </div>
                    {lead.compliance.trustedFormCertUrl && (
                      <div>
                        <span className="text-xs text-gray-400 block">Cert URL</span>
                        <a
                          href={lead.compliance.trustedFormCertUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 break-all"
                        >
                          {lead.compliance.trustedFormCertUrl}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Jornaya Section */}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-500">Jornaya</span>
                  {lead.compliance.jornayaLeadId ? (
                    <span className="text-green-600 flex items-center text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Verified
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">Missing</span>
                  )}
                </div>
                {lead.compliance.jornayaLeadId && (
                  <div className="pl-2 border-l-2 border-green-200">
                    <span className="text-xs text-gray-400 block">Lead ID</span>
                    <span className="font-mono text-xs text-gray-700 break-all">
                      {lead.compliance.jornayaLeadId}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Auction & Financial Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Service & Auction
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Service Type</span>
                <span className="font-medium">{lead.serviceType.displayName || lead.serviceType.name}</span>
              </div>
              {lead.winningBuyer && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Winning Buyer</span>
                  <Link
                    href={`/admin/buyers/${lead.winningBuyer.id}`}
                    className="font-medium text-blue-600 hover:text-blue-800"
                  >
                    {lead.winningBuyer.name}
                  </Link>
                </div>
              )}
              {lead.winningBid && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Winning Bid</span>
                  <span className="font-medium text-green-600">${Number(lead.winningBid).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {lead.creditAmount && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center">
                <DollarSign className="h-4 w-4 mr-2" />
                Credit Issued
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-600">Amount</span>
                  <span className="font-bold text-blue-800">${Number(lead.creditAmount).toFixed(2)}</span>
                </div>
                {lead.creditIssuedAt && (
                  <div className="flex justify-between">
                    <span className="text-blue-600">Issued At</span>
                    <span className="text-blue-700">
                      {new Date(lead.creditIssuedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Timestamps
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="font-medium">
                  {new Date(lead.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Updated</span>
                <span className="font-medium">
                  {new Date(lead.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Marketing Attribution */}
      {(lead.compliance.complianceData?.attribution || lead.compliance.complianceData?.userAgent) && (
        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            Marketing Attribution
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Landing Page & Referrer */}
            {(lead.compliance.complianceData?.attribution?.landing_page ||
              lead.compliance.complianceData?.attribution?.referrer) && (
              <div className="space-y-2 text-sm col-span-full lg:col-span-2">
                <h5 className="font-medium text-gray-600 flex items-center">
                  <MousePointer className="h-3 w-3 mr-1" /> Traffic Source
                </h5>
                {lead.compliance.complianceData.attribution.landing_page && (
                  <div>
                    <span className="text-gray-500 block mb-1">Landing Page</span>
                    <a
                      href={lead.compliance.complianceData.attribution.landing_page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-blue-600 hover:text-blue-800 break-all"
                    >
                      {lead.compliance.complianceData.attribution.landing_page}
                    </a>
                  </div>
                )}
                {lead.compliance.complianceData.attribution.referrer && (
                  <div>
                    <span className="text-gray-500 block mb-1">Referrer</span>
                    <a
                      href={lead.compliance.complianceData.attribution.referrer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-blue-600 hover:text-blue-800 break-all"
                    >
                      {lead.compliance.complianceData.attribution.referrer}
                    </a>
                  </div>
                )}
                {lead.compliance.complianceData.attribution.referrer_domain && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Referrer Domain</span>
                    <span className="font-medium text-gray-700">
                      {lead.compliance.complianceData.attribution.referrer_domain}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Browser & Device Info */}
            {(lead.compliance.complianceData?.userAgent || lead.compliance.complianceData?.ipAddress) && (
              <div className="space-y-2 text-sm">
                <h5 className="font-medium text-gray-600 flex items-center">
                  <Activity className="h-3 w-3 mr-1" /> Browser & Device
                </h5>
                {lead.compliance.complianceData?.userAgent && (
                  <div>
                    <span className="text-gray-500 block mb-1">User Agent</span>
                    <span className="font-mono text-xs text-gray-700 break-all">
                      {lead.compliance.complianceData.userAgent}
                    </span>
                  </div>
                )}
                {lead.compliance.complianceData?.ipAddress && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">IP Address</span>
                    <span className="font-mono text-xs">
                      {lead.compliance.complianceData.ipAddress}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* UTM Parameters */}
            {(lead.compliance.complianceData?.attribution?.utm_source ||
              lead.compliance.complianceData?.attribution?.utm_medium ||
              lead.compliance.complianceData?.attribution?.utm_campaign) && (
              <div className="space-y-2 text-sm">
                <h5 className="font-medium text-gray-600 flex items-center">
                  <Globe className="h-3 w-3 mr-1" /> UTM Campaign Tracking
                </h5>
                {lead.compliance.complianceData.attribution.utm_source && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Source</span>
                    <span className="font-medium text-blue-600">
                      {lead.compliance.complianceData.attribution.utm_source}
                    </span>
                  </div>
                )}
                {lead.compliance.complianceData.attribution.utm_medium && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Medium</span>
                    <span className="font-medium">
                      {lead.compliance.complianceData.attribution.utm_medium}
                    </span>
                  </div>
                )}
                {lead.compliance.complianceData.attribution.utm_campaign && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Campaign</span>
                    <span className="font-medium">
                      {lead.compliance.complianceData.attribution.utm_campaign}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Ad Click IDs */}
            {(lead.compliance.complianceData?.attribution?.gclid ||
              lead.compliance.complianceData?.attribution?.fbclid ||
              lead.compliance.complianceData?.attribution?.msclkid) && (
              <div className="space-y-2 text-sm">
                <h5 className="font-medium text-gray-600">Ad Click IDs</h5>
                {lead.compliance.complianceData.attribution.gclid && (
                  <div>
                    <span className="text-gray-500 block">Google (gclid)</span>
                    <span className="font-mono text-xs text-gray-700 break-all">
                      {lead.compliance.complianceData.attribution.gclid}
                    </span>
                  </div>
                )}
                {lead.compliance.complianceData.attribution.fbclid && (
                  <div>
                    <span className="text-gray-500 block">Facebook (fbclid)</span>
                    <span className="font-mono text-xs text-gray-700 break-all">
                      {lead.compliance.complianceData.attribution.fbclid}
                    </span>
                  </div>
                )}
                {lead.compliance.complianceData.attribution.msclkid && (
                  <div>
                    <span className="text-gray-500 block">Microsoft (msclkid)</span>
                    <span className="font-mono text-xs text-gray-700 break-all">
                      {lead.compliance.complianceData.attribution.msclkid}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auction Participation / Transaction History */}
      {lead.transactions && lead.transactions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
            <Activity className="h-4 w-4 mr-2" />
            Auction Participation ({lead.transactions.length} transactions)
          </h4>

          {/* Auction Summary */}
          {lead.auctionResults && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 block">Total Bids</span>
                  <span className="font-semibold">{lead.auctionResults.allBids?.length || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Winning Bid</span>
                  <span className="font-semibold text-green-600">
                    {lead.auctionResults.winningBid ? `$${Number(lead.auctionResults.winningBid).toFixed(2)}` : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Total Response Time</span>
                  <span className="font-semibold">{lead.auctionResults.totalResponseTime}ms</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Auction Status</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    lead.auctionResults.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {lead.auctionResults.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Type</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Buyer</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Bid</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Response</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Result</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Time</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {lead.transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedTransaction(tx)}
                  >
                    <td className="py-2 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        tx.actionType === 'PING'
                          ? 'bg-blue-100 text-blue-800'
                          : tx.actionType === 'POST'
                          ? 'bg-purple-100 text-purple-800'
                          : tx.actionType === 'PING_WEBHOOK'
                          ? 'bg-cyan-100 text-cyan-800'
                          : tx.actionType === 'POST_WEBHOOK'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tx.actionType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <Link
                        href={`/admin/buyers/${tx.buyerId}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {tx.buyerName || tx.buyerId.slice(0, 8) + '...'}
                      </Link>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        tx.status === 'SUCCESS'
                          ? 'bg-green-100 text-green-800'
                          : tx.status === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : tx.status === 'REJECTED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {tx.status === 'SUCCESS' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {tx.status === 'FAILED' && <XCircle className="h-3 w-3 mr-1" />}
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-900">
                      {tx.bidAmount ? `$${Number(tx.bidAmount).toFixed(2)}` : '-'}
                    </td>
                    <td className="py-2 px-2 text-gray-600">
                      {tx.responseTime ? `${tx.responseTime}ms` : '-'}
                    </td>
                    <td className="py-2 px-2">
                      {tx.isWinner === true ? (
                        <span className="inline-flex items-center text-green-600" title="Won auction">
                          <Trophy className="h-4 w-4" />
                        </span>
                      ) : tx.isWinner === false ? (
                        <span className="inline-flex items-center text-gray-400" title={tx.lostReason || 'Lost'}>
                          <Ban className="h-4 w-4" />
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-gray-500 text-xs">
                      {new Date(tx.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTransaction(tx);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 rounded"
                        title="View payload details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Click any row to view the full request payload and response
          </p>
        </div>
      )}

      {/* Status History */}
      <div className="bg-white rounded-lg shadow p-4">
        <LeadStatusHistory
          key={historyKey}
          leadId={leadId}
          onRefresh={() => setHistoryKey(prev => prev + 1)}
        />
      </div>

      {/* Nested Modals */}
      {showChangeStatus && (
        <ChangeStatusModal
          leadId={leadId}
          currentStatus={lead.status}
          currentDisposition={lead.disposition || 'NEW'}
          adminUserId={ADMIN_USER_ID}
          onClose={() => setShowChangeStatus(false)}
          onSuccess={handleStatusChangeSuccess}
        />
      )}

      {showIssueCredit && (
        <IssueCreditModal
          leadId={leadId}
          currentDisposition={lead.disposition || 'NEW'}
          originalBid={lead.winningBid || null}
          adminUserId={ADMIN_USER_ID}
          onClose={() => setShowIssueCredit(false)}
          onSuccess={handleCreditSuccess}
        />
      )}

      {/* Transaction Payload Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium ${
                  selectedTransaction.actionType === 'PING'
                    ? 'bg-blue-100 text-blue-800'
                    : selectedTransaction.actionType === 'POST'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {selectedTransaction.actionType}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Transaction Details
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedTransaction.buyerName || selectedTransaction.buyerId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Transaction Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500 block">Status</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-medium mt-1 ${
                    selectedTransaction.status === 'SUCCESS'
                      ? 'bg-green-100 text-green-800'
                      : selectedTransaction.status === 'FAILED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedTransaction.status}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500 block">Bid Amount</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {selectedTransaction.bidAmount ? `$${Number(selectedTransaction.bidAmount).toFixed(2)}` : '-'}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500 block">Response Time</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {selectedTransaction.responseTime ? `${selectedTransaction.responseTime}ms` : '-'}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500 block">Result</span>
                  {selectedTransaction.isWinner === true ? (
                    <span className="inline-flex items-center text-green-600 font-semibold mt-1">
                      <Trophy className="h-4 w-4 mr-1" /> Won
                    </span>
                  ) : selectedTransaction.isWinner === false ? (
                    <span className="inline-flex items-center text-gray-500 mt-1">
                      <Ban className="h-4 w-4 mr-1" /> {selectedTransaction.lostReason || 'Lost'}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {selectedTransaction.errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-xs text-red-600 font-medium block mb-1">Error Message</span>
                  <span className="text-sm text-red-700">{selectedTransaction.errorMessage}</span>
                </div>
              )}

              {/* Cascade Position */}
              {selectedTransaction.cascadePosition && selectedTransaction.cascadePosition > 1 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <span className="text-xs text-yellow-700">
                    Cascade Position: {selectedTransaction.cascadePosition} (fallback attempt)
                  </span>
                </div>
              )}

              {/* Tabs for Request/Response */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActivePayloadTab('request')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activePayloadTab === 'request'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Request Payload
                </button>
                <button
                  onClick={() => setActivePayloadTab('response')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activePayloadTab === 'response'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Response
                </button>
              </div>

              {/* Payload/Response Content */}
              {activePayloadTab === 'request' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Request sent to buyer
                    </span>
                    {selectedTransaction.payload && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(selectedTransaction.payload, null, 2));
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Copy to clipboard
                      </button>
                    )}
                  </div>
                  <pre className="bg-gray-900 text-emerald-400 p-4 rounded-lg text-xs overflow-x-auto max-h-96 font-mono">
                    {selectedTransaction.payload
                      ? JSON.stringify(selectedTransaction.payload, null, 2)
                      : 'No request payload captured'}
                  </pre>
                </div>
              )}

              {activePayloadTab === 'response' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Response from buyer
                    </span>
                    {selectedTransaction.response && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(selectedTransaction.response, null, 2));
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Copy to clipboard
                      </button>
                    )}
                  </div>
                  <pre className="bg-gray-900 text-emerald-400 p-4 rounded-lg text-xs overflow-x-auto max-h-96 font-mono">
                    {selectedTransaction.response
                      ? JSON.stringify(selectedTransaction.response, null, 2)
                      : selectedTransaction.errorMessage
                      ? JSON.stringify({ error: selectedTransaction.errorMessage }, null, 2)
                      : 'No response captured'}
                  </pre>
                </div>
              )}

              {/* Timestamp */}
              <div className="mt-4 text-xs text-gray-500">
                Transaction time: {new Date(selectedTransaction.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
