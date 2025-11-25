'use client';

import { useState } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface ComplianceFieldGroupProps {
  label: string;
  description: string;
  fieldNames: string[];
  onChange: (fieldNames: string[]) => void;
  placeholder?: string;
  examples?: string[];
  disabled?: boolean;
}

/**
 * Reusable component for managing an array of field names
 * Used for TrustedForm, Jornaya, TCPA, etc.
 */
export function ComplianceFieldGroup({
  label,
  description,
  fieldNames,
  onChange,
  placeholder = 'field_name',
  examples = [],
  disabled = false
}: ComplianceFieldGroupProps) {
  const [newFieldName, setNewFieldName] = useState('');
  const [showExamples, setShowExamples] = useState(false);

  const addFieldName = () => {
    const trimmed = newFieldName.trim();

    if (!trimmed) {
      alert('Field name cannot be empty');
      return;
    }

    if (fieldNames.includes(trimmed)) {
      alert('This field name already exists');
      return;
    }

    // Validate field name (alphanumeric, underscore, hyphen only)
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      alert('Field name can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    onChange([...fieldNames, trimmed]);
    setNewFieldName('');
  };

  const removeFieldName = (index: number) => {
    onChange(fieldNames.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFieldName();
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-900">
              {label}
            </label>
            {examples.length > 0 && (
              <button
                type="button"
                onClick={() => setShowExamples(!showExamples)}
                className="text-blue-600 hover:text-blue-700"
                title="Show examples"
              >
                <Info className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>

      {/* Examples (collapsible) */}
      {showExamples && examples.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-xs font-medium text-blue-900 mb-2">Common examples:</p>
          <div className="flex flex-wrap gap-2">
            {examples.map((example, idx) => (
              <code
                key={idx}
                className="inline-block px-2 py-1 bg-white border border-blue-200 rounded text-xs text-blue-700 font-mono"
              >
                {example}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Existing Field Names */}
      {fieldNames.length > 0 && (
        <div className="space-y-2">
          {fieldNames.map((fieldName, index) => (
            <div
              key={index}
              className="flex items-center space-x-2 group"
            >
              <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md">
                <code className="text-sm font-mono text-gray-900">
                  {fieldName}
                </code>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFieldName(index)}
                disabled={disabled}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Field Name */}
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={newFieldName}
          onChange={(e) => setNewFieldName(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 px-3 py-2 text-sm font-mono border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addFieldName}
          disabled={disabled || !newFieldName.trim()}
          className="flex items-center space-x-1"
        >
          <Plus className="h-4 w-4" />
          <span>Add</span>
        </Button>
      </div>

      {/* Empty State */}
      {fieldNames.length === 0 && (
        <div className="text-center py-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-md">
          <p className="text-sm text-gray-500">
            No field names configured. Defaults will be used.
          </p>
        </div>
      )}

      {/* Field Count */}
      {fieldNames.length > 0 && (
        <p className="text-xs text-gray-500">
          {fieldNames.length} field {fieldNames.length === 1 ? 'name' : 'names'} configured
        </p>
      )}
    </div>
  );
}
