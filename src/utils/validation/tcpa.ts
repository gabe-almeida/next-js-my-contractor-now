/**
 * TCPA Compliance Validation Utilities
 * Handles phone and email validation with real-time feedback
 *
 * NOTE: Phone utilities re-exported from centralized @/lib/utils/phone
 */

import {
  isValidUSPhoneNumber,
  formatPhoneForDisplay,
  formatPhoneAsYouType,
  cleanPhoneNumber,
} from '@/lib/utils/phone';

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  formatted?: string;
}

/**
 * Phone number validation with support for various formats
 * Accepts: 1234567890, +11234567890, 11234567890, (123) 456-7890
 *
 * Uses centralized phone utilities from @/lib/utils/phone
 */
export const validatePhoneNumber = (phone: string): ValidationResult => {
  if (!phone) {
    return { isValid: false, message: 'Phone number is required' };
  }

  if (isValidUSPhoneNumber(phone)) {
    return {
      isValid: true,
      formatted: formatPhoneForDisplay(phone)
    };
  }

  const digits = cleanPhoneNumber(phone);
  if (digits.length < 10) {
    return {
      isValid: false,
      message: 'Please enter a valid phone number'
    };
  }

  return {
    isValid: false,
    message: 'Invalid phone number format'
  };
};

/**
 * Format phone number to (XXX) XXX-XXXX
 * Re-exported from centralized phone utilities
 */
export const formatPhoneNumber = formatPhoneForDisplay;

/**
 * Email validation with comprehensive regex
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email) {
    return { isValid: false, message: 'Email address is required' };
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      message: 'Please enter a valid email address'
    };
  }

  return { isValid: true };
};

/**
 * Check if both phone and email are valid (required for TCPA checkbox)
 */
export const isContactInfoValid = (phone: string, email: string): boolean => {
  const phoneResult = validatePhoneNumber(phone);
  const emailResult = validateEmail(email);
  return phoneResult.isValid && emailResult.isValid;
};

/**
 * Real-time phone input formatter
 * Formats as user types for better UX
 * Re-exported from centralized phone utilities
 */
export const formatPhoneInput = formatPhoneAsYouType;