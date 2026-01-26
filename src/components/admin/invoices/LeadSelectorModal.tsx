'use client';

/**
 * LeadSelectorModal - Modal to select/deselect leads for an invoice
 *
 * WHY: Allows admins to choose which leads to include on an invoice (auto-includes all, allows removal).
 * WHEN: Used when creating or editing an invoice to manage included leads.
 * HOW: Displays a searchable, filterable table of uninvoiced leads with checkboxes.
 *      By default all leads are selected; admin can deselect specific ones.
 *
 * Features:
 * - Shows all uninvoiced leads for the selected buyer/period
 * - Checkbox selection for individual leads
 * - "Select All" / "Deselect All" buttons
 * - Shows lead details: date, zip, service, amount
 * - Search and filter capabilities
 * - Returns selected lead IDs on confirm
 */

import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { AdminSearch, AdminSelect, AdminFilterBar } from '../ui/AdminSearch';
import {
  X,
  Check,
  CheckSquare,
  Square,
  Search,
  FileText,
  MapPin,
  Calendar,
  DollarSign,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface UninvoicedLead {
  id: string;
  serviceType: string;
  zipCode: string;
  createdAt: string;
  amount: number | string;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
}

interface LeadSelectorModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Called when modal should close */
  onClose: () => void;
  /** Called with selected lead IDs when confirmed */
  onConfirm: (selectedIds: string[]) => void;
  /** Available leads to select from */
  leads: UninvoicedLead[];
  /** Initially selected lead IDs (default: all) */
  initialSelectedIds?: string[];
  /** Buyer name for display */
  buyerName?: string;
  /** Period dates for display */
  periodStart?: string;
  periodEnd?: string;
  /** Loading state */
  loading?: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numAmount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================
// MAIN COMPONENT
// ============================================

export const LeadSelectorModal = memo(function LeadSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  leads,
  initialSelectedIds,
  buyerName,
  periodStart,
  periodEnd,
  loading = false,
}: LeadSelectorModalProps) {
  // Selection state - default to all selected
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (initialSelectedIds) {
      return new Set(initialSelectedIds);
    }
    return new Set(leads.map((l) => l.id));
  });

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('ALL');

  // Reset selection when leads change or modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedIds) {
        setSelectedIds(new Set(initialSelectedIds));
      } else {
        setSelectedIds(new Set(leads.map((l) => l.id)));
      }
    }
  }, [isOpen, leads, initialSelectedIds]);

  // Get unique service types for filter
  const serviceTypes = useMemo(() => {
    const types = Array.from(new Set(leads.map((l) => l.serviceType)));
    return types.sort();
  }, [leads]);

  // Filter leads based on search and service type
  const filteredLeads = useMemo(() => {
    let filtered = leads;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((lead) =>
        lead.id.toLowerCase().includes(query) ||
        lead.zipCode.includes(query) ||
        lead.serviceType.toLowerCase().includes(query) ||
        (lead.firstName && lead.firstName.toLowerCase().includes(query)) ||
        (lead.lastName && lead.lastName.toLowerCase().includes(query)) ||
        (lead.city && lead.city.toLowerCase().includes(query))
      );
    }

    if (serviceFilter !== 'ALL') {
      filtered = filtered.filter((lead) => lead.serviceType === serviceFilter);
    }

    return filtered;
  }, [leads, searchQuery, serviceFilter]);

  // Calculate totals
  const selectedTotal = useMemo(() => {
    return leads
      .filter((l) => selectedIds.has(l.id))
      .reduce((sum, l) => sum + (typeof l.amount === 'string' ? parseFloat(l.amount) : l.amount), 0);
  }, [leads, selectedIds]);

  // Toggle single lead selection
  const toggleLead = useCallback((leadId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  }, []);

  // Select all filtered leads
  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      filteredLeads.forEach((l) => newSet.add(l.id));
      return newSet;
    });
  }, [filteredLeads]);

  // Deselect all filtered leads
  const deselectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      filteredLeads.forEach((l) => newSet.delete(l.id));
      return newSet;
    });
  }, [filteredLeads]);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    onConfirm(Array.from(selectedIds));
  }, [selectedIds, onConfirm]);

  // Check if all filtered leads are selected
  const allFilteredSelected = filteredLeads.every((l) => selectedIds.has(l.id));
  const someFilteredSelected = filteredLeads.some((l) => selectedIds.has(l.id));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Select Leads</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {buyerName && <span>{buyerName} | </span>}
                {periodStart && periodEnd && (
                  <span>{formatDate(periodStart)} - {formatDate(periodEnd)}</span>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Summary Bar */}
          <div className="px-6 py-3 bg-orange-50 border-b border-orange-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-700">
                  <span className="font-semibold text-gray-900">{selectedIds.size}</span> of{' '}
                  <span className="font-semibold text-gray-900">{leads.length}</span> leads selected
                </span>
                <span className="text-sm text-gray-500">|</span>
                <span className="text-sm text-gray-700">
                  Total: <span className="font-semibold text-gray-900">{formatCurrency(selectedTotal)}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  disabled={allFilteredSelected}
                  className="text-xs"
                >
                  <CheckSquare className="h-3.5 w-3.5 mr-1" />
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deselectAll}
                  disabled={!someFilteredSelected}
                  className="text-xs"
                >
                  <Square className="h-3.5 w-3.5 mr-1" />
                  Deselect All
                </Button>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <AdminSearch
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search by ID, ZIP, service, name..."
                />
              </div>
              <AdminSelect
                value={serviceFilter}
                onChange={setServiceFilter}
                options={[
                  { value: 'ALL', label: 'All Services' },
                  ...serviceTypes.map((s) => ({ value: s, label: s })),
                ]}
                icon={false}
              />
            </div>
          </div>

          {/* Lead List */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  {searchQuery || serviceFilter !== 'ALL'
                    ? 'No leads match your filters'
                    : 'No uninvoiced leads found'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLeads.map((lead) => {
                  const isSelected = selectedIds.has(lead.id);
                  const numAmount = typeof lead.amount === 'string' ? parseFloat(lead.amount) : lead.amount;

                  return (
                    <div
                      key={lead.id}
                      onClick={() => toggleLead(lead.id)}
                      className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-orange-300 bg-orange-50/50 hover:bg-orange-50'
                          : 'border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'border-gray-300 bg-white'
                      }`}>
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </div>

                      {/* Lead Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {lead.serviceType}
                          </span>
                          {lead.firstName && lead.lastName && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span className="text-sm text-gray-600">
                                {lead.firstName} {lead.lastName}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {lead.zipCode}
                            {lead.city && lead.state && ` (${lead.city}, ${lead.state})`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(lead.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="flex-shrink-0 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(numAmount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''} will be added to the invoice
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={selectedIds.size === 0}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Confirm Selection ({selectedIds.size})
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default LeadSelectorModal;
