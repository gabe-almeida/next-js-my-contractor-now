'use client';

import React from 'react';
import { FormFieldProps } from '@/types/forms';
import { TextInput } from './inputs/TextInput';
import { SelectInput } from './inputs/SelectInput';
import { TextareaInput } from './inputs/TextareaInput';
import { CheckboxInput } from './inputs/CheckboxInput';
import { RadioInput } from './inputs/RadioInput';
import { NumberInput } from './inputs/NumberInput';
import { DateInput } from './inputs/DateInput';
import { MultiSelectInput } from './inputs/MultiSelectInput';

export function FormField({
  field,
  value,
  error,
  touched,
  onChange,
  onBlur,
  disabled = false,
  className = ''
}: FormFieldProps) {
  const fieldId = `field-${field.id}`;
  const hasError = touched && error;

  const baseClassName = `
    form-field-wrapper
    ${className}
    ${field.gridColumn || 'col-span-1'}
    ${hasError ? 'field-error' : ''}
    ${disabled ? 'field-disabled' : ''}
  `;

  const renderField = () => {
    const commonProps = {
      id: fieldId,
      name: field.name,
      value,
      onChange,
      onBlur,
      disabled,
      placeholder: field.placeholder,
      'aria-describedby': field.description ? `${fieldId}-description` : undefined,
      'aria-invalid': !!hasError,
      'aria-required': field.required
    };

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        return <TextInput {...commonProps} type={field.type} />;
      
      case 'number':
        return <NumberInput {...commonProps} />;
      
      case 'date':
        return <DateInput {...commonProps} />;
      
      case 'textarea':
        return <TextareaInput {...commonProps} />;
      
      case 'select':
        return (
          <SelectInput 
            {...commonProps} 
            options={field.options || []}
          />
        );
      
      case 'multiselect':
        return (
          <MultiSelectInput 
            {...commonProps} 
            options={field.options || []}
          />
        );
      
      case 'radio':
        return (
          <RadioInput 
            {...commonProps} 
            options={field.options || []}
          />
        );
      
      case 'checkbox':
        return (
          <CheckboxInput 
            {...commonProps} 
            options={field.options || []}
          />
        );
      
      default:
        return <TextInput {...commonProps} type="text" />;
    }
  };

  return (
    <div className={baseClassName}>
      {/* Field Label */}
      <label 
        htmlFor={fieldId}
        className="form-label block text-sm font-medium text-gray-900 mb-2"
      >
        {field.label}
        {field.required && (
          <span className="text-red-500 ml-1" aria-label="required">*</span>
        )}
      </label>

      {/* Field Description */}
      {field.description && (
        <p 
          id={`${fieldId}-description`}
          className="form-description text-sm text-gray-600 mb-2"
        >
          {field.description}
        </p>
      )}

      {/* Field Input */}
      <div className="form-input-wrapper">
        {renderField()}
      </div>

      {/* Error Message */}
      {hasError && (
        <div 
          className="form-error mt-2 text-sm text-red-600"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
}

// HOC for field validation and formatting
export function withFieldEnhancements<T extends FormFieldProps>(
  WrappedComponent: React.ComponentType<T>
) {
  return function EnhancedField(props: T) {
    const { field, value, onChange } = props;

    const handleChange = (newValue: any) => {
      let processedValue = newValue;

      // Auto-formatting based on field type
      if (field.type === 'tel' && typeof newValue === 'string') {
        // Format phone number
        const digits = newValue.replace(/\D/g, '');
        if (digits.length <= 10) {
          if (digits.length >= 6) {
            processedValue = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
          } else if (digits.length >= 3) {
            processedValue = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
          } else {
            processedValue = digits;
          }
        }
      }

      if (field.type === 'text' && field.name.includes('zip') && typeof newValue === 'string') {
        // Format ZIP code
        const digits = newValue.replace(/\D/g, '');
        if (digits.length <= 9) {
          if (digits.length > 5) {
            processedValue = `${digits.slice(0, 5)}-${digits.slice(5)}`;
          } else {
            processedValue = digits;
          }
        }
      }

      onChange(processedValue);
    };

    return <WrappedComponent {...props} onChange={handleChange} />;
  };
}

// Enhanced FormField with auto-formatting
export const EnhancedFormField = withFieldEnhancements(FormField);