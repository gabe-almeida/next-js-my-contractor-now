import { z } from 'zod';
import { FormField, FormValidationError } from '@/types/forms';

// Base validation schemas
export const phoneSchema = z.string()
  .regex(/^(\+1\s?)?(\([0-9]{3}\)|[0-9]{3})[\s\-]?[0-9]{3}[\s\-]?[0-9]{4}$/, 
    'Please enter a valid phone number');

export const emailSchema = z.string()
  .email('Please enter a valid email address');

export const zipCodeSchema = z.string()
  .regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code');

export const nameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be less than 50 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

// Dynamic schema builder
export function buildValidationSchema(fields: FormField[]): z.ZodObject<any> {
  const schemaFields: Record<string, z.ZodTypeAny> = {};

  fields.forEach(field => {
    let fieldSchema: z.ZodTypeAny;

    // Base schema by field type
    switch (field.type) {
      case 'email':
        fieldSchema = emailSchema;
        break;
      case 'tel':
        fieldSchema = phoneSchema;
        break;
      case 'number':
        fieldSchema = z.number();
        break;
      case 'date':
        fieldSchema = z.date();
        break;
      case 'select':
      case 'radio':
        if (field.options) {
          const values = field.options.map(opt => opt.value);
          fieldSchema = z.enum(values as [string, ...string[]]);
        } else {
          fieldSchema = z.string();
        }
        break;
      case 'multiselect':
      case 'checkbox':
        fieldSchema = z.array(z.string());
        break;
      default:
        fieldSchema = z.string();
    }

    // Apply custom validation rules
    if (field.validation) {
      const validation = field.validation;

      if (validation.min !== undefined) {
        if (field.type === 'number') {
          fieldSchema = (fieldSchema as z.ZodNumber).min(validation.min, 
            `Must be at least ${validation.min}`);
        } else {
          fieldSchema = (fieldSchema as z.ZodString).min(validation.min, 
            `Must be at least ${validation.min} characters`);
        }
      }

      if (validation.max !== undefined) {
        if (field.type === 'number') {
          fieldSchema = (fieldSchema as z.ZodNumber).max(validation.max, 
            `Must be no more than ${validation.max}`);
        } else {
          fieldSchema = (fieldSchema as z.ZodString).max(validation.max, 
            `Must be no more than ${validation.max} characters`);
        }
      }

      if (validation.pattern && field.type === 'text') {
        fieldSchema = (fieldSchema as z.ZodString).regex(
          new RegExp(validation.pattern), 
          validation.patternMessage || 'Invalid format'
        );
      }

      if (validation.custom) {
        fieldSchema = fieldSchema.refine(
          validation.custom.validator,
          validation.custom.message
        );
      }
    }

    // Handle required vs optional
    if (!field.required) {
      fieldSchema = fieldSchema.optional();
    }

    schemaFields[field.name] = fieldSchema;
  });

  return z.object(schemaFields);
}

// Validate individual field
export function validateField(field: FormField, value: any): FormValidationError | null {
  try {
    const schema = buildValidationSchema([field]);
    schema.parse({ [field.name]: value });
    return null;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return {
        field: field.name,
        message: issue.message,
        type: getErrorType(issue.code)
      };
    }
    return {
      field: field.name,
      message: 'Validation error',
      type: 'custom'
    };
  }
}

// Validate all form data
export function validateForm(fields: FormField[], data: Record<string, any>): FormValidationError[] {
  const errors: FormValidationError[] = [];
  
  fields.forEach(field => {
    const error = validateField(field, data[field.name]);
    if (error) {
      errors.push(error);
    }
  });

  return errors;
}

// Helper to map Zod error codes to our error types
function getErrorType(code: z.ZodIssueCode): FormValidationError['type'] {
  switch (code) {
    case z.ZodIssueCode.invalid_type:
      return 'required';
    case z.ZodIssueCode.too_small:
      return 'min';
    case z.ZodIssueCode.too_big:
      return 'max';
    case z.ZodIssueCode.invalid_string:
      return 'format';
    default:
      return 'custom';
  }
}

// Common validation helpers
export const validationHelpers = {
  isValidZipCode: (zip: string) => zipCodeSchema.safeParse(zip).success,
  isValidEmail: (email: string) => emailSchema.safeParse(email).success,
  isValidPhone: (phone: string) => phoneSchema.safeParse(phone).success,
  formatPhone: (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  },
  formatZipCode: (zip: string) => {
    const digits = zip.replace(/\D/g, '');
    if (digits.length === 9) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return digits.slice(0, 5);
  }
};