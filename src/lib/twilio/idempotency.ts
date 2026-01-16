/**
 * WHY: Twilio retries webhooks on timeouts. We MUST NOT process same event twice.
 * WHEN: Check at START of every webhook handler.
 * HOW: Use WebhookEvent table with unique constraint on event_key.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

/**
 * Check if webhook was already processed, mark as processing if not
 * @param eventType Type of webhook event (e.g., 'call_incoming', 'call_completed')
 * @param callSid Twilio Call SID
 * @param eventStatus Optional status qualifier (e.g., 'completed', 'in-progress')
 * @returns true if already processed (skip processing), false if newly claimed
 */
export async function isWebhookProcessed(
  eventType: string,
  callSid: string,
  eventStatus?: string
): Promise<boolean> {
  const eventKey = buildEventKey(eventType, callSid, eventStatus);

  try {
    // Attempt to insert - if exists, it will throw unique constraint error
    await prisma.webhookEvent.create({
      data: {
        eventType,
        externalId: callSid,
        eventKey,
        processedAt: new Date(),
        processingResult: 'PROCESSING',
      },
    });

    logger.debug({
      event: 'webhook.claimed',
      message: 'Webhook claimed for processing',
      eventKey,
    });

    return false; // Not processed, we just claimed it
  } catch (error: unknown) {
    // Check for Prisma unique constraint violation (P2002)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      // Unique constraint violation - already processed
      logger.info({
        event: 'webhook.duplicate',
        message: 'Duplicate webhook detected, skipping',
        eventKey,
      });
      return true;
    }
    throw error;
  }
}

/**
 * Mark webhook as successfully processed
 * @param callSid Twilio Call SID
 * @param eventType Type of webhook event
 * @param eventStatus Optional status qualifier
 * @param payload Optional payload to store for debugging
 */
export async function markWebhookProcessed(
  callSid: string,
  eventType: string,
  eventStatus?: string,
  payload?: Record<string, unknown>
): Promise<void> {
  const eventKey = buildEventKey(eventType, callSid, eventStatus);

  try {
    await prisma.webhookEvent.update({
      where: { eventKey },
      data: {
        processingResult: 'SUCCESS',
        payload: payload as Prisma.InputJsonValue | undefined,
      },
    });

    logger.debug({
      event: 'webhook.processed',
      message: 'Webhook marked as processed',
      eventKey,
    });
  } catch (error) {
    // Log but don't fail - the webhook was already processed
    logger.warn({
      event: 'webhook.mark_processed_failed',
      message: 'Failed to mark webhook as processed',
      eventKey,
      error: (error as Error).message,
    });
  }
}

/**
 * Mark webhook as failed (allows retry on next webhook delivery)
 * @param callSid Twilio Call SID
 * @param eventType Type of webhook event
 * @param eventStatus Optional status qualifier
 * @param errorMessage Error message to store
 */
export async function markWebhookFailed(
  callSid: string,
  eventType: string,
  eventStatus?: string,
  errorMessage?: string
): Promise<void> {
  const eventKey = buildEventKey(eventType, callSid, eventStatus);

  try {
    await prisma.webhookEvent.update({
      where: { eventKey },
      data: {
        processingResult: 'FAILED',
        errorMessage,
      },
    });

    logger.warn({
      event: 'webhook.failed',
      message: 'Webhook marked as failed',
      eventKey,
      errorMessage,
    });
  } catch (error) {
    // If we can't find it, it might have been cleaned up - log and continue
    logger.warn({
      event: 'webhook.mark_failed_error',
      message: 'Failed to mark webhook as failed',
      eventKey,
      error: (error as Error).message,
    });
  }
}

/**
 * Delete a webhook event (allows reprocessing)
 * Use with caution - only for recovery scenarios
 * @param callSid Twilio Call SID
 * @param eventType Type of webhook event
 * @param eventStatus Optional status qualifier
 */
export async function deleteWebhookEvent(
  callSid: string,
  eventType: string,
  eventStatus?: string
): Promise<void> {
  const eventKey = buildEventKey(eventType, callSid, eventStatus);

  try {
    await prisma.webhookEvent.delete({
      where: { eventKey },
    });

    logger.info({
      event: 'webhook.deleted',
      message: 'Webhook event deleted for reprocessing',
      eventKey,
    });
  } catch (error) {
    // Record not found is OK
    logger.debug({
      event: 'webhook.delete_not_found',
      message: 'Webhook event not found for deletion',
      eventKey,
    });
  }
}

/**
 * Get webhook event status
 * @param callSid Twilio Call SID
 * @param eventType Type of webhook event
 * @param eventStatus Optional status qualifier
 * @returns Webhook event record or null
 */
export async function getWebhookEvent(
  callSid: string,
  eventType: string,
  eventStatus?: string
) {
  const eventKey = buildEventKey(eventType, callSid, eventStatus);

  return prisma.webhookEvent.findUnique({
    where: { eventKey },
  });
}

/**
 * Build a unique event key for idempotency tracking
 * @param eventType Type of webhook event
 * @param callSid Twilio Call SID
 * @param eventStatus Optional status qualifier
 * @returns Unique event key string
 */
function buildEventKey(
  eventType: string,
  callSid: string,
  eventStatus?: string
): string {
  return `${eventType}:${callSid}:${eventStatus || 'default'}`;
}

/**
 * Clean up expired webhook events (call from cron job)
 * @param olderThanDays Delete events older than this many days (default 7)
 * @returns Number of deleted records
 */
export async function cleanupExpiredWebhookEvents(
  olderThanDays: number = 7
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await prisma.webhookEvent.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  logger.info({
    event: 'webhook.cleanup',
    message: `Cleaned up ${result.count} expired webhook events`,
    count: result.count,
  });

  return result.count;
}
