/**
 * WHY: Every webhook event MUST be logged for debugging and compliance.
 * WHEN: Called at start of every webhook handler.
 * HOW: Log to structured logger AND store in database.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';
import type { Prisma } from '@prisma/client';

/**
 * Webhook log entry structure
 */
export interface WebhookLogEntry {
  callSid: string;
  eventType: string;
  eventStatus?: string;
  payload: Record<string, unknown>;
  source:
    | 'incoming'
    | 'ivr'
    | 'transfer'
    | 'completed'
    | 'recording'
    | 'status'
    | 'cascade';
}

/**
 * Log incoming webhook to structured logs
 * @param entry Webhook log entry details
 */
export function logWebhookReceived(entry: WebhookLogEntry): void {
  logger.info({
    event: 'twilio.webhook.received',
    message: `Webhook received: ${entry.eventType}`,
    callSid: entry.callSid,
    eventType: entry.eventType,
    eventStatus: entry.eventStatus,
    source: entry.source,
    timestamp: new Date().toISOString(),
  });

  // Add Sentry breadcrumb for debugging
  Sentry.addBreadcrumb({
    category: 'twilio.webhook',
    message: `${entry.source}: ${entry.eventType}`,
    level: 'info',
    data: {
      callSid: entry.callSid,
      eventStatus: entry.eventStatus,
    },
  });
}

/**
 * Parameters for API call logging
 */
export interface ApiCallLogParams {
  operation: string;
  success: boolean;
  duration?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Log Twilio API call
 * @param params API call logging parameters
 */
export function logTwilioApiCall(params: ApiCallLogParams): void {
  const level = params.success ? 'info' : 'error';

  logger[level]({
    event: `twilio.api.${params.operation}`,
    message: `Twilio API: ${params.operation} - ${params.success ? 'success' : 'failed'}`,
    success: params.success,
    duration: params.duration,
    error: params.error,
    ...params.details,
  });

  // Add breadcrumb for debugging
  if (!params.success) {
    Sentry.addBreadcrumb({
      category: 'twilio.api',
      message: `API ${params.operation} failed`,
      level: 'error',
      data: { error: params.error, duration: params.duration },
    });
  }
}

/**
 * Parameters for TwiML generation logging
 */
export interface TwimlLogParams {
  callId?: string;
  callSid?: string;
  twimlType: string;
  twiml: string;
}

/**
 * Log TwiML response generated
 * @param params TwiML logging parameters
 */
export function logTwimlGenerated(params: TwimlLogParams): void {
  logger.debug({
    event: 'twilio.twiml.generated',
    message: `TwiML generated: ${params.twimlType}`,
    callId: params.callId,
    callSid: params.callSid,
    twimlType: params.twimlType,
    // Only log first 500 chars of TwiML to avoid bloat
    twimlPreview: params.twiml.substring(0, 500),
  });
}

/**
 * Store webhook payload in database for debugging
 * @param eventKey The unique event key for the webhook
 * @param payload The webhook payload to store
 */
export async function storeWebhookPayload(
  eventKey: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.webhookEvent.update({
      where: { eventKey },
      data: {
        payload: payload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    // Don't fail if we can't store payload - log and continue
    logger.warn({
      event: 'twilio.webhook.payload_store_failed',
      message: 'Failed to store webhook payload',
      eventKey,
      error: (error as Error).message,
    });
  }
}

/**
 * Log call state change
 * @param callId Our internal call ID
 * @param callSid Twilio call SID
 * @param fromStatus Previous status
 * @param toStatus New status
 * @param reason Optional reason for change
 */
export function logCallStateChange(
  callId: string,
  callSid: string,
  fromStatus: string,
  toStatus: string,
  reason?: string
): void {
  logger.info({
    event: 'call.state_change',
    message: `Call ${callSid}: ${fromStatus} -> ${toStatus}`,
    callId,
    callSid,
    fromStatus,
    toStatus,
    reason,
    timestamp: new Date().toISOString(),
  });

  Sentry.addBreadcrumb({
    category: 'call.state',
    message: `${fromStatus} -> ${toStatus}`,
    level: 'info',
    data: { callId, callSid, reason },
  });
}

/**
 * Log auction event
 * @param callId Our internal call ID
 * @param callSid Twilio call SID
 * @param event Auction event type
 * @param details Event details
 */
export function logAuctionEvent(
  callId: string,
  callSid: string,
  event: string,
  details?: Record<string, unknown>
): void {
  logger.info({
    event: `auction.${event}`,
    message: `Auction ${event} for call ${callSid}`,
    callId,
    callSid,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log billing event
 * @param callId Our internal call ID
 * @param event Billing event type
 * @param amount Amount in dollars
 * @param details Additional details
 */
export function logBillingEvent(
  callId: string,
  event: string,
  amount: number,
  details?: Record<string, unknown>
): void {
  logger.info({
    event: `billing.${event}`,
    message: `Billing ${event}: $${amount.toFixed(2)}`,
    callId,
    amount,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log recording event
 * @param callId Our internal call ID
 * @param callSid Twilio call SID
 * @param event Recording event type
 * @param details Event details
 */
export function logRecordingEvent(
  callId: string,
  callSid: string,
  event: string,
  details?: Record<string, unknown>
): void {
  logger.info({
    event: `recording.${event}`,
    message: `Recording ${event} for call ${callSid}`,
    callId,
    callSid,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log circuit breaker state change
 * @param state New circuit breaker state
 * @param stats Circuit breaker statistics
 */
export function logCircuitBreakerStateChange(
  state: 'open' | 'closed' | 'halfOpen',
  stats?: Record<string, unknown>
): void {
  const level = state === 'open' ? 'error' : state === 'halfOpen' ? 'warn' : 'info';

  logger[level]({
    event: `twilio.circuit.${state}`,
    message: `Twilio circuit breaker is now ${state}`,
    state,
    ...stats,
    timestamp: new Date().toISOString(),
  });

  Sentry.addBreadcrumb({
    category: 'twilio.circuit',
    message: `Circuit breaker: ${state}`,
    level: level === 'error' ? 'error' : level === 'warn' ? 'warning' : 'info',
    data: stats,
  });
}

/**
 * Log rate limiter status
 * @param queued Number of queued operations
 * @param running Number of running operations
 * @param reservoir Current reservoir level
 */
export function logRateLimiterStatus(
  queued: number,
  running: number,
  reservoir: number | null
): void {
  // Only log if queue is building up
  if (queued > 10) {
    logger.warn({
      event: 'twilio.rate_limit.status',
      message: `Rate limiter queue depth: ${queued}`,
      queued,
      running,
      reservoir,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Create a call activity log entry in the database
 * @param callId Our internal call ID
 * @param event Event type
 * @param message Human-readable message
 * @param options Additional options
 */
export async function createCallActivityLog(
  callId: string,
  event: string,
  message: string,
  options?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    details?: Record<string, unknown>;
    visibleToAffiliate?: boolean;
    visibleToAdmin?: boolean;
  }
): Promise<void> {
  try {
    await prisma.callActivityLog.create({
      data: {
        callId,
        event,
        message,
        level: options?.level || 'info',
        details: (options?.details as Prisma.InputJsonValue) || undefined,
        visibleToAffiliate: options?.visibleToAffiliate ?? false,
        visibleToAdmin: options?.visibleToAdmin ?? true,
      },
    });
  } catch (error) {
    // Don't fail on logging errors
    logger.warn({
      event: 'call_activity_log.create_failed',
      message: 'Failed to create call activity log',
      callId,
      error: (error as Error).message,
    });
  }
}
