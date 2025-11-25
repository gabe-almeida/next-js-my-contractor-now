'use client';

import React from 'react';
import { FormFieldOption } from '@/types/forms';
import { cn } from '@/utils/cn';

interface RadioInputProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  options: FormFieldOption[];
  disabled?: boolean;
  layout?: 'vertical' | 'horizontal';
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export function RadioInput({
  id,
  name,
  value = '',
  onChange,
  onBlur,
  options,
  disabled = false,
  layout = 'vertical',
  className,
  ...ariaProps
}: RadioInputProps) {
  const handleChange = (optionValue: string) => {
    onChange(optionValue);
  };

  const handleBlur = () => {
    onBlur();
  };

  const wrapperClassName = cn(
    layout === 'vertical' ? 'space-y-3' : 'flex flex-wrap gap-4',
    className
  );

  return (
    <div 
      className={wrapperClassName}
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      {...ariaProps}
    >
      {options.map((option, index) => {
        const optionId = `${id}-option-${index}`;
        const isChecked = value === option.value;
        const isDisabled = disabled || option.disabled;

        return (
          <label
            key={option.value}
            htmlFor={optionId}
            className={cn(
              'flex items-center space-x-3 cursor-pointer',
              isDisabled && 'cursor-not-allowed opacity-50',
              layout === 'horizontal' && 'flex-shrink-0'
            )}
          >
            <input
              id={optionId}
              name={name}
              type="radio"
              value={option.value}
              checked={isChecked}
              onChange={() => handleChange(option.value)}
              onBlur={handleBlur}
              disabled={isDisabled}
              className={cn(
                // Base styles
                'h-4 w-4 border-gray-300 text-blue-600',
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

// Card-style radio input for better visual hierarchy
export function RadioCardInput({
  id,
  name,
  value = '',
  onChange,
  onBlur,
  options,
  disabled = false,
  className,
  ...ariaProps
}: RadioInputProps) {
  const handleChange = (optionValue: string) => {
    onChange(optionValue);
  };

  const handleBlur = () => {
    onBlur();
  };

  return (
    <div 
      className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      {...ariaProps}
    >
      {options.map((option, index) => {
        const optionId = `${id}-option-${index}`;
        const isChecked = value === option.value;
        const isDisabled = disabled || option.disabled;

        return (
          <label
            key={option.value}
            htmlFor={optionId}
            className={cn(
              'relative flex cursor-pointer rounded-lg border p-4 transition-all duration-200',
              'focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2',
              
              // Checked state
              isChecked 
                ? 'border-blue-600 bg-blue-50 text-blue-900' 
                : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
              
              // Disabled state
              isDisabled && 'cursor-not-allowed opacity-50',
              
              // Error state
              ariaProps['aria-invalid'] && !isChecked && 'border-red-300'
            )}
          >
            <input
              id={optionId}
              name={name}
              type="radio"
              value={option.value}
              checked={isChecked}
              onChange={() => handleChange(option.value)}
              onBlur={handleBlur}
              disabled={isDisabled}
              className="sr-only"
            />
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center">
                <div className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border-2',
                  isChecked 
                    ? 'border-blue-600 bg-blue-600' 
                    : 'border-gray-300 bg-white'
                )}>
                  {isChecked && (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  )}
                </div>
                <div className="ml-3">
                  <span className="block text-sm font-medium">
                    {option.label}
                  </span>
                </div>
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}