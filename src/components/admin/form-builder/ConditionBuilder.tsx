'use client';

import { Control, useFieldArray, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Plus, Eye, EyeOff } from 'lucide-react';
import { ConditionRow } from './ConditionRow';

/**
 * ConditionBuilder - Container for building conditional visibility rules
 *
 * WHY: Enables admins to configure when questions appear based on previous answers
 * WHEN: Editing a form field that should only show under certain conditions
 * HOW: Manages array of ConditionRow components with add/remove functionality
 *
 * @param fieldIndex - Index of the field in the formFields array
 * @param allFields - All form fields (used to find previous fields)
 * @param control - react-hook-form control object
 * @param register - react-hook-form register function
 */

interface FormFieldOption {
  value: string;
  label: string;
}

interface FormFieldData {
  name: string;
  label: string;
  type: string;
  options?: FormFieldOption[];
}

interface ConditionBuilderProps {
  fieldIndex: number;
  allFields: FormFieldData[];
  control: Control<any>;
  register: any;
}

export function ConditionBuilder({
  fieldIndex,
  allFields,
  control,
  register,
}: ConditionBuilderProps) {
  const { fields: conditions, append, remove } = useFieldArray({
    control,
    name: `formFields.${fieldIndex}.conditions`,
  });

  // Watch current conditions to show badge
  const currentConditions = useWatch({
    control,
    name: `formFields.${fieldIndex}.conditions`,
  });

  // Get only fields that appear BEFORE this field (can't depend on future fields)
  const previousFields = allFields.slice(0, fieldIndex).map((field) => ({
    name: field.name,
    label: field.label,
    options: field.options,
  }));

  const hasConditions = currentConditions && currentConditions.length > 0;
  const canAddConditions = previousFields.length > 0;

  const addCondition = () => {
    append({
      field: '',
      operator: 'equals',
      value: '',
    });
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            Show Conditions
          </span>
          {hasConditions ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <Eye className="h-3 w-3" />
              {currentConditions.length} condition{currentConditions.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              <EyeOff className="h-3 w-3" />
              Always shows
            </span>
          )}
        </div>
        {canAddConditions && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCondition}
            className="text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add condition
          </Button>
        )}
      </div>

      {!canAddConditions && (
        <p className="text-xs text-gray-500 italic">
          Add fields above this one to create conditions
        </p>
      )}

      {hasConditions && (
        <div className="space-y-2">
          {conditions.map((condition, conditionIndex) => (
            <div key={condition.id}>
              {conditionIndex > 0 && (
                <div className="text-xs text-gray-500 font-medium my-1 ml-2">
                  AND
                </div>
              )}
              <ConditionRow
                fieldIndex={fieldIndex}
                conditionIndex={conditionIndex}
                previousFields={previousFields}
                onRemove={() => remove(conditionIndex)}
                register={register}
                control={control}
              />
            </div>
          ))}
          {conditions.length > 1 && (
            <p className="text-xs text-gray-500 italic mt-2">
              All conditions must be true (AND logic)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
