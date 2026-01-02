/**
 * Buyer Response Parser Service
 *
 * WHY: Different lead buyer networks use different response formats and terminology.
 * This service normalizes all responses to internal standardized statuses.
 *
 * WHEN: Called by auction engine (for PING) and webhook handler (for POST) whenever
 * we receive a response from a buyer.
 *
 * HOW: Loads buyer's config (custom or default), extracts status from configured field,
 * normalizes using mapping, and returns standardized ParsedResponse.
 */

import {
  ResponseMappingConfig,
  ParsedPingResponse,
  ParsedPostResponse,
  NormalizedPingStatus,
  NormalizedPostStatus,
  HttpStatusInterpretation,
  ResponseMappingCacheEntry,
} from '@/types/response-mapping';
import {
  DEFAULT_RESPONSE_MAPPING_CONFIG,
  DEFAULT_REASON_FIELDS,
  DEFAULT_BUYER_LEAD_ID_FIELDS,
  mergeWithDefaults,
} from './default-response-mappings';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Cache for response mapping configurations
 * Key: buyerId, Value: { config, loadedAt, expiresAt }
 */
const configCache = new Map<string, ResponseMappingCacheEntry>();

/**
 * Cache TTL in milliseconds (1 minute)
 */
const CACHE_TTL_MS = 60 * 1000;

/**
 * BuyerResponseParser - Core service for parsing buyer responses
 */
export class BuyerResponseParser {
  /**
   * Parse a PING response from a buyer
   *
   * WHY: Auction engine needs to understand if buyer accepted and what they bid
   * WHEN: After sending PING request, before processing bid
   * HOW: Extract status and bid using buyer's config, normalize to internal format
   */
  static async parsePingResponse(
    buyerId: string,
    httpStatus: number,
    responseBody: unknown
  ): Promise<ParsedPingResponse> {
    const config = await this.getConfig(buyerId);
    const body = responseBody as Record<string, unknown>;

    // Check HTTP status first
    const httpInterpretation = this.interpretHttpStatus(httpStatus, config);
    if (httpInterpretation === 'error') {
      return this.createPingErrorResponse(httpStatus, body, config, 'HTTP error');
    }

    // Check success indicator if configured (for HTTP 200 with body rejection)
    if (config.successIndicator && !this.checkSuccessIndicator(body, config)) {
      return this.createPingResponse('rejected', 0, httpStatus, body, config);
    }

    // Extract raw status from response
    const rawStatus = this.extractField(body, config.statusField);

    // If no status field, check for interest indicators
    if (rawStatus === null || rawStatus === undefined) {
      return this.parseWithoutStatus(body, httpStatus, config);
    }

    // Normalize status using mappings
    const normalizedStatus = this.normalizePingStatus(String(rawStatus), config);

    // Extract bid amount if accepted
    const bidAmount = normalizedStatus === 'accepted'
      ? this.extractBidAmount(body, config)
      : 0;

    return this.createPingResponse(normalizedStatus, bidAmount, httpStatus, body, config, rawStatus);
  }

  /**
   * Parse a POST response from a buyer
   *
   * WHY: Need to know if lead delivery succeeded/failed for accounting and status updates
   * WHEN: After receiving webhook or POST response
   * HOW: Extract status and reason, normalize to internal format
   */
  static async parsePostResponse(
    buyerId: string,
    httpStatus: number,
    responseBody: unknown
  ): Promise<ParsedPostResponse> {
    const config = await this.getConfig(buyerId);
    const body = responseBody as Record<string, unknown>;

    // Check HTTP status first
    const httpInterpretation = this.interpretHttpStatus(httpStatus, config);
    if (httpInterpretation === 'error') {
      return this.createPostErrorResponse(httpStatus, body, config, 'HTTP error');
    }

    // Check success indicator if configured
    if (config.successIndicator && !this.checkSuccessIndicator(body, config)) {
      const reason = this.extractReason(body);
      return this.createPostResponse('failed', httpStatus, body, config, null, reason);
    }

    // Extract raw status from response
    const rawStatus = this.extractField(body, config.statusField);

    // If no status field but HTTP success, assume delivered
    if (rawStatus === null || rawStatus === undefined) {
      if (httpInterpretation === 'success') {
        return this.createPostResponse('delivered', httpStatus, body, config);
      }
      return this.createPostResponse('failed', httpStatus, body, config);
    }

    // Normalize status using mappings
    const normalizedStatus = this.normalizePostStatus(String(rawStatus), config);

    // Extract additional info
    const reason = this.extractReason(body);
    const buyerLeadId = this.extractBuyerLeadId(body);

    return this.createPostResponse(
      normalizedStatus,
      httpStatus,
      body,
      config,
      rawStatus,
      reason,
      buyerLeadId
    );
  }

  /**
   * Get response mapping config for a buyer
   * Uses cache with 1-minute TTL
   */
  static async getConfig(buyerId: string): Promise<ResponseMappingConfig> {
    // Check cache first
    const cached = configCache.get(buyerId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.config;
    }

    // Load from database
    try {
      const buyer = await prisma.buyer.findUnique({
        where: { id: buyerId },
        select: { responseMappingConfig: true },
      });

      let config: ResponseMappingConfig;

      if (buyer?.responseMappingConfig) {
        // Parse JSON string and merge with defaults
        const customConfig = JSON.parse(buyer.responseMappingConfig);
        config = mergeWithDefaults(customConfig);
      } else {
        // Use defaults
        config = { ...DEFAULT_RESPONSE_MAPPING_CONFIG };
      }

      // Cache the result
      configCache.set(buyerId, {
        config,
        loadedAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return config;
    } catch (error) {
      logger.error('Failed to load response mapping config', {
        buyerId,
        error: (error as Error).message,
      });

      // Return defaults on error
      return { ...DEFAULT_RESPONSE_MAPPING_CONFIG };
    }
  }

  /**
   * Invalidate cache for a buyer
   * Call after admin updates response mapping config
   */
  static invalidateCache(buyerId?: string): void {
    if (buyerId) {
      configCache.delete(buyerId);
    } else {
      configCache.clear();
    }
  }

  /**
   * Normalize PING status to internal value
   */
  private static normalizePingStatus(
    rawStatus: string,
    config: ResponseMappingConfig
  ): NormalizedPingStatus {
    const normalized = rawStatus.toLowerCase().trim();

    // Check each mapping category
    if (this.matchesAny(normalized, config.pingMappings.accepted)) {
      return 'accepted';
    }
    if (this.matchesAny(normalized, config.pingMappings.rejected)) {
      return 'rejected';
    }
    if (this.matchesAny(normalized, config.pingMappings.error)) {
      return 'error';
    }

    // Unknown status - log and default to rejected
    logger.warn('Unknown PING status, defaulting to rejected', {
      rawStatus,
      normalized,
    });
    return 'rejected';
  }

  /**
   * Normalize POST status to internal value
   */
  private static normalizePostStatus(
    rawStatus: string,
    config: ResponseMappingConfig
  ): NormalizedPostStatus {
    const normalized = rawStatus.toLowerCase().trim();

    // Check each mapping category
    if (this.matchesAny(normalized, config.postMappings.delivered)) {
      return 'delivered';
    }
    if (this.matchesAny(normalized, config.postMappings.failed)) {
      return 'failed';
    }
    if (this.matchesAny(normalized, config.postMappings.duplicate)) {
      return 'duplicate';
    }
    if (this.matchesAny(normalized, config.postMappings.invalid)) {
      return 'invalid';
    }

    // Unknown status - log and default to failed
    logger.warn('Unknown POST status, defaulting to failed', {
      rawStatus,
      normalized,
    });
    return 'failed';
  }

  /**
   * Interpret HTTP status code
   */
  private static interpretHttpStatus(
    statusCode: number,
    config: ResponseMappingConfig
  ): HttpStatusInterpretation {
    // Check custom mapping first
    if (config.httpStatusMapping[statusCode]) {
      return config.httpStatusMapping[statusCode];
    }

    // Default interpretations
    if (statusCode >= 200 && statusCode < 300) {
      return 'success';
    }
    if (statusCode === 429 || statusCode >= 500) {
      return statusCode === 429 || statusCode === 502 || statusCode === 503 || statusCode === 504
        ? 'retry'
        : 'error';
    }
    return 'reject';
  }

  /**
   * Extract field value from response body
   * Supports dot notation for nested fields (e.g., "result.status")
   */
  private static extractField(body: Record<string, unknown>, fieldPath: string): unknown {
    if (!body || typeof body !== 'object') {
      return null;
    }

    const parts = fieldPath.split('.');
    let current: unknown = body;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return null;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Extract bid amount from response using configured field names
   */
  private static extractBidAmount(
    body: Record<string, unknown>,
    config: ResponseMappingConfig
  ): number {
    for (const fieldPath of config.bidAmountFields) {
      const value = this.extractField(body, fieldPath);

      if (value !== null && value !== undefined) {
        const amount = typeof value === 'number' ? value : parseFloat(String(value));
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }

    return 0;
  }

  /**
   * Extract reason/message from response
   */
  private static extractReason(body: Record<string, unknown>): string | null {
    for (const fieldPath of DEFAULT_REASON_FIELDS) {
      const value = this.extractField(body, fieldPath);
      if (value !== null && value !== undefined && typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  /**
   * Extract buyer's lead ID from response
   */
  private static extractBuyerLeadId(body: Record<string, unknown>): string | null {
    for (const fieldPath of DEFAULT_BUYER_LEAD_ID_FIELDS) {
      const value = this.extractField(body, fieldPath);
      if (value !== null && value !== undefined) {
        return String(value);
      }
    }
    return null;
  }

  /**
   * Check success indicator in body
   */
  private static checkSuccessIndicator(
    body: Record<string, unknown>,
    config: ResponseMappingConfig
  ): boolean {
    if (!config.successIndicator) {
      return true;
    }

    const value = this.extractField(body, config.successIndicator.field);
    if (value === null || value === undefined) {
      return false;
    }

    const stringValue = String(value).toLowerCase().trim();
    return config.successIndicator.successValues.some(
      sv => sv.toLowerCase().trim() === stringValue
    );
  }

  /**
   * Check if value matches any in list (case-insensitive)
   */
  private static matchesAny(value: string, list: string[]): boolean {
    const normalizedValue = value.toLowerCase().trim();
    return list.some(item => item.toLowerCase().trim() === normalizedValue);
  }

  /**
   * Parse PING response when no status field is present
   */
  private static parseWithoutStatus(
    body: Record<string, unknown>,
    httpStatus: number,
    config: ResponseMappingConfig
  ): ParsedPingResponse {
    // Try to extract bid amount - if present and > 0, assume accepted
    const bidAmount = this.extractBidAmount(body, config);
    if (bidAmount > 0) {
      return this.createPingResponse('accepted', bidAmount, httpStatus, body, config);
    }

    // Check interest indicators
    if (config.interestIndicators) {
      for (const field of config.interestIndicators.acceptanceFields) {
        const value = this.extractField(body, field);
        if (value === true || value === 'true' || value === '1' || value === 1) {
          return this.createPingResponse('accepted', 0, httpStatus, body, config);
        }
      }

      for (const field of config.interestIndicators.rejectionFields) {
        const value = this.extractField(body, field);
        if (value === true || value === 'true' || value === '1' || value === 1) {
          return this.createPingResponse('rejected', 0, httpStatus, body, config);
        }
      }
    }

    // No clear indication - default to rejected
    return this.createPingResponse('rejected', 0, httpStatus, body, config);
  }

  /**
   * Create PING response object
   */
  private static createPingResponse(
    status: NormalizedPingStatus,
    bidAmount: number,
    httpStatus: number,
    rawResponse: unknown,
    config: ResponseMappingConfig,
    rawStatus?: unknown
  ): ParsedPingResponse {
    return {
      status,
      bidAmount,
      httpStatus,
      rawStatus: rawStatus !== undefined ? String(rawStatus) : null,
      shouldRetry: this.interpretHttpStatus(httpStatus, config) === 'retry',
      rawResponse,
      meta: {
        statusFieldUsed: config.statusField,
        bidFieldUsed: bidAmount > 0 ? this.findBidFieldUsed(rawResponse as Record<string, unknown>, config) : null,
        mappingSource: configCache.has(config.statusField) ? 'custom' : 'default',
      },
    };
  }

  /**
   * Create PING error response
   */
  private static createPingErrorResponse(
    httpStatus: number,
    rawResponse: unknown,
    config: ResponseMappingConfig,
    errorReason: string
  ): ParsedPingResponse {
    return {
      status: 'error',
      bidAmount: 0,
      httpStatus,
      rawStatus: errorReason,
      shouldRetry: this.interpretHttpStatus(httpStatus, config) === 'retry',
      rawResponse,
      meta: {
        statusFieldUsed: config.statusField,
        bidFieldUsed: null,
        mappingSource: 'default',
      },
    };
  }

  /**
   * Create POST response object
   */
  private static createPostResponse(
    status: NormalizedPostStatus,
    httpStatus: number,
    rawResponse: unknown,
    config: ResponseMappingConfig,
    rawStatus?: unknown,
    reason?: string | null,
    buyerLeadId?: string | null
  ): ParsedPostResponse {
    return {
      status,
      httpStatus,
      rawStatus: rawStatus !== undefined ? String(rawStatus) : null,
      reason: reason || null,
      buyerLeadId: buyerLeadId || null,
      shouldRetry: this.interpretHttpStatus(httpStatus, config) === 'retry',
      rawResponse,
      meta: {
        statusFieldUsed: config.statusField,
        mappingSource: configCache.has(config.statusField) ? 'custom' : 'default',
      },
    };
  }

  /**
   * Create POST error response
   */
  private static createPostErrorResponse(
    httpStatus: number,
    rawResponse: unknown,
    config: ResponseMappingConfig,
    errorReason: string
  ): ParsedPostResponse {
    return {
      status: 'failed',
      httpStatus,
      rawStatus: errorReason,
      reason: errorReason,
      buyerLeadId: null,
      shouldRetry: this.interpretHttpStatus(httpStatus, config) === 'retry',
      rawResponse,
      meta: {
        statusFieldUsed: config.statusField,
        mappingSource: 'default',
      },
    };
  }

  /**
   * Find which bid field was used (for debugging)
   */
  private static findBidFieldUsed(
    body: Record<string, unknown>,
    config: ResponseMappingConfig
  ): string | null {
    for (const fieldPath of config.bidAmountFields) {
      const value = this.extractField(body, fieldPath);
      if (value !== null && value !== undefined) {
        const amount = typeof value === 'number' ? value : parseFloat(String(value));
        if (!isNaN(amount) && amount > 0) {
          return fieldPath;
        }
      }
    }
    return null;
  }
}

export default BuyerResponseParser;
