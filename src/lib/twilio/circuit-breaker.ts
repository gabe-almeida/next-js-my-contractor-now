/**
 * WHY: If Twilio is down, we shouldn't keep hammering them.
 * WHEN: Wraps all Twilio API calls.
 * HOW: Track failures, open circuit after threshold, auto-reset after cooldown.
 */

import CircuitBreaker from 'opossum';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

/**
 * Generic async operation type
 */
type AsyncOperation<T> = () => Promise<T>;

/**
 * Circuit breaker configuration
 * - timeout: 10s timeout for Twilio calls
 * - errorThresholdPercentage: Open if 50% of requests fail
 * - resetTimeout: Try again after 30 seconds
 * - volumeThreshold: Need 5 requests before circuit can open
 */
const twilioCircuitBreaker = new CircuitBreaker(
  async <T>(operation: AsyncOperation<T>): Promise<T> => operation(),
  {
    timeout: 10000, // 10s timeout for Twilio calls
    errorThresholdPercentage: 50, // Open if 50% fail
    resetTimeout: 30000, // Try again after 30s
    volumeThreshold: 5, // Need 5 requests before opening
  }
);

/**
 * Track circuit breaker state for alerting
 */
let circuitState: 'closed' | 'open' | 'halfOpen' = 'closed';
let lastStateChange = Date.now();

/**
 * Event handler for circuit breaker opening
 */
twilioCircuitBreaker.on('open', () => {
  circuitState = 'open';
  lastStateChange = Date.now();

  logger.error({
    event: 'twilio.circuit.open',
    message: 'Twilio circuit breaker OPENED - Twilio may be down',
    stats: getCircuitBreakerStats(),
  });

  Sentry.captureMessage('Twilio circuit breaker opened', {
    level: 'error',
    tags: { component: 'twilio-circuit-breaker' },
    extra: getCircuitBreakerStats(),
  });

  // TODO: Add alerting integration (Slack, PagerDuty, etc.)
  // This could call an alerting service or send a webhook
});

/**
 * Event handler for circuit breaker entering half-open state
 */
twilioCircuitBreaker.on('halfOpen', () => {
  circuitState = 'halfOpen';
  lastStateChange = Date.now();

  logger.warn({
    event: 'twilio.circuit.half_open',
    message: 'Twilio circuit breaker testing recovery',
    stats: getCircuitBreakerStats(),
  });
});

/**
 * Event handler for circuit breaker closing (recovery)
 */
twilioCircuitBreaker.on('close', () => {
  circuitState = 'closed';
  lastStateChange = Date.now();

  logger.info({
    event: 'twilio.circuit.close',
    message: 'Twilio circuit breaker CLOSED - Twilio recovered',
    stats: getCircuitBreakerStats(),
  });

  Sentry.captureMessage('Twilio circuit breaker recovered', {
    level: 'info',
    tags: { component: 'twilio-circuit-breaker' },
  });
});

/**
 * Event handler for fallback execution
 */
twilioCircuitBreaker.on('fallback', () => {
  logger.warn({
    event: 'twilio.circuit.fallback',
    message: 'Twilio circuit breaker fallback triggered',
  });
});

/**
 * Event handler for rejected calls (when circuit is open)
 */
twilioCircuitBreaker.on('reject', () => {
  logger.warn({
    event: 'twilio.circuit.rejected',
    message: 'Twilio operation rejected - circuit is open',
  });
});

/**
 * Event handler for timeouts
 */
twilioCircuitBreaker.on('timeout', () => {
  logger.warn({
    event: 'twilio.circuit.timeout',
    message: 'Twilio operation timed out',
  });
});

/**
 * Execute operation with circuit breaker protection
 * @param operation The async operation to execute
 * @returns Result of the operation
 * @throws Error if circuit is open or operation fails
 */
export async function withCircuitBreaker<T>(
  operation: AsyncOperation<T>
): Promise<T> {
  return twilioCircuitBreaker.fire(operation) as Promise<T>;
}

/**
 * Circuit breaker status interface
 */
export interface CircuitBreakerStatus {
  /** Current state of the circuit breaker */
  state: 'closed' | 'open' | 'halfOpen';
  /** Basic statistics */
  stats: {
    successes: number;
    failures: number;
    fallbacks: number;
    rejects: number;
    timeouts: number;
  };
  /** Time in current state (ms) */
  timeInState: number;
}

/**
 * Get circuit breaker status (for monitoring)
 * @returns Current circuit breaker status
 */
export function getCircuitBreakerStatus(): CircuitBreakerStatus {
  return {
    state: circuitState,
    stats: {
      successes: twilioCircuitBreaker.stats.successes,
      failures: twilioCircuitBreaker.stats.failures,
      fallbacks: twilioCircuitBreaker.stats.fallbacks,
      rejects: twilioCircuitBreaker.stats.rejects,
      timeouts: twilioCircuitBreaker.stats.timeouts,
    },
    timeInState: Date.now() - lastStateChange,
  };
}

/**
 * Get detailed circuit breaker statistics
 * @returns Detailed statistics object
 */
export function getCircuitBreakerStats(): Record<string, unknown> {
  const stats = twilioCircuitBreaker.stats;
  return {
    state: circuitState,
    successes: stats.successes,
    failures: stats.failures,
    fallbacks: stats.fallbacks,
    rejects: stats.rejects,
    timeouts: stats.timeouts,
    cacheHits: stats.cacheHits,
    cacheMisses: stats.cacheMisses,
    fires: stats.fires,
  };
}

/**
 * Check if circuit is open (for early rejection)
 * @returns true if circuit is open and rejecting requests
 */
export function isCircuitOpen(): boolean {
  return circuitState === 'open';
}

/**
 * Check if circuit is healthy (closed)
 * @returns true if circuit is closed and accepting requests normally
 */
export function isCircuitHealthy(): boolean {
  return circuitState === 'closed';
}

/**
 * Manually reset the circuit breaker (use with caution)
 * This forces the circuit to close, useful for recovery after fixing issues
 */
export function resetCircuitBreaker(): void {
  // Close the circuit breaker by toggling enabled state
  twilioCircuitBreaker.close();
  circuitState = 'closed';
  lastStateChange = Date.now();

  logger.info({
    event: 'twilio.circuit.manual_reset',
    message: 'Twilio circuit breaker manually reset',
  });
}

/**
 * Get health check info for the circuit breaker
 * @returns Health check status
 */
export function getCircuitBreakerHealthCheck(): {
  healthy: boolean;
  state: string;
  message: string;
} {
  const status = getCircuitBreakerStatus();

  if (status.state === 'open') {
    return {
      healthy: false,
      state: status.state,
      message: `Circuit open for ${Math.round(status.timeInState / 1000)}s - Twilio may be unavailable`,
    };
  }

  if (status.state === 'halfOpen') {
    return {
      healthy: true,
      state: status.state,
      message: 'Circuit testing recovery',
    };
  }

  return {
    healthy: true,
    state: status.state,
    message: 'Circuit closed - operating normally',
  };
}
