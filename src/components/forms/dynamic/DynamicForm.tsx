'use client';

import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { usePerformance } from '@/hooks/usePerformance';
import { useAccessibility } from '@/hooks/useAccessibility';
import { FormConfig, FormState, FormSubmission } from '@/types/forms';
import { useFormState } from '../hooks/useFormState';
import { TrustedFormProvider } from '../compliance/TrustedFormProvider';
import { JornayaProvider } from '../compliance/JornayaProvider';
import { FormSection } from './FormSection';
import { FormSubmitButton } from '../base/FormSubmitButton';
import { FormProgress } from '../base/FormProgress';
import { evaluateConditional } from '@/utils/forms/conditionals';
import { cn } from '@/utils/cn';
import { getAttributionData, AttributionData } from '@/utils/attribution';

export interface DynamicFormProps {
  config: FormConfig;
  initialData?: Record<string, any>;
  onSubmit: (submission: FormSubmission) => Promise<void>;
  onFieldChange?: (name: string, value: any, formState: FormState) => void;
  onValidationChange?: (isValid: boolean, errors: any[]) => void;
  className?: string;
  showProgress?: boolean;
  debug?: boolean;
}

export const DynamicForm = memo(function DynamicForm({
  config,
  initialData = {},
  onSubmit,
  onFieldChange,
  onValidationChange,
  className,
  showProgress = false,
  debug = false
}: DynamicFormProps) {
  const {
    formState,
    updateField,
    updateFieldTouched,
    setFormSubmitting,
    resetForm,
    validateForm,
    updateComplianceStatus
  } = useFormState(config, initialData);

  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Capture attribution data on mount (first touch)
  const [attribution] = useState<AttributionData>(() => {
    if (typeof window !== 'undefined') {
      return getAttributionData();
    }
    return {};
  });

  // Filter visible sections based on conditionals
  const visibleSections = useMemo(() => {
    return config.sections.filter(section => {
      if (!section.conditional) return true;
      return evaluateConditional(section.conditional, formState.values);
    });
  }, [config.sections, formState.values]);

  // Calculate form progress
  const progress = useMemo(() => {
    const allFields = visibleSections.flatMap(section => section.fields);
    const filledFields = allFields.filter(field => {
      const value = formState.values[field.name];
      return value !== undefined && value !== null && value !== '';
    });
    return allFields.length > 0 ? (filledFields.length / allFields.length) * 100 : 0;
  }, [visibleSections, formState.values]);

  // Notify parent of field changes
  useEffect(() => {
    if (onFieldChange) {
      const lastChangedField = Object.keys(formState.values).pop();
      if (lastChangedField) {
        onFieldChange(lastChangedField, formState.values[lastChangedField], formState);
      }
    }
  }, [formState.values, formState, onFieldChange]);

  // Notify parent of validation changes
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(formState.isValid, formState.errors);
    }
  }, [formState.isValid, formState.errors, onValidationChange]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formState.isSubmitting) return;

    // Validate form before submission
    const isValid = validateForm();
    if (!isValid) {
      // Mark all fields as touched to show errors
      const allFields = visibleSections.flatMap(section => section.fields);
      allFields.forEach(field => {
        updateFieldTouched(field.name, true);
      });
      return;
    }

    setFormSubmitting(true);

    try {
      const submission: FormSubmission = {
        formId: config.id,
        data: formState.values,
        compliance: {
          trustedFormCertUrl: formState.compliance.trustedForm.url,
          jornayaLeadId: formState.compliance.jornaya.token,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          ipAddress: undefined // Will be set on server
        },
        metadata: {
          sessionId,
          pageUrl: window.location.href,
          referrer: document.referrer,
          submissionTime: Date.now()
        },
        attribution
      };

      await onSubmit(submission);
    } catch (error) {
      console.error('Form submission error:', error);
      throw error; // Re-throw to let parent handle
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleFieldChange = useCallback((name: string, value: any) => {
    updateField(name, value);
  }, [updateField]);

  const handleFieldBlur = useCallback((name: string) => {
    updateFieldTouched(name, true);
  }, [updateFieldTouched]);

  // Performance monitoring
  const { trackInteraction } = usePerformance('DynamicForm', {
    trackRender: true,
    trackInteraction: true,
    onMetricsCollected: (metrics) => {
      if (metrics.renderTime > 100) {
        console.warn('DynamicForm slow render:', metrics);
      }
    }
  });

  // Accessibility enhancements
  const { announce, LiveRegion } = useAccessibility({
    announceChanges: true,
    manageFocus: true
  });

  const formClassName = cn(
    'dynamic-form w-full max-w-4xl mx-auto',
    config.styling?.theme === 'modern' && 'space-y-8',
    config.styling?.theme === 'minimal' && 'space-y-6',
    config.styling?.theme === 'professional' && 'space-y-6 bg-white shadow-lg rounded-lg p-8',
    !config.styling?.theme && 'space-y-6',
    className
  );

  const ComplianceWrapper = ({ children }: { children: React.ReactNode }) => {
    let content = children;

    if (config.compliance?.jornaya?.enabled) {
      content = (
        <JornayaProvider
          config={config.compliance.jornaya}
          onStatusChange={(status) => updateComplianceStatus('jornaya', status)}
        >
          {content}
        </JornayaProvider>
      );
    }

    if (config.compliance?.trustedForm?.enabled) {
      content = (
        <TrustedFormProvider
          config={config.compliance.trustedForm}
          onStatusChange={(status) => updateComplianceStatus('trustedForm', status)}
        >
          {content}
        </TrustedFormProvider>
      );
    }

    return <>{content}</>;
  };

  return (
    <ErrorBoundary>
      <ComplianceWrapper>
        <div className={formClassName} role="form" aria-label={config.title || 'Dynamic form'}>
          <LiveRegion />
          
          {/* Form Header */}
          {config.title && (
            <div className="form-header mb-8">
              <h1 
                className="text-2xl font-bold text-gray-900 mb-2"
                id="form-title"
              >
                {config.title}
              </h1>
              {config.description && (
                <p 
                  className="text-gray-600"
                  id="form-description"
                >
                  {config.description}
                </p>
              )}
            </div>
          )}

        {/* Progress Bar */}
        {showProgress && (
          <FormProgress 
            progress={progress}
            className="mb-6"
          />
        )}

        {/* Form */}
        <form 
          onSubmit={handleSubmit} 
          noValidate
          aria-labelledby={config.title ? "form-title" : undefined}
          aria-describedby={config.description ? "form-description" : undefined}
        >
          {/* Form Sections */}
          <div className="form-sections space-y-8">
            {visibleSections.map((section, index) => (
              <FormSection
                key={section.id}
                section={section}
                formState={formState}
                onFieldChange={handleFieldChange}
                onFieldBlur={handleFieldBlur}
                isFirst={index === 0}
                isLast={index === visibleSections.length - 1}
              />
            ))}
          </div>

          {/* Form Actions */}
          <div className="form-actions mt-8 flex flex-col sm:flex-row gap-4 justify-end">
            <button
              type="button"
              onClick={() => resetForm()}
              disabled={formState.isSubmitting}
              className={cn(
                'px-6 py-2 border border-gray-300 rounded-md text-gray-700',
                'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-200'
              )}
            >
              {config.resetText || 'Reset'}
            </button>

            <FormSubmitButton
              isSubmitting={formState.isSubmitting}
              isValid={formState.isValid}
              disabled={!formState.isValid || formState.isSubmitting}
            >
              {config.submitText || 'Submit'}
            </FormSubmitButton>
          </div>
        </form>

        {/* Debug Panel */}
        {debug && (
          <div className="mt-8 p-4 bg-gray-900 text-white rounded-lg text-sm">
            <h3 className="font-bold mb-2">Debug Info</h3>
            <div className="space-y-2">
              <div>Form Valid: {formState.isValid ? 'Yes' : 'No'}</div>
              <div>Progress: {progress.toFixed(1)}%</div>
              <div>Errors: {formState.errors.length}</div>
              <div>TrustedForm: {formState.compliance.trustedForm.initialized ? 'Ready' : 'Not Ready'}</div>
              <div>Jornaya: {formState.compliance.jornaya.initialized ? 'Ready' : 'Not Ready'}</div>
              <details>
                <summary className="cursor-pointer">Form Values</summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {JSON.stringify(formState.values, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}
      </div>
      </ComplianceWrapper>
    </ErrorBoundary>
  );
});