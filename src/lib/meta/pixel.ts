/**
 * ============================================================================
 * META PIXEL CLIENT-SIDE UTILITIES
 * ============================================================================
 *
 * WHAT: Client-side helpers for Meta Pixel tracking
 * WHY:  Provides type-safe interface for fbq() pixel events
 * WHEN: Used in React components and client-side code
 *
 * EVENTS TRACKED:
 * - PageView: Automatic on every page load (via layout.tsx)
 * - Lead: Manual trigger on form submission
 * - ViewContent: Manual trigger on landing pages
 *
 * DATA COLLECTED:
 * - Event parameters (currency, value, content_name, etc.)
 * - Customer information (email, phone, name, address via advanced matching)
 * - UTM parameters (captured from URL)
 *
 * INTEGRATION:
 * - Install pixel script in layout.tsx (done globally)
 * - Call trackLead() on form submission success
 * - Call trackPageView() on route changes (optional)
 *
 * PRIVACY:
 * - PII is automatically hashed by Meta Pixel before sending
 * - Respects user consent preferences (if implemented)
 * ============================================================================
 */

import { META_PIXEL_ID } from './config';

/**
 * Meta Pixel global function interface
 * TypeScript definition for window.fbq
 */
declare global {
  interface Window {
    fbq?: (
      action: 'track' | 'trackCustom' | 'init',
      eventName: string,
      data?: Record<string, any>
    ) => void;
    _fbq?: any;
  }
}

/**
 * Customer information for advanced matching
 * Meta automatically hashes PII data before sending
 */
export interface MetaCustomerInfo {
  em?: string;       // Email (will be hashed)
  ph?: string;       // Phone in E.164 format (will be hashed)
  fn?: string;       // First name (will be hashed)
  ln?: string;       // Last name (will be hashed)
  ct?: string;       // City (will be hashed)
  st?: string;       // State (2-letter code, will be hashed)
  zp?: string;       // ZIP code (will be hashed)
  country?: string;  // Country (2-letter code, will be hashed)
  db?: string;       // Date of birth (YYYYMMDD format, will be hashed)
  ge?: string;       // Gender ('m' or 'f', will be hashed)
  external_id?: string; // External ID (will be hashed)
}

/**
 * Lead event data
 */
export interface MetaLeadData {
  content_name?: string;
  currency?: string;
  value?: number;
  predicted_ltv?: number;
  content_category?: string;
  status?: string;
}

/**
 * Initialize Meta Pixel
 * Called automatically by layout.tsx script
 */
export function initMetaPixel(): void {
  if (typeof window === 'undefined' || !window.fbq) {
    console.warn('Meta Pixel not loaded yet');
    return;
  }

  window.fbq('init', META_PIXEL_ID);
  console.log('%c✅ Meta Pixel initialized', 'color: blue; font-weight: bold;');
}

/**
 * Track PageView event
 * Call on route changes or use automatic tracking in layout.tsx
 */
export function trackPageView(): void {
  if (typeof window === 'undefined' || !window.fbq) {
    console.warn('Meta Pixel not available for PageView');
    return;
  }

  window.fbq('track', 'PageView');
  console.log('%c📄 Meta Pixel: PageView tracked', 'color: blue;');
}

/**
 * Track Lead event with customer information
 * Call this when a lead form is successfully submitted
 *
 * @param leadData - Lead event parameters (currency, value, etc.)
 * @param customerInfo - Customer PII for advanced matching (automatically hashed)
 */
export function trackLead(
  leadData?: MetaLeadData,
  customerInfo?: MetaCustomerInfo
): void {
  if (typeof window === 'undefined' || !window.fbq) {
    console.warn('Meta Pixel not available for Lead event');
    return;
  }

  // Merge lead data with customer info
  const eventData = {
    ...leadData,
    ...customerInfo,
  };

  window.fbq('track', 'Lead', eventData);
  console.log('%c🎯 Meta Pixel: Lead tracked', 'color: green; font-weight: bold;', eventData);
}

/**
 * Track custom event
 * Use for any custom tracking needs
 *
 * @param eventName - Custom event name
 * @param data - Event parameters
 */
export function trackCustomEvent(
  eventName: string,
  data?: Record<string, any>
): void {
  if (typeof window === 'undefined' || !window.fbq) {
    console.warn(`Meta Pixel not available for custom event: ${eventName}`);
    return;
  }

  window.fbq('trackCustom', eventName, data);
  console.log(`%c🔔 Meta Pixel: ${eventName} tracked`, 'color: purple;', data);
}

/**
 * Extract customer information from form data
 * Formats data for Meta Pixel advanced matching
 *
 * @param formData - Form submission data
 * @returns Formatted customer information for Meta
 */
export function formatCustomerInfo(formData: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  stateAbbrev?: string;
}): MetaCustomerInfo {
  const customerInfo: MetaCustomerInfo = {};

  if (formData.email) {
    customerInfo.em = formData.email.toLowerCase().trim();
  }

  if (formData.phone) {
    // Remove all non-digit characters
    customerInfo.ph = formData.phone.replace(/\D/g, '');
  }

  if (formData.firstName) {
    customerInfo.fn = formData.firstName.toLowerCase().trim();
  }

  if (formData.lastName) {
    customerInfo.ln = formData.lastName.toLowerCase().trim();
  }

  if (formData.city) {
    customerInfo.ct = formData.city.toLowerCase().trim();
  }

  if (formData.state || formData.stateAbbrev) {
    customerInfo.st = (formData.stateAbbrev || formData.state || '').toLowerCase().trim();
  }

  if (formData.zipCode) {
    customerInfo.zp = formData.zipCode.replace(/\D/g, '');
  }

  // Default to US
  customerInfo.country = 'us';

  return customerInfo;
}

/**
 * Get FBC (Facebook Click ID) from cookie or URL
 * Used for attribution tracking
 */
export function getFBC(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  // Check URL for fbclid parameter
  const urlParams = new URLSearchParams(window.location.search);
  const fbclid = urlParams.get('fbclid');

  if (fbclid) {
    // Format: fb.1.timestamp.fbclid
    return `fb.1.${Date.now()}.${fbclid}`;
  }

  // Check cookie
  const cookies = document.cookie.split(';');
  const fbcCookie = cookies.find(c => c.trim().startsWith('_fbc='));

  if (fbcCookie) {
    return fbcCookie.split('=')[1];
  }

  return undefined;
}

/**
 * Get FBP (Facebook Browser ID) from cookie
 * Used for browser identification
 */
export function getFBP(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const cookies = document.cookie.split(';');
  const fbpCookie = cookies.find(c => c.trim().startsWith('_fbp='));

  if (fbpCookie) {
    return fbpCookie.split('=')[1];
  }

  return undefined;
}

/**
 * Extract UTM parameters from URL
 * Used for campaign attribution
 */
export function getUTMParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const urlParams = new URLSearchParams(window.location.search);
  const utmParams: Record<string, string> = {};

  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  utmKeys.forEach(key => {
    const value = urlParams.get(key);
    if (value) {
      utmParams[key] = value;
    }
  });

  return utmParams;
}
