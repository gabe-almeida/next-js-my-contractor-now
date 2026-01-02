'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface DateInputProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export function DateInput({
  id,
  name,
  value = '',
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  min,
  max,
  className,
  ...ariaProps
}: DateInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleBlur = () => {
    onBlur?.();
  };

  const inputClassName = cn(
    // Base styles
    'w-full px-3 py-2 border rounded-md shadow-sm transition-colors duration-200',
    'text-gray-900 placeholder-gray-500',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    
    // Border styles
    'border-gray-300',
    
    // Disabled styles
    disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
    
    // Error styles (handled by parent)
    ariaProps['aria-invalid'] && 'border-red-300 focus:ring-red-500 focus:border-red-500',
    
    // Mobile responsive
    'text-base md:text-sm',
    
    // Date input specific styles
    '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
    '[&::-webkit-calendar-picker-indicator]:opacity-60',
    '[&::-webkit-calendar-picker-indicator]:hover:opacity-100',
    
    className
  );

  return (
    <input
      id={id}
      name={name}
      type="date"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      className={inputClassName}
      {...ariaProps}
    />
  );
}

// Specialized date inputs
export function DateOfBirthInput(props: Omit<DateInputProps, 'max'>) {
  const today = new Date().toISOString().split('T')[0];
  const minDate = new Date(Date.now() - 120 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 120 years ago
  
  return (
    <DateInput
      {...props}
      max={today}
      min={minDate}
    />
  );
}

export function FutureDateInput(props: Omit<DateInputProps, 'min'>) {
  const today = new Date().toISOString().split('T')[0];
  
  return (
    <DateInput
      {...props}
      min={today}
    />
  );
}

export function DateRangeInput({
  startId,
  endId,
  startName,
  endName,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  onStartBlur,
  onEndBlur,
  startLabel = 'Start Date',
  endLabel = 'End Date',
  disabled = false,
  className,
  startProps = {},
  endProps = {}
}: {
  startId: string;
  endId: string;
  startName: string;
  endName: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onStartBlur: () => void;
  onEndBlur: () => void;
  startLabel?: string;
  endLabel?: string;
  disabled?: boolean;
  className?: string;
  startProps?: Partial<DateInputProps>;
  endProps?: Partial<DateInputProps>;
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', className)}>
      <div>
        <label htmlFor={startId} className="block text-sm font-medium text-gray-900 mb-2">
          {startLabel}
        </label>
        <DateInput
          id={startId}
          name={startName}
          value={startValue}
          onChange={onStartChange}
          onBlur={onStartBlur}
          disabled={disabled}
          max={endValue || undefined}
          {...startProps}
        />
      </div>
      
      <div>
        <label htmlFor={endId} className="block text-sm font-medium text-gray-900 mb-2">
          {endLabel}
        </label>
        <DateInput
          id={endId}
          name={endName}
          value={endValue}
          onChange={onEndChange}
          onBlur={onEndBlur}
          disabled={disabled}
          min={startValue || undefined}
          {...endProps}
        />
      </div>
    </div>
  );
}