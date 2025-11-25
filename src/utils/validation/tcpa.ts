/**
 * TCPA Compliance Validation Utilities
 * Handles phone and email validation with real-time feedback
 */

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  formatted?: string;
}

/**
 * Phone number validation with support for various formats
 * Accepts: 1234567890, +11234567890, 11234567890, (123) 456-7890
 */
export const validatePhoneNumber = (phone: string): ValidationResult => {
  if (!phone) {
    return { isValid: false, message: 'Phone number is required' };
  }

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Check for valid formats
  if (digitsOnly.length === 10) {
    // Standard 10-digit format
    return {
      isValid: true,
      formatted: formatPhoneNumber(digitsOnly)
    };
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // 11 digits starting with 1
    const tenDigits = digitsOnly.substring(1);
    return {
      isValid: true,
      formatted: formatPhoneNumber(tenDigits)
    };
  } else if (digitsOnly.length < 10) {
    return { 
      isValid: false, 
      message: 'Please enter a valid phone number' 
    };
  } else {
    return { 
      isValid: false, 
      message: 'Invalid phone number format' 
    };
  }
};

/**
 * Format phone number to (XXX) XXX-XXXX
 */
export const formatPhoneNumber = (phone: string): string => {
  const digitsOnly = phone.replace(/\D/g, '');
  
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  
  return phone; // Return original if can't format
};

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
 */
export const formatPhoneInput = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, '');
  
  if (digitsOnly.length <= 3) {
    return digitsOnly;
  } else if (digitsOnly.length <= 6) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
  } else if (digitsOnly.length <= 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  } else {
    // Handle 11 digits (with country code)
    return `(${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7, 11)}`;
  }
};