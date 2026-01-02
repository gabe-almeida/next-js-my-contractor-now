/**
 * Transforms Registry
 *
 * WHY: Lead buyers require data in specific formats (yes/no vs true/false, etc.)
 * WHEN: Applied during PING/POST payload generation
 * HOW: Registry of transform definitions + execution functions
 */

import {
  TransformDefinition,
  TransformCategory,
  SourceFieldType,
} from "@/types/field-mapping";

/**
 * All available transform functions
 *
 * WHY: Admin needs to select from a known list of transforms
 * WHEN: Building field mapping configuration in admin UI
 * HOW: Static registry with metadata for UI display
 */
export const AVAILABLE_TRANSFORMS: TransformDefinition[] = [
  // Boolean Transforms
  {
    id: "boolean.yesNo",
    name: "Yes/No",
    description: "Convert boolean to 'Yes' or 'No' string",
    category: "boolean",
    example: { input: "true", output: "Yes" },
    acceptsTypes: ["boolean", "string"],
  },
  {
    id: "boolean.yesNoLower",
    name: "yes/no (lowercase)",
    description: "Convert boolean to 'yes' or 'no' string",
    category: "boolean",
    example: { input: "true", output: "yes" },
    acceptsTypes: ["boolean", "string"],
  },
  {
    id: "boolean.YN",
    name: "Y/N",
    description: "Convert boolean to 'Y' or 'N' character",
    category: "boolean",
    example: { input: "false", output: "N" },
    acceptsTypes: ["boolean", "string"],
  },
  {
    id: "boolean.oneZero",
    name: "1/0",
    description: "Convert boolean to 1 or 0 integer",
    category: "boolean",
    example: { input: "true", output: "1" },
    acceptsTypes: ["boolean", "string"],
  },
  {
    id: "boolean.truefalse",
    name: "true/false (string)",
    description: "Convert boolean to lowercase 'true' or 'false' string",
    category: "boolean",
    example: { input: "true", output: "true" },
    acceptsTypes: ["boolean", "string"],
  },

  // String Transforms
  {
    id: "string.uppercase",
    name: "UPPERCASE",
    description: "Convert string to uppercase",
    category: "string",
    example: { input: "John Smith", output: "JOHN SMITH" },
    acceptsTypes: ["string"],
  },
  {
    id: "string.lowercase",
    name: "lowercase",
    description: "Convert string to lowercase",
    category: "string",
    example: { input: "John Smith", output: "john smith" },
    acceptsTypes: ["string"],
  },
  {
    id: "string.titlecase",
    name: "Title Case",
    description: "Convert string to title case",
    category: "string",
    example: { input: "john smith", output: "John Smith" },
    acceptsTypes: ["string"],
  },
  {
    id: "string.trim",
    name: "Trim Whitespace",
    description: "Remove leading and trailing whitespace",
    category: "string",
    example: { input: "  John  ", output: "John" },
    acceptsTypes: ["string"],
  },
  {
    id: "string.truncate50",
    name: "Truncate (50 chars)",
    description: "Truncate string to 50 characters",
    category: "string",
    example: { input: "Very long text...", output: "Very long text..." },
    acceptsTypes: ["string"],
  },
  {
    id: "string.truncate100",
    name: "Truncate (100 chars)",
    description: "Truncate string to 100 characters",
    category: "string",
    example: { input: "Very long text...", output: "Very long text..." },
    acceptsTypes: ["string"],
  },
  {
    id: "string.truncate255",
    name: "Truncate (255 chars)",
    description: "Truncate string to 255 characters",
    category: "string",
    example: { input: "Very long text...", output: "Very long text..." },
    acceptsTypes: ["string"],
  },

  // Phone Transforms
  {
    id: "phone.digitsOnly",
    name: "Digits Only",
    description: "Remove all non-digit characters from phone",
    category: "phone",
    example: { input: "(555) 123-4567", output: "5551234567" },
    acceptsTypes: ["phone", "string"],
  },
  {
    id: "phone.e164",
    name: "E.164 Format",
    description: "Convert to international E.164 format (+1...)",
    category: "phone",
    example: { input: "555-123-4567", output: "+15551234567" },
    acceptsTypes: ["phone", "string"],
  },
  {
    id: "phone.dashed",
    name: "Dashed Format",
    description: "Format as XXX-XXX-XXXX",
    category: "phone",
    example: { input: "5551234567", output: "555-123-4567" },
    acceptsTypes: ["phone", "string"],
  },
  {
    id: "phone.dotted",
    name: "Dotted Format",
    description: "Format as XXX.XXX.XXXX",
    category: "phone",
    example: { input: "5551234567", output: "555.123.4567" },
    acceptsTypes: ["phone", "string"],
  },
  {
    id: "phone.parentheses",
    name: "Parentheses Format",
    description: "Format as (XXX) XXX-XXXX",
    category: "phone",
    example: { input: "5551234567", output: "(555) 123-4567" },
    acceptsTypes: ["phone", "string"],
  },

  // Date Transforms
  {
    id: "date.isoDate",
    name: "ISO Date",
    description: "Format as YYYY-MM-DD",
    category: "date",
    example: { input: "2024-01-15T10:30:00Z", output: "2024-01-15" },
    acceptsTypes: ["date", "string"],
  },
  {
    id: "date.usDate",
    name: "US Date",
    description: "Format as MM/DD/YYYY",
    category: "date",
    example: { input: "2024-01-15", output: "01/15/2024" },
    acceptsTypes: ["date", "string"],
  },
  {
    id: "date.usDateShort",
    name: "US Date Short",
    description: "Format as M/D/YY",
    category: "date",
    example: { input: "2024-01-15", output: "1/15/24" },
    acceptsTypes: ["date", "string"],
  },
  {
    id: "date.timestamp",
    name: "Unix Timestamp",
    description: "Convert to Unix timestamp (seconds)",
    category: "date",
    example: { input: "2024-01-15T10:30:00Z", output: "1705315800" },
    acceptsTypes: ["date", "string"],
  },
  {
    id: "date.timestampMs",
    name: "Unix Timestamp (ms)",
    description: "Convert to Unix timestamp (milliseconds)",
    category: "date",
    example: { input: "2024-01-15T10:30:00Z", output: "1705315800000" },
    acceptsTypes: ["date", "string"],
  },
  {
    id: "date.iso8601",
    name: "ISO 8601 Full",
    description: "Full ISO 8601 format with timezone",
    category: "date",
    example: { input: "2024-01-15T10:30:00Z", output: "2024-01-15T10:30:00.000Z" },
    acceptsTypes: ["date", "string"],
  },

  // Number Transforms
  {
    id: "number.integer",
    name: "Integer",
    description: "Convert to integer (truncate decimals)",
    category: "number",
    example: { input: "5.7", output: "5" },
    acceptsTypes: ["number", "string"],
  },
  {
    id: "number.round",
    name: "Round",
    description: "Round to nearest integer",
    category: "number",
    example: { input: "5.7", output: "6" },
    acceptsTypes: ["number", "string"],
  },
  {
    id: "number.twoDecimals",
    name: "Two Decimals",
    description: "Format with exactly 2 decimal places",
    category: "number",
    example: { input: "5", output: "5.00" },
    acceptsTypes: ["number", "string"],
  },
  {
    id: "number.currency",
    name: "Currency",
    description: "Format as currency with $ and commas",
    category: "number",
    example: { input: "1234.5", output: "$1,234.50" },
    acceptsTypes: ["number", "string"],
  },
  {
    id: "number.percentage",
    name: "Percentage",
    description: "Multiply by 100 and add % sign",
    category: "number",
    example: { input: "0.85", output: "85%" },
    acceptsTypes: ["number", "string"],
  },

  // Service-Specific Transforms
  {
    id: "service.windowTypeCode",
    name: "Window Type Code",
    description: "Convert window type to industry code",
    category: "service",
    example: { input: "Double Hung", output: "DH" },
    acceptsTypes: ["string"],
  },
  {
    id: "service.roofTypeCode",
    name: "Roof Type Code",
    description: "Convert roof type to industry code",
    category: "service",
    example: { input: "Asphalt Shingles", output: "ASP" },
    acceptsTypes: ["string"],
  },
  {
    id: "service.timeframeCode",
    name: "Timeframe Code",
    description: "Convert timeframe to standardized code",
    category: "service",
    example: { input: "1-3 months", output: "1_3_MONTHS" },
    acceptsTypes: ["string"],
  },
];

/**
 * Get transforms compatible with a specific field type
 *
 * WHY: Filter dropdown to only show relevant transforms
 * WHEN: User selects a source field in mapping UI
 * HOW: Filter by acceptsTypes array
 */
export function getTransformsForType(
  fieldType: SourceFieldType
): TransformDefinition[] {
  return AVAILABLE_TRANSFORMS.filter((t) => t.acceptsTypes.includes(fieldType));
}

/**
 * Get transforms grouped by category
 *
 * WHY: UI displays transforms in categorized groups
 * WHEN: Rendering transform dropdown with sections
 * HOW: Group by category property
 */
export function getTransformsByCategory(): Record<
  TransformCategory,
  TransformDefinition[]
> {
  const grouped: Record<TransformCategory, TransformDefinition[]> = {
    boolean: [],
    string: [],
    number: [],
    date: [],
    phone: [],
    address: [],
    service: [],
  };

  for (const transform of AVAILABLE_TRANSFORMS) {
    grouped[transform.category].push(transform);
  }

  return grouped;
}

/**
 * Find a transform definition by ID
 *
 * WHY: Look up transform metadata when displaying existing mappings
 * WHEN: Rendering mapping table with transform details
 * HOW: Simple find by id
 */
export function getTransformById(id: string): TransformDefinition | undefined {
  return AVAILABLE_TRANSFORMS.find((t) => t.id === id);
}

/**
 * Category display names for UI
 *
 * WHY: Human-readable category labels
 * WHEN: Rendering category headers in dropdown
 * HOW: Simple mapping object
 */
export const TRANSFORM_CATEGORY_LABELS: Record<TransformCategory, string> = {
  boolean: "Boolean Conversions",
  string: "String Formatting",
  number: "Number Formatting",
  date: "Date Formatting",
  phone: "Phone Formatting",
  address: "Address Formatting",
  service: "Service-Specific",
};

// ============================================================================
// Transform Execution Functions
// ============================================================================

/**
 * Execute a transform on a value
 *
 * WHY: Apply the actual data transformation during payload generation
 * WHEN: Building PING/POST request payloads
 * HOW: Switch on transform ID and apply appropriate logic
 *
 * @param transformId - The transform to apply (e.g., "boolean.yesNo")
 * @param value - The value to transform
 * @returns Transformed value or original if transform fails
 *
 * EDGE CASES:
 * - null/undefined → returns null
 * - Unknown transform → logs warning, returns original value
 * - Transform error → logs error, returns original value
 */
export function executeTransform(
  transformId: string,
  value: unknown
): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    switch (transformId) {
      // Boolean transforms
      case "boolean.yesNo":
        return toBoolean(value) ? "Yes" : "No";
      case "boolean.yesNoLower":
        return toBoolean(value) ? "yes" : "no";
      case "boolean.YN":
        return toBoolean(value) ? "Y" : "N";
      case "boolean.oneZero":
        return toBoolean(value) ? 1 : 0;
      case "boolean.truefalse":
        return toBoolean(value) ? "true" : "false";

      // String transforms
      case "string.uppercase":
        return String(value).toUpperCase();
      case "string.lowercase":
        return String(value).toLowerCase();
      case "string.titlecase":
        return toTitleCase(String(value));
      case "string.trim":
        return String(value).trim();
      case "string.truncate50":
        return truncate(String(value), 50);
      case "string.truncate100":
        return truncate(String(value), 100);
      case "string.truncate255":
        return truncate(String(value), 255);

      // Phone transforms
      case "phone.digitsOnly":
        return String(value).replace(/\D/g, "");
      case "phone.e164":
        return toE164(String(value));
      case "phone.dashed":
        return formatPhoneDashed(String(value));
      case "phone.dotted":
        return formatPhoneDotted(String(value));
      case "phone.parentheses":
        return formatPhoneParentheses(String(value));

      // Date transforms
      case "date.isoDate":
        return toISODate(value);
      case "date.usDate":
        return toUSDate(value);
      case "date.usDateShort":
        return toUSDateShort(value);
      case "date.timestamp":
        return toUnixTimestamp(value);
      case "date.timestampMs":
        return toUnixTimestampMs(value);
      case "date.iso8601":
        return toISO8601(value);

      // Number transforms
      case "number.integer":
        return Math.trunc(Number(value));
      case "number.round":
        return Math.round(Number(value));
      case "number.twoDecimals":
        return Number(value).toFixed(2);
      case "number.currency":
        return formatCurrency(Number(value));
      case "number.percentage":
        return `${Math.round(Number(value) * 100)}%`;

      // Service-specific transforms
      case "service.windowTypeCode":
        return mapWindowTypeToCode(String(value));
      case "service.roofTypeCode":
        return mapRoofTypeToCode(String(value));
      case "service.timeframeCode":
        return mapTimeframeToCode(String(value));

      default:
        console.warn(`Unknown transform: ${transformId}`);
        return value;
    }
  } catch (error) {
    console.error(`Transform error (${transformId}):`, error);
    return value;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert various values to boolean
 */
function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    return lower === "true" || lower === "yes" || lower === "1" || lower === "y";
  }
  if (typeof value === "number") return value !== 0;
  return Boolean(value);
}

/**
 * Convert string to title case
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength);
}

/**
 * Convert phone to E.164 format
 */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

/**
 * Format phone as XXX-XXX-XXXX
 */
function formatPhoneDashed(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Format phone as XXX.XXX.XXXX
 */
function formatPhoneDotted(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
}

/**
 * Format phone as (XXX) XXX-XXXX
 */
function formatPhoneParentheses(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Parse date value to Date object
 */
function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

/**
 * Convert to ISO date (YYYY-MM-DD)
 */
function toISODate(value: unknown): string | null {
  const date = parseDate(value);
  if (!date) return null;
  return date.toISOString().split("T")[0];
}

/**
 * Convert to US date (MM/DD/YYYY)
 */
function toUSDate(value: unknown): string | null {
  const date = parseDate(value);
  if (!date) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Convert to short US date (M/D/YY)
 */
function toUSDateShort(value: unknown): string | null {
  const date = parseDate(value);
  if (!date) return null;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

/**
 * Convert to Unix timestamp (seconds)
 */
function toUnixTimestamp(value: unknown): number | null {
  const date = parseDate(value);
  if (!date) return null;
  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert to Unix timestamp (milliseconds)
 */
function toUnixTimestampMs(value: unknown): number | null {
  const date = parseDate(value);
  if (!date) return null;
  return date.getTime();
}

/**
 * Convert to full ISO 8601 format
 */
function toISO8601(value: unknown): string | null {
  const date = parseDate(value);
  if (!date) return null;
  return date.toISOString();
}

/**
 * Format number as currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

/**
 * Map window type to industry code
 */
function mapWindowTypeToCode(windowType: string): string {
  const codes: Record<string, string> = {
    "double hung": "DH",
    "single hung": "SH",
    casement: "CAS",
    sliding: "SLD",
    awning: "AWN",
    bay: "BAY",
    bow: "BOW",
    picture: "PIC",
    skylight: "SKY",
  };
  return codes[windowType.toLowerCase()] || windowType;
}

/**
 * Map roof type to industry code
 */
function mapRoofTypeToCode(roofType: string): string {
  const codes: Record<string, string> = {
    "asphalt shingles": "ASP",
    "metal roofing": "MTL",
    "tile roofing": "TIL",
    "wood shakes": "WDS",
    "slate roofing": "SLT",
    "flat roof": "FLT",
    rubber: "RBR",
    "standing seam": "SSM",
  };
  return codes[roofType.toLowerCase()] || roofType;
}

/**
 * Map timeframe to standardized code
 */
function mapTimeframeToCode(timeframe: string): string {
  const codes: Record<string, string> = {
    "immediately": "IMMEDIATE",
    "within 1 month": "1_MONTH",
    "1-3 months": "1_3_MONTHS",
    "3-6 months": "3_6_MONTHS",
    "6-12 months": "6_12_MONTHS",
    "just researching": "RESEARCH",
    "not sure": "UNSURE",
  };
  return codes[timeframe.toLowerCase()] || timeframe.toUpperCase().replace(/\s+/g, "_");
}
