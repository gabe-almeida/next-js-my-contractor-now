/**
 * Forwarding Parser
 *
 * WHY: Affiliates who use external call tracking (Ringba, Retreaver, Invoca) forward
 *      calls to our shared ingress numbers. We need to identify which affiliate/campaign
 *      the call belongs to from SIP headers or URL parameters.
 *
 * WHEN: Called by /api/calls/incoming when a call arrives on an ingress number.
 *       The parser extracts affiliate/campaign identification from the call metadata.
 *
 * HOW:
 *   Option 1: SIP Headers (X-Affiliate-ID, X-Campaign-ID)
 *   Option 2: URL Parameters (?affiliate_id=xxx&campaign_id=yyy)
 *   Option 3: Custom forwarding identifier in From/To SIP headers
 *
 * TWILIO SIP HEADER FLOW:
 * +-----------------------------------------------------------------------+
 * |  External system (Ringba) forwards call to our Twilio ingress number  |
 * |      |                                                                |
 * |  Ringba includes SIP headers in the INVITE:                          |
 * |      X-Affiliate-ID: aff-123                                         |
 * |      X-Campaign-ID: camp-456                                         |
 * |      |                                                                |
 * |  Twilio receives call and includes headers in webhook:               |
 * |      SipHeader_X-Affiliate-ID: aff-123                               |
 * |      SipHeader_X-Campaign-ID: camp-456                               |
 * |      |                                                                |
 * |  This parser extracts and validates the identification               |
 * +-----------------------------------------------------------------------+
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// =====================================
// TYPE DEFINITIONS
// =====================================

/**
 * Result of parsing forwarding identification from an incoming call
 */
export interface ForwardingIdentification {
  /** Whether identification was successful */
  success: boolean;

  /** Source of identification: 'sip_header', 'url_param', 'forwarding_id', or 'none' */
  source: 'sip_header' | 'url_param' | 'forwarding_id' | 'none';

  /** Extracted affiliate ID */
  affiliateId: string | null;

  /** Extracted campaign ID */
  campaignId: string | null;

  /** Optional service type ID */
  serviceTypeId: string | null;

  /** Full forwarding identifier if found */
  forwardingIdentifier: string | null;

  /** Raw metadata extracted (for storing in call record) */
  rawMetadata: ForwardingMetadata;

  /** Error message if identification failed */
  error?: string;
}

/**
 * Raw metadata from forwarding headers/params (stored in call.forwardingMetadata)
 */
export interface ForwardingMetadata {
  /** All SIP headers found */
  sipHeaders?: Record<string, string>;

  /** All URL parameters found */
  urlParams?: Record<string, string>;

  /** Original From header */
  sipFrom?: string;

  /** Original To header */
  sipTo?: string;

  /** Whether this was a forwarded call */
  isForwarded: boolean;

  /** Timestamp of parsing */
  parsedAt: string;

  /** Index signature for Prisma JSON compatibility */
  [key: string]: string | boolean | Record<string, string> | undefined;
}

/**
 * Twilio webhook payload fields relevant to SIP headers
 */
export interface TwilioSipPayload {
  // Standard Twilio fields
  CallSid: string;
  From: string;
  To: string;

  // SIP-specific fields (Twilio prefixes with SipHeader_)
  [key: `SipHeader_${string}`]: string;

  // URL parameters passed through voice URL
  [key: string]: string | undefined;
}

// =====================================
// SIP HEADER PARSING (P3-FW-3)
// =====================================

/**
 * Standard SIP header names we look for (case-insensitive)
 * These can be configured by affiliates in their forwarding setup
 */
export const SIP_HEADER_MAPPINGS = {
  affiliateId: [
    'X-Affiliate-ID',
    'X-Affiliate-Id',
    'X-AffiliateID',
    'X-Aff-ID',
    'X-Partner-ID',
    'X-Publisher-ID',
  ],
  campaignId: [
    'X-Campaign-ID',
    'X-Campaign-Id',
    'X-CampaignID',
    'X-Camp-ID',
    'X-Offer-ID',
  ],
  serviceTypeId: [
    'X-Service-Type',
    'X-Service-ID',
    'X-Vertical',
  ],
  forwardingId: [
    'X-Forwarding-ID',
    'X-Forward-ID',
    'X-Tracking-ID',
  ],
};

/**
 * Standard URL parameter names we look for
 */
export const URL_PARAM_MAPPINGS = {
  affiliateId: ['affiliate_id', 'affiliateId', 'aff_id', 'affId', 'partner_id', 'pub_id'],
  campaignId: ['campaign_id', 'campaignId', 'camp_id', 'campId', 'offer_id'],
  serviceTypeId: ['service_type', 'serviceType', 'vertical', 'service_id'],
  forwardingId: ['forwarding_id', 'forwardingId', 'tracking_id', 'fwd_id'],
};

/**
 * Extract SIP headers from Twilio webhook payload
 *
 * WHY: Twilio prefixes SIP headers with 'SipHeader_' in webhook payload.
 * WHEN: Processing incoming call on ingress number.
 * HOW: Filter payload keys starting with 'SipHeader_', strip prefix.
 */
export function extractSipHeaders(
  payload: Record<string, string | undefined>
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (key.startsWith('SipHeader_') && value) {
      // Remove 'SipHeader_' prefix
      const headerName = key.replace('SipHeader_', '');
      headers[headerName] = value;
    }
  }

  return headers;
}

/**
 * Find a value from SIP headers using possible header name variations
 *
 * WHY: Different systems use different header names for the same data.
 * WHEN: Looking for affiliate_id, campaign_id, etc. in SIP headers.
 * HOW: Check each possible header name (case-insensitive) until found.
 */
function findSipHeaderValue(
  headers: Record<string, string>,
  possibleNames: string[]
): string | null {
  // Normalize header keys to lowercase for comparison
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  for (const name of possibleNames) {
    const value = normalizedHeaders[name.toLowerCase()];
    if (value) {
      return value;
    }
  }

  return null;
}

/**
 * Parse affiliate/campaign identification from SIP headers
 *
 * WHY: Primary method for affiliates using Ringba/external systems.
 * WHEN: Call arrives on ingress number with SIP headers.
 * HOW: Extract SIP headers, look for known header names, validate.
 */
export function parseSipHeaders(
  payload: Record<string, string | undefined>
): { affiliateId: string | null; campaignId: string | null; serviceTypeId: string | null; forwardingId: string | null; rawHeaders: Record<string, string> } {
  const headers = extractSipHeaders(payload);

  const affiliateId = findSipHeaderValue(headers, SIP_HEADER_MAPPINGS.affiliateId);
  const campaignId = findSipHeaderValue(headers, SIP_HEADER_MAPPINGS.campaignId);
  const serviceTypeId = findSipHeaderValue(headers, SIP_HEADER_MAPPINGS.serviceTypeId);
  const forwardingId = findSipHeaderValue(headers, SIP_HEADER_MAPPINGS.forwardingId);

  return {
    affiliateId,
    campaignId,
    serviceTypeId,
    forwardingId,
    rawHeaders: headers,
  };
}

// =====================================
// URL PARAMETER PARSING (P3-FW-4)
// =====================================

/**
 * Find a value from URL parameters using possible parameter name variations
 */
function findUrlParamValue(
  params: Record<string, string | undefined>,
  possibleNames: string[]
): string | null {
  // URL params are case-sensitive, but we'll check lowercase versions too
  const normalizedParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      normalizedParams[key] = value;
      normalizedParams[key.toLowerCase()] = value;
    }
  }

  for (const name of possibleNames) {
    const value = normalizedParams[name] || normalizedParams[name.toLowerCase()];
    if (value) {
      return value;
    }
  }

  return null;
}

/**
 * Parse affiliate/campaign identification from URL parameters
 *
 * WHY: Alternative method when SIP headers aren't available.
 * WHEN: Affiliate configures HTTP forwarding with URL params.
 * HOW: Extract query parameters from voice URL callback.
 *
 * Note: Twilio passes URL params from the voice_url to the webhook,
 * so ?affiliate_id=123 on the voice URL appears in the webhook payload.
 */
export function parseUrlParams(
  payload: Record<string, string | undefined>
): { affiliateId: string | null; campaignId: string | null; serviceTypeId: string | null; forwardingId: string | null; rawParams: Record<string, string> } {
  // Filter out Twilio standard fields and SIP headers
  const urlParams: Record<string, string> = {};
  const twilioFields = new Set([
    'CallSid', 'AccountSid', 'From', 'To', 'Direction', 'CallStatus',
    'FromCity', 'FromState', 'FromZip', 'FromCountry',
    'ToCity', 'ToState', 'ToZip', 'ToCountry',
    'CallerName', 'Caller', 'Called', 'ApiVersion',
  ]);

  for (const [key, value] of Object.entries(payload)) {
    if (value && !key.startsWith('SipHeader_') && !twilioFields.has(key)) {
      urlParams[key] = value;
    }
  }

  const affiliateId = findUrlParamValue(urlParams, URL_PARAM_MAPPINGS.affiliateId);
  const campaignId = findUrlParamValue(urlParams, URL_PARAM_MAPPINGS.campaignId);
  const serviceTypeId = findUrlParamValue(urlParams, URL_PARAM_MAPPINGS.serviceTypeId);
  const forwardingId = findUrlParamValue(urlParams, URL_PARAM_MAPPINGS.forwardingId);

  return {
    affiliateId,
    campaignId,
    serviceTypeId,
    forwardingId,
    rawParams: urlParams,
  };
}

// =====================================
// MAIN IDENTIFICATION FUNCTION
// =====================================

/**
 * Parse and validate forwarding identification from an incoming call
 *
 * WHY: Central function to identify affiliate/campaign from forwarded calls.
 * WHEN: /api/calls/incoming detects call on an ingress number.
 * HOW:
 *   1. Try SIP headers first (most reliable)
 *   2. Fall back to URL parameters
 *   3. Validate the affiliate/campaign exist and are active
 *   4. Return identification result with metadata
 */
export async function parseForwardingIdentification(
  payload: Record<string, string | undefined>,
  ingressPhoneNumber: string
): Promise<ForwardingIdentification> {
  const timestamp = new Date().toISOString();

  // Initialize metadata
  const rawMetadata: ForwardingMetadata = {
    isForwarded: true,
    parsedAt: timestamp,
    sipFrom: payload.From ?? undefined,
    sipTo: payload.To ?? undefined,
  };

  // Try SIP headers first
  const sipResult = parseSipHeaders(payload);
  rawMetadata.sipHeaders = sipResult.rawHeaders;

  // Check if we got identification from SIP headers
  if (sipResult.affiliateId && sipResult.campaignId) {
    logger.info({
      event: 'forwarding.identification.sip',
      message: 'Identified forwarding via SIP headers',
      affiliateId: sipResult.affiliateId,
      campaignId: sipResult.campaignId,
    });

    // Validate the affiliate and campaign exist
    const validation = await validateForwardingConfig(
      ingressPhoneNumber,
      sipResult.affiliateId,
      sipResult.campaignId
    );

    if (!validation.valid) {
      return {
        success: false,
        source: 'sip_header',
        affiliateId: sipResult.affiliateId,
        campaignId: sipResult.campaignId,
        serviceTypeId: sipResult.serviceTypeId,
        forwardingIdentifier: null,
        rawMetadata,
        error: validation.error,
      };
    }

    return {
      success: true,
      source: 'sip_header',
      affiliateId: sipResult.affiliateId,
      campaignId: sipResult.campaignId,
      serviceTypeId: validation.serviceTypeId ?? sipResult.serviceTypeId,
      forwardingIdentifier: validation.forwardingIdentifier ?? null,
      rawMetadata,
    };
  }

  // Try direct forwarding ID from SIP headers
  if (sipResult.forwardingId) {
    const parsed = parseForwardingIdString(sipResult.forwardingId);
    if (parsed) {
      const validation = await validateForwardingConfig(
        parsed.ingressPhone,
        parsed.affiliateId,
        parsed.campaignId
      );

      if (validation.valid) {
        return {
          success: true,
          source: 'forwarding_id',
          affiliateId: parsed.affiliateId,
          campaignId: parsed.campaignId,
          serviceTypeId: validation.serviceTypeId ?? null,
          forwardingIdentifier: sipResult.forwardingId,
          rawMetadata,
        };
      }
    }
  }

  // Fall back to URL parameters
  const urlResult = parseUrlParams(payload);
  rawMetadata.urlParams = urlResult.rawParams;

  if (urlResult.affiliateId && urlResult.campaignId) {
    logger.info({
      event: 'forwarding.identification.url',
      message: 'Identified forwarding via URL parameters',
      affiliateId: urlResult.affiliateId,
      campaignId: urlResult.campaignId,
    });

    const validation = await validateForwardingConfig(
      ingressPhoneNumber,
      urlResult.affiliateId,
      urlResult.campaignId
    );

    if (!validation.valid) {
      return {
        success: false,
        source: 'url_param',
        affiliateId: urlResult.affiliateId,
        campaignId: urlResult.campaignId,
        serviceTypeId: urlResult.serviceTypeId,
        forwardingIdentifier: null,
        rawMetadata,
        error: validation.error,
      };
    }

    return {
      success: true,
      source: 'url_param',
      affiliateId: urlResult.affiliateId,
      campaignId: urlResult.campaignId,
      serviceTypeId: validation.serviceTypeId ?? urlResult.serviceTypeId,
      forwardingIdentifier: validation.forwardingIdentifier ?? null,
      rawMetadata,
    };
  }

  // Try URL param forwarding ID
  if (urlResult.forwardingId) {
    const parsed = parseForwardingIdString(urlResult.forwardingId);
    if (parsed) {
      const validation = await validateForwardingConfig(
        parsed.ingressPhone,
        parsed.affiliateId,
        parsed.campaignId
      );

      if (validation.valid) {
        return {
          success: true,
          source: 'forwarding_id',
          affiliateId: parsed.affiliateId,
          campaignId: parsed.campaignId,
          serviceTypeId: validation.serviceTypeId ?? null,
          forwardingIdentifier: urlResult.forwardingId,
          rawMetadata,
        };
      }
    }
  }

  // No identification found
  logger.warn({
    event: 'forwarding.identification.failed',
    message: 'Could not identify forwarding source',
    ingressPhoneNumber,
    sipHeaderCount: Object.keys(rawMetadata.sipHeaders || {}).length,
    urlParamCount: Object.keys(rawMetadata.urlParams || {}).length,
  });

  return {
    success: false,
    source: 'none',
    affiliateId: null,
    campaignId: null,
    serviceTypeId: null,
    forwardingIdentifier: null,
    rawMetadata,
    error: 'Could not identify affiliate/campaign from forwarding headers or parameters',
  };
}

// =====================================
// VALIDATION HELPERS
// =====================================

/**
 * Parse a forwarding identifier string
 * Format: INGRESS_PHONE:AFF_ID:CAMP_ID
 */
function parseForwardingIdString(
  forwardingId: string
): { ingressPhone: string; affiliateId: string; campaignId: string } | null {
  const parts = forwardingId.split(':');
  if (parts.length !== 3) {
    return null;
  }
  return {
    ingressPhone: parts[0],
    affiliateId: parts[1],
    campaignId: parts[2],
  };
}

/**
 * Validate that a forwarding configuration exists and is active
 *
 * WHY: Ensure the affiliate/campaign combination is valid before processing.
 * WHEN: After extracting identification from headers/params.
 * HOW: Query tracking_numbers for matching FORWARDING record.
 */
async function validateForwardingConfig(
  ingressPhone: string,
  affiliateId: string,
  campaignId: string
): Promise<{ valid: boolean; error?: string; serviceTypeId?: string; forwardingIdentifier?: string }> {
  // Build expected forwarding identifier
  const expectedIdentifier = `${ingressPhone}:${affiliateId}:${campaignId}`;

  // Look for matching forwarding config
  const forwardingConfig = await prisma.trackingNumber.findFirst({
    where: {
      OR: [
        { forwardingIdentifier: expectedIdentifier },
        {
          affiliateId,
          campaignId,
          provisioningType: 'FORWARDING',
          provisioningStatus: 'ACTIVE',
          active: true,
        },
      ],
    },
    include: {
      affiliate: { select: { id: true, status: true } },
      campaign: { select: { id: true, active: true, serviceTypeId: true } },
    },
  });

  if (!forwardingConfig) {
    // Check if affiliate and campaign exist but aren't configured for forwarding
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: { id: true, status: true },
    });

    if (!affiliate) {
      return { valid: false, error: `Affiliate ${affiliateId} not found` };
    }

    if (affiliate.status !== 'ACTIVE') {
      return { valid: false, error: `Affiliate ${affiliateId} is not active` };
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, active: true },
    });

    if (!campaign) {
      return { valid: false, error: `Campaign ${campaignId} not found` };
    }

    if (!campaign.active) {
      return { valid: false, error: `Campaign ${campaignId} is not active` };
    }

    // Affiliate and campaign exist but no forwarding config
    return {
      valid: false,
      error: `No forwarding configuration found for affiliate ${affiliateId} and campaign ${campaignId}`,
    };
  }

  // Check affiliate status
  if (forwardingConfig.affiliate?.status !== 'ACTIVE') {
    return { valid: false, error: 'Affiliate is not active' };
  }

  // Check campaign status
  if (!forwardingConfig.campaign?.active) {
    return { valid: false, error: 'Campaign is not active' };
  }

  return {
    valid: true,
    serviceTypeId: forwardingConfig.campaign.serviceTypeId,
    forwardingIdentifier: forwardingConfig.forwardingIdentifier || expectedIdentifier,
  };
}
