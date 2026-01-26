/**
 * Currency Formatting Utilities
 *
 * WHY: Provide consistent currency formatting with commas across all currency inputs
 * WHEN: Used internally by CurrencyInput component - format on BLUR, restrict on change
 * HOW: Import CurrencyInput component (not these utils directly) for automatic formatting
 *
 * Formats:
 * - 1234.56 -> $1,234.56
 * - 1234567 -> $1,234,567.00
 * - Supports cents/decimals
 */

/**
 * Formats a number string into currency format with commas
 * Called on BLUR to allow natural typing
 *
 * @param value - Raw number string (e.g., "1234.56")
 * @param includeDollarSign - Whether to prefix with $ (default: true)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency: $1,234.56
 */
export function formatCurrency(
  value: string | number,
  includeDollarSign = true,
  decimals = 2
): string {
  if (value === '' || value === null || value === undefined) return '';

  // Clean the value to get just the number
  const cleanedValue = cleanCurrencyValue(String(value));

  if (cleanedValue === '' || isNaN(Number(cleanedValue))) return '';

  // Parse and format with commas
  const num = parseFloat(cleanedValue);
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return includeDollarSign ? `$${formatted}` : formatted;
}

/**
 * Formats for display during typing (with commas but flexible decimals)
 * Less strict than full formatCurrency - allows partial input
 *
 * @param value - Current input value
 * @returns Partially formatted value for display
 */
export function formatCurrencyWhileTyping(value: string): string {
  if (!value) return '';

  // Remove $ and existing commas to reformat
  const cleaned = value.replace(/[$,]/g, '');

  // Split by decimal point
  const parts = cleaned.split('.');

  // Format the integer part with commas
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Reconstruct with decimal if present
  if (parts.length > 1) {
    // Limit decimal to 2 places
    const decPart = parts[1].slice(0, 2);
    return `$${intPart}.${decPart}`;
  }

  return intPart ? `$${intPart}` : '';
}

/**
 * Cleans a currency string to just the numeric value (for database storage)
 *
 * @param value - Formatted currency string
 * @returns Clean numeric string (e.g., "1234.56")
 */
export function cleanCurrencyValue(value: string): string {
  if (!value) return '';

  // Remove $ and commas
  const cleaned = value.replace(/[$,]/g, '');

  // Ensure it's a valid number
  if (isNaN(Number(cleaned))) return '';

  return cleaned;
}

/**
 * Restricts input to only valid currency characters during typing
 * Called on CHANGE to prevent invalid characters
 *
 * @param value - Current input value
 * @returns Cleaned value with only digits, one decimal, and $
 */
export function restrictCurrencyInput(value: string): string {
  // Allow digits, one decimal point, and $ at start
  let result = value.replace(/[^\d$.]/g, '');

  // Ensure only one decimal point
  const decimalCount = (result.match(/\./g) || []).length;
  if (decimalCount > 1) {
    // Keep only the first decimal
    const firstDecimalIndex = result.indexOf('.');
    result =
      result.slice(0, firstDecimalIndex + 1) +
      result.slice(firstDecimalIndex + 1).replace(/\./g, '');
  }

  // Limit decimal places to 2
  const parts = result.replace('$', '').split('.');
  if (parts.length > 1 && parts[1].length > 2) {
    result = '$' + parts[0] + '.' + parts[1].slice(0, 2);
  }

  // Ensure $ is at start if present
  if (result.includes('$') && !result.startsWith('$')) {
    result = '$' + result.replace(/\$/g, '');
  }

  return result;
}

/**
 * Parses a currency string to a number (for calculations)
 *
 * @param value - Formatted or raw currency string
 * @returns Numeric value or 0 if invalid
 */
export function parseCurrencyToNumber(value: string): number {
  const cleaned = cleanCurrencyValue(value);
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Validates if a currency value is within a range
 *
 * @param value - Currency string
 * @param min - Minimum value (optional)
 * @param max - Maximum value (optional)
 * @returns true if valid and within range
 */
export function isValidCurrency(
  value: string,
  min?: number,
  max?: number
): boolean {
  const num = parseCurrencyToNumber(value);

  if (isNaN(num)) return false;
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;

  return true;
}
