'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MappingRow } from './MappingRow';
import type {
  FieldMapping,
  SourceFieldDefinition,
  TransformDefinition,
} from '@/types/field-mapping';

/**
 * MappingTable Component
 *
 * WHY: Display all field mappings in an organized list
 * WHEN: Main view of field mapping editor
 * HOW: Renders MappingRow for each mapping with add/delete capabilities
 */
export interface MappingTableProps {
  mappings: FieldMapping[];
  sourceFields: SourceFieldDefinition[];
  transforms: TransformDefinition[];
  onMappingChange: (index: number, mapping: FieldMapping) => void;
  onMappingDelete: (index: number) => void;
  onAddMapping: () => void;
  disabled?: boolean;
}

export function MappingTable({
  mappings,
  sourceFields,
  transforms,
  onMappingChange,
  onMappingDelete,
  onAddMapping,
  disabled = false,
}: MappingTableProps) {
  if (mappings.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <p className="text-gray-500 mb-4">
          No field mappings configured yet.
          <br />
          <span className="text-sm">
            Add mappings to define how lead data is sent to this buyer.
          </span>
        </p>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onAddMapping}
          disabled={disabled}
          className="inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add First Mapping
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {mappings.length} field{mappings.length !== 1 ? 's' : ''} configured
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddMapping}
          disabled={disabled}
          className="inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add Mapping
        </Button>
      </div>

      {/* Mappings List */}
      <div className="space-y-2">
        {mappings.map((mapping, index) => (
          <MappingRow
            key={mapping.id}
            mapping={mapping}
            sourceFields={sourceFields}
            transforms={transforms}
            onChange={(updated) => onMappingChange(index, updated)}
            onDelete={() => onMappingDelete(index)}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Add Another */}
      <div className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddMapping}
          disabled={disabled}
          className="w-full inline-flex items-center justify-center gap-1.5 border-dashed"
        >
          <Plus className="h-4 w-4" />
          Add Another Mapping
        </Button>
      </div>
    </div>
  );
}
