/**
 * Postback Service
 *
 * WHY: Sends real-time conversion notifications to affiliates via their configured
 *      postback URLs when qualified calls are completed.
 *
 * WHEN: Use this service for:
 *       - Sending postbacks on call completion
 *       - Retrying failed postbacks
 *       - Building postback payloads
 *       - Testing postback configurations
 *
 * HOW: Import and call sendCallPostback() after a qualified call completes.
 *      The service handles payload building, HTTP requests, and retry logic.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Postback configuration
const POSTBACK_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [5000, 30000, 120000]; // 5s, 30s, 2min

// Postback event types
export type PostbackEvent =
  | 'call.completed'
  | 'call.qualified'
  | 'lead.converted';

// Postback payload structure
export interface PostbackPayload {
  event: PostbackEvent;
  timestamp: string;
  affiliateId: string;
  call?: CallPostbackData;
  lead?: LeadPostbackData;
  // Custom fields from URL params
  [key: string]: any;
}

export interface CallPostbackData {
  id: string;
  callSid: string;
  campaignId: string | null;
  campaignName: string | null;
  serviceType: string | null;
  trackingNumberId: string | null;
  trackingNumber: string | null;
  callerZip: string | null;
  callerState: string | null;
  status: string;
  isQualified: boolean;
  isBillable: boolean;
  duration: number | null;
  connectedDuration: number | null;
  payout: number | null;
  disposition: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface LeadPostbackData {
  id: string;
  zipCode: string;
  serviceType: string | null;
  status: string;
  commission: number;
}

export interface PostbackResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  retryScheduled?: boolean;
}

/**
 * Send postback for a completed call
 *
 * WHY: Notifies affiliate's tracking system of a qualified call.
 * WHEN: Called after a call is marked as billable/qualified.
 * HOW: Builds payload, sends HTTP request to affiliate's postback URL.
 *
 * @param callId - The call ID to send postback for
 * @param retryAttempt - Current retry attempt (0 for first attempt)
 * @returns Result of the postback attempt
 */
export async function sendCallPostback(
  callId: string,
  retryAttempt: number = 0
): Promise<PostbackResult> {
  try {
    // Fetch call with affiliate info
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        affiliate: {
          select: {
            id: true,
            postbackUrl: true,
            postbackMethod: true,
            status: true
          }
        },
        campaign: {
          select: {
            id: true,
            name: true,
            serviceType: {
              select: { displayName: true }
            }
          }
        },
        trackingNumber: {
          select: {
            id: true,
            phoneNumber: true
          }
        }
      }
    });

    if (!call) {
      return { success: false, error: 'Call not found' };
    }

    if (!call.affiliate) {
      return { success: false, error: 'No affiliate associated with call' };
    }

    if (!call.affiliate.postbackUrl) {
      logger.info('No postback URL configured for affiliate', {
        callId,
        affiliateId: call.affiliate.id
      });
      return { success: true, error: 'No postback URL configured' };
    }

    if (call.affiliate.status !== 'ACTIVE') {
      return { success: false, error: 'Affiliate account not active' };
    }

    // Build postback payload
    const payload = buildCallPostbackPayload(call);

    // Send postback
    const result = await executePostback(
      call.affiliate.postbackUrl,
      call.affiliate.postbackMethod,
      payload
    );

    // Update call record
    await prisma.call.update({
      where: { id: callId },
      data: {
        postbackSent: result.success,
        postbackSentAt: result.success ? new Date() : undefined,
        postbackResponse: result.success
          ? result.responseBody?.slice(0, 1000)
          : result.error?.slice(0, 1000)
      }
    });

    // Log postback attempt
    await logPostbackAttempt(callId, call.affiliate.id, result, retryAttempt);

    // Schedule retry if failed and not exhausted retries
    if (!result.success && retryAttempt < MAX_RETRY_ATTEMPTS) {
      schedulePostbackRetry(callId, retryAttempt + 1);
      result.retryScheduled = true;
    }

    return result;
  } catch (error) {
    logger.error('Failed to send call postback', {
      callId,
      error: (error as Error).message
    });
    return {
      success: false,
      error: `Failed to send postback: ${(error as Error).message}`
    };
  }
}

/**
 * Build postback payload for a call
 *
 * WHY: Creates standardized payload with all relevant call data.
 * WHEN: Called before sending postback.
 * HOW: Extracts call data and formats for postback.
 */
function buildCallPostbackPayload(call: any): PostbackPayload {
  const callData: CallPostbackData = {
    id: call.id,
    callSid: call.twilioCallSid,
    campaignId: call.campaignId,
    campaignName: call.campaign?.name || null,
    serviceType: call.campaign?.serviceType?.displayName || null,
    trackingNumberId: call.trackingNumberId,
    trackingNumber: call.trackingNumber?.phoneNumber || null,
    callerZip: call.callerZip,
    callerState: call.callerState,
    status: call.status,
    isQualified: call.isQualified,
    isBillable: call.isBillable,
    duration: call.totalDurationSeconds,
    connectedDuration: call.connectedDurationSeconds,
    payout: call.affiliatePayout ? Number(call.affiliatePayout) : null,
    disposition: call.disposition,
    startedAt: call.createdAt.toISOString(),
    endedAt: call.endedAt?.toISOString() || null
  };

  return {
    event: call.isBillable ? 'call.qualified' : 'call.completed',
    timestamp: new Date().toISOString(),
    affiliateId: call.affiliateId,
    call: callData
  };
}

/**
 * Execute HTTP postback request
 *
 * WHY: Sends the actual HTTP request to affiliate's postback URL.
 * WHEN: Called by sendCallPostback.
 * HOW: Supports GET (query params) and POST (JSON body) methods.
 */
async function executePostback(
  url: string,
  method: string,
  payload: PostbackPayload
): Promise<PostbackResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), POSTBACK_TIMEOUT_MS);

    let requestUrl = url;
    const options: RequestInit = {
      method: method === 'GET' ? 'GET' : 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MyContractorNow-Postback/1.0'
      }
    };

    if (method === 'GET') {
      // For GET requests, append payload as query parameters
      const urlObj = new URL(url);
      appendPayloadToUrl(urlObj, payload);
      requestUrl = urlObj.toString();
    } else {
      // For POST requests, send as JSON body
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(requestUrl, options);
    clearTimeout(timeout);

    const responseBody = await response.text().catch(() => '');

    logger.info('Postback sent', {
      url: requestUrl.slice(0, 100),
      method,
      statusCode: response.status,
      success: response.ok
    });

    return {
      success: response.ok,
      statusCode: response.status,
      responseBody: responseBody.slice(0, 1000)
    };
  } catch (error) {
    const errorMessage = (error as Error).name === 'AbortError'
      ? 'Request timeout'
      : (error as Error).message;

    logger.error('Postback request failed', {
      url: url.slice(0, 100),
      error: errorMessage
    });

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Append payload data to URL as query parameters (for GET requests)
 *
 * WHY: Some tracking systems expect data as URL parameters.
 * WHEN: When postback method is GET.
 * HOW: Flattens nested payload and adds as query params.
 */
function appendPayloadToUrl(url: URL, payload: PostbackPayload): void {
  // Add top-level fields
  url.searchParams.set('event', payload.event);
  url.searchParams.set('timestamp', payload.timestamp);
  url.searchParams.set('affiliateId', payload.affiliateId);

  // Add call fields with prefix
  if (payload.call) {
    Object.entries(payload.call).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(`call_${key}`, String(value));
      }
    });
  }
}

/**
 * Log postback attempt to database
 *
 * WHY: Provides audit trail for debugging and compliance.
 * WHEN: After each postback attempt.
 * HOW: Creates call activity log entry.
 */
async function logPostbackAttempt(
  callId: string,
  affiliateId: string,
  result: PostbackResult,
  attempt: number
): Promise<void> {
  await prisma.callActivityLog.create({
    data: {
      callId,
      event: 'postback.sent',
      message: result.success
        ? `Postback sent successfully (attempt ${attempt + 1})`
        : `Postback failed: ${result.error} (attempt ${attempt + 1})`,
      level: result.success ? 'info' : 'warn',
      details: {
        success: result.success,
        statusCode: result.statusCode,
        attempt: attempt + 1,
        error: result.error,
        retryScheduled: result.retryScheduled
      },
      visibleToAffiliate: true,
      visibleToAdmin: true
    }
  });
}

/**
 * Schedule postback retry with exponential backoff
 *
 * WHY: Temporary failures shouldn't cause permanent loss of postbacks.
 * WHEN: When a postback fails and retries remain.
 * HOW: Schedules retry with increasing delay.
 */
function schedulePostbackRetry(callId: string, retryAttempt: number): void {
  const delay = RETRY_DELAYS_MS[retryAttempt - 1] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];

  logger.info('Scheduling postback retry', {
    callId,
    retryAttempt,
    delayMs: delay
  });

  // In production, use a job queue (Bull, Agenda, etc.)
  // For now, use setTimeout (works for single-instance deployments)
  setTimeout(() => {
    sendCallPostback(callId, retryAttempt).catch(error => {
      logger.error('Postback retry failed', {
        callId,
        retryAttempt,
        error: (error as Error).message
      });
    });
  }, delay);
}

/**
 * Test postback URL configuration
 *
 * WHY: Allows affiliates to verify their postback URL works.
 * WHEN: When affiliate sets up or updates their postback URL.
 * HOW: Sends test payload to the configured URL.
 */
export async function testPostbackUrl(
  affiliateId: string,
  postbackUrl: string,
  postbackMethod: string = 'POST'
): Promise<PostbackResult> {
  // Create test payload
  const testPayload: PostbackPayload = {
    event: 'call.completed',
    timestamp: new Date().toISOString(),
    affiliateId,
    call: {
      id: 'test_call_' + Date.now(),
      callSid: 'CA_TEST_' + Date.now(),
      campaignId: 'test_campaign',
      campaignName: 'Test Campaign',
      serviceType: 'Windows',
      trackingNumberId: 'test_tn',
      trackingNumber: '+18445550000',
      callerZip: '90210',
      callerState: 'CA',
      status: 'COMPLETED',
      isQualified: true,
      isBillable: true,
      duration: 180,
      connectedDuration: 120,
      payout: 30.00,
      disposition: 'ANSWERED',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString()
    }
  };

  logger.info('Testing postback URL', {
    affiliateId,
    url: postbackUrl.slice(0, 50)
  });

  return executePostback(postbackUrl, postbackMethod, testPayload);
}

/**
 * Get postback history for a call
 *
 * WHY: Shows affiliate the history of postback attempts for debugging.
 * WHEN: Displaying call details in affiliate portal.
 * HOW: Queries call activity logs for postback events.
 */
export async function getPostbackHistory(
  callId: string
): Promise<
  Array<{
    timestamp: Date;
    success: boolean;
    attempt: number;
    statusCode?: number;
    error?: string;
  }>
> {
  const logs = await prisma.callActivityLog.findMany({
    where: {
      callId,
      event: 'postback.sent'
    },
    orderBy: { timestamp: 'asc' },
    select: {
      timestamp: true,
      details: true
    }
  });

  return logs.map(log => {
    const details = log.details as any;
    return {
      timestamp: log.timestamp,
      success: details?.success || false,
      attempt: details?.attempt || 1,
      statusCode: details?.statusCode,
      error: details?.error
    };
  });
}

/**
 * Get affiliates with pending postback retries
 *
 * WHY: Admin visibility into postback health across affiliates.
 * WHEN: Admin monitoring dashboard.
 * HOW: Queries for calls with failed postbacks not yet successfully sent.
 */
export async function getPendingPostbackRetries(): Promise<
  Array<{
    affiliateId: string;
    affiliateName: string;
    pendingCount: number;
    oldestPending: Date | null;
  }>
> {
  const results = await prisma.call.groupBy({
    by: ['affiliateId'],
    where: {
      isBillable: true,
      postbackSent: false,
      affiliateId: { not: null },
      affiliate: {
        postbackUrl: { not: null }
      }
    },
    _count: { id: true },
    _min: { createdAt: true }
  });

  // Get affiliate names
  const affiliateIds = results
    .map(r => r.affiliateId)
    .filter((id): id is string => id !== null);

  const affiliates = await prisma.affiliate.findMany({
    where: { id: { in: affiliateIds } },
    select: { id: true, firstName: true, lastName: true }
  });

  const affiliateMap = new Map(
    affiliates.map(a => [a.id, `${a.firstName} ${a.lastName}`])
  );

  return results
    .filter(r => r.affiliateId !== null)
    .map(r => ({
      affiliateId: r.affiliateId!,
      affiliateName: affiliateMap.get(r.affiliateId!) || 'Unknown',
      pendingCount: r._count.id,
      oldestPending: r._min.createdAt
    }));
}
