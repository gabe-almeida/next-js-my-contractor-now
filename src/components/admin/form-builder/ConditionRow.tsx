'use client';

import { Control, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Trash2 } from 'lucide-react';

/**
 * ConditionRow - Single condition with field/operator/value dropdowns
 *
 * WHY: Allows admins to configure when a question should appear
 * WHEN: Building conditional logic for form fields in admin UI
 * HOW: Renders field selector, operator dropdown, and value selector
 *
 * @param fieldIndex - Index of the field this condition belongs to
 * @param conditionIndex - Index of this condition within the field's conditions array
 * @param previousFields - Fields that appear BEFORE the current field (valid dependencies)
 * @param onRemove - Callback to remove this condition
 * @param register - react-hook-form register function
 * @param control - react-hook-form control object
 */

interface FormFieldOption {
  value: string;
  label: string;
}

interface PreviousField {
  name: string;
  label: string;
  options?: FormFieldOption[];
}

interface ConditionRowProps {
  fieldIndex: number;
  conditionIndex: number;
  previousFields: PreviousField[];
  onRemove: () => void;
  register: any;
  control: Control<any>;
}

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'in', label: 'is one of' },
  { value: 'not_in', label: 'is not one of' },
];

export function ConditionRow({
  fieldIndex,
  conditionIndex,
  previousFields,
  onRemove,
  register,
  control,
}: ConditionRowProps) {
  // Watch the selected field to populate value options
  const selectedFieldName = useWatch({
    control,
    name: `formFields.${fieldIndex}.conditions.${conditionIndex}.field`,
  });

  const selectedOperator = useWatch({
    control,
    name: `formFields.${fieldIndex}.conditions.${conditionIndex}.operator`,
  });

  // Find the selected field's options for the value dropdown
  const selectedField = previousFields.find((f) => f.name === selectedFieldName);
  const hasOptions = selectedField?.options && selectedField.options.length > 0;
  const isMultiValue = selectedOperator === 'in' || selectedOperator === 'not_in';

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
      {/* Field selector */}
      <select
        className="form-input text-sm flex-1 min-w-[120px]"
        {...register(`formFields.${fieldIndex}.conditions.${conditionIndex}.field`)}
      >
        <option value="">Select field...</option>
        {previousFields.map((field) => (
          <option key={field.name} value={field.name}>
            {field.label || field.name}
          </option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        className="form-input text-sm w-[140px]"
        {...register(`formFields.${fieldIndex}.conditions.${conditionIndex}.operator`)}
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value selector */}
      {hasOptions ? (
        isMultiValue ? (
          // Multi-select for 'in' and 'not_in' operators
          <select
            multiple
            className="form-input text-sm flex-1 min-w-[120px] h-[60px]"
            {...register(`formFields.${fieldIndex}.conditions.${conditionIndex}.value`)}
          >
            {selectedField.options!.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          // Single select for 'equals' and 'not_equals'
          <select
            className="form-input text-sm flex-1 min-w-[120px]"
            {...register(`formFields.${fieldIndex}.conditions.${conditionIndex}.value`)}
          >
            <option value="">Select value...</option>
            {selectedField.options!.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )
      ) : (
        // Text input fallback when field has no options
        <input
          type="text"
          className="form-input text-sm flex-1 min-w-[120px]"
          placeholder={isMultiValue ? 'value1, value2' : 'value'}
          {...register(`formFields.${fieldIndex}.conditions.${conditionIndex}.value`)}
        />
      )}

      {/* Delete button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="text-red-500 hover:text-red-700 shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
