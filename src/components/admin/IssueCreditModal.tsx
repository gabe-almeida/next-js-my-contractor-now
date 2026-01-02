'use client';

/**
 * Issue Credit Modal Component
 *
 * WHY: Provides a controlled UI for admins to issue credits/refunds for leads
 *      that have been scrubbed or returned - with full audit trail.
 *
 * WHEN: Opened from the Lead Detail view for leads with RETURNED or DISPUTED disposition.
 *
 * HOW: Validates credit amount and records the credit with reason in history.
 */

import { useState } from 'react';
import { X, AlertTriangle, Loader, DollarSign } from 'lucide-react';

interface IssueCreditModalProps {
  leadId: string;
  currentDisposition: string;
  originalBid: number | null;
  adminUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function IssueCreditModal({
  leadId,
  currentDisposition,
  originalBid,
  adminUserId,
  onClose,
  onSuccess
}: IssueCreditModalProps) {
  const [creditAmount, setCreditAmount] = useState(originalBid?.toString() || '');
  const [creditType, setCreditType] = useState<'full' | 'partial'>('full');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreditTypeChange = (type: 'full' | 'partial') => {
    setCreditType(type);
    if (type === 'full' && originalBid) {
      setCreditAmount(originalBid.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid credit amount greater than 0');
      return;
    }

    if (!reason.trim()) {
      setError('Reason is required for credit issuance');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/leads/${leadId}/credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        },
        body: JSON.stringify({
          creditAmount: amount,
          reason: reason.trim(),
          adminUserId
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to issue credit');
      }

      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Check if credit can be issued
  const canIssueCredit = ['RETURNED', 'DISPUTED'].includes(currentDisposition);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Issue Credit</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="p-4 space-y-4">
              {!canIssueCredit && (
                <div className="flex items-center space-x-2 text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">
                    Lead must be RETURNED or DISPUTED to issue credit.
                    Current disposition: {currentDisposition}
                  </span>
                </div>
              )}

              {/* Original Bid */}
              {originalBid && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-500 mb-1">Original Winning Bid</p>
                  <p className="text-xl font-semibold text-gray-900">${originalBid.toFixed(2)}</p>
                </div>
              )}

              {/* Credit Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Credit Type
                </label>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => handleCreditTypeChange('full')}
                    disabled={!canIssueCredit}
                    className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium transition ${
                      creditType === 'full'
                        ? 'bg-green-50 border-green-500 text-green-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    } ${!canIssueCredit ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Full Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreditTypeChange('partial')}
                    disabled={!canIssueCredit}
                    className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium transition ${
                      creditType === 'partial'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    } ${!canIssueCredit ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Partial Credit
                  </button>
                </div>
              </div>

              {/* Credit Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Credit Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    disabled={!canIssueCredit || creditType === 'full'}
                    required
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this credit is being issued..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500"
                  disabled={!canIssueCredit}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be recorded in the audit log
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !canIssueCredit}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {loading && <Loader className="h-4 w-4 animate-spin" />}
                <span>{loading ? 'Processing...' : 'Issue Credit'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
