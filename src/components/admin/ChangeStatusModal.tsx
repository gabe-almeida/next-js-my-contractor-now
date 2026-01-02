'use client';

/**
 * Change Status Modal Component
 *
 * WHY: Provides a controlled UI for admins to change lead status with required
 *      reason input - ensuring all changes are properly documented.
 *
 * WHEN: Opened from the Lead Detail view when admin clicks "Change Status".
 *
 * HOW: Shows available status transitions, optional disposition, and requires reason.
 */

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader } from 'lucide-react';

interface ChangeStatusModalProps {
  leadId: string;
  currentStatus: string;
  currentDisposition: string;
  adminUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending', description: 'Awaiting processing' },
  { value: 'PROCESSING', label: 'Processing', description: 'In auction' },
  { value: 'AUCTIONED', label: 'Auctioned', description: 'Bids received' },
  { value: 'SOLD', label: 'Sold', description: 'Delivered to buyer' },
  { value: 'REJECTED', label: 'Rejected', description: 'No buyer accepted' },
  { value: 'EXPIRED', label: 'Expired', description: 'Timed out' },
  { value: 'SCRUBBED', label: 'Scrubbed', description: 'Marked as bad/invalid' },
  { value: 'DUPLICATE', label: 'Duplicate', description: 'Duplicate lead detected' }
];

const DISPOSITION_OPTIONS = [
  { value: 'NEW', label: 'New', description: 'Fresh lead' },
  { value: 'DELIVERED', label: 'Delivered', description: 'Successfully sold' },
  { value: 'RETURNED', label: 'Returned', description: 'Buyer returned lead' },
  { value: 'DISPUTED', label: 'Disputed', description: 'Under review' },
  { value: 'CREDITED', label: 'Credited', description: 'Refund issued' },
  { value: 'WRITTEN_OFF', label: 'Written Off', description: 'No action taken' }
];

export function ChangeStatusModal({
  leadId,
  currentStatus,
  currentDisposition,
  adminUserId,
  onClose,
  onSuccess
}: ChangeStatusModalProps) {
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [newDisposition, setNewDisposition] = useState(currentDisposition);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      setError('Reason is required for all status changes');
      return;
    }

    if (newStatus === currentStatus && newDisposition === currentDisposition) {
      setError('Please select a different status or disposition');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
        },
        body: JSON.stringify({
          status: newStatus,
          disposition: newDisposition !== currentDisposition ? newDisposition : undefined,
          reason: reason.trim(),
          adminUserId
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to update status');
      }

      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Change Lead Status</h3>
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
              {/* Current State */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-500 mb-1">Current State</p>
                <div className="flex space-x-3">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                    {currentStatus}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                    {currentDisposition}
                  </span>
                </div>
              </div>

              {/* New Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} - {opt.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* New Disposition */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Disposition (optional)
                </label>
                <select
                  value={newDisposition}
                  onChange={(e) => setNewDisposition(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {DISPOSITION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} - {opt.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this status is being changed..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
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
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {loading && <Loader className="h-4 w-4 animate-spin" />}
                <span>{loading ? 'Updating...' : 'Update Status'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
