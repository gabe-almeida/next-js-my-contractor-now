'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FormFieldOption } from '@/types/forms';
import { cn } from '@/utils/cn';

interface MultiSelectInputProps {
  id: string;
  name: string;
  value: string[];
  onChange: (value: string[]) => void;
  onBlur: () => void;
  options: FormFieldOption[];
  placeholder?: string;
  disabled?: boolean;
  maxSelections?: number;
  searchable?: boolean;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export function MultiSelectInput({
  id,
  name,
  value = [],
  onChange,
  onBlur,
  options,
  placeholder = 'Select options',
  disabled = false,
  maxSelections,
  searchable = true,
  className,
  ...ariaProps
}: MultiSelectInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = searchable
    ? options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const selectedOptions = options.filter(option => value.includes(option.value));
  const isMaxReached = maxSelections && value.length >= maxSelections;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onBlur();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onBlur]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setSearchTerm('');
    }
  };

  const handleOptionClick = (optionValue: string) => {
    if (disabled) return;

    const isSelected = value.includes(optionValue);
    let newValue: string[];

    if (isSelected) {
      newValue = value.filter(v => v !== optionValue);
    } else {
      if (isMaxReached) return;
      newValue = [...value, optionValue];
    }

    onChange(newValue);
  };

  const handleRemoveSelected = (optionValue: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!disabled) {
      onChange(value.filter(v => v !== optionValue));
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      onBlur();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggle();
    }
  };

  const containerClassName = cn(
    'relative w-full',
    className
  );

  const triggerClassName = cn(
    // Base styles
    'w-full min-h-[2.5rem] px-3 py-2 border rounded-md shadow-sm transition-colors duration-200',
    'bg-white text-gray-900 cursor-pointer',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    
    // Border styles
    'border-gray-300',
    
    // Disabled styles
    disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
    
    // Error styles
    ariaProps['aria-invalid'] && 'border-red-300 focus:ring-red-500 focus:border-red-500',
    
    // Open state
    isOpen && 'ring-2 ring-blue-500 border-blue-500'
  );

  const dropdownClassName = cn(
    'absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg',
    'max-h-60 overflow-auto',
    !isOpen && 'hidden'
  );

  return (
    <div className={containerClassName} ref={containerRef}>
      <div
        className={triggerClassName}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        {...ariaProps}
      >
        <div className="flex flex-wrap gap-1 min-h-[1.25rem]">
          {selectedOptions.length === 0 ? (
            <span className="text-gray-500 text-base md:text-sm leading-5">
              {placeholder}
            </span>
          ) : (
            selectedOptions.map((option) => (
              <span
                key={option.value}
                className={cn(
                  'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                  'bg-blue-100 text-blue-800',
                  !disabled && 'group hover:bg-blue-200'
                )}
              >
                {option.label}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveSelected(option.value, e)}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-300 focus:outline-none focus:bg-blue-300"
                    aria-label={`Remove ${option.label}`}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </span>
            ))
          )}
        </div>
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className={cn(
              'w-5 h-5 text-gray-400 transition-transform duration-200',
              isOpen && 'transform rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div className={dropdownClassName}>
        {searchable && (
          <div className="p-2 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
        
        <div role="listbox" className="py-1">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {searchTerm ? 'No options found' : 'No options available'}
            </div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = value.includes(option.value);
              const isDisabled = disabled || option.disabled || (!isSelected && isMaxReached);

              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleOptionClick(option.value)}
                  className={cn(
                    'px-3 py-2 cursor-pointer text-sm flex items-center justify-between',
                    'hover:bg-gray-100 focus:bg-gray-100',
                    isSelected && 'bg-blue-50 text-blue-700',
                    isDisabled && 'cursor-not-allowed opacity-50 hover:bg-transparent'
                  )}
                >
                  <span>{option.label}</span>
                  {isSelected && (
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              );
            })
          )}
        </div>
        
        {maxSelections && (
          <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-200">
            {value.length} of {maxSelections} selected
          </div>
        )}
      </div>
    </div>
  );
}