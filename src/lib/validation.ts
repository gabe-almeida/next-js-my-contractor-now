import { z } from 'zod';

// Base validation schemas
export const leadFormDataSchema = z.object({
  zipCode: z.string()
    .min(5, 'ZIP code must be at least 5 characters')
    .max(10, 'ZIP code cannot exceed 10 characters')
    .regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  
  homeOwnership: z.enum(['own', 'rent'], {
    required_error: 'Home ownership status is required'
  }),
  
  timeframe: z.enum(['immediate', '1-3months', '3-6months', '6+months'], {
    required_error: 'Project timeframe is required'
  }),
  
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name cannot exceed 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name contains invalid characters'),
  
  lastName: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name cannot exceed 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name contains invalid characters'),
  
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email cannot exceed 255 characters'),
  
  phone: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number cannot exceed 15 digits')
    .regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format'),
  
  address: z.object({
    street: z.string().min(5, 'Street address is required'),
    city: z.string().min(2, 'City is required'),
    state: z.string().length(2, 'State must be 2 characters'),
    zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code')
  }).optional()
});

// Service-specific validation schemas
export const windowsServiceSchema = leadFormDataSchema.extend({
  numberOfWindows: z.number()
    .int('Number of windows must be a whole number')
    .min(1, 'Must specify at least 1 window')
    .max(50, 'Cannot exceed 50 windows'),
  
  windowTypes: z.array(z.enum(['single-hung', 'double-hung', 'casement', 'sliding', 'bay', 'bow']))
    .min(1, 'Must select at least one window type'),
  
  projectScope: z.enum(['replacement', 'new-installation', 'repair'], {
    required_error: 'Project scope is required'
  }),
  
  currentWindowAge: z.enum(['0-5years', '5-10years', '10-20years', '20+years']).optional(),
  
  budget: z.enum(['under-5k', '5k-15k', '15k-30k', '30k+']).optional()
});

export const bathroomServiceSchema = leadFormDataSchema.extend({
  numberOfBathrooms: z.number()
    .int('Number of bathrooms must be a whole number')
    .min(1, 'Must specify at least 1 bathroom')
    .max(10, 'Cannot exceed 10 bathrooms'),
  
  bathroomType: z.enum(['full', 'half', 'master', 'guest'], {
    required_error: 'Bathroom type is required'
  }),
  
  projectScope: z.enum(['full-remodel', 'partial-remodel', 'fixtures-only', 'vanity-only'], {
    required_error: 'Project scope is required'
  }),
  
  fixturesNeeded: z.array(z.enum(['toilet', 'sink', 'shower', 'bathtub', 'vanity', 'tiles', 'lighting']))
    .min(1, 'Must select at least one fixture'),
  
  currentCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  
  budget: z.enum(['under-10k', '10k-25k', '25k-50k', '50k+']).optional()
});

export const roofingServiceSchema = leadFormDataSchema.extend({
  squareFootage: z.number()
    .int('Square footage must be a whole number')
    .min(500, 'Minimum 500 square feet')
    .max(10000, 'Maximum 10,000 square feet'),
  
  roofType: z.enum(['asphalt-shingles', 'metal', 'tile', 'slate', 'wood', 'flat'], {
    required_error: 'Roof type is required'
  }),
  
  projectType: z.enum(['replacement', 'repair', 'new-installation'], {
    required_error: 'Project type is required'
  }),
  
  damageAssessment: z.object({
    hasLeaks: z.boolean(),
    hasMissingShingles: z.boolean(),
    hasStructuralDamage: z.boolean(),
    ageOfRoof: z.enum(['0-5years', '5-10years', '10-20years', '20+years'])
  }),
  
  urgency: z.enum(['emergency', 'urgent', 'planned']).optional(),
  
  budget: z.enum(['under-15k', '15k-30k', '30k-60k', '60k+']).optional()
});

// Admin validation schemas
export const serviceTypeSchema = z.object({
  name: z.string()
    .min(3, 'Service type name must be at least 3 characters')
    .max(100, 'Service type name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s\-]+$/, 'Service type name contains invalid characters'),
  
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description cannot exceed 500 characters'),
  
  formSchema: z.object({
    fields: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['text', 'email', 'phone', 'number', 'select', 'radio', 'checkbox', 'textarea']),
      label: z.string(),
      required: z.boolean(),
      options: z.array(z.string()).optional(),
      validation: z.object({
        pattern: z.string().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        minLength: z.number().optional(),
        maxLength: z.number().optional()
      }).optional()
    })),
    validationRules: z.array(z.object({
      field: z.string(),
      rule: z.string(),
      message: z.string()
    }))
  }),
  
  active: z.boolean().default(true)
});

export const buyerSchema = z.object({
  name: z.string()
    .min(3, 'Buyer name must be at least 3 characters')
    .max(100, 'Buyer name cannot exceed 100 characters'),

  type: z.enum(['CONTRACTOR', 'NETWORK']).optional(),

  apiUrl: z.string()
    .url('API URL must be a valid URL')
    .max(500, 'API URL cannot exceed 500 characters'),

  authConfig: z.object({
    type: z.enum(['apikey', 'bearer', 'basic']),
    credentials: z.record(z.string())
  }),

  active: z.boolean().default(true),

  // Contact Information
  contactName: z.string().max(100).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(20).optional(),
  businessEmail: z.string().email().optional(),
  businessPhone: z.string().max(20).optional(),

  // Timeouts
  pingTimeout: z.number().min(1).max(300).optional(),
  postTimeout: z.number().min(1).max(600).optional()
});

export const buyerServiceConfigSchema = z.object({
  buyerId: z.string().uuid('Invalid buyer ID'),
  serviceTypeId: z.string().uuid('Invalid service type ID'),
  
  pingTemplate: z.record(z.any()),
  postTemplate: z.record(z.any()),
  fieldMappings: z.record(z.string()),
  
  bidFloor: z.number()
    .min(0, 'Bid floor cannot be negative')
    .max(1000, 'Bid floor cannot exceed $1000'),
  
  bidCeiling: z.number()
    .min(1, 'Bid ceiling must be at least $1')
    .max(2000, 'Bid ceiling cannot exceed $2000'),
  
  active: z.boolean().default(true)
});

// Request validation schemas
export const leadSubmissionSchema = z.object({
  serviceTypeId: z.string().uuid('Invalid service type ID'),
  formData: z.record(z.any()),
  metadata: z.object({
    sessionId: z.string().optional(),
    referrer: z.string().optional()
  }).optional()
});

// Utility functions
export function validateServiceSpecificData(serviceType: string, data: any) {
  switch (serviceType.toLowerCase()) {
    case 'windows':
      return windowsServiceSchema.safeParse(data);
    case 'bathrooms':
      return bathroomServiceSchema.safeParse(data);
    case 'roofing':
      return roofingServiceSchema.safeParse(data);
    default:
      return leadFormDataSchema.safeParse(data);
  }
}

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.trim().replace(/<[^>]*>/g, ''); // Remove HTML tags
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}