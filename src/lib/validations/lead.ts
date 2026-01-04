import { z } from 'zod';

// Base schemas
export const zipCodeSchema = z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format');

export const timeframeSchema = z.enum([
  'immediately',
  'within_1_month',
  '1_3_months',
  '3_6_months',
  '6_12_months',
  'planning_phase'
]);

// Attribution data schema for marketing tracking
export const attributionDataSchema = z.object({
  // UTM Parameters
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_content: z.string().optional(),
  utm_term: z.string().optional(),
  // Facebook
  fbclid: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  // Google
  gclid: z.string().optional(),
  wbraid: z.string().optional(),
  gbraid: z.string().optional(),
  _ga: z.string().optional(),
  _gid: z.string().optional(),
  // Microsoft
  msclkid: z.string().optional(),
  // TikTok
  ttclid: z.string().optional(),
  // Other platforms
  li_fat_id: z.string().optional(),
  twclid: z.string().optional(),
  rdt_cid: z.string().optional(),
  irclickid: z.string().optional(),
  // Affiliate tracking
  affiliate_id: z.string().optional(),
  aff: z.string().optional(),
  ref: z.string().optional(),
  // Page context
  landing_page: z.string().optional(),
  referrer: z.string().optional(),
  referrer_domain: z.string().optional(),
  first_touch_timestamp: z.string().optional(),
  session_id: z.string().optional(),
  raw_query_params: z.record(z.string()).optional(),
}).optional();

// Compliance data schema
export const complianceDataSchema = z.object({
  trustedFormCertUrl: z.string().url().optional(),
  trustedFormCertId: z.string().optional(),
  jornayaLeadId: z.string().optional(),
  tcpaConsent: z.boolean().optional(),
  tcpaConsentText: z.string().optional(),
  tcpaTimestamp: z.string().datetime().optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  fingerprint: z.string().optional(),
  attribution: attributionDataSchema,
}).optional();

// Base lead schema
export const createLeadSchema = z.object({
  serviceTypeId: z.string().uuid('Invalid service type ID'),
  formData: z.record(z.any()),
  zipCode: zipCodeSchema,
  ownsHome: z.boolean(),
  timeframe: timeframeSchema,
  complianceData: complianceDataSchema,
});

// Service-specific schemas
export const windowsFormSchema = z.object({
  zipCode: zipCodeSchema,
  ownsHome: z.boolean(),
  timeframe: timeframeSchema,
  numberOfWindows: z.enum(['1-3', '4-6', '7-10', '11-15', '16+']),
  windowTypes: z.array(z.enum([
    'double_hung',
    'casement',
    'sliding',
    'bay_bow',
    'awning',
    'picture',
    'single_hung',
    'garden'
  ])).min(1, 'Select at least one window type'),
  projectScope: z.enum([
    'full_replacement',
    'installation_only', 
    'repair',
    'not_sure'
  ]),
  budgetRange: z.enum([
    'under_5k',
    '5k_15k',
    '15k_30k',
    'over_30k'
  ]).optional(),
  currentWindowAge: z.enum([
    'under_5',
    '5_10',
    '10_20',
    'over_20'
  ]).optional(),
  homeType: z.enum([
    'single_family',
    'townhouse',
    'condo',
    'apartment'
  ]).optional(),
  urgency: z.enum([
    'immediate',
    'month',
    'quarter', 
    'year'
  ]).optional(),
  contactPreference: z.enum([
    'phone',
    'email',
    'text'
  ]).optional(),
  bestTimeToCall: z.enum([
    'morning',
    'afternoon',
    'evening',
    'anytime'
  ]).optional(),
  // Contact information
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(
    /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
    'Invalid phone number format'
  ),
  // Compliance fields
  complianceData: complianceDataSchema,
});

export const bathroomFormSchema = z.object({
  zipCode: zipCodeSchema,
  ownsHome: z.boolean(),
  timeframe: timeframeSchema,
  numberOfBathrooms: z.enum(['1', '2', '3', '4+']),
  projectType: z.enum([
    'full_remodel',
    'partial_update',
    'fixtures_only',
    'not_sure'
  ]),
  currentCondition: z.enum([
    'excellent',
    'good',
    'fair',
    'poor'
  ]),
  desiredFeatures: z.array(z.enum([
    'walk_in_shower',
    'bathtub',
    'double_vanity',
    'tile_flooring',
    'granite_countertops',
    'custom_cabinets',
    'heated_floors',
    'steam_shower'
  ])).min(1, 'Select at least one desired feature'),
  budgetRange: z.enum([
    'under_10k',
    '10k_25k',
    '25k_50k',
    'over_50k'
  ]).optional(),
  accessibilityNeeds: z.boolean().optional(),
  permitRequired: z.boolean().optional(),
  existingPlumbing: z.enum([
    'good',
    'needs_update',
    'unknown'
  ]).optional(),
  // Contact information
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/),
  complianceData: complianceDataSchema,
});

export const roofingFormSchema = z.object({
  zipCode: zipCodeSchema,
  ownsHome: z.boolean(),
  timeframe: timeframeSchema,
  homeAge: z.enum([
    'under_5',
    '5_10',
    '10_20',
    '20_30',
    'over_30'
  ]),
  roofType: z.enum([
    'asphalt_shingles',
    'metal',
    'tile',
    'slate',
    'flat',
    'other'
  ]),
  projectType: z.enum([
    'full_replacement',
    'repair',
    'inspection',
    'maintenance',
    'not_sure'
  ]),
  damageType: z.enum([
    'storm_damage',
    'age_wear',
    'leak',
    'missing_shingles',
    'structural',
    'other',
    'none'
  ]).optional(),
  urgency: z.enum([
    'emergency',
    'immediate',
    'month',
    'planning'
  ]),
  insuranceClaim: z.boolean().optional(),
  squareFootage: z.enum([
    'under_1500',
    '1500_2500',
    '2500_4000',
    'over_4000'
  ]).optional(),
  stories: z.enum(['1', '2', '3+']),
  // Contact information
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/),
  complianceData: complianceDataSchema,
});

// Query schemas
export const getLeadsQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20'),
  status: z.enum(['PENDING', 'PROCESSING', 'SOLD', 'REJECTED', 'EXPIRED']).optional(),
  serviceTypeId: z.string().uuid().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  zipCode: zipCodeSchema.optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'winningBid']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  complianceScore: z.enum(['high', 'medium', 'low']).optional(),
});

// Service type schemas
export const createServiceTypeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(100),
  formSchema: z.object({
    title: z.string().min(2),
    description: z.string(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.enum(['text', 'number', 'select', 'checkbox', 'radio', 'textarea', 'tel', 'email']),
      label: z.string(),
      placeholder: z.string().optional(),
      required: z.boolean(),
      options: z.array(z.string()).optional(),
      validation: z.object({
        min: z.number().optional(),
        max: z.number().optional(),
        pattern: z.string().optional(),
        custom: z.string().optional(),
        message: z.string().optional(),
      }).optional(),
      conditional: z.object({
        field: z.string(),
        operator: z.enum(['equals', 'not_equals', 'contains']),
        value: z.any(),
      }).optional(),
    })),
    complianceRequired: z.object({
      trustedForm: z.boolean(),
      jornaya: z.boolean(),
      tcpaConsent: z.boolean(),
    }),
  }),
});

export const updateServiceTypeSchema = createServiceTypeSchema.partial();

// Buyer schemas
export const createBuyerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  apiUrl: z.string().url('Invalid API URL'),
  authConfig: z.object({
    type: z.enum(['bearer', 'api_key', 'basic', 'custom']),
    token: z.string().optional(),
    apiKey: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    headers: z.record(z.string()).optional(),
  }).optional(),
  pingTimeout: z.number().min(5).max(300).default(30),
  postTimeout: z.number().min(10).max(600).default(60),
});

export const updateBuyerSchema = createBuyerSchema.partial();

// Buyer service configuration schema
export const createBuyerServiceConfigSchema = z.object({
  buyerId: z.string().uuid(),
  serviceTypeId: z.string().uuid(),
  pingTemplate: z.object({
    mappings: z.array(z.object({
      sourceField: z.string(),
      targetField: z.string(),
      transform: z.string().optional(),
      defaultValue: z.any().optional(),
      required: z.boolean().optional(),
    })),
    staticFields: z.record(z.any()).optional(),
    complianceFields: z.object({
      trustedFormCert: z.string().optional(),
      jornayaLeadId: z.string().optional(),
      ipAddress: z.string().optional(),
      userAgent: z.string().optional(),
    }).optional(),
  }),
  postTemplate: z.object({
    mappings: z.array(z.object({
      sourceField: z.string(),
      targetField: z.string(),
      transform: z.string().optional(),
      defaultValue: z.any().optional(),
      required: z.boolean().optional(),
    })),
    staticFields: z.record(z.any()).optional(),
    complianceFields: z.object({
      trustedFormCert: z.string().optional(),
      jornayaLeadId: z.string().optional(),
      ipAddress: z.string().optional(),
      userAgent: z.string().optional(),
    }).optional(),
  }),
  fieldMappings: z.array(z.object({
    sourceField: z.string(),
    targetField: z.string(),
    transform: z.string().optional(),
    defaultValue: z.any().optional(),
    required: z.boolean().optional(),
    condition: z.object({
      field: z.string(),
      operator: z.enum(['equals', 'not_equals', 'contains', 'exists']),
      value: z.any().optional(),
    }).optional(),
  })),
  requiresTrustedForm: z.boolean().default(false),
  requiresJornaya: z.boolean().default(false),
  complianceConfig: z.object({
    trustedFormSettings: z.object({
      certificateField: z.string(),
      includeInPing: z.boolean(),
      includeInPost: z.boolean(),
    }).optional(),
    jornayaSettings: z.object({
      leadIdField: z.string(),
      includeInPing: z.boolean(),
      includeInPost: z.boolean(),
    }).optional(),
    ipTrackingEnabled: z.boolean(),
    userAgentRequired: z.boolean(),
    tcpaConsentRequired: z.boolean(),
  }).optional(),
  minBid: z.number().min(0).default(0),
  maxBid: z.number().min(0).default(999.99),
});

// Type exports
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type WindowsFormInput = z.infer<typeof windowsFormSchema>;
export type BathroomFormInput = z.infer<typeof bathroomFormSchema>;
export type RoofingFormInput = z.infer<typeof roofingFormSchema>;
export type GetLeadsQuery = z.infer<typeof getLeadsQuerySchema>;
export type CreateServiceTypeInput = z.infer<typeof createServiceTypeSchema>;
export type UpdateServiceTypeInput = z.infer<typeof updateServiceTypeSchema>;
export type CreateBuyerInput = z.infer<typeof createBuyerSchema>;
export type UpdateBuyerInput = z.infer<typeof updateBuyerSchema>;
export type CreateBuyerServiceConfigInput = z.infer<typeof createBuyerServiceConfigSchema>;