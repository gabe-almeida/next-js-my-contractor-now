/**
 * Data Validation Engine
 * Comprehensive validation system for lead data and buyer payloads
 */

import { ValidationRule, ValidationError, LeadData, TemplateMapping } from './types';

export class DataValidator {
  /**
   * Validate a single field value against its validation rule
   */
  static validateField(
    fieldName: string,
    value: any,
    rule: ValidationRule
  ): { isValid: boolean; error?: string } {
    try {
      // Handle null/undefined values
      if (value === null || value === undefined || value === '') {
        return { isValid: true }; // Let required validation handle empty values
      }

      switch (rule.type) {
        case 'string':
          return this.validateString(value, rule);
        case 'number':
          return this.validateNumber(value, rule);
        case 'boolean':
          return this.validateBoolean(value, rule);
        case 'email':
          return this.validateEmail(value, rule);
        case 'phone':
          return this.validatePhone(value, rule);
        case 'zipcode':
          return this.validateZipCode(value, rule);
        case 'custom':
          return this.validateCustom(value, rule);
        default:
          throw new ValidationError(fieldName, `Unknown validation type: ${rule.type}`);
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * Validate string values
   */
  private static validateString(
    value: any,
    rule: ValidationRule
  ): { isValid: boolean; error?: string } {
    const stringValue = String(value);

    // Length validation
    if (rule.min !== undefined && stringValue.length < rule.min) {
      return {
        isValid: false,
        error: rule.errorMessage || `Must be at least ${rule.min} characters`
      };
    }

    if (rule.max !== undefined && stringValue.length > rule.max) {
      return {
        isValid: false,
        error: rule.errorMessage || `Must be no more than ${rule.max} characters`
      };
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(stringValue)) {
      return {
        isValid: false,
        error: rule.errorMessage || 'Invalid format'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate numeric values
   */
  private static validateNumber(
    value: any,
    rule: ValidationRule
  ): { isValid: boolean; error?: string } {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));

    if (isNaN(numValue)) {
      return {
        isValid: false,
        error: rule.errorMessage || 'Must be a valid number'
      };
    }

    // Range validation
    if (rule.min !== undefined && numValue < rule.min) {
      return {
        isValid: false,
        error: rule.errorMessage || `Must be at least ${rule.min}`
      };
    }

    if (rule.max !== undefined && numValue > rule.max) {
      return {
        isValid: false,
        error: rule.errorMessage || `Must be no more than ${rule.max}`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate boolean values
   */
  private static validateBoolean(
    value: any,
    rule: ValidationRule
  ): { isValid: boolean; error?: string } {
    if (typeof value === 'boolean') {
      return { isValid: true };
    }

    // Accept common boolean representations
    const stringValue = String(value).toLowerCase().trim();
    const validBooleans = ['true', 'false', 'yes', 'no', '1', '0', 'on', 'off'];

    if (!validBooleans.includes(stringValue)) {
      return {
        isValid: false,
        error: rule.errorMessage || 'Must be a valid boolean value'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate email addresses
   */
  private static validateEmail(
    value: any,
    rule: ValidationRule
  ): { isValid: boolean; error?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const stringValue = String(value).trim();

    if (!emailRegex.test(stringValue)) {
      return {
        isValid: false,
        error: rule.errorMessage || 'Must be a valid email address'
      };
    }

    // Additional pattern validation if provided
    if (rule.pattern && !rule.pattern.test(stringValue)) {
      return {
        isValid: false,
        error: rule.errorMessage || 'Email format not accepted'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate phone numbers
   */
  private static validatePhone(
    value: any,
    rule: ValidationRule
  ): { isValid: boolean; error?: string } {
    const phoneRegex = /^\+?[\d\s\-\(\)\.]{10,}$/;
    const stringValue = String(value).trim();

    // Extract digits only for length validation
    const digitsOnly = stringValue.replace(/\D/g, '');

    if (!phoneRegex.test(stringValue)) {
      return {
        isValid: false,
        error: rule.errorMessage || 'Must be a valid phone number'
      };
    }

    // US phone number validation (10 digits)
    if (digitsOnly.length === 10 || (digitsOnly.length === 11 && digitsOnly.startsWith('1'))) {
      return { isValid: true };
    }

    return {
      isValid: false,
      error: rule.errorMessage || 'Must be a valid US phone number'
    };
  }

  /**
   * Validate ZIP codes
   */
  private static validateZipCode(
    value: any,
    rule: ValidationRule
  ): { isValid: boolean; error?: string } {
    const zipRegex = /^\d{5}(-\d{4})?$/;
    const stringValue = String(value).trim();

    if (!zipRegex.test(stringValue)) {
      return {
        isValid: false,
        error: rule.errorMessage || 'Must be a valid ZIP code (12345 or 12345-6789)'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate using custom validator function
   */
  private static validateCustom(
    value: any,
    rule: ValidationRule
  ): { isValid: boolean; error?: string } {
    if (!rule.customValidator) {
      return {
        isValid: false,
        error: 'Custom validator function not provided'
      };
    }

    try {
      const isValid = rule.customValidator(value);
      return {
        isValid,
        error: isValid ? undefined : (rule.errorMessage || 'Custom validation failed')
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Custom validation error'
      };
    }
  }

  /**
   * Validate required fields
   */
  static validateRequired(
    fieldName: string,
    value: any,
    mapping: TemplateMapping
  ): { isValid: boolean; error?: string } {
    if (!mapping.required) {
      return { isValid: true };
    }

    if (value === null || value === undefined || value === '') {
      return {
        isValid: false,
        error: `${fieldName} is required`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate entire payload against template mappings
   */
  static validatePayload(
    data: Record<string, any>,
    mappings: TemplateMapping[]
  ): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    for (const mapping of mappings) {
      const value = this.getNestedValue(data, mapping.sourceField);

      // Check required validation
      const requiredResult = this.validateRequired(mapping.sourceField, value, mapping);
      if (!requiredResult.isValid && requiredResult.error) {
        errors[mapping.sourceField] = requiredResult.error;
        continue;
      }

      // Skip other validations if value is empty and field is not required
      if (!mapping.required && (value === null || value === undefined || value === '')) {
        continue;
      }

      // Apply field validation if rule exists
      if (mapping.validation) {
        const validationResult = this.validateField(
          mapping.sourceField,
          value,
          mapping.validation
        );

        if (!validationResult.isValid && validationResult.error) {
          errors[mapping.sourceField] = validationResult.error;
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Validate lead data structure
   */
  static validateLeadData(lead: LeadData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields validation
    if (!lead.id) errors.push('Lead ID is required');
    if (!lead.serviceTypeId) errors.push('Service type ID is required');
    if (!lead.zipCode) errors.push('ZIP code is required');
    if (lead.ownsHome === null || lead.ownsHome === undefined) {
      errors.push('Home ownership status is required');
    }

    // ZIP code format validation
    if (lead.zipCode) {
      const zipResult = this.validateZipCode(lead.zipCode, { type: 'zipcode' });
      if (!zipResult.isValid && zipResult.error) {
        errors.push(`Invalid ZIP code: ${zipResult.error}`);
      }
    }

    // Form data validation
    if (!lead.formData || typeof lead.formData !== 'object') {
      errors.push('Form data must be a valid object');
    }

    // Compliance data validation
    if (lead.complianceData) {
      if (!lead.complianceData.tcpaConsent) {
        errors.push('TCPA consent is required');
      }
      if (!lead.complianceData.privacyPolicyAccepted) {
        errors.push('Privacy policy acceptance is required');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize input data to prevent injection attacks
   */
  static sanitizeData(data: any): any {
    if (typeof data === 'string') {
      return data
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocols
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (data && typeof data === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeData(value);
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Validate data type compatibility
   */
  static validateTypeCompatibility(
    value: any,
    expectedType: string
  ): { isValid: boolean; convertedValue?: any; error?: string } {
    try {
      switch (expectedType.toLowerCase()) {
        case 'string':
          return { isValid: true, convertedValue: String(value) };

        case 'number':
          const numValue = typeof value === 'number' ? value : parseFloat(String(value));
          if (isNaN(numValue)) {
            return { isValid: false, error: 'Cannot convert to number' };
          }
          return { isValid: true, convertedValue: numValue };

        case 'boolean':
          if (typeof value === 'boolean') {
            return { isValid: true, convertedValue: value };
          }
          const stringValue = String(value).toLowerCase().trim();
          const boolValue = ['true', 'yes', 'y', '1', 'on'].includes(stringValue);
          return { isValid: true, convertedValue: boolValue };

        case 'array':
          if (Array.isArray(value)) {
            return { isValid: true, convertedValue: value };
          }
          return { isValid: false, error: 'Value is not an array' };

        case 'object':
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            return { isValid: true, convertedValue: value };
          }
          return { isValid: false, error: 'Value is not an object' };

        default:
          return { isValid: true, convertedValue: value };
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Type conversion failed'
      };
    }
  }

  /**
   * Validate payload size limits
   */
  static validatePayloadSize(
    data: any,
    maxSizeBytes: number = 1024 * 1024 // 1MB default
  ): { isValid: boolean; size: number; error?: string } {
    try {
      const jsonString = JSON.stringify(data);
      const sizeBytes = new Blob([jsonString]).size;

      if (sizeBytes > maxSizeBytes) {
        return {
          isValid: false,
          size: sizeBytes,
          error: `Payload size (${Math.round(sizeBytes / 1024)}KB) exceeds limit (${Math.round(maxSizeBytes / 1024)}KB)`
        };
      }

      return { isValid: true, size: sizeBytes };
    } catch (error) {
      return {
        isValid: false,
        size: 0,
        error: 'Failed to calculate payload size'
      };
    }
  }
}

/**
 * Validation rule builder for fluent API
 */
export class ValidationRuleBuilder {
  private rule: ValidationRule;

  constructor(type: ValidationRule['type']) {
    this.rule = { type };
  }

  pattern(regex: RegExp): this {
    this.rule.pattern = regex;
    return this;
  }

  min(value: number): this {
    this.rule.min = value;
    return this;
  }

  max(value: number): this {
    this.rule.max = value;
    return this;
  }

  custom(validator: (value: any) => boolean): this {
    this.rule.customValidator = validator;
    return this;
  }

  message(errorMessage: string): this {
    this.rule.errorMessage = errorMessage;
    return this;
  }

  build(): ValidationRule {
    return { ...this.rule };
  }

  // Static factory methods
  static string(): ValidationRuleBuilder {
    return new ValidationRuleBuilder('string');
  }

  static number(): ValidationRuleBuilder {
    return new ValidationRuleBuilder('number');
  }

  static boolean(): ValidationRuleBuilder {
    return new ValidationRuleBuilder('boolean');
  }

  static email(): ValidationRuleBuilder {
    return new ValidationRuleBuilder('email');
  }

  static phone(): ValidationRuleBuilder {
    return new ValidationRuleBuilder('phone');
  }

  static zipcode(): ValidationRuleBuilder {
    return new ValidationRuleBuilder('zipcode');
  }

  static custom(): ValidationRuleBuilder {
    return new ValidationRuleBuilder('custom');
  }
}

// Export for convenience
export const validator = DataValidator;
export const rules = ValidationRuleBuilder;
export default DataValidator;