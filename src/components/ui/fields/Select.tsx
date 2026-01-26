'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { createPortal } from 'react-dom';
import { InlineSaveButtons, type InlineConfig } from './InlineSaveButtons';

/**
 * Select - Custom dropdown with consistent brand styling
 *
 * WHY: Consistent, beautiful dropdowns that match the brand's orange theme
 * WHEN: Use for any select field in forms or detail pages
 * HOW: Renders as a styled button with portal dropdown for proper z-index handling
 *
 * Features:
 * - Smart positioning (portal-based for proper z-index)
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - Consistent orange brand styling
 * - Optional inline save/discard buttons for detail pages
 *
 * @example
 * // Basic usage
 * <Select
 *   value={status}
 *   onChange={setStatus}
 *   label="Status"
 *   options={[
 *     { value: 'new', label: 'New' },
 *     { value: 'active', label: 'Active' },
 *   ]}
 * />
 *
 * @example
 * // With inline save/discard (for detail pages)
 * <Select
 *   value={status}
 *   onChange={setStatus}
 *   label="Status"
 *   options={statusOptions}
 *   inline={{
 *     onSave: () => saveToDatabase({ status }),
 *     onDiscard: () => setStatus(originalStatus),
 *     hasChanges: status !== originalStatus,
 *   }}
 * />
 */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  /** Current selected value */
  value: string;
  /** Called when selection changes */
  onChange: (value: string) => void;
  /** Options to display */
  options: SelectOption[];
  /** Placeholder when no selection */
  placeholder?: string;
  /** Optional label */
  label?: React.ReactNode;
  /** Show required asterisk */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class for container */
  className?: string;
  /** Inline editing config - adds save/discard buttons */
  inline?: InlineConfig;
  /** Color variant: 'orange' for public pages, 'emerald' for affiliate portal */
  variant?: 'orange' | 'emerald';
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  label,
  required,
  error,
  helperText,
  disabled,
  className = '',
  inline,
  variant = 'orange',
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find selected option's label for display
  const selectedOption = options.find(opt => opt.value === value);
  const displayText = selectedOption?.label || placeholder;

  // Ensure component is mounted (for SSR compatibility)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update button position when dropdown opens
  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setButtonRect(rect);
      }
    };

    if (isOpen) {
      updatePosition();

      const handleScroll = () => updatePosition();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);

      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setSelectedIndex(options.findIndex(opt => opt.value === value));
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < options.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && options[selectedIndex] && !options[selectedIndex].disabled) {
          onChange(options[selectedIndex].value);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const hasInline = !!inline;
  const inlinePosition = inline?.position || 'right';
  const showError = !!error;

  // Build button classes - brand theme based on variant
  // Brand colors: orange for public pages, emerald for affiliate portal
  const brandClasses = variant === 'emerald'
    ? 'border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500'
    : 'border-orange-300 focus:ring-orange-500 focus:border-orange-500';
  const hoverClasses = variant === 'emerald'
    ? 'hover:border-emerald-400 hover:bg-emerald-50'
    : 'hover:border-orange-400 hover:bg-orange-50';

  const buttonClasses = [
    'w-full px-4 py-3 border-2 rounded-xl text-sm text-left',
    'flex items-center justify-between',
    'focus:outline-none focus:ring-2',
    'transition-colors duration-150',
    disabled ? 'bg-gray-100 cursor-not-allowed' : `bg-white ${hoverClasses}`,
    showError
      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
      : brandClasses,
    className,
  ]
    .filter(Boolean)
    .join(' ');

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
          <button
            ref={buttonRef}
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={buttonClasses}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          >
            <span className={value ? 'text-gray-800' : 'text-gray-500'}>
              {displayText}
            </span>
            <ChevronDownIcon
              className={`w-5 h-5 ${variant === 'emerald' ? 'text-emerald-500' : 'text-orange-500'} transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {hasInline && inlinePosition === 'right' && (
          <InlineSaveButtons config={inline} hasValue={!!value} />
        )}
      </div>

      {hasInline && inlinePosition === 'below' && (
        <InlineSaveButtons config={inline} hasValue={!!value} />
      )}

      {/* Portal Dropdown */}
      {isMounted && isOpen && buttonRect && createPortal(
        <div
          ref={dropdownRef}
          className={`fixed bg-white border-2 ${variant === 'emerald' ? 'border-emerald-300' : 'border-orange-300'} rounded-xl shadow-xl max-h-64 overflow-y-auto`}
          style={{
            top: buttonRect.bottom + 4,
            left: buttonRect.left,
            width: buttonRect.width,
            zIndex: 999999,
          }}
          role="listbox"
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => !option.disabled && handleOptionClick(option.value)}
              disabled={option.disabled}
              className={`w-full px-4 py-3 text-left transition-colors border-b ${variant === 'emerald' ? 'border-emerald-100' : 'border-orange-100'} last:border-b-0 ${
                option.disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : index === selectedIndex || option.value === value
                    ? variant === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                    : variant === 'emerald' ? 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600' : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600'
              }`}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Error message */}
      {showError && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Helper text (only show if no error) */}
      {helperText && !showError && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

export default Select;
