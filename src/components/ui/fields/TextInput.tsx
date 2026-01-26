'use client';

import React, { useState, useCallback } from 'react';
import { InlineSaveButtons, type InlineConfig } from './InlineSaveButtons';

/**
 * TextInput - Smart text input with consistent styling and inline editing support
 *
 * WHY: Consistent API across all field types - same props pattern as PhoneInput, EmailInput, etc.
 * WHEN: Use for any single-line text field (names, titles, etc.)
 * HOW: Drop-in replacement for <input type="text"> with built-in label, error, and inline support
 *
 * @example
 * // Basic form usage
 * <TextInput
 *   value={firstName}
 *   onChange={setFirstName}
 *   label="First Name"
 *   required
 * />
 *
 * @example
 * // With auto-capitalize for name fields
 * <TextInput
 *   value={firstName}
 *   onChange={setFirstName}
 *   label="First Name"
 *   capitalizeFirst
 * />
 *
 * @example
 * // With inline save/discard buttons (for detail pages)
 * <TextInput
 *   value={firstName}
 *   onChange={setFirstName}
 *   label="First Name"
 *   inline={{
 *     onSave: () => saveToDatabase({ firstName }),
 *     onDiscard: () => setFirstName(originalFirstName),
 *     hasChanges: firstName !== originalFirstName,
 *   }}
 * />
 */

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  /** Current value */
  value: string;
  /** Called with the new value */
  onChange: (value: string) => void;
  /** Input type - defaults to 'text' */
  type?: 'text' | 'search' | 'url' | 'password';
  /** Optional label text or React node */
  label?: React.ReactNode;
  /** Show required asterisk on label */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Helper text below input */
  helperText?: string;
  /** Show validation state (valid = green border) */
  showValidation?: boolean;
  /** Custom validation function */
  validate?: (value: string) => boolean;
  /** Auto-capitalize first letter only */
  capitalizeFirst?: boolean;
  /** Auto-capitalize first letter of each word (for name fields) */
  capitalizeWords?: boolean;
  /** Restrict to name characters only (letters, spaces, hyphens, apostrophes) */
  nameOnly?: boolean;
  /** Custom regex pattern for allowed characters */
  allowedPattern?: RegExp;
  /** Icon component to show on the left */
  icon?: React.ReactNode;
  /** Inline editing config - adds save/discard buttons */
  inline?: InlineConfig;
  /** Color variant: 'orange' for public pages, 'emerald' for affiliate portal */
  variant?: 'orange' | 'emerald';
}

/**
 * Capitalizes the first letter of a string
 */
function capitalizeFirstLetter(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Capitalizes the first letter of each word (for name fields)
 * Preserves internal capitalization (e.g., "McDonald" stays as typed after the M)
 */
function capitalizeEachWord(str: string): string {
  if (!str) return str;
  // Split by spaces, capitalize first char of each word
  return str
    .split(' ')
    .map((word) => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Pattern for name-only characters: letters, spaces, hyphens, apostrophes
 */
const NAME_PATTERN = /^[a-zA-Z\s\-']*$/;

export function TextInput({
  value,
  onChange,
  type = 'text',
  label,
  required,
  error,
  helperText,
  showValidation = false,
  validate,
  capitalizeFirst = false,
  capitalizeWords = false,
  nameOnly = false,
  allowedPattern,
  icon,
  inline,
  variant = 'orange',
  className = '',
  disabled,
  ...props
}: TextInputProps) {
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value;

      // Restrict to allowed pattern if specified
      const pattern = allowedPattern || (nameOnly ? NAME_PATTERN : null);
      if (pattern && newValue) {
        // Only keep characters that match the pattern
        const cleaned = newValue.split('').filter((char, i) => {
          // Test each character individually (except for full string patterns)
          return pattern.test(newValue.substring(0, i + 1));
        }).join('');
        // If cleaning removed characters, use the cleaned value
        if (!pattern.test(newValue)) {
          newValue = cleaned;
        }
      }

      // For name fields, prevent multiple consecutive spaces
      if (nameOnly && newValue) {
        newValue = newValue.replace(/\s{2,}/g, ' ');
      }

      // Auto-capitalize first letter of each word (for names)
      if (capitalizeWords && newValue.length > 0) {
        newValue = capitalizeEachWord(newValue);
      }
      // Auto-capitalize first letter only
      else if (capitalizeFirst && newValue.length > 0) {
        newValue = capitalizeFirstLetter(newValue);
      }

      onChange(newValue);
    },
    [onChange, capitalizeFirst, capitalizeWords, nameOnly, allowedPattern]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true);
      props.onBlur?.(e);
    },
    [props]
  );

  // Block invalid characters on keydown for better UX
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Only check single character keys (not backspace, enter, etc.)
      if (e.key.length === 1 && nameOnly) {
        // For name-only fields, block non-letter chars (except space, hyphen, apostrophe)
        if (!/^[a-zA-Z\s\-']$/.test(e.key)) {
          e.preventDefault();
        }
      }
      props.onKeyDown?.(e);
    },
    [nameOnly, props]
  );

  // Validation state
  const isValid = validate ? validate(value) : value.length > 0;
  const showError = touched && error;
  const showValid = showValidation && touched && isValid && !error;

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

      <div className={hasInline && inlinePosition === 'right' ? 'relative' : ''}>
        <div className={hasInline && inlinePosition === 'right' ? 'pr-24' : ''}>
          <div className="relative">
            {icon && (
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {icon}
              </div>
            )}
            <input
              type={type}
              value={value}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              className={inputClasses}
              {...props}
            />
          </div>
        </div>

        {hasInline && inlinePosition === 'right' && (
          <InlineSaveButtons config={inline} hasValue={!!value.trim()} />
        )}
      </div>

      {hasInline && inlinePosition === 'below' && (
        <InlineSaveButtons config={inline} hasValue={!!value.trim()} />
      )}

      {showError && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {helperText && !showError && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

export default TextInput;
