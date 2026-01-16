/**
 * WHY: Twilio has rate limits (~100 req/sec). Burst traffic could cause failures.
 * WHEN: All outbound Twilio API calls.
 * HOW: Use Bottleneck for rate limiting with queue.
 */

import Bottleneck from 'bottleneck';
import { logger } from '@/lib/logger';

/**
 * Twilio allows ~100 requests/second, we limit to 50 for safety margin
 * Configuration:
 * - maxConcurrent: 50 concurrent requests
 * - minTime: 20ms between calls = 50/sec max sustained rate
 * - reservoir: 100 for initial burst capacity
 * - reservoirRefreshAmount: 100 refilled every second
 */
const twilioLimiter = new Bottleneck({
  maxConcurrent: 50,
  minTime: 20, // 20ms between calls = 50/sec max
  reservoir: 100, // Allow burst of 100
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 1000, // Refill every second
});

// Track queue status for monitoring
let lastQueueWarningTime = 0;
const QUEUE_WARNING_INTERVAL_MS = 10000; // Only warn every 10 seconds

/**
 * Log queue status periodically for monitoring
 */
twilioLimiter.on('depleted', () => {
  const now = Date.now();
  // Only log warning if we haven't warned recently
  if (now - lastQueueWarningTime > QUEUE_WARNING_INTERVAL_MS) {
    lastQueueWarningTime = now;
    logger.warn({
      event: 'twilio.rate_limit.depleted',
      message: 'Twilio rate limiter reservoir depleted',
      queued: twilioLimiter.counts().QUEUED,
      running: twilioLimiter.counts().RUNNING,
    });
  }
});

/**
 * Execute a Twilio API call with rate limiting
 * @param operation The async operation to execute
 * @returns Result of the operation
 */
export async function rateLimitedTwilioCall<T>(
  operation: () => Promise<T>
): Promise<T> {
  const counts = twilioLimiter.counts();

  // Warn if queue is getting deep
  if (counts.QUEUED > 50) {
    logger.warn({
      event: 'twilio.rate_limit.queue_high',
      message: 'Twilio rate limiter queue depth high',
      queueDepth: counts.QUEUED,
      running: counts.RUNNING,
    });
  }

  return twilioLimiter.schedule(operation);
}

/**
 * Rate limiter status interface
 */
export interface RateLimiterStatus {
  /** Number of jobs waiting in queue */
  queued: number;
  /** Number of jobs currently running */
  running: number;
  /** Current reservoir level (null if unlimited) */
  reservoir: number | null;
}

/**
 * Get current rate limiter status (for monitoring)
 * @returns Current queue status
 */
export async function getRateLimiterStatus(): Promise<RateLimiterStatus> {
  const counts = twilioLimiter.counts();
  const reservoir = await twilioLimiter.currentReservoir();
  return {
    queued: counts.QUEUED,
    running: counts.RUNNING,
    reservoir,
  };
}

/**
 * Check if rate limiter is under pressure
 * @returns true if queue depth is concerning
 */
export async function isRateLimiterUnderPressure(): Promise<boolean> {
  const status = await getRateLimiterStatus();
  return status.queued > 20 || (status.reservoir !== null && status.reservoir < 10);
}

/**
 * Wait for all pending Twilio operations to complete
 * Useful for graceful shutdown
 * @returns Promise that resolves when queue is empty
 */
export async function drainRateLimiter(): Promise<void> {
  // Wait for all jobs to complete
  let counts = twilioLimiter.counts();
  while (counts.QUEUED > 0 || counts.RUNNING > 0) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    counts = twilioLimiter.counts();
  }

  logger.info({
    event: 'twilio.rate_limit.drained',
    message: 'Twilio rate limiter queue drained',
  });
}

/**
 * Rate limiter statistics interface
 */
export interface RateLimiterStats {
  /** Total jobs received */
  received: number;
  /** Jobs waiting in queue */
  queued: number;
  /** Jobs currently running (in reservoir) */
  running: number;
  /** Jobs currently executing */
  executing: number;
  /** Jobs completed */
  done: number;
}

/**
 * Get rate limiter statistics for health checks
 * @returns Rate limiter statistics
 */
export function getRateLimiterStats(): RateLimiterStats {
  const counts = twilioLimiter.counts();
  return {
    received: counts.RECEIVED || 0,
    queued: counts.QUEUED || 0,
    running: counts.RUNNING || 0,
    executing: counts.EXECUTING || 0,
    done: counts.DONE || 0,
  };
}
