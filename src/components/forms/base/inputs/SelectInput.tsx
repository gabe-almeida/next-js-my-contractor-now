'use client';

import React from 'react';
import { FormFieldOption } from '@/types/forms';
import { cn } from '@/utils/cn';

interface SelectInputProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  options: FormFieldOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export function SelectInput({
  id,
  name,
  value = '',
  onChange,
  onBlur,
  options,
  placeholder = 'Select an option',
  disabled = false,
  className,
  ...ariaProps
}: SelectInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  const handleBlur = () => {
    onBlur();
  };

  const selectClassName = cn(
    // Base styles
    'w-full px-3 py-2 border rounded-md shadow-sm transition-colors duration-200',
    'text-gray-900 bg-white',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    
    // Border styles
    'border-gray-300',
    
    // Disabled styles
    disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
    
    // Error styles (handled by parent)
    ariaProps['aria-invalid'] && 'border-red-300 focus:ring-red-500 focus:border-red-500',
    
    // Mobile responsive
    'text-base md:text-sm',
    
    // Custom select arrow
    'appearance-none bg-no-repeat bg-right bg-[length:16px_16px] pr-8',
    'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")]',
    
    className
  );

  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      className={selectClassName}
      {...ariaProps}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}