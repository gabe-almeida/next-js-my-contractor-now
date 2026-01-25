'use client';

/**
 * PhoneInput - Smart phone number input with automatic formatting
 *
 * WHY: Provides consistent phone formatting across the app with built-in validation
 * WHEN: Use for any phone number field (contacts, leads, affiliates, etc.)
 * HOW: Drop-in replacement for <input type="tel"> - handles formatting automatically
 *
 * Features:
 * - Auto-formats on blur: (978) 798-0276
 * - Restricts invalid characters during typing
 * - Returns clean digits for database storage via onChange
 * - Visual validation feedback (green/red border)
 *
 * @example
 * // Basic form usage
 * <PhoneInput
 *   value={phone}
 *   onChange={(cleanValue) => setPhone(cleanValue)}
 *   label="Phone Number"
 *   required
 * />
 *
 * // With error handling
 * <PhoneInput
 *   value={phone}
 *   onChange={(cleanValue) => setPhone(cleanValue)}
 *   label="Phone"
 *   error={errors.phone}
 *   showValidation
 * />
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  formatPhoneForDisplay,
  cleanPhoneNumber,
  restrictPhoneInput,
  isValidUSPhoneNumber,
} from '@/lib/utils/phone';

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  /** Current phone value (can be formatted or clean) */
  value: string;
  /** Called with clean digits value - use for database storage */
  onChange: (cleanValue: string) => void;
  /** Optional label text */
  label?: string;
  /** Show required asterisk on label */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Helper text below input */
  helperText?: string;
  /** Show validation state (valid = green border) */
  showValidation?: boolean;
  /** Icon component to show on the left */
  icon?: React.ReactNode;
}

export function PhoneInput({
  value,
  onChange,
  label,
  required,
  error,
  helperText,
  showValidation = false,
  icon,
  className = '',
  disabled,
  ...props
}: PhoneInputProps) {
  // Track if field has been touched (for validation display)
  const [touched, setTouched] = useState(false);

  // Internal display value (may be partially formatted during typing)
  const [displayValue, setDisplayValue] = useState(() => formatPhoneForDisplay(value));

  // Handle input change - restrict characters but don't fully format yet
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const restricted = restrictPhoneInput(e.target.value);
      setDisplayValue(restricted);

      // Always send clean value to parent
      const clean = cleanPhoneNumber(restricted);
      onChange(clean);
    },
    [onChange]
  );

  // Handle blur - format the number nicely
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true);

      const formatted = formatPhoneForDisplay(displayValue);
      setDisplayValue(formatted);

      // Send clean value
      const clean = cleanPhoneNumber(formatted);
      onChange(clean);

      // Call any passed onBlur handler
      props.onBlur?.(e);
    },
    [displayValue, onChange, props]
  );

  // Sync displayValue when value prop changes externally
  useEffect(() => {
    const formatted = formatPhoneForDisplay(value);
    if (formatted !== displayValue) {
      setDisplayValue(formatted);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Validation state
  const isValid = isValidUSPhoneNumber(displayValue);
  const showError = (touched || error) && error;
  const showValid = showValidation && touched && isValid && !error;

  // Build input classes
  const baseClasses = 'appearance-none block w-full py-2 border rounded-md placeholder-gray-400 focus:outline-none focus:ring-1 sm:text-sm';
  const paddingClasses = icon ? 'pl-10 pr-3' : 'px-3';
  const stateClasses = showError
    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
    : showValid
      ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
      : 'border-gray-300 focus:ring-emerald-500 focus:border-emerald-500';
  const disabledClasses = disabled ? 'bg-gray-100 cursor-not-allowed' : '';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          className={`${baseClasses} ${paddingClasses} ${stateClasses} ${disabledClasses} ${className}`}
          placeholder="(555) 555-5555"
          {...props}
        />
      </div>

      {/* Error message */}
      {showError && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Helper text (only show if no error) */}
      {helperText && !showError && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

export default PhoneInput;
