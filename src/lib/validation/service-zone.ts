/**
 * Service Zone Validation Rules
 * Comprehensive validation for service zone management
 */

import { z } from 'zod';

// Base validation schemas
export const zipCodeSchema = z.string().regex(
  /^\d{5}(-\d{4})?$/,
  'Invalid ZIP code format. Use XXXXX or XXXXX-XXXX format'
);

export const stateCodeSchema = z.string().length(2).regex(
  /^[A-Z]{2}$/,
  'State code must be 2 uppercase letters'
);

export const prioritySchema = z.number()
  .int('Priority must be an integer')
  .min(1, 'Priority must be at least 1')
  .max(1000, 'Priority cannot exceed 1000');

export const bidAmountSchema = z.number()
  .min(0, 'Bid amount cannot be negative')
  .max(10000, 'Bid amount cannot exceed $10,000');

export const leadLimitSchema = z.number()
  .int('Lead limit must be an integer')
  .min(0, 'Lead limit cannot be negative')
  .max(1000, 'Lead limit cannot exceed 1000 per day');

// Service zone validation schemas
export const serviceZoneSchema = z.object({
  buyerId: z.string().uuid('Invalid buyer ID format'),
  serviceTypeId: z.string().uuid('Invalid service type ID format'),
  zipCode: zipCodeSchema,
  active: z.boolean().optional().default(true),
  priority: prioritySchema.optional().default(100),
  maxLeadsPerDay: leadLimitSchema.optional(),
  minBid: bidAmountSchema.optional(),
  maxBid: bidAmountSchema.optional()
}).refine(
  (data) => !data.minBid || !data.maxBid || data.minBid <= data.maxBid,
  {
    message: 'Minimum bid cannot be greater than maximum bid',
    path: ['minBid']
  }
);

export const bulkServiceZoneSchema = z.object({
  buyerId: z.string().uuid('Invalid buyer ID format'),
  serviceTypeId: z.string().uuid('Invalid service type ID format'),
  zipCodes: z.array(zipCodeSchema)
    .min(1, 'At least one ZIP code is required')
    .max(1000, 'Cannot process more than 1000 ZIP codes at once')
    .refine(
      (zipCodes) => new Set(zipCodes).size === zipCodes.length,
      'Duplicate ZIP codes are not allowed'
    ),
  active: z.boolean().optional().default(true),
  priority: prioritySchema.optional().default(100),
  maxLeadsPerDay: leadLimitSchema.optional(),
  minBid: bidAmountSchema.optional(),
  maxBid: bidAmountSchema.optional()
}).refine(
  (data) => !data.minBid || !data.maxBid || data.minBid <= data.maxBid,
  {
    message: 'Minimum bid cannot be greater than maximum bid',
    path: ['minBid']
  }
);

export const serviceZoneUpdateSchema = z.object({
  active: z.boolean().optional(),
  priority: prioritySchema.optional(),
  maxLeadsPerDay: leadLimitSchema.optional(),
  minBid: bidAmountSchema.optional(),
  maxBid: bidAmountSchema.optional()
}).refine(
  (data) => !data.minBid || !data.maxBid || data.minBid <= data.maxBid,
  {
    message: 'Minimum bid cannot be greater than maximum bid',
    path: ['minBid']
  }
);

// Filter validation schemas
export const serviceZoneFilterSchema = z.object({
  buyerId: z.string().uuid().optional(),
  serviceTypeId: z.string().uuid().optional(),
  zipCode: zipCodeSchema.optional(),
  zipCodes: z.array(zipCodeSchema).max(100).optional(),
  state: stateCodeSchema.optional(),
  active: z.boolean().optional(),
  includeRelations: z.boolean().optional().default(true),
  priority: z.object({
    min: prioritySchema.optional(),
    max: prioritySchema.optional()
  }).optional(),
  bidRange: z.object({
    min: bidAmountSchema.optional(),
    max: bidAmountSchema.optional()
  }).optional()
}).refine(
  (data) => !data.priority || !data.priority.min || !data.priority.max || data.priority.min <= data.priority.max,
  {
    message: 'Priority min cannot be greater than max',
    path: ['priority']
  }
).refine(
  (data) => !data.bidRange || !data.bidRange.min || !data.bidRange.max || data.bidRange.min <= data.bidRange.max,
  {
    message: 'Bid range min cannot be greater than max',
    path: ['bidRange']
  }
);

// Eligibility filter validation
export const eligibilityFilterSchema = z.object({
  serviceTypeId: z.string().uuid('Invalid service type ID format'),
  zipCode: zipCodeSchema,
  leadValue: z.number().min(0).optional(),
  timeframe: z.enum(['immediate', '1_week', '1_month', '3_months', 'flexible']).optional(),
  excludeBuyers: z.array(z.string().uuid()).max(50).optional(),
  maxParticipants: z.number().int().min(1).max(100).optional().default(10),
  requireMinBid: z.boolean().optional().default(false),
  minBidThreshold: bidAmountSchema.optional()
}).refine(
  (data) => !data.requireMinBid || data.minBidThreshold !== undefined,
  {
    message: 'Minimum bid threshold is required when requireMinBid is true',
    path: ['minBidThreshold']
  }
);

// Analytics query validation
export const analyticsQuerySchema = z.object({
  buyerId: z.string().uuid().optional(),
  serviceTypeId: z.string().uuid().optional(),
  state: stateCodeSchema.optional(),
  zipCode: zipCodeSchema.optional(),
  timeframe: z.enum(['24h', '7d', '30d', '90d', '1y']).optional().default('30d'),
  metrics: z.array(z.enum([
    'coverage',
    'participation',
    'bidding',
    'performance',
    'trends'
  ])).optional().default(['coverage', 'participation']),
  groupBy: z.enum(['state', 'buyer', 'serviceType', 'day', 'week']).optional()
});

// ZIP code metadata validation
export const zipCodeMetadataSchema = z.object({
  zipCode: zipCodeSchema,
  city: z.string().min(1).max(100),
  state: stateCodeSchema,
  county: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timezone: z.string().max(50).optional(),
  active: z.boolean().optional().default(true)
});

// Batch operation validation
export const batchOperationSchema = z.object({
  operation: z.enum(['create', 'update', 'delete', 'activate', 'deactivate']),
  filters: serviceZoneFilterSchema.optional(),
  data: z.union([
    serviceZoneSchema,
    serviceZoneUpdateSchema,
    bulkServiceZoneSchema
  ]).optional(),
  options: z.object({
    dryRun: z.boolean().optional().default(false),
    validateOnly: z.boolean().optional().default(false),
    skipDuplicates: z.boolean().optional().default(false)
  }).optional().default({})
});

// Export validation functions
export function validateServiceZone(data: unknown) {
  return serviceZoneSchema.safeParse(data);
}

export function validateBulkServiceZone(data: unknown) {
  return bulkServiceZoneSchema.safeParse(data);
}

export function validateServiceZoneUpdate(data: unknown) {
  return serviceZoneUpdateSchema.safeParse(data);
}

export function validateServiceZoneFilter(data: unknown) {
  return serviceZoneFilterSchema.safeParse(data);
}

export function validateEligibilityFilter(data: unknown) {
  return eligibilityFilterSchema.safeParse(data);
}

export function validateAnalyticsQuery(data: unknown) {
  return analyticsQuerySchema.safeParse(data);
}

export function validateZipCodeMetadata(data: unknown) {
  return zipCodeMetadataSchema.safeParse(data);
}

export function validateBatchOperation(data: unknown) {
  return batchOperationSchema.safeParse(data);
}

// Type exports
export type ServiceZoneInput = z.infer<typeof serviceZoneSchema>;
export type BulkServiceZoneInput = z.infer<typeof bulkServiceZoneSchema>;
export type ServiceZoneUpdate = z.infer<typeof serviceZoneUpdateSchema>;
export type ServiceZoneFilter = z.infer<typeof serviceZoneFilterSchema>;
export type EligibilityFilter = z.infer<typeof eligibilityFilterSchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type ZipCodeMetadata = z.infer<typeof zipCodeMetadataSchema>;
export type BatchOperation = z.infer<typeof batchOperationSchema>;

// Custom validation helpers
export class ServiceZoneValidator {
  /**
   * Validate ZIP code format and existence
   */
  static async validateZipCode(zipCode: string): Promise<{
    valid: boolean;
    error?: string;
    metadata?: any;
  }> {
    // Basic format validation
    const formatCheck = zipCodeSchema.safeParse(zipCode);
    if (!formatCheck.success) {
      return {
        valid: false,
        error: formatCheck.error.issues[0].message
      };
    }

    // In a real implementation, this would check against a ZIP code database
    // For now, just validate format
    return {
      valid: true,
      metadata: {
        zipCode,
        city: 'Mock City',
        state: 'CA',
        county: 'Mock County'
      }
    };
  }

  /**
   * Validate buyer-service combination
   */
  static async validateBuyerServiceCombination(
    buyerId: string,
    serviceTypeId: string
  ): Promise<{
    valid: boolean;
    error?: string;
    canCreateServiceZone: boolean;
  }> {
    // In a real implementation, this would check:
    // 1. If buyer exists and is active
    // 2. If service type exists and is active
    // 3. If buyer has configuration for this service type
    
    return {
      valid: true,
      canCreateServiceZone: true
    };
  }

  /**
   * Validate coverage overlap and conflicts
   */
  static async validateCoverageOverlap(
    buyerId: string,
    serviceTypeId: string,
    zipCodes: string[]
  ): Promise<{
    hasOverlap: boolean;
    conflicts: Array<{
      zipCode: string;
      existingBuyerId: string;
      existingBuyerName: string;
      priority: number;
    }>;
  }> {
    // In a real implementation, this would check for existing service zones
    return {
      hasOverlap: false,
      conflicts: []
    };
  }
}

export default {
  serviceZoneSchema,
  bulkServiceZoneSchema,
  serviceZoneUpdateSchema,
  serviceZoneFilterSchema,
  eligibilityFilterSchema,
  analyticsQuerySchema,
  zipCodeMetadataSchema,
  batchOperationSchema,
  ServiceZoneValidator
};