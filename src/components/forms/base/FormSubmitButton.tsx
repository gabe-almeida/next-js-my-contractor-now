'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface FormSubmitButtonProps {
  children: React.ReactNode;
  isSubmitting: boolean;
  isValid: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  loadingText?: string;
  type?: 'submit' | 'button';
  onClick?: () => void;
}

export function FormSubmitButton({
  children,
  isSubmitting,
  isValid,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className,
  loadingText = 'Submitting...',
  type = 'submit',
  onClick
}: FormSubmitButtonProps) {
  const isDisabled = disabled || !isValid || isSubmitting;

  const baseClasses = [
    'inline-flex items-center justify-center',
    'font-medium rounded-md transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'relative overflow-hidden'
  ];

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const variantClasses = {
    primary: [
      'bg-blue-600 text-white border border-blue-600',
      'hover:bg-blue-700 hover:border-blue-700',
      'focus:ring-blue-500',
      'disabled:bg-gray-300 disabled:border-gray-300'
    ],
    secondary: [
      'bg-gray-600 text-white border border-gray-600',
      'hover:bg-gray-700 hover:border-gray-700',
      'focus:ring-gray-500',
      'disabled:bg-gray-300 disabled:border-gray-300'
    ],
    success: [
      'bg-green-600 text-white border border-green-600',
      'hover:bg-green-700 hover:border-green-700',
      'focus:ring-green-500',
      'disabled:bg-gray-300 disabled:border-gray-300'
    ],
    danger: [
      'bg-red-600 text-white border border-red-600',
      'hover:bg-red-700 hover:border-red-700',
      'focus:ring-red-500',
      'disabled:bg-gray-300 disabled:border-gray-300'
    ]
  };

  const buttonClassName = cn(
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    className
  );

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={buttonClassName}
      aria-describedby="submit-button-status"
    >
      {/* Loading Spinner */}
      {isSubmitting && (
        <svg 
          className="animate-spin -ml-1 mr-3 h-4 w-4" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}

      {/* Button Text */}
      <span className={cn(isSubmitting && 'opacity-75')}>
        {isSubmitting ? loadingText : children}
      </span>

      {/* Hidden status for screen readers */}
      <span id="submit-button-status" className="sr-only">
        {isSubmitting 
          ? 'Form is being submitted' 
          : !isValid 
            ? 'Form has validation errors' 
            : 'Form is ready to submit'
        }
      </span>
    </button>
  );
}

// Preset button variants for common use cases
export function SubmitButton(props: Omit<FormSubmitButtonProps, 'variant'>) {
  return <FormSubmitButton {...props} variant="primary" />;
}

export function SaveButton(props: Omit<FormSubmitButtonProps, 'variant' | 'children'>) {
  return (
    <FormSubmitButton {...props} variant="secondary">
      Save
    </FormSubmitButton>
  );
}

export function PublishButton(props: Omit<FormSubmitButtonProps, 'variant' | 'children'>) {
  return (
    <FormSubmitButton {...props} variant="success">
      Publish
    </FormSubmitButton>
  );
}

export function DeleteButton(props: Omit<FormSubmitButtonProps, 'variant' | 'children'>) {
  return (
    <FormSubmitButton {...props} variant="danger" type="button">
      Delete
    </FormSubmitButton>
  );
}