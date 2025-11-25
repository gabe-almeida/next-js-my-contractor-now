'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface TextareaInputProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export function TextareaInput({
  id,
  name,
  value = '',
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  rows = 4,
  maxLength,
  className,
  ...ariaProps
}: TextareaInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleBlur = () => {
    onBlur();
  };

  const textareaClassName = cn(
    // Base styles
    'w-full px-3 py-2 border rounded-md shadow-sm transition-colors duration-200',
    'text-gray-900 placeholder-gray-500 resize-vertical',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    
    // Border styles
    'border-gray-300',
    
    // Disabled styles
    disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed resize-none',
    
    // Error styles (handled by parent)
    ariaProps['aria-invalid'] && 'border-red-300 focus:ring-red-500 focus:border-red-500',
    
    // Mobile responsive
    'text-base md:text-sm',
    
    className
  );

  const showCharacterCount = maxLength && maxLength > 0;
  const characterCount = value.length;
  const isNearLimit = showCharacterCount && characterCount > maxLength * 0.8;
  const isOverLimit = showCharacterCount && characterCount > maxLength;

  return (
    <div className="w-full">
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        className={textareaClassName}
        {...ariaProps}
      />
      
      {showCharacterCount && (
        <div className={cn(
          'mt-1 text-xs text-right',
          isOverLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-500'
        )}>
          {characterCount}{maxLength && `/${maxLength}`}
        </div>
      )}
    </div>
  );
}