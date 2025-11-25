'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface TextInputProps {
  id: string;
  name: string;
  type?: 'text' | 'email' | 'tel' | 'url' | 'password';
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export function TextInput({
  id,
  name,
  type = 'text',
  value = '',
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  className,
  ...ariaProps
}: TextInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleBlur = () => {
    onBlur();
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
    
    className
  );

  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={inputClassName}
      autoComplete={getAutoComplete(name, type)}
      {...ariaProps}
    />
  );
}

// Helper function to set appropriate autocomplete values
function getAutoComplete(name: string, type: string): string {
  const nameMap: Record<string, string> = {
    email: 'email',
    firstName: 'given-name',
    lastName: 'family-name',
    fullName: 'name',
    phone: 'tel',
    address: 'street-address',
    city: 'address-level2',
    state: 'address-level1',
    zip: 'postal-code',
    country: 'country-name',
    company: 'organization'
  };

  const typeMap: Record<string, string> = {
    email: 'email',
    tel: 'tel'
  };

  return nameMap[name] || typeMap[type] || 'off';
}