/**
 * TCPA Configuration System
 * Manages TCPA compliance text and settings per lead buyer
 *
 * IMPORTANT: When updating TCPA text, update BOTH:
 * 1. The HTML version (DEFAULT_TCPA_TEXT) - displayed on form
 * 2. The plain text is auto-generated via stripHtml() and saved with consent
 */

export interface TCPAConfig {
  buyerId: string;
  text: string;        // HTML version for form display
  textPlain: string;   // Plain text version for buyer APIs
  isRequired: boolean;
  showOnlyWhenContactValid: boolean;
}

/**
 * Strip HTML tags from text
 * WHY: Buyer APIs need plain text, not HTML
 * WHEN: Saving consent record, sending to lead buyers
 */
export const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, '');
};

/**
 * Default TCPA text for My Contractor Now (HTML version for form display)
 */
export const DEFAULT_TCPA_TEXT = `By submitting your information, you authorize My Contractor Now and up to four of its affiliated <a href="/home-improvement-companies" class="text-orange-600 hover:text-orange-700 underline">Home Improvement Companies</a> to contact you at the telephone number and email address provided — including through automated dialing systems, artificial/prerecorded voice, and SMS/MMS text messages — regarding your inquiry. You acknowledge and agree that this consent allows us to contact you even if your telephone number is on a federal, state, or corporate Do-Not-Call (DNC) registry. Message and data rates may apply; message frequency may vary. Your consent is not required as a condition of purchase, and you may revoke your consent at any time (e.g., by replying STOP to any text, etc.) By submitting, you agree to our <a href="/privacy-policy" class="text-orange-600 hover:text-orange-700 underline">Privacy Policy</a> and <a href="/terms-and-conditions" class="text-orange-600 hover:text-orange-700 underline">Terms and Conditions</a>.`;

/**
 * Plain text version (auto-generated from HTML)
 * This is the SINGLE SOURCE OF TRUTH for what gets sent to buyer APIs
 */
export const DEFAULT_TCPA_TEXT_PLAIN = stripHtml(DEFAULT_TCPA_TEXT);

// Helper to create config with auto-generated plain text
const createTCPAConfig = (
  buyerId: string,
  text: string,
  isRequired: boolean = true,
  showOnlyWhenContactValid: boolean = true
): TCPAConfig => ({
  buyerId,
  text,
  textPlain: stripHtml(text),
  isRequired,
  showOnlyWhenContactValid,
});

/**
 * TCPA configurations by lead buyer
 * This allows customization of TCPA text per buyer
 * Plain text is auto-generated from HTML via stripHtml()
 */
export const TCPA_CONFIGURATIONS: Record<string, TCPAConfig> = {
  'default': createTCPAConfig('default', DEFAULT_TCPA_TEXT),
  'homeadvisor': createTCPAConfig(
    'homeadvisor',
    `By submitting your information, you authorize My Contractor Now and its partner HomeAdvisor to contact you at the telephone number and email address provided (including through automated dialing systems, pre-recorded messages, and SMS text messaging) regarding your inquiry. Your consent is not required as a condition of purchase, and you may revoke your consent at any time. View our <a href="/privacy-policy" class="text-orange-600 hover:text-orange-700 underline">Privacy Policy</a> and <a href="/terms-and-conditions" class="text-orange-600 hover:text-orange-700 underline">Terms and Conditions</a>.`
  ),
  'angi': createTCPAConfig(
    'angi',
    `By submitting your information, you authorize My Contractor Now and its partner Angi to contact you at the telephone number and email address provided (including through automated dialing systems, pre-recorded messages, and SMS text messaging) regarding your inquiry. Your consent is not required as a condition of purchase, and you may revoke your consent at any time. View our <a href="/privacy-policy" class="text-orange-600 hover:text-orange-700 underline">Privacy Policy</a> and <a href="/terms-and-conditions" class="text-orange-600 hover:text-orange-700 underline">Terms and Conditions</a>.`
  ),
};

/**
 * Get TCPA configuration for a specific buyer
 */
export const getTCPAConfig = (buyerId?: string): TCPAConfig => {
  if (!buyerId || !TCPA_CONFIGURATIONS[buyerId]) {
    return TCPA_CONFIGURATIONS.default;
  }
  return TCPA_CONFIGURATIONS[buyerId];
};

/**
 * TCPA consent record - stores what user agreed to
 * WHY: Compliance requires proof of what user consented to
 * WHEN: Created when user checks TCPA checkbox and submits form
 */
export interface TCPAConsent {
  isAccepted: boolean;
  timestamp: Date;
  text: string;          // The actual plain text user consented to (for buyer APIs)
  ipAddress?: string;
  userAgent?: string;
  buyerConfig: string;
}

/**
 * Create TCPA consent record with the actual text
 * WHY: Ensures we capture exactly what user consented to
 * WHEN: Form submission after user checks TCPA checkbox
 */
export const createTCPAConsent = (
  isAccepted: boolean,
  buyerId: string = 'default',
  ipAddress?: string,
  userAgent?: string
): TCPAConsent => {
  const config = getTCPAConfig(buyerId);
  return {
    isAccepted,
    timestamp: new Date(),
    text: config.textPlain,  // Store the plain text version
    ipAddress,
    userAgent,
    buyerConfig: buyerId
  };
};

/**
 * Validate that TCPA consent is properly collected
 */
export const validateTCPAConsent = (consent: TCPAConsent, config: TCPAConfig): boolean => {
  if (!config.isRequired) {
    return true;
  }
  
  return consent.isAccepted && consent.timestamp && consent.buyerConfig === config.buyerId;
};