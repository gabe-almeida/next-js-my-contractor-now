/**
 * Field Mapping Configuration Service
 *
 * WHY: Load, save, and apply field mappings from database
 * WHEN: Used by admin UI for configuration, auction engine for payload generation
 * HOW: Database operations via Prisma, caching for performance
 */

import { prisma } from "@/lib/prisma";
import {
  FieldMapping,
  FieldMappingConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  PayloadPreviewResult,
  TransformError,
  createEmptyFieldMappingConfig,
} from "@/types/field-mapping";
import { getSourceFieldsForService, findSourceField } from "./source-fields";
import { executeTransform, getTransformById } from "./transforms";

/**
 * Cache for field mapping configs
 *
 * WHY: Reduce database queries during high-volume lead processing
 * WHEN: Hot path - used on every PING/POST request
 * HOW: Simple in-memory cache with TTL
 */
const configCache = new Map<string, { config: FieldMappingConfig; expires: number }>();
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Generate cache key for buyer + service combination
 */
function getCacheKey(buyerId: string, serviceTypeId: string): string {
  return `${buyerId}:${serviceTypeId}`;
}

/**
 * Clear cache entry for a buyer + service
 *
 * WHY: Invalidate cache after config updates
 * WHEN: After saving configuration changes
 * HOW: Delete from cache map
 */
export function invalidateConfigCache(buyerId: string, serviceTypeId: string): void {
  const key = getCacheKey(buyerId, serviceTypeId);
  configCache.delete(key);
}

/**
 * Clear entire cache
 *
 * WHY: Full cache reset when needed
 * WHEN: Development, testing, or major configuration changes
 * HOW: Clear the map
 */
export function clearAllConfigCache(): void {
  configCache.clear();
}

/**
 * Load field mapping configuration for a buyer + service
 *
 * WHY: Get the field mappings to use for payload generation
 * WHEN: Before every PING/POST request, or in admin UI
 * HOW: Check cache first, then load from database
 *
 * @param buyerId - The buyer ID
 * @param serviceTypeId - The service type ID
 * @param skipCache - Force database load (for admin UI)
 * @returns The field mapping configuration or null if not found
 *
 * EDGE CASES:
 * - No BuyerServiceConfig exists → return null
 * - fieldMappings is null/empty → return empty config
 * - Invalid JSON → log error, return empty config
 */
export async function loadFieldMappingConfig(
  buyerId: string,
  serviceTypeId: string,
  skipCache = false
): Promise<FieldMappingConfig | null> {
  const cacheKey = getCacheKey(buyerId, serviceTypeId);

  // Check cache first (unless skipping)
  if (!skipCache) {
    const cached = configCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.config;
    }
  }

  // Load from database
  const serviceConfig = await prisma.buyerServiceConfig.findUnique({
    where: {
      buyerId_serviceTypeId: {
        buyerId,
        serviceTypeId,
      },
    },
    select: {
      fieldMappings: true,
    },
  });

  if (!serviceConfig) {
    return null;
  }

  // Parse field mappings JSON
  let config: FieldMappingConfig;
  try {
    if (!serviceConfig.fieldMappings) {
      config = createEmptyFieldMappingConfig();
    } else {
      config = JSON.parse(serviceConfig.fieldMappings);
    }
  } catch (error) {
    console.error(
      `Failed to parse field mappings for ${buyerId}/${serviceTypeId}:`,
      error
    );
    config = createEmptyFieldMappingConfig();
  }

  // Update cache
  configCache.set(cacheKey, {
    config,
    expires: Date.now() + CACHE_TTL_MS,
  });

  return config;
}

/**
 * Save field mapping configuration for a buyer + service
 *
 * WHY: Persist configuration changes from admin UI
 * WHEN: Admin saves field mapping changes
 * HOW: Validate, serialize to JSON, update database
 *
 * @param buyerId - The buyer ID
 * @param serviceTypeId - The service type ID
 * @param config - The configuration to save
 * @returns Validation result (will fail if invalid)
 *
 * EDGE CASES:
 * - BuyerServiceConfig doesn't exist → throw error
 * - Validation fails → return errors without saving
 */
export async function saveFieldMappingConfig(
  buyerId: string,
  serviceTypeId: string,
  config: FieldMappingConfig
): Promise<ValidationResult> {
  // Get service type for validation
  const serviceType = await prisma.serviceType.findUnique({
    where: { id: serviceTypeId },
    select: { name: true, formSchema: true },
  });

  if (!serviceType) {
    return {
      isValid: false,
      errors: [{ field: "serviceTypeId", message: "Service type not found", code: "INVALID_PATH" }],
      warnings: [],
    };
  }

  // Validate configuration
  const validation = validateFieldMappingConfig(config, {
    name: serviceType.name,
    formSchema: serviceType.formSchema || "{}",
  });

  if (!validation.isValid) {
    return validation;
  }

  // Update metadata
  config.meta.updatedAt = new Date().toISOString();

  // Save to database
  await prisma.buyerServiceConfig.update({
    where: {
      buyerId_serviceTypeId: {
        buyerId,
        serviceTypeId,
      },
    },
    data: {
      fieldMappings: JSON.stringify(config),
    },
  });

  // Invalidate cache
  invalidateConfigCache(buyerId, serviceTypeId);

  return validation;
}

/**
 * Validate a field mapping configuration
 *
 * WHY: Ensure configuration is valid before saving or using
 * WHEN: Before saving in admin UI, during system startup
 * HOW: Check for duplicates, empty fields, invalid transforms, etc.
 *
 * @param config - The configuration to validate
 * @param serviceType - Service type info for source field validation
 * @returns Validation result with errors and warnings
 */
export function validateFieldMappingConfig(
  config: FieldMappingConfig,
  serviceType: { name: string; formSchema: string }
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Get available source fields for this service type
  const sourceFields = getSourceFieldsForService(serviceType);

  // Track duplicates
  const sourceFieldSet = new Set<string>();
  const targetFieldSet = new Set<string>();

  for (const mapping of config.mappings) {
    // Check for empty fields
    if (!mapping.sourceField || mapping.sourceField.trim() === "") {
      errors.push({
        field: `mapping.${mapping.id}`,
        message: "Source field is required",
        code: "EMPTY_FIELD",
      });
    }

    if (!mapping.targetField || mapping.targetField.trim() === "") {
      errors.push({
        field: `mapping.${mapping.id}`,
        message: "Target field is required",
        code: "EMPTY_FIELD",
      });
    }

    // Check for duplicate source fields
    if (mapping.sourceField && sourceFieldSet.has(mapping.sourceField)) {
      errors.push({
        field: `mapping.${mapping.id}`,
        message: `Duplicate source field: ${mapping.sourceField}`,
        code: "DUPLICATE_SOURCE",
      });
    }
    sourceFieldSet.add(mapping.sourceField);

    // Check for duplicate target fields
    if (mapping.targetField && targetFieldSet.has(mapping.targetField)) {
      errors.push({
        field: `mapping.${mapping.id}`,
        message: `Duplicate target field: ${mapping.targetField}`,
        code: "DUPLICATE_TARGET",
      });
    }
    targetFieldSet.add(mapping.targetField);

    // Validate source field exists
    if (mapping.sourceField) {
      const sourceDef = findSourceField(sourceFields, mapping.sourceField);
      if (!sourceDef) {
        warnings.push({
          field: `mapping.${mapping.id}`,
          message: `Source field "${mapping.sourceField}" not found in schema`,
        });
      }
    }

    // Validate transform exists
    if (mapping.transform) {
      const transformDef = getTransformById(mapping.transform);
      if (!transformDef) {
        errors.push({
          field: `mapping.${mapping.id}`,
          message: `Unknown transform: ${mapping.transform}`,
          code: "INVALID_TRANSFORM",
        });
      }
    }

    // Warn if required field has no default
    if (mapping.required && !mapping.defaultValue) {
      warnings.push({
        field: `mapping.${mapping.id}`,
        message: `Required field "${mapping.targetField}" has no default value`,
      });
    }
  }

  // Check for required fields not included in POST
  const requiredMappingsInPost = config.mappings.filter(
    (m) => m.required && m.includeInPost
  );
  if (requiredMappingsInPost.length === 0) {
    warnings.push({
      field: "mappings",
      message: "No required fields will be included in POST payload",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generate payload preview for admin UI
 *
 * WHY: Show admin exactly what JSON will be sent to buyer
 * WHEN: In payload preview tab of admin UI
 * HOW: Apply mappings to sample data
 *
 * @param config - The field mapping configuration
 * @param sampleData - Sample lead data to transform
 * @returns Preview result with PING and POST payloads
 */
export function generatePayloadPreview(
  config: FieldMappingConfig,
  sampleData: Record<string, unknown>
): PayloadPreviewResult {
  const pingPayload: Record<string, unknown> = {};
  const postPayload: Record<string, unknown> = {};
  const errors: TransformError[] = [];

  // Sort mappings by order
  const sortedMappings = [...config.mappings].sort((a, b) => a.order - b.order);

  for (const mapping of sortedMappings) {
    try {
      // Get source value
      let value = getNestedValue(sampleData, mapping.sourceField);

      // Use default if value is null/undefined
      if (value === null || value === undefined) {
        if (mapping.defaultValue !== undefined) {
          value = mapping.defaultValue;
        } else if (mapping.required) {
          // Skip required fields with no value and no default
          continue;
        } else {
          continue;
        }
      }

      // Apply valueMap if specified (database-driven value conversion)
      // This happens BEFORE transforms - converts "within_3_months" → "1-3 Months"
      if (mapping.valueMap && typeof value === "string") {
        const mappedValue = mapping.valueMap[value];
        if (mappedValue !== undefined) {
          value = mappedValue;
        }
        // If no match in valueMap, keep original value
      }

      // Apply transform if specified (formatting like phone.digitsOnly)
      if (mapping.transform) {
        try {
          value = executeTransform(mapping.transform, value);
        } catch (error) {
          errors.push({
            sourceField: mapping.sourceField,
            transform: mapping.transform,
            message: error instanceof Error ? error.message : "Transform failed",
          });
          continue;
        }
      }

      // Add to appropriate payloads
      if (mapping.includeInPing) {
        setNestedValue(pingPayload, mapping.targetField, value);
      }
      if (mapping.includeInPost) {
        setNestedValue(postPayload, mapping.targetField, value);
      }
    } catch (error) {
      errors.push({
        sourceField: mapping.sourceField,
        transform: mapping.transform || "",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Add static fields to payloads
  // Support new pingStaticFields/postStaticFields structure with fallback to legacy staticFields
  const pingStaticFields = config.pingStaticFields || config.staticFields || {};
  const postStaticFields = config.postStaticFields || config.staticFields || {};

  for (const [key, value] of Object.entries(pingStaticFields)) {
    setNestedValue(pingPayload, key, value);
  }
  for (const [key, value] of Object.entries(postStaticFields)) {
    setNestedValue(postPayload, key, value);
  }

  // Count compliance fields
  const complianceFields = sortedMappings.filter((m) =>
    m.sourceField.startsWith("complianceData.") ||
    m.sourceField.includes("trustedForm") ||
    m.sourceField.includes("jornaya")
  );

  return {
    pingPayload,
    postPayload,
    errors,
    stats: {
      pingFieldCount: Object.keys(pingPayload).length,
      postFieldCount: Object.keys(postPayload).length,
      staticFieldCount: Object.keys(pingStaticFields).length + Object.keys(postStaticFields).length,
      complianceFieldCount: complianceFields.length,
    },
  };
}

/**
 * Apply field mappings to lead data for actual payload generation
 *
 * WHY: Transform lead data into buyer-expected format
 * WHEN: Building PING/POST request payloads in auction engine
 * HOW: Apply mappings and transforms, return structured payload
 *
 * @param config - The field mapping configuration
 * @param leadData - The actual lead data to transform
 * @param payloadType - Whether generating PING or POST payload
 * @returns Transformed payload ready to send to buyer
 */
export function applyFieldMappings(
  config: FieldMappingConfig,
  leadData: Record<string, unknown>,
  payloadType: "ping" | "post"
): { payload: Record<string, unknown>; errors: TransformError[] } {
  const payload: Record<string, unknown> = {};
  const errors: TransformError[] = [];

  // Sort mappings by order
  const sortedMappings = [...config.mappings].sort((a, b) => a.order - b.order);

  // Filter by payload type
  const relevantMappings = sortedMappings.filter((m) =>
    payloadType === "ping" ? m.includeInPing : m.includeInPost
  );

  for (const mapping of relevantMappings) {
    try {
      // Get source value
      let value = getNestedValue(leadData, mapping.sourceField);

      // Use default if value is null/undefined
      if (value === null || value === undefined) {
        if (mapping.defaultValue !== undefined) {
          value = mapping.defaultValue;
        } else {
          // Skip if no value and no default
          continue;
        }
      }

      // Apply valueMap if specified (database-driven value conversion)
      // This happens BEFORE transforms - converts "within_3_months" → "1-3 Months"
      if (mapping.valueMap && typeof value === "string") {
        const mappedValue = mapping.valueMap[value];
        if (mappedValue !== undefined) {
          value = mappedValue;
        }
        // If no match in valueMap, keep original value
      }

      // Apply transform if specified (formatting like phone.digitsOnly)
      if (mapping.transform) {
        value = executeTransform(mapping.transform, value);
      }

      // Add to payload
      setNestedValue(payload, mapping.targetField, value);
    } catch (error) {
      errors.push({
        sourceField: mapping.sourceField,
        transform: mapping.transform || "",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Add static fields based on payload type
  // Support new pingStaticFields/postStaticFields structure with fallback to legacy staticFields
  if (payloadType === "ping") {
    const pingStatic = config.pingStaticFields || config.staticFields || {};
    for (const [key, value] of Object.entries(pingStatic)) {
      setNestedValue(payload, key, value);
    }
  } else {
    const postStatic = config.postStaticFields || config.staticFields || {};
    for (const [key, value] of Object.entries(postStatic)) {
      setNestedValue(payload, key, value);
    }
  }

  return { payload, errors };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get nested value from object using dot notation path
 *
 * WHY: Source fields can be nested (e.g., "formData.windowType")
 * WHEN: Extracting values during payload generation
 * HOW: Split path and traverse object
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set nested value in object using dot notation path
 *
 * WHY: Target fields may need to be nested
 * WHEN: Building payload structure
 * HOW: Split path, create intermediate objects, set final value
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Get sample lead data for preview
 *
 * WHY: Admin needs realistic data to preview payload
 * WHEN: Generating payload preview in admin UI
 * HOW: Return mock data that matches typical lead structure
 */
export function getSampleLeadData(): Record<string, unknown> {
  return {
    id: "lead-sample-123",
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@example.com",
    phone: "555-123-4567",
    zipCode: "90210",
    ownsHome: true,
    timeframe: "1-3 months",
    status: "PENDING",
    leadQualityScore: 85,
    createdAt: new Date().toISOString(),
    trustedFormCertUrl: "https://cert.trustedform.com/abc123",
    trustedFormCertId: "abc123def456",
    jornayaLeadId: "jrn-789xyz",
    complianceData: {
      tcpaConsent: true,
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
      timestamp: new Date().toISOString(),
    },
    formData: {
      numberOfWindows: 8,
      windowsProjectScope: "partial_replacement",
      windowsStyle: "double_hung",
      windowsMaterial: "vinyl",
      additionalNotes: "Sample project description",
    },
  };
}

/**
 * List all buyer service configs that have field mappings
 *
 * WHY: Admin dashboard needs to show which configs are set up
 * WHEN: Loading admin dashboard or config list
 * HOW: Query database for configs with non-null fieldMappings
 */
export async function listConfiguredBuyerServices(): Promise<
  Array<{
    buyerId: string;
    buyerName: string;
    serviceTypeId: string;
    serviceTypeName: string;
    hasFieldMappings: boolean;
    mappingCount: number;
    updatedAt: string | null;
  }>
> {
  const configs = await prisma.buyerServiceConfig.findMany({
    where: { active: true },
    select: {
      buyerId: true,
      serviceTypeId: true,
      fieldMappings: true,
      buyer: { select: { name: true } },
      serviceType: { select: { displayName: true } },
    },
  });

  return configs.map((config) => {
    let hasFieldMappings = false;
    let mappingCount = 0;
    let updatedAt: string | null = null;

    if (config.fieldMappings) {
      try {
        const parsed = JSON.parse(config.fieldMappings) as FieldMappingConfig;
        hasFieldMappings = parsed.mappings.length > 0;
        mappingCount = parsed.mappings.length;
        updatedAt = parsed.meta.updatedAt;
      } catch {
        // Invalid JSON, treat as no mappings
      }
    }

    return {
      buyerId: config.buyerId,
      buyerName: config.buyer.name,
      serviceTypeId: config.serviceTypeId,
      serviceTypeName: config.serviceType.displayName,
      hasFieldMappings,
      mappingCount,
      updatedAt,
    };
  });
}
