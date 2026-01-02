'use client';

import { useState } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface StatusMappingGroupProps {
  label: string;
  description: string;
  statusType: string;
  statusColor: 'green' | 'yellow' | 'red' | 'orange' | 'blue';
  values: string[];
  onChange: (values: string[]) => void;
  examples?: string[];
  disabled?: boolean;
}

/**
 * WHY: Admins need to see and edit arrays of status value mappings for each category.
 *
 * WHEN: Used within ResponseMappingEditor for each status category.
 *
 * HOW: Displays existing values with remove buttons, input for adding new values,
 * and toggleable examples for reference.
 */
export function StatusMappingGroup({
  label,
  description,
  statusType,
  statusColor,
  values,
  onChange,
  examples = [],
  disabled = false
}: StatusMappingGroupProps) {
  const [newValue, setNewValue] = useState('');
  const [showExamples, setShowExamples] = useState(false);

  const colorClasses = {
    green: 'bg-green-100 border-green-300 text-green-800',
    yellow: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    red: 'bg-red-100 border-red-300 text-red-800',
    orange: 'bg-orange-100 border-orange-300 text-orange-800',
    blue: 'bg-blue-100 border-blue-300 text-blue-800',
  };

  const addValue = () => {
    const trimmed = newValue.trim().toLowerCase();

    if (!trimmed) {
      alert('Value cannot be empty');
      return;
    }

    if (values.map(v => v.toLowerCase()).includes(trimmed)) {
      alert('This value already exists');
      return;
    }

    onChange([...values, trimmed]);
    setNewValue('');
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addValue();
    }
  };

  const addExample = (example: string) => {
    const trimmed = example.toLowerCase();
    if (!values.map(v => v.toLowerCase()).includes(trimmed)) {
      onChange([...values, trimmed]);
    }
  };

  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colorClasses[statusColor]}`}>
              {statusType}
            </span>
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
        <span className="text-xs text-gray-400">
          {values.length} values
        </span>
      </div>

      {/* Examples (collapsible) */}
      {showExamples && examples.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-xs font-medium text-blue-900 mb-2">
            Common values (click to add):
          </p>
          <div className="flex flex-wrap gap-2">
            {examples.map((example, idx) => {
              const isAdded = values.map(v => v.toLowerCase()).includes(example.toLowerCase());
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => !isAdded && addExample(example)}
                  disabled={disabled || isAdded}
                  className={`inline-block px-2 py-1 border rounded text-xs font-mono transition-colors ${
                    isAdded
                      ? 'bg-green-100 border-green-300 text-green-700 cursor-default'
                      : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-100 cursor-pointer'
                  }`}
                >
                  {example}
                  {isAdded && ' ✓'}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Existing Values - Chip Display */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((value, index) => (
            <div
              key={index}
              className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-mono ${colorClasses[statusColor]} group`}
            >
              <span>{value}</span>
              <button
                type="button"
                onClick={() => removeValue(index)}
                disabled={disabled}
                className="opacity-60 hover:opacity-100 transition-opacity ml-1"
                title="Remove"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Value */}
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter status value..."
          disabled={disabled}
          className="flex-1 px-3 py-2 text-sm font-mono border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addValue}
          disabled={disabled || !newValue.trim()}
          className="flex items-center space-x-1"
        >
          <Plus className="h-4 w-4" />
          <span>Add</span>
        </Button>
      </div>

      {/* Empty State */}
      {values.length === 0 && (
        <div className="text-center py-3 bg-white border-2 border-dashed border-gray-300 rounded-md">
          <p className="text-sm text-gray-500">
            No values configured. Add status values to map.
          </p>
        </div>
      )}
    </div>
  );
}
