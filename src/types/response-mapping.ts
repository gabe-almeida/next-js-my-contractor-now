/**
 * Response Mapping Types
 *
 * WHY: Different lead buyer networks use different terminology for status values,
 * bid fields, and HTTP codes. This type system enables configurable parsing.
 *
 * WHEN: Used when configuring buyers, parsing PING/POST responses, and in admin UI.
 *
 * HOW: ResponseMappingConfig stored per-buyer, loaded by BuyerResponseParser,
 * configured via ResponseMappingEditor in admin UI.
 */

/**
 * Internal normalized status for PING responses
 */
export type NormalizedPingStatus = 'accepted' | 'rejected' | 'error';

/**
 * Internal normalized status for POST responses
 */
export type NormalizedPostStatus = 'delivered' | 'failed' | 'duplicate' | 'invalid';

/**
 * HTTP status interpretation result
 */
export type HttpStatusInterpretation = 'success' | 'reject' | 'retry' | 'error';

/**
 * Main configuration for how to interpret a buyer's responses
 */
export interface ResponseMappingConfig {
  /**
   * Field path where status is found in response body
   * Supports dot notation for nested fields (e.g., "result.status")
   * Default: "status"
   */
  statusField: string;

  /**
   * PING response status mappings
   * Maps buyer's terminology to our internal normalized status
   * Values are case-insensitive during matching
   */
  pingMappings: PingStatusMappings;

  /**
   * POST response status mappings
   * Maps buyer's terminology to our internal normalized status
   * Values are case-insensitive during matching
   */
  postMappings: PostStatusMappings;

  /**
   * Field names to check for bid amount (in priority order)
   * First match wins
   * Supports dot notation for nested fields
   */
  bidAmountFields: string[];

  /**
   * HTTP status code interpretation
   * Maps HTTP status codes to our internal handling strategy
   */
  httpStatusMapping: HttpStatusCodeMapping;

  /**
   * Optional success indicator for when HTTP 200 doesn't guarantee success
   * Some buyers return 200 OK even for rejections
   */
  successIndicator?: SuccessIndicatorConfig;

  /**
   * Optional: Field names that indicate interest without explicit status
   * Used as fallback when no status field is present
   */
  interestIndicators?: InterestIndicatorConfig;
}

/**
 * PING status mappings - which buyer values map to which internal status
 */
export interface PingStatusMappings {
  /** Values that mean the buyer accepted/is interested */
  accepted: string[];
  /** Values that mean the buyer rejected/passed */
  rejected: string[];
  /** Values that indicate an error occurred */
  error: string[];
}

/**
 * POST status mappings - which buyer values map to which internal status
 */
export interface PostStatusMappings {
  /** Values that mean lead was successfully delivered */
  delivered: string[];
  /** Values that mean delivery failed */
  failed: string[];
  /** Values that mean lead was a duplicate */
  duplicate: string[];
  /** Values that mean lead data was invalid */
  invalid: string[];
}

/**
 * HTTP status code to interpretation mapping
 */
export interface HttpStatusCodeMapping {
  [statusCode: number]: HttpStatusInterpretation;
}

/**
 * Configuration for success indicator in response body
 * Used when HTTP 200 doesn't guarantee success
 */
export interface SuccessIndicatorConfig {
  /** Field path to check for success indicator */
  field: string;
  /** Values that indicate success (case-insensitive) */
  successValues: string[];
}

/**
 * Configuration for interest indicators
 * Fallback when no explicit status is present
 */
export interface InterestIndicatorConfig {
  /** Field paths that indicate acceptance when truthy */
  acceptanceFields: string[];
  /** Field paths that indicate rejection when truthy */
  rejectionFields: string[];
}

/**
 * Result of parsing a PING response
 */
export interface ParsedPingResponse {
  /** Normalized internal status */
  status: NormalizedPingStatus;
  /** Extracted bid amount (0 if not accepted or not found) */
  bidAmount: number;
  /** HTTP status code from response */
  httpStatus: number;
  /** Original raw status value from buyer */
  rawStatus: string | null;
  /** Whether we should retry this request */
  shouldRetry: boolean;
  /** Full raw response for logging */
  rawResponse: unknown;
  /** Parsing metadata for debugging */
  meta: {
    statusFieldUsed: string;
    bidFieldUsed: string | null;
    mappingSource: 'custom' | 'default';
  };
}

/**
 * Result of parsing a POST response
 */
export interface ParsedPostResponse {
  /** Normalized internal status */
  status: NormalizedPostStatus;
  /** HTTP status code from response */
  httpStatus: number;
  /** Original raw status value from buyer */
  rawStatus: string | null;
  /** Reason/message from buyer (if provided) */
  reason: string | null;
  /** Buyer's internal lead ID (if provided) */
  buyerLeadId: string | null;
  /** Whether we should retry this request */
  shouldRetry: boolean;
  /** Full raw response for logging */
  rawResponse: unknown;
  /** Parsing metadata for debugging */
  meta: {
    statusFieldUsed: string;
    mappingSource: 'custom' | 'default';
  };
}

/**
 * Buyer with response mapping configuration
 * Extends the base Buyer type
 */
export interface BuyerWithResponseMapping {
  id: string;
  name: string;
  responseMappingConfig: ResponseMappingConfig | null;
}

/**
 * Cache entry for response mapping configuration
 */
export interface ResponseMappingCacheEntry {
  config: ResponseMappingConfig;
  loadedAt: number;
  expiresAt: number;
}

/**
 * Statistics for response parsing (for monitoring)
 */
export interface ResponseParsingStats {
  buyerId: string;
  totalParsed: number;
  successfulParses: number;
  failedParses: number;
  unknownStatusCount: number;
  averageParseTimeMs: number;
  lastParsedAt: Date | null;
}
