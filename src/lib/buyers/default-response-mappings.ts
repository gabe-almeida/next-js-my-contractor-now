/**
 * Default Response Mappings
 *
 * WHY: Most buyers use common terminology. Pre-populated defaults handle 80%+ of cases
 * without requiring admin configuration, reducing onboarding friction.
 *
 * WHEN: Used when a buyer has no custom response mapping configured, or as a starting
 * point when admins create custom mappings.
 *
 * HOW: BuyerResponseParser checks for custom config first, falls back to these defaults.
 * Admin UI pre-populates with these values for easy customization.
 */

import {
  ResponseMappingConfig,
  PingStatusMappings,
  PostStatusMappings,
  HttpStatusCodeMapping,
} from '@/types/response-mapping';

/**
 * Default PING status mappings
 * Covers common variations across different lead networks
 */
export const DEFAULT_PING_MAPPINGS: PingStatusMappings = {
  accepted: [
    // Standard terms
    'accepted',
    'accept',
    'accepted_bid',
    // Interest indicators
    'interested',
    'interest',
    'bid',
    'bid_submitted',
    'bidding',
    // Affirmative responses
    'yes',
    'true',
    'ok',
    'okay',
    // Qualification terms
    'qualified',
    'eligible',
    'approved',
    'ready',
    // Success indicators
    'success',
    'successful',
    // Numeric string representations
    '1',
  ],
  rejected: [
    // Standard terms
    'rejected',
    'reject',
    'declined',
    'decline',
    // Pass/skip terms
    'pass',
    'passed',
    'skip',
    'skipped',
    'no_bid',
    'nobid',
    // Negative responses
    'not_interested',
    'not interested',
    'no',
    'false',
    'deny',
    'denied',
    // Qualification failures
    'unqualified',
    'ineligible',
    'not_qualified',
    'disqualified',
    // Capacity terms
    'full',
    'at_capacity',
    'over_capacity',
    'capped',
    // Numeric string representations
    '0',
  ],
  error: [
    // Error terms
    'error',
    'err',
    'failure',
    'failed',
    // Timeout terms
    'timeout',
    'timed_out',
    'timedout',
    // Invalid terms
    'invalid',
    'invalid_request',
    'bad_request',
    'malformed',
    // Availability terms
    'unavailable',
    'service_unavailable',
    'service_error',
    'server_error',
    // Exception terms
    'exception',
    'internal_error',
  ],
};

/**
 * Default POST status mappings
 * Covers common variations for delivery confirmations
 */
export const DEFAULT_POST_MAPPINGS: PostStatusMappings = {
  delivered: [
    // Delivery terms
    'delivered',
    'deliver',
    'delivery_success',
    // Sale terms
    'sold',
    'sale',
    'purchased',
    // Success terms
    'success',
    'successful',
    'accepted',
    'accept',
    // Completion terms
    'complete',
    'completed',
    'done',
    'finished',
    // Confirmation terms
    'confirmed',
    'confirmation',
    'received',
    // Active terms
    'active',
    'activated',
    // Numeric representations
    '1',
    'true',
  ],
  failed: [
    // Failure terms
    'failed',
    'failure',
    'fail',
    // Rejection terms
    'rejected',
    'reject',
    'declined',
    'decline',
    'denied',
    'deny',
    // Error terms
    'error',
    'err',
    // Cancellation terms
    'cancelled',
    'canceled',
    'cancel',
    // Refusal terms
    'refused',
    'not_accepted',
    'not accepted',
    // Numeric representations
    '0',
    'false',
  ],
  duplicate: [
    // Duplicate terms
    'duplicate',
    'duplicated',
    'dup',
    'dupe',
    // Existence terms
    'exists',
    'existing',
    'already_exists',
    'already exists',
    // Prior sale terms
    'already_sold',
    'already sold',
    'previously_sold',
    'prior_sale',
    // Repeat terms
    'repeat',
    'repeated',
    'seen',
    'known',
  ],
  invalid: [
    // Invalid terms
    'invalid',
    'invalid_data',
    'invalid_lead',
    // Data quality terms
    'bad_data',
    'bad data',
    'malformed',
    'corrupt',
    'corrupted',
    // Validation terms
    'validation_error',
    'validation_failed',
    'failed_validation',
    // Incomplete terms
    'incomplete',
    'missing_data',
    'missing data',
    'missing_required',
    // Unprocessable terms
    'unprocessable',
    'unprocessable_entity',
    'bad_request',
  ],
};

/**
 * Default bid amount field names
 * Priority-ordered list of fields to check for bid amount
 */
export const DEFAULT_BID_AMOUNT_FIELDS: string[] = [
  // Camel case variations
  'bidAmount',
  'bidPrice',
  'bid',
  // Snake case variations
  'bid_amount',
  'bid_price',
  // Price/cost terms
  'price',
  'cost',
  'lead_price',
  'lead_cost',
  // Offer terms
  'offer',
  'offerAmount',
  'offer_amount',
  // Amount/value terms
  'amount',
  'value',
  'leadValue',
  'lead_value',
  // Quote terms
  'quote',
  'quotedPrice',
  'quoted_price',
  // Payout terms
  'payout',
  'payment',
  'rate',
  // Nested common patterns (dot notation)
  'data.bid',
  'data.bidAmount',
  'result.bid',
  'result.price',
  'response.bid',
];

/**
 * Default HTTP status code mappings
 */
export const DEFAULT_HTTP_STATUS_MAPPING: HttpStatusCodeMapping = {
  // Success codes
  200: 'success',
  201: 'success',
  202: 'success',
  204: 'success',

  // Client errors - treat as rejections
  400: 'reject', // Bad Request
  401: 'error', // Unauthorized (config issue)
  403: 'reject', // Forbidden
  404: 'reject', // Not Found
  405: 'error', // Method Not Allowed (config issue)
  409: 'reject', // Conflict (often duplicate)
  410: 'reject', // Gone
  422: 'reject', // Unprocessable Entity

  // Rate limiting - retry
  429: 'retry', // Too Many Requests

  // Server errors - error/retry
  500: 'error', // Internal Server Error
  501: 'error', // Not Implemented
  502: 'retry', // Bad Gateway
  503: 'retry', // Service Unavailable
  504: 'retry', // Gateway Timeout
};

/**
 * Common reason/message field names to check
 */
export const DEFAULT_REASON_FIELDS: string[] = [
  'reason',
  'message',
  'error',
  'errorMessage',
  'error_message',
  'details',
  'description',
  'rejection_reason',
  'rejectionReason',
  'failure_reason',
  'failureReason',
  'info',
  'statusMessage',
  'status_message',
];

/**
 * Common buyer lead ID field names to check
 */
export const DEFAULT_BUYER_LEAD_ID_FIELDS: string[] = [
  'buyerLeadId',
  'buyer_lead_id',
  'leadId',
  'lead_id',
  'id',
  'referenceId',
  'reference_id',
  'transactionId',
  'transaction_id',
  'confirmationId',
  'confirmation_id',
  'externalId',
  'external_id',
];

/**
 * Complete default response mapping configuration
 */
export const DEFAULT_RESPONSE_MAPPING_CONFIG: ResponseMappingConfig = {
  statusField: 'status',
  pingMappings: DEFAULT_PING_MAPPINGS,
  postMappings: DEFAULT_POST_MAPPINGS,
  bidAmountFields: DEFAULT_BID_AMOUNT_FIELDS,
  httpStatusMapping: DEFAULT_HTTP_STATUS_MAPPING,
  interestIndicators: {
    acceptanceFields: ['interested', 'accept', 'approved', 'qualified'],
    rejectionFields: ['rejected', 'declined', 'denied', 'disqualified'],
  },
};

/**
 * Get default config with optional overrides
 */
export function getDefaultConfig(
  overrides?: Partial<ResponseMappingConfig>
): ResponseMappingConfig {
  if (!overrides) {
    return { ...DEFAULT_RESPONSE_MAPPING_CONFIG };
  }

  return {
    ...DEFAULT_RESPONSE_MAPPING_CONFIG,
    ...overrides,
    pingMappings: {
      ...DEFAULT_RESPONSE_MAPPING_CONFIG.pingMappings,
      ...overrides.pingMappings,
    },
    postMappings: {
      ...DEFAULT_RESPONSE_MAPPING_CONFIG.postMappings,
      ...overrides.postMappings,
    },
    httpStatusMapping: {
      ...DEFAULT_RESPONSE_MAPPING_CONFIG.httpStatusMapping,
      ...overrides.httpStatusMapping,
    },
  };
}

/**
 * Merge custom config with defaults
 * Custom values take precedence, but defaults fill gaps
 */
export function mergeWithDefaults(
  custom: Partial<ResponseMappingConfig> | null | undefined
): ResponseMappingConfig {
  if (!custom) {
    return { ...DEFAULT_RESPONSE_MAPPING_CONFIG };
  }

  return {
    statusField: custom.statusField || DEFAULT_RESPONSE_MAPPING_CONFIG.statusField,
    pingMappings: {
      accepted: custom.pingMappings?.accepted?.length
        ? custom.pingMappings.accepted
        : DEFAULT_PING_MAPPINGS.accepted,
      rejected: custom.pingMappings?.rejected?.length
        ? custom.pingMappings.rejected
        : DEFAULT_PING_MAPPINGS.rejected,
      error: custom.pingMappings?.error?.length
        ? custom.pingMappings.error
        : DEFAULT_PING_MAPPINGS.error,
    },
    postMappings: {
      delivered: custom.postMappings?.delivered?.length
        ? custom.postMappings.delivered
        : DEFAULT_POST_MAPPINGS.delivered,
      failed: custom.postMappings?.failed?.length
        ? custom.postMappings.failed
        : DEFAULT_POST_MAPPINGS.failed,
      duplicate: custom.postMappings?.duplicate?.length
        ? custom.postMappings.duplicate
        : DEFAULT_POST_MAPPINGS.duplicate,
      invalid: custom.postMappings?.invalid?.length
        ? custom.postMappings.invalid
        : DEFAULT_POST_MAPPINGS.invalid,
    },
    bidAmountFields: custom.bidAmountFields?.length
      ? custom.bidAmountFields
      : DEFAULT_BID_AMOUNT_FIELDS,
    httpStatusMapping: {
      ...DEFAULT_HTTP_STATUS_MAPPING,
      ...custom.httpStatusMapping,
    },
    successIndicator: custom.successIndicator,
    interestIndicators: custom.interestIndicators ||
      DEFAULT_RESPONSE_MAPPING_CONFIG.interestIndicators,
  };
}
