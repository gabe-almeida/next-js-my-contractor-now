/**
 * ============================================================================
 * LEAD FLOW DOCUMENTATION - STEP 3 & 6: AUCTION ENGINE
 * ============================================================================
 *
 * WHAT: Runs PING/POST auction to match leads with buyers
 * WHY:  Maximize revenue by getting competitive bids from multiple buyers
 * WHEN: Lead processor pulls lead from queue and calls runAuction()
 *
 * PREVIOUS STEP: src/app/api/leads/route.ts (adds lead to queue)
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                        LEAD FLOW OVERVIEW                                │
 * │                                                                          │
 * │  [STEP 1] DynamicForm.tsx          → Form submission                    │
 * │      ↓ FormSubmission object                                            │
 * │  [STEP 2] /api/leads/route.ts      → Creates Lead in DB                 │
 * │      ↓ Lead added to processing queue                                   │
 * │  [STEP 3] auction/engine.ts        ← YOU ARE HERE (eligibility)         │
 * │      ↓ Buyer configs loaded from database                               │
 * │  [STEP 4] database-buyer-loader.ts → Loads FieldMappingConfig           │
 * │      ↓ Converts to TemplateMapping with valueMap                        │
 * │  [STEP 5] templates/engine.ts      → Applies valueMap + transforms      │
 * │      ↓ Generates PING/POST payloads                                     │
 * │  [STEP 6] auction/engine.ts        ← AND HERE (PING/POST)               │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * AUCTION FLOW:
 * 1. runAuction(lead) called by lead processor
 * 2. getEligibleBuyers() finds buyers matching ZIP + service type
 * 3. Split buyers by type: NETWORK (PING/POST) vs CONTRACTOR (direct delivery)
 * 4. For NETWORK buyers:
 *    a. sendPingToBuyer() → TemplateEngine.transform() generates PING payload
 *       → valueMap applied to convert "within_3_months" → "1-6 months"
 *       → transforms applied (phone.digitsOnly, boolean.yesNo, etc.)
 *    b. Collect bids from all buyers (parallel, with timeout)
 *    c. selectWinner() picks highest bidder
 *    d. deliverWithCascade() sends POST to winner (fallback to next if rejected)
 * 5. For CONTRACTOR buyers:
 *    a. ContractorDeliveryService delivers directly (no PING needed)
 *
 * KEY FUNCTIONS:
 * - runAuction() → Main entry point
 * - sendPingToBuyer() → Generates PING payload via TemplateEngine
 * - sendPostToWinner() → Generates POST payload via TemplateEngine
 * - deliverWithCascade() → Tries each bidder in order until one accepts
 *
 * DATABASE-DRIVEN CONFIGURATION:
 * - loadBuyerConfigForAuction() loads from BuyerServiceConfig table
 * - FieldMappingConfig.mappings[].valueMap defines value transformations
 * - No hardcoded buyer-specific logic needed!
 *
 * NEXT STEPS:
 * - For payload generation: src/lib/field-mapping/database-buyer-loader.ts
 * - For transformation: src/lib/templates/engine.ts
 * ============================================================================
 */

import {
  LeadData,
  BuyerConfig,
  BuyerServiceConfig,
  BidRequest,
  BidResponse,
  AuctionResult,
  PostResult,
  AuctionConfig,
  AuctionError,
  TransactionLog,
  PerformanceMetrics
} from '../templates/types';
import { TemplateEngine } from '../templates/engine';
import { BuyerConfigurationRegistry } from '../buyers/configurations';
import { BuyerEligibilityService, EligibleBuyer } from '../services/buyer-eligibility-service';
import { BuyerResponseParser } from '../buyers/response-parser';
import { loadBuyerConfigForAuction } from '../field-mapping/database-buyer-loader';
import { ContractorDeliveryService, LeadForDelivery } from '../services/contractor-delivery-service';
import { logger } from '../logger';
import { PingTokenConfig, DEFAULT_PING_TOKEN_CONFIG } from '@/types/field-mapping';

export class AuctionEngine {
  private static performanceMetrics: PerformanceMetrics['auctionMetrics'] = {
    averageAuctionTime: 0,
    averageResponseTime: 0,
    participationRate: 0,
    winRate: {},
    bidDistribution: {}
  };

  private static transactionLogs: TransactionLog[] = [];
  private static activeAuctions = new Map<string, AuctionState>();

  /**
   * Run auction for a lead across all eligible buyers
   *
   * Task 4.2: Split flow by buyer type
   * - NETWORK buyers → PING/POST auction flow
   * - CONTRACTOR buyers → Direct delivery flow
   */
  static async runAuction(
    lead: LeadData,
    config: AuctionConfig = this.getDefaultConfig()
  ): Promise<AuctionResult> {
    const auctionId = this.generateAuctionId(lead.id);
    const startTime = Date.now();

    try {
      // Get eligible buyers for this service type
      logger.info('[AuctionEngine] Getting eligible buyers', {
        leadId: lead.id,
        serviceTypeId: lead.serviceTypeId,
        zipCode: lead.zipCode,
      });

      const eligibleBuyers = await this.getEligibleBuyers(lead, config);

      logger.info('[AuctionEngine] Eligible buyers result', {
        leadId: lead.id,
        count: eligibleBuyers.length,
        buyers: eligibleBuyers.map(b => ({ id: b.buyer.id, name: b.buyer.name })),
      });

      // Task 4.2: Split by buyer type (NETWORK vs CONTRACTOR)
      // Check if any buyers are contractors by querying the database
      const buyerTypes = await this.getBuyerTypes(eligibleBuyers.map(b => b.buyer.id));

      const networkBuyers = eligibleBuyers.filter(b =>
        buyerTypes.get(b.buyer.id) === 'NETWORK' || !buyerTypes.has(b.buyer.id)
      );
      const hasContractors = Array.from(buyerTypes.values()).includes('CONTRACTOR');

      logger.info('Auction buyer type split', {
        leadId: lead.id,
        totalEligible: eligibleBuyers.length,
        networkBuyers: networkBuyers.length,
        hasContractors,
      });

      // If we have network buyers, run the network auction first
      if (networkBuyers.length > 0) {
        const networkResult = await this.runNetworkAuction(lead, networkBuyers, config, auctionId, startTime);

        // If network auction succeeded, return the result
        if (networkResult.status === 'completed' && networkResult.postResult?.success) {
          return networkResult;
        }

        // If network auction failed and we have contractors, fall back to contractor delivery
        if (hasContractors && !networkResult.postResult?.success) {
          logger.info('Network auction failed, falling back to contractor delivery', {
            leadId: lead.id,
            networkStatus: networkResult.status,
          });

          // Update network PING transactions to reflect they all lost (POST_REJECTED)
          // since we're falling back to contractors
          await this.markAllNetworkBiddersAsLosers(lead.id, networkResult.allBids);

          return await this.deliverToContractorsWithResult(
            lead,
            networkResult.winningBidAmount, // Pass network bid for HYBRID pricing
            auctionId,
            startTime
          );
        }

        return networkResult;
      }

      // No network buyers - try contractor delivery directly
      if (hasContractors) {
        return await this.deliverToContractorsWithResult(lead, undefined, auctionId, startTime);
      }

      // No eligible buyers at all
      return this.createFailedResult(lead.id, 'No eligible buyers found', []);

    } catch (error) {
      this.activeAuctions.delete(auctionId);

      throw new AuctionError(
        `Auction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        auctionId,
        { leadId: lead.id, error }
      );
    }
  }

  /**
   * Mark all network bidders as losers when falling back to contractors
   * This ensures accurate analytics - all network PING transactions show they lost
   * because their POSTs were rejected and a contractor won instead.
   */
  private static async markAllNetworkBiddersAsLosers(
    leadId: string,
    allBids: BidResponse[]
  ): Promise<void> {
    try {
      const { prisma } = await import('../db');

      // Update all PING transactions for this lead to show they lost
      // The lostReason is CASCADE_EXHAUSTED because all network POSTs were rejected
      await prisma.transaction.updateMany({
        where: {
          leadId,
          actionType: 'PING',
        },
        data: {
          isWinner: false,
          lostReason: 'CASCADE_EXHAUSTED',
        },
      });

      logger.info('Marked all network bidders as losers for contractor fallback', {
        leadId,
        bidCount: allBids.length,
      });
    } catch (error) {
      // Log but don't throw - this is for analytics and shouldn't break the flow
      logger.error('Failed to mark network bidders as losers', {
        leadId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get buyer types from database
   */
  private static async getBuyerTypes(buyerIds: string[]): Promise<Map<string, string>> {
    const { prisma } = await import('../db');

    const buyers = await prisma.buyer.findMany({
      where: { id: { in: buyerIds } },
      select: { id: true, type: true },
    });

    return new Map(buyers.map(b => [b.id, b.type]));
  }

  /**
   * Deliver to contractors and return AuctionResult format
   */
  private static async deliverToContractorsWithResult(
    lead: LeadData,
    networkWinningBid: number | undefined,
    auctionId: string,
    startTime: number
  ): Promise<AuctionResult> {
    const leadForDelivery: LeadForDelivery = {
      id: lead.id,
      serviceTypeId: lead.serviceTypeId,
      zipCode: lead.zipCode,
      formData: lead.formData,
      trustedFormCertUrl: lead.trustedFormCertUrl,
      trustedFormCertId: lead.trustedFormCertId,
      ownsHome: lead.ownsHome,
      timeframe: lead.timeframe,
    };

    const contractorResult = await ContractorDeliveryService.deliverToContractors(
      leadForDelivery,
      networkWinningBid
    );

    const auctionDurationMs = Date.now() - startTime;

    // Convert contractor result to AuctionResult format
    return {
      leadId: lead.id,
      winningBuyerId: contractorResult.deliveredTo[0]?.buyerId,
      winningBidAmount: contractorResult.totalRevenue,
      allBids: contractorResult.deliveredTo.map(d => ({
        buyerId: d.buyerId,
        bidAmount: d.price,
        success: true,
        responseTime: 0,
      })),
      auctionDurationMs,
      participantCount: contractorResult.deliveredTo.length,
      status: contractorResult.success ? 'completed' : 'failed',
      postResult: contractorResult.success ? {
        success: true,
        statusCode: 200,
        deliveryTime: auctionDurationMs,
      } : undefined,
    };
  }

  /**
   * Run network auction (PING/POST flow for NETWORK buyers)
   */
  private static async runNetworkAuction(
    lead: LeadData,
    eligibleBuyers: EligibleBuyerWithConfig[],
    config: AuctionConfig,
    auctionId: string,
    startTime: number
  ): Promise<AuctionResult> {
    // Initialize auction state
    const auctionState: AuctionState = {
      auctionId,
      leadId: lead.id,
      serviceTypeId: lead.serviceTypeId,
      startTime,
      buyers: eligibleBuyers,
      bids: [],
      status: 'running'
    };

    this.activeAuctions.set(auctionId, auctionState);

    // Send parallel PINGs to all eligible buyers
    // Use buyer-specific ping timeout (already in ms), fallback to global config timeout
    const bidPromises = eligibleBuyers.map(buyer => {
      const buyerTimeout = buyer.serviceConfig.webhookConfig?.timeouts?.ping || config.timeoutMs;
      return this.sendPingToBuyer(lead, buyer, buyerTimeout);
    });

    // Wait for all bids with timeout
    const bidResults = await Promise.allSettled(bidPromises);

    // Process bid results
    const validBids = this.processBidResults(bidResults, eligibleBuyers);
    auctionState.bids = validBids;

    // Apply auction logic to select winner
    const winner = this.selectWinner(validBids, config);
    auctionState.winner = winner;

    // Update PING transactions with winner/loser status for analytics
    await this.updatePingTransactionsWithWinnerStatus(
      lead.id,
      winner?.buyerId,
      winner?.bidAmount,
      validBids
    );

    // Send POST with cascade fallback - tries all bidders until one accepts
    let postResult: PostResult | undefined;
    let finalWinner: BidResponse | undefined = winner;

    if (validBids.some(b => b.success && b.bidAmount > 0)) {
      // Use cascade delivery - tries each bidder in order until one accepts
      const cascadeResult = await this.deliverWithCascade(
        lead,
        validBids,
        eligibleBuyers
      );
      postResult = cascadeResult.postResult;
      finalWinner = cascadeResult.acceptedBid;

      // If cascade changed the winner, update the PING transactions
      if (finalWinner && finalWinner.buyerId !== winner?.buyerId) {
        await this.updatePingTransactionsWithWinnerStatus(
          lead.id,
          finalWinner.buyerId,
          finalWinner.bidAmount,
          validBids
        );
      }
    }

    // Create auction result (use finalWinner from cascade)
    const auctionDurationMs = Date.now() - startTime;

    // Determine status:
    // - 'completed': POST succeeded (lead delivered)
    // - 'failed': No valid bids or all POSTs rejected (cascade exhausted)
    // - 'no_bids': Participants but no valid bids received
    let status: 'completed' | 'failed' | 'timeout' | 'no_bids';
    if (postResult?.success) {
      status = 'completed';
    } else if (validBids.filter(b => b.success && b.bidAmount > 0).length === 0) {
      status = 'no_bids';
    } else {
      // Had valid bids but all POSTs rejected
      status = 'failed';
    }

    const result: AuctionResult = {
      leadId: lead.id,
      winningBuyerId: finalWinner?.buyerId,
      winningBidAmount: finalWinner?.bidAmount,
      allBids: validBids,
      auctionDurationMs,
      participantCount: eligibleBuyers.length,
      status,
      postResult
    };

    // Update performance metrics
    this.updateMetrics(result, eligibleBuyers);

    // Clean up auction state
    this.activeAuctions.delete(auctionId);

    return result;
  }

  /**
   * Wrap payload in a wrapper field if requestWrapper is configured
   *
   * WHY: Some buyers (like boberdoo-based Home Appointments) expect the payload
   *      to be wrapped in a specific field name, e.g., { "Request": { ...payload } }
   * WHEN: Applied when serializing PING/POST payloads, before JSON.stringify
   * HOW: If requestWrapper is set, wrap payload: { [requestWrapper]: payload }
   *      If not set, return payload unchanged
   *
   * @param payload - The payload to potentially wrap
   * @param requestWrapper - The wrapper field name (e.g., "Request"), or undefined
   * @returns The wrapped payload if requestWrapper is set, or the original payload
   */
  private static wrapPayloadIfNeeded(
    payload: Record<string, unknown>,
    requestWrapper?: string
  ): Record<string, unknown> {
    if (requestWrapper) {
      logger.debug('Wrapping payload with requestWrapper', {
        wrapperField: requestWrapper,
        originalKeys: Object.keys(payload).slice(0, 5)
      });
      return { [requestWrapper]: payload };
    }
    return payload;
  }

  /**
   * Extract a value from an object using dot notation path
   *
   * WHY: Support nested field paths like "data.pingToken" in PING responses
   * WHEN: Extracting ping token from PING response using configurable field names
   * HOW: Split path by dots and traverse object
   */
  private static getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return null;
      }
      if (typeof current !== 'object') {
        return null;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Extract ping token from PING response using configurable field names
   *
   * WHY: Different buyers use different field names for ping tokens
   *      - Standard: "pingToken" or "ping_token"
   *      - LeadProsper/Koalaty: "ping_id"
   * WHEN: After receiving PING response, before storing in bid metadata
   * HOW: Try each field in responseFields until one returns a non-null value
   *
   * @param responseData - The parsed PING response body
   * @param config - PingTokenConfig with responseFields to check (or undefined for defaults)
   * @returns The extracted ping token value, or null if not found
   */
  private static extractPingToken(
    responseData: Record<string, unknown>,
    config?: PingTokenConfig
  ): string | null {
    const effectiveConfig = config || DEFAULT_PING_TOKEN_CONFIG;

    for (const field of effectiveConfig.responseFields) {
      const value = this.getNestedValue(responseData, field);
      if (value !== null && value !== undefined && value !== '') {
        logger.debug('Extracted ping token', {
          field,
          valuePreview: String(value).substring(0, 20) + '...',
          configSource: config ? 'custom' : 'default'
        });
        return String(value);
      }
    }

    logger.warn('No ping token found in response', {
      checkedFields: effectiveConfig.responseFields,
      responseKeys: Object.keys(responseData)
    });
    return null;
  }

  /**
   * Extract buyer lead ID from PING response using configurable field names
   *
   * WHY: Buyers return their internal lead ID that may be needed in POST
   * WHEN: After receiving PING response, before storing in bid metadata
   */
  private static extractBuyerLeadId(
    responseData: Record<string, unknown>,
    config?: PingTokenConfig
  ): string | null {
    const fields = config?.buyerLeadIdResponseFields || DEFAULT_PING_TOKEN_CONFIG.buyerLeadIdResponseFields || [];

    for (const field of fields) {
      const value = this.getNestedValue(responseData, field);
      if (value !== null && value !== undefined && value !== '') {
        return String(value);
      }
    }

    return null;
  }

  /**
   * Send PING to individual buyer
   */
  private static async sendPingToBuyer(
    lead: LeadData,
    buyerConfig: EligibleBuyerWithConfig,
    timeoutMs: number
  ): Promise<BidResponse> {
    const startTime = Date.now();
    const { buyer, serviceConfig } = buyerConfig;

    // Define payload outside try so we can log it in error path
    let payload: Record<string, any> = {};

    try {
      // Ensure pingTemplate exists
      if (!serviceConfig.pingTemplate) {
        throw new Error(`Missing pingTemplate for buyer ${buyer.id}`);
      }

      // Transform lead data using buyer's PING template
      payload = await TemplateEngine.transform(
        lead,
        buyer,
        serviceConfig.pingTemplate,
        serviceConfig.pingTemplate?.includeCompliance ?? false
      );

      // Prepare request headers
      const headers = this.prepareHeaders(buyer, serviceConfig, 'PING');

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Send PING request
      // Apply requestWrapper if configured (e.g., { "Request": { ...payload } } for boberdoo)
      const finalPayload = this.wrapPayloadIfNeeded(payload, serviceConfig.requestWrapper);

      // Debug logging - capture what we're sending
      logger.info('PING request payload', {
        buyerId: buyer.id,
        buyerName: buyer.name,
        pingUrl: serviceConfig.webhookConfig!.pingUrl,
        payloadKeys: Object.keys(finalPayload),
        hasFormat: 'Format' in finalPayload || (finalPayload.Request && 'Format' in finalPayload.Request),
        requestWrapper: serviceConfig.requestWrapper || 'none',
      });

      const response = await fetch(serviceConfig.webhookConfig!.pingUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(finalPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      // Try to parse as JSON, but capture raw text if it fails (e.g., XML response)
      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        // Response is not valid JSON - log the raw response for debugging
        logger.error('PING response not valid JSON', {
          buyerId: buyer.id,
          buyerName: buyer.name,
          statusCode: response.status,
          responsePreview: responseText.substring(0, 500),
          contentType: response.headers.get('content-type'),
        });
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
      }

      // Use BuyerResponseParser to parse the response flexibly
      const parsedResponse = await BuyerResponseParser.parsePingResponse(
        buyer.id,
        response.status,
        responseData
      );

      // Validate bid against pricing rules
      const validatedBid = this.validateBid(parsedResponse.bidAmount, serviceConfig);

      // Determine success: parser says accepted AND bid is valid
      const isSuccess = parsedResponse.status === 'accepted' && validatedBid > 0;

      // Log transaction with parsed data
      await this.logTransaction(lead.id, buyer.id, 'PING', {
        request: payload,
        response: responseData,
        statusCode: response.status,
        responseTime,
        success: isSuccess,
        bidAmount: validatedBid,
        originalBidAmount: parsedResponse.bidAmount,
        parsedStatus: parsedResponse.status,
        rawStatus: parsedResponse.rawStatus
      });

      // Extract ping token using configurable field names
      // Uses serviceConfig.pingTokenConfig if set, otherwise defaults
      const pingTokenConfig = serviceConfig.pingTokenConfig;
      const extractedPingToken = this.extractPingToken(
        responseData as Record<string, unknown>,
        pingTokenConfig
      );
      const extractedBuyerLeadId = this.extractBuyerLeadId(
        responseData as Record<string, unknown>,
        pingTokenConfig
      );

      return {
        buyerId: buyer.id,
        bidAmount: validatedBid,
        success: isSuccess,
        responseTime,
        metadata: {
          statusCode: response.status,
          originalBid: parsedResponse.bidAmount,
          validated: validatedBid > 0,
          parsedStatus: parsedResponse.status,
          rawStatus: parsedResponse.rawStatus,
          // Capture pingToken from PING response for use in POST
          // Uses configurable field names (default: pingToken, ping_token, ping_id)
          pingToken: extractedPingToken,
          buyerLeadId: extractedBuyerLeadId,
          // Store the pingTokenConfig so POST knows what field name to use
          pingTokenConfig: pingTokenConfig,
          // Store raw response for any other fields needed in POST
          pingResponseData: responseData
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Detect if this was a timeout (AbortController says "aborted")
      const isTimeout = this.isTimeoutError(error);

      // Debug logging - capture what we tried to send when it failed
      logger.error('PING request failed', {
        buyerId: buyer.id,
        buyerName: buyer.name,
        error: errorMessage,
        isTimeout,
        payloadKeys: Object.keys(payload),
        payloadSize: JSON.stringify(payload).length,
        hasFormat: 'Format' in payload || (payload.Request && 'Format' in payload.Request),
      });

      // Log failed transaction with proper timeout status AND the payload we sent
      await this.logTransaction(lead.id, buyer.id, 'PING', {
        request: payload, // Include payload so we can debug what was sent
        error: errorMessage,
        responseTime,
        success: false,
        isTimeout, // Flag for status determination
        lostReason: isTimeout ? 'TIMEOUT' : 'NO_BID',
      });

      return {
        buyerId: buyer.id,
        bidAmount: 0,
        success: false,
        responseTime,
        error: isTimeout ? 'TIMEOUT: Request timed out' : errorMessage
      };
    }
  }

  /**
   * Check if an error is a timeout/abort error
   */
  private static isTimeoutError(error: unknown): boolean {
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
   * Send POST to auction winner
   */
  private static async sendPostToWinner(
    lead: LeadData,
    winnerConfig: EligibleBuyerWithConfig,
    winningBid?: BidResponse
  ): Promise<PostResult> {
    const startTime = Date.now();
    const { buyer, serviceConfig } = winnerConfig;

    try {
      // Ensure postTemplate exists
      if (!serviceConfig.postTemplate) {
        throw new Error(`Missing postTemplate for buyer ${buyer.id}`);
      }

      // Transform lead data using buyer's POST template
      const payload = await TemplateEngine.transform(
        lead,
        buyer,
        serviceConfig.postTemplate,
        serviceConfig.postTemplate?.includeCompliance ?? true // Include compliance for POST
      );

      // Add auction metadata
      payload.auction_winning_bid = await this.getWinningBid(lead.id);
      payload.auction_timestamp = new Date().toISOString();

      // CRITICAL: Include pingToken from PING response if present
      // Uses configurable field name from pingTokenConfig (default: "pingToken")
      // This allows buyers like LeadProsper to use "lp_ping_id" instead
      if (winningBid?.metadata?.pingToken) {
        // Get the configured POST field name, or use default
        const pingTokenConfig = winningBid.metadata.pingTokenConfig as PingTokenConfig | undefined;
        const postFieldName = pingTokenConfig?.postFieldName || DEFAULT_PING_TOKEN_CONFIG.postFieldName;

        payload[postFieldName] = winningBid.metadata.pingToken;
        logger.info('Including ping token in POST payload', {
          leadId: lead.id,
          buyerId: buyer.id,
          fieldName: postFieldName,
          pingToken: winningBid.metadata.pingToken,
          configSource: pingTokenConfig ? 'custom' : 'default'
        });
      }

      // Include buyerLeadId if present (some buyers return their own lead ID in PING)
      // Uses configurable field name from pingTokenConfig (default: "buyerLeadId")
      if (winningBid?.metadata?.buyerLeadId) {
        const pingTokenConfig = winningBid.metadata.pingTokenConfig as PingTokenConfig | undefined;
        const buyerLeadIdFieldName = pingTokenConfig?.buyerLeadIdPostField || DEFAULT_PING_TOKEN_CONFIG.buyerLeadIdPostField || 'buyerLeadId';

        payload[buyerLeadIdFieldName] = winningBid.metadata.buyerLeadId;
      }

      // Prepare request headers
      const headers = this.prepareHeaders(buyer, serviceConfig, 'POST');

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        serviceConfig.webhookConfig!.timeouts.post
      );

      // Send POST request
      // Apply requestWrapper if configured (e.g., { "Request": { ...payload } } for boberdoo)
      const finalPayload = this.wrapPayloadIfNeeded(payload, serviceConfig.requestWrapper);
      const response = await fetch(serviceConfig.webhookConfig!.postUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(finalPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const deliveryTime = Date.now() - startTime;
      const responseData = response.ok ? await response.json() : null;

      // Log transaction with winner tracking
      await this.logTransaction(lead.id, buyer.id, 'POST', {
        request: payload,
        response: responseData,
        statusCode: response.status,
        deliveryTime,
        success: response.ok,
        bidAmount: winningBid?.bidAmount,
        // Winner tracking fields
        isWinner: response.ok, // Only true if POST succeeded
        lostReason: response.ok ? null : 'POST_REJECTED',
        winningBidAmount: winningBid?.bidAmount,
        cascadePosition: 1, // First attempt (will be incremented in cascade fallback)
      });

      return {
        success: response.ok,
        statusCode: response.status,
        response: responseData,
        deliveryTime
      };

    } catch (error) {
      const deliveryTime = Date.now() - startTime;

      // Log failed transaction with winner tracking
      await this.logTransaction(lead.id, buyer.id, 'POST', {
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryTime,
        success: false,
        bidAmount: winningBid?.bidAmount,
        // Winner tracking - POST failed
        isWinner: false,
        lostReason: 'POST_REJECTED',
        winningBidAmount: winningBid?.bidAmount,
        cascadePosition: 1,
      });

      return {
        success: false,
        statusCode: 0,
        error: error instanceof Error ? error.message : 'POST delivery failed',
        deliveryTime
      };
    }
  }

  /**
   * Cascade delivery - tries each bidder in order until one accepts
   *
   * WHY: Network buyers can reject POSTs for various reasons (duplicate, cap reached, etc.)
   *      Instead of failing the auction, we try the next highest bidder.
   * WHEN: Called after PING auction completes with valid bids
   * HOW: Sort bids descending, try POST to each, track cascade position
   *
   * @param lead - The lead to deliver
   * @param validBids - All valid bids from PING phase (already filtered for success)
   * @param eligibleBuyers - Buyer configurations for all participants
   * @returns Object with postResult and the bid that was accepted (if any)
   */
  private static async deliverWithCascade(
    lead: LeadData,
    validBids: BidResponse[],
    eligibleBuyers: EligibleBuyerWithConfig[]
  ): Promise<{
    postResult: PostResult | undefined;
    acceptedBid: BidResponse | undefined;
  }> {
    // Task 3.2: Sort bids by amount descending
    const rankedBids = [...validBids]
      .filter(b => b.success && b.bidAmount > 0)
      .sort((a, b) => b.bidAmount - a.bidAmount);

    if (rankedBids.length === 0) {
      return { postResult: undefined, acceptedBid: undefined };
    }

    logger.info('Starting cascade delivery', {
      leadId: lead.id,
      totalBids: rankedBids.length,
      topBid: rankedBids[0]?.bidAmount,
      bottomBid: rankedBids[rankedBids.length - 1]?.bidAmount
    });

    // Task 3.3: Implement cascade loop
    let cascadePosition = 0;

    for (const bid of rankedBids) {
      cascadePosition++;

      const buyerConfig = eligibleBuyers.find(b => b.buyer.id === bid.buyerId);
      if (!buyerConfig) {
        logger.warn('Buyer config not found for cascade attempt', {
          leadId: lead.id,
          buyerId: bid.buyerId,
          cascadePosition
        });
        continue;
      }

      logger.info('Cascade attempt', {
        leadId: lead.id,
        buyerId: bid.buyerId,
        buyerName: buyerConfig.buyer.name,
        bidAmount: bid.bidAmount,
        cascadePosition
      });

      // Attempt POST to this buyer
      const postResult = await this.sendPostToBuyerWithCascade(
        lead,
        buyerConfig,
        bid,
        cascadePosition
      );

      if (postResult.success) {
        // Winner found! Mark them and return
        logger.info('Cascade delivery succeeded', {
          leadId: lead.id,
          buyerId: bid.buyerId,
          cascadePosition,
          bidAmount: bid.bidAmount
        });

        return {
          postResult,
          acceptedBid: bid
        };
      }

      // POST rejected - log reason and continue to next bidder
      // Task 3.4: Parse rejection reason
      const lostReason = this.parseRejectionReason(postResult);
      logger.info('Cascade POST rejected, trying next', {
        leadId: lead.id,
        buyerId: bid.buyerId,
        cascadePosition,
        lostReason,
        error: postResult.error
      });
    }

    // All bidders rejected - cascade exhausted
    logger.warn('Cascade exhausted - all bidders rejected', {
      leadId: lead.id,
      totalAttempts: cascadePosition
    });

    return {
      postResult: {
        success: false,
        statusCode: 0,
        error: 'CASCADE_EXHAUSTED: All bidders rejected the lead',
        deliveryTime: 0
      },
      acceptedBid: undefined
    };
  }

  /**
   * Send POST to a specific buyer during cascade delivery
   * Tracks cascade position and rejection reasons
   */
  private static async sendPostToBuyerWithCascade(
    lead: LeadData,
    buyerConfig: EligibleBuyerWithConfig,
    bid: BidResponse,
    cascadePosition: number
  ): Promise<PostResult> {
    const startTime = Date.now();
    const { buyer, serviceConfig } = buyerConfig;

    try {
      // Ensure postTemplate exists
      if (!serviceConfig.postTemplate) {
        throw new Error(`Missing postTemplate for buyer ${buyer.id}`);
      }

      // Transform lead data using buyer's POST template
      const payload = await TemplateEngine.transform(
        lead,
        buyer,
        serviceConfig.postTemplate,
        serviceConfig.postTemplate?.includeCompliance ?? true // Include compliance for POST
      );

      // Add auction metadata
      payload.auction_winning_bid = bid.bidAmount;
      payload.auction_timestamp = new Date().toISOString();
      payload.cascade_position = cascadePosition;

      // Include pingToken if present
      if (bid.metadata?.pingToken) {
        payload.pingToken = bid.metadata.pingToken;
      }
      if (bid.metadata?.buyerLeadId) {
        payload.buyerLeadId = bid.metadata.buyerLeadId;
      }

      // Prepare request headers
      const headers = this.prepareHeaders(buyer, serviceConfig, 'POST');

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        serviceConfig.webhookConfig!.timeouts.post
      );

      // Send POST request
      // Apply requestWrapper if configured (e.g., { "Request": { ...payload } } for boberdoo)
      const finalPayload = this.wrapPayloadIfNeeded(payload, serviceConfig.requestWrapper);
      const response = await fetch(serviceConfig.webhookConfig!.postUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(finalPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const deliveryTime = Date.now() - startTime;
      let responseData: any = null;

      try {
        responseData = await response.json();
      } catch {
        // Response might not be JSON
      }

      // Determine if accepted - check status code and response
      const isAccepted = response.ok && this.isPostAccepted(responseData);
      const lostReason = isAccepted ? null : this.parseRejectionReason({
        success: false,
        statusCode: response.status,
        response: responseData,
        deliveryTime
      });

      // Log transaction with cascade tracking
      await this.logTransaction(lead.id, buyer.id, 'POST', {
        request: payload,
        response: responseData,
        statusCode: response.status,
        deliveryTime,
        success: isAccepted,
        bidAmount: bid.bidAmount,
        isWinner: isAccepted,
        lostReason,
        winningBidAmount: bid.bidAmount,
        cascadePosition,
      });

      return {
        success: isAccepted,
        statusCode: response.status,
        response: responseData,
        deliveryTime,
        error: isAccepted ? undefined : (responseData?.message || responseData?.error || `HTTP ${response.status}`)
      };

    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Detect if this was a timeout (AbortController says "aborted")
      const isTimeout = this.isTimeoutError(error);

      // Log failed transaction with proper timeout tracking
      await this.logTransaction(lead.id, buyer.id, 'POST', {
        error: errorMessage,
        deliveryTime,
        success: false,
        bidAmount: bid.bidAmount,
        isWinner: false,
        isTimeout, // Flag for status determination
        lostReason: isTimeout ? 'TIMEOUT' : 'POST_REJECTED',
        winningBidAmount: bid.bidAmount,
        cascadePosition,
      });

      return {
        success: false,
        statusCode: 0,
        error: isTimeout ? 'TIMEOUT: Request timed out' : errorMessage,
        deliveryTime
      };
    }
  }

  /**
   * Check if POST response indicates acceptance
   * Different buyers have different response formats
   */
  private static isPostAccepted(responseData: any): boolean {
    if (!responseData) return false;

    // Check common acceptance indicators
    const acceptIndicators = [
      responseData.accepted === true,
      responseData.success === true,
      responseData.status === 'accepted',
      responseData.status === 'success',
      responseData.result === 'accepted',
      responseData.result === 'success',
      responseData.leadId !== undefined, // Many buyers return a leadId on success
      responseData.lead_id !== undefined,
      responseData.confirmation !== undefined,
    ];

    return acceptIndicators.some(indicator => indicator === true);
  }

  /**
   * Parse rejection reason from POST response
   * Task 3.4: Map response to lostReason enum values
   */
  private static parseRejectionReason(postResult: PostResult): string {
    const response = postResult.response;
    const statusCode = postResult.statusCode;
    const error = postResult.error?.toLowerCase() || '';

    // Check HTTP status codes
    if (statusCode === 409) return 'DUPLICATE_LEAD';
    if (statusCode === 429) return 'CAP_REACHED';
    if (statusCode === 403 || statusCode === 401) return 'POST_REJECTED';
    if (statusCode >= 500) return 'POST_REJECTED';

    // Check response body for rejection reasons
    if (response) {
      const reason = (response.reason || response.rejection_reason || response.error || '').toLowerCase();
      const message = (response.message || '').toLowerCase();
      const combined = reason + ' ' + message;

      if (combined.includes('duplicate')) return 'DUPLICATE_LEAD';
      if (combined.includes('cap') || combined.includes('limit')) return 'CAP_REACHED';
      if (combined.includes('hours') || combined.includes('closed')) return 'OUTSIDE_HOURS';
      if (combined.includes('compliance')) return 'COMPLIANCE_MISSING';
      if (combined.includes('timeout')) return 'TIMEOUT';
    }

    // Check error message
    if (error.includes('timeout') || error.includes('aborted')) return 'TIMEOUT';
    if (error.includes('duplicate')) return 'DUPLICATE_LEAD';

    // Default
    return 'POST_REJECTED';
  }

  /**
   * Get eligible buyers for a lead using the new service zone system
   */
  private static async getEligibleBuyers(
    lead: LeadData,
    config: AuctionConfig
  ): Promise<EligibleBuyerWithConfig[]> {
    try {
      // Use the new eligibility service to get buyers based on service zones
      const eligibilityResult = await BuyerEligibilityService.getEligibleBuyers({
        serviceTypeId: lead.serviceTypeId,
        zipCode: lead.zipCode,
        leadValue: undefined,
        maxParticipants: config.maxParticipants,
        requireMinBid: config.requireMinimumBid,
        minBidThreshold: config.minimumBid
      });

      logger.info('Auction eligibility determined', {
        leadId: lead.id,
        serviceTypeId: lead.serviceTypeId,
        zipCode: lead.zipCode,
        eligible: eligibilityResult.eligibleCount,
        excluded: eligibilityResult.excludedCount
      });

      // Convert to the format expected by the auction engine
      const eligibleBuyers: EligibleBuyerWithConfig[] = [];

      for (const eligibleBuyer of eligibilityResult.eligible) {
        // Get the buyer configuration - first try hardcoded registry, then database
        let buyerConfig = BuyerConfigurationRegistry.get(eligibleBuyer.buyerId);
        let serviceConfig = BuyerConfigurationRegistry.getServiceConfig(
          eligibleBuyer.buyerId,
          lead.serviceTypeId
        );

        // If not in hardcoded registry, load from database
        // This allows contractors and admin-configured buyers to participate
        if (!buyerConfig || !serviceConfig) {
          const dbConfig = await loadBuyerConfigForAuction(
            eligibleBuyer.buyerId,
            lead.serviceTypeId
          );

          if (dbConfig) {
            buyerConfig = dbConfig.buyerConfig;
            serviceConfig = dbConfig.serviceConfig;
            logger.info('Loaded buyer configuration from database', {
              buyerId: eligibleBuyer.buyerId,
              serviceTypeId: lead.serviceTypeId,
              buyerName: buyerConfig.name
            });
          } else {
            logger.warn('Buyer configuration not found in registry or database', {
              buyerId: eligibleBuyer.buyerId,
              serviceTypeId: lead.serviceTypeId
            });
            continue;
          }
        }

        // Additional compliance and restriction checks
        if (!this.meetsComplianceRequirements(lead, buyerConfig, serviceConfig)) {
          continue;
        }

        if (!this.meetsTimeRestrictions(serviceConfig)) {
          continue;
        }

        eligibleBuyers.push({
          buyer: buyerConfig,
          serviceConfig,
          serviceZone: eligibleBuyer.serviceZone,
          eligibilityScore: eligibleBuyer.eligibilityScore
        });
      }

      // Sort by eligibility score
      eligibleBuyers.sort((a, b) => b.eligibilityScore - a.eligibilityScore);

      return eligibleBuyers;

    } catch (error) {
      logger.error('Failed to get eligible buyers for auction', {
        leadId: lead.id,
        serviceTypeId: lead.serviceTypeId,
        zipCode: lead.zipCode,
        error: (error as Error).message
      });
      
      // Fallback to original method if service zone system fails
      return this.getFallbackEligibleBuyers(lead, config);
    }
  }

  /**
   * Fallback method using original buyer selection logic
   */
  private static async getFallbackEligibleBuyers(
    lead: LeadData,
    config: AuctionConfig
  ): Promise<EligibleBuyerWithConfig[]> {
    logger.warn('Using fallback buyer selection method', {
      leadId: lead.id,
      serviceTypeId: lead.serviceTypeId,
      zipCode: lead.zipCode
    });

    // Get all buyers that support this service type
    const buyers = BuyerConfigurationRegistry.getBuyersForService(lead.serviceTypeId);
    const eligibleBuyers: EligibleBuyerWithConfig[] = [];

    for (const buyer of buyers) {
      const serviceConfig = BuyerConfigurationRegistry.getServiceConfig(
        buyer.id,
        lead.serviceTypeId
      );

      if (!serviceConfig || !serviceConfig.active) continue;

      // Check compliance requirements
      if (!this.meetsComplianceRequirements(lead, buyer, serviceConfig)) {
        continue;
      }

      // Check geographic restrictions (fallback method)
      if (!this.meetsGeoRestrictions(lead, serviceConfig)) {
        continue;
      }

      // Check time restrictions
      if (!this.meetsTimeRestrictions(serviceConfig)) {
        continue;
      }

      // Check lead volume limits
      if (!await this.meetsVolumeRestrictions(buyer.id, serviceConfig)) {
        continue;
      }

      eligibleBuyers.push({ 
        buyer, 
        serviceConfig,
        eligibilityScore: 100 // Default score for fallback
      });

      // Respect max participants limit
      if (eligibleBuyers.length >= config.maxParticipants) {
        break;
      }
    }

    return eligibleBuyers;
  }

  /**
   * Process bid results from Promise.allSettled
   *
   * WHY: Collect ALL ping responses for accurate reporting and cascade delivery
   * WHEN: After all parallel PING requests complete
   * HOW: Include both successful and failed bids - failures are tracked for analytics
   *      but excluded from winner selection. This ensures allBids reflects all buyers
   *      who were pinged, not just those with valid bids.
   */
  private static processBidResults(
    bidResults: PromiseSettledResult<BidResponse>[],
    buyers: EligibleBuyerWithConfig[]
  ): BidResponse[] {
    const allBids: BidResponse[] = [];

    for (let i = 0; i < bidResults.length; i++) {
      const result = bidResults[i];
      const buyer = buyers[i];

      if (result.status === 'fulfilled') {
        // Include ALL fulfilled responses - successful or not
        // Failed responses (success=false) are tracked for analytics but won't be selected as winner
        allBids.push(result.value);
      } else {
        // Promise rejected - create error bid response
        allBids.push({
          buyerId: buyer.buyer.id,
          bidAmount: 0,
          success: false,
          responseTime: 0,
          error: 'Promise rejected: ' + result.reason
        });
      }
    }

    return allBids;
  }

  /**
   * Select auction winner based on configuration
   */
  private static selectWinner(
    bids: BidResponse[],
    config: AuctionConfig
  ): BidResponse | undefined {
    // Filter successful bids
    const validBids = bids.filter(bid => bid.success && bid.bidAmount > 0);

    if (validBids.length === 0) {
      return undefined;
    }

    // Apply minimum bid requirement
    let eligibleBids = validBids;
    if (config.requireMinimumBid) {
      eligibleBids = validBids.filter(bid => bid.bidAmount >= config.minimumBid);
    }

    if (eligibleBids.length === 0) {
      return undefined;
    }

    // Find highest bid
    const maxBid = Math.max(...eligibleBids.map(bid => bid.bidAmount));
    const topBids = eligibleBids.filter(bid => bid.bidAmount === maxBid);

    // Handle tied bids
    if (topBids.length === 1) {
      return topBids[0];
    }

    if (!config.allowTiedBids) {
      return this.breakTie(topBids, config.tiebreakStrategy);
    }

    // Return first tied bid if ties are allowed
    return topBids[0];
  }

  /**
   * Break ties using specified strategy
   */
  private static breakTie(
    tiedBids: BidResponse[],
    strategy: 'random' | 'priority' | 'responseTime'
  ): BidResponse {
    switch (strategy) {
      case 'random':
        return tiedBids[Math.floor(Math.random() * tiedBids.length)];

      case 'responseTime':
        // Fastest response wins
        return tiedBids.reduce((fastest, current) =>
          current.responseTime < fastest.responseTime ? current : fastest
        );

      case 'priority':
        // This would require priority data in the bid response
        // For now, fall back to random
        return tiedBids[Math.floor(Math.random() * tiedBids.length)];

      default:
        return tiedBids[0];
    }
  }

  /**
   * Validate bid amount against pricing configuration
   */
  private static validateBid(
    bidAmount: number,
    serviceConfig: BuyerServiceConfig
  ): number {
    if (isNaN(bidAmount) || bidAmount <= 0) {
      return 0;
    }

    const { minBid, maxBid } = serviceConfig.pricing;

    // Clamp bid to valid range
    return Math.max(minBid, Math.min(maxBid, bidAmount));
  }

  /**
   * @deprecated Use BuyerResponseParser.parsePingResponse() instead.
   * This method is kept for backwards compatibility but is no longer called.
   * The new parser supports configurable field names per buyer.
   */
  private static extractBidAmount(responseData: any, _buyer: BuyerConfig): number {
    // Legacy implementation - use BuyerResponseParser instead
    const bidFields = [
      'bidAmount', 'bid_amount', 'price', 'cost',
      'offer', 'amount', 'value', 'lead_price'
    ];

    for (const field of bidFields) {
      if (responseData[field] !== undefined) {
        const amount = parseFloat(responseData[field]);
        if (!isNaN(amount)) {
          return amount;
        }
      }
    }

    if (responseData.interested === true || responseData.accept === true) {
      return 0; // Would need base price from service config
    }

    return 0;
  }

  /**
   * Prepare HTTP headers for buyer requests
   */
  private static prepareHeaders(
    buyer: BuyerConfig,
    serviceConfig: BuyerServiceConfig,
    requestType: 'PING' | 'POST'
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Type': requestType,
      'X-Service-Type': serviceConfig.serviceTypeName,
      'X-Lead-Source': 'contractor-platform',
      'X-Timestamp': new Date().toISOString()
    };

    // Add authentication headers
    const { authConfig } = buyer;
    switch (authConfig.type) {
      case 'apiKey':
        headers['X-API-Key'] = authConfig.credentials.apiKey;
        break;
      case 'bearer':
        headers['Authorization'] = `Bearer ${authConfig.credentials.token}`;
        break;
      case 'basic':
        const credentials = btoa(`${authConfig.credentials.username}:${authConfig.credentials.password}`);
        headers['Authorization'] = `Basic ${credentials}`;
        break;
    }

    // Add custom headers
    if (authConfig.headers) {
      Object.assign(headers, authConfig.headers);
    }

    if (serviceConfig.webhookConfig?.headers) {
      Object.assign(headers, serviceConfig.webhookConfig.headers);
    }

    return headers;
  }

  /**
   * Check compliance requirements
   */
  private static meetsComplianceRequirements(
    lead: LeadData,
    buyer: BuyerConfig,
    serviceConfig: BuyerServiceConfig
  ): boolean {
    const requirements = buyer.globalSettings.complianceRequirements;

    if (requirements.requireTrustedForm && !lead.trustedFormCertId) {
      return false;
    }

    if (requirements.requireJornaya && !lead.jornayaLeadId) {
      return false;
    }

    if (requirements.requireTcpaConsent && !lead.complianceData?.tcpaConsent) {
      return false;
    }

    return true;
  }

  /**
   * Check geographic restrictions
   */
  private static meetsGeoRestrictions(
    lead: LeadData,
    serviceConfig: BuyerServiceConfig
  ): boolean {
    const restrictions = serviceConfig.restrictions?.geoRestrictions;
    if (!restrictions || restrictions.length === 0) {
      return true;
    }

    // Implement geo restriction logic based on ZIP code, state, etc.
    // This is a simplified version
    for (const restriction of restrictions) {
      if (restriction.type === 'exclude' && restriction.zipCodes?.includes(lead.zipCode)) {
        return false;
      }
      if (restriction.type === 'include' && !restriction.zipCodes?.includes(lead.zipCode)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check time restrictions
   */
  private static meetsTimeRestrictions(serviceConfig: BuyerServiceConfig): boolean {
    const restrictions = serviceConfig.restrictions?.timeRestrictions;
    if (!restrictions || restrictions.length === 0) {
      return true;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    for (const restriction of restrictions) {
      if (restriction.dayOfWeek && !restriction.dayOfWeek.includes(currentDay)) {
        return false;
      }
      if (restriction.startHour && currentHour < restriction.startHour) {
        return false;
      }
      if (restriction.endHour && currentHour > restriction.endHour) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check volume restrictions
   */
  private static async meetsVolumeRestrictions(
    buyerId: string,
    serviceConfig: BuyerServiceConfig
  ): Promise<boolean> {
    const limit = serviceConfig.restrictions?.leadVolumeLimit;
    if (!limit) {
      return true;
    }

    // Check current daily volume for this buyer
    const todayCount = await this.getBuyerDailyVolume(buyerId);
    return todayCount < limit;
  }

  /**
   * Get buyer's daily lead volume
   */
  private static async getBuyerDailyVolume(buyerId: string): Promise<number> {
    try {
      const { prisma } = await import('../db');
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const count = await prisma.transaction.count({
        where: {
          buyerId,
          actionType: 'POST',
          status: 'SUCCESS',
          createdAt: {
            gte: startOfDay
          }
        }
      });

      return count;
    } catch (error) {
      logger.error('Failed to get buyer daily volume', {
        buyerId,
        error: (error as Error).message
      });
      return 0;
    }
  }

  /**
   * Get winning bid for a lead
   */
  private static async getWinningBid(leadId: string): Promise<number> {
    try {
      const { prisma } = await import('../db');

      // Find the highest successful PING bid for this lead
      const winningTransaction = await prisma.transaction.findFirst({
        where: {
          leadId,
          actionType: 'PING',
          status: 'SUCCESS',
          bidAmount: {
            not: null
          }
        },
        orderBy: {
          bidAmount: 'desc'
        },
        select: {
          bidAmount: true
        }
      });

      return winningTransaction?.bidAmount ? Number(winningTransaction.bidAmount) : 0;
    } catch (error) {
      logger.error('Failed to get winning bid', {
        leadId,
        error: (error as Error).message
      });
      return 0;
    }
  }

  /**
   * Log transaction for audit trail
   *
   * @param leadId - Lead ID
   * @param buyerId - Buyer ID
   * @param actionType - PING, POST, or DELIVERY
   * @param details - Transaction details including new winner/loser tracking fields:
   *   - isWinner: Boolean indicating if this buyer won the auction
   *   - lostReason: Why they lost (OUTBID, TIMEOUT, NO_BID, etc.)
   *   - winningBidAmount: The winning bid amount (for analytics)
   *   - cascadePosition: Position in cascade delivery (1 = first attempt)
   *   - deliveryMethod: For contractors (EMAIL, WEBHOOK, DASHBOARD)
   */
  private static async logTransaction(
    leadId: string,
    buyerId: string,
    actionType: 'PING' | 'POST' | 'DELIVERY',
    details: any
  ): Promise<void> {
    // Determine status: SUCCESS, FAILED, or TIMEOUT
    const getStatus = (): 'success' | 'failed' | 'timeout' => {
      if (details.success) return 'success';
      if (details.isTimeout) return 'timeout';
      return 'failed';
    };

    const getDbStatus = (): 'SUCCESS' | 'FAILED' | 'TIMEOUT' => {
      if (details.success) return 'SUCCESS';
      if (details.isTimeout) return 'TIMEOUT';
      return 'FAILED';
    };

    const status = getStatus();
    const dbStatus = getDbStatus();

    const log: TransactionLog = {
      id: this.generateTransactionId(),
      leadId,
      buyerId,
      actionType,
      status,
      payload: details.request || {},
      response: details.response,
      responseTime: details.responseTime || details.deliveryTime || 0,
      errorMessage: details.error,
      retryCount: 0,
      timestamp: new Date(),
      metadata: details
    };

    this.transactionLogs.push(log);

    // Persist to database
    try {
      const { prisma } = await import('../db');
      await prisma.transaction.create({
        data: {
          leadId,
          buyerId,
          actionType,
          payload: JSON.stringify(details.request || {}),
          response: details.response ? JSON.stringify(details.response) : null,
          status: dbStatus,
          bidAmount: details.bidAmount || null,
          responseTime: details.responseTime || details.deliveryTime || 0,
          errorMessage: details.error || null,
          complianceIncluded: details.includeCompliance || false,
          trustedFormPresent: !!details.trustedFormCertId,
          jornayaPresent: !!details.jornayaLeadId,
          // New winner/loser tracking fields (supports lead-flow.mmd diagram)
          isWinner: details.isWinner ?? null,
          lostReason: details.lostReason ?? null,
          winningBidAmount: details.winningBidAmount ?? null,
          cascadePosition: details.cascadePosition ?? null,
          deliveryMethod: details.deliveryMethod ?? null,
        }
      });

      logger.info('Transaction persisted', {
        actionType,
        buyerId,
        status: dbStatus,
        responseTime: details.responseTime || details.deliveryTime || 0,
        isTimeout: details.isTimeout || false,
      });
    } catch (error) {
      console.error('Failed to persist transaction to database:', error);
      // Don't throw - we don't want to fail the auction if logging fails
    }
  }

  /**
   * Update PING transactions with winner/loser status after auction completes
   * This is called after selectWinner() to mark all PING participants
   *
   * WHY: PING transactions are logged before we know the winner. This updates them.
   * WHEN: Called immediately after winner selection in runAuction()
   * HOW: Bulk update using leadId + actionType filter, sets isWinner/lostReason
   *
   * @param leadId - Lead ID to update transactions for
   * @param winningBuyerId - The buyer who won (null if no winner)
   * @param winningBidAmount - The winning bid amount
   * @param allBids - All bids from the auction (to determine lost reasons)
   */
  private static async updatePingTransactionsWithWinnerStatus(
    leadId: string,
    winningBuyerId: string | undefined,
    winningBidAmount: number | undefined,
    allBids: BidResponse[]
  ): Promise<void> {
    try {
      const { prisma } = await import('../db');

      // Update each PING transaction with winner/loser status
      // Using individual updates to set correct lostReason per buyer
      for (const bid of allBids) {
        const isWinner = bid.buyerId === winningBuyerId;
        let lostReason: string | null = null;

        if (!isWinner) {
          // Determine why they lost
          if (!bid.success) {
            // Failed to respond - check if it was a timeout
            const errorLower = bid.error?.toLowerCase() || '';
            const isTimeout = errorLower.includes('timeout') || errorLower.includes('abort');
            lostReason = isTimeout ? 'TIMEOUT' : 'NO_BID';
          } else if (bid.bidAmount <= 0) {
            lostReason = 'NO_BID';
          } else {
            // They bid but lost - check why
            lostReason = 'OUTBID';
          }
        }

        await prisma.transaction.updateMany({
          where: {
            leadId,
            buyerId: bid.buyerId,
            actionType: 'PING',
          },
          data: {
            isWinner,
            lostReason,
            winningBidAmount: winningBidAmount ?? null,
          }
        });
      }

      logger.info('Updated PING transactions with winner status', {
        leadId,
        winningBuyerId,
        winningBidAmount,
        totalBids: allBids.length
      });
    } catch (error) {
      // Log but don't throw - analytics shouldn't break the auction
      logger.error('Failed to update PING transactions with winner status', {
        leadId,
        error: (error as Error).message
      });
    }
  }

  /**
   * Update performance metrics
   */
  private static updateMetrics(result: AuctionResult, buyers: EligibleBuyerWithConfig[]): void {
    // Update auction time
    this.performanceMetrics.averageAuctionTime = 
      (this.performanceMetrics.averageAuctionTime + result.auctionDurationMs) / 2;

    // Update response time
    const avgResponseTime = result.allBids.reduce((sum, bid) => sum + bid.responseTime, 0) / result.allBids.length;
    this.performanceMetrics.averageResponseTime = 
      (this.performanceMetrics.averageResponseTime + avgResponseTime) / 2;

    // Update participation rate
    this.performanceMetrics.participationRate = result.allBids.length / buyers.length;

    // Update win rates
    if (result.winningBuyerId) {
      if (!this.performanceMetrics.winRate[result.winningBuyerId]) {
        this.performanceMetrics.winRate[result.winningBuyerId] = 0;
      }
      this.performanceMetrics.winRate[result.winningBuyerId]++;
    }

    // Update bid distribution
    for (const bid of result.allBids) {
      const range = this.getBidRange(bid.bidAmount);
      if (!this.performanceMetrics.bidDistribution[range]) {
        this.performanceMetrics.bidDistribution[range] = 0;
      }
      this.performanceMetrics.bidDistribution[range]++;
    }
  }

  /**
   * Get bid range for distribution tracking
   */
  private static getBidRange(amount: number): string {
    if (amount <= 25) return '0-25';
    if (amount <= 50) return '26-50';
    if (amount <= 100) return '51-100';
    if (amount <= 200) return '101-200';
    return '200+';
  }

  /**
   * Create failed auction result
   */
  private static createFailedResult(
    leadId: string,
    reason: string,
    bids: BidResponse[]
  ): AuctionResult {
    return {
      leadId,
      allBids: bids,
      auctionDurationMs: 0,
      participantCount: 0,
      status: 'failed'
    };
  }

  /**
   * Generate unique auction ID
   */
  private static generateAuctionId(leadId: string): string {
    return `auction_${leadId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique transaction ID
   */
  private static generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default auction configuration
   */
  private static getDefaultConfig(): AuctionConfig {
    return {
      maxParticipants: 10,
      timeoutMs: 5000,
      requireMinimumBid: true,
      minimumBid: 10,
      allowTiedBids: false,
      tiebreakStrategy: 'responseTime'
    };
  }

  /**
   * Get performance metrics
   */
  static getPerformanceMetrics(): PerformanceMetrics['auctionMetrics'] {
    return { ...this.performanceMetrics };
  }

  /**
   * Get transaction logs
   */
  static getTransactionLogs(leadId?: string, buyerId?: string): TransactionLog[] {
    let logs = [...this.transactionLogs];

    if (leadId) {
      logs = logs.filter(log => log.leadId === leadId);
    }

    if (buyerId) {
      logs = logs.filter(log => log.buyerId === buyerId);
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get active auction status
   */
  static getAuctionStatus(auctionId: string): AuctionState | undefined {
    return this.activeAuctions.get(auctionId);
  }

  /**
   * Cancel active auction
   */
  static cancelAuction(auctionId: string): boolean {
    const auction = this.activeAuctions.get(auctionId);
    if (auction && auction.status === 'running') {
      auction.status = 'cancelled';
      this.activeAuctions.delete(auctionId);
      return true;
    }
    return false;
  }
}

// Supporting interfaces
interface EligibleBuyerWithConfig {
  buyer: BuyerConfig;
  serviceConfig: BuyerServiceConfig;
  serviceZone?: any; // ServiceZone from eligibility service
  eligibilityScore: number;
}

interface AuctionState {
  auctionId: string;
  leadId: string;
  serviceTypeId: string;
  startTime: number;
  buyers: EligibleBuyerWithConfig[];
  bids: BidResponse[];
  winner?: BidResponse;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

export default AuctionEngine;