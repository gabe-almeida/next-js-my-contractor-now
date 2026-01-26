'use client';

/**
 * ScrubReconciliationForm - Form for CSV upload + manual entry of scrubbed leads
 *
 * WHY: Networks like Modernize scrub leads after delivery. This form allows admins
 *      to record which leads were scrubbed and create credits for them.
 * WHEN: Used when a buyer reports scrubbed leads at reconciliation time.
 * HOW: Supports both CSV upload and manual lead ID entry, previews the credit
 *      amount, and submits for processing.
 *
 * Features:
 * - Drag & drop CSV upload
 * - Manual lead ID entry textarea
 * - Preview of leads to be credited
 * - Total credit amount display
 * - Validation that leads belong to the buyer
 */

import { useState, useCallback, useRef, memo, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  CheckCircle,
  Trash2,
  Download,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface ScrubLeadPreview {
  id: string;
  valid: boolean;
  amount?: number;
  serviceType?: string;
  zipCode?: string;
  error?: string;
}

export interface ScrubReconciliationData {
  leadIds: string[];
  reason: string;
}

interface ScrubReconciliationFormProps {
  /** Buyer ID for validation */
  buyerId: string;
  /** Buyer name for display */
  buyerName: string;
  /** Called to validate lead IDs */
  onValidateLeads: (leadIds: string[]) => Promise<ScrubLeadPreview[]>;
  /** Called when form is submitted */
  onSubmit: (data: ScrubReconciliationData) => Promise<void>;
  /** Called when cancelled */
  onCancel: () => void;
  /** Loading state */
  loading?: boolean;
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

function parseCSV(content: string): string[] {
  // Split by lines and extract first column (assuming lead IDs are in first column)
  const lines = content.trim().split(/\r?\n/);
  const leadIds: string[] = [];

  for (const line of lines) {
    // Skip header row if it looks like a header
    if (line.toLowerCase().includes('lead') || line.toLowerCase().includes('id')) {
      continue;
    }

    // Get first column (comma or tab separated)
    const columns = line.split(/[,\t]/);
    const id = columns[0]?.trim();

    if (id && id.length > 0) {
      leadIds.push(id);
    }
  }

  return leadIds;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const ScrubReconciliationForm = memo(function ScrubReconciliationForm({
  buyerId,
  buyerName,
  onValidateLeads,
  onSubmit,
  onCancel,
  loading = false,
}: ScrubReconciliationFormProps) {
  // Form state
  const [manualInput, setManualInput] = useState('');
  const [reason, setReason] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previews, setPreviews] = useState<ScrubLeadPreview[]>([]);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate totals
  const { validCount, invalidCount, totalCredit } = useMemo(() => {
    const valid = previews.filter((p) => p.valid);
    const invalid = previews.filter((p) => !p.valid);
    const credit = valid.reduce((sum, p) => sum + (p.amount || 0), 0);
    return {
      validCount: valid.length,
      invalidCount: invalid.length,
      totalCredit: credit,
    };
  }, [previews]);

  // Parse lead IDs from all sources
  const getAllLeadIds = useCallback((): string[] => {
    const ids = new Set<string>();

    // From manual input (newline or comma separated)
    const manualIds = manualInput
      .split(/[\n,]/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    manualIds.forEach((id) => ids.add(id));

    return Array.from(ids);
  }, [manualInput]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    setError(null);

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    try {
      const content = await file.text();
      const csvIds = parseCSV(content);

      if (csvIds.length === 0) {
        setError('No lead IDs found in CSV file');
        return;
      }

      setUploadedFile(file);

      // Add CSV IDs to manual input
      setManualInput((prev) => {
        const existing = prev.trim();
        if (existing) {
          return `${existing}\n${csvIds.join('\n')}`;
        }
        return csvIds.join('\n');
      });
    } catch (err) {
      setError('Failed to read CSV file');
      console.error('CSV read error:', err);
    }
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  // Validate leads
  const handleValidate = useCallback(async () => {
    const leadIds = getAllLeadIds();

    if (leadIds.length === 0) {
      setError('Please enter at least one lead ID');
      return;
    }

    setValidating(true);
    setError(null);

    try {
      const results = await onValidateLeads(leadIds);
      setPreviews(results);
    } catch (err) {
      setError('Failed to validate lead IDs');
      console.error('Validation error:', err);
    } finally {
      setValidating(false);
    }
  }, [getAllLeadIds, onValidateLeads]);

  // Clear previews and start over
  const handleClear = useCallback(() => {
    setManualInput('');
    setUploadedFile(null);
    setPreviews([]);
    setError(null);
    setReason('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (validCount === 0) {
      setError('No valid leads to credit');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the scrub');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const validIds = previews.filter((p) => p.valid).map((p) => p.id);
      await onSubmit({
        leadIds: validIds,
        reason: reason.trim(),
      });
    } catch (err) {
      setError('Failed to process scrub reconciliation');
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  }, [validCount, reason, previews, onSubmit]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-lg font-semibold text-gray-900">Scrub Reconciliation</h2>
        <p className="text-sm text-gray-500 mt-1">
          Record scrubbed leads from <span className="font-medium text-gray-700">{buyerName}</span> and create credits
        </p>
      </div>

      {/* CSV Upload Area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload CSV File
        </label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragOver
              ? 'border-orange-400 bg-orange-50'
              : uploadedFile
                ? 'border-green-300 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {uploadedFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="h-8 w-8 text-green-600" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                <p className="text-xs text-gray-500">
                  Click or drag to replace
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setUploadedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="ml-2 text-gray-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">
                Drag & drop a CSV file, or click to browse
              </p>
              <p className="text-xs text-gray-400 mt-1">
                First column should contain lead IDs
              </p>
            </>
          )}
        </div>
      </div>

      {/* Manual Entry */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Or Enter Lead IDs Manually
        </label>
        <textarea
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          rows={6}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none font-mono"
          placeholder="Enter lead IDs (one per line or comma-separated)&#10;e.g.,&#10;abc123-def-456&#10;xyz789-ghi-012"
        />
        <p className="text-xs text-gray-400 mt-1">
          {getAllLeadIds().length} lead ID{getAllLeadIds().length !== 1 ? 's' : ''} entered
        </p>
      </div>

      {/* Validate Button */}
      {previews.length === 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleValidate}
            loading={validating}
            loadingText="Validating..."
            disabled={getAllLeadIds().length === 0}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Validate Lead IDs
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-100">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Preview Results */}
      {previews.length > 0 && (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          {/* Preview Header */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-900">
                  Validation Results
                </span>
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {invalidCount} invalid
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-xs text-gray-500"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear All
              </Button>
            </div>
          </div>

          {/* Preview List */}
          <div className="max-h-64 overflow-y-auto">
            {previews.map((preview) => (
              <div
                key={preview.id}
                className={`flex items-center justify-between px-4 py-2 border-b border-gray-50 last:border-b-0 ${
                  preview.valid ? 'bg-white' : 'bg-red-50/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {preview.valid ? (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-gray-700 truncate">
                      {preview.id}
                    </p>
                    {preview.valid && preview.serviceType && (
                      <p className="text-xs text-gray-500">
                        {preview.serviceType} | ZIP: {preview.zipCode}
                      </p>
                    )}
                    {!preview.valid && preview.error && (
                      <p className="text-xs text-red-600">{preview.error}</p>
                    )}
                  </div>
                </div>
                {preview.valid && preview.amount !== undefined && (
                  <span className="text-sm font-medium text-gray-900 flex-shrink-0">
                    {formatCurrency(preview.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Total Credit */}
          {validCount > 0 && (
            <div className="px-4 py-3 bg-green-50 border-t border-green-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800">
                  Total Credit Amount
                </span>
                <span className="text-lg font-bold text-green-800">
                  {formatCurrency(totalCredit)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reason Input */}
      {previews.length > 0 && validCount > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for Scrub <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
            placeholder="e.g., Monthly reconciliation - buyer reported duplicates"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={submitting || loading}
        >
          Cancel
        </Button>
        {previews.length > 0 && validCount > 0 && (
          <Button
            onClick={handleSubmit}
            loading={submitting || loading}
            loadingText="Processing..."
            disabled={!reason.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Credit {validCount} Lead{validCount !== 1 ? 's' : ''} ({formatCurrency(totalCredit)})
          </Button>
        )}
      </div>
    </div>
  );
});

export default ScrubReconciliationForm;
