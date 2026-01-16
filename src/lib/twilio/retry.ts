/**
 * WHY: Transient Twilio errors shouldn't fail the call.
 * WHEN: API calls that can safely retry (not webhooks).
 * HOW: Exponential backoff with jitter.
 */

import { logger } from '@/lib/logger';

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Custom function to determine if error should be retried */
  shouldRetry?: (error: unknown) => boolean;
  /** Operation name for logging */
  operationName?: string;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'operationName'>> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  shouldRetry: defaultShouldRetry,
};

/**
 * Default function to determine if an error should be retried
 * @param error The error that occurred
 * @returns true if the operation should be retried
 */
function defaultShouldRetry(error: unknown): boolean {
  // Don't retry if it's not an error object
  if (!error || typeof error !== 'object') {
    return true;
  }

  // Check for HTTP status codes
  const status = (error as { status?: number }).status;
  if (status !== undefined) {
    // Don't retry client errors (4xx) - these are permanent failures
    if (status >= 400 && status < 500) {
      return false;
    }
    // Retry server errors (5xx) and network errors
    return true;
  }

  // Check for Twilio error codes
  const code = (error as { code?: number | string }).code;
  if (code !== undefined) {
    // Don't retry Twilio client errors (20xxx range)
    if (typeof code === 'number' && code >= 20000 && code < 21000) {
      return false;
    }
  }

  // Default to retrying unknown errors
  return true;
}

/**
 * Sleep for a specified duration
 * @param ms Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 * @param attempt Current attempt number (0-indexed)
 * @param initialDelay Initial delay in ms
 * @param maxDelay Maximum delay in ms
 * @returns Delay in milliseconds
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number
): number {
  // Exponential backoff: initialDelay * 2^attempt
  const exponentialDelay = initialDelay * Math.pow(2, attempt);

  // Add jitter (0-1000ms) to prevent thundering herd
  const jitter = Math.random() * 1000;

  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Execute operation with exponential backoff retry
 * @param operation The async operation to execute
 * @param options Retry configuration options
 * @returns Result of the operation
 * @throws Last error if all retries fail
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (!opts.shouldRetry(error)) {
        logger.debug({
          event: 'twilio.retry.not_retryable',
          message: `Error is not retryable`,
          operationName: opts.operationName,
          attempt,
          error: lastError.message,
        });
        throw error;
      }

      // Check if we have retries left
      if (attempt < opts.maxRetries) {
        // Calculate delay with exponential backoff and jitter
        const delay = calculateDelay(
          attempt,
          opts.initialDelay,
          opts.maxDelay
        );

        logger.warn({
          event: 'twilio.retry',
          message: `Operation failed, retrying in ${Math.round(delay)}ms`,
          operationName: opts.operationName,
          attempt: attempt + 1,
          maxRetries: opts.maxRetries,
          delay,
          error: lastError.message,
        });

        await sleep(delay);
      } else {
        logger.error({
          event: 'twilio.retry.exhausted',
          message: 'All retry attempts exhausted',
          operationName: opts.operationName,
          totalAttempts: attempt + 1,
          error: lastError.message,
        });
      }
    }
  }

  throw lastError;
}

/**
 * Retry options preset for Twilio API calls
 * More aggressive retries for API calls
 */
export const TWILIO_API_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  shouldRetry: defaultShouldRetry,
};

/**
 * Retry options preset for phone number provisioning
 * More patient retries since provisioning can take time
 */
export const PROVISIONING_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 2000, // Start with 2 seconds
  maxDelay: 15000, // Up to 15 seconds
  shouldRetry: defaultShouldRetry,
};

/**
 * Retry options preset for recording downloads
 * Quick retries since we need the recording fast
 */
export const RECORDING_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 5, // More retries for recordings
  initialDelay: 500, // Start with 500ms
  maxDelay: 5000, // Up to 5 seconds
  shouldRetry: defaultShouldRetry,
};

/**
 * Create a custom retry function with preset options
 * @param baseOptions Base retry options to use
 * @returns Retry function with preset options
 */
export function createRetryFunction(
  baseOptions: RetryOptions
): <T>(operation: () => Promise<T>, overrides?: RetryOptions) => Promise<T> {
  return <T>(
    operation: () => Promise<T>,
    overrides: RetryOptions = {}
  ): Promise<T> => {
    return retryWithBackoff(operation, { ...baseOptions, ...overrides });
  };
}
