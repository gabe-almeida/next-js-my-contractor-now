'use client';

import React, { useState, useCallback } from 'react';
import {
  normalizeEmail,
  cleanEmailInput,
  isValidEmail,
  getEmailValidationError,
} from './utils/emailFormatting';
import { InlineSaveButtons, type InlineConfig } from './InlineSaveButtons';

/**
 * EmailInput - Smart email input with automatic validation
 *
 * WHY: Provides consistent email validation across the app with built-in error messages
 * WHEN: Use for any email field (contacts, leads, customers, etc.)
 * HOW: Drop-in replacement for <input type="email"> - handles validation automatically
 *
 * Features:
 * - Auto-validates on blur with helpful error messages
 * - Removes ALL spaces during typing (emails never have spaces)
 * - Normalizes to lowercase on blur
 * - Built-in validation states (green border when valid)
 * - Optional inline save/discard buttons for detail pages
 *
 * @example
 * // Basic form usage
 * <EmailInput
 *   value={email}
 *   onChange={setEmail}
 *   label="Email Address"
 *   required
 * />
 *
 * @example
 * // With inline save/discard buttons (for detail pages)
 * <EmailInput
 *   value={email}
 *   onChange={setEmail}
 *   label="Email"
 *   inline={{
 *     onSave: () => saveToDatabase(email),
 *     onDiscard: () => setEmail(originalEmail),
 *     hasChanges: email !== originalEmail,
 *     saving: isSaving,
 *     saveSuccess: saved,
 *   }}
 * />
 */

export interface EmailInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  /** Current email value */
  value: string;
  /** Called with the email value (normalized on blur) */
  onChange: (value: string) => void;
  /** Optional label text or React node */
  label?: React.ReactNode;
  /** Show required asterisk on label */
  required?: boolean;
  /** Error message to display (overrides built-in validation) */
  error?: string;
  /** Helper text below input */
  helperText?: string;
  /** Show validation state (valid = green border) */
  showValidation?: boolean;
  /** Normalize email to lowercase on blur (default: true) */
  normalizeOnBlur?: boolean;
  /** Icon component to show on the left */
  icon?: React.ReactNode;
  /** Inline editing config - adds save/discard buttons */
  inline?: InlineConfig;
  /** Color variant: 'orange' for public pages, 'emerald' for affiliate portal */
  variant?: 'orange' | 'emerald';
}

export function EmailInput({
  value,
  onChange,
  label,
  required,
  error: externalError,
  helperText,
  showValidation = false,
  normalizeOnBlur = true,
  icon,
  inline,
  variant = 'orange',
  className = '',
  disabled,
  ...props
}: EmailInputProps) {
  // Track if field has been touched (for validation display)
  const [touched, setTouched] = useState(false);

  // Internal display value
  const [displayValue, setDisplayValue] = useState(value || '');

  // Internal validation error
  const [validationError, setValidationError] = useState<string | null>(null);

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = cleanEmailInput(e.target.value);
      setDisplayValue(cleaned);
      onChange(cleaned);

      // Clear validation error while typing
      if (validationError) {
        setValidationError(null);
      }
    },
    [onChange, validationError]
  );

  // Handle blur - validate and normalize
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true);

      // Normalize on blur if enabled
      let finalValue = displayValue;
      if (normalizeOnBlur && displayValue) {
        finalValue = normalizeEmail(displayValue);
        setDisplayValue(finalValue);
        onChange(finalValue);
      }

      // Validate and set error
      const error = getEmailValidationError(finalValue);
      setValidationError(error);

      // Call any passed onBlur handler
      props.onBlur?.(e);
    },
    [displayValue, normalizeOnBlur, onChange, props]
  );

  // Sync displayValue when value prop changes externally
  React.useEffect(() => {
    if (value !== displayValue) {
      setDisplayValue(value || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Determine which error to show (external takes priority)
  const errorToShow = externalError || (touched ? validationError : null);

  // Validation state
  const isValid = isValidEmail(displayValue);
  const showError = !!errorToShow;
  const showValid = showValidation && touched && isValid && !showError;

  // Build input classes - brand theme based on variant
  // Brand colors: orange for public pages, emerald for affiliate portal
  const brandClasses = variant === 'emerald'
    ? 'border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500'
    : 'border-orange-300 focus:ring-orange-500 focus:border-orange-500';

  const paddingClasses = icon ? 'pl-10 pr-4' : 'px-4';

  const inputClasses = [
    'w-full py-3 border-2 rounded-xl text-sm',
    paddingClasses,
    'focus:outline-none focus:ring-2',
    'transition-colors duration-150',
    disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white',
    showError
      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
      : showValid
        ? 'border-green-400 focus:ring-green-500 focus:border-green-500'
        : brandClasses,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Determine if we need the inline buttons layout
  const hasInline = !!inline;
  const inlinePosition = inline?.position || 'right';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && typeof label === 'string' && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Wrap in relative container for inline buttons positioning */}
      <div className={hasInline && inlinePosition === 'right' ? 'relative' : ''}>
        <div className={hasInline && inlinePosition === 'right' ? 'pr-24' : ''}>
          <div className="relative">
            {icon && (
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {icon}
              </div>
            )}
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={displayValue}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={disabled}
              className={inputClasses}
              placeholder="email@example.com"
              {...props}
            />
          </div>
        </div>

        {/* Inline save/discard buttons */}
        {hasInline && inlinePosition === 'right' && (
          <InlineSaveButtons config={inline} hasValue={!!displayValue.trim()} />
        )}
      </div>

      {/* Inline buttons below (alternative position) */}
      {hasInline && inlinePosition === 'below' && (
        <InlineSaveButtons config={inline} hasValue={!!displayValue.trim()} />
      )}

      {/* Error message */}
      {showError && <p className="mt-1 text-sm text-red-600">{errorToShow}</p>}

      {/* Helper text (only show if no error) */}
      {helperText && !showError && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

export default EmailInput;
