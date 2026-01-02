/**
 * Source Fields Registry
 *
 * WHY: Defines all available source fields that can be mapped to buyer formats
 * WHEN: Used to populate the source field dropdown in admin UI
 * HOW: Combines standard lead fields with service-specific form fields
 */

import {
  SourceFieldDefinition,
  SourceFieldType,
  SourceFieldCategory,
} from "@/types/field-mapping";

/**
 * Standard fields available for all lead types
 *
 * WHY: These fields exist on every lead regardless of service type
 * WHEN: Always included in source field options
 * HOW: Hardcoded list - these never change
 */
export const STANDARD_SOURCE_FIELDS: SourceFieldDefinition[] = [
  // Contact Information
  {
    path: "firstName",
    label: "First Name",
    type: "string",
    category: "contact",
    example: "John",
    guaranteed: true,
  },
  {
    path: "lastName",
    label: "Last Name",
    type: "string",
    category: "contact",
    example: "Smith",
    guaranteed: true,
  },
  {
    path: "email",
    label: "Email Address",
    type: "email",
    category: "contact",
    example: "john.smith@example.com",
    guaranteed: true,
  },
  {
    path: "phone",
    label: "Phone Number",
    type: "phone",
    category: "contact",
    example: "555-123-4567",
    guaranteed: true,
  },

  // Property Information
  {
    path: "zipCode",
    label: "ZIP Code",
    type: "string",
    category: "property",
    example: "90210",
    guaranteed: true,
  },
  {
    path: "ownsHome",
    label: "Owns Home",
    type: "boolean",
    category: "property",
    example: "true",
    guaranteed: true,
  },
  {
    path: "timeframe",
    label: "Project Timeframe",
    type: "string",
    category: "property",
    example: "1-3 months",
    guaranteed: true,
  },

  // Compliance Fields
  {
    path: "trustedFormCertUrl",
    label: "TrustedForm Cert URL",
    type: "string",
    category: "compliance",
    example: "https://cert.trustedform.com/abc123",
    guaranteed: false,
  },
  {
    path: "trustedFormCertId",
    label: "TrustedForm Cert ID",
    type: "string",
    category: "compliance",
    example: "abc123def456",
    guaranteed: false,
  },
  {
    path: "jornayaLeadId",
    label: "Jornaya Lead ID",
    type: "string",
    category: "compliance",
    example: "jrn-789xyz",
    guaranteed: false,
  },
  {
    path: "complianceData.tcpaConsent",
    label: "TCPA Consent",
    type: "boolean",
    category: "compliance",
    example: "true",
    guaranteed: false,
  },
  {
    path: "complianceData.ipAddress",
    label: "IP Address",
    type: "string",
    category: "compliance",
    example: "192.168.1.100",
    guaranteed: false,
  },
  {
    path: "complianceData.userAgent",
    label: "User Agent",
    type: "string",
    category: "compliance",
    example: "Mozilla/5.0...",
    guaranteed: false,
  },
  {
    path: "complianceData.timestamp",
    label: "Consent Timestamp",
    type: "date",
    category: "compliance",
    example: "2024-01-15T10:30:00Z",
    guaranteed: false,
  },

  // Meta Fields
  {
    path: "id",
    label: "Lead ID",
    type: "string",
    category: "meta",
    example: "lead-uuid-123-456",
    guaranteed: true,
  },
  {
    path: "createdAt",
    label: "Submission Time",
    type: "date",
    category: "meta",
    example: "2024-01-15T10:30:00Z",
    guaranteed: true,
  },
  {
    path: "leadQualityScore",
    label: "Quality Score",
    type: "number",
    category: "meta",
    example: "85",
    guaranteed: false,
  },
  {
    path: "status",
    label: "Lead Status",
    type: "string",
    category: "meta",
    example: "PENDING",
    guaranteed: true,
  },
];

/**
 * Maps form field types to SourceFieldType
 *
 * WHY: Form schemas use different type names than our system
 * WHEN: Parsing form schema to extract fields
 * HOW: Simple mapping with fallback to "string"
 */
export function mapFieldType(formFieldType: string): SourceFieldType {
  const typeMap: Record<string, SourceFieldType> = {
    text: "string",
    email: "email",
    tel: "phone",
    phone: "phone",
    number: "number",
    select: "string",
    radio: "string",
    checkbox: "boolean",
    date: "date",
    datetime: "date",
    textarea: "string",
  };

  return typeMap[formFieldType.toLowerCase()] || "string";
}

/**
 * Generates example value based on field definition
 *
 * WHY: Show realistic examples in admin UI
 * WHEN: Building source field definitions from form schema
 * HOW: Use first option for selects, or generate based on type
 */
export function getExampleValue(field: {
  type: string;
  options?: string[];
  name: string;
}): string {
  // If field has options, use the first one
  if (field.options && field.options.length > 0) {
    return field.options[0];
  }

  // Generate based on type
  switch (field.type.toLowerCase()) {
    case "number":
      return "5";
    case "email":
      return "example@email.com";
    case "tel":
    case "phone":
      return "555-123-4567";
    case "date":
      return "2024-01-15";
    case "checkbox":
      return "true";
    default:
      return `Sample ${field.name}`;
  }
}

/**
 * Service type form schema interface
 *
 * WHY: Type safety when parsing form schemas
 * WHEN: Extracting fields from service type
 * HOW: Matches structure stored in ServiceType.formSchema
 */
interface FormSchema {
  fields: Array<{
    name: string;
    type: string;
    label: string;
    required?: boolean;
    options?: string[];
  }>;
}

/**
 * Get all source fields for a specific service type
 *
 * WHY: Each service type has different form fields
 * WHEN: Loading source field dropdown for a buyer-service config
 * HOW: Merge standard fields with parsed form schema fields
 *
 * @param serviceType - Service type with name and formSchema JSON
 * @returns Array of all available source fields
 *
 * EDGE CASES:
 * - Invalid JSON schema → Return only standard fields, log warning
 * - Empty fields array → Return only standard fields
 * - Unknown field types → Map to "string"
 */
export function getSourceFieldsForService(serviceType: {
  name: string;
  formSchema: string;
}): SourceFieldDefinition[] {
  const standardFields = [...STANDARD_SOURCE_FIELDS];

  try {
    const schema: FormSchema = JSON.parse(serviceType.formSchema);

    if (!schema.fields || !Array.isArray(schema.fields)) {
      console.warn(
        `Invalid form schema for service type ${serviceType.name}: missing fields array`
      );
      return standardFields;
    }

    const formFields: SourceFieldDefinition[] = schema.fields.map((field) => ({
      path: `formData.${field.name}`,
      label: field.label || field.name,
      type: mapFieldType(field.type),
      category: "service" as SourceFieldCategory,
      example: getExampleValue(field),
      guaranteed: field.required ?? false,
    }));

    return [...standardFields, ...formFields];
  } catch (error) {
    console.error(
      `Failed to parse form schema for service type ${serviceType.name}:`,
      error
    );
    return standardFields;
  }
}

/**
 * Get source fields grouped by category
 *
 * WHY: UI displays fields in categorized groups
 * WHEN: Rendering source field dropdown with sections
 * HOW: Group fields by category property
 */
export function getSourceFieldsByCategory(
  fields: SourceFieldDefinition[]
): Record<SourceFieldCategory, SourceFieldDefinition[]> {
  const grouped: Record<SourceFieldCategory, SourceFieldDefinition[]> = {
    contact: [],
    property: [],
    service: [],
    compliance: [],
    meta: [],
  };

  for (const field of fields) {
    grouped[field.category].push(field);
  }

  return grouped;
}

/**
 * Find a source field definition by path
 *
 * WHY: Look up field metadata when displaying existing mappings
 * WHEN: Rendering mapping table with field details
 * HOW: Simple find by path
 */
export function findSourceField(
  fields: SourceFieldDefinition[],
  path: string
): SourceFieldDefinition | undefined {
  return fields.find((f) => f.path === path);
}

/**
 * Category display names for UI
 *
 * WHY: Human-readable category labels
 * WHEN: Rendering category headers in dropdown
 * HOW: Simple mapping object
 */
export const CATEGORY_LABELS: Record<SourceFieldCategory, string> = {
  contact: "Contact Information",
  property: "Property Details",
  service: "Service-Specific",
  compliance: "Compliance Data",
  meta: "Lead Metadata",
};
