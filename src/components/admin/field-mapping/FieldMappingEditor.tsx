'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Save, RotateCcw, AlertTriangle, CheckCircle, Power } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MappingTable } from './MappingTable';
import { AddMappingModal } from './AddMappingModal';
import { PayloadPreview } from './PayloadPreview';
import type {
  FieldMapping,
  FieldMappingConfig,
  SourceFieldDefinition,
  TransformDefinition,
  ValidationResult,
} from '@/types/field-mapping';
import { createEmptyFieldMappingConfig, createFieldMapping } from '@/types/field-mapping';
import { getSourceFieldsForService } from '@/lib/field-mapping/source-fields';
import { AVAILABLE_TRANSFORMS } from '@/lib/field-mapping/transforms';

/**
 * FieldMappingEditor Component
 *
 * WHY: Main container for configuring field mappings for a buyer + service
 * WHEN: Admin navigates to buyer field mapping configuration
 * HOW: Loads existing config, allows editing, shows preview, saves changes
 */
export interface FieldMappingEditorProps {
  buyerId: string;
  buyerName: string;
  serviceTypeId: string;
  serviceTypeName: string;
  serviceTypeFormSchema: string;
  initialConfig: FieldMappingConfig | null;
  isActive: boolean;
  onSave: (config: FieldMappingConfig) => Promise<ValidationResult>;
  onToggleActive: (active: boolean) => Promise<void>;
}

export function FieldMappingEditor({
  buyerId,
  buyerName,
  serviceTypeId,
  serviceTypeName,
  serviceTypeFormSchema,
  initialConfig,
  isActive,
  onSave,
  onToggleActive,
}: FieldMappingEditorProps) {
  // State
  const [config, setConfig] = useState<FieldMappingConfig>(
    initialConfig || createEmptyFieldMappingConfig()
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Source fields for this service type
  const sourceFields: SourceFieldDefinition[] = getSourceFieldsForService({
    name: serviceTypeName,
    formSchema: serviceTypeFormSchema,
  });

  // All available transforms
  const transforms: TransformDefinition[] = AVAILABLE_TRANSFORMS;

  // Track changes
  useEffect(() => {
    setIsDirty(
      JSON.stringify(config) !== JSON.stringify(initialConfig || createEmptyFieldMappingConfig())
    );
  }, [config, initialConfig]);

  // Clear save result after timeout
  useEffect(() => {
    if (saveResult) {
      const timer = setTimeout(() => setSaveResult(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveResult]);

  // Mapping handlers
  const handleMappingChange = useCallback((index: number, mapping: FieldMapping) => {
    setConfig((prev) => ({
      ...prev,
      mappings: prev.mappings.map((m, i) => (i === index ? mapping : m)),
    }));
  }, []);

  const handleMappingDelete = useCallback((index: number) => {
    setConfig((prev) => ({
      ...prev,
      mappings: prev.mappings.filter((_, i) => i !== index),
    }));
  }, []);

  const handleAddMapping = useCallback((mapping: FieldMapping) => {
    // Set order to end of list
    mapping.order = config.mappings.length;
    setConfig((prev) => ({
      ...prev,
      mappings: [...prev.mappings, mapping],
    }));
  }, [config.mappings.length]);

  // Static fields handler
  const handleStaticFieldChange = useCallback(
    (key: string, value: string | number | boolean) => {
      setConfig((prev) => ({
        ...prev,
        staticFields: { ...prev.staticFields, [key]: value },
      }));
    },
    []
  );

  const handleStaticFieldDelete = useCallback((key: string) => {
    setConfig((prev) => {
      const { [key]: _, ...rest } = prev.staticFields;
      return { ...prev, staticFields: rest };
    });
  }, []);

  // Save handler
  const handleSave = async () => {
    setIsSaving(true);
    setSaveResult(null);

    try {
      const result = await onSave(config);

      if (result.isValid) {
        setSaveResult({
          type: 'success',
          message: 'Field mappings saved successfully!',
        });
        setIsDirty(false);
      } else {
        setSaveResult({
          type: 'error',
          message: result.errors.map((e) => e.message).join(', '),
        });
      }
    } catch (error) {
      setSaveResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset handler
  const handleReset = () => {
    if (
      confirm(
        'Reset all changes? This will revert to the last saved configuration.'
      )
    ) {
      setConfig(initialConfig || createEmptyFieldMappingConfig());
      setIsDirty(false);
    }
  };

  // Toggle active handler
  const handleToggleActive = async () => {
    try {
      await onToggleActive(!isActive);
    } catch (error) {
      setSaveResult({
        type: 'error',
        message: 'Failed to update buyer status',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">
              Field Mapping Configuration
            </h1>
          </div>
          <p className="text-gray-500 mt-1">
            Configure how lead data is transformed for <strong>{buyerName}</strong>
            {' '}when receiving <strong>{serviceTypeName}</strong> leads.
          </p>
        </div>

        {/* Status Toggle */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleToggleActive}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Power className="h-4 w-4" />
            {isActive ? 'Active in Auctions' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* Save Result Alert */}
      {saveResult && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
            saveResult.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {saveResult.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          )}
          {saveResult.message}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Mappings */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Field Mappings
            </h2>

            <MappingTable
              mappings={config.mappings}
              sourceFields={sourceFields}
              transforms={transforms}
              onMappingChange={handleMappingChange}
              onMappingDelete={handleMappingDelete}
              onAddMapping={() => setShowAddModal(true)}
              disabled={isSaving}
            />
          </div>

          {/* Static Fields */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Static Fields
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Fields with fixed values always included in POST payloads
            </p>

            <div className="space-y-2">
              {Object.entries(config.staticFields).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={key}
                    readOnly
                    className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 bg-gray-50"
                  />
                  <span className="text-gray-400">=</span>
                  <input
                    type="text"
                    value={String(value)}
                    onChange={(e) => handleStaticFieldChange(key, e.target.value)}
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => handleStaticFieldDelete(key)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const key = prompt('Enter field name:');
                  if (key) handleStaticFieldChange(key, '');
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Add static field
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="space-y-6">
          <PayloadPreview
            config={config}
            buyerName={buyerName}
            serviceTypeName={serviceTypeName}
          />

          {/* Configuration Summary */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Configuration Summary
            </h2>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Total Mappings:</dt>
                <dd className="font-medium">{config.mappings.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">PING Fields:</dt>
                <dd className="font-medium">
                  {config.mappings.filter((m) => m.includeInPing).length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">POST Fields:</dt>
                <dd className="font-medium">
                  {config.mappings.filter((m) => m.includeInPost).length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Required Fields:</dt>
                <dd className="font-medium">
                  {config.mappings.filter((m) => m.required).length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Static Fields:</dt>
                <dd className="font-medium">
                  {Object.keys(config.staticFields).length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Last Updated:</dt>
                <dd className="font-medium text-xs">
                  {config.meta.updatedAt
                    ? new Date(config.meta.updatedAt).toLocaleString()
                    : 'Never'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-4 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-sm text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className="inline-flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="inline-flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Add Mapping Modal */}
      <AddMappingModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddMapping}
        sourceFields={sourceFields}
        existingSourceFields={config.mappings.map((m) => m.sourceField)}
      />
    </div>
  );
}
