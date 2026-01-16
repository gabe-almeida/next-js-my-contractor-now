/**
 * Twilio Integration Module
 *
 * WHY: Centralized Twilio functionality for pay-per-call system.
 * WHEN: Import from '@/lib/twilio' for any Twilio operations.
 * HOW: Re-exports all Twilio-related functionality.
 */

// Core client
export { getTwilioClient, twilioClient, resetTwilioClient } from './client';

// Phone number operations
export {
  provisionPhoneNumber,
  releasePhoneNumber,
  updatePhoneNumberWebhooks,
  formatPhoneNumber,
  parsePhoneNumber,
} from './phone-numbers';
export type { ProvisionedNumber, ProvisionOptions } from './phone-numbers';

// TwiML builders
export {
  buildIvrGather,
  buildTransfer,
  buildHoldMusic,
  buildRejection,
  buildCascadeTransfer,
  buildAnnouncement,
  buildPause,
  buildEmptyResponse,
  // New hold experience functions
  buildAuctionHold,
  buildOptimizedHold,
  buildExtendedHold,
  // Hold music options for admin config
  HOLD_MUSIC_OPTIONS,
} from './twiml-builder';
export type {
  IvrGatherOptions,
  TransferOptions,
  HoldMusicOptions,
  RejectionOptions,
  CascadeTransferOptions,
  AnnouncementOptions,
  // New hold experience types
  AuctionHoldOptions,
  OptimizedHoldOptions,
  LongHoldOptions,
} from './twiml-builder';

// Webhook verification
export {
  verifyTwilioSignature,
  parseTwilioFormData,
  buildVerificationUrl,
  verifyWebhook,
  withTwilioVerification,
  createTwimlResponse,
  createWebhookErrorResponse,
} from './verify-signature';
export type { VerificationResult } from './verify-signature';

// Idempotency
export {
  isWebhookProcessed,
  markWebhookProcessed,
  markWebhookFailed,
  deleteWebhookEvent,
  getWebhookEvent,
  cleanupExpiredWebhookEvents,
} from './idempotency';

// State machine
export {
  canTransition,
  validateTransition,
  isTerminalStatus,
  isValidStatus,
  getValidNextStates,
  mapTwilioStatus,
  mapDialStatus,
  getStatusDescription,
  isBillableStatus,
  isActiveStatus,
  InvalidStateTransitionError,
} from './state-machine';
export type { CallStatus, TwilioStatusContext } from './state-machine';

// Rate limiting
export {
  rateLimitedTwilioCall,
  getRateLimiterStatus,
  isRateLimiterUnderPressure,
  drainRateLimiter,
  getRateLimiterStats,
} from './rate-limiter';
export type { RateLimiterStatus, RateLimiterStats } from './rate-limiter';

// Circuit breaker
export {
  withCircuitBreaker,
  getCircuitBreakerStatus,
  getCircuitBreakerStats,
  isCircuitOpen,
  isCircuitHealthy,
  resetCircuitBreaker,
  getCircuitBreakerHealthCheck,
} from './circuit-breaker';
export type { CircuitBreakerStatus } from './circuit-breaker';

// Retry logic
export {
  retryWithBackoff,
  createRetryFunction,
  TWILIO_API_RETRY_OPTIONS,
  PROVISIONING_RETRY_OPTIONS,
  RECORDING_RETRY_OPTIONS,
} from './retry';
export type { RetryOptions } from './retry';

// Logging
export {
  logWebhookReceived,
  logTwilioApiCall,
  logTwimlGenerated,
  storeWebhookPayload,
  logCallStateChange,
  logAuctionEvent,
  logBillingEvent,
  logRecordingEvent,
  logCircuitBreakerStateChange,
  logRateLimiterStatus,
  createCallActivityLog,
} from './logging';
export type {
  WebhookLogEntry,
  ApiCallLogParams,
  TwimlLogParams,
} from './logging';
