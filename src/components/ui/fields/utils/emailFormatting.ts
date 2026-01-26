/**
 * Email Formatting & Validation Utilities
 *
 * WHY: Provide consistent email validation across all email inputs
 * WHEN: Used internally by EmailInput component - validate on BLUR, normalize on change
 * HOW: Import EmailInput component (not these utils directly) for automatic validation
 */

/**
 * Standard email regex pattern
 * - Matches: user@domain.tld
 * - Supports: dots, hyphens, underscores in local part
 * - Supports: subdomains in domain part
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * More strict email regex for production validation
 * - Requires at least 2 chars in TLD
 * - Allows common special chars in local part
 */
const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates an email address format
 *
 * @param email - Email string to validate
 * @param strict - Use stricter validation (default: true)
 * @returns true if valid email format
 */
export function isValidEmail(email: string, strict = true): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0) return false;

  return strict ? STRICT_EMAIL_REGEX.test(trimmed) : EMAIL_REGEX.test(trimmed);
}

/**
 * Normalizes an email address (lowercase, trimmed)
 *
 * @param email - Email string to normalize
 * @returns Normalized email (lowercase, trimmed)
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Cleans email input by removing ALL spaces
 * Called during typing to prevent any spaces in email addresses
 *
 * @param value - Current input value
 * @returns Value with all spaces removed
 */
export function cleanEmailInput(value: string): string {
  if (!value) return '';
  // Remove ALL whitespace - emails never have spaces
  return value.replace(/\s/g, '');
}

/**
 * Gets validation error message for invalid email
 *
 * @param email - Email to check
 * @returns Error message or null if valid
 */
export function getEmailValidationError(email: string): string | null {
  if (!email || email.trim().length === 0) return null; // Empty is not an error (use required prop)

  const trimmed = email.trim();

  if (!trimmed.includes('@')) {
    return 'Email must contain @';
  }

  const [local, domain] = trimmed.split('@');

  if (!local || local.length === 0) {
    return 'Email must have a name before @';
  }

  if (!domain || domain.length === 0) {
    return 'Email must have a domain after @';
  }

  if (!domain.includes('.')) {
    return 'Domain must include a period (e.g., .com)';
  }

  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) {
    return 'Invalid domain extension';
  }

  if (!isValidEmail(trimmed)) {
    return 'Invalid email format';
  }

  return null;
}
