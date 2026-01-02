'use client';

import React, { useState, useMemo } from 'react';
import { FormSection as FormSectionType, FormState } from '@/types/forms/index';
import { FormField } from '../base/FormField';
import { evaluateConditional } from '@/utils/forms/conditionals';
import { cn } from '@/utils/cn';

export interface FormSectionProps {
  section: FormSectionType;
  formState: FormState;
  onFieldChange: (name: string, value: any) => void;
  onFieldBlur: (name: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  className?: string;
}

export function FormSection({
  section,
  formState,
  onFieldChange,
  onFieldBlur,
  isFirst = false,
  isLast = false,
  className
}: FormSectionProps) {
  const [isExpanded, setIsExpanded] = useState(section.defaultExpanded ?? true);

  // Filter visible fields based on conditionals
  const visibleFields = useMemo(() => {
    return section.fields.filter(field => {
      if (!field.conditional) return true;
      return evaluateConditional(field.conditional, formState.values);
    });
  }, [section.fields, formState.values]);

  // Calculate section completion
  const completion = useMemo(() => {
    if (visibleFields.length === 0) return 100;
    
    const filledFields = visibleFields.filter(field => {
      const value = formState.values[field.name];
      return value !== undefined && value !== null && value !== '';
    });
    
    return (filledFields.length / visibleFields.length) * 100;
  }, [visibleFields, formState.values]);

  const hasErrors = visibleFields.some(field => 
    formState.errors.some(error => error.field === field.name)
  );

  const sectionClassName = cn(
    'form-section',
    'border border-gray-200 rounded-lg overflow-hidden',
    'transition-all duration-200',
    hasErrors && 'border-red-300 bg-red-50',
    !isFirst && 'mt-6',
    className
  );

  const headerClassName = cn(
    'form-section-header px-6 py-4',
    'border-b border-gray-200',
    section.collapsible && 'cursor-pointer hover:bg-gray-50',
    hasErrors && 'border-red-300 bg-red-100'
  );

  const contentClassName = cn(
    'form-section-content p-6',
    'grid gap-6',
    // Dynamic grid layout based on field configuration
    'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    // Override for specific field grid settings
    visibleFields.some(f => f.gridColumn?.includes('span-2')) && 'lg:grid-cols-6',
    !isExpanded && 'hidden'
  );

  const handleToggle = () => {
    if (section.collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (section.collapsible && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleToggle();
    }
  };

  return (
    <div className={sectionClassName}>
      {/* Section Header */}
      <div
        className={headerClassName}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        tabIndex={section.collapsible ? 0 : -1}
        role={section.collapsible ? 'button' : undefined}
        aria-expanded={section.collapsible ? isExpanded : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {section.title}
            </h2>
            {section.description && (
              <p className="text-sm text-gray-600">
                {section.description}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* Progress Indicator */}
            <div className="flex items-center space-x-2">
              <div className="w-16 bg-gray-200 rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all duration-300',
                    completion === 100 ? 'bg-green-500' : 
                    completion > 50 ? 'bg-blue-500' : 'bg-yellow-500'
                  )}
                  style={{ width: `${completion}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 min-w-[3rem]">
                {Math.round(completion)}%
              </span>
            </div>

            {/* Error Indicator */}
            {hasErrors && (
              <div className="flex items-center text-red-600">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            {/* Collapse Toggle */}
            {section.collapsible && (
              <svg
                className={cn(
                  'w-5 h-5 text-gray-400 transition-transform duration-200',
                  isExpanded && 'transform rotate-180'
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Section Content */}
      <div className={contentClassName}>
        {visibleFields.map((field) => {
          const fieldError = formState.errors.find(error => error.field === field.name);
          const fieldTouched = formState.touched[field.name];
          const fieldValue = formState.values[field.name];

          return (
            <FormField
              key={field.id}
              field={field}
              value={fieldValue}
              error={fieldError?.message}
              touched={fieldTouched}
              onChange={(value) => onFieldChange(field.name, value)}
              onBlur={() => onFieldBlur(field.name)}
              disabled={formState.isSubmitting}
              className={field.className}
            />
          );
        })}
      </div>

      {/* Section Footer (if needed for additional actions) */}
      {(section.collapsible && !isExpanded && hasErrors) && (
        <div className="px-6 py-2 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-600">
            This section has errors that need to be addressed.
          </p>
        </div>
      )}
    </div>
  );
}