'use client';

import React, { useState, useCallback } from 'react';
import { InlineSaveButtons, type InlineConfig } from './InlineSaveButtons';

/**
 * TextAreaInput - Smart textarea with consistent styling and inline editing support
 *
 * WHY: Consistent API across all field types - same props pattern as PhoneInput, TextInput, etc.
 * WHEN: Use for any multi-line text field (notes, descriptions, comments)
 * HOW: Drop-in replacement for <textarea> with built-in label, error, and inline support
 *
 * @example
 * // Basic form usage
 * <TextAreaInput
 *   value={notes}
 *   onChange={setNotes}
 *   label="Notes"
 *   rows={4}
 * />
 *
 * @example
 * // With character count
 * <TextAreaInput
 *   value={bio}
 *   onChange={setBio}
 *   label="Bio"
 *   maxLength={500}
 *   showCharCount
 * />
 *
 * @example
 * // With inline save/discard buttons (for detail pages)
 * <TextAreaInput
 *   value={notes}
 *   onChange={setNotes}
 *   label="Notes"
 *   rows={4}
 *   inline={{
 *     onSave: () => saveToDatabase({ notes }),
 *     onDiscard: () => setNotes(originalNotes),
 *     hasChanges: notes !== originalNotes,
 *   }}
 * />
 */

export interface TextAreaInputProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  /** Current value */
  value: string;
  /** Called with the new value */
  onChange: (value: string) => void;
  /** Optional label text or React node */
  label?: React.ReactNode;
  /** Show required asterisk on label */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Helper text below input */
  helperText?: string;
  /** Show character count (requires maxLength) */
  showCharCount?: boolean;
  /** Show validation state (valid = green border) */
  showValidation?: boolean;
  /** Custom validation function */
  validate?: (value: string) => boolean;
  /** Inline editing config - adds save/discard buttons */
  inline?: InlineConfig;
  /** Color variant: 'orange' for public pages, 'emerald' for affiliate portal */
  variant?: 'orange' | 'emerald';
}

export function TextAreaInput({
  value,
  onChange,
  label,
  required,
  error,
  helperText,
  showCharCount = false,
  showValidation = false,
  validate,
  inline,
  variant = 'orange',
  className = '',
  disabled,
  rows = 4,
  maxLength,
  ...props
}: TextAreaInputProps) {
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setTouched(true);
      props.onBlur?.(e);
    },
    [props]
  );

  // Validation state
  const isValid = validate ? validate(value) : value.length > 0;
  const showError = touched && error;
  const showValid = showValidation && touched && isValid && !error;

  // Build textarea classes - brand theme based on variant
  // Brand colors: orange for public pages, emerald for affiliate portal
  const brandClasses = variant === 'emerald'
    ? 'border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500'
    : 'border-orange-300 focus:ring-orange-500 focus:border-orange-500';

  const textareaClasses = [
    'w-full px-4 py-3 border-2 rounded-xl text-sm resize-none',
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
  // TextArea always uses 'below' position for inline buttons (looks better)
  const inlinePosition = inline?.position || 'below';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && typeof label === 'string' && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <textarea
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        className={textareaClasses}
        {...props}
      />

      {/* Character count and/or inline buttons row */}
      <div className={`flex items-center ${showCharCount && hasInline ? 'justify-between' : showCharCount ? 'justify-end' : ''} mt-1`}>
        {hasInline && inlinePosition === 'below' && (
          <InlineSaveButtons config={inline} hasValue={!!value.trim()} />
        )}

        {showCharCount && maxLength && (
          <p className={`text-xs ${value.length >= maxLength ? 'text-red-500' : 'text-gray-500'}`}>
            {value.length}/{maxLength}
          </p>
        )}
      </div>

      {showError && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {helperText && !showError && !showCharCount && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

export default TextAreaInput;
