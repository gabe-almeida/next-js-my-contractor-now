/**
 * Phone Number Utilities
 *
 * WHY: Centralized phone number handling to ensure consistent formatting across the application
 * WHEN: Use when normalizing, validating, or formatting phone numbers for database queries or display
 * HOW: Provides E.164 format conversion and validation for various phone number formats
 *
 * MASTER FILE: This is the single source of truth for all phone number operations
 */

/**
 * Normalize phone number to E.164 format
 * Handles common formats and international numbers
 *
 * WHY: Ensures consistent phone number format for database queries, Twilio API calls, and comparisons
 * WHEN: Called before storing phone data or making API calls
 * HOW: Strips non-digits, validates length, adds country code based on format detection
 *
 * @param phoneNumber - Raw phone number in any common format
 * @param defaultCountryCode - Default country code (default: 'US' = +1)
 * @returns E.164 formatted phone number (e.g., "+19787980276") or null if invalid
 *
 * @example
 * normalizePhoneNumber("(978) 798-0276") // Returns: "+19787980276"
 * normalizePhoneNumber("978-798-0276")   // Returns: "+19787980276"
 * normalizePhoneNumber("+1 978 798 0276") // Returns: "+19787980276"
 * normalizePhoneNumber("9787980276")     // Returns: "+19787980276"
 * normalizePhoneNumber("+442071234567")  // Returns: "+442071234567"
 * normalizePhoneNumber("invalid")        // Returns: null
 */
export function normalizePhoneNumber(
  phoneNumber: string | null | undefined,
  defaultCountryCode: string = 'US'
): string | null {
  if (!phoneNumber) {
    return null;
  }

  // Strip all non-digit characters except +
  let digits = phoneNumber.replace(/[^\d+]/g, '');

  // If it already has + at the start, validate and return
  if (digits.startsWith('+')) {
    // Must have 11-15 total characters (+1XXXXXXXXXX to +999XXXXXXXXXXXX)
    if (digits.length >= 11 && digits.length <= 16) {
      return digits;
    }
    return null; // Invalid length
  }

  // Remove any + signs that aren't at the start
  digits = digits.replace(/\+/g, '');

  // If no digits, return null
  if (digits.length === 0) {
    return null;
  }

  // Get country code prefix based on default country
  const countryCodeMap: Record<string, string> = {
    'US': '1',
    'CA': '1',
    'UK': '44',
    'AU': '61',
    'NZ': '64',
    'IN': '91',
    'MX': '52',
  };

  const countryCode = countryCodeMap[defaultCountryCode] || '1';

  // Handle different formats
  if (digits.startsWith('1') && digits.length === 11) {
    // US/CA 11-digit format: 1XXXXXXXXXX
    return `+${digits}`;
  } else if (digits.length === 10 && (defaultCountryCode === 'US' || defaultCountryCode === 'CA')) {
    // US/CA 10-digit format: XXXXXXXXXX
    return `+1${digits}`;
  } else if (digits.length >= 10 && digits.length <= 15) {
    // International format - add default country code
    return `+${countryCode}${digits}`;
  }

  return null; // Invalid format
}

/**
 * Validate if a phone number is in E.164 format
 *
 * WHY: Quick validation without normalization attempt
 * WHEN: Called to check if a number is already in correct format
 * HOW: Regex pattern match for E.164 format
 *
 * @param phoneNumber - Phone number to validate
 * @returns true if valid E.164 format
 *
 * @example
 * isValidE164PhoneNumber("+19787980276") // Returns: true
 * isValidE164PhoneNumber("9787980276")   // Returns: false
 */
export function isValidE164PhoneNumber(phoneNumber: string | null | undefined): boolean {
  if (!phoneNumber) {
    return false;
  }

  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * Validate if a phone number has valid US format (10 digits, or 11 starting with 1)
 *
 * WHY: Simple validation for US phone numbers during input
 * WHEN: Called to validate user input before submission
 * HOW: Counts digits after stripping formatting, accepts 10 or 11 (with leading 1)
 *
 * @param phoneNumber - Phone number to validate
 * @returns true if has exactly 10 digits (or 11 starting with 1)
 *
 * @example
 * isValidUSPhoneNumber("(978) 798-0276")  // true (10 digits)
 * isValidUSPhoneNumber("1-978-798-0276")  // true (11 digits starting with 1)
 * isValidUSPhoneNumber("+19787980276")    // true (E.164 US format)
 * isValidUSPhoneNumber("978798027")       // false (9 digits)
 */
export function isValidUSPhoneNumber(phoneNumber: string | null | undefined): boolean {
  if (!phoneNumber) {
    return false;
  }

  // Handle +1 prefix
  if (phoneNumber.startsWith('+1')) {
    const digits = phoneNumber.slice(2).replace(/\D/g, '');
    return digits.length === 10;
  }

  const digits = phoneNumber.replace(/\D/g, '');

  // Accept 10 digits, or 11 digits if starts with 1
  if (digits.length === 10) return true;
  if (digits.length === 11 && digits.startsWith('1')) return true;

  return false;
}

/**
 * Format phone number for display (human-readable)
 *
 * WHY: Provides consistent, user-friendly phone number display across the application
 * WHEN: Called when rendering phone numbers in UI components
 * HOW: Converts E.164 format to localized display format
 *
 * Handles:
 * - E.164: +19787980276 → (978) 798-0276
 * - 10 digits: 9787980276 → (978) 798-0276
 * - 11 digits with leading 1: 19787980276 → (978) 798-0276
 * - International: +442071234567 → +442071234567 (preserved)
 *
 * @param phoneNumber - E.164 formatted phone number or any format
 * @returns Formatted phone number for display
 *
 * @example
 * formatPhoneForDisplay("+19787980276")  // Returns: "(978) 798-0276"
 * formatPhoneForDisplay("19787980276")   // Returns: "(978) 798-0276"
 * formatPhoneForDisplay("9787980276")    // Returns: "(978) 798-0276"
 * formatPhoneForDisplay("+442071234567") // Returns: "+442071234567" (non-US preserved)
 */
export function formatPhoneForDisplay(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) {
    return '';
  }

  // US/CA numbers in E.164: +1XXXXXXXXXX → (XXX) XXX-XXXX
  if (phoneNumber.startsWith('+1') && phoneNumber.length === 12) {
    const digits = phoneNumber.slice(2); // Remove +1
    if (digits.length !== 10) return phoneNumber;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Other international: preserve as-is
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }

  // Not E.164, try to format as US number
  let digits = phoneNumber.replace(/\D/g, '');

  // 11 digits starting with 1: strip the leading 1
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }

  // Format 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Can't format - return original
  return phoneNumber;
}

/**
 * Strip all formatting and return just digits
 *
 * WHY: Useful for phone number comparison and database lookups
 * WHEN: Called when you need raw digits without country code or formatting
 * HOW: Removes all non-digit characters
 *
 * @param phoneNumber - Phone number in any format
 * @returns Only digits (no + or country code)
 *
 * @example
 * stripPhoneFormatting("+1 (978) 798-0276") // Returns: "19787980276"
 * stripPhoneFormatting("(978) 798-0276")    // Returns: "9787980276"
 */
export function stripPhoneFormatting(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) {
    return '';
  }
  return phoneNumber.replace(/\D/g, '');
}

/**
 * Clean phone number for database storage (removes +1 prefix and formatting)
 *
 * WHY: Consistent storage format in database
 * WHEN: Before saving phone numbers
 * HOW: Removes +1 prefix, leading 1, and all non-digit characters
 *
 * @param phoneNumber - Phone number in any format
 * @returns Clean 10-digit string for US numbers
 *
 * @example
 * cleanPhoneNumber("+1 (978) 798-0276") // Returns: "9787980276"
 * cleanPhoneNumber("1-978-798-0276")    // Returns: "9787980276"
 * cleanPhoneNumber("(978) 798-0276")    // Returns: "9787980276"
 */
export function cleanPhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) {
    return '';
  }

  // Remove +1 prefix if present
  let value = phoneNumber.startsWith('+1') ? phoneNumber.slice(2) : phoneNumber;

  // Remove all non-digits
  let digits = value.replace(/\D/g, '');

  // If 11 digits starting with 1, remove the leading 1 (US country code)
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Format phone number as user types (progressive formatting)
 *
 * WHY: Provides real-time visual feedback as user enters phone number
 * WHEN: Called in onChange handler of phone input fields
 * HOW: Progressively adds formatting based on number of digits entered
 *
 * Handles:
 * - 10-digit US numbers: (XXX) XXX-XXXX
 * - 11-digit with leading 1: strips the 1 and formats as 10-digit
 * - +1 prefix: +1 (XXX) XXX-XXXX
 *
 * @param phoneNumber - Current input value
 * @returns Formatted phone number with visual separators
 *
 * @example
 * formatPhoneAsYouType("9787")         // Returns: "(978) 7"
 * formatPhoneAsYouType("9787980276")   // Returns: "(978) 798-0276"
 * formatPhoneAsYouType("19787980276")  // Returns: "(978) 798-0276" (strips leading 1)
 * formatPhoneAsYouType("+19787980276") // Returns: "+1 (978) 798-0276"
 */
export function formatPhoneAsYouType(phoneNumber: string): string {
  if (!phoneNumber) return '';

  // Handle +1 prefix
  const hasPlus1 = phoneNumber.startsWith('+1') || phoneNumber.startsWith('+ 1');
  if (hasPlus1) {
    const afterPrefix = phoneNumber.replace(/^\+\s*1\s*/, '');
    const digits = afterPrefix.replace(/\D/g, '');

    if (digits.length === 0) return '+1 ';
    if (digits.length <= 3) return `+1 (${digits}`;
    if (digits.length <= 6) return `+1 (${digits.slice(0, 3)}) ${digits.slice(3)}`;
    // Max 10 digits after +1
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }

  // Strip all non-digits
  let digits = phoneNumber.replace(/\D/g, '');

  // If 11 digits starting with 1, strip the leading 1
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }

  // Progressive formatting for 10-digit number
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  // Max 10 digits
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

/**
 * Restricts input to only valid phone characters during typing
 * Called on CHANGE to prevent invalid characters
 * Also enforces max digit limits:
 * - 10 digits for standard US numbers
 * - 11 digits if starting with 1 (country code)
 * - 11 digits if starting with +1
 *
 * @param value - Current input value
 * @returns Cleaned value with only digits and allowed formatting chars, limited to max digits
 */
export function restrictPhoneInput(value: string): string {
  // Allow digits, spaces, parentheses, hyphens, and + at start
  const startsWithPlus = value.startsWith('+');
  let cleaned = value.replace(/[^\d\s()-]/g, '');

  // Preserve + at start if it was there
  if (startsWithPlus && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  // Extract just the digits to check count
  const digits = cleaned.replace(/\D/g, '');

  // Determine max digits allowed
  let maxDigits = 10;
  if (startsWithPlus || digits.startsWith('1')) {
    maxDigits = 11; // +1 or leading 1 allows 11 total digits
  }

  // If we have too many digits, truncate
  if (digits.length > maxDigits) {
    // Rebuild the string with only maxDigits digits
    let digitCount = 0;
    let result = '';
    for (const char of cleaned) {
      if (/\d/.test(char)) {
        if (digitCount < maxDigits) {
          result += char;
          digitCount++;
        }
        // Skip digits beyond max
      } else {
        result += char; // Keep formatting chars
      }
    }
    return result;
  }

  return cleaned;
}

/**
 * Gets the raw digits count from a phone value
 * Useful for showing character count or validation
 *
 * @param value - Phone number string
 * @returns Number of digits in the value
 */
export function getPhoneDigitCount(value: string | null | undefined): number {
  if (!value) return 0;
  return cleanPhoneNumber(value).length;
}

/**
 * Zod-compatible validation function for E.164 format
 * Use with z.string().refine(isValidE164OrEmpty, { message: '...' })
 */
export function isValidE164OrEmpty(value: string): boolean {
  if (!value || value === '') return true;
  return isValidE164PhoneNumber(value);
}

/**
 * E.164 regex pattern for Zod schema validation
 * Use with z.string().regex(E164_REGEX, { message: '...' })
 */
export const E164_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * US Phone regex pattern (10 digits)
 * Use with z.string().regex(US_PHONE_REGEX, { message: '...' })
 */
export const US_PHONE_REGEX = /^\d{10}$/;

/**
 * Gets validation error message for invalid phone number
 * Returns a simple, user-friendly message
 *
 * @param phone - Phone number to check
 * @returns Error message or null if valid
 */
export function getPhoneValidationError(phone: string | null | undefined): string | null {
  if (!phone || phone.trim().length === 0) return null; // Empty is not an error (use required prop)

  if (!isValidUSPhoneNumber(phone)) {
    return 'Please enter a valid phone number.';
  }

  return null;
}
