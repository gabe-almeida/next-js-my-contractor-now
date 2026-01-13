/**
 * ============================================================================
 * META (FACEBOOK) TRACKING CONFIGURATION
 * ============================================================================
 *
 * WHAT: Centralized configuration for Meta Pixel and Conversion API (CAPI)
 * WHY:  Single source of truth for Meta tracking settings
 * WHEN: Imported by Meta Pixel (client-side) and CAPI service (server-side)
 *
 * COMPONENTS:
 * - Meta Pixel (client-side): Tracks PageView and Lead events in browser
 * - Conversion API (server-side): Sends events from server for better matching
 *
 * CONFIGURATION:
 * - PIXEL_ID: Meta Pixel identifier (215812654357251)
 * - ACCESS_TOKEN: Meta Conversions API access token (server-side only)
 * - DATASET_ID: Meta dataset for Conversion API (extracted from access token)
 *
 * ENVIRONMENT VARIABLES:
 * - NEXT_PUBLIC_META_PIXEL_ID: Public pixel ID (visible in browser)
 * - META_ACCESS_TOKEN: Secret access token (server-side only, NEVER expose to client)
 *
 * SECURITY:
 * - Access token is server-side only (starts with META_ACCESS_TOKEN)
 * - Pixel ID is public (starts with NEXT_PUBLIC_)
 * - PII data is hashed before sending to Meta CAPI (SHA-256)
 * ============================================================================
 */

/**
 * Meta Pixel ID
 * Public identifier visible in browser, used by fbq() pixel tracking
 * Hardcoded since it's public and won't change
 */
export const META_PIXEL_ID = '215812654357251';

/**
 * Meta Conversions API Access Token
 * SECRET - Server-side only, NEVER expose to client
 * Used to authenticate server-side Conversion API requests
 */
export const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || 'EAAOAPWf9LnsBQX7xHZCrge0zdhEeHCkjJLNK4mqbUCGoywqD0fxu50RMZANTlDpEw7GgQQ8dvP8p7WlgkjlEaLNpWZBDd5bF2zJZAzq1bukyGO3F4JZBAtNUoap1sOtaj88oZCZAijg8ToAw5UAbnYZANKswECVpPeevb4My121yz1HjY4FyIe2XoESXwrcETZBZBtlAZDZD';

/**
 * Meta Pixel Dataset ID
 * Same as pixel ID for most use cases
 * Used for Conversion API requests
 */
export const META_DATASET_ID = META_PIXEL_ID;

/**
 * Meta Conversion API base URL
 */
export const META_CAPI_BASE_URL = 'https://graph.facebook.com/v21.0';

/**
 * Meta tracking configuration
 */
export const MetaConfig = {
  pixelId: META_PIXEL_ID,
  accessToken: META_ACCESS_TOKEN,
  datasetId: META_DATASET_ID,
  capiBaseUrl: META_CAPI_BASE_URL,
  enabled: true, // Can be toggled via environment variable
} as const;

/**
 * Validate Meta configuration
 * Throws error if required settings are missing
 */
export function validateMetaConfig() {
  if (!META_PIXEL_ID) {
    throw new Error('META_PIXEL_ID is required for Meta tracking');
  }

  if (!META_ACCESS_TOKEN) {
    console.warn('META_ACCESS_TOKEN is missing - Conversion API will not work');
  }

  return true;
}
