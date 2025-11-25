import { FormConditional } from '@/types/forms';

/**
 * Evaluates a form conditional against current form values
 */
export function evaluateConditional(
  conditional: FormConditional,
  values: Record<string, any>
): boolean {
  const fieldValue = values[conditional.field];
  const { operator, value: conditionValue } = conditional;

  // Handle null/undefined field values
  if (fieldValue === null || fieldValue === undefined) {
    return operator === 'notEquals' && conditionValue !== null && conditionValue !== undefined;
  }

  switch (operator) {
    case 'equals':
      return fieldValue === conditionValue;

    case 'notEquals':
      return fieldValue !== conditionValue;

    case 'includes':
      if (Array.isArray(fieldValue)) {
        if (Array.isArray(conditionValue)) {
          return conditionValue.some(val => fieldValue.includes(val));
        }
        return fieldValue.includes(conditionValue);
      }
      if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
        return fieldValue.toLowerCase().includes(conditionValue.toLowerCase());
      }
      return false;

    case 'notIncludes':
      if (Array.isArray(fieldValue)) {
        if (Array.isArray(conditionValue)) {
          return !conditionValue.some(val => fieldValue.includes(val));
        }
        return !fieldValue.includes(conditionValue);
      }
      if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
        return !fieldValue.toLowerCase().includes(conditionValue.toLowerCase());
      }
      return true;

    case 'greaterThan':
      const numFieldValue = Number(fieldValue);
      const numConditionValue = Number(conditionValue);
      if (isNaN(numFieldValue) || isNaN(numConditionValue)) return false;
      return numFieldValue > numConditionValue;

    case 'lessThan':
      const numFieldValue2 = Number(fieldValue);
      const numConditionValue2 = Number(conditionValue);
      if (isNaN(numFieldValue2) || isNaN(numConditionValue2)) return false;
      return numFieldValue2 < numConditionValue2;

    default:
      console.warn(`Unknown conditional operator: ${operator}`);
      return false;
  }
}

/**
 * Evaluates multiple conditionals with AND logic
 */
export function evaluateConditionals(
  conditionals: FormConditional[],
  values: Record<string, any>
): boolean {
  return conditionals.every(conditional => evaluateConditional(conditional, values));
}

/**
 * Evaluates multiple conditionals with OR logic
 */
export function evaluateConditionalsOr(
  conditionals: FormConditional[],
  values: Record<string, any>
): boolean {
  return conditionals.some(conditional => evaluateConditional(conditional, values));
}

/**
 * Helper to create common conditional configurations
 */
export const conditionalHelpers = {
  /**
   * Show field when another field equals a specific value
   */
  showWhenEquals: (field: string, value: any): FormConditional => ({
    field,
    operator: 'equals',
    value
  }),

  /**
   * Show field when another field is not empty
   */
  showWhenNotEmpty: (field: string): FormConditional => ({
    field,
    operator: 'notEquals',
    value: ''
  }),

  /**
   * Show field when another field contains any of the specified values
   */
  showWhenIncludes: (field: string, values: string[]): FormConditional => ({
    field,
    operator: 'includes',
    value: values
  }),

  /**
   * Show field when numeric field is greater than value
   */
  showWhenGreaterThan: (field: string, value: number): FormConditional => ({
    field,
    operator: 'greaterThan',
    value
  }),

  /**
   * Show field when checkbox/multiselect includes specific option
   */
  showWhenSelected: (field: string, option: string): FormConditional => ({
    field,
    operator: 'includes',
    value: option
  }),

  /**
   * Hide field when another field equals a specific value
   */
  hideWhenEquals: (field: string, value: any): FormConditional => ({
    field,
    operator: 'notEquals',
    value
  })
};

/**
 * Get all fields that affect the visibility of a given field
 */
export function getDependentFields(
  fields: Array<{ name: string; conditional?: FormConditional }>,
  targetFieldName: string
): string[] {
  const targetField = fields.find(f => f.name === targetFieldName);
  if (!targetField?.conditional) return [];

  return [targetField.conditional.field];
}

/**
 * Get all fields that are affected by changes to a given field
 */
export function getAffectedFields(
  fields: Array<{ name: string; conditional?: FormConditional }>,
  changedFieldName: string
): string[] {
  return fields
    .filter(field => field.conditional?.field === changedFieldName)
    .map(field => field.name);
}

/**
 * Validate that conditional references exist in the form
 */
export function validateConditionals(
  fields: Array<{ name: string; conditional?: FormConditional }>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const fieldNames = new Set(fields.map(f => f.name));

  fields.forEach(field => {
    if (field.conditional) {
      const { field: referencedField } = field.conditional;
      
      if (!fieldNames.has(referencedField)) {
        errors.push(
          `Field "${field.name}" references non-existent field "${referencedField}" in conditional`
        );
      }

      // Check for circular dependencies
      if (referencedField === field.name) {
        errors.push(
          `Field "${field.name}" has circular dependency in conditional`
        );
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}