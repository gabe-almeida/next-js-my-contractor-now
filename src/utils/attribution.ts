/**
 * Attribution Tracking Utility
 *
 * WHY: Captures marketing attribution data (UTM params, click IDs) for lead
 *      source tracking and campaign ROI analysis.
 *
 * WHEN: Called on form load to extract URL parameters and browser data.
 *       Data is stored with lead and displayed in admin lead detail view.
 *
 * HOW: Extracts known attribution parameters from URL and cookies,
 *      returns structured object for storage in lead complianceData.
 */

export interface AttributionData {
  // UTM Parameters
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;

  // Facebook
  fbclid?: string;
  fbc?: string;
  fbp?: string;

  // Google
  gclid?: string;
  wbraid?: string;
  gbraid?: string;
  _ga?: string;
  _gid?: string;

  // Microsoft/Bing
  msclkid?: string;

  // TikTok
  ttclid?: string;

  // Other platforms
  li_fat_id?: string; // LinkedIn
  twclid?: string; // Twitter/X
  rdt_cid?: string; // Reddit
  irclickid?: string; // Impact Radius

  // Page context
  landing_page?: string;
  referrer?: string;
  referrer_domain?: string;

  // Session info
  first_touch_timestamp?: string;
  session_id?: string;

  // Raw query string for any custom params
  raw_query_params?: Record<string, string>;
}

/**
 * Known attribution parameters to extract from URL
 */
const ATTRIBUTION_PARAMS = [
  // UTM
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  // Facebook
  'fbclid',
  // Google
  'gclid',
  'wbraid',
  'gbraid',
  // Microsoft
  'msclkid',
  // TikTok
  'ttclid',
  // LinkedIn
  'li_fat_id',
  // Twitter
  'twclid',
  // Reddit
  'rdt_cid',
  // Impact Radius
  'irclickid',
] as const;

/**
 * Cookie names to check for attribution data
 */
const ATTRIBUTION_COOKIES = [
  '_fbc', // Facebook browser cookie
  '_fbp', // Facebook pixel
  '_ga', // Google Analytics
  '_gid', // Google Analytics session
] as const;

/**
 * Extracts attribution data from current page URL and cookies
 *
 * @returns AttributionData object with all captured attribution info
 */
export function extractAttributionData(): AttributionData {
  if (typeof window === 'undefined') {
    return {};
  }

  const attribution: AttributionData = {};
  const url = new URL(window.location.href);
  const params = url.searchParams;

  // Extract known attribution parameters from URL
  for (const param of ATTRIBUTION_PARAMS) {
    const value = params.get(param);
    if (value) {
      (attribution as any)[param] = value;
    }
  }

  // Extract cookies (client-side only)
  const cookies = parseCookies();
  for (const cookieName of ATTRIBUTION_COOKIES) {
    const value = cookies[cookieName];
    if (value) {
      // Map cookie names to attribution fields (remove leading underscore)
      const fieldName = cookieName.startsWith('_') ? cookieName.slice(1) : cookieName;
      (attribution as any)[fieldName] = value;
    }
  }

  // Capture page context
  attribution.landing_page = window.location.pathname + window.location.search;
  attribution.referrer = document.referrer || undefined;

  if (document.referrer) {
    try {
      const referrerUrl = new URL(document.referrer);
      attribution.referrer_domain = referrerUrl.hostname;
    } catch {
      // Invalid referrer URL, ignore
    }
  }

  // Timestamp for first touch attribution
  attribution.first_touch_timestamp = new Date().toISOString();

  // Capture any additional query params not in our known list
  const rawParams: Record<string, string> = {};
  params.forEach((value, key) => {
    if (!ATTRIBUTION_PARAMS.includes(key as any)) {
      rawParams[key] = value;
    }
  });

  if (Object.keys(rawParams).length > 0) {
    attribution.raw_query_params = rawParams;
  }

  return attribution;
}

/**
 * Parse document cookies into key-value object
 */
function parseCookies(): Record<string, string> {
  if (typeof document === 'undefined') {
    return {};
  }

  const cookies: Record<string, string> = {};

  document.cookie.split(';').forEach((cookie) => {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name) {
      cookies[name] = valueParts.join('=');
    }
  });

  return cookies;
}

/**
 * Stores attribution data in sessionStorage for persistence across page loads
 */
export function storeAttributionData(data: AttributionData): void {
  if (typeof sessionStorage === 'undefined') return;

  try {
    // Merge with any existing data (first touch wins for most fields)
    const existing = getStoredAttributionData();
    const merged = { ...data, ...existing }; // Existing takes precedence (first touch)

    // But always update landing page to current if not set
    if (!existing.landing_page) {
      merged.landing_page = data.landing_page;
    }

    sessionStorage.setItem('attribution_data', JSON.stringify(merged));
  } catch {
    // Storage unavailable, ignore
  }
}

/**
 * Retrieves stored attribution data from sessionStorage
 */
export function getStoredAttributionData(): AttributionData {
  if (typeof sessionStorage === 'undefined') return {};

  try {
    const stored = sessionStorage.getItem('attribution_data');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Gets complete attribution data (combines fresh extraction with stored data)
 * First touch attribution: stored data takes precedence
 */
export function getAttributionData(): AttributionData {
  const fresh = extractAttributionData();
  const stored = getStoredAttributionData();

  // First touch attribution - stored values win
  const combined = { ...fresh, ...stored };

  // Store for persistence
  storeAttributionData(combined);

  return combined;
}

/**
 * Formats attribution data for display
 */
export function formatAttributionSource(data: AttributionData): string {
  if (data.utm_source) {
    const parts = [data.utm_source];
    if (data.utm_medium) parts.push(data.utm_medium);
    if (data.utm_campaign) parts.push(data.utm_campaign);
    return parts.join(' / ');
  }

  if (data.gclid) return 'Google Ads';
  if (data.fbclid) return 'Facebook Ads';
  if (data.msclkid) return 'Microsoft Ads';
  if (data.ttclid) return 'TikTok Ads';
  if (data.li_fat_id) return 'LinkedIn Ads';
  if (data.twclid) return 'Twitter Ads';

  if (data.referrer_domain) {
    return `Referral: ${data.referrer_domain}`;
  }

  return 'Direct';
}

/**
 * Detects the primary traffic source from attribution data
 */
export function detectTrafficSource(data: AttributionData): string {
  if (data.gclid || data.wbraid || data.gbraid) return 'google_ads';
  if (data.fbclid || data.fbc) return 'facebook_ads';
  if (data.msclkid) return 'microsoft_ads';
  if (data.ttclid) return 'tiktok_ads';
  if (data.li_fat_id) return 'linkedin_ads';
  if (data.twclid) return 'twitter_ads';
  if (data.rdt_cid) return 'reddit_ads';

  if (data.utm_source) return data.utm_source.toLowerCase();

  if (data.referrer_domain) {
    const domain = data.referrer_domain.toLowerCase();
    if (domain.includes('google')) return 'google_organic';
    if (domain.includes('facebook') || domain.includes('fb.')) return 'facebook_organic';
    if (domain.includes('twitter') || domain.includes('t.co')) return 'twitter_organic';
    if (domain.includes('linkedin')) return 'linkedin_organic';
    if (domain.includes('instagram')) return 'instagram_organic';
    return 'referral';
  }

  return 'direct';
}
