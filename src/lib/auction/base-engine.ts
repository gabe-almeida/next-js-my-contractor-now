/**
 * Base Auction Engine
 *
 * WHY: Provides shared auction logic between lead and call auction engines
 *      to avoid code duplication and ensure consistent behavior.
 * WHEN: Extended by LeadAuctionEngine and CallAuctionEngine.
 * HOW: Abstract base class with common methods for eligibility, bid validation,
 *      winner selection, and transaction logging.
 *
 * Key shared functionality:
 * - Buyer eligibility filtering
 * - Bid validation against pricing rules
 * - Winner selection with tie-breaking
 * - Transaction logging to database
 * - HTTP header preparation
 * - Compliance requirement checking
 * - Time restriction validation
 */

import { logger } from '../logger';
import { prisma } from '../db';
import * as Sentry from '@sentry/nextjs';
import { Prisma } from '@prisma/client';

// ============================================================================
// EXPORTED INTERFACES
// ============================================================================

/**
 * WHY: Generic bid structure shared between lead and call auctions.
 * WHEN: Used to represent bids from both contractors and networks.
 */
export interface BaseBid {
  buyerId: string;
  buyerName: string;
  buyerType: 'CONTRACTOR' | 'NETWORK';
  bidAmount: number;
  responseTimeMs: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * WHY: Call-specific bid with transfer details.
 * WHEN: Used in CallAuctionEngine for bid collection.
 */
export interface CallBid extends BaseBid {
  transferNumber?: string;
  bidId?: string;
  expiresAt?: Date;
}

/**
 * WHY: Generic auction result structure.
 * WHEN: Returned from all auction engine implementations.
 */
export interface BaseAuctionResult {
  winner: BaseBid | null;
  allBids: BaseBid[];
  auctionDurationMs: number;
  eligibleBuyersCount: number;
  status: 'completed' | 'failed' | 'timeout' | 'no_bids' | 'caller_hangup';
}

/**
 * WHY: Buyer configuration needed for auction participation.
 * WHEN: Loaded from database for each eligible buyer.
 */
export interface EligibleBuyerConfig {
  buyerId: string;
  buyerName: string;
  buyerType: 'CONTRACTOR' | 'NETWORK';
  active: boolean;
  // Lead auction fields
  pingUrl?: string;
  postUrl?: string;
  pingTimeout?: number;
  postTimeout?: number;
  // Call auction fields
  callBidAmount?: number;
  callForwardingNumber?: string;
  callBackupNumber?: string;
  callPingUrl?: string;
  callDailyCap?: number;
  // Pricing limits
  minBid?: number;
  maxBid?: number;
  callMinBid?: number;
  callMaxBid?: number;
}

/**
 * WHY: Transaction action types for logging.
 * WHEN: Used when logging transactions to database.
 */
export type TransactionActionType =
  | 'PING'
  | 'POST'
  | 'DELIVERY'
  | 'CALL_PING'
  | 'CALL_TRANSFER'
  | 'CALL_COMPLETE';

/**
 * WHY: Transaction status values.
 * WHEN: Used when logging transaction outcomes.
 */
export type TransactionStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'REJECTED';

/**
 * WHY: Details for transaction logging.
 * WHEN: Passed to logTransaction for database persistence.
 */
export interface TransactionDetails {
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  statusCode?: number;
  responseTime?: number;
  deliveryTime?: number;
  success: boolean;
  bidAmount?: number;
  error?: string;
  isTimeout?: boolean;
  isWinner?: boolean;
  lostReason?: string;
  winningBidAmount?: number;
  cascadePosition?: number;
  deliveryMethod?: string;
}

// ============================================================================
// CUSTOM ERRORS
// ============================================================================

/**
 * WHY: Specific error for race conditions in winner selection.
 * WHEN: Thrown when auction is already completed by another process.
 */
export class AuctionAlreadyCompletedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuctionAlreadyCompletedError';
  }
}

/**
 * WHY: Specific error for caller abandonment.
 * WHEN: Thrown when caller hangs up during auction.
 */
export class CallerHangupError extends Error {
  constructor(
    message: string,
    public phase: string
  ) {
    super(message);
    this.name = 'CallerHangupError';
  }
}

// ============================================================================
// BASE AUCTION ENGINE
// ============================================================================

/**
 * WHY: Abstract base class providing shared auction functionality.
 * WHEN: Extended by LeadAuctionEngine and CallAuctionEngine.
 * HOW: Provides common methods while requiring subclasses to implement
 *      entity-specific logic.
 */
export abstract class BaseAuctionEngine {
  /**
   * WHY: Run the auction for a specific entity (lead or call).
   * WHEN: Called by the API handler to process the auction.
   * HOW: Must be implemented by subclasses with entity-specific logic.
   */
  abstract runAuction(entity: unknown): Promise<BaseAuctionResult>;

  // ==========================================================================
  // SHARED UTILITY METHODS
  // ==========================================================================

  /**
   * WHY: Validates a bid amount against pricing configuration.
   * WHEN: After receiving a bid response from a buyer.
   * HOW: Clamps bid to valid range (minBid, maxBid), returns 0 if invalid.
   *
   * @param bidAmount - The raw bid amount from buyer response
   * @param minBid - Minimum allowed bid
   * @param maxBid - Maximum allowed bid
   * @returns Validated bid amount (clamped to range, or 0 if invalid)
   */
  protected validateBidAmount(
    bidAmount: number,
    minBid: number = 0,
    maxBid: number = 999.99
  ): number {
    if (isNaN(bidAmount) || bidAmount <= 0) {
      return 0;
    }
    return Math.max(minBid, Math.min(maxBid, bidAmount));
  }

  /**
   * WHY: Selects the auction winner from valid bids.
   * WHEN: After all bids have been collected and validated.
   * HOW: Sorts by bid amount descending, breaks ties by response time.
   *
   * @param bids - Array of valid bids
   * @returns The winning bid, or null if no valid bids
   */
  protected selectWinner<T extends BaseBid>(bids: T[]): T | null {
    const validBids = bids.filter((b) => b.success && b.bidAmount > 0);

    if (validBids.length === 0) {
      return null;
    }

    // Sort by bid amount descending
    const sorted = [...validBids].sort((a, b) => b.bidAmount - a.bidAmount);
    const maxBid = sorted[0].bidAmount;

    // Find all bids at max amount (for tie-breaking)
    const topBids = sorted.filter((b) => b.bidAmount === maxBid);

    if (topBids.length === 1) {
      return topBids[0];
    }

    // Tie-break by fastest response time (caller is waiting!)
    return topBids.reduce((fastest, current) => {
      const currentTime = current.responseTimeMs ?? Infinity;
      const fastestTime = fastest.responseTimeMs ?? Infinity;
      return currentTime < fastestTime ? current : fastest;
    });
  }

  /**
   * WHY: Creates a timeout wrapper for async operations.
   * WHEN: Used for PING requests to enforce response time limits.
   * HOW: Races the operation against a timeout promise.
   *
   * @param promise - The async operation to wrap
   * @param timeoutMs - Timeout in milliseconds
   * @param timeoutMessage - Error message on timeout
   * @returns The result of the operation, or throws on timeout
   */
  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string = 'Operation timed out'
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * WHY: Checks if an error indicates a timeout/abort.
   * WHEN: After catching an error from an async operation.
   * HOW: Examines error message and name for timeout indicators.
   *
   * @param error - The caught error
   * @returns True if the error is timeout-related
   */
  protected isTimeoutError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      const name = error.name.toLowerCase();
      return (
        msg.includes('timeout') ||
        msg.includes('aborted') ||
        msg.includes('abort') ||
        name === 'aborterror' ||
        name === 'timeouterror'
      );
    }
    return false;
  }

  /**
   * WHY: Prepares HTTP headers for buyer API requests.
   * WHEN: Before sending PING or POST requests to buyers.
   * HOW: Adds standard headers plus authentication based on buyer config.
   *
   * @param buyerConfig - Buyer configuration with auth details
   * @param requestType - Type of request (PING or POST)
   * @param serviceTypeName - Name of the service type
   * @returns Headers object for fetch request
   */
  protected prepareHeaders(
    buyerConfig: {
      authType?: string | null;
      authConfig?: string | null;
    },
    requestType: 'PING' | 'POST' | 'CALL_PING',
    serviceTypeName?: string
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Request-Type': requestType,
      'X-Timestamp': new Date().toISOString(),
    };

    if (serviceTypeName) {
      headers['X-Service-Type'] = serviceTypeName;
    }

    // Add authentication headers if configured
    if (buyerConfig.authConfig) {
      try {
        const auth = JSON.parse(buyerConfig.authConfig);

        switch (buyerConfig.authType) {
          case 'apiKey':
            if (auth.apiKey) {
              headers['X-API-Key'] = auth.apiKey;
            }
            break;
          case 'bearer':
            if (auth.token) {
              headers['Authorization'] = `Bearer ${auth.token}`;
            }
            break;
          case 'basic':
            if (auth.username && auth.password) {
              const credentials = btoa(`${auth.username}:${auth.password}`);
              headers['Authorization'] = `Basic ${credentials}`;
            }
            break;
        }

        // Add any custom headers
        if (auth.headers && typeof auth.headers === 'object') {
          Object.assign(headers, auth.headers);
        }
      } catch {
        // Invalid auth config, continue without auth headers
        logger.warn('Failed to parse auth config', {
          authType: buyerConfig.authType,
        });
      }
    }

    return headers;
  }

  /**
   * WHY: Logs a transaction to the database for audit trail.
   * WHEN: After every PING, POST, or DELIVERY operation.
   * HOW: Creates a record in the transactions table with full details.
   *
   * @param entityId - Lead ID or Call ID
   * @param buyerId - The buyer ID
   * @param actionType - Type of action (PING, POST, etc.)
   * @param details - Transaction details
   */
  protected async logTransaction(
    entityId: string,
    buyerId: string,
    actionType: TransactionActionType,
    details: TransactionDetails
  ): Promise<void> {
    const getDbStatus = (): TransactionStatus => {
      if (details.success) return 'SUCCESS';
      if (details.isTimeout) return 'TIMEOUT';
      return 'FAILED';
    };

    try {
      await prisma.transaction.create({
        data: {
          leadId: entityId,
          buyerId,
          actionType,
          payload: JSON.stringify(details.request || {}),
          response: details.response
            ? JSON.stringify(details.response)
            : null,
          status: getDbStatus(),
          bidAmount: details.bidAmount
            ? new Prisma.Decimal(details.bidAmount)
            : null,
          responseTime: details.responseTime || details.deliveryTime || 0,
          errorMessage: details.error || null,
          isWinner: details.isWinner ?? null,
          lostReason: details.lostReason ?? null,
          winningBidAmount: details.winningBidAmount
            ? new Prisma.Decimal(details.winningBidAmount)
            : null,
          cascadePosition: details.cascadePosition ?? null,
          deliveryMethod: details.deliveryMethod ?? null,
        },
      });

      logger.debug('Transaction logged', {
        entityId,
        buyerId,
        actionType,
        status: getDbStatus(),
        bidAmount: details.bidAmount,
      });
    } catch (error) {
      // Don't fail the auction if logging fails
      logger.error('Failed to log transaction', {
        entityId,
        buyerId,
        actionType,
        error: (error as Error).message,
      });

      Sentry.captureException(error, {
        tags: {
          component: 'base-auction-engine',
          action: 'log_transaction',
        },
        extra: { entityId, buyerId, actionType },
      });
    }
  }

  /**
   * WHY: Generates a unique auction ID for tracking.
   * WHEN: At the start of every auction.
   * HOW: Combines entity ID, timestamp, and random suffix.
   *
   * @param entityId - Lead ID or Call ID
   * @param prefix - Prefix for the auction ID (default: 'auction')
   * @returns Unique auction identifier
   */
  protected generateAuctionId(
    entityId: string,
    prefix: string = 'auction'
  ): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${prefix}_${entityId}_${timestamp}_${random}`;
  }

  /**
   * WHY: Generates a unique transaction ID.
   * WHEN: For internal transaction tracking.
   * HOW: Combines timestamp and random suffix.
   *
   * @returns Unique transaction identifier
   */
  protected generateTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `tx_${timestamp}_${random}`;
  }

  /**
   * WHY: Gets the daily transaction count for a buyer.
   * WHEN: Used to check against daily caps.
   * HOW: Queries the transactions table for today's successful POSTs.
   *
   * @param buyerId - The buyer ID
   * @param actionType - Type of action to count (default: 'POST')
   * @returns Count of today's successful transactions
   */
  protected async getBuyerDailyCount(
    buyerId: string,
    actionType: TransactionActionType = 'POST'
  ): Promise<number> {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const count = await prisma.transaction.count({
        where: {
          buyerId,
          actionType,
          status: 'SUCCESS',
          createdAt: {
            gte: startOfDay,
          },
        },
      });

      return count;
    } catch (error) {
      logger.error('Failed to get buyer daily count', {
        buyerId,
        actionType,
        error: (error as Error).message,
      });
      return 0;
    }
  }
}

export default BaseAuctionEngine;
