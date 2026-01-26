/**
 * ============================================================================
 * META CONVERSION API (CAPI) SERVICE
 * ============================================================================
 *
 * WHAT: Server-side Meta Conversions API integration with PII hashing
 * WHY:  Boost pixel matching by sending events from server with full customer data
 * WHEN: Called on lead submission to send Lead and PageView events
 *
 * FEATURES:
 * - Service-specific event names (e.g., "Window Lead", "Bathroom Lead")
 * - Auto-generates event names from service display names
 * - Logs all CAPI calls to database for debugging/auditing
 * - PII is hashed with SHA-256 before sending
 *
 * EVENTS SENT:
 * - Service-specific Lead events: "Window Lead", "Bathroom Lead", etc.
 * - PageView: On every landing page visit (lightweight event)
 *
 * DATA SENT:
 * Event Detail Parameters:
 * - action_source: 'website'
 * - event_name: 'Window Lead', 'Bathroom Lead', etc.
 * - event_time: Unix timestamp
 * - event_source_url: Full page URL
 * - event_id: Unique ID for deduplication with pixel
 * - currency: 'USD'
 * - value: Lead value/revenue
 *
 * Customer Information Parameters (ALL HASHED WITH SHA-256):
 * - email (em), phone (ph), first name (fn), last name (ln)
 * - city (ct), state (st), zip code (zp), country (country)
 * - date of birth (db), gender (ge), external_id
 *
 * NOT HASHED:
 * - client_ip_address, client_user_agent, fbc, fbp
 *
 * DATABASE LOGGING:
 * All CAPI calls are logged to `meta_capi_logs` table with:
 * - Full request payload (PII already hashed)
 * - Meta's response (events_received, fbtrace_id)
 * - Success/failure status and error messages
 *
 * DOCS: https://developers.facebook.com/docs/marketing-api/conversions-api
 * ============================================================================
 */

import crypto from 'crypto';
import { MetaConfig } from './config';
import { prisma } from '@/lib/prisma';

/**
 * Generate Meta event name from service display name
 * Takes first word of display name and appends " Lead"
 *
 * WHY: Auto-adapts when new services are added
 * WHEN: Called when sending lead events to Meta
 *
 * @example
 * "Windows Installation" → "Windows Lead"
 * "Bathroom Remodeling" → "Bathroom Lead"
 * "HVAC Services" → "HVAC Lead"
 *
 * @param displayName - Service type display name from database
 * @returns Event name for Meta CAPI (e.g., "Window Lead")
 */
export function getServiceEventName(displayName: string): string {
  if (!displayName) return 'Lead';

  const firstWord = displayName.split(' ')[0];
  return `${firstWord} Lead`;
}

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
  // Event name: 'Window Lead', 'Bathroom Lead', etc.
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
export interface MetaCAPIResponse {
  events_received: number;
  messages: string[];
  fbtrace_id: string;
}

/**
 * Log Meta CAPI event to database
 * Fire-and-forget - errors are logged but don't block
 */
async function logMetaCapiEvent(params: {
  leadId: string;
  eventName: string;
  eventId: string | undefined;
  serviceType: string;
  requestPayload: Record<string, any>;
  responseData?: MetaCAPIResponse;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    await prisma.metaCapiLog.create({
      data: {
        leadId: params.leadId,
        eventName: params.eventName,
        eventId: params.eventId,
        serviceType: params.serviceType,
        requestPayload: params.requestPayload as object,
        // Cast to object for Prisma JSON compatibility
        ...(params.responseData && {
          responseData: params.responseData as unknown as object,
        }),
        success: params.success,
        errorMessage: params.errorMessage,
        fbtraceId: params.responseData?.fbtrace_id,
        eventsReceived: params.responseData?.events_received,
      },
    });
    console.log('[Meta CAPI] Event logged to database:', {
      leadId: params.leadId,
      eventName: params.eventName,
      success: params.success,
    });
  } catch (err) {
    // Don't let logging failures affect the main flow
    console.warn('[Meta CAPI] Failed to log event to database:', err);
  }
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
  const hashedUserData: Record<string, string | undefined> = {
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
        user_data: hashedUserData as MetaCAPIRequest['data'][0]['user_data'],
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
 * Track Lead event via Meta CAPI with database logging
 * Call this when a lead is successfully submitted
 *
 * WHY: Sends conversion data to Meta for ad optimization
 * WHEN: Called after lead is created in database
 * HOW: Builds event from service type, sends to Meta, logs to DB
 *
 * @param leadId - Database lead ID (for logging)
 * @param serviceTypeDisplayName - Service display name (e.g., "Windows Installation")
 * @param serviceTypeName - Service type key (e.g., "windows")
 * @param userData - Customer information (PII will be hashed)
 * @param customData - Lead-specific data (currency, value, etc.)
 * @param eventSourceUrl - Full page URL where lead was submitted
 * @param eventId - Optional ID for deduplication with pixel
 */
export async function trackLeadCAPI(
  leadId: string,
  serviceTypeDisplayName: string,
  serviceTypeName: string,
  userData: MetaUserData,
  customData?: MetaCustomData,
  eventSourceUrl?: string,
  eventId?: string
): Promise<MetaCAPIResponse> {
  // Generate service-specific event name
  const eventName = getServiceEventName(serviceTypeDisplayName);
  const finalEventId = eventId || crypto.randomUUID();

  const event: MetaEvent = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
    event_source_url: eventSourceUrl || 'https://mycontractornow.com',
    action_source: 'website',
    user_data: userData,
    custom_data: customData,
    event_id: finalEventId,
  };

  // Build sanitized payload for logging (PII will be hashed in sendMetaCAPIEvent)
  const logPayload = {
    event_name: eventName,
    event_time: event.event_time,
    event_source_url: event.event_source_url,
    event_id: finalEventId,
    custom_data: customData,
    // Don't log raw PII - just indicate what fields were present
    user_data_fields: {
      has_email: !!userData.email,
      has_phone: !!userData.phone,
      has_name: !!(userData.firstName || userData.lastName),
      has_address: !!(userData.city || userData.state || userData.zipCode),
      has_fbc: !!userData.fbc,
      has_fbp: !!userData.fbp,
      has_ip: !!userData.clientIpAddress,
      has_user_agent: !!userData.clientUserAgent,
    },
  };

  try {
    const result = await sendMetaCAPIEvent(event);

    // Log successful event to database
    logMetaCapiEvent({
      leadId,
      eventName,
      eventId: finalEventId,
      serviceType: serviceTypeName,
      requestPayload: logPayload,
      responseData: result,
      success: true,
    }).catch(() => {}); // Fire and forget

    return result;
  } catch (error) {
    // Log failed event to database
    logMetaCapiEvent({
      leadId,
      eventName,
      eventId: finalEventId,
      serviceType: serviceTypeName,
      requestPayload: logPayload,
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    }).catch(() => {}); // Fire and forget

    throw error;
  }
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
