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
  Shield,
  TrendingUp,
  Globe,
  MousePointer
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
                        variant="primary"
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
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Quality Score</span>
                          <span className="font-medium">
                            {lead.compliance.leadQualityScore ?? 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">TrustedForm</span>
                          <span className="font-medium">
                            {lead.compliance.trustedFormCertId ? (
                              <span className="text-green-600 flex items-center">
                                <CheckCircle className="h-3 w-3 mr-1" /> Present
                              </span>
                            ) : (
                              <span className="text-gray-400">Missing</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Jornaya</span>
                          <span className="font-medium">
                            {lead.compliance.jornayaLeadId ? (
                              <span className="text-green-600 flex items-center">
                                <CheckCircle className="h-3 w-3 mr-1" /> Present
                              </span>
                            ) : (
                              <span className="text-gray-400">Missing</span>
                            )}
                          </span>
                        </div>
                        {lead.compliance.complianceData?.ipAddress && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">IP Address</span>
                            <span className="font-mono text-xs">
                              {lead.compliance.complianceData.ipAddress}
                            </span>
                          </div>
                        )}
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
                            <span className="font-medium text-green-600">${lead.winningBid.toFixed(2)}</span>
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
                            <span className="font-bold text-blue-800">${lead.creditAmount.toFixed(2)}</span>
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

                {/* Attribution & Traffic Source */}
                {lead.compliance.complianceData?.attribution && (
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Attribution & Traffic Source
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* UTM Parameters */}
                      {(lead.compliance.complianceData.attribution.utm_source ||
                        lead.compliance.complianceData.attribution.utm_medium ||
                        lead.compliance.complianceData.attribution.utm_campaign) && (
                        <div className="space-y-2 text-sm">
                          <h5 className="font-medium text-gray-600 flex items-center">
                            <Globe className="h-3 w-3 mr-1" /> UTM Parameters
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

                      {/* Click IDs */}
                      {(lead.compliance.complianceData.attribution.gclid ||
                        lead.compliance.complianceData.attribution.fbclid ||
                        lead.compliance.complianceData.attribution.msclkid ||
                        lead.compliance.complianceData.attribution.ttclid) && (
                        <div className="space-y-2 text-sm">
                          <h5 className="font-medium text-gray-600 flex items-center">
                            <MousePointer className="h-3 w-3 mr-1" /> Click IDs
                          </h5>
                          {lead.compliance.complianceData.attribution.gclid && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Google Ads</span>
                              <span className="text-green-600 font-mono text-xs truncate max-w-[120px]" title={lead.compliance.complianceData.attribution.gclid}>
                                {lead.compliance.complianceData.attribution.gclid.slice(0, 12)}...
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.fbclid && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Facebook</span>
                              <span className="text-blue-600 font-mono text-xs truncate max-w-[120px]" title={lead.compliance.complianceData.attribution.fbclid}>
                                {lead.compliance.complianceData.attribution.fbclid.slice(0, 12)}...
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.msclkid && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Microsoft</span>
                              <span className="text-cyan-600 font-mono text-xs truncate max-w-[120px]" title={lead.compliance.complianceData.attribution.msclkid}>
                                {lead.compliance.complianceData.attribution.msclkid.slice(0, 12)}...
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.ttclid && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">TikTok</span>
                              <span className="font-mono text-xs truncate max-w-[120px]" title={lead.compliance.complianceData.attribution.ttclid}>
                                {lead.compliance.complianceData.attribution.ttclid.slice(0, 12)}...
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.wbraid && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">wbraid</span>
                              <span className="font-mono text-xs truncate max-w-[120px]">
                                {lead.compliance.complianceData.attribution.wbraid.slice(0, 12)}...
                              </span>
                            </div>
                          )}
                          {lead.compliance.complianceData.attribution.gbraid && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">gbraid</span>
                              <span className="font-mono text-xs truncate max-w-[120px]">
                                {lead.compliance.complianceData.attribution.gbraid.slice(0, 12)}...
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Page Context */}
                      <div className="space-y-2 text-sm">
                        <h5 className="font-medium text-gray-600">Page Context</h5>
                        {lead.compliance.complianceData.attribution.landing_page && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Landing Page</span>
                            <span className="font-mono text-xs truncate max-w-[150px]" title={lead.compliance.complianceData.attribution.landing_page}>
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
                        {lead.compliance.complianceData.attribution._ga && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">GA Client</span>
                            <span className="font-mono text-xs truncate max-w-[120px]" title={lead.compliance.complianceData.attribution._ga}>
                              {lead.compliance.complianceData.attribution._ga.slice(0, 15)}...
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
                    </div>
                  </div>
                )}

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
