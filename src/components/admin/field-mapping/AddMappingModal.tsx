'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type {
  FieldMapping,
  SourceFieldDefinition,
  SourceFieldCategory,
} from '@/types/field-mapping';
import { createFieldMapping } from '@/types/field-mapping';
import { CATEGORY_LABELS } from '@/lib/field-mapping/source-fields';

/**
 * AddMappingModal Component
 *
 * WHY: Guided UI for adding new field mappings
 * WHEN: User clicks "Add Mapping" button
 * HOW: Modal with source field selection by category
 */
export interface AddMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (mapping: FieldMapping) => void;
  sourceFields: SourceFieldDefinition[];
  existingSourceFields: string[];
}

export function AddMappingModal({
  isOpen,
  onClose,
  onAdd,
  sourceFields,
  existingSourceFields,
}: AddMappingModalProps) {
  const [selectedSource, setSelectedSource] = useState('');
  const [targetField, setTargetField] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<SourceFieldCategory | null>('contact');

  if (!isOpen) return null;

  // Group source fields by category, excluding already used ones
  const availableFields = sourceFields.filter(
    (f) => !existingSourceFields.includes(f.path)
  );

  const fieldsByCategory: Record<SourceFieldCategory, SourceFieldDefinition[]> = {
    contact: [],
    property: [],
    service: [],
    compliance: [],
    meta: [],
  };

  for (const field of availableFields) {
    fieldsByCategory[field.category].push(field);
  }

  const selectedField = sourceFields.find((f) => f.path === selectedSource);

  const handleAdd = () => {
    if (!selectedSource || !targetField.trim()) return;

    const mapping = createFieldMapping({
      sourceField: selectedSource,
      targetField: targetField.trim(),
      required: selectedField?.guaranteed ?? false,
      includeInPing: true,
      includeInPost: true,
    });

    onAdd(mapping);
    setSelectedSource('');
    setTargetField('');
    onClose();
  };

  // Generate suggested target field name from source
  const suggestTargetField = (sourcePath: string): string => {
    // Remove prefix like "formData." and convert to snake_case
    const clean = sourcePath.replace(/^formData\./, '').replace(/^complianceData\./, '');
    return clean
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  };

  const handleSourceSelect = (path: string) => {
    setSelectedSource(path);
    if (!targetField) {
      setTargetField(suggestTargetField(path));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Add Field Mapping
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {/* Step 1: Select Source Field */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              1. Select Source Field
            </h3>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {(Object.keys(fieldsByCategory) as SourceFieldCategory[]).map((category) => {
                const fields = fieldsByCategory[category];
                if (fields.length === 0) return null;

                const isExpanded = expandedCategory === category;

                return (
                  <div key={category} className="border-b border-gray-200 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setExpandedCategory(isExpanded ? null : category)}
                      className="w-full px-4 py-2 text-left flex items-center justify-between hover:bg-gray-50"
                    >
                      <span className="text-sm font-medium text-gray-700">
                        {CATEGORY_LABELS[category]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {fields.length} available
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-1">
                        {fields.map((field) => (
                          <button
                            key={field.path}
                            type="button"
                            onClick={() => handleSourceSelect(field.path)}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                              selectedSource === field.path
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{field.label}</span>
                              {field.guaranteed && (
                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                  guaranteed
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {field.path} • Example: {field.example}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Enter Target Field */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              2. Enter Target Field Name (Buyer API)
            </h3>

            <input
              type="text"
              value={targetField}
              onChange={(e) => setTargetField(e.target.value)}
              placeholder="e.g., customer_first_name, zip_code"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <p className="text-xs text-gray-500 mt-1">
              This is the field name the buyer's API expects in the JSON payload
            </p>
          </div>

          {/* Preview */}
          {selectedSource && targetField && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
              <div className="flex items-center gap-3 text-sm">
                <code className="bg-gray-200 px-2 py-1 rounded">
                  {selectedSource}
                </code>
                <span className="text-gray-400">→</span>
                <code className="bg-green-100 text-green-800 px-2 py-1 rounded">
                  {targetField}
                </code>
              </div>
              {selectedField && (
                <p className="text-xs text-gray-500 mt-2">
                  Example value: "{selectedField.example}"
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleAdd}
            disabled={!selectedSource || !targetField.trim()}
            className="inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Mapping
          </Button>
        </div>
      </div>
    </div>
  );
}
