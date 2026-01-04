/**
 * Validation Utilities Index
 * Re-exports all validation functions for easy import
 */

import type { ValidationResult } from './tcpa';

export {
  validatePhoneNumber,
  validateEmail,
  isContactInfoValid,
  formatPhoneNumber,
  formatPhoneInput,
} from './tcpa';
export type { ValidationResult };

export {
  type TCPAConfig,
  type TCPAConsent,
  getTCPAConfig,
  createTCPAConsent,
  validateTCPAConsent,
  DEFAULT_TCPA_TEXT,
  TCPA_CONFIGURATIONS
} from '@/config/tcpa';

export {
  useFormValidation,
  type ContactFormData,
  type ValidationState,
  type FormValidationHook
} from '@/hooks/useFormValidation';

// Common validation patterns
export const PHONE_REGEX = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validate required fields
 */
export const validateRequired = (value: string, fieldName: string): ValidationResult => {
  if (!value || value.trim().length === 0) {
    return {
      isValid: false,
      message: `${fieldName} is required`
    };
  }
  return { isValid: true };
};

/**
 * Validate minimum length
 */
export const validateMinLength = (value: string, minLength: number, fieldName: string): ValidationResult => {
  if (value.trim().length < minLength) {
    return {
      isValid: false,
      message: `${fieldName} must be at least ${minLength} characters`
    };
  }
  return { isValid: true };
};