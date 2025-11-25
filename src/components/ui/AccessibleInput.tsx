'use client';

import React, { forwardRef, useId, memo } from 'react';
import { cn } from '@/utils/cn';

interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  fullWidth?: boolean;
  variant?: 'default' | 'filled' | 'outlined';
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  labelVisible?: boolean;
  containerClassName?: string;
}

export const AccessibleInput = memo(forwardRef<HTMLInputElement, AccessibleInputProps>(
  ({
    label,
    error,
    helperText,
    required,
    fullWidth = true,
    variant = 'default',
    startIcon,
    endIcon,
    labelVisible = true,
    containerClassName,
    className,
    id,
    'aria-describedby': ariaDescribedBy,
    ...props
  }, ref) => {
    const inputId = useId();
    const finalId = id || inputId;
    const errorId = `${finalId}-error`;
    const helperId = `${finalId}-helper`;

    const describedBy = [
      error ? errorId : null,
      helperText ? helperId : null,
      ariaDescribedBy
    ].filter(Boolean).join(' ') || undefined;

    const inputClasses = cn(
      // Base styles
      'block w-full rounded-md border text-sm transition-colors duration-200',
      'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'placeholder:text-gray-400',
      
      // Variant styles
      variant === 'default' && [
        'border-gray-300 bg-white px-3 py-2',
        'hover:border-gray-400',
        error && 'border-red-300 focus:border-red-500 focus:ring-red-500'
      ],
      variant === 'filled' && [
        'border-transparent bg-gray-50 px-3 py-2',
        'hover:bg-gray-100',
        'focus:bg-white focus:border-blue-500',
        error && 'bg-red-50 focus:bg-white focus:border-red-500 focus:ring-red-500'
      ],
      variant === 'outlined' && [
        'border-2 border-gray-200 bg-transparent px-3 py-2',
        'hover:border-gray-300',
        error && 'border-red-300 focus:border-red-500 focus:ring-red-500'
      ],
      
      // Icon padding
      startIcon && 'pl-10',
      endIcon && 'pr-10',
      
      // Width
      !fullWidth && 'w-auto',
      
      className
    );

    return (
      <div className={cn('relative', containerClassName)}>
        {/* Label */}
        <label
          htmlFor={finalId}
          className={cn(
            'block text-sm font-medium text-gray-700 mb-1',
            !labelVisible && 'sr-only',
            required && "after:content-['*'] after:ml-1 after:text-red-500"
          )}
        >
          {label}
        </label>

        {/* Input container */}
        <div className="relative">
          {/* Start icon */}
          {startIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400 sm:text-sm" aria-hidden="true">
                {startIcon}
              </span>
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={finalId}
            className={inputClasses}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={describedBy}
            aria-required={required}
            {...props}
          />

          {/* End icon */}
          {endIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <span className="text-gray-400 sm:text-sm" aria-hidden="true">
                {endIcon}
              </span>
            </div>
          )}
        </div>

        {/* Helper text */}
        {helperText && !error && (
          <p id={helperId} className="mt-1 text-sm text-gray-500">
            {helperText}
          </p>
        )}

        {/* Error message */}
        {error && (
          <p
            id={errorId}
            className="mt-1 text-sm text-red-600"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
));

AccessibleInput.displayName = 'AccessibleInput';

// Specialized input components with built-in accessibility
export const AccessibleEmailInput = memo(forwardRef<HTMLInputElement, Omit<AccessibleInputProps, 'type'>>(
  (props, ref) => (
    <AccessibleInput
      ref={ref}
      type="email"
      autoComplete="email"
      inputMode="email"
      {...props}
    />
  )
));

export const AccessiblePhoneInput = memo(forwardRef<HTMLInputElement, Omit<AccessibleInputProps, 'type'>>(
  (props, ref) => (
    <AccessibleInput
      ref={ref}
      type="tel"
      autoComplete="tel"
      inputMode="tel"
      {...props}
    />
  )
));

export const AccessiblePasswordInput = memo(forwardRef<HTMLInputElement, Omit<AccessibleInputProps, 'type'>>(
  (props, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const toggleVisibility = () => {
      setShowPassword(!showPassword);
    };

    return (
      <AccessibleInput
        ref={ref}
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        endIcon={
          <button
            type="button"
            onClick={toggleVisibility}
            className="hover:text-gray-600 focus:outline-none focus:text-gray-600"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        }
        {...props}
      />
    );
  }
));

AccessibleEmailInput.displayName = 'AccessibleEmailInput';
AccessiblePhoneInput.displayName = 'AccessiblePhoneInput';
AccessiblePasswordInput.displayName = 'AccessiblePasswordInput';