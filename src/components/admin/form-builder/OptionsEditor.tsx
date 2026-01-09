'use client';

import { useFieldArray, Control, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useState } from 'react';

/**
 * OptionsEditor - Manage select/radio field options as value/label pairs
 *
 * WHY: Options need to be {value, label}[] for proper form handling
 * WHEN: Editing select, radio, or multiselect fields in admin form builder
 * HOW: Renders editable list of value/label pairs with add/remove/reorder
 *
 * @param fieldIndex - Index of the field in the formFields array
 * @param control - react-hook-form control object
 * @param register - react-hook-form register function
 */

interface OptionsEditorProps {
  fieldIndex: number;
  control: Control<any>;
  register: any;
}

export function OptionsEditor({
  fieldIndex,
  control,
  register,
}: OptionsEditorProps) {
  const { fields: options, append, remove, move } = useFieldArray({
    control,
    name: `formFields.${fieldIndex}.options`,
  });

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const addOption = () => {
    append({ value: '', label: '' });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      move(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  // Auto-generate value from label if value is empty
  const generateValueFromLabel = (label: string): string => {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="form-label text-sm">Options</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOption}
          className="text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add option
        </Button>
      </div>

      {options.length === 0 ? (
        <div className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded border border-dashed border-gray-300">
          No options yet. Click "Add option" to create choices.
        </div>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[24px_1fr_1fr_32px] gap-2 text-xs font-medium text-gray-500 px-1">
            <div></div>
            <div>Value (stored)</div>
            <div>Label (displayed)</div>
            <div></div>
          </div>

          {/* Options list */}
          {options.map((option, optionIndex) => (
            <div
              key={option.id}
              className="grid grid-cols-[24px_1fr_1fr_32px] gap-2 items-center"
              draggable
              onDragStart={() => handleDragStart(optionIndex)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, optionIndex)}
            >
              <div className="cursor-move text-gray-400 hover:text-gray-600">
                <GripVertical className="h-4 w-4" />
              </div>

              <input
                type="text"
                className="form-input text-sm py-1.5"
                placeholder="e.g., option_1"
                {...register(`formFields.${fieldIndex}.options.${optionIndex}.value`)}
              />

              <input
                type="text"
                className="form-input text-sm py-1.5"
                placeholder="e.g., Option 1"
                {...register(`formFields.${fieldIndex}.options.${optionIndex}.label`)}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(optionIndex)}
                className="text-red-500 hover:text-red-700 h-8 w-8"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {options.length > 0 && (
        <p className="text-xs text-gray-500">
          Drag to reorder. Value is stored in database, Label is shown to users.
        </p>
      )}
    </div>
  );
}
