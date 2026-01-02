'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface NumberInputProps {
  id: string;
  name: string;
  value: number | string;
  onChange: (value: number | string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  prefix?: string;
  suffix?: string;
  allowNegative?: boolean;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export function NumberInput({
  id,
  name,
  value = '',
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  min,
  max,
  step = 1,
  precision = 0,
  prefix,
  suffix,
  allowNegative = true,
  className,
  ...ariaProps
}: NumberInputProps) {
  const formatValue = (val: number | string): string => {
    if (val === '' || val === null || val === undefined) return '';
    
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '';
    
    return num.toFixed(precision);
  };

  const parseValue = (val: string): number | string => {
    if (val === '') return '';
    
    // Remove non-numeric characters except decimal point and minus
    let cleaned = val.replace(/[^\d.-]/g, '');
    
    // Handle negative numbers
    if (!allowNegative) {
      cleaned = cleaned.replace(/-/g, '');
    } else {
      // Only allow one minus sign at the beginning
      const parts = cleaned.split('-');
      if (parts.length > 2) {
        cleaned = '-' + parts.slice(1).join('');
      }
    }
    
    // Only allow one decimal point
    const decimalParts = cleaned.split('.');
    if (decimalParts.length > 2) {
      cleaned = decimalParts[0] + '.' + decimalParts.slice(1).join('');
    }
    
    const num = parseFloat(cleaned);
    if (isNaN(num)) return '';
    
    // Apply min/max constraints
    if (min !== undefined && num < min) return min;
    if (max !== undefined && num > max) return max;
    
    return num;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsedValue = parseValue(e.target.value);
    onChange(parsedValue);
  };

  const handleBlur = () => {
    // Format the value on blur
    if (value !== '' && !isNaN(Number(value))) {
      const formatted = formatValue(value);
      if (formatted !== value.toString()) {
        onChange(parseFloat(formatted));
      }
    }
    onBlur?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter
    if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
        (e.keyCode === 65 && e.ctrlKey) ||
        (e.keyCode === 67 && e.ctrlKey) ||
        (e.keyCode === 86 && e.ctrlKey) ||
        (e.keyCode === 88 && e.ctrlKey) ||
        (e.keyCode === 90 && e.ctrlKey) ||
        // Allow: home, end, left, right, down, up
        (e.keyCode >= 35 && e.keyCode <= 40)) {
      return;
    }
    
    // Ensure that it is a number and stop the keypress
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && 
        (e.keyCode < 96 || e.keyCode > 105) &&
        // Allow decimal point
        e.keyCode !== 190 && e.keyCode !== 110 &&
        // Allow minus sign if negative numbers are allowed
        !(allowNegative && e.keyCode === 189)) {
      e.preventDefault();
    }
  };

  const inputClassName = cn(
    // Base styles
    'w-full border rounded-md shadow-sm transition-colors duration-200',
    'text-gray-900 placeholder-gray-500',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    
    // Padding adjustments for prefix/suffix
    prefix && !suffix ? 'pl-12 pr-3 py-2' :
    !prefix && suffix ? 'pl-3 pr-12 py-2' :
    prefix && suffix ? 'pl-12 pr-12 py-2' :
    'px-3 py-2',
    
    // Border styles
    'border-gray-300',
    
    // Disabled styles
    disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
    
    // Error styles (handled by parent)
    ariaProps['aria-invalid'] && 'border-red-300 focus:ring-red-500 focus:border-red-500',
    
    // Mobile responsive
    'text-base md:text-sm',
    
    className
  );

  return (
    <div className="relative">
      {prefix && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-gray-500 text-base md:text-sm">{prefix}</span>
        </div>
      )}
      
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={inputClassName}
        {...ariaProps}
      />
      
      {suffix && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <span className="text-gray-500 text-base md:text-sm">{suffix}</span>
        </div>
      )}
    </div>
  );
}

// Specialized number inputs
export function CurrencyInput(props: Omit<NumberInputProps, 'prefix' | 'precision'>) {
  return (
    <NumberInput
      {...props}
      prefix="$"
      precision={2}
      min={0}
      allowNegative={false}
    />
  );
}

export function PercentageInput(props: Omit<NumberInputProps, 'suffix' | 'max' | 'min'>) {
  return (
    <NumberInput
      {...props}
      suffix="%"
      min={0}
      max={100}
      precision={1}
    />
  );
}