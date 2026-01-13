/**
 * ============================================================================
 * META CONVERSION API (CAPI) SERVICE
 * ============================================================================
 *
 * WHAT: Server-side Meta Conversions API integration with PII hashing
 * WHY:  Boost pixel matching by sending events from server with full customer data
 * WHEN: Called on lead submission to send Lead and PageView events
 *
 * BENEFITS OF CAPI:
 * - Better event matching (not blocked by ad blockers or browser restrictions)
 * - Access to server-side data (IP address, user agent)
 * - Deduplication with client-side pixel events via event_id
 * - Higher quality data (PII is hashed securely server-side)
 *
 * EVENTS SENT:
 * - PageView: On every landing page visit (lightweight event)
 * - Lead: On form submission with full customer data and attribution
 *
 * DATA SENT:
 * Event Detail Parameters:
 * - action_source: 'website'
 * - event_name: 'Lead' or 'PageView'
 * - event_time: Unix timestamp
 * - event_source_url: Full page URL
 * - event_id: Unique ID for deduplication with pixel
 * - currency: 'USD'
 * - value: Lead value/revenue
 *
 * Customer Information Parameters (ALL HASHED WITH SHA-256):
 * - email (em)
 * - phone (ph)
 * - first name (fn)
 * - last name (ln)
 * - city (ct)
 * - state (st)
 * - zip code (zp)
 * - country (country)
 * - date of birth (db)
 * - gender (ge)
 * - external_id
 *
 * NOT HASHED:
 * - client_ip_address
 * - client_user_agent
 * - fbc (Facebook Click ID cookie)
 * - fbp (Facebook Browser ID cookie)
 *
 * SECURITY:
 * - PII is hashed with SHA-256 before sending
 * - Access token is server-side only (never exposed to client)
 * - IP and user agent are sent unhashed per Meta requirements
 *
 * DOCS: https://developers.facebook.com/docs/marketing-api/conversions-api
 * ============================================================================
 */

import crypto from 'crypto';
import { MetaConfig } from './config';

/**
 * Hash PII data with SHA-256
 * Meta requires PII to be lowercase, trimmed, and SHA-256 hashed
 *
 * @param value - Raw PII value
 * @returns SHA-256 hash of normalized value
 */
function hashPII(value: string | undefined): string | undefined {
  if (!value) return undefined;

  // Normalize: lowercase and trim whitespace
  const normalized = value.toLowerCase().trim();

  if (!normalized) return undefined;

  // Hash with SHA-256
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Normalize and hash phone number
 * Remove all non-digit characters, then hash
 *
 * @param phone - Phone number (any format)
 * @returns SHA-256 hash of digits-only phone
 */
function hashPhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  if (!digitsOnly) return undefined;

  // Hash the digits-only phone number
  return crypto.createHash('sha256').update(digitsOnly).digest('hex');
}

/**
 * User data for Meta CAPI
 * All PII fields will be hashed automatically
 */
export interface MetaUserData {
  // Email (will be hashed)
  email?: string;
  // Phone in E.164 or any format (will be normalized and hashed)
  phone?: string;
  // First name (will be hashed)
  firstName?: string;
  // Last name (will be hashed)
  lastName?: string;
  // City (will be hashed)
  city?: string;
  // State - 2 letter code (will be hashed)
  state?: string;
  // ZIP code (will be hashed)
  zipCode?: string;
  // Country - 2 letter code (will be hashed)
  country?: string;
  // Date of birth YYYYMMDD (will be hashed)
  dateOfBirth?: string;
  // Gender 'm' or 'f' (will be hashed)
  gender?: string;
  // External ID (will be hashed)
  externalId?: string;

  // NOT HASHED per Meta requirements
  // Client IP address (sent unhashed)
  clientIpAddress?: string;
  // Client user agent (sent unhashed)
  clientUserAgent?: string;
  // Facebook Click ID (fbc) cookie value (sent unhashed)
  fbc?: string;
  // Facebook Browser ID (fbp) cookie value (sent unhashed)
  fbp?: string;
}

/**
 * Custom data for Lead event
 */
export interface MetaCustomData {
  currency?: string;
  value?: number;
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  status?: string;
  predicted_ltv?: number;
}

/**
 * Meta CAPI event parameters
 */
export interface MetaEvent {
  // Event name: 'Lead', 'PageView', etc.
  event_name: string;
  // Event time (Unix timestamp in seconds)
  event_time: number;
  // Event source URL
  event_source_url: string;
  // Action source: always 'website' for web events
  action_source: 'website';
  // User data (PII will be hashed)
  user_data: MetaUserData;
  // Custom data (event-specific parameters)
  custom_data?: MetaCustomData;
  // Event ID for deduplication with client-side pixel
  event_id?: string;
}

/**
 * Meta CAPI request payload
 */
interface MetaCAPIRequest {
  data: Array<{
    event_name: string;
    event_time: number;
    event_source_url: string;
    action_source: string;
    user_data: {
      em?: string;
      ph?: string;
      fn?: string;
      ln?: string;
      ct?: string;
      st?: string;
      zp?: string;
      country?: string;
      db?: string;
      ge?: string;
      external_id?: string;
      client_ip_address?: string;
      client_user_agent?: string;
      fbc?: string;
      fbp?: string;
    };
    custom_data?: Record<string, any>;
    event_id?: string;
  }>;
  test_event_code?: string;
}

/**
 * Meta CAPI response
 */
interface MetaCAPIResponse {
  events_received: number;
  messages: string[];
  fbtrace_id: string;
}

/**
 * Send event to Meta Conversions API
 *
 * @param event - Event data with user information
 * @returns API response with event receipt confirmation
 */
export async function sendMetaCAPIEvent(event: MetaEvent): Promise<MetaCAPIResponse> {
  if (!MetaConfig.enabled) {
    console.log('[Meta CAPI] Tracking disabled');
    throw new Error('Meta tracking is disabled');
  }

  if (!MetaConfig.accessToken) {
    console.error('[Meta CAPI] Access token not configured');
    throw new Error('Meta access token not configured');
  }

  // Hash all PII fields in user_data
  const hashedUserData: any = {
    // Hashed PII
    em: hashPII(event.user_data.email),
    ph: hashPhone(event.user_data.phone),
    fn: hashPII(event.user_data.firstName),
    ln: hashPII(event.user_data.lastName),
    ct: hashPII(event.user_data.city),
    st: hashPII(event.user_data.state),
    zp: hashPII(event.user_data.zipCode),
    country: hashPII(event.user_data.country || 'us'),
    db: hashPII(event.user_data.dateOfBirth),
    ge: hashPII(event.user_data.gender),
    external_id: hashPII(event.user_data.externalId),

    // NOT hashed per Meta requirements
    client_ip_address: event.user_data.clientIpAddress,
    client_user_agent: event.user_data.clientUserAgent,
    fbc: event.user_data.fbc,
    fbp: event.user_data.fbp,
  };

  // Remove undefined fields
  Object.keys(hashedUserData).forEach(key => {
    if (hashedUserData[key] === undefined) {
      delete hashedUserData[key];
    }
  });

  // Build request payload
  const payload: MetaCAPIRequest = {
    data: [
      {
        event_name: event.event_name,
        event_time: event.event_time,
        event_source_url: event.event_source_url,
        action_source: event.action_source,
        user_data: hashedUserData,
        custom_data: event.custom_data,
        event_id: event.event_id,
      },
    ],
  };

  // Add test event code for debugging (optional)
  if (process.env.META_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  // Send to Meta Conversions API
  const url = `${MetaConfig.capiBaseUrl}/${MetaConfig.datasetId}/events?access_token=${MetaConfig.accessToken}`;

  console.log('[Meta CAPI] Sending event:', {
    event_name: event.event_name,
    event_id: event.event_id,
    event_source_url: event.event_source_url,
    has_email: !!hashedUserData.em,
    has_phone: !!hashedUserData.ph,
    has_name: !!(hashedUserData.fn || hashedUserData.ln),
    has_address: !!(hashedUserData.ct || hashedUserData.st || hashedUserData.zp),
    has_fbc: !!hashedUserData.fbc,
    has_fbp: !!hashedUserData.fbp,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Meta CAPI] API error:', errorData);
      throw new Error(`Meta CAPI error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log('[Meta CAPI] Event sent successfully:', {
      events_received: result.events_received,
      fbtrace_id: result.fbtrace_id,
    });

    return result;
  } catch (error) {
    console.error('[Meta CAPI] Request failed:', error);
    throw error;
  }
}

/**
 * Track Lead event via Meta CAPI
 * Call this when a lead is successfully submitted
 *
 * @param userData - Customer information (PII will be hashed)
 * @param customData - Lead-specific data (currency, value, etc.)
 * @param eventSourceUrl - Full page URL where lead was submitted
 * @param eventId - Optional ID for deduplication with pixel (use same ID as client-side)
 */
export async function trackLeadCAPI(
  userData: MetaUserData,
  customData?: MetaCustomData,
  eventSourceUrl?: string,
  eventId?: string
): Promise<MetaCAPIResponse> {
  const event: MetaEvent = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
    event_source_url: eventSourceUrl || 'https://mycontractornow.com',
    action_source: 'website',
    user_data: userData,
    custom_data: customData,
    event_id: eventId || crypto.randomUUID(),
  };

  return sendMetaCAPIEvent(event);
}

/**
 * Track PageView event via Meta CAPI
 * Call this on landing page visits
 *
 * @param userData - Basic user information (IP, user agent, cookies)
 * @param eventSourceUrl - Full page URL
 * @param eventId - Optional ID for deduplication with pixel
 */
export async function trackPageViewCAPI(
  userData: Partial<MetaUserData>,
  eventSourceUrl: string,
  eventId?: string
): Promise<MetaCAPIResponse> {
  const event: MetaEvent = {
    event_name: 'PageView',
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: eventSourceUrl,
    action_source: 'website',
    user_data: userData as MetaUserData,
    event_id: eventId || crypto.randomUUID(),
  };

  return sendMetaCAPIEvent(event);
}
