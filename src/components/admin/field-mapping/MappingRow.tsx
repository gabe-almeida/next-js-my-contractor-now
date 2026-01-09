'use client';

import { useState } from 'react';
import { Trash2, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type {
  FieldMapping,
  SourceFieldDefinition,
  TransformDefinition,
} from '@/types/field-mapping';

/**
 * MappingRow Component
 *
 * WHY: Display and edit a single field mapping
 * WHEN: Rendered for each mapping in the MappingTable
 * HOW: Inline editing with dropdowns for source/transform selection
 */
export interface MappingRowProps {
  mapping: FieldMapping;
  sourceFields: SourceFieldDefinition[];
  transforms: TransformDefinition[];
  onChange: (mapping: FieldMapping) => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function MappingRow({
  mapping,
  sourceFields,
  transforms,
  onChange,
  onDelete,
  disabled = false,
}: MappingRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedSource = sourceFields.find((f) => f.path === mapping.sourceField);
  const selectedTransform = transforms.find((t) => t.id === mapping.transform);

  const handleChange = (field: keyof FieldMapping, value: unknown) => {
    onChange({ ...mapping, [field]: value });
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Main Row */}
      <div className="flex items-center gap-3 p-3">
        {/* Drag Handle */}
        <div className="cursor-grab text-gray-400 hover:text-gray-600">
          <GripVertical className="h-5 w-5" />
        </div>

        {/* Source Field */}
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Source Field
          </label>
          <select
            value={mapping.sourceField}
            onChange={(e) => handleChange('sourceField', e.target.value)}
            disabled={disabled}
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">Select source field...</option>
            {sourceFields.map((field) => (
              <option key={field.path} value={field.path}>
                {field.label} ({field.path})
              </option>
            ))}
          </select>
          {selectedSource && (
            <p className="text-xs text-gray-400 mt-0.5">
              Example: {selectedSource.example}
            </p>
          )}
        </div>

        {/* Arrow */}
        <div className="text-gray-400 text-lg">→</div>

        {/* Target Field */}
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Target Field (Buyer API)
          </label>
          <input
            type="text"
            value={mapping.targetField}
            onChange={(e) => handleChange('targetField', e.target.value)}
            placeholder="buyer_field_name"
            disabled={disabled}
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        {/* Transform */}
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Transform
          </label>
          <select
            value={mapping.transform || ''}
            onChange={(e) => handleChange('transform', e.target.value || undefined)}
            disabled={disabled}
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">None</option>
            {transforms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Expand/Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={disabled}
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-3">
          {/* Transform Preview */}
          {selectedTransform && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Transform preview:</span>
              <code className="bg-gray-200 px-2 py-0.5 rounded text-xs">
                {selectedTransform.example.input}
              </code>
              <span className="text-gray-400">→</span>
              <code className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">
                {selectedTransform.example.output}
              </code>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {/* Required Toggle */}
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mapping.required}
                  onChange={(e) => handleChange('required', e.target.checked)}
                  disabled={disabled}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Required</span>
              </label>
              <p className="text-xs text-gray-500 ml-6">
                Fail if source field is empty
              </p>
            </div>

            {/* Include in PING */}
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mapping.includeInPing}
                  onChange={(e) => handleChange('includeInPing', e.target.checked)}
                  disabled={disabled}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Include in PING</span>
              </label>
              <p className="text-xs text-gray-500 ml-6">
                Send in initial bid request
              </p>
            </div>

            {/* Include in POST */}
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mapping.includeInPost}
                  onChange={(e) => handleChange('includeInPost', e.target.checked)}
                  disabled={disabled}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Include in POST</span>
              </label>
              <p className="text-xs text-gray-500 ml-6">
                Send in final lead delivery
              </p>
            </div>
          </div>

          {/* Default Value */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Default Value (if source is empty)
            </label>
            <input
              type="text"
              value={String(mapping.defaultValue || '')}
              onChange={(e) =>
                handleChange('defaultValue', e.target.value || undefined)
              }
              placeholder="Leave empty for no default"
              disabled={disabled}
              className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Description (for documentation)
            </label>
            <input
              type="text"
              value={mapping.description || ''}
              onChange={(e) =>
                handleChange('description', e.target.value || undefined)
              }
              placeholder="Optional notes about this mapping"
              disabled={disabled}
              className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {/* Value Mappings */}
          <div className="border-t border-gray-200 pt-3 mt-3">
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Value Mappings (Form Value → Buyer Value)
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Convert form values to buyer-expected values (applied before transforms)
            </p>

            <div className="space-y-2">
              {Object.entries(mapping.valueMap || {}).map(([sourceVal, targetVal]) => (
                <div key={sourceVal} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sourceVal}
                    readOnly
                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-gray-50 font-mono"
                    placeholder="form_value"
                  />
                  <span className="text-gray-400 text-xs">→</span>
                  <input
                    type="text"
                    value={String(targetVal)}
                    onChange={(e) => {
                      const newValueMap = { ...mapping.valueMap };
                      newValueMap[sourceVal] = e.target.value;
                      handleChange('valueMap', newValueMap);
                    }}
                    disabled={disabled}
                    className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 font-mono"
                    placeholder="buyer_value"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newValueMap = { ...mapping.valueMap };
                      delete newValueMap[sourceVal];
                      handleChange('valueMap', Object.keys(newValueMap).length > 0 ? newValueMap : undefined);
                    }}
                    disabled={disabled}
                    className="text-red-500 hover:text-red-700 p-1 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const sourceVal = prompt('Enter form value (e.g., within_3_months):');
                  if (sourceVal) {
                    const targetVal = prompt('Enter buyer value (e.g., Immediately):');
                    if (targetVal) {
                      const newValueMap = { ...mapping.valueMap, [sourceVal]: targetVal };
                      handleChange('valueMap', newValueMap);
                    }
                  }
                }}
                disabled={disabled}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                + Add value mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
