'use client';

import { useState, useCallback, useMemo } from 'react';
import { FormConfig, FormState, FormValidationError, ComplianceStatus } from '@/types/forms';
import { validateForm as validateFormFields } from '@/utils/forms/validation';

export function useFormState(config: FormConfig, initialData: Record<string, any> = {}) {
  // Extract all fields from all sections
  const allFields = useMemo(() => {
    return config.sections.flatMap(section => section.fields);
  }, [config.sections]);

  // Initialize form state
  const [formState, setFormState] = useState<FormState>(() => {
    const initialValues: Record<string, any> = {};
    const initialTouched: Record<string, boolean> = {};

    // Set default values from config and initial data
    allFields.forEach(field => {
      const initialValue = initialData[field.name];
      
      if (initialValue !== undefined) {
        initialValues[field.name] = initialValue;
      } else {
        // Set default values based on field type
        switch (field.type) {
          case 'checkbox':
          case 'multiselect':
            initialValues[field.name] = [];
            break;
          case 'number':
            initialValues[field.name] = '';
            break;
          default:
            initialValues[field.name] = '';
        }
      }
      
      initialTouched[field.name] = false;
    });

    return {
      values: initialValues,
      errors: [],
      touched: initialTouched,
      isSubmitting: false,
      isValid: false,
      compliance: {
        trustedForm: { initialized: false },
        jornaya: { initialized: false }
      }
    };
  });

  // Validate form and update errors
  const validateForm = useCallback(() => {
    const errors = validateFormFields(allFields, formState.values);
    const isValid = errors.length === 0;

    setFormState(prev => ({
      ...prev,
      errors,
      isValid
    }));

    return isValid;
  }, [allFields, formState.values]);

  // Update a single field value
  const updateField = useCallback((name: string, value: any) => {
    setFormState(prev => {
      const newValues = { ...prev.values, [name]: value };
      
      // Validate updated form
      const errors = validateFormFields(allFields, newValues);
      const isValid = errors.length === 0;

      return {
        ...prev,
        values: newValues,
        errors,
        isValid
      };
    });
  }, [allFields]);

  // Update field touched state
  const updateFieldTouched = useCallback((name: string, touched: boolean) => {
    setFormState(prev => ({
      ...prev,
      touched: {
        ...prev.touched,
        [name]: touched
      }
    }));
  }, []);

  // Update multiple fields at once
  const updateFields = useCallback((updates: Record<string, any>) => {
    setFormState(prev => {
      const newValues = { ...prev.values, ...updates };
      
      // Validate updated form
      const errors = validateFormFields(allFields, newValues);
      const isValid = errors.length === 0;

      return {
        ...prev,
        values: newValues,
        errors,
        isValid
      };
    });
  }, [allFields]);

  // Set form submitting state
  const setFormSubmitting = useCallback((isSubmitting: boolean) => {
    setFormState(prev => ({
      ...prev,
      isSubmitting
    }));
  }, []);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    const resetValues: Record<string, any> = {};
    const resetTouched: Record<string, boolean> = {};

    allFields.forEach(field => {
      const initialValue = initialData[field.name];
      
      if (initialValue !== undefined) {
        resetValues[field.name] = initialValue;
      } else {
        switch (field.type) {
          case 'checkbox':
          case 'multiselect':
            resetValues[field.name] = [];
            break;
          case 'number':
            resetValues[field.name] = '';
            break;
          default:
            resetValues[field.name] = '';
        }
      }
      
      resetTouched[field.name] = false;
    });

    setFormState(prev => ({
      ...prev,
      values: resetValues,
      errors: [],
      touched: resetTouched,
      isSubmitting: false,
      isValid: false
    }));
  }, [allFields, initialData]);

  // Update compliance status
  const updateComplianceStatus = useCallback((provider: 'trustedForm' | 'jornaya', status: ComplianceStatus) => {
    setFormState(prev => ({
      ...prev,
      compliance: {
        ...prev.compliance,
        [provider]: status
      }
    }));
  }, []);

  // Set form errors manually (useful for server-side validation)
  const setFormErrors = useCallback((errors: FormValidationError[]) => {
    setFormState(prev => ({
      ...prev,
      errors,
      isValid: errors.length === 0
    }));
  }, []);

  // Get field value
  const getFieldValue = useCallback((name: string) => {
    return formState.values[name];
  }, [formState.values]);

  // Get field error
  const getFieldError = useCallback((name: string) => {
    return formState.errors.find(error => error.field === name);
  }, [formState.errors]);

  // Check if field is touched
  const isFieldTouched = useCallback((name: string) => {
    return formState.touched[name] || false;
  }, [formState.touched]);

  // Get form data for submission
  const getFormData = useCallback(() => {
    return {
      values: formState.values,
      compliance: formState.compliance,
      isValid: formState.isValid,
      errors: formState.errors
    };
  }, [formState]);

  // Validate specific field
  const validateField = useCallback((name: string) => {
    const field = allFields.find(f => f.name === name);
    if (!field) return null;

    const errors = validateFormFields([field], formState.values);
    return errors.find(error => error.field === name) || null;
  }, [allFields, formState.values]);

  return {
    formState,
    updateField,
    updateFields,
    updateFieldTouched,
    setFormSubmitting,
    resetForm,
    validateForm,
    setFormErrors,
    updateComplianceStatus,
    getFieldValue,
    getFieldError,
    isFieldTouched,
    getFormData,
    validateField
  };
}