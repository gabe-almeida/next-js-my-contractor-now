'use client';

/**
 * Buyer Scrub Reconciliation Page
 *
 * WHY: Process buyer scrubs and create credits for returned/invalid leads.
 * WHEN: Admin needs to reconcile scrubbed leads reported by buyer.
 * HOW: CSV upload or manual entry, validation, preview, and credit creation.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { AdminDetailPageHeader, AdminSection } from '@/components/admin/ui';
import { ScrubReconciliationForm, type ScrubLeadPreview, type ScrubReconciliationData } from '@/components/admin/invoices/ScrubReconciliationForm';
import { BuyerScrubRateCard, type ScrubRateData } from '@/components/admin/invoices/BuyerScrubRateCard';
import {
  AlertCircle,
  RefreshCw,
  History,
  CheckCircle,
  Calendar,
  FileText,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface BuyerInfo {
  id: string;
  name: string;
  displayName: string | null;
  expectedScrubRate: number | null;
}

interface ReconciliationHistory {
  id: string;
  leadCount: number;
  totalCredit: number;
  reason: string;
  createdAt: string;
  createdBy: {
    name: string | null;
    email: string;
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function BuyerScrubReconciliationPage() {
  const params = useParams();
  const router = useRouter();
  const buyerId = params.id as string;

  const [buyer, setBuyer] = useState<BuyerInfo | null>(null);
  const [scrubStats, setScrubStats] = useState<ScrubRateData | null>(null);
  const [history, setHistory] = useState<ReconciliationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch buyer info and scrub stats in parallel
      const [buyerRes, scrubStatsRes] = await Promise.all([
        fetch(`/api/admin/buyers/${buyerId}`, {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
          },
        }),
        fetch(`/api/admin/buyers/${buyerId}/scrub-stats`, {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
          },
        }),
      ]);

      if (!buyerRes.ok) {
        if (buyerRes.status === 404) {
          throw new Error('Buyer not found');
        }
        throw new Error('Failed to fetch buyer data');
      }

      const [buyerData, scrubStatsData] = await Promise.all([
        buyerRes.json(),
        scrubStatsRes.json(),
      ]);

      if (buyerData.success) {
        setBuyer(buyerData.data);
      }

      if (scrubStatsData.success) {
        setScrubStats(scrubStatsData.data.currentStats);
        setHistory(scrubStatsData.data.history || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [buyerId]);

  useEffect(() => {
    if (buyerId) {
      fetchData();
    }
  }, [buyerId, fetchData]);

  // Validate lead IDs against the buyer
  const handleValidateLeads = useCallback(async (leadIds: string[]): Promise<ScrubLeadPreview[]> => {
    const response = await fetch(`/api/admin/buyers/${buyerId}/scrub-reconciliation/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
      },
      body: JSON.stringify({ leadIds }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Validation failed');
    }

    return data.data;
  }, [buyerId]);

  // Submit scrub reconciliation
  const handleSubmit = useCallback(async (formData: ScrubReconciliationData) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/buyers/${buyerId}/scrub-reconciliation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Successfully credited ${data.data.scrubbedCount} leads for ${formatCurrency(data.data.totalCredit)}`);
        fetchData(); // Refresh data
      } else {
        setError(data.error || 'Failed to process scrub reconciliation');
      }
    } catch (err) {
      setError('Failed to process scrub reconciliation');
      console.error('Scrub reconciliation error:', err);
    } finally {
      setSubmitting(false);
    }
  }, [buyerId, fetchData]);

  const handleCancel = useCallback(() => {
    router.push(`/admin/buyers/${buyerId}/invoices`);
  }, [router, buyerId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-gray-200 rounded-xl" />
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !buyer) {
    return (
      <div className="space-y-6">
        <AdminDetailPageHeader
          title="Scrub Reconciliation"
          backHref={`/admin/buyers/${buyerId}/invoices`}
          backLabel="Back to Invoices"
        />

        <div className="bg-red-50 rounded-xl border border-red-200 p-6">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Failed to load data</span>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
          <Button
            variant="outline"
            onClick={fetchData}
            className="mt-4 gap-2 border-red-300 text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!buyer) {
    return null;
  }

  const buyerName = buyer.displayName || buyer.name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminDetailPageHeader
        title={`Scrub Reconciliation - ${buyerName}`}
        backHref={`/admin/buyers/${buyerId}/invoices`}
        backLabel="Back to Invoices"
        onRefresh={fetchData}
      />

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">{success}</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Reconciliation Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <ScrubReconciliationForm
              buyerId={buyerId}
              buyerName={buyerName}
              onValidateLeads={handleValidateLeads}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              loading={submitting}
            />
          </div>
        </div>

        {/* Right Column - Stats & History */}
        <div className="space-y-6">
          {/* Scrub Rate Card */}
          {scrubStats && (
            <BuyerScrubRateCard
              data={scrubStats}
              buyerName={buyerName}
              loading={loading}
            />
          )}

          {/* Expected Scrub Rate Info */}
          {buyer.expectedScrubRate !== null && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Buyer Settings</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Expected Scrub Rate</span>
                <span className="text-sm font-semibold text-gray-900">
                  {(buyer.expectedScrubRate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* Reconciliation History */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/30">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Reconciliation History</h3>
              </div>
            </div>
            <div className="p-5">
              {history.length === 0 ? (
                <div className="text-center py-6">
                  <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No previous reconciliations</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.slice(0, 5).map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-sm font-semibold text-gray-900">
                            {entry.leadCount} lead{entry.leadCount !== 1 ? 's' : ''} credited
                          </span>
                          <span className="text-sm text-gray-600 ml-2">
                            ({formatCurrency(entry.totalCredit)})
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">{entry.reason}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDateTime(entry.createdAt)}</span>
                        <span className="text-gray-300">|</span>
                        <span>by {entry.createdBy.name || entry.createdBy.email}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
