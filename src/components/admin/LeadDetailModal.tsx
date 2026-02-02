'use client';

/**
 * Lead Detail Modal Component
 *
 * WHY: Provides a comprehensive view of a single lead with all actions
 *      admins need: view history, change status, issue credits.
 *
 * WHEN: Opened when admin clicks "View" on a lead in the LeadTable.
 *
 * HOW: Fetches lead details from API and integrates child components
 *      for status history, status changes, and credit issuance.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
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
  ChevronDown,
  ChevronRight,
  Trophy,
  Ban,
  Copy
} from 'lucide-react';
import { LeadStatusHistory } from './LeadStatusHistory';
import { ChangeStatusModal } from './ChangeStatusModal';
import { IssueCreditModal } from './IssueCreditModal';
import { Button } from '@/components/ui/Button';

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

interface LeadDetailModalProps {
  leadId: string;
  adminUserId: string;
  onClose: () => void;
  onLeadUpdated?: () => void;
}

export function LeadDetailModal({
  leadId,
  adminUserId,
  onClose,
  onLeadUpdated
}: LeadDetailModalProps) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChangeStatus, setShowChangeStatus] = useState(false);
  const [showIssueCredit, setShowIssueCredit] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set());

  const toggleTransaction = (txId: string) => {
    setExpandedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txId)) {
        newSet.delete(txId);
      } else {
        newSet.add(txId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

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
    onLeadUpdated?.();
  };

  const handleCreditSuccess = () => {
    setShowIssueCredit(false);
    fetchLeadDetails();
    setHistoryKey(prev => prev + 1);
    onLeadUpdated?.();
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Lead Details</h3>
                <p className="text-sm text-gray-500 font-mono">{leadId}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchLeadDetails}
                className="p-2 text-gray-400 hover:text-gray-600 rounded"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)]">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center p-12">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={fetchLeadDetails}>Try Again</Button>
              </div>
            ) : lead ? (
              <div className="p-6 space-y-6">
                {/* Status & Actions Bar */}
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
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
                    <div className="bg-white border rounded-lg p-4">
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

                    <div className="bg-white border rounded-lg p-4">
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

                    <div className="bg-white border rounded-lg p-4">
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
                                    View Certificate
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
                    <div className="bg-white border rounded-lg p-4">
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
                            <span className="font-medium">{lead.winningBuyer.name}</span>
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

                    <div className="bg-white border rounded-lg p-4">
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
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Marketing Attribution
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

                      {/* Meta (Facebook) Tracking */}
                      {(lead.compliance.complianceData?.attribution?.fbclid ||
                        lead.compliance.complianceData?.attribution?.fbc ||
                        lead.compliance.complianceData?.attribution?.fbp) && (
                        <div className="space-y-2 text-sm">
                          <h5 className="font-medium text-gray-600 flex items-center">
                            <span className="text-blue-600">📘</span> Meta (Facebook)
                          </h5>
                          {lead.compliance.complianceData.attribution.fbclid && (
                            <div>
                              <span className="text-gray-500 block">Click ID (fbclid)</span>
                              <span className="text-blue-600 font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution.fbclid}
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.fbc && (
                            <div>
                              <span className="text-gray-500 block">Cookie (fbc)</span>
                              <span className="text-blue-700 font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution.fbc}
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.fbp && (
                            <div>
                              <span className="text-gray-500 block">Browser ID (fbp)</span>
                              <span className="text-blue-800 font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution.fbp}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Google Tracking */}
                      {(lead.compliance.complianceData?.attribution?.gclid ||
                        lead.compliance.complianceData?.attribution?.wbraid ||
                        lead.compliance.complianceData?.attribution?.gbraid ||
                        lead.compliance.complianceData?.attribution?._ga ||
                        lead.compliance.complianceData?.attribution?._gid) && (
                        <div className="space-y-2 text-sm">
                          <h5 className="font-medium text-gray-600 flex items-center">
                            <span className="text-green-600">🔍</span> Google Ads & Analytics
                          </h5>
                          {lead.compliance.complianceData.attribution.gclid && (
                            <div>
                              <span className="text-gray-500 block">Click ID (gclid)</span>
                              <span className="text-green-600 font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution.gclid}
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.wbraid && (
                            <div>
                              <span className="text-gray-500 block">Web Conversion (wbraid)</span>
                              <span className="text-green-700 font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution.wbraid}
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.gbraid && (
                            <div>
                              <span className="text-gray-500 block">iOS App (gbraid)</span>
                              <span className="text-green-800 font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution.gbraid}
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution._ga && (
                            <div>
                              <span className="text-gray-500 block">GA Client ID (_ga)</span>
                              <span className="font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution._ga}
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution._gid && (
                            <div>
                              <span className="text-gray-500 block">GA Session (_gid)</span>
                              <span className="font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution._gid}
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
                          {lead.compliance.complianceData.attribution.utm_content && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Content</span>
                              <span className="font-medium text-xs">
                                {lead.compliance.complianceData.attribution.utm_content}
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.utm_term && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Term</span>
                              <span className="font-medium text-xs">
                                {lead.compliance.complianceData.attribution.utm_term}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Other Platform Click IDs */}
                      {(lead.compliance.complianceData?.attribution?.msclkid ||
                        lead.compliance.complianceData?.attribution?.ttclid ||
                        lead.compliance.complianceData?.attribution?.li_fat_id ||
                        lead.compliance.complianceData?.attribution?.twclid ||
                        lead.compliance.complianceData?.attribution?.rdt_cid) && (
                        <div className="space-y-2 text-sm">
                          <h5 className="font-medium text-gray-600 flex items-center">
                            <MousePointer className="h-3 w-3 mr-1" /> Other Platforms
                          </h5>
                          {lead.compliance.complianceData.attribution.msclkid && (
                            <div>
                              <span className="text-gray-500 block">Microsoft Ads</span>
                              <span className="text-cyan-600 font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution.msclkid}
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.ttclid && (
                            <div>
                              <span className="text-gray-500 block">TikTok</span>
                              <span className="font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution.ttclid}
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.li_fat_id && (
                            <div>
                              <span className="text-gray-500 block">LinkedIn</span>
                              <span className="font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution.li_fat_id}
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.twclid && (
                            <div>
                              <span className="text-gray-500 block">Twitter</span>
                              <span className="font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution.twclid}
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.rdt_cid && (
                            <div>
                              <span className="text-gray-500 block">Reddit</span>
                              <span className="font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution.rdt_cid}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Page Context */}
                      {(lead.compliance.complianceData?.attribution?.landing_page ||
                        lead.compliance.complianceData?.attribution?.referrer_domain ||
                        lead.compliance.complianceData?.attribution?.first_touch_timestamp) && (
                        <div className="space-y-2 text-sm">
                          <h5 className="font-medium text-gray-600">Page Context</h5>
                          {lead.compliance.complianceData.attribution.landing_page && (
                            <div>
                              <span className="text-gray-500 block">Landing Page</span>
                              <span className="font-mono text-xs break-all">
                                {lead.compliance.complianceData.attribution.landing_page}
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.referrer_domain && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Referrer</span>
                              <span className="font-medium">
                                {lead.compliance.complianceData.attribution.referrer_domain}
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.first_touch_timestamp && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">First Touch</span>
                              <span className="text-xs">
                                {new Date(lead.compliance.complianceData.attribution.first_touch_timestamp).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Buyer Transactions - Always show this section */}
                <div className="bg-white border rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                    <Activity className="h-4 w-4 mr-2" />
                    Buyer Transactions
                    {lead.transactions && lead.transactions.length > 0 && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({lead.transactions.length} transactions)
                      </span>
                    )}
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

                  {/* No Transactions Message */}
                  {(!lead.transactions || lead.transactions.length === 0) ? (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                      <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No buyer transactions recorded</p>
                      <p className="text-gray-400 text-xs mt-1">
                        This lead may have been rejected before auction or had no eligible buyers
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {lead.transactions.map((tx) => (
                        <div key={tx.id} className="border rounded-lg overflow-hidden">
                          {/* Transaction Header - Clickable */}
                          <button
                            onClick={() => toggleTransaction(tx.id)}
                            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {expandedTransactions.has(tx.id) ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              )}
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                tx.actionType === 'PING'
                                  ? 'bg-blue-100 text-blue-800'
                                  : tx.actionType === 'POST'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {tx.actionType}
                              </span>
                              <span className="text-sm font-medium text-gray-700">
                                {tx.buyerName || tx.buyerId.slice(0, 8) + '...'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                tx.status === 'SUCCESS'
                                  ? 'bg-green-100 text-green-800'
                                  : tx.status === 'FAILED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {tx.status}
                              </span>
                              {tx.bidAmount && (
                                <span className="text-green-600 font-medium">
                                  ${Number(tx.bidAmount).toFixed(2)}
                                </span>
                              )}
                              {tx.responseTime && (
                                <span className="text-gray-500 text-xs">
                                  {tx.responseTime}ms
                                </span>
                              )}
                              {tx.isWinner === true && (
                                <Trophy className="h-4 w-4 text-yellow-500" />
                              )}
                              {tx.isWinner === false && (
                                <span className="text-gray-400 text-xs" title={tx.lostReason || 'Lost'}>
                                  <Ban className="h-4 w-4" />
                                </span>
                              )}
                            </div>
                          </button>

                          {/* Expanded Content */}
                          {expandedTransactions.has(tx.id) && (
                            <div className="p-4 border-t bg-white space-y-4">
                              {/* Transaction Summary */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <span className="text-gray-500 block text-xs">Status</span>
                                  <span className="font-medium">{tx.status}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block text-xs">Bid Amount</span>
                                  <span className="font-medium">
                                    {tx.bidAmount ? `$${Number(tx.bidAmount).toFixed(2)}` : '-'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block text-xs">Response Time</span>
                                  <span className="font-medium">
                                    {tx.responseTime ? `${tx.responseTime}ms` : '-'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block text-xs">Result</span>
                                  {tx.isWinner === true ? (
                                    <span className="text-green-600 font-medium flex items-center gap-1">
                                      <Trophy className="h-3 w-3" /> Won
                                    </span>
                                  ) : tx.isWinner === false ? (
                                    <span className="text-gray-500">
                                      Lost: {tx.lostReason || 'Unknown'}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </div>
                              </div>

                              {/* Error Message */}
                              {tx.errorMessage && (
                                <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                  <span className="font-medium">Error:</span> {tx.errorMessage}
                                </div>
                              )}

                              {/* Cascade Position */}
                              {tx.cascadePosition && tx.cascadePosition > 1 && (
                                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                                  Cascade Position: {tx.cascadePosition} (fallback attempt)
                                </div>
                              )}

                              {/* Request Payload */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-700">Request Payload</span>
                                  {tx.payload && (
                                    <button
                                      onClick={() => copyToClipboard(JSON.stringify(tx.payload, null, 2))}
                                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                      <Copy className="h-3 w-3" /> Copy
                                    </button>
                                  )}
                                </div>
                                <pre className="bg-gray-900 text-emerald-400 p-3 rounded text-xs overflow-x-auto max-h-48 font-mono">
                                  {tx.payload
                                    ? JSON.stringify(tx.payload, null, 2)
                                    : 'No request payload captured'}
                                </pre>
                              </div>

                              {/* Response */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-700">Response</span>
                                  {tx.response && (
                                    <button
                                      onClick={() => copyToClipboard(JSON.stringify(tx.response, null, 2))}
                                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                      <Copy className="h-3 w-3" /> Copy
                                    </button>
                                  )}
                                </div>
                                <pre className="bg-gray-900 text-emerald-400 p-3 rounded text-xs overflow-x-auto max-h-48 font-mono">
                                  {tx.response
                                    ? JSON.stringify(tx.response, null, 2)
                                    : tx.errorMessage
                                    ? JSON.stringify({ error: tx.errorMessage }, null, 2)
                                    : 'No response captured'}
                                </pre>
                              </div>

                              {/* Timestamp */}
                              <div className="text-xs text-gray-500 pt-2 border-t">
                                Transaction time: {new Date(tx.createdAt).toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status History */}
                <div className="border rounded-lg p-4">
                  <LeadStatusHistory
                    key={historyKey}
                    leadId={leadId}
                    onRefresh={() => setHistoryKey(prev => prev + 1)}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Nested Modals */}
          {showChangeStatus && lead && (
            <ChangeStatusModal
              leadId={leadId}
              currentStatus={lead.status}
              currentDisposition={lead.disposition || 'NEW'}
              adminUserId={adminUserId}
              onClose={() => setShowChangeStatus(false)}
              onSuccess={handleStatusChangeSuccess}
            />
          )}

          {showIssueCredit && lead && (
            <IssueCreditModal
              leadId={leadId}
              currentDisposition={lead.disposition || 'NEW'}
              originalBid={lead.winningBid || null}
              adminUserId={adminUserId}
              onClose={() => setShowIssueCredit(false)}
              onSuccess={handleCreditSuccess}
            />
          )}
        </div>
      </div>
    </div>
  );
}
