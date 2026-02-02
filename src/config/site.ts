/**
 * Site Configuration
 *
 * WHY: Centralized configuration for site-wide settings including
 *      default phone numbers, branding, and contact information.
 *
 * WHEN: Used by components that need site-wide defaults, such as
 *       the CallButton component for DNI fallback.
 *
 * HOW: Import the config and access the values you need.
 */

// =====================================
// PHONE CONFIGURATION
// =====================================

/**
 * Default company phone number
 * Used when no affiliate tracking number is available
 *
 * NOTE: This should be the main company line or a general tracking number.
 * Update these values when the company number changes.
 */
export const DEFAULT_PHONE = {
  /** E.164 format for tel: links */
  number: '+18887771234',
  /** Human-readable display format */
  display: '(888) 777-1234'
} as const;

// =====================================
// SITE METADATA
// =====================================

export const SITE_CONFIG = {
  name: 'My Contractor Now',
  tagline: 'Get Instant Contractor Quotes',
  url: 'https://mycontractornow.com'
} as const;

// =====================================
// EXPORTS
// =====================================

export default {
  phone: DEFAULT_PHONE,
  site: SITE_CONFIG
};
