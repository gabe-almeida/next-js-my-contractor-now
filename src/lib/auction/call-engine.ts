/**
 * Call Auction Engine
 *
 * WHY: Runs real-time auctions for incoming calls to match callers with
 *      the highest-bidding buyer (contractor or network).
 * WHEN: Called when a caller completes IVR qualification and needs routing.
 * HOW: Extends BaseAuctionEngine with call-specific logic:
 *      - Aggressive 2-second PING timeout (caller is waiting!)
 *      - Contractor bids are instant from config
 *      - Network bids require PING with timeout and field mappings
 *      - Caller hangup detection before/after auction
 *      - SERIALIZABLE transaction for winner selection
 *      - Cascade support with depth and time limits
 *
 * CRITICAL: This engine prioritizes speed over everything else.
 * A caller waiting on hold will abandon after 8-10 seconds.
 */

import {
  BaseAuctionEngine,
  CallBid,
  BaseAuctionResult,
  EligibleBuyerConfig,
  AuctionAlreadyCompletedError,
  CallerHangupError,
} from './base-engine';
import { sendCallPing, type CallPingInput } from './call-ping';
import { prisma } from '../db';
import { logger } from '../logger';
import { logAuctionEvent, createCallActivityLog } from '../twilio/logging';
import { getTwilioClient } from '../twilio';
import * as Sentry from '@sentry/nextjs';
import { Prisma } from '@prisma/client';
import type { Call } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

/**
 * WHY: Result structure specific to call auctions.
 * WHEN: Returned from runCallAuction().
 */
export interface CallAuctionResult extends BaseAuctionResult {
  winner: CallBid | null;
  allBids: CallBid[];
  transferNumber?: string;
  callerAbandoned: boolean;
}

/**
 * WHY: Configuration for call auction behavior.
 * WHEN: Passed to runCallAuction for customization.
 */
export interface CallAuctionConfig {
  pingTimeoutMs: number;
  maxCascadeDepth: number;
  maxCascadeTimeMs: number;
  requireMinimumBid: boolean;
  minimumBid: number;
}

/**
 * WHY: Database call record with necessary relations.
 * WHEN: Loaded at auction start.
 */
interface CallWithRelations extends Call {
  serviceType?: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  campaign?: {
    id: string;
    name: string;
    minCallDuration: number;
  } | null;
}

/**
 * WHY: Extended buyer config with field mappings for network PING.
 * WHEN: Loaded during eligibility check for network buyers.
 */
interface EligibleBuyerWithMappings extends EligibleBuyerConfig {
  callFieldMappings?: unknown;
  authType?: string | null;
  authConfig?: string | null;
}

// ============================================================================
// CALL AUCTION ENGINE
// ============================================================================

/**
 * WHY: Handles real-time call auctions for pay-per-call system.
 * WHEN: Called when a qualified caller needs to be routed to a buyer.
 * HOW: Collects bids from contractors (instant) and networks (PING),
 *      selects winner, and returns transfer details.
 */
export class CallAuctionEngine extends BaseAuctionEngine {
  // Default configuration
  private static readonly DEFAULT_CONFIG: CallAuctionConfig = {
    pingTimeoutMs: 2000, // 2 seconds - aggressive for caller experience
    maxCascadeDepth: 3, // Max 3 transfer attempts
    maxCascadeTimeMs: 8000, // 8 second total cascade time limit
    requireMinimumBid: true,
    minimumBid: 5.0,
  };

  private config: CallAuctionConfig;

  constructor(config: Partial<CallAuctionConfig> = {}) {
    super();
    this.config = { ...CallAuctionEngine.DEFAULT_CONFIG, ...config };
  }

  /**
   * WHY: Required by BaseAuctionEngine abstract class.
   * WHEN: Called generically through base class interface.
   */
  async runAuction(entity: Call): Promise<BaseAuctionResult> {
    return this.runCallAuction(entity.id);
  }

  /**
   * WHY: Main entry point for call auctions.
   * WHEN: Called by the API handler when a call needs routing.
   * HOW: Orchestrates the full auction flow with caller hangup detection.
   *
   * @param callId - The internal call record ID
   * @returns CallAuctionResult with winner and transfer details
   */
  async runCallAuction(callId: string): Promise<CallAuctionResult> {
    const auctionId = this.generateAuctionId(callId, 'call_auction');
    const startTime = Date.now();

    // Load call with relations
    const call = await this.loadCall(callId);
    if (!call) {
      throw new Error(`Call not found: ${callId}`);
    }

    // Log auction start
    this.logAuctionStarted(call, auctionId);

    try {
      // STEP 1: Check caller is still on line BEFORE auction
      const callerActiveBeforeAuction = await this.isCallActive(
        call.twilioCallSid
      );
      if (!callerActiveBeforeAuction) {
        this.logCallerHangup(call, 'before_auction');
        return this.createCallerHangupResult(call, startTime);
      }

      // STEP 2: Get eligible buyers (with field mappings for networks)
      const eligibleBuyers = await this.getEligibleCallBuyers(call);

      this.logEligibleBuyers(call, auctionId, eligibleBuyers.length);

      if (eligibleBuyers.length === 0) {
        this.logNoBids(call, auctionId, 'no_eligible_buyers');
        return this.createNoBidsResult(call, startTime, 0);
      }

      // STEP 3: Collect bids in parallel
      const bids = await this.collectAllBids(call, eligibleBuyers);

      // STEP 4: Check caller is still on line AFTER bid collection
      const callerActiveAfterBids = await this.isCallActive(call.twilioCallSid);
      if (!callerActiveAfterBids) {
        this.logCallerHangup(call, 'after_bids');
        // Cancel any pending network bids
        await this.cancelBidsOnHangup(callId, bids);
        return this.createCallerHangupResult(call, startTime);
      }

      // STEP 5: Filter valid bids
      const validBids = bids.filter((b) => b.success && b.bidAmount > 0);

      if (validBids.length === 0) {
        this.logNoBids(call, auctionId, 'no_valid_bids');
        return this.createNoBidsResult(call, startTime, eligibleBuyers.length);
      }

      // STEP 6: Select winner with SERIALIZABLE transaction
      const winner = await this.selectAndLockWinner(callId, validBids);

      const auctionDurationMs = Date.now() - startTime;

      if (!winner) {
        this.logNoBids(call, auctionId, 'winner_selection_failed');
        return this.createNoBidsResult(
          call,
          startTime,
          eligibleBuyers.length,
          validBids
        );
      }

      // STEP 7: Log winner selection
      this.logWinnerSelected(call, auctionId, winner, validBids);

      // Update bid statuses for analytics
      await this.updateBidStatuses(callId, winner, validBids);

      // Update auction duration in call record
      await this.updateAuctionDuration(callId, auctionDurationMs);

      return {
        winner,
        allBids: bids,
        auctionDurationMs,
        eligibleBuyersCount: eligibleBuyers.length,
        status: 'completed',
        transferNumber: winner.transferNumber,
        callerAbandoned: false,
      };
    } catch (error) {
      const auctionDurationMs = Date.now() - startTime;

      if (error instanceof AuctionAlreadyCompletedError) {
        logger.warn('Auction already completed by another process', {
          callId,
          auctionId,
          error: error.message,
        });
        return this.createFailedResult(
          call,
          startTime,
          'already_completed',
          []
        );
      }

      if (error instanceof CallerHangupError) {
        return this.createCallerHangupResult(call, startTime);
      }

      logger.error('Call auction failed', {
        callId,
        auctionId,
        auctionDurationMs,
        error: (error as Error).message,
      });

      Sentry.captureException(error, {
        tags: {
          component: 'call-auction-engine',
          action: 'run_auction',
        },
        extra: { callId, auctionId },
      });

      throw error;
    }
  }

  // ==========================================================================
  // ELIGIBILITY
  // ==========================================================================

  /**
   * WHY: Gets buyers eligible to receive this call.
   * WHEN: At the start of every call auction.
   * HOW: Queries buyers with accepts_calls=true, matching service type,
   *      covering caller's ZIP code (or nationwide), within daily caps.
   *      Also loads callFieldMappings for network buyers.
   *
   * NOTE: If caller ZIP is unknown, only nationwide buyers (those with no
   *       ZIP code restrictions) will be eligible.
   *
   * @param call - The call record with service type and caller info
   * @returns Array of eligible buyer configurations
   */
  private async getEligibleCallBuyers(
    call: CallWithRelations
  ): Promise<EligibleBuyerWithMappings[]> {
    // Service type is required - without it we can't match buyers
    if (!call.serviceTypeId) {
      logger.warn('Call missing serviceTypeId', {
        callId: call.id,
        serviceTypeId: call.serviceTypeId,
      });
      return [];
    }

    // Log if caller ZIP is missing (nationwide buyers may still match)
    if (!call.callerZip) {
      logger.info('Call has no caller ZIP - only nationwide buyers will match', {
        callId: call.id,
        serviceTypeId: call.serviceTypeId,
      });
    }

    try {
      // Find buyers who:
      // 1. Accept calls (accepts_calls = true)
      // 2. Have active service config for this service type
      // 3. Either cover this ZIP code OR are nationwide (no ZIP restrictions)
      // 4. Are under their daily cap
      const eligibleConfigs = await prisma.buyerServiceConfig.findMany({
        where: {
          serviceTypeId: call.serviceTypeId,
          active: true,
          buyer: {
            active: true,
            acceptsCalls: true,
          },
          // Must have call bid amount configured
          callBidAmount: { not: null },
        },
        include: {
          buyer: {
            select: {
              id: true,
              name: true,
              type: true,
              acceptsCalls: true,
              callForwardingNumber: true,
              callBackupNumber: true,
              callRingTimeout: true,
              authType: true,
              authConfig: true,
            },
          },
        },
      });

      const eligible: EligibleBuyerWithMappings[] = [];

      for (const config of eligibleConfigs) {
        // Check ZIP code coverage (handles null callerZip for nationwide buyers)
        const coversZip = await this.buyerCoversZipCode(
          config.buyerId,
          call.serviceTypeId,
          call.callerZip
        );

        if (!coversZip) {
          logger.debug('Buyer does not cover ZIP', {
            buyerId: config.buyerId,
            buyerName: config.buyer.name,
            zip: call.callerZip || 'UNKNOWN',
          });
          continue;
        }

        // Check daily cap
        if (config.callDailyCap) {
          const todayCount = await this.getBuyerDailyCallCount(config.buyerId);
          if (todayCount >= config.callDailyCap) {
            logger.debug('Buyer at daily call cap', {
              buyerId: config.buyerId,
              buyerName: config.buyer.name,
              cap: config.callDailyCap,
              count: todayCount,
            });
            continue;
          }
        }

        eligible.push({
          buyerId: config.buyerId,
          buyerName: config.buyer.name,
          buyerType: config.buyer.type as 'CONTRACTOR' | 'NETWORK',
          active: config.active,
          callBidAmount: config.callBidAmount
            ? Number(config.callBidAmount)
            : undefined,
          callForwardingNumber:
            config.buyer.callForwardingNumber || undefined,
          callBackupNumber: config.buyer.callBackupNumber || undefined,
          callPingUrl: config.callPingUrl || undefined,
          callFieldMappings: config.callFieldMappings,
          callDailyCap: config.callDailyCap || undefined,
          callMinBid: config.callMinBid
            ? Number(config.callMinBid)
            : undefined,
          callMaxBid: config.callMaxBid
            ? Number(config.callMaxBid)
            : undefined,
          authType: config.buyer.authType,
          authConfig: config.buyer.authConfig,
        });
      }

      return eligible;
    } catch (error) {
      logger.error('Failed to get eligible call buyers', {
        callId: call.id,
        serviceTypeId: call.serviceTypeId,
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * WHY: Checks if a buyer covers a specific ZIP code.
   * WHEN: During eligibility filtering.
   * HOW: Queries buyer_service_zip_codes table; if no entries exist,
   *      buyer is considered nationwide (covers all ZIPs).
   *
   * NOTE: If zipCode is null/undefined, only nationwide buyers (those with
   *       no ZIP restrictions) will match. Buyers with specific ZIP
   *       restrictions will NOT match unknown locations.
   *
   * @param buyerId - The buyer to check
   * @param serviceTypeId - The service type for this call
   * @param zipCode - The caller's ZIP code (can be null for unknown location)
   * @returns true if buyer covers this ZIP or is nationwide
   */
  private async buyerCoversZipCode(
    buyerId: string,
    serviceTypeId: string,
    zipCode: string | null
  ): Promise<boolean> {
    // Check if buyer has ANY zip code entries for this service
    const totalZipEntries = await prisma.buyerServiceZipCode.count({
      where: {
        buyerId,
        serviceTypeId,
      },
    });

    // If no entries, buyer is nationwide - covers all ZIPs (including unknown)
    if (totalZipEntries === 0) {
      return true;
    }

    // Buyer has ZIP restrictions. If caller ZIP is unknown, don't match.
    // This prevents routing unknown-location calls to geo-restricted buyers.
    if (!zipCode) {
      logger.debug('Buyer has ZIP restrictions but caller ZIP unknown', {
        buyerId,
        serviceTypeId,
        totalZipEntries,
      });
      return false;
    }

    // Check if specific ZIP is covered
    const zipEntry = await prisma.buyerServiceZipCode.findFirst({
      where: {
        buyerId,
        serviceTypeId,
        zipCode,
        active: true,
      },
    });

    return zipEntry !== null;
  }

  /**
   * WHY: Gets the daily call count for a buyer.
   * WHEN: During eligibility cap checking.
   * HOW: Counts successful call transfers today.
   */
  private async getBuyerDailyCallCount(buyerId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return prisma.call.count({
      where: {
        winningBuyerId: buyerId,
        status: { in: ['CONNECTED', 'COMPLETED'] },
        createdAt: { gte: startOfDay },
      },
    });
  }

  // ==========================================================================
  // BID COLLECTION
  // ==========================================================================

  /**
   * WHY: Collects bids from all eligible buyers in parallel.
   * WHEN: After eligibility check, before winner selection.
   * HOW: Contractors provide instant bids from config;
   *      Networks require PING with 2s timeout using field mappings.
   */
  private async collectAllBids(
    call: CallWithRelations,
    buyers: EligibleBuyerWithMappings[]
  ): Promise<CallBid[]> {
    const bidPromises = buyers.map((buyer) =>
      this.collectBid(call, buyer)
    );

    const results = await Promise.allSettled(bidPromises);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      // Failed promise - create error bid
      return {
        buyerId: buyers[index].buyerId,
        buyerName: buyers[index].buyerName,
        buyerType: buyers[index].buyerType,
        bidAmount: 0,
        responseTimeMs: 0,
        success: false,
        error: `Promise rejected: ${result.reason}`,
      };
    });
  }

  /**
   * WHY: Collects a bid from a single buyer.
   * WHEN: Called for each eligible buyer during bid collection.
   * HOW: Contractors return instant bids; Networks get PINGed with field mappings.
   */
  private async collectBid(
    call: CallWithRelations,
    buyer: EligibleBuyerWithMappings
  ): Promise<CallBid> {
    const startTime = Date.now();

    if (buyer.buyerType === 'CONTRACTOR') {
      return this.collectContractorBid(call, buyer, startTime);
    } else {
      return this.collectNetworkBid(call, buyer, startTime);
    }
  }

  /**
   * WHY: Creates an instant bid for contractors.
   * WHEN: Contractor buyer is eligible for this call.
   * HOW: Reads bid amount from config, no network call needed.
   */
  private collectContractorBid(
    call: CallWithRelations,
    buyer: EligibleBuyerWithMappings,
    startTime: number
  ): CallBid {
    const bidAmount = buyer.callBidAmount || 0;
    const validated = this.validateBidAmount(
      bidAmount,
      buyer.callMinBid,
      buyer.callMaxBid
    );

    // Log the bid
    this.logBidReceived(call, buyer, validated, 0, 'instant');

    // Store in CallBid table
    this.storeBid(call.id, buyer.buyerId, validated, 0, buyer.callForwardingNumber);

    return {
      buyerId: buyer.buyerId,
      buyerName: buyer.buyerName,
      buyerType: 'CONTRACTOR',
      bidAmount: validated,
      responseTimeMs: 0, // Instant
      success: validated > 0,
      transferNumber: buyer.callForwardingNumber,
    };
  }

  /**
   * WHY: Sends PING to network buyer using field mappings and parses response.
   * WHEN: Network buyer is eligible for this call.
   * HOW: Uses sendCallPing service with buyer's callFieldMappings for transformation.
   */
  private async collectNetworkBid(
    call: CallWithRelations,
    buyer: EligibleBuyerWithMappings,
    startTime: number
  ): Promise<CallBid> {
    if (!buyer.callPingUrl) {
      logger.warn('Network buyer missing callPingUrl', {
        buyerId: buyer.buyerId,
        buyerName: buyer.buyerName,
      });
      return this.createFailedBid(buyer, 0, 'No PING URL configured');
    }

    // Log PING attempt
    this.logBuyerPinged(call, buyer);

    // Prepare call data for transformation
    const callData = {
      id: call.id,
      twilioCallSid: call.twilioCallSid,
      callerPhone: call.callerPhone,
      callerPhoneDisplay: call.callerPhoneDisplay,
      callerCity: call.callerCity,
      callerState: call.callerState,
      callerZip: call.callerZip,
      callerName: call.callerName,
      isQualified: call.isQualified,
      ivrResponses: call.ivrResponses as Record<string, unknown> | null,
      serviceType: call.serviceType,
      campaign: call.campaign,
      createdAt: call.createdAt,
    };

    // Build PING input with field mappings
    const pingInput: CallPingInput = {
      call: callData,
      buyerId: buyer.buyerId,
      buyerName: buyer.buyerName,
      callPingUrl: buyer.callPingUrl,
      callFieldMappings: buyer.callFieldMappings,
      authType: buyer.authType,
      authConfig: buyer.authConfig,
    };

    // Send PING using the call-ping service (handles transformation and timeout)
    const result = await sendCallPing(pingInput);

    if (!result.success) {
      // Log the failed bid
      this.logBidReceived(call, buyer, 0, result.responseTimeMs, result.isTimeout ? 'timeout' : 'rejected');

      if (result.isTimeout) {
        this.logTimeout(call, buyer, result.responseTimeMs);
      }

      return this.createFailedBid(
        buyer,
        result.responseTimeMs,
        result.error || 'Network rejected'
      );
    }

    const response = result.response!;
    const validated = this.validateBidAmount(
      response.bidAmount,
      buyer.callMinBid,
      buyer.callMaxBid
    );

    // Log successful bid
    this.logBidReceived(call, buyer, validated, result.responseTimeMs, 'network');

    // Store in CallBid table
    await this.storeBid(
      call.id,
      buyer.buyerId,
      validated,
      result.responseTimeMs,
      response.transferNumber,
      response.rawResponse
    );

    return {
      buyerId: buyer.buyerId,
      buyerName: buyer.buyerName,
      buyerType: 'NETWORK',
      bidAmount: validated,
      responseTimeMs: result.responseTimeMs,
      success: validated > 0,
      transferNumber: response.transferNumber,
      bidId: response.bidId,
      expiresAt: response.expiresAt,
      metadata: { pingResponse: response.rawResponse },
    };
  }

  // ==========================================================================
  // WINNER SELECTION WITH SERIALIZABLE TRANSACTION
  // ==========================================================================

  /**
   * WHY: Selects winner with SERIALIZABLE isolation to prevent race conditions.
   * WHEN: After bid collection, before returning result.
   * HOW: Uses Prisma transaction with Serializable isolation level.
   *
   * CRITICAL: This prevents two concurrent processes from both thinking
   * they won the auction.
   */
  private async selectAndLockWinner(
    callId: string,
    validBids: CallBid[]
  ): Promise<CallBid | null> {
    return prisma.$transaction(
      async (tx) => {
        // Check current call state
        const call = await tx.call.findUnique({
          where: { id: callId },
          select: {
            status: true,
            winningBuyerId: true,
            version: true,
          },
        });

        if (!call) {
          throw new Error(`Call not found: ${callId}`);
        }

        // Verify auction is still in BIDDING state
        if (call.status !== 'BIDDING') {
          throw new AuctionAlreadyCompletedError(
            `Auction in status: ${call.status}`
          );
        }

        // Verify no winner has been selected yet
        if (call.winningBuyerId) {
          throw new AuctionAlreadyCompletedError('Winner already selected');
        }

        // Select winner from valid bids
        const winner = this.selectWinner(validBids);

        if (!winner) {
          // No valid winner - update status to NO_BIDS
          await tx.call.update({
            where: { id: callId, version: call.version },
            data: {
              status: 'NO_BIDS',
              version: { increment: 1 },
              statusChangedAt: new Date(),
            },
          });
          return null;
        }

        // Lock in winner
        await tx.call.update({
          where: { id: callId, version: call.version },
          data: {
            status: 'CONNECTING',
            winningBuyerId: winner.buyerId,
            winningBid: new Prisma.Decimal(winner.bidAmount),
            transferPhoneNumber: winner.transferNumber,
            auctionCompletedAt: new Date(),
            version: { increment: 1 },
            statusChangedAt: new Date(),
          },
        });

        // Update winning bid status
        await tx.callBid.updateMany({
          where: { callId, buyerId: winner.buyerId },
          data: { bidStatus: 'ACCEPTED' },
        });

        // Reject all other bids (but keep them available for cascade)
        await tx.callBid.updateMany({
          where: { callId, buyerId: { not: winner.buyerId } },
          data: { bidStatus: 'REJECTED' },
        });

        return winner;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }
    );
  }

  // ==========================================================================
  // BID STORAGE
  // ==========================================================================

  /**
   * WHY: Stores bid in CallBid table for tracking and analytics.
   * WHEN: After receiving each bid.
   */
  private async storeBid(
    callId: string,
    buyerId: string,
    bidAmount: number,
    responseTimeMs: number,
    transferNumber?: string,
    pingResponse?: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.callBid.upsert({
        where: { callId_buyerId: { callId, buyerId } },
        create: {
          callId,
          buyerId,
          bidAmount: new Prisma.Decimal(bidAmount),
          responseTimeMs,
          bidStatus: 'PENDING',
          transferNumber,
          pingResponse: pingResponse as Prisma.InputJsonValue,
        },
        update: {
          bidAmount: new Prisma.Decimal(bidAmount),
          responseTimeMs,
          transferNumber,
          pingResponse: pingResponse as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      logger.error('Failed to store bid', {
        callId,
        buyerId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * WHY: Updates bid statuses after winner selection.
   * WHEN: After SERIALIZABLE winner selection completes.
   */
  private async updateBidStatuses(
    callId: string,
    winner: CallBid,
    allBids: CallBid[]
  ): Promise<void> {
    try {
      // Log transaction for winner
      await this.logTransaction(callId, winner.buyerId, 'CALL_TRANSFER', {
        success: true,
        bidAmount: winner.bidAmount,
        isWinner: true,
        winningBidAmount: winner.bidAmount,
      });

      // Log transactions for losers
      for (const bid of allBids) {
        if (bid.buyerId === winner.buyerId) continue;

        const lostReason = bid.success ? 'OUTBID' : 'NO_BID';
        await this.logTransaction(callId, bid.buyerId, 'CALL_PING', {
          success: bid.success,
          bidAmount: bid.bidAmount,
          isWinner: false,
          lostReason,
          winningBidAmount: winner.bidAmount,
        });
      }
    } catch (error) {
      logger.error('Failed to update bid statuses', {
        callId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * WHY: Updates auction duration in call record.
   * WHEN: After successful auction completion.
   */
  private async updateAuctionDuration(
    callId: string,
    durationMs: number
  ): Promise<void> {
    try {
      await prisma.call.update({
        where: { id: callId },
        data: { auctionDurationMs: durationMs },
      });
    } catch (error) {
      logger.error('Failed to update auction duration', {
        callId,
        durationMs,
        error: (error as Error).message,
      });
    }
  }

  /**
   * WHY: Cancels all pending bids when caller hangs up.
   * WHEN: Caller abandonment detected during auction.
   */
  private async cancelBidsOnHangup(
    callId: string,
    bids: CallBid[]
  ): Promise<void> {
    try {
      await prisma.callBid.updateMany({
        where: { callId },
        data: { bidStatus: 'EXPIRED' },
      });

      // Log cancellation for each bid
      for (const bid of bids) {
        await this.logTransaction(callId, bid.buyerId, 'CALL_PING', {
          success: false,
          bidAmount: bid.bidAmount,
          isWinner: false,
          lostReason: 'CALLER_HANGUP',
        });
      }
    } catch (error) {
      logger.error('Failed to cancel bids on hangup', {
        callId,
        error: (error as Error).message,
      });
    }
  }

  // ==========================================================================
  // CALLER HANGUP DETECTION
  // ==========================================================================

  /**
   * WHY: Checks if caller is still on the line.
   * WHEN: Before auction and after bid collection.
   * HOW: Queries Twilio for call status.
   *
   * CRITICAL: Checking caller status prevents wasted effort and ensures
   * we don't select a winner for an abandoned call.
   */
  private async isCallActive(callSid: string): Promise<boolean> {
    try {
      const twilioClient = getTwilioClient();
      const call = await twilioClient.calls(callSid).fetch();

      const activeStatuses = ['queued', 'ringing', 'in-progress'];
      return activeStatuses.includes(call.status);
    } catch (error) {
      logger.warn('Failed to check call status from Twilio', {
        callSid,
        error: (error as Error).message,
      });
      // Assume active if we can't check (fail open)
      return true;
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async loadCall(callId: string): Promise<CallWithRelations | null> {
    return prisma.call.findUnique({
      where: { id: callId },
      include: {
        serviceType: {
          select: { id: true, name: true, displayName: true },
        },
        campaign: {
          select: { id: true, name: true, minCallDuration: true },
        },
      },
    });
  }

  private createFailedBid(
    buyer: EligibleBuyerWithMappings,
    responseTimeMs: number,
    error: string
  ): CallBid {
    return {
      buyerId: buyer.buyerId,
      buyerName: buyer.buyerName,
      buyerType: buyer.buyerType,
      bidAmount: 0,
      responseTimeMs,
      success: false,
      error,
    };
  }

  private createNoBidsResult(
    call: CallWithRelations,
    startTime: number,
    eligibleCount: number,
    bids: CallBid[] = []
  ): CallAuctionResult {
    return {
      winner: null,
      allBids: bids,
      auctionDurationMs: Date.now() - startTime,
      eligibleBuyersCount: eligibleCount,
      status: 'no_bids',
      callerAbandoned: false,
    };
  }

  private createCallerHangupResult(
    call: CallWithRelations,
    startTime: number
  ): CallAuctionResult {
    return {
      winner: null,
      allBids: [],
      auctionDurationMs: Date.now() - startTime,
      eligibleBuyersCount: 0,
      status: 'caller_hangup',
      callerAbandoned: true,
    };
  }

  private createFailedResult(
    call: CallWithRelations,
    startTime: number,
    reason: string,
    bids: CallBid[]
  ): CallAuctionResult {
    return {
      winner: null,
      allBids: bids,
      auctionDurationMs: Date.now() - startTime,
      eligibleBuyersCount: bids.length,
      status: 'failed',
      callerAbandoned: false,
    };
  }

  // ==========================================================================
  // LOGGING METHODS
  // ==========================================================================

  private logAuctionStarted(call: CallWithRelations, auctionId: string): void {
    logAuctionEvent(call.id, call.twilioCallSid, 'started', {
      auctionId,
      serviceType: call.serviceType?.name,
      callerZip: call.callerZip,
    });

    createCallActivityLog(call.id, 'auction.started', 'Call auction started', {
      level: 'info',
      details: { auctionId, serviceType: call.serviceType?.name },
      visibleToAffiliate: false,
      visibleToAdmin: true,
    });
  }

  private logEligibleBuyers(
    call: CallWithRelations,
    auctionId: string,
    count: number
  ): void {
    logAuctionEvent(call.id, call.twilioCallSid, 'eligible_buyers', {
      auctionId,
      eligibleBuyersCount: count,
    });
  }

  private logBuyerPinged(
    call: CallWithRelations,
    buyer: EligibleBuyerWithMappings
  ): void {
    logAuctionEvent(call.id, call.twilioCallSid, 'buyer_pinged', {
      buyerId: buyer.buyerId,
      buyerName: buyer.buyerName,
      buyerType: buyer.buyerType,
      timeout: this.config.pingTimeoutMs,
    });
  }

  private logBidReceived(
    call: CallWithRelations,
    buyer: EligibleBuyerWithMappings,
    amount: number,
    responseTime: number,
    source: string
  ): void {
    logAuctionEvent(call.id, call.twilioCallSid, 'bid_received', {
      buyerId: buyer.buyerId,
      buyerName: buyer.buyerName,
      bidAmount: amount,
      responseTimeMs: responseTime,
      source,
    });
  }

  private logNoBids(
    call: CallWithRelations,
    auctionId: string,
    reason: string
  ): void {
    logAuctionEvent(call.id, call.twilioCallSid, 'no_bids', {
      auctionId,
      reason,
    });

    createCallActivityLog(
      call.id,
      'auction.no_bids',
      `No valid bids received: ${reason}`,
      {
        level: 'warn',
        details: { auctionId, reason },
        visibleToAffiliate: true,
        visibleToAdmin: true,
      }
    );
  }

  private logWinnerSelected(
    call: CallWithRelations,
    auctionId: string,
    winner: CallBid,
    allBids: CallBid[]
  ): void {
    const tieBreakInfo =
      allBids.filter((b) => b.bidAmount === winner.bidAmount).length > 1
        ? 'tie_break_by_response_time'
        : 'highest_bid';

    logAuctionEvent(call.id, call.twilioCallSid, 'winner_selected', {
      auctionId,
      winnerId: winner.buyerId,
      winnerName: winner.buyerName,
      winningBid: winner.bidAmount,
      tieBreakInfo,
      totalBids: allBids.length,
    });

    createCallActivityLog(
      call.id,
      'auction.winner_selected',
      `Winner: ${winner.buyerName} ($${winner.bidAmount.toFixed(2)})`,
      {
        level: 'info',
        details: {
          auctionId,
          winnerId: winner.buyerId,
          winningBid: winner.bidAmount,
          tieBreakInfo,
        },
        visibleToAffiliate: true,
        visibleToAdmin: true,
      }
    );
  }

  private logCallerHangup(call: CallWithRelations, phase: string): void {
    logAuctionEvent(call.id, call.twilioCallSid, 'caller_hangup', {
      phase,
    });

    createCallActivityLog(
      call.id,
      'auction.caller_hangup',
      `Caller hung up during ${phase}`,
      {
        level: 'warn',
        details: { phase },
        visibleToAffiliate: true,
        visibleToAdmin: true,
      }
    );
  }

  private logTimeout(
    call: CallWithRelations,
    buyer: EligibleBuyerWithMappings,
    responseTime: number
  ): void {
    logAuctionEvent(call.id, call.twilioCallSid, 'timeout', {
      buyerId: buyer.buyerId,
      buyerName: buyer.buyerName,
      responseTimeMs: responseTime,
      timeoutMs: this.config.pingTimeoutMs,
    });
  }
}

// Export singleton instance for convenience
export const callAuctionEngine = new CallAuctionEngine();

export default CallAuctionEngine;
