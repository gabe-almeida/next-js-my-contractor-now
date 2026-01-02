# Field Mapping System Specification

## Executive Summary

Transform the ping/post system from hardcoded configurations to a fully database-driven architecture with an intuitive admin UI for managing field mappings per buyer and service type.

> **Database**: PostgreSQL 16 (via Docker)
> **Schema Version**: Prisma 5.x

---

## Problem Statement

### Current Pain Points

1. **Hardcoded Configurations**: Adding/modifying buyer field mappings requires code changes and deployment
2. **Disconnected Database**: Database has `fieldMappings`, `pingTemplate`, `postTemplate` columns that are populated but never used
3. **No Admin UI**: No way to configure lead data field mappings (only compliance fields have UI)
4. **Developer Bottleneck**: Every buyer onboarding requires developer involvement

### Business Impact

- Slow buyer onboarding (days instead of minutes)
- Risk of errors in manual code changes
- No audit trail for configuration changes
- Operations team cannot self-serve

---

## User Stories

### Primary User: Admin/Operations Manager

#### US-1: View Existing Field Mappings
```
AS AN admin user
I WANT TO see all field mappings for a buyer-service combination
SO THAT I can understand how data is being transformed before it's sent

ACCEPTANCE CRITERIA:
- Can select buyer from dropdown
- Can select service type from dropdown
- See all current mappings in a table format
- See which fields are required vs optional
- See which transforms are applied
- See the last modified date and who modified it
```

#### US-2: Add New Field Mapping
```
AS AN admin user
I WANT TO add a new field mapping
SO THAT I can include additional data in the payload sent to buyers

ACCEPTANCE CRITERIA:
- Can select from available source fields (with autocomplete)
- Can type custom target field name
- Can optionally select a transform function
- Can mark as required or optional
- Can set a default value for optional fields
- See validation errors before saving
- See preview of how the field will appear in payload
```

#### US-3: Edit Existing Field Mapping
```
AS AN admin user
I WANT TO modify an existing field mapping
SO THAT I can correct mistakes or adapt to buyer API changes

ACCEPTANCE CRITERIA:
- Can change target field name
- Can change transform function
- Can toggle required status
- Can update default value
- See warning if changing a required field
- See preview of changes before saving
```

#### US-4: Delete Field Mapping
```
AS AN admin user
I WANT TO remove a field mapping
SO THAT I can stop sending unnecessary data to buyers

ACCEPTANCE CRITERIA:
- Can delete non-required fields immediately
- Must confirm deletion of required fields
- See warning about potential API failures
- Soft delete with ability to restore within 24 hours
```

#### US-5: Preview Payload
```
AS AN admin user
I WANT TO preview the complete payload that will be sent
SO THAT I can verify the configuration is correct before it goes live

ACCEPTANCE CRITERIA:
- See PING payload preview
- See POST payload preview
- Use sample lead data or input custom test data
- See exactly what JSON will be sent
- Highlight which fields are from mappings vs static
```

#### US-6: Clone Configuration
```
AS AN admin user
I WANT TO clone a buyer's field mappings to another service type
SO THAT I can quickly set up similar configurations

ACCEPTANCE CRITERIA:
- Select source buyer + service
- Select target buyer + service
- See diff of what will be created
- Option to merge or replace existing mappings
```

#### US-7: Bulk Import/Export
```
AS AN admin user
I WANT TO export/import field mappings as JSON
SO THAT I can backup configurations or migrate between environments

ACCEPTANCE CRITERIA:
- Export single buyer-service config
- Export all configs for a buyer
- Import with validation before applying
- See import preview with errors highlighted
```

---

## Technical Specification

### Phase 1: Database Schema Enhancement

#### 1.1 Enhanced JSON Schema for `fieldMappings`

**WHY**: Current simple key-value format lacks transform, validation, and metadata support
**WHEN**: Before any UI work begins
**HOW**: Define TypeScript types and JSON schema

```typescript
// src/types/field-mapping.ts

/**
 * WHY: Represents a single field mapping from lead data to buyer format
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
 * WHY: Complete configuration for a buyer-service combination
 * WHEN: Loaded when processing leads or displaying admin UI
 * HOW: Stored as JSON in BuyerServiceConfig table
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
```

**EDGE CASES TO HANDLE**:
1. Empty mappings array → Show helpful empty state, not error
2. Duplicate sourceField → Validate and reject on save
3. Duplicate targetField → Validate and reject on save
4. Invalid transform name → Validate against known transforms
5. Circular nested paths → Validate sourceField path format
6. Missing required fields at runtime → Log error, continue with other fields

**POSTGRESQL FUTURE ENHANCEMENTS**:
- Can convert `fieldMappings` from `String` to native `Json` type for:
  - Direct JSON path queries: `WHERE fieldMappings->>'version' = '1.0'`
  - GIN indexes on JSON fields for faster lookups
  - Partial updates without full JSON rewrite
- Currently using `String` for compatibility with existing code

---

#### 1.2 Available Source Fields Registry

**WHY**: Admin needs to know what fields are available to map
**WHEN**: Displayed in field selector dropdown
**HOW**: Generated from service type form schemas + standard lead fields

```typescript
// src/lib/field-mapping/source-fields.ts

/**
 * WHY: Defines all available source fields that can be mapped
 * WHEN: Used to populate the source field dropdown in admin UI
 * HOW: Combines standard lead fields with service-specific form fields
 */
export interface SourceFieldDefinition {
  /** Field path (e.g., "firstName", "formData.windowType") */
  path: string;

  /** Human-readable label */
  label: string;

  /** Field data type */
  type: "string" | "number" | "boolean" | "date" | "email" | "phone";

  /** Category for grouping in UI */
  category: "contact" | "property" | "service" | "compliance" | "meta";

  /** Example value for preview */
  example: string;

  /** Whether field is always present */
  guaranteed: boolean;
}

/**
 * WHY: Standard fields available for all lead types
 * WHEN: Always included in source field options
 * HOW: Hardcoded list - these never change
 */
export const STANDARD_SOURCE_FIELDS: SourceFieldDefinition[] = [
  // Contact Information
  { path: "firstName", label: "First Name", type: "string", category: "contact", example: "John", guaranteed: true },
  { path: "lastName", label: "Last Name", type: "string", category: "contact", example: "Smith", guaranteed: true },
  { path: "email", label: "Email Address", type: "email", category: "contact", example: "john@example.com", guaranteed: true },
  { path: "phone", label: "Phone Number", type: "phone", category: "contact", example: "555-123-4567", guaranteed: true },

  // Property Information
  { path: "zipCode", label: "ZIP Code", type: "string", category: "property", example: "90210", guaranteed: true },
  { path: "ownsHome", label: "Owns Home", type: "boolean", category: "property", example: "true", guaranteed: true },
  { path: "timeframe", label: "Project Timeframe", type: "string", category: "property", example: "1-3 months", guaranteed: true },

  // Compliance
  { path: "trustedFormCertUrl", label: "TrustedForm Cert URL", type: "string", category: "compliance", example: "https://cert.trustedform.com/...", guaranteed: false },
  { path: "trustedFormCertId", label: "TrustedForm Cert ID", type: "string", category: "compliance", example: "abc123", guaranteed: false },
  { path: "jornayaLeadId", label: "Jornaya Lead ID", type: "string", category: "compliance", example: "jrn-456", guaranteed: false },

  // Meta
  { path: "id", label: "Lead ID", type: "string", category: "meta", example: "lead-uuid-123", guaranteed: true },
  { path: "createdAt", label: "Submission Time", type: "date", category: "meta", example: "2024-01-15T10:30:00Z", guaranteed: true },
  { path: "leadQualityScore", label: "Quality Score", type: "number", category: "meta", example: "85", guaranteed: false },
];

/**
 * WHY: Get all source fields including service-specific ones
 * WHEN: Called when rendering source field dropdown
 * HOW: Merges standard fields with parsed form schema
 */
export function getSourceFieldsForService(
  serviceType: { name: string; formSchema: string }
): SourceFieldDefinition[] {
  const standardFields = [...STANDARD_SOURCE_FIELDS];

  try {
    const schema = JSON.parse(serviceType.formSchema);
    const formFields: SourceFieldDefinition[] = schema.fields.map((field: any) => ({
      path: `formData.${field.name}`,
      label: field.label,
      type: mapFieldType(field.type),
      category: "service" as const,
      example: getExampleValue(field),
      guaranteed: field.required,
    }));

    return [...standardFields, ...formFields];
  } catch (error) {
    console.error("Failed to parse form schema:", error);
    return standardFields;
  }
}
```

**EDGE CASES TO HANDLE**:
1. Invalid form schema JSON → Return only standard fields, log warning
2. Form schema with unknown field types → Map to "string" as fallback
3. Field name collisions → Prefix form fields with "formData."
4. Empty form schema → Return only standard fields

---

#### 1.3 Transform Functions Registry

**WHY**: Admin needs to select transforms from a known list
**WHEN**: Displayed in transform dropdown
**HOW**: Registry of available transform functions with metadata

```typescript
// src/lib/field-mapping/transforms.ts

/**
 * WHY: Metadata about a transform function for admin UI
 * WHEN: Used to populate transform dropdown and show help text
 * HOW: Static registry of all available transforms
 */
export interface TransformDefinition {
  /** Unique identifier (e.g., "boolean.yesNo") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what the transform does */
  description: string;

  /** Category for grouping */
  category: "boolean" | "string" | "number" | "date" | "phone" | "address" | "service";

  /** Example: input → output */
  example: { input: string; output: string };

  /** Which source field types this transform accepts */
  acceptsTypes: ("string" | "number" | "boolean" | "date")[];
}

/**
 * WHY: Complete list of available transforms
 * WHEN: Loaded once on admin page load
 * HOW: Exported constant array
 */
export const AVAILABLE_TRANSFORMS: TransformDefinition[] = [
  // Boolean transforms
  {
    id: "boolean.yesNo",
    name: "Yes/No",
    description: "Converts true/false to 'Yes'/'No'",
    category: "boolean",
    example: { input: "true", output: "Yes" },
    acceptsTypes: ["boolean", "string"],
  },
  {
    id: "boolean.trueFalse",
    name: "True/False String",
    description: "Converts to 'True'/'False' strings",
    category: "boolean",
    example: { input: "true", output: "True" },
    acceptsTypes: ["boolean", "string"],
  },
  {
    id: "boolean.oneZero",
    name: "1/0",
    description: "Converts to 1 or 0",
    category: "boolean",
    example: { input: "true", output: "1" },
    acceptsTypes: ["boolean", "string"],
  },

  // String transforms
  {
    id: "string.uppercase",
    name: "UPPERCASE",
    description: "Converts text to uppercase",
    category: "string",
    example: { input: "John", output: "JOHN" },
    acceptsTypes: ["string"],
  },
  {
    id: "string.lowercase",
    name: "lowercase",
    description: "Converts text to lowercase",
    category: "string",
    example: { input: "JOHN", output: "john" },
    acceptsTypes: ["string"],
  },
  {
    id: "string.capitalize",
    name: "Capitalize",
    description: "Capitalizes first letter of each word",
    category: "string",
    example: { input: "john smith", output: "John Smith" },
    acceptsTypes: ["string"],
  },

  // Phone transforms
  {
    id: "phone.e164",
    name: "E.164 Format",
    description: "Formats to international E.164 (+1XXXXXXXXXX)",
    category: "phone",
    example: { input: "555-123-4567", output: "+15551234567" },
    acceptsTypes: ["string"],
  },
  {
    id: "phone.digits",
    name: "Digits Only",
    description: "Removes all non-digit characters",
    category: "phone",
    example: { input: "(555) 123-4567", output: "5551234567" },
    acceptsTypes: ["string"],
  },
  {
    id: "phone.formatted",
    name: "Formatted (XXX) XXX-XXXX",
    description: "Formats to US phone format",
    category: "phone",
    example: { input: "5551234567", output: "(555) 123-4567" },
    acceptsTypes: ["string"],
  },

  // Address transforms
  {
    id: "address.stateAbbrev",
    name: "State Abbreviation",
    description: "Converts state name to 2-letter code",
    category: "address",
    example: { input: "California", output: "CA" },
    acceptsTypes: ["string"],
  },
  {
    id: "address.stateFull",
    name: "State Full Name",
    description: "Converts 2-letter code to full name",
    category: "address",
    example: { input: "CA", output: "California" },
    acceptsTypes: ["string"],
  },

  // Date transforms
  {
    id: "date.iso",
    name: "ISO 8601",
    description: "Formats to ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)",
    category: "date",
    example: { input: "Jan 15, 2024", output: "2024-01-15T00:00:00.000Z" },
    acceptsTypes: ["date", "string"],
  },
  {
    id: "date.timestamp",
    name: "Unix Timestamp",
    description: "Converts to Unix timestamp (seconds)",
    category: "date",
    example: { input: "Jan 15, 2024", output: "1705276800" },
    acceptsTypes: ["date", "string"],
  },
  {
    id: "date.mmddyyyy",
    name: "MM/DD/YYYY",
    description: "Formats to MM/DD/YYYY",
    category: "date",
    example: { input: "2024-01-15", output: "01/15/2024" },
    acceptsTypes: ["date", "string"],
  },

  // Service-specific transforms
  {
    id: "service.windowCount",
    name: "Window Count",
    description: "Extracts numeric value from range (e.g., '4-6' → 5)",
    category: "service",
    example: { input: "4-6", output: "5" },
    acceptsTypes: ["string"],
  },
  {
    id: "service.timeframeDays",
    name: "Timeframe to Days",
    description: "Converts timeframe to approximate days",
    category: "service",
    example: { input: "1-3 months", output: "60" },
    acceptsTypes: ["string"],
  },
];

/**
 * WHY: Get transforms compatible with a field type
 * WHEN: Filtering transform dropdown based on selected source field
 * HOW: Filter by acceptsTypes array
 */
export function getTransformsForType(
  fieldType: "string" | "number" | "boolean" | "date"
): TransformDefinition[] {
  return AVAILABLE_TRANSFORMS.filter((t) => t.acceptsTypes.includes(fieldType));
}
```

**EDGE CASES TO HANDLE**:
1. Unknown transform ID at runtime → Skip transform, use raw value, log warning
2. Transform throws error → Catch, log, use raw value
3. Null/undefined input to transform → Return default or empty string
4. Transform produces invalid type → Convert to string as fallback

---

### Phase 2: Database Configuration Loader

#### 2.1 Configuration Service

**WHY**: Need to load field mappings from database instead of hardcoded file
**WHEN**: Called by auction engine when processing leads
**HOW**: Prisma queries with caching layer

```typescript
// src/lib/field-mapping/configuration-service.ts

import { prisma } from "@/lib/prisma";
import { RedisCache } from "@/config/redis";
import { FieldMappingConfig, FieldMapping } from "@/types/field-mapping";
import { logger } from "@/lib/logger";

/**
 * Cache TTL for field mapping configs (5 minutes)
 * WHY: Balance between freshness and performance
 * WHEN: Applied to all cached configs
 */
const CONFIG_CACHE_TTL = 300;

/**
 * WHY: Load and parse field mapping configuration from database
 * WHEN: Called when processing a lead for a specific buyer-service combo
 * HOW: Query database, parse JSON, validate schema, cache result
 *
 * @param buyerId - UUID of the buyer
 * @param serviceTypeId - UUID of the service type
 * @returns Parsed and validated FieldMappingConfig or null if not found
 *
 * EDGE CASES:
 * - No config exists → Return null (caller handles fallback)
 * - Invalid JSON in database → Log error, return null
 * - Missing required fields → Add defaults, log warning
 * - Database error → Throw (caller handles retry/fallback)
 */
export async function getFieldMappingConfig(
  buyerId: string,
  serviceTypeId: string
): Promise<FieldMappingConfig | null> {
  const cacheKey = `field-mapping:${buyerId}:${serviceTypeId}`;

  // Try cache first
  const cached = await RedisCache.get<FieldMappingConfig>(cacheKey);
  if (cached) {
    logger.debug("Field mapping config cache hit", { buyerId, serviceTypeId });
    return cached;
  }

  // Query database
  const config = await prisma.buyerServiceConfig.findFirst({
    where: {
      buyerId,
      serviceTypeId,
      active: true,
    },
    select: {
      id: true,
      fieldMappings: true,
      pingTemplate: true,
      postTemplate: true,
    },
  });

  if (!config) {
    logger.warn("No field mapping config found", { buyerId, serviceTypeId });
    return null;
  }

  // Parse and validate
  try {
    const parsed = parseFieldMappingConfig(config.fieldMappings);

    // Cache the result
    await RedisCache.set(cacheKey, parsed, CONFIG_CACHE_TTL);

    return parsed;
  } catch (error) {
    logger.error("Failed to parse field mapping config", {
      buyerId,
      serviceTypeId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * WHY: Parse JSON string into typed FieldMappingConfig
 * WHEN: After loading from database
 * HOW: JSON.parse with schema validation and defaults
 *
 * EDGE CASES:
 * - Old format (simple key-value) → Migrate to new format
 * - Missing version field → Assume v1.0
 * - Empty mappings array → Valid, return empty config
 * - Invalid mapping objects → Filter out, log warning
 */
function parseFieldMappingConfig(json: string): FieldMappingConfig {
  const raw = JSON.parse(json);

  // Handle old simple format: { "zipCode": "zip" }
  if (!raw.version && !raw.mappings) {
    return migrateOldFormat(raw);
  }

  // Validate and normalize
  const config: FieldMappingConfig = {
    version: raw.version || "1.0",
    mappings: (raw.mappings || [])
      .filter(isValidMapping)
      .map(normalizeMapping),
    staticFields: raw.staticFields || {},
    meta: {
      createdAt: raw.meta?.createdAt || new Date().toISOString(),
      updatedAt: raw.meta?.updatedAt || new Date().toISOString(),
      createdBy: raw.meta?.createdBy,
      updatedBy: raw.meta?.updatedBy,
      notes: raw.meta?.notes,
    },
  };

  return config;
}

/**
 * WHY: Support migration from old simple format
 * WHEN: Encountering legacy configs in database
 * HOW: Convert { "source": "target" } to full mapping objects
 */
function migrateOldFormat(oldConfig: Record<string, string>): FieldMappingConfig {
  const mappings: FieldMapping[] = Object.entries(oldConfig).map(
    ([sourceField, targetField], index) => ({
      id: `migrated-${index}`,
      sourceField,
      targetField,
      required: true, // Assume required for safety
      order: index,
      includeInPing: true,
      includeInPost: true,
    })
  );

  logger.info("Migrated old field mapping format", {
    fieldCount: mappings.length
  });

  return {
    version: "1.0",
    mappings,
    staticFields: {},
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: "Auto-migrated from legacy format",
    },
  };
}

/**
 * WHY: Validate individual mapping object has required fields
 * WHEN: Filtering mappings array after parse
 * HOW: Check for required properties
 */
function isValidMapping(mapping: any): boolean {
  return (
    typeof mapping === "object" &&
    typeof mapping.sourceField === "string" &&
    typeof mapping.targetField === "string" &&
    mapping.sourceField.length > 0 &&
    mapping.targetField.length > 0
  );
}

/**
 * WHY: Ensure all mapping fields have proper defaults
 * WHEN: After validation, before returning
 * HOW: Merge with defaults
 */
function normalizeMapping(mapping: any, index: number): FieldMapping {
  return {
    id: mapping.id || `mapping-${index}`,
    sourceField: mapping.sourceField,
    targetField: mapping.targetField,
    transform: mapping.transform || undefined,
    required: mapping.required ?? true,
    defaultValue: mapping.defaultValue,
    description: mapping.description,
    order: mapping.order ?? index,
    includeInPing: mapping.includeInPing ?? true,
    includeInPost: mapping.includeInPost ?? true,
  };
}

/**
 * WHY: Invalidate cache when config is updated
 * WHEN: Called after saving config changes in admin UI
 * HOW: Delete specific cache key
 */
export async function invalidateFieldMappingCache(
  buyerId: string,
  serviceTypeId: string
): Promise<void> {
  const cacheKey = `field-mapping:${buyerId}:${serviceTypeId}`;
  await RedisCache.delete(cacheKey);
  logger.info("Field mapping cache invalidated", { buyerId, serviceTypeId });
}

/**
 * WHY: Save updated field mapping config to database
 * WHEN: Admin saves changes in UI
 * HOW: Serialize to JSON, update database, invalidate cache
 *
 * EDGE CASES:
 * - Concurrent updates → Use optimistic locking (updatedAt check)
 * - Invalid config → Validate before saving, throw on error
 * - Database error → Throw, let caller handle
 */
export async function saveFieldMappingConfig(
  buyerId: string,
  serviceTypeId: string,
  config: FieldMappingConfig,
  userId?: string
): Promise<void> {
  // Validate config
  validateFieldMappingConfig(config);

  // Update metadata
  config.meta.updatedAt = new Date().toISOString();
  if (userId) {
    config.meta.updatedBy = userId;
  }

  // Serialize and save
  const json = JSON.stringify(config);

  await prisma.buyerServiceConfig.updateMany({
    where: {
      buyerId,
      serviceTypeId,
    },
    data: {
      fieldMappings: json,
    },
  });

  // Invalidate cache
  await invalidateFieldMappingCache(buyerId, serviceTypeId);

  logger.info("Field mapping config saved", {
    buyerId,
    serviceTypeId,
    mappingCount: config.mappings.length,
  });
}

/**
 * WHY: Validate config before saving to prevent invalid data
 * WHEN: Before database write
 * HOW: Check for duplicates, invalid values, etc.
 */
function validateFieldMappingConfig(config: FieldMappingConfig): void {
  const errors: string[] = [];

  // Check for duplicate source fields
  const sourceFields = config.mappings.map((m) => m.sourceField);
  const duplicateSources = sourceFields.filter(
    (f, i) => sourceFields.indexOf(f) !== i
  );
  if (duplicateSources.length > 0) {
    errors.push(`Duplicate source fields: ${duplicateSources.join(", ")}`);
  }

  // Check for duplicate target fields
  const targetFields = config.mappings.map((m) => m.targetField);
  const duplicateTargets = targetFields.filter(
    (f, i) => targetFields.indexOf(f) !== i
  );
  if (duplicateTargets.length > 0) {
    errors.push(`Duplicate target fields: ${duplicateTargets.join(", ")}`);
  }

  // Check for empty field names
  config.mappings.forEach((m, i) => {
    if (!m.sourceField.trim()) {
      errors.push(`Mapping ${i + 1}: Source field is empty`);
    }
    if (!m.targetField.trim()) {
      errors.push(`Mapping ${i + 1}: Target field is empty`);
    }
  });

  // Check for invalid transforms
  const validTransforms = new Set(AVAILABLE_TRANSFORMS.map((t) => t.id));
  config.mappings.forEach((m, i) => {
    if (m.transform && !validTransforms.has(m.transform)) {
      errors.push(`Mapping ${i + 1}: Unknown transform "${m.transform}"`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Invalid field mapping config:\n${errors.join("\n")}`);
  }
}
```

---

### Phase 3: Auction Engine Integration

#### 3.1 Modified Buyer Eligibility

**WHY**: Need to use database configs instead of hardcoded registry
**WHEN**: When determining eligible buyers for a lead
**HOW**: Replace BuyerConfigurationRegistry calls with database queries

```typescript
// src/lib/auction/database-buyer-loader.ts

import { prisma } from "@/lib/prisma";
import { getFieldMappingConfig } from "@/lib/field-mapping/configuration-service";
import { BuyerConfig, BuyerServiceConfig } from "@/lib/templates/types";
import { logger } from "@/lib/logger";

/**
 * WHY: Load buyer configuration from database for auction
 * WHEN: Called at start of auction to get eligible buyers
 * HOW: Query database, build typed config objects
 *
 * This replaces BuyerConfigurationRegistry.get() and getServiceConfig()
 *
 * EDGE CASES:
 * - Buyer not found → Return null
 * - Buyer inactive → Return null
 * - Missing service config → Return buyer without serviceConfig
 * - Invalid JSON fields → Parse errors logged, return partial config
 */
export async function loadBuyerFromDatabase(
  buyerId: string,
  serviceTypeId: string
): Promise<{ buyer: BuyerConfig; serviceConfig: BuyerServiceConfig } | null> {

  const buyer = await prisma.buyer.findFirst({
    where: {
      id: buyerId,
      active: true,
    },
    include: {
      serviceConfigs: {
        where: {
          serviceTypeId,
          active: true,
        },
        include: {
          serviceType: true,
        },
      },
    },
  });

  if (!buyer) {
    logger.debug("Buyer not found or inactive", { buyerId });
    return null;
  }

  const serviceConfig = buyer.serviceConfigs[0];
  if (!serviceConfig) {
    logger.debug("No service config for buyer", { buyerId, serviceTypeId });
    return null;
  }

  // Load field mapping config
  const fieldMappingConfig = await getFieldMappingConfig(buyerId, serviceTypeId);

  // Build typed buyer config
  const buyerConfig = buildBuyerConfig(buyer, fieldMappingConfig);
  const serviceConfigTyped = buildServiceConfig(serviceConfig, fieldMappingConfig);

  return { buyer: buyerConfig, serviceConfig: serviceConfigTyped };
}

/**
 * WHY: Convert database buyer record to typed BuyerConfig
 * WHEN: After loading from database
 * HOW: Parse JSON fields, build typed object
 */
function buildBuyerConfig(
  buyer: any,
  fieldMappingConfig: FieldMappingConfig | null
): BuyerConfig {
  let authConfig = { type: "none" as const, credentials: {} };
  try {
    if (buyer.authConfig) {
      authConfig = JSON.parse(decrypt(buyer.authConfig));
    }
  } catch (e) {
    logger.warn("Failed to parse buyer auth config", { buyerId: buyer.id });
  }

  let complianceFieldMappings = {};
  try {
    if (buyer.complianceFieldMappings) {
      complianceFieldMappings = JSON.parse(buyer.complianceFieldMappings);
    }
  } catch (e) {
    logger.warn("Failed to parse compliance field mappings", { buyerId: buyer.id });
  }

  return {
    id: buyer.id,
    name: buyer.name,
    displayName: buyer.displayName || buyer.name,
    type: buyer.type,
    active: buyer.active,
    authConfig,
    globalSettings: {
      pingTimeout: buyer.pingTimeout * 1000, // Convert to ms
      postTimeout: buyer.postTimeout * 1000,
      complianceFieldMappings,
      complianceRequirements: {
        requireTrustedForm: false, // Set from service config
        requireJornaya: false,
        requireTcpaConsent: false,
      },
    },
  };
}

/**
 * WHY: Convert database service config to typed BuyerServiceConfig
 * WHEN: After loading from database
 * HOW: Parse JSON fields, build template configs
 */
function buildServiceConfig(
  config: any,
  fieldMappingConfig: FieldMappingConfig | null
): BuyerServiceConfig {
  // Build ping template from field mapping config
  const pingMappings = fieldMappingConfig?.mappings
    .filter((m) => m.includeInPing)
    .map((m) => ({
      sourceField: m.sourceField,
      targetField: m.targetField,
      transform: m.transform,
      required: m.required,
      defaultValue: m.defaultValue,
    })) || [];

  // Build post template from field mapping config
  const postMappings = fieldMappingConfig?.mappings
    .filter((m) => m.includeInPost)
    .map((m) => ({
      sourceField: m.sourceField,
      targetField: m.targetField,
      transform: m.transform,
      required: m.required,
      defaultValue: m.defaultValue,
    })) || [];

  return {
    serviceTypeId: config.serviceTypeId,
    serviceTypeName: config.serviceType.name,
    active: config.active,
    pricing: {
      minBid: Number(config.minBid),
      maxBid: Number(config.maxBid),
      basePrice: Number(config.minBid),
    },
    compliance: {
      requireTrustedForm: config.requiresTrustedForm,
      requireJornaya: config.requiresJornaya,
    },
    pingTemplate: {
      mappings: pingMappings,
      includeCompliance: false,
      additionalFields: fieldMappingConfig?.staticFields || {},
    },
    postTemplate: {
      mappings: postMappings,
      includeCompliance: true,
      additionalFields: fieldMappingConfig?.staticFields || {},
    },
    webhookConfig: {
      pingUrl: `${config.buyer?.apiUrl}/ping`,
      postUrl: config.buyer?.apiUrl,
      timeouts: {
        ping: config.buyer?.pingTimeout * 1000 || 5000,
        post: config.buyer?.postTimeout * 1000 || 10000,
      },
    },
  };
}
```

---

### Phase 4: Admin UI Components

#### 4.1 Component Architecture

```
src/components/admin/field-mapping/
├── FieldMappingEditor.tsx      # Main container component
├── MappingTable.tsx            # Table of all mappings
├── MappingRow.tsx              # Single mapping row (editable)
├── AddMappingModal.tsx         # Modal to add new mapping
├── SourceFieldSelect.tsx       # Dropdown for source fields
├── TransformSelect.tsx         # Dropdown for transforms
├── StaticFieldsEditor.tsx      # Key-value editor for static fields
├── PayloadPreview.tsx          # Live preview of generated payload
├── ImportExportButtons.tsx     # Import/export functionality
└── hooks/
    ├── useFieldMappings.ts     # Data fetching and mutations
    ├── useSourceFields.ts      # Load available source fields
    └── usePayloadPreview.ts    # Generate preview payload
```

#### 4.2 Main Editor Component

```typescript
// src/components/admin/field-mapping/FieldMappingEditor.tsx

"use client";

import { useState, useCallback } from "react";
import { useFieldMappings } from "./hooks/useFieldMappings";
import { useSourceFields } from "./hooks/useSourceFields";
import { MappingTable } from "./MappingTable";
import { AddMappingModal } from "./AddMappingModal";
import { StaticFieldsEditor } from "./StaticFieldsEditor";
import { PayloadPreview } from "./PayloadPreview";
import { ImportExportButtons } from "./ImportExportButtons";
import { FieldMappingConfig, FieldMapping } from "@/types/field-mapping";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Plus, Eye, AlertTriangle } from "lucide-react";

/**
 * WHY: Main container for field mapping configuration
 * WHEN: Rendered on buyer edit page, service config section
 * HOW: Manages state and orchestrates child components
 *
 * USER JOURNEY:
 * 1. Admin navigates to Buyers → Edit → Service Configs tab
 * 2. Selects a service type
 * 3. Sees current field mappings in table
 * 4. Can add/edit/remove mappings
 * 5. Can preview payload
 * 6. Saves changes
 */
interface FieldMappingEditorProps {
  buyerId: string;
  serviceTypeId: string;
  serviceTypeName: string;
  onSave?: () => void;
}

export function FieldMappingEditor({
  buyerId,
  serviceTypeId,
  serviceTypeName,
  onSave,
}: FieldMappingEditorProps) {
  // Data fetching
  const {
    config,
    isLoading,
    error,
    isDirty,
    updateMapping,
    addMapping,
    removeMapping,
    reorderMappings,
    updateStaticFields,
    save,
    isSaving,
  } = useFieldMappings(buyerId, serviceTypeId);

  const { sourceFields, isLoading: fieldsLoading } = useSourceFields(serviceTypeId);

  // Local state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<"mappings" | "static" | "preview">("mappings");

  // Handlers
  const handleSave = useCallback(async () => {
    try {
      await save();
      onSave?.();
    } catch (error) {
      // Error handling is done in the hook
    }
  }, [save, onSave]);

  const handleAddMapping = useCallback((mapping: Omit<FieldMapping, "id" | "order">) => {
    addMapping(mapping);
    setShowAddModal(false);
  }, [addMapping]);

  // Loading state
  if (isLoading || fieldsLoading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading field mappings...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load field mappings: {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            Field Mappings: {serviceTypeName}
          </h3>
          <p className="text-sm text-gray-500">
            Configure how lead data is transformed for this buyer
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ImportExportButtons
            config={config}
            onImport={(imported) => {
              // Apply imported config
            }}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>

          <Button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            size="sm"
          >
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Dirty indicator */}
      {isDirty && (
        <Alert>
          <AlertDescription>
            You have unsaved changes. Don't forget to save before leaving.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="mappings">
            Field Mappings ({config?.mappings.length || 0})
          </TabsTrigger>
          <TabsTrigger value="static">
            Static Fields ({Object.keys(config?.staticFields || {}).length})
          </TabsTrigger>
          <TabsTrigger value="preview">
            Payload Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mappings" className="mt-4">
          {/* Mapping Table */}
          <MappingTable
            mappings={config?.mappings || []}
            sourceFields={sourceFields}
            onUpdate={updateMapping}
            onRemove={removeMapping}
            onReorder={reorderMappings}
          />

          {/* Add Button */}
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Field Mapping
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="static" className="mt-4">
          <StaticFieldsEditor
            fields={config?.staticFields || {}}
            onChange={updateStaticFields}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <PayloadPreview
            config={config}
            serviceTypeId={serviceTypeId}
          />
        </TabsContent>
      </Tabs>

      {/* Add Mapping Modal */}
      <AddMappingModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddMapping}
        sourceFields={sourceFields}
        existingMappings={config?.mappings || []}
      />
    </div>
  );
}
```

#### 4.3 Mapping Row Component

```typescript
// src/components/admin/field-mapping/MappingRow.tsx

"use client";

import { useState, useCallback } from "react";
import { FieldMapping, SourceFieldDefinition } from "@/types/field-mapping";
import { AVAILABLE_TRANSFORMS } from "@/lib/field-mapping/transforms";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GripVertical, Trash2, Info, AlertCircle } from "lucide-react";

/**
 * WHY: Display and edit a single field mapping
 * WHEN: Rendered for each mapping in MappingTable
 * HOW: Controlled inputs with immediate parent updates
 *
 * USER JOURNEY:
 * 1. See mapping details at a glance
 * 2. Click to edit target field name
 * 3. Select transform from dropdown
 * 4. Toggle required/ping/post checkboxes
 * 5. See validation errors inline
 * 6. Drag handle to reorder
 */
interface MappingRowProps {
  mapping: FieldMapping;
  sourceField?: SourceFieldDefinition;
  onUpdate: (id: string, updates: Partial<FieldMapping>) => void;
  onRemove: (id: string) => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

export function MappingRow({
  mapping,
  sourceField,
  onUpdate,
  onRemove,
  isDragging,
  dragHandleProps,
}: MappingRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Get compatible transforms for this source field type
  const compatibleTransforms = sourceField
    ? AVAILABLE_TRANSFORMS.filter((t) =>
        t.acceptsTypes.includes(sourceField.type as any)
      )
    : AVAILABLE_TRANSFORMS;

  // Handle target field change
  const handleTargetChange = useCallback((value: string) => {
    // Validate: no spaces, no special chars except underscore
    const sanitized = value.replace(/[^a-zA-Z0-9_]/g, "");

    if (sanitized !== value) {
      setErrors(["Only letters, numbers, and underscores allowed"]);
    } else {
      setErrors([]);
    }

    onUpdate(mapping.id, { targetField: sanitized });
  }, [mapping.id, onUpdate]);

  // Handle transform change
  const handleTransformChange = useCallback((value: string) => {
    onUpdate(mapping.id, {
      transform: value === "none" ? undefined : value
    });
  }, [mapping.id, onUpdate]);

  // Handle checkbox changes
  const handleRequiredChange = useCallback((checked: boolean) => {
    onUpdate(mapping.id, { required: checked });
  }, [mapping.id, onUpdate]);

  const handlePingChange = useCallback((checked: boolean) => {
    onUpdate(mapping.id, { includeInPing: checked });
  }, [mapping.id, onUpdate]);

  const handlePostChange = useCallback((checked: boolean) => {
    onUpdate(mapping.id, { includeInPost: checked });
  }, [mapping.id, onUpdate]);

  // Handle delete with confirmation for required fields
  const handleDelete = useCallback(() => {
    if (mapping.required) {
      if (!confirm(`"${mapping.sourceField}" is marked as required. Are you sure you want to remove it? This may cause API failures.`)) {
        return;
      }
    }
    onRemove(mapping.id);
  }, [mapping, onRemove]);

  const selectedTransform = AVAILABLE_TRANSFORMS.find(
    (t) => t.id === mapping.transform
  );

  return (
    <tr
      className={`
        border-b transition-colors
        ${isDragging ? "bg-blue-50" : "hover:bg-gray-50"}
      `}
    >
      {/* Drag Handle */}
      <td className="w-8 px-2">
        <div {...dragHandleProps} className="cursor-grab">
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
      </td>

      {/* Source Field */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
            {mapping.sourceField}
          </code>
          {sourceField && (
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div><strong>Type:</strong> {sourceField.type}</div>
                  <div><strong>Example:</strong> {sourceField.example}</div>
                  {!sourceField.guaranteed && (
                    <div className="text-yellow-600">May not always be present</div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </td>

      {/* Arrow */}
      <td className="w-8 text-center text-gray-400">→</td>

      {/* Target Field */}
      <td className="px-3 py-2">
        <div className="relative">
          <Input
            value={mapping.targetField}
            onChange={(e) => handleTargetChange(e.target.value)}
            className={`
              font-mono text-sm
              ${errors.length > 0 ? "border-red-500" : ""}
            `}
            placeholder="target_field_name"
          />
          {errors.length > 0 && (
            <div className="absolute -bottom-5 left-0 text-xs text-red-500">
              {errors[0]}
            </div>
          )}
        </div>
      </td>

      {/* Transform */}
      <td className="px-3 py-2">
        <Select
          value={mapping.transform || "none"}
          onValueChange={handleTransformChange}
        >
          <SelectTrigger className="w-40 text-sm">
            <SelectValue placeholder="No transform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-gray-500">No transform</span>
            </SelectItem>
            {compatibleTransforms.map((transform) => (
              <SelectItem key={transform.id} value={transform.id}>
                <div className="flex items-center gap-2">
                  <span>{transform.name}</span>
                  <span className="text-xs text-gray-400">
                    {transform.example.input} → {transform.example.output}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedTransform && (
          <div className="text-xs text-gray-500 mt-1">
            {selectedTransform.description}
          </div>
        )}
      </td>

      {/* Required */}
      <td className="px-3 py-2 text-center">
        <Checkbox
          checked={mapping.required}
          onCheckedChange={handleRequiredChange}
        />
      </td>

      {/* Include in PING */}
      <td className="px-3 py-2 text-center">
        <Checkbox
          checked={mapping.includeInPing}
          onCheckedChange={handlePingChange}
        />
      </td>

      {/* Include in POST */}
      <td className="px-3 py-2 text-center">
        <Checkbox
          checked={mapping.includeInPost}
          onCheckedChange={handlePostChange}
        />
      </td>

      {/* Actions */}
      <td className="px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
```

#### 4.4 Payload Preview Component

```typescript
// src/components/admin/field-mapping/PayloadPreview.tsx

"use client";

import { useState, useMemo } from "react";
import { FieldMappingConfig } from "@/types/field-mapping";
import { usePayloadPreview } from "./hooks/usePayloadPreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, RefreshCw } from "lucide-react";

/**
 * WHY: Show admin exactly what JSON will be sent to buyer
 * WHEN: Before saving, to verify configuration is correct
 * HOW: Generate payload using sample data and current config
 *
 * USER JOURNEY:
 * 1. Click "Preview" tab
 * 2. See PING payload (simplified)
 * 3. Switch to POST tab to see full payload
 * 4. Optionally edit sample data to test edge cases
 * 5. Copy payload for testing in external tool
 *
 * EDGE CASES:
 * - Empty mappings → Show empty object {}
 * - Transform errors → Show error inline with field
 * - Missing source data → Show null or default value
 */
interface PayloadPreviewProps {
  config: FieldMappingConfig | null;
  serviceTypeId: string;
}

export function PayloadPreview({ config, serviceTypeId }: PayloadPreviewProps) {
  const [viewMode, setViewMode] = useState<"ping" | "post">("ping");
  const [copied, setCopied] = useState(false);

  const {
    sampleData,
    setSampleData,
    pingPayload,
    postPayload,
    errors,
    regenerate,
    isLoading,
  } = usePayloadPreview(config, serviceTypeId);

  // Format JSON for display
  const displayPayload = useMemo(() => {
    const payload = viewMode === "ping" ? pingPayload : postPayload;
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return "Error generating preview";
    }
  }, [viewMode, pingPayload, postPayload]);

  // Copy to clipboard
  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* View Mode Tabs */}
      <div className="flex items-center justify-between">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <TabsList>
            <TabsTrigger value="ping">
              PING Payload
              <span className="ml-1 text-xs text-gray-500">
                ({config?.mappings.filter((m) => m.includeInPing).length || 0} fields)
              </span>
            </TabsTrigger>
            <TabsTrigger value="post">
              POST Payload
              <span className="ml-1 text-xs text-gray-500">
                ({config?.mappings.filter((m) => m.includeInPost).length || 0} fields)
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={regenerate}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Regenerate
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <h4 className="font-medium text-red-800 mb-2">Transform Errors</h4>
          <ul className="list-disc list-inside text-sm text-red-700">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Payload Display */}
      <div className="grid grid-cols-2 gap-4">
        {/* Sample Data Editor */}
        <div>
          <h4 className="font-medium text-sm mb-2">Sample Lead Data</h4>
          <Textarea
            value={JSON.stringify(sampleData, null, 2)}
            onChange={(e) => {
              try {
                setSampleData(JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, ignore
              }
            }}
            className="font-mono text-xs h-96"
            placeholder="Edit sample data..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Edit to test different scenarios
          </p>
        </div>

        {/* Generated Payload */}
        <div>
          <h4 className="font-medium text-sm mb-2">
            Generated {viewMode.toUpperCase()} Payload
          </h4>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs h-96 overflow-auto">
            <code>{displayPayload}</code>
          </pre>
          <p className="text-xs text-gray-500 mt-1">
            This is exactly what will be sent to the buyer
          </p>
        </div>
      </div>

      {/* Field Legend */}
      <div className="border rounded p-3 text-sm">
        <h4 className="font-medium mb-2">Field Legend</h4>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="inline-block w-3 h-3 bg-green-200 rounded mr-2"></span>
            From field mapping
          </div>
          <div>
            <span className="inline-block w-3 h-3 bg-blue-200 rounded mr-2"></span>
            Static field
          </div>
          <div>
            <span className="inline-block w-3 h-3 bg-purple-200 rounded mr-2"></span>
            Compliance data
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Phase 5: API Routes

#### 5.1 Field Mapping CRUD API

```typescript
// src/app/api/admin/field-mappings/route.ts

import { NextRequest, NextResponse } from "next/server";
import { withMiddleware, EnhancedRequest } from "@/lib/middleware";
import {
  getFieldMappingConfig,
  saveFieldMappingConfig,
  invalidateFieldMappingCache,
} from "@/lib/field-mapping/configuration-service";
import { getSourceFieldsForService } from "@/lib/field-mapping/source-fields";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/utils";

/**
 * GET /api/admin/field-mappings
 *
 * WHY: Load field mapping config for editing
 * WHEN: Admin opens field mapping editor
 * HOW: Query database, return parsed config
 *
 * Query params:
 * - buyerId: UUID of buyer
 * - serviceTypeId: UUID of service type
 */
async function handleGet(req: EnhancedRequest) {
  const { searchParams } = req.nextUrl;
  const buyerId = searchParams.get("buyerId");
  const serviceTypeId = searchParams.get("serviceTypeId");

  if (!buyerId || !serviceTypeId) {
    return NextResponse.json(
      errorResponse("VALIDATION_ERROR", "buyerId and serviceTypeId required"),
      { status: 400 }
    );
  }

  try {
    // Get config
    const config = await getFieldMappingConfig(buyerId, serviceTypeId);

    // Get source fields for this service type
    const serviceType = await prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
    });

    const sourceFields = serviceType
      ? getSourceFieldsForService(serviceType)
      : [];

    return NextResponse.json(
      successResponse({
        config,
        sourceFields,
        buyerId,
        serviceTypeId,
      })
    );
  } catch (error) {
    console.error("Failed to load field mappings:", error);
    return NextResponse.json(
      errorResponse("LOAD_ERROR", "Failed to load field mappings"),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/field-mappings
 *
 * WHY: Save updated field mapping config
 * WHEN: Admin clicks Save
 * HOW: Validate, serialize, update database, invalidate cache
 *
 * Body:
 * - buyerId: UUID
 * - serviceTypeId: UUID
 * - config: FieldMappingConfig object
 */
async function handlePut(req: EnhancedRequest) {
  const body = await req.json();
  const { buyerId, serviceTypeId, config } = body;

  if (!buyerId || !serviceTypeId || !config) {
    return NextResponse.json(
      errorResponse("VALIDATION_ERROR", "buyerId, serviceTypeId, and config required"),
      { status: 400 }
    );
  }

  try {
    // Save config (validation happens inside)
    await saveFieldMappingConfig(
      buyerId,
      serviceTypeId,
      config,
      req.context?.userId
    );

    return NextResponse.json(
      successResponse({
        success: true,
        message: "Field mappings saved successfully",
      })
    );
  } catch (error) {
    console.error("Failed to save field mappings:", error);

    // Check if validation error
    if (error instanceof Error && error.message.includes("Invalid field mapping")) {
      return NextResponse.json(
        errorResponse("VALIDATION_ERROR", error.message),
        { status: 400 }
      );
    }

    return NextResponse.json(
      errorResponse("SAVE_ERROR", "Failed to save field mappings"),
      { status: 500 }
    );
  }
}

export const GET = withMiddleware(handleGet, { requireAuth: true });
export const PUT = withMiddleware(handlePut, { requireAuth: true });
```

---

### Phase 6: Migration & Testing

#### 6.1 Migration Plan

```typescript
// scripts/migrate-field-mappings.ts

/**
 * WHY: Migrate existing hardcoded configs to database format
 * WHEN: Run once during deployment of this feature
 * HOW: Read configurations.ts, convert to new schema, update database
 *
 * STEPS:
 * 1. Load all BuyerServiceConfig records
 * 2. For each, check if fieldMappings is old format
 * 3. Convert to new FieldMappingConfig format
 * 4. Update database record
 * 5. Log results
 *
 * EDGE CASES:
 * - Config already in new format → Skip
 * - Invalid JSON → Log error, continue with others
 * - Missing service config → Create one
 */
```

#### 6.2 Test Cases

```typescript
// tests/field-mapping/configuration-service.test.ts

describe("FieldMappingConfigurationService", () => {
  describe("getFieldMappingConfig", () => {
    it("should return null for non-existent buyer", async () => {
      // ...
    });

    it("should parse new format correctly", async () => {
      // ...
    });

    it("should migrate old simple format", async () => {
      // ...
    });

    it("should cache results", async () => {
      // ...
    });

    it("should handle invalid JSON gracefully", async () => {
      // ...
    });
  });

  describe("saveFieldMappingConfig", () => {
    it("should reject duplicate source fields", async () => {
      // ...
    });

    it("should reject duplicate target fields", async () => {
      // ...
    });

    it("should reject unknown transforms", async () => {
      // ...
    });

    it("should invalidate cache after save", async () => {
      // ...
    });
  });
});
```

---

## Implementation Order

| Phase | Task | Dependencies | Est. Complexity |
|-------|------|--------------|-----------------|
| 1.1 | Type definitions | None | Low |
| 1.2 | Source fields registry | 1.1 | Low |
| 1.3 | Transforms registry | 1.1 | Low |
| 2.1 | Configuration service | 1.1, 1.3 | Medium |
| 3.1 | Database buyer loader | 2.1 | Medium |
| 3.2 | Auction engine integration | 3.1 | High |
| 4.1 | useFieldMappings hook | 2.1 | Medium |
| 4.2 | MappingTable component | 4.1, 1.2 | Medium |
| 4.3 | MappingRow component | 4.2, 1.3 | Medium |
| 4.4 | AddMappingModal | 4.3 | Low |
| 4.5 | PayloadPreview | 4.1 | Medium |
| 4.6 | FieldMappingEditor | 4.2-4.5 | Medium |
| 5.1 | API routes | 2.1 | Medium |
| 6.1 | Migration script | 2.1 | Medium |
| 6.2 | Tests | All | High |

---

## Edge Cases Summary

### Data Layer
1. Empty mappings array → Valid, empty payload
2. Duplicate source/target fields → Validation error on save
3. Invalid transform name → Skip transform, log warning
4. Old config format → Auto-migrate on load
5. Database connection error → Throw, caller handles retry
6. Cache miss → Load from DB, cache for 5 min
7. Concurrent updates → Last write wins (acceptable for admin tool)

### UI Layer
1. No config exists → Show empty state with "Add" button
2. Large number of mappings → Virtual scrolling (if >50)
3. Long field names → Truncate with tooltip
4. Unsaved changes + navigate away → Browser confirm prompt
5. Save while already saving → Disable button, debounce
6. API error on save → Show error toast, keep form state
7. Invalid JSON in preview editor → Ignore until valid

### Runtime Layer
1. Required field missing in lead data → Log error, continue with other fields
2. Transform throws exception → Catch, use raw value, log warning
3. Buyer API returns error → Log, mark lead as failed, don't retry transform
4. Config not found at auction time → Fall back to hardcoded config
5. Field path doesn't exist in lead → Return undefined, use default if set

---

## Success Metrics

1. **Buyer onboarding time**: Reduce from days to minutes
2. **Configuration errors**: Track validation rejections, aim for <5%
3. **Auction success rate**: Should not decrease after migration
4. **Admin satisfaction**: Survey after 30 days
5. **Cache hit rate**: Target >95% for field mapping configs

---

## Rollout Plan

### Stage 1: Shadow Mode (Week 1)
- Deploy new code with feature flag OFF
- Load configs from database but DON'T use them
- Log comparison between hardcoded and database configs
- Fix any discrepancies

### Stage 2: Single Buyer (Week 2)
- Enable for one low-volume buyer
- Monitor auction success rate
- Gather admin feedback on UI

### Stage 3: All New Buyers (Week 3)
- New buyers use database configs only
- Existing buyers still use hardcoded
- Admin can migrate individual buyers

### Stage 4: Full Migration (Week 4)
- Migrate all remaining buyers
- Remove hardcoded configurations.ts
- Deprecate BuyerConfigurationRegistry

---

*Specification Version: 1.0*
*Last Updated: 2026-01-02*
*Author: Claude*
