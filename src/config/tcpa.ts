/**
 * TCPA Configuration System
 * Manages TCPA compliance text and settings per lead buyer
 */

export interface TCPAConfig {
  buyerId: string;
  text: string;
  isRequired: boolean;
  showOnlyWhenContactValid: boolean;
}

/**
 * Default TCPA text for My Contractor Now
 */
export const DEFAULT_TCPA_TEXT = `By submitting your information, you authorize My Contractor Now and up to four of its affiliated <a href="/home-improvement-companies" class="text-orange-600 hover:text-orange-700 underline">Home Improvement Companies</a> to contact you at the telephone number and email address provided — including through automated dialing systems, artificial/prerecorded voice, and SMS/MMS text messages — regarding your inquiry. You acknowledge and agree that this consent allows us to contact you even if your telephone number is on a federal, state, or corporate Do-Not-Call (DNC) registry. Message and data rates may apply; message frequency may vary. Your consent is not required as a condition of purchase, and you may revoke your consent at any time (e.g., by replying STOP to any text, etc.) By submitting, you agree to our <a href="/privacy-policy" class="text-orange-600 hover:text-orange-700 underline">Privacy Policy</a> and <a href="/terms-and-conditions" class="text-orange-600 hover:text-orange-700 underline">Terms and Conditions</a>.`;

/**
 * TCPA configurations by lead buyer
 * This allows customization of TCPA text per buyer
 */
export const TCPA_CONFIGURATIONS: Record<string, TCPAConfig> = {
  'default': {
    buyerId: 'default',
    text: DEFAULT_TCPA_TEXT,
    isRequired: true,
    showOnlyWhenContactValid: true
  },
  'homeadvisor': {
    buyerId: 'homeadvisor',
    text: `By submitting your information, you authorize My Contractor Now and its partner HomeAdvisor to contact you at the telephone number and email address provided (including through automated dialing systems, pre-recorded messages, and SMS text messaging) regarding your inquiry. Your consent is not required as a condition of purchase, and you may revoke your consent at any time. View our <a href="/privacy-policy" class="text-orange-600 hover:text-orange-700 underline">Privacy Policy</a> and <a href="/terms-and-conditions" class="text-orange-600 hover:text-orange-700 underline">Terms and Conditions</a>.`,
    isRequired: true,
    showOnlyWhenContactValid: true
  },
  'angi': {
    buyerId: 'angi',
    text: `By submitting your information, you authorize My Contractor Now and its partner Angi to contact you at the telephone number and email address provided (including through automated dialing systems, pre-recorded messages, and SMS text messaging) regarding your inquiry. Your consent is not required as a condition of purchase, and you may revoke your consent at any time. View our <a href="/privacy-policy" class="text-orange-600 hover:text-orange-700 underline">Privacy Policy</a> and <a href="/terms-and-conditions" class="text-orange-600 hover:text-orange-700 underline">Terms and Conditions</a>.`,
    isRequired: true,
    showOnlyWhenContactValid: true
  }
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
 * Validate TCPA consent data
 */
export interface TCPAConsent {
  isAccepted: boolean;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  buyerConfig: string;
}

export const createTCPAConsent = (
  isAccepted: boolean,
  buyerId: string = 'default',
  ipAddress?: string,
  userAgent?: string
): TCPAConsent => {
  return {
    isAccepted,
    timestamp: new Date(),
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