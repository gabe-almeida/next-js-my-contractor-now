'use client';

import React, { useState, useCallback } from 'react';
import {
  formatCurrency,
  formatCurrencyWhileTyping,
  cleanCurrencyValue,
  restrictCurrencyInput,
  isValidCurrency,
} from './utils/currencyFormatting';
import { InlineSaveButtons, type InlineConfig } from './InlineSaveButtons';

/**
 * CurrencyInput - Smart currency input with automatic comma formatting
 *
 * WHY: Provides consistent currency formatting ($1,234.56) across the app
 * WHEN: Use for any money/dollar amount field (prices, costs, payments, etc.)
 * HOW: Drop-in replacement for number inputs - handles formatting automatically
 *
 * Features:
 * - Auto-formats with commas and $ on blur: $1,234.56
 * - Live formatting while typing (commas update as you type)
 * - Restricts invalid characters
 * - Returns clean numeric string for database storage via onChange
 *
 * @example
 * // Basic form usage
 * <CurrencyInput
 *   value={price}
 *   onChange={(cleanValue) => setPrice(cleanValue)}
 *   label="Price"
 *   required
 * />
 *
 * @example
 * // With min/max validation
 * <CurrencyInput
 *   value={budget}
 *   onChange={(cleanValue) => setBudget(cleanValue)}
 *   label="Budget"
 *   min={100}
 *   max={10000}
 *   showValidation
 * />
 *
 * @example
 * // With inline save/discard buttons (for detail pages)
 * <CurrencyInput
 *   value={amount}
 *   onChange={(cleanValue) => setAmount(cleanValue)}
 *   label="Amount"
 *   inline={{
 *     onSave: () => saveToDatabase(amount),
 *     onDiscard: () => setAmount(originalAmount),
 *     hasChanges: amount !== originalAmount,
 *   }}
 * />
 */

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'min' | 'max'> {
  /** Current value (can be formatted or clean numeric string) */
  value: string | number;
  /** Called with cleanValue - use for database storage */
  onChange: (cleanValue: string) => void;
  /** Optional label text or React node */
  label?: React.ReactNode;
  /** Show required asterisk on label */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Helper text below input */
  helperText?: string;
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Show validation state (valid = green border) */
  showValidation?: boolean;
  /** Number of decimal places (default: 2) */
  decimals?: number;
  /** Inline editing config - adds save/discard buttons */
  inline?: InlineConfig;
  /** Color variant: 'orange' for public pages, 'emerald' for affiliate portal */
  variant?: 'orange' | 'emerald';
}

export function CurrencyInput({
  value,
  onChange,
  label,
  required,
  error,
  helperText,
  min,
  max,
  showValidation = false,
  decimals = 2,
  inline,
  variant = 'orange',
  className = '',
  disabled,
  ...props
}: CurrencyInputProps) {
  // Track if field has been touched (for validation display)
  const [touched, setTouched] = useState(false);

  // Internal display value
  const [displayValue, setDisplayValue] = useState(() =>
    formatCurrency(String(value), true, decimals)
  );

  // Handle input change - format with commas while typing
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const restricted = restrictCurrencyInput(e.target.value);
      const formatted = formatCurrencyWhileTyping(restricted);
      setDisplayValue(formatted);

      // Send clean value to parent
      const clean = cleanCurrencyValue(formatted);
      onChange(clean);
    },
    [onChange]
  );

  // Handle blur - fully format the number
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true);

      const clean = cleanCurrencyValue(displayValue);
      const formatted = formatCurrency(clean, true, decimals);
      setDisplayValue(formatted);

      // Send clean value
      onChange(clean);

      // Call any passed onBlur handler
      props.onBlur?.(e);
    },
    [displayValue, onChange, decimals, props]
  );

  // Handle focus - select all for easy replacement
  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.select();
      props.onFocus?.(e);
    },
    [props]
  );

  // Sync displayValue when value prop changes externally
  React.useEffect(() => {
    const formatted = formatCurrency(String(value), true, decimals);
    if (formatted !== displayValue) {
      setDisplayValue(formatted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals]);

  // Validation state
  const isValid = isValidCurrency(displayValue, min, max);
  const showError = touched && error;
  const showValid = showValidation && touched && isValid && !error;

  // Range error message
  const rangeError =
    touched && !error && !isValid
      ? min !== undefined && max !== undefined
        ? `Value must be between $${min.toLocaleString()} and $${max.toLocaleString()}`
        : min !== undefined
          ? `Value must be at least $${min.toLocaleString()}`
          : max !== undefined
            ? `Value must be at most $${max.toLocaleString()}`
            : undefined
      : undefined;

  const displayError = error || rangeError;

  // Build input classes - brand theme based on variant
  // Brand colors: orange for public pages, emerald for affiliate portal
  const brandClasses = variant === 'emerald'
    ? 'border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500'
    : 'border-orange-300 focus:ring-orange-500 focus:border-orange-500';

  const inputClasses = [
    'w-full px-4 py-3 border-2 rounded-xl text-sm',
    'focus:outline-none focus:ring-2',
    'transition-colors duration-150',
    disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white',
    displayError
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
          <input
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            disabled={disabled}
            className={inputClasses}
            placeholder="$0.00"
            {...props}
          />
        </div>

        {/* Inline save/discard buttons */}
        {hasInline && inlinePosition === 'right' && (
          <InlineSaveButtons config={inline} hasValue={!!cleanCurrencyValue(displayValue)} />
        )}
      </div>

      {/* Inline buttons below (alternative position) */}
      {hasInline && inlinePosition === 'below' && (
        <InlineSaveButtons config={inline} hasValue={!!cleanCurrencyValue(displayValue)} />
      )}

      {/* Error message */}
      {displayError && <p className="mt-1 text-sm text-red-600">{displayError}</p>}

      {/* Helper text (only show if no error) */}
      {helperText && !displayError && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

export default CurrencyInput;
