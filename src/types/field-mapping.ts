/**
 * Field Mapping Type Definitions
 *
 * WHY: Central type definitions for the field mapping system
 * WHEN: Used throughout the application for type safety
 * HOW: Imported by configuration service, UI components, and API routes
 */

/**
 * Represents a single field mapping from lead data to buyer format
 *
 * WHY: Each buyer API expects different field names and formats
 * WHEN: Used when transforming lead data for PING/POST requests
 * HOW: Parsed from JSON stored in BuyerServiceConfig.fieldMappings
 */
export interface FieldMapping {
  /** Internal unique ID for this mapping */
  id: string;

  /** Source field from lead data (e.g., "firstName", "formData.windowType") */
  sourceField: string;

  /** Target field name expected by buyer API (e.g., "first_name", "customer_fname") */
  targetField: string;

  /** Optional transform function identifier (e.g., "boolean.yesNo", "phone.e164") */
  transform?: string;

  /**
   * Database-driven value mapping (applied BEFORE transform)
   *
   * WHY: Each buyer expects different values for the same field
   *      (e.g., "within_3_months" → "1-3 Months" for Modernize)
   * WHEN: Applied during payload generation, before any transform
   * HOW: Simple key-value lookup, falls back to original if no match
   *
   * Example: { "within_3_months": "1-3 Months", "repair": "Repair" }
   *
   * This is ADMIN-CONFIGURABLE via the UI - no code changes needed!
   */
  valueMap?: Record<string, string>;

  /** Whether this field must be present in the payload */
  required: boolean;

  /** Default value if source is empty/null (only for non-required fields) */
  defaultValue?: string | number | boolean;

  /** Human-readable description for admin UI */
  description?: string;

  /** Order in which field appears in payload (for readability) */
  order: number;

  /** Whether to include in PING requests (simplified payload) */
  includeInPing: boolean;

  /** Whether to include in POST requests (full payload) */
  includeInPost: boolean;
}

/**
 * Complete configuration for a buyer-service combination
 *
 * WHY: Encapsulates all field mapping settings for a buyer + service type
 * WHEN: Loaded when processing leads or displaying admin UI
 * HOW: Stored as JSON in BuyerServiceConfig.fieldMappings column
 */
export interface FieldMappingConfig {
  /** Schema version for future migrations */
  version: "1.0";

  /** Array of field mappings */
  mappings: FieldMapping[];

  /** Static fields always included in payload */
  staticFields: Record<string, string | number | boolean>;

  /** Configuration metadata */
  meta: {
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    updatedBy?: string;
    notes?: string;
  };
}

/**
 * Definition of an available source field
 *
 * WHY: Admin needs to know what fields are available to map
 * WHEN: Displayed in field selector dropdown in admin UI
 * HOW: Generated from service type form schemas + standard lead fields
 */
export interface SourceFieldDefinition {
  /** Field path (e.g., "firstName", "formData.windowType") */
  path: string;

  /** Human-readable label */
  label: string;

  /** Field data type */
  type: SourceFieldType;

  /** Category for grouping in UI */
  category: SourceFieldCategory;

  /** Example value for preview */
  example: string;

  /** Whether field is always present in lead data */
  guaranteed: boolean;
}

/** Supported source field types */
export type SourceFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "email"
  | "phone";

/** Categories for grouping source fields in UI */
export type SourceFieldCategory =
  | "contact"
  | "property"
  | "service"
  | "compliance"
  | "meta";

/**
 * Metadata about a transform function
 *
 * WHY: Admin needs to select transforms from a known list with examples
 * WHEN: Displayed in transform dropdown in admin UI
 * HOW: Static registry of all available transforms
 */
export interface TransformDefinition {
  /** Unique identifier (e.g., "boolean.yesNo") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what the transform does */
  description: string;

  /** Category for grouping in UI */
  category: TransformCategory;

  /** Example showing input → output */
  example: {
    input: string;
    output: string;
  };

  /** Which source field types this transform accepts */
  acceptsTypes: SourceFieldType[];
}

/** Categories for grouping transforms in UI */
export type TransformCategory =
  | "boolean"
  | "string"
  | "number"
  | "date"
  | "phone"
  | "address"
  | "service";

/**
 * Result of validating a field mapping config
 *
 * WHY: Provide detailed validation feedback to admin
 * WHEN: Before saving configuration changes
 * HOW: Returned by validateFieldMappingConfig()
 */
export interface ValidationResult {
  /** Whether the config is valid */
  isValid: boolean;

  /** Array of error messages if invalid */
  errors: ValidationError[];

  /** Array of warning messages (non-blocking) */
  warnings: ValidationWarning[];
}

export interface ValidationError {
  /** Which mapping or field has the error */
  field: string;

  /** Error message */
  message: string;

  /** Error code for programmatic handling */
  code: ValidationErrorCode;
}

export interface ValidationWarning {
  /** Which mapping or field has the warning */
  field: string;

  /** Warning message */
  message: string;
}

export type ValidationErrorCode =
  | "DUPLICATE_SOURCE"
  | "DUPLICATE_TARGET"
  | "EMPTY_FIELD"
  | "INVALID_TRANSFORM"
  | "INVALID_PATH"
  | "REQUIRED_DEFAULT";

/**
 * Payload preview result
 *
 * WHY: Show admin exactly what JSON will be sent
 * WHEN: In payload preview tab of admin UI
 * HOW: Generated by applying mappings to sample data
 */
export interface PayloadPreviewResult {
  /** Generated PING payload */
  pingPayload: Record<string, unknown>;

  /** Generated POST payload */
  postPayload: Record<string, unknown>;

  /** Any errors that occurred during transformation */
  errors: TransformError[];

  /** Field count stats */
  stats: {
    pingFieldCount: number;
    postFieldCount: number;
    staticFieldCount: number;
    complianceFieldCount: number;
  };
}

export interface TransformError {
  /** Source field that failed */
  sourceField: string;

  /** Transform that failed */
  transform: string;

  /** Error message */
  message: string;
}

/**
 * API response for field mapping endpoints
 *
 * WHY: Standardized API response format
 * WHEN: Returned by all field mapping API routes
 * HOW: Wraps config data with metadata
 */
export interface FieldMappingApiResponse {
  success: boolean;
  config: FieldMappingConfig | null;
  sourceFields: SourceFieldDefinition[];
  buyerId: string;
  serviceTypeId: string;
  error?: string;
}

/**
 * Request body for saving field mappings
 *
 * WHY: Type safety for API requests
 * WHEN: PUT /api/admin/field-mappings
 * HOW: Validated before processing
 */
export interface SaveFieldMappingRequest {
  buyerId: string;
  serviceTypeId: string;
  config: FieldMappingConfig;
}

/**
 * Creates a default empty field mapping config
 *
 * WHY: Provide consistent starting point for new configs
 * WHEN: Creating new buyer service config or no existing config
 * HOW: Called by configuration service when config is null
 */
export function createEmptyFieldMappingConfig(): FieldMappingConfig {
  return {
    version: "1.0",
    mappings: [],
    staticFields: {},
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Creates a new field mapping with defaults
 *
 * WHY: Ensure all required fields have values
 * WHEN: Adding a new mapping in admin UI
 * HOW: Merge provided values with defaults
 */
export function createFieldMapping(
  partial: Partial<FieldMapping> & Pick<FieldMapping, "sourceField" | "targetField">
): FieldMapping {
  return {
    id: partial.id || `mapping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sourceField: partial.sourceField,
    targetField: partial.targetField,
    transform: partial.transform,
    required: partial.required ?? true,
    defaultValue: partial.defaultValue,
    description: partial.description,
    order: partial.order ?? 0,
    includeInPing: partial.includeInPing ?? true,
    includeInPost: partial.includeInPost ?? true,
  };
}
