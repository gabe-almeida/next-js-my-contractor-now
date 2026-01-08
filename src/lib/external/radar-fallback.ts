/**
 * Radar SDK Fallback Utilities
 * Provides manual address parsing and ZIP code validation when Radar SDK is unavailable
 */

export interface FallbackAddress {
  formattedAddress: string;
  addressLabel?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  street?: string;
}

/**
 * Parse an address string and extract components
 */
export function parseAddress(input: string): FallbackAddress | null {
  const trimmed = input.trim();
  
  if (!trimmed) return null;
  
  // ZIP code pattern (5 digits or 5+4 format)
  const zipPattern = /\b(\d{5}(-\d{4})?)\b/;
  const zipMatch = trimmed.match(zipPattern);
  
  // If it's just a ZIP code
  if (zipMatch && trimmed.length <= 10 && /^\d{5}(-\d{4})?$/.test(trimmed)) {
    return {
      formattedAddress: trimmed,
      postalCode: zipMatch[1],
      addressLabel: `ZIP Code: ${zipMatch[1]}`
    };
  }
  
  // Try to parse full address
  const address: FallbackAddress = {
    formattedAddress: trimmed,
    postalCode: zipMatch?.[1]
  };
  
  // Extract state (2 letters before ZIP or at end)
  const statePattern = /\b([A-Z]{2})\b(?:\s+\d{5})?/i;
  const stateMatch = trimmed.match(statePattern);
  if (stateMatch) {
    address.state = stateMatch[1].toUpperCase();
  }
  
  // Extract city (word before state)
  if (address.state) {
    const cityPattern = new RegExp(`([^,]+),?\\s+${address.state}`, 'i');
    const cityMatch = trimmed.match(cityPattern);
    if (cityMatch) {
      address.city = cityMatch[1].trim().replace(/,$/, '');
    }
  }
  
  // Extract street (everything before city or first comma)
  const commaIndex = trimmed.indexOf(',');
  if (commaIndex > 0) {
    address.street = trimmed.substring(0, commaIndex).trim();
  }
  
  return address;
}

/**
 * Validate a ZIP code
 */
export function isValidZipCode(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

/**
 * Format an address for display
 */
export function formatAddress(address: FallbackAddress): string {
  const parts = [];
  
  if (address.street) parts.push(address.street);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.postalCode) parts.push(address.postalCode);
  
  return parts.join(', ');
}

/**
 * Generate address suggestions based on partial input
 */
export function generateFallbackSuggestions(input: string): FallbackAddress[] {
  const parsed = parseAddress(input);
  if (!parsed) return [];
  
  const suggestions: FallbackAddress[] = [];
  
  // If it looks like a ZIP code, suggest it
  if (parsed.postalCode && input.length >= 5) {
    suggestions.push({
      formattedAddress: parsed.postalCode,
      postalCode: parsed.postalCode,
      addressLabel: `ZIP Code: ${parsed.postalCode}`
    });
  }
  
  // If it's a full address, suggest the parsed version
  if (parsed.street || parsed.city) {
    suggestions.push(parsed);
  }
  
  return suggestions;
}

/**
 * Validate address input and provide helpful error messages
 * Requires a street address (number + street name), not just a ZIP code
 */
export function validateAddressInput(input: string): { isValid: boolean; message?: string } {
  const trimmed = input.trim();

  if (!trimmed) {
    return { isValid: false, message: 'Please enter your street address' };
  }

  if (trimmed.length < 5) {
    return { isValid: false, message: 'Please enter your full street address' };
  }

  // Reject bare ZIP codes - require a street address
  if (/^\d{5}(-\d{4})?$/.test(trimmed)) {
    return { isValid: false, message: 'Please enter your full street address, not just ZIP code' };
  }

  // Must have a street number followed by text (street name)
  const hasStreetAddress = /^\d+\s+[a-zA-Z]/.test(trimmed);
  if (!hasStreetAddress) {
    return { isValid: false, message: 'Address should start with a street number (e.g., 123 Main St)' };
  }

  // Minimum reasonable address length (e.g., "1 A St" is 6 chars)
  if (trimmed.length < 6) {
    return { isValid: false, message: 'Please enter your complete street address' };
  }

  return { isValid: true };
}