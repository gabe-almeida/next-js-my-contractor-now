/**
 * Shared Transform Functions
 *
 * WHY: Single source of truth for data transformations
 * WHEN: Used by BOTH admin preview AND auction engine
 * HOW: Exported functions imported by field-mapping/transforms.ts AND templates/transformations.ts
 *
 * CRITICAL: Any changes here affect BOTH preview and actual PING/POST payloads!
 * This ensures the admin preview accurately reflects what buyers receive.
 */

// =============================================================================
// Boolean Transforms
// =============================================================================

/**
 * Parse any value to boolean
 *
 * WHY: Different systems store booleans differently (true, "yes", 1, "on", etc.)
 * WHEN: Before applying boolean transforms like yesNo, oneZero, etc.
 * HOW: Check for common truthy string representations
 *
 * Accepts as TRUE: true, "true", "yes", "y", "1", 1, "on", "checked"
 * Everything else is FALSE
 */
export function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (value === null || value === undefined) return false;

  const stringValue = String(value).toLowerCase().trim();
  return ['true', 'yes', 'y', '1', 'on', 'checked'].includes(stringValue);
}

/**
 * Convert to "Yes" or "No"
 */
export function booleanToYesNo(value: unknown): string {
  return toBoolean(value) ? 'Yes' : 'No';
}

/**
 * Convert to "yes" or "no" (lowercase)
 */
export function booleanToYesNoLower(value: unknown): string {
  return toBoolean(value) ? 'yes' : 'no';
}

/**
 * Convert to "Y" or "N"
 */
export function booleanToYN(value: unknown): string {
  return toBoolean(value) ? 'Y' : 'N';
}

/**
 * Convert to 1 or 0
 */
export function booleanToOneZero(value: unknown): number {
  return toBoolean(value) ? 1 : 0;
}

/**
 * Convert to "true" or "false" string
 */
export function booleanToTrueFalse(value: unknown): string {
  return toBoolean(value) ? 'true' : 'false';
}

// =============================================================================
// String Transforms
// =============================================================================

/**
 * Convert to UPPERCASE
 */
export function toUpperCase(value: unknown): string {
  return String(value).toUpperCase();
}

/**
 * Convert to lowercase
 */
export function toLowerCase(value: unknown): string {
  return String(value).toLowerCase();
}

/**
 * Convert to Title Case
 */
export function toTitleCase(value: unknown): string {
  return String(value)
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Trim whitespace
 */
export function trim(value: unknown): string {
  return String(value).trim();
}

/**
 * Truncate string to max length
 */
export function truncate(value: unknown, maxLength: number): string {
  const str = String(value);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// =============================================================================
// Phone Transforms
// =============================================================================

/**
 * Extract digits only from phone number
 */
export function phoneDigitsOnly(value: unknown): string {
  return String(value).replace(/\D/g, '');
}

/**
 * Convert to E.164 format (+1XXXXXXXXXX)
 */
export function phoneToE164(value: unknown): string {
  const digits = phoneDigitsOnly(value);
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

/**
 * Format as XXX-XXX-XXXX
 */
export function phoneFormatDashed(value: unknown): string {
  const digits = phoneDigitsOnly(value);
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return digits;
}

/**
 * Format as XXX.XXX.XXXX
 */
export function phoneFormatDotted(value: unknown): string {
  const digits = phoneDigitsOnly(value);
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `${digits.slice(1, 4)}.${digits.slice(4, 7)}.${digits.slice(7)}`;
  }
  return digits;
}

/**
 * Format as (XXX) XXX-XXXX
 */
export function phoneFormatParentheses(value: unknown): string {
  const digits = phoneDigitsOnly(value);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return digits;
}

// =============================================================================
// Date Transforms
// =============================================================================

/**
 * Parse date from various formats
 */
function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Format as YYYY-MM-DD
 */
export function dateToISODate(value: unknown): string {
  const date = parseDate(value);
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

/**
 * Format as MM/DD/YYYY
 */
export function dateToUSDate(value: unknown): string {
  const date = parseDate(value);
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Format as M/D/YY
 */
export function dateToUSDateShort(value: unknown): string {
  const date = parseDate(value);
  if (!date) return '';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = String(date.getFullYear()).slice(2);
  return `${month}/${day}/${year}`;
}

/**
 * Convert to Unix timestamp (seconds)
 */
export function dateToTimestamp(value: unknown): number {
  const date = parseDate(value);
  if (!date) return 0;
  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert to Unix timestamp (milliseconds)
 */
export function dateToTimestampMs(value: unknown): number {
  const date = parseDate(value);
  if (!date) return 0;
  return date.getTime();
}

/**
 * Format as full ISO 8601
 */
export function dateToISO8601(value: unknown): string {
  const date = parseDate(value);
  if (!date) return '';
  return date.toISOString();
}

// =============================================================================
// Address/State Transforms
// =============================================================================

/**
 * US State name to abbreviation mapping
 */
const STATE_ABBREVIATIONS: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC', 'puerto rico': 'PR', 'guam': 'GU', 'virgin islands': 'VI'
};

/**
 * Convert state name to 2-letter abbreviation
 * WHY: Modernize and other buyers expect state as 2-letter code
 * WHEN: Processing address.state field
 * HOW: Lookup in map, return original if already abbreviated or not found
 */
export function stateToAbbreviation(value: unknown): string {
  const str = String(value).trim();
  // If already 2 letters, assume it's an abbreviation
  if (str.length === 2) return str.toUpperCase();
  // Look up full name
  const abbrev = STATE_ABBREVIATIONS[str.toLowerCase()];
  return abbrev || str;
}

// =============================================================================
// Number Transforms
// =============================================================================

/**
 * Convert to integer (truncate decimals)
 */
export function toInteger(value: unknown): number {
  return Math.trunc(Number(value));
}

/**
 * Round to nearest integer
 */
export function round(value: unknown): number {
  return Math.round(Number(value));
}

/**
 * Format with 2 decimal places
 */
export function toTwoDecimals(value: unknown): string {
  return Number(value).toFixed(2);
}

/**
 * Format as currency ($X,XXX.XX)
 */
export function toCurrency(value: unknown): string {
  const num = Number(value);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

/**
 * Format as percentage
 */
export function toPercentage(value: unknown): string {
  const num = Number(value);
  if (isNaN(num)) return '0%';
  return `${Math.round(num * 100)}%`;
}

// =============================================================================
// Transform Registry (for lookup by ID)
// =============================================================================

/**
 * Execute a transform by its ID
 *
 * WHY: Both preview and auction use transform IDs like "boolean.yesNo"
 * WHEN: Processing field mappings
 * HOW: Switch statement maps IDs to functions
 *
 * CRITICAL: This is the SINGLE source of truth for all transforms!
 */
export function executeTransform(transformId: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  switch (transformId) {
    // Boolean transforms
    case 'boolean.yesNo':
      return booleanToYesNo(value);
    case 'boolean.yesNoLower':
      return booleanToYesNoLower(value);
    case 'boolean.YN':
      return booleanToYN(value);
    case 'boolean.oneZero':
      return booleanToOneZero(value);
    case 'boolean.truefalse':
      return booleanToTrueFalse(value);

    // String transforms
    case 'string.uppercase':
      return toUpperCase(value);
    case 'string.lowercase':
      return toLowerCase(value);
    case 'string.titlecase':
      return toTitleCase(value);
    case 'string.trim':
      return trim(value);
    case 'string.truncate50':
      return truncate(value, 50);
    case 'string.truncate100':
      return truncate(value, 100);
    case 'string.truncate255':
      return truncate(value, 255);

    // Phone transforms
    case 'phone.digitsOnly':
      return phoneDigitsOnly(value);
    case 'phone.e164':
      return phoneToE164(value);
    case 'phone.dashed':
      return phoneFormatDashed(value);
    case 'phone.dotted':
      return phoneFormatDotted(value);
    case 'phone.parentheses':
      return phoneFormatParentheses(value);

    // Date transforms
    case 'date.isoDate':
      return dateToISODate(value);
    case 'date.usDate':
      return dateToUSDate(value);
    case 'date.usDateShort':
      return dateToUSDateShort(value);
    case 'date.timestamp':
      return dateToTimestamp(value);
    case 'date.timestampMs':
      return dateToTimestampMs(value);
    case 'date.iso8601':
      return dateToISO8601(value);

    // Number transforms
    case 'number.integer':
      return toInteger(value);
    case 'number.round':
      return round(value);
    case 'number.twoDecimals':
      return toTwoDecimals(value);
    case 'number.currency':
      return toCurrency(value);
    case 'number.percentage':
      return toPercentage(value);

    // Address transforms
    case 'address.stateAbbrev':
      return stateToAbbreviation(value);

    default:
      console.warn(`Unknown transform: ${transformId}, returning original value`);
      return value;
  }
}
