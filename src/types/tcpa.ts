/**
 * TCPA Compliance Type Definitions
 */

export interface TCPAConsent {
  isAccepted: boolean;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  buyerConfig: string;
}

export interface TCPAConfig {
  buyerId: string;
  text: string;
  isRequired: boolean;
  showOnlyWhenContactValid: boolean;
}

export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tcpaConsent: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  formatted?: string;
}

export interface ContactValidationState {
  firstName: ValidationResult;
  lastName: ValidationResult;
  email: ValidationResult;
  phone: ValidationResult;
  tcpaConsent: ValidationResult;
  isFormValid: boolean;
  isContactInfoValid: boolean;
}

export interface LeadData extends ContactFormData {
  tcpaConsentRecord?: TCPAConsent;
  // Add other lead fields as needed
  serviceType?: string;
  projectDetails?: Record<string, any>;
  address?: string;
}