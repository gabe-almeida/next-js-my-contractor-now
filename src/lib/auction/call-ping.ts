/**
 * Call PING Service
 *
 * WHY: Sends PING requests to network RTB endpoints for pay-per-call auctions.
 *      Networks like Modernize and HomeAdvisor receive real-time PINGs with
 *      call data and respond with bid amounts and transfer numbers.
 *
 * WHEN: Called by CallAuctionEngine during bid collection for NETWORK buyers.
 *
 * HOW:
 *   1. Load buyer's callFieldMappings from buyer_service_configs
 *   2. Transform call data using CallTransformer
 *   3. Send HTTP POST to buyer's callPingUrl
 *   4. Parse response (bidAmount, bidId, phoneNumber, expireInSeconds)
 *   5. Return structured bid result
 *
 * CRITICAL: PING timeout is AGGRESSIVE (2 seconds) because caller is waiting!
 */

import { prisma } from '../db';
import { logger } from '../logger';
import { CallTransformer, type CallFieldMappingConfig, type CallData } from '../templates/call-transformer';
import { logAuctionEvent } from '../twilio/logging';
import * as Sentry from '@sentry/nextjs';

// ============================================================================
// TYPES
// ============================================================================

/**
 * WHY: Input data for call PING request.
 * WHEN: Passed from CallAuctionEngine.
 */
export interface CallPingInput {
  call: CallData;
  buyerId: string;
  buyerName: string;
  callPingUrl: string;
  callFieldMappings: unknown; // JSON from database
  authType?: string | null;
  authConfig?: string | null;
}

/**
 * WHY: Parsed response from network PING endpoint.
 * WHEN: After successful PING request.
 */
export interface CallPingResponse {
  accepted: boolean;
  bidAmount: number;
  bidId?: string;
  transferNumber?: string;
  expiresAt?: Date;
  rejectReason?: string;
  rawResponse?: Record<string, unknown>;
}

/**
 * WHY: Result structure for call PING operation.
 * WHEN: Returned to CallAuctionEngine.
 */
export interface CallPingResult {
  success: boolean;
  buyerId: string;
  buyerName: string;
  response?: CallPingResponse;
  responseTimeMs: number;
  error?: string;
  isTimeout?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * WHY: Aggressive timeout for call PINGs.
 * WHEN: Caller is waiting on hold - they'll abandon after 8-10 seconds!
 */
const CALL_PING_TIMEOUT_MS = 2000;

// ============================================================================
// CALL PING SERVICE
// ============================================================================

/**
 * WHY: Sends a PING request to a network buyer's RTB endpoint.
 * WHEN: Network buyer is eligible for a call auction.
 *
 * @param input - Call data and buyer configuration
 * @returns Structured ping result with bid information
 */
export async function sendCallPing(input: CallPingInput): Promise<CallPingResult> {
  const startTime = Date.now();
  const { call, buyerId, buyerName, callPingUrl, callFieldMappings, authType, authConfig } = input;

  try {
    // Parse field mappings from database JSON
    const mappingConfig = CallTransformer.parseConfig(callFieldMappings);

    // Transform call data using buyer's field mappings
    const payload = CallTransformer.transform(call, mappingConfig);

    // Prepare headers with authentication
    const headers = prepareHeaders(authType, authConfig);

    // Log PING attempt
    logAuctionEvent(call.id, call.twilioCallSid, 'network_ping_sent', {
      buyerId,
      buyerName,
      url: callPingUrl,
      timeout: CALL_PING_TIMEOUT_MS,
    });

    logger.info('Sending call PING to network', {
      callId: call.id,
      buyerId,
      buyerName,
      url: callPingUrl,
      payloadFields: Object.keys(payload),
    });

    // Send PING with abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CALL_PING_TIMEOUT_MS);

    const response = await fetch(callPingUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;

    // Parse response body
    let responseData: Record<string, unknown>;
    try {
      responseData = await response.json();
    } catch {
      // Non-JSON response - treat as rejection
      const text = await response.text();
      logger.warn('Non-JSON response from call PING', {
        callId: call.id,
        buyerId,
        status: response.status,
        responseText: text.substring(0, 200),
      });
      return {
        success: false,
        buyerId,
        buyerName,
        responseTimeMs,
        error: `Non-JSON response: ${response.status}`,
      };
    }

    // Parse structured response
    const parsed = parseCallPingResponse(responseData);

    // Log result
    logAuctionEvent(call.id, call.twilioCallSid, 'network_ping_response', {
      buyerId,
      buyerName,
      accepted: parsed.accepted,
      bidAmount: parsed.bidAmount,
      responseTimeMs,
      hasTransferNumber: !!parsed.transferNumber,
    });

    if (!parsed.accepted) {
      logger.info('Network rejected call PING', {
        callId: call.id,
        buyerId,
        reason: parsed.rejectReason,
        responseTimeMs,
      });
    }

    return {
      success: parsed.accepted && parsed.bidAmount > 0,
      buyerId,
      buyerName,
      response: parsed,
      responseTimeMs,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const isTimeout = isTimeoutError(error);

    // Log timeout or error
    logAuctionEvent(call.id, call.twilioCallSid, 'network_ping_failed', {
      buyerId,
      buyerName,
      isTimeout,
      responseTimeMs,
      error: (error as Error).message,
    });

    if (isTimeout) {
      logger.warn('Call PING timeout - network loses to contractors', {
        callId: call.id,
        buyerId,
        buyerName,
        timeoutMs: CALL_PING_TIMEOUT_MS,
        actualMs: responseTimeMs,
      });
    } else {
      logger.error('Call PING failed', {
        callId: call.id,
        buyerId,
        buyerName,
        error: (error as Error).message,
      });

      Sentry.captureException(error, {
        tags: { component: 'call-ping', action: 'send_ping' },
        extra: { callId: call.id, buyerId, buyerName },
      });
    }

    return {
      success: false,
      buyerId,
      buyerName,
      responseTimeMs,
      error: isTimeout ? 'TIMEOUT' : (error as Error).message,
      isTimeout,
    };
  }
}

/**
 * WHY: Parse network PING response into standard format.
 * WHEN: After receiving response from network endpoint.
 *
 * Networks may use different field names for the same data:
 * - bidAmount, bid_amount, bid, price, amount
 * - transferNumber, transfer_number, phoneNumber, phone_number, phone
 * - bidId, bid_id, id, reference
 * - expireInSeconds, expires_in, ttl
 */
export function parseCallPingResponse(response: Record<string, unknown>): CallPingResponse {
  // Check for acceptance indicators
  const acceptIndicators = [
    response.accepted === true,
    response.success === true,
    response.status === 'accepted',
    response.status === 'success',
    response.bid !== undefined,
    response.bidAmount !== undefined,
    response.bid_amount !== undefined,
    response.price !== undefined,
  ];

  // Check for explicit rejection
  const rejectIndicators = [
    response.accepted === false,
    response.success === false,
    response.status === 'rejected',
    response.status === 'declined',
    response.status === 'failed',
    response.error !== undefined,
  ];

  const isAccepted = acceptIndicators.some(i => i) && !rejectIndicators.some(i => i);

  if (!isAccepted) {
    return {
      accepted: false,
      bidAmount: 0,
      rejectReason:
        (response.reason as string) ||
        (response.message as string) ||
        (response.error as string) ||
        (response.reject_reason as string) ||
        'Not accepted',
      rawResponse: response,
    };
  }

  // Parse bid amount from various field names
  const bidFields = ['bidAmount', 'bid_amount', 'bid', 'price', 'amount', 'offer'];
  let bidAmount = 0;
  for (const field of bidFields) {
    if (response[field] !== undefined) {
      bidAmount = parseFloat(String(response[field]));
      if (!isNaN(bidAmount)) break;
    }
  }

  // Parse transfer number from various field names
  const phoneFields = [
    'transferNumber',
    'transfer_number',
    'phoneNumber',
    'phone_number',
    'phone',
    'forwardingNumber',
    'forwarding_number',
    'destination',
    'target',
  ];
  let transferNumber: string | undefined;
  for (const field of phoneFields) {
    if (response[field]) {
      transferNumber = normalizePhoneNumber(String(response[field]));
      break;
    }
  }

  // Parse bid ID from various field names
  const bidId =
    (response.bidId as string) ||
    (response.bid_id as string) ||
    (response.id as string) ||
    (response.reference as string) ||
    (response.ref as string);

  // Parse expiration from various field names
  let expiresAt: Date | undefined;
  const expireFields = ['expireInSeconds', 'expires_in', 'ttl', 'expiration', 'expire_seconds'];
  for (const field of expireFields) {
    if (response[field] !== undefined) {
      const seconds = parseInt(String(response[field]), 10);
      if (!isNaN(seconds) && seconds > 0) {
        expiresAt = new Date(Date.now() + seconds * 1000);
        break;
      }
    }
  }

  return {
    accepted: true,
    bidAmount,
    bidId,
    transferNumber,
    expiresAt,
    rawResponse: response,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * WHY: Prepare HTTP headers with authentication.
 * WHEN: Before sending PING request.
 */
function prepareHeaders(
  authType?: string | null,
  authConfig?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Type': 'CALL_PING',
    'X-Timestamp': new Date().toISOString(),
  };

  if (!authConfig) {
    return headers;
  }

  try {
    const auth = JSON.parse(authConfig);

    switch (authType) {
      case 'apiKey':
        if (auth.apiKey) {
          headers['X-API-Key'] = auth.apiKey;
        }
        if (auth.headerName && auth.apiKey) {
          headers[auth.headerName] = auth.apiKey;
        }
        break;
      case 'bearer':
        if (auth.token) {
          headers['Authorization'] = `Bearer ${auth.token}`;
        }
        break;
      case 'basic':
        if (auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
    }

    // Add any custom headers from config
    if (auth.headers && typeof auth.headers === 'object') {
      Object.assign(headers, auth.headers);
    }
  } catch {
    logger.warn('Failed to parse auth config for call PING');
  }

  return headers;
}

/**
 * WHY: Normalize phone number to E.164 format.
 * WHEN: Parsing transfer number from network response.
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // If already E.164-ish, return as-is with +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Return with + prefix
  return phone.startsWith('+') ? phone : `+${digits}`;
}

/**
 * WHY: Check if error is timeout-related.
 * WHEN: Handling PING request errors.
 */
function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('aborted') ||
      msg.includes('abort') ||
      name === 'aborterror' ||
      name === 'timeouterror'
    );
  }
  return false;
}

/**
 * WHY: Load buyer's call PING configuration from database.
 * WHEN: Before sending PING during auction.
 *
 * @param buyerId - Buyer ID
 * @param serviceTypeId - Service type for this call
 * @returns Call PING configuration or null if not found
 */
export async function loadCallPingConfig(
  buyerId: string,
  serviceTypeId: string
): Promise<{
  callPingUrl: string | null;
  callFieldMappings: unknown;
  authType: string | null;
  authConfig: string | null;
} | null> {
  const config = await prisma.buyerServiceConfig.findFirst({
    where: {
      buyerId,
      serviceTypeId,
      active: true,
    },
    select: {
      callPingUrl: true,
      callFieldMappings: true,
      buyer: {
        select: {
          authType: true,
          authConfig: true,
        },
      },
    },
  });

  if (!config) {
    return null;
  }

  return {
    callPingUrl: config.callPingUrl,
    callFieldMappings: config.callFieldMappings,
    authType: config.buyer.authType,
    authConfig: config.buyer.authConfig,
  };
}

export default {
  sendCallPing,
  parseCallPingResponse,
  loadCallPingConfig,
};
