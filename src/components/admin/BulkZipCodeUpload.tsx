'use client';

/**
 * Bulk ZIP Code Upload Component
 *
 * WHY: Buyers like Modernize send monthly ZIP code updates as Excel files
 *      with multiple sheets that need to REPLACE existing ZIPs
 * WHEN: Monthly when buyers send updated ZIP code lists
 * HOW: Drag-drop Excel/CSV → Preview sheets → Map to services → Replace
 */

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Check,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface SheetPreview {
  name: string;
  zipCount: number;
  sampleZips: string[];
  mappedTo?: string;
}

interface ImportResult {
  success: boolean;
  serviceType: string;
  totalZipCodes: number;
  duplicatesRemoved: number;
  previousZipCount: number;
  newZipCount: number;
  error?: string;
}

interface BulkZipCodeUploadProps {
  buyerId: string;
  buyerName: string;
  services: Array<{
    id: string;
    name: string;
    displayName: string;
  }>;
  onClose: () => void;
  onSuccess: () => void;
}

// Predefined sheet mappings for known buyers
const MAPPING_PRESETS: Record<string, { name: string; mappings: Record<string, string[]> }> = {
  modernize: {
    name: 'Modernize',
    mappings: {
      bathrooms: ['Bath Refacing', 'Bath Remodel'],
      windows: ['Windows'],
      roofing: ['Roofing'],
      hvac: ['HVAC'],
    },
  },
};

export function BulkZipCodeUpload({
  buyerId,
  buyerName,
  services,
  onClose,
  onSuccess,
}: BulkZipCodeUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetPreview[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('modernize');
  const [customMappings, setCustomMappings] = useState<Record<string, string[]>>({});
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [expandedSheets, setExpandedSheets] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, []);

  // Handle file selection
  const handleFile = async (selectedFile: File) => {
    const ext = selectedFile.name.toLowerCase().split('.').pop();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setError('Please upload an Excel (.xlsx, .xls) or CSV file');
      return;
    }

    setFile(selectedFile);
    setSheets([]);
    setImportResults(null);
    setParsing(true);
    setError(null);

    try {
      // Parse file to get sheet preview
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('previewOnly', 'true');

      const response = await fetch(`/api/admin/buyers/${buyerId}/zip-codes/preview`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to parse file');
      }

      setSheets(result.data.sheets);

      // Auto-detect preset based on buyer name
      const preset = Object.entries(MAPPING_PRESETS).find(
        ([_, p]) => buyerName.toLowerCase().includes(p.name.toLowerCase())
      );
      if (preset) {
        setSelectedPreset(preset[0]);
        setCustomMappings(preset[1].mappings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  };

  // Handle preset change
  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (MAPPING_PRESETS[preset]) {
      setCustomMappings(MAPPING_PRESETS[preset].mappings);
    } else {
      setCustomMappings({});
    }
  };

  // Handle custom mapping change
  const handleMappingChange = (serviceType: string, sheetNames: string[]) => {
    setCustomMappings(prev => ({
      ...prev,
      [serviceType]: sheetNames,
    }));
  };

  // Toggle sheet expansion
  const toggleSheet = (sheetName: string) => {
    setExpandedSheets(prev => {
      const next = new Set(prev);
      if (next.has(sheetName)) {
        next.delete(sheetName);
      } else {
        next.add(sheetName);
      }
      return next;
    });
  };

  // Get service type that a sheet is mapped to
  const getSheetMapping = (sheetName: string): string | null => {
    for (const [serviceType, sheetNames] of Object.entries(customMappings)) {
      if (sheetNames.some(s =>
        s.toLowerCase().includes(sheetName.toLowerCase()) ||
        sheetName.toLowerCase().includes(s.toLowerCase())
      )) {
        return serviceType;
      }
    }
    return null;
  };

  // Submit import
  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setImportResults(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mappingPreset', selectedPreset === 'custom' ? 'custom' : selectedPreset);

      if (selectedPreset === 'custom') {
        formData.append('customMappings', JSON.stringify(
          Object.entries(customMappings).map(([serviceTypeName, sourceSheets]) => ({
            serviceTypeName,
            sourceSheets,
            defaultPriority: 100,
            defaultMinBid: 12,
            defaultMaxBid: 90,
          }))
        ));
      }

      const response = await fetch(`/api/admin/buyers/${buyerId}/zip-codes/bulk`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      setImportResults(result.data.results);

      // If all successful, trigger success callback
      if (result.data.results.every((r: ImportResult) => r.success)) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setFile(null);
    setSheets([]);
    setImportResults(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const mappedSheetsCount = sheets.filter(s => getSheetMapping(s.name)).length;
  const totalZipsToImport = sheets
    .filter(s => getSheetMapping(s.name))
    .reduce((sum, s) => sum + s.zipCount, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Bulk ZIP Code Import
            </h2>
            <p className="text-gray-500 text-sm">
              Replace ZIP codes for {buyerName} from Excel/CSV file
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-1 h-auto">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Import Results */}
          {importResults && (
            <Card className={importResults.every(r => r.success) ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center space-x-2">
                  {importResults.every(r => r.success) ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  )}
                  <span>Import Complete</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {importResults.map((result, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{result.serviceType}</span>
                    {result.success ? (
                      <span className="text-green-700">
                        {result.previousZipCount} → {result.newZipCount} ZIPs
                        {result.duplicatesRemoved > 0 && (
                          <span className="text-gray-500 ml-2">
                            ({result.duplicatesRemoved} dupes removed)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-red-700">{result.error}</span>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="mt-3"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Import Another File
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Drop Zone */}
          {!importResults && (
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                ${file ? 'bg-gray-50' : ''}
              `}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />

              {parsing ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                  <p className="mt-4 text-gray-600">Parsing file...</p>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center">
                  <FileSpreadsheet className="h-12 w-12 text-green-600" />
                  <p className="mt-4 font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {sheets.length} sheet(s) • {sheets.reduce((sum, s) => sum + s.zipCount, 0).toLocaleString()} total ZIPs
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4"
                  >
                    Choose Different File
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="h-12 w-12 text-gray-400" />
                  <p className="mt-4 text-gray-600">
                    Drag and drop Excel or CSV file here
                  </p>
                  <p className="text-sm text-gray-500">or</p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2"
                  >
                    Browse Files
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Sheet Preview */}
          {sheets.length > 0 && !importResults && (
            <>
              {/* Mapping Preset */}
              <div className="form-group">
                <label className="form-label">Sheet Mapping Preset</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="form-input"
                >
                  {Object.entries(MAPPING_PRESETS).map(([key, preset]) => (
                    <option key={key} value={key}>{preset.name} (Auto)</option>
                  ))}
                  <option value="custom">Custom Mapping</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select a preset to automatically map sheets to service types
                </p>
              </div>

              {/* Sheet List */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Sheets to Import ({mappedSheetsCount} of {sheets.length} mapped)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {sheets.map((sheet) => {
                    const mapping = getSheetMapping(sheet.name);
                    const isExpanded = expandedSheets.has(sheet.name);
                    const service = services.find(s => s.name === mapping);

                    return (
                      <div
                        key={sheet.name}
                        className={`
                          border rounded-lg p-3 transition-colors
                          ${mapping ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}
                        `}
                      >
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => toggleSheet(sheet.name)}
                        >
                          <div className="flex items-center space-x-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                            <span className="font-medium">{sheet.name}</span>
                            <Badge variant="outline">
                              {sheet.zipCount.toLocaleString()} ZIPs
                            </Badge>
                          </div>
                          {mapping && service && (
                            <Badge className="bg-green-100 text-green-800">
                              → {service.displayName}
                            </Badge>
                          )}
                          {!mapping && (
                            <Badge variant="outline" className="text-gray-500">
                              Not mapped
                            </Badge>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pl-7">
                            <p className="text-sm text-gray-600">
                              Sample: {sheet.sampleZips.join(', ')}...
                            </p>
                            {selectedPreset === 'custom' && (
                              <div className="mt-2">
                                <select
                                  value={mapping || ''}
                                  onChange={(e) => {
                                    const newMapping = e.target.value;
                                    if (newMapping) {
                                      // Add to selected service
                                      setCustomMappings(prev => ({
                                        ...prev,
                                        [newMapping]: [...(prev[newMapping] || []), sheet.name],
                                      }));
                                    } else if (mapping) {
                                      // Remove from current mapping
                                      setCustomMappings(prev => ({
                                        ...prev,
                                        [mapping]: prev[mapping].filter(s => s !== sheet.name),
                                      }));
                                    }
                                  }}
                                  className="form-input text-sm"
                                >
                                  <option value="">Don't import</option>
                                  {services.map(s => (
                                    <option key={s.id} value={s.name}>{s.displayName}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Warning */}
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900">This will REPLACE existing ZIP codes</p>
                    <p className="text-sm text-yellow-700">
                      All existing ZIP codes for the mapped service types will be deleted and replaced with the new ones.
                      {totalZipsToImport > 0 && (
                        <span className="font-medium"> {totalZipsToImport.toLocaleString()} ZIP codes will be imported.</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Error</p>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {importResults ? 'Close' : 'Cancel'}
          </Button>
          {!importResults && file && sheets.length > 0 && (
            <Button
              onClick={handleImport}
              loading={loading}
              disabled={mappedSheetsCount === 0}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Replace {totalZipsToImport.toLocaleString()} ZIP Codes
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BulkZipCodeUpload;
