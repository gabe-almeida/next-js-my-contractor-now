/**
 * Dynamic Zod Schema Generator
 *
 * WHY: Eliminates need for hardcoded per-service validation schemas.
 *      New services can be added via Admin UI without code changes.
 *
 * WHEN: Called by leads API route to validate form submissions.
 *
 * HOW: Parses ServiceType.formSchema JSON and builds a Zod schema dynamically
 *      based on field types, required flags, and validation rules.
 */

import { z } from 'zod';
import { complianceDataSchema } from './lead';

/**
 * Field definition from ServiceType.formSchema
 */
interface FormSchemaField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    message?: string;
  };
}

/**
 * Parsed formSchema structure
 */
interface FormSchema {
  fields: FormSchemaField[];
}

/**
 * Cache for generated schemas to avoid repeated parsing
 * Key: formSchemaJson hash, Value: generated Zod schema
 */
const schemaCache = new Map<string, z.ZodObject<any>>();

/**
 * Generate a simple hash for caching
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

/**
 * Build a Zod validator for a single field based on its definition
 *
 * WHY: Each field type needs different validation logic
 * WHEN: Called for each field in the formSchema
 * HOW: Switch on field type, apply validation rules, handle required/optional
 */
function buildFieldValidator(field: FormSchemaField): z.ZodTypeAny {
  let validator: z.ZodTypeAny;

  switch (field.type.toLowerCase()) {
    case 'number':
      let numValidator = z.number();
      if (field.validation?.min !== undefined) {
        numValidator = numValidator.min(field.validation.min, field.validation.message);
      }
      if (field.validation?.max !== undefined) {
        numValidator = numValidator.max(field.validation.max, field.validation.message);
      }
      validator = numValidator;
      break;

    case 'select':
    case 'radio':
      if (field.options && field.options.length > 0) {
        // Create enum from options
        validator = z.enum(field.options as [string, ...string[]]);
      } else {
        // No options defined, accept any string
        validator = z.string();
      }
      break;

    case 'checkbox':
      // Checkboxes can be boolean or string "true"/"false"
      validator = z.union([
        z.boolean(),
        z.enum(['true', 'false', 'yes', 'no', 'Yes', 'No']).transform(v =>
          v === 'true' || v === 'yes' || v === 'Yes'
        )
      ]);
      break;

    case 'email':
      validator = z.string().email(field.validation?.message || 'Invalid email format');
      break;

    case 'tel':
    case 'phone':
      // Flexible phone validation - accept various formats
      validator = z.string().regex(
        /^[\d\s\-\(\)\+\.]+$/,
        field.validation?.message || 'Invalid phone number format'
      ).min(10, 'Phone number too short');
      break;

    case 'date':
      validator = z.string().refine(
        (val) => !isNaN(Date.parse(val)),
        { message: field.validation?.message || 'Invalid date format' }
      );
      break;

    case 'textarea':
    case 'text':
    default:
      let strValidator = z.string();

      if (field.validation?.minLength !== undefined) {
        strValidator = strValidator.min(
          field.validation.minLength,
          field.validation.message || `Minimum ${field.validation.minLength} characters`
        );
      }
      if (field.validation?.maxLength !== undefined) {
        strValidator = strValidator.max(
          field.validation.maxLength,
          field.validation.message || `Maximum ${field.validation.maxLength} characters`
        );
      }
      if (field.validation?.pattern) {
        try {
          strValidator = strValidator.regex(
            new RegExp(field.validation.pattern),
            field.validation.message || 'Invalid format'
          );
        } catch (e) {
          console.warn(`Invalid regex pattern for field ${field.name}: ${field.validation.pattern}`);
        }
      }
      validator = strValidator;
      break;
  }

  // Make optional if not required
  return field.required ? validator : validator.optional();
}

/**
 * Generate a Zod schema from ServiceType.formSchema JSON
 *
 * WHY: Enables dynamic validation without hardcoded per-service schemas
 * WHEN: Lead submission API validates incoming form data
 * HOW:
 *   1. Parse the formSchema JSON
 *   2. Build validators for each field
 *   3. Add standard contact fields if not already defined
 *   4. Return compiled Zod schema
 *
 * @param formSchemaJson - JSON string from ServiceType.formSchema
 * @returns Zod schema for validating form submissions
 *
 * EDGE CASES:
 * - Invalid JSON → Returns permissive schema with logging
 * - Empty fields array → Returns schema with standard fields only
 * - Unknown field types → Treated as text fields
 * - Duplicate field names → Last definition wins
 */
export function generateZodSchema(formSchemaJson: string): z.ZodObject<any> {
  // Check cache first
  const cacheKey = hashString(formSchemaJson);
  const cached = schemaCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const shape: Record<string, z.ZodTypeAny> = {};

  try {
    const formSchema: FormSchema = JSON.parse(formSchemaJson);

    if (!formSchema.fields || !Array.isArray(formSchema.fields)) {
      console.warn('Invalid formSchema: missing or invalid fields array');
      return createFallbackSchema();
    }

    // Track which standard fields are defined in the schema
    const definedFields = new Set<string>();

    // Build validators for each field in the schema
    for (const field of formSchema.fields) {
      if (!field.name) {
        console.warn('Skipping field with missing name:', field);
        continue;
      }

      shape[field.name] = buildFieldValidator(field);
      definedFields.add(field.name.toLowerCase());
    }

    // Add standard contact fields if not already defined
    // These are always expected in lead submissions
    if (!definedFields.has('firstname')) {
      shape.firstName = z.string().min(2, 'First name must be at least 2 characters');
    }
    if (!definedFields.has('lastname')) {
      shape.lastName = z.string().min(2, 'Last name must be at least 2 characters');
    }
    if (!definedFields.has('email')) {
      shape.email = z.string().email('Invalid email format');
    }
    if (!definedFields.has('phone')) {
      shape.phone = z.string().regex(
        /^[\d\s\-\(\)\+\.]+$/,
        'Invalid phone number format'
      ).min(10, 'Phone number too short');
    }

    // Add compliance data (always optional)
    shape.complianceData = complianceDataSchema;

  } catch (error) {
    console.error('Failed to parse formSchema JSON:', error);
    return createFallbackSchema();
  }

  // Create the schema with passthrough for additional fields
  // This allows form submissions to include fields not in the schema
  const schema = z.object(shape).passthrough();

  // Cache the result
  schemaCache.set(cacheKey, schema);

  return schema;
}

/**
 * Create a fallback schema for when formSchema parsing fails
 *
 * WHY: Graceful degradation - don't block leads due to schema issues
 * WHEN: formSchema is invalid JSON or missing fields
 * HOW: Return permissive schema that accepts common lead fields
 */
function createFallbackSchema(): z.ZodObject<any> {
  console.warn('Using fallback schema - formSchema parsing failed');

  return z.object({
    // Require basic contact info
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(10),
    // Accept any other fields
    complianceData: complianceDataSchema,
  }).passthrough();
}

/**
 * Validate form data against a dynamically generated schema
 *
 * WHY: Convenience wrapper for validation with detailed error reporting
 * WHEN: API route needs to validate incoming form data
 * HOW: Generate schema, validate data, return result with details
 *
 * @param formSchemaJson - JSON string from ServiceType.formSchema
 * @param formData - The form data to validate
 * @returns Validation result with success flag and errors/data
 */
export function validateFormData(
  formSchemaJson: string,
  formData: Record<string, unknown>
): {
  success: boolean;
  data?: Record<string, unknown>;
  errors?: z.ZodError['errors'];
} {
  const schema = generateZodSchema(formSchemaJson);
  const result = schema.safeParse(formData);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.errors,
  };
}

/**
 * Clear the schema cache
 *
 * WHY: Allow cache refresh if formSchema is updated
 * WHEN: Admin updates a service type's formSchema
 * HOW: Clear the entire cache map
 */
export function clearSchemaCache(): void {
  schemaCache.clear();
}

/**
 * Clear a specific schema from cache
 *
 * WHY: Targeted cache invalidation for a single service
 * WHEN: A specific service type's formSchema is updated
 * HOW: Remove the cached schema for that formSchema
 */
export function invalidateSchemaCache(formSchemaJson: string): void {
  const cacheKey = hashString(formSchemaJson);
  schemaCache.delete(cacheKey);
}
