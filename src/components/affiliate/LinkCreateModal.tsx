'use client';

/**
 * Link Create/Edit Modal Component
 *
 * WHY: Provides form for creating and editing affiliate tracking links.
 * WHEN: Opened when user clicks "Create Link" or edits existing link.
 * HOW: Modal form with name, target URL, and optional custom code fields.
 */

import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface AffiliateLink {
  id: string;
  name: string;
  code: string;
  targetUrl: string | null;
  isActive: boolean;
}

interface LinkCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; targetUrl?: string; customCode?: string }) => Promise<void>;
  editLink?: AffiliateLink | null;
}

export function LinkCreateModal({ isOpen, onClose, onSubmit, editLink }: LinkCreateModalProps) {
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editLink) {
      setName(editLink.name);
      setTargetUrl(editLink.targetUrl || '');
      setCustomCode('');
    } else {
      setName('');
      setTargetUrl('');
      setCustomCode('');
    }
    setError('');
  }, [editLink, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Link name is required');
      return;
    }

    if (targetUrl && !targetUrl.startsWith('http')) {
      setError('Target URL must start with http:// or https://');
      return;
    }

    if (customCode && !/^[a-zA-Z0-9_-]+$/.test(customCode)) {
      setError('Custom code can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    setLoading(true);

    try {
      await onSubmit({
        name: name.trim(),
        targetUrl: targetUrl.trim() || undefined,
        customCode: customCode.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save link');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editLink ? 'Edit Link' : 'Create New Link'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Link Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g., Facebook Campaign, Blog Post"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    A descriptive name to help you track this link
                  </p>
                </div>

                <div>
                  <label htmlFor="targetUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    Target URL (optional)
                  </label>
                  <input
                    type="url"
                    id="targetUrl"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="https://example.com/specific-page"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty to use default landing page
                  </p>
                </div>

                {!editLink && (
                  <div>
                    <label htmlFor="customCode" className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Code (optional)
                    </label>
                    <input
                      type="text"
                      id="customCode"
                      value={customCode}
                      onChange={(e) => setCustomCode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="e.g., my-brand"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leave empty for auto-generated code
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <Button
                type="submit"
                disabled={loading}
                className="inline-flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 sm:ml-3 sm:w-auto disabled:opacity-50"
              >
                {loading ? 'Saving...' : editLink ? 'Save Changes' : 'Create Link'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
