'use client';

import React from 'react';
import { FormFieldOption } from '@/types/forms';
import { cn } from '@/utils/cn';

interface CheckboxInputProps {
  id: string;
  name: string;
  value: string[];
  onChange: (value: string[]) => void;
  onBlur?: () => void;
  options: FormFieldOption[];
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export function CheckboxInput({
  id,
  name,
  value = [],
  onChange,
  onBlur,
  options,
  disabled = false,
  className,
  ...ariaProps
}: CheckboxInputProps) {
  const handleChange = (optionValue: string, checked: boolean) => {
    const newValue = checked
      ? [...value, optionValue]
      : value.filter(v => v !== optionValue);
    onChange(newValue);
  };

  const handleBlur = () => {
    onBlur?.();
  };

  const wrapperClassName = cn(
    'space-y-3',
    className
  );

  return (
    <div 
      className={wrapperClassName}
      role="group"
      aria-labelledby={`${id}-label`}
      {...ariaProps}
    >
      {options.map((option, index) => {
        const optionId = `${id}-option-${index}`;
        const isChecked = value.includes(option.value);
        const isDisabled = disabled || option.disabled;

        return (
          <label
            key={option.value}
            htmlFor={optionId}
            className={cn(
              'flex items-center space-x-3 cursor-pointer',
              isDisabled && 'cursor-not-allowed opacity-50'
            )}
          >
            <input
              id={optionId}
              name={name}
              type="checkbox"
              checked={isChecked}
              onChange={(e) => handleChange(option.value, e.target.checked)}
              onBlur={handleBlur}
              disabled={isDisabled}
              className={cn(
                // Base styles
                'h-4 w-4 rounded border-gray-300 text-blue-600',
                'focus:ring-2 focus:ring-blue-500 focus:ring-offset-0',
                'transition-colors duration-200',
                
                // Disabled styles
                isDisabled && 'cursor-not-allowed',
                
                // Error styles
                ariaProps['aria-invalid'] && 'border-red-300'
              )}
            />
            <span className={cn(
              'text-sm text-gray-900 select-none',
              isDisabled && 'text-gray-500'
            )}>
              {option.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// Single checkbox variant for boolean values
export function SingleCheckbox({
  id,
  name,
  value = false,
  onChange,
  onBlur,
  label,
  description,
  disabled = false,
  className,
  ...ariaProps
}: {
  id: string;
  name: string;
  value: boolean;
  onChange: (value: boolean) => void;
  onBlur?: () => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  const handleBlur = () => {
    onBlur?.();
  };

  return (
    <div className={cn('flex items-start space-x-3', className)}>
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        className={cn(
          // Base styles
          'h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600',
          'focus:ring-2 focus:ring-blue-500 focus:ring-offset-0',
          'transition-colors duration-200',
          
          // Disabled styles
          disabled && 'cursor-not-allowed opacity-50',
          
          // Error styles
          ariaProps['aria-invalid'] && 'border-red-300'
        )}
        {...ariaProps}
      />
      <div className="flex-1">
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-medium text-gray-900 cursor-pointer select-none',
            disabled && 'cursor-not-allowed text-gray-500'
          )}
        >
          {label}
        </label>
        {description && (
          <p className="mt-1 text-xs text-gray-600">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}