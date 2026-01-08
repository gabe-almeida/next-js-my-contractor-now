'use client';

import { useState, useEffect } from 'react';
import { validatePhoneNumber, validateEmail, isContactInfoValid, formatPhoneInput } from '@/utils/validation/tcpa';

export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tcpaConsent: boolean;
}

export interface ValidationState {
  firstName: { isValid: boolean; message?: string };
  lastName: { isValid: boolean; message?: string };
  email: { isValid: boolean; message?: string };
  phone: { isValid: boolean; message?: string; formatted?: string };
  tcpaConsent: { isValid: boolean; message?: string };
  isFormValid: boolean;
  isContactInfoValid: boolean;
}

export interface TouchedState {
  firstName: boolean;
  lastName: boolean;
  email: boolean;
  phone: boolean;
}

export interface FormValidationHook {
  formData: ContactFormData;
  validation: ValidationState;
  touched: TouchedState;
  updateField: (field: keyof ContactFormData, value: string | boolean) => void;
  setFieldTouched: (field: keyof TouchedState) => void;
  formatPhoneField: (value: string) => string;
  isSubmitEnabled: boolean;
}

export const useFormValidation = (requireTCPA: boolean = true): FormValidationHook => {
  const [formData, setFormData] = useState<ContactFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    tcpaConsent: false
  });

  const [validation, setValidation] = useState<ValidationState>({
    firstName: { isValid: false },
    lastName: { isValid: false },
    email: { isValid: false },
    phone: { isValid: false },
    tcpaConsent: { isValid: !requireTCPA },
    isFormValid: false,
    isContactInfoValid: false
  });

  const [touched, setTouched] = useState<TouchedState>({
    firstName: false,
    lastName: false,
    email: false,
    phone: false
  });

  const setFieldTouched = (field: keyof TouchedState) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Validate individual fields
  const validateField = (field: keyof ContactFormData, value: string | boolean): { isValid: boolean; message?: string; formatted?: string } => {
    switch (field) {
      case 'firstName':
      case 'lastName':
        const name = value as string;
        return {
          isValid: name.trim().length >= 2,
          message: name.trim().length === 0 ? `${field === 'firstName' ? 'First' : 'Last'} name is required` : 
                   name.trim().length < 2 ? `${field === 'firstName' ? 'First' : 'Last'} name must be at least 2 characters` : undefined
        };

      case 'email':
        return validateEmail(value as string);

      case 'phone':
        return validatePhoneNumber(value as string);

      case 'tcpaConsent':
        return {
          isValid: !requireTCPA || (value as boolean),
          message: requireTCPA && !(value as boolean) ? 'You must accept the terms to continue' : undefined
        };

      default:
        return { isValid: true };
    }
  };

  // Update form data and validation
  const updateField = (field: keyof ContactFormData, value: string | boolean) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Validate the updated field
    const fieldValidation = validateField(field, value);
    
    // Update all validation states
    const newValidation: ValidationState = {
      firstName: field === 'firstName' ? fieldValidation : validateField('firstName', newFormData.firstName),
      lastName: field === 'lastName' ? fieldValidation : validateField('lastName', newFormData.lastName),
      email: field === 'email' ? fieldValidation : validateField('email', newFormData.email),
      phone: field === 'phone' ? fieldValidation : validateField('phone', newFormData.phone),
      tcpaConsent: field === 'tcpaConsent' ? fieldValidation : validateField('tcpaConsent', newFormData.tcpaConsent),
      isFormValid: false, // Will be calculated below
      isContactInfoValid: false // Will be calculated below
    };

    // Calculate overall form validity
    newValidation.isContactInfoValid = isContactInfoValid(newFormData.phone, newFormData.email);
    newValidation.isFormValid = 
      newValidation.firstName.isValid &&
      newValidation.lastName.isValid &&
      newValidation.email.isValid &&
      newValidation.phone.isValid &&
      newValidation.tcpaConsent.isValid;

    setValidation(newValidation);
  };

  // Format phone number as user types
  const formatPhoneField = (value: string): string => {
    return formatPhoneInput(value);
  };

  // Check if submit should be enabled
  const isSubmitEnabled = validation.isFormValid;

  return {
    formData,
    validation,
    touched,
    updateField,
    setFieldTouched,
    formatPhoneField,
    isSubmitEnabled
  };
};