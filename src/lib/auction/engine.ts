/**
 * Auction Engine
 * Parallel PING system with bid collection and winner selection
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
import { logger } from '../logger';

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
   */
  static async runAuction(
    lead: LeadData,
    config: AuctionConfig = this.getDefaultConfig()
  ): Promise<AuctionResult> {
    const auctionId = this.generateAuctionId(lead.id);
    const startTime = Date.now();

    try {
      // Get eligible buyers for this service type
      const eligibleBuyers = await this.getEligibleBuyers(lead, config);

      if (eligibleBuyers.length === 0) {
        return this.createFailedResult(lead.id, 'No eligible buyers found', []);
      }

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
      const bidPromises = eligibleBuyers.map(buyer =>
        this.sendPingToBuyer(lead, buyer, config.timeoutMs)
      );

      // Wait for all bids with timeout
      const bidResults = await Promise.allSettled(bidPromises);

      // Process bid results
      const validBids = this.processBidResults(bidResults, eligibleBuyers);
      auctionState.bids = validBids;

      // Apply auction logic to select winner
      const winner = this.selectWinner(validBids, config);
      auctionState.winner = winner;

      // Send POST to winning buyer if auction successful
      let postResult: PostResult | undefined;
      if (winner) {
        const winningBuyer = eligibleBuyers.find(b => b.buyer.id === winner.buyerId);
        if (winningBuyer) {
          postResult = await this.sendPostToWinner(lead, winningBuyer);
        }
      }

      // Create auction result
      const auctionDurationMs = Date.now() - startTime;
      const result: AuctionResult = {
        leadId: lead.id,
        winningBuyerId: winner?.buyerId,
        winningBidAmount: winner?.bidAmount,
        allBids: validBids,
        auctionDurationMs,
        participantCount: eligibleBuyers.length,
        status: winner ? 'completed' : (validBids.length > 0 ? 'no_bids' : 'failed'),
        postResult
      };

      // Update performance metrics
      this.updateMetrics(result, eligibleBuyers);

      // Clean up auction state
      this.activeAuctions.delete(auctionId);

      return result;

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
   * Send PING to individual buyer
   */
  private static async sendPingToBuyer(
    lead: LeadData,
    buyerConfig: EligibleBuyerWithConfig,
    timeoutMs: number
  ): Promise<BidResponse> {
    const startTime = Date.now();
    const { buyer, serviceConfig } = buyerConfig;

    try {
      // Transform lead data using buyer's PING template
      const payload = await TemplateEngine.transform(
        lead,
        buyer,
        serviceConfig.pingTemplate,
        serviceConfig.pingTemplate.includeCompliance
      );

      // Prepare request headers
      const headers = this.prepareHeaders(buyer, serviceConfig, 'PING');

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Send PING request
      const response = await fetch(serviceConfig.webhookConfig!.pingUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const responseData = await response.json();

      // Extract bid amount from response BEFORE logging
      const bidAmount = this.extractBidAmount(responseData, buyer);

      // Validate bid against pricing rules
      const validatedBid = this.validateBid(bidAmount, serviceConfig);

      // Log transaction with bid amount included
      await this.logTransaction(lead.id, buyer.id, 'PING', {
        request: payload,
        response: responseData,
        statusCode: response.status,
        responseTime,
        success: response.ok,
        bidAmount: validatedBid,
        originalBidAmount: bidAmount
      });

      return {
        buyerId: buyer.id,
        bidAmount: validatedBid,
        success: response.ok && validatedBid > 0,
        responseTime,
        metadata: {
          statusCode: response.status,
          originalBid: bidAmount,
          validated: validatedBid > 0
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Log failed transaction
      await this.logTransaction(lead.id, buyer.id, 'PING', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
        success: false
      });

      return {
        buyerId: buyer.id,
        bidAmount: 0,
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'PING request failed'
      };
    }
  }

  /**
   * Send POST to auction winner
   */
  private static async sendPostToWinner(
    lead: LeadData,
    winnerConfig: EligibleBuyerWithConfig
  ): Promise<PostResult> {
    const startTime = Date.now();
    const { buyer, serviceConfig } = winnerConfig;

    try {
      // Transform lead data using buyer's POST template
      const payload = await TemplateEngine.transform(
        lead,
        buyer,
        serviceConfig.postTemplate,
        true // Always include compliance for POST
      );

      // Add auction metadata
      payload.auction_winning_bid = await this.getWinningBid(lead.id);
      payload.auction_timestamp = new Date().toISOString();

      // Prepare request headers
      const headers = this.prepareHeaders(buyer, serviceConfig, 'POST');

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        serviceConfig.webhookConfig!.timeouts.post
      );

      // Send POST request
      const response = await fetch(serviceConfig.webhookConfig!.postUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const deliveryTime = Date.now() - startTime;
      const responseData = response.ok ? await response.json() : null;

      // Log transaction
      await this.logTransaction(lead.id, buyer.id, 'POST', {
        request: payload,
        response: responseData,
        statusCode: response.status,
        deliveryTime,
        success: response.ok
      });

      return {
        success: response.ok,
        statusCode: response.status,
        response: responseData,
        deliveryTime
      };

    } catch (error) {
      const deliveryTime = Date.now() - startTime;

      // Log failed transaction
      await this.logTransaction(lead.id, buyer.id, 'POST', {
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveryTime,
        success: false
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
        leadValue: lead.estimatedValue,
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
        // Get the buyer configuration
        const buyerConfig = BuyerConfigurationRegistry.get(eligibleBuyer.buyerId);
        const serviceConfig = BuyerConfigurationRegistry.getServiceConfig(
          eligibleBuyer.buyerId,
          lead.serviceTypeId
        );

        if (!buyerConfig || !serviceConfig) {
          logger.warn('Buyer configuration not found', {
            buyerId: eligibleBuyer.buyerId,
            serviceTypeId: lead.serviceTypeId
          });
          continue;
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
   */
  private static processBidResults(
    bidResults: PromiseSettledResult<BidResponse>[],
    buyers: EligibleBuyerWithConfig[]
  ): BidResponse[] {
    const validBids: BidResponse[] = [];

    for (let i = 0; i < bidResults.length; i++) {
      const result = bidResults[i];
      const buyer = buyers[i];

      if (result.status === 'fulfilled') {
        const bid = result.value;
        if (bid.success && bid.bidAmount > 0) {
          validBids.push(bid);
        }
      } else {
        // Create error bid response
        validBids.push({
          buyerId: buyer.buyer.id,
          bidAmount: 0,
          success: false,
          responseTime: 0,
          error: 'Promise rejected: ' + result.reason
        });
      }
    }

    return validBids;
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
   * Extract bid amount from buyer response
   */
  private static extractBidAmount(responseData: any, buyer: BuyerConfig): number {
    // Different buyers may use different field names for bid amount
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

    // If no bid amount found but response indicates interest, use base price
    if (responseData.interested === true || responseData.accept === true) {
      const serviceConfig = BuyerConfigurationRegistry.getServiceConfig(
        buyer.id,
        'default' // This would need to be passed in properly
      );
      return serviceConfig?.pricing.basePrice || 0;
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

      return winningTransaction?.bidAmount || 0;
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
   */
  private static async logTransaction(
    leadId: string,
    buyerId: string,
    actionType: 'PING' | 'POST',
    details: any
  ): Promise<void> {
    const log: TransactionLog = {
      id: this.generateTransactionId(),
      leadId,
      buyerId,
      actionType,
      status: details.success ? 'success' : 'failed',
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
          status: details.success ? 'SUCCESS' : 'FAILED',
          bidAmount: details.bidAmount || null,
          responseTime: details.responseTime || details.deliveryTime || 0,
          errorMessage: details.error || null,
          complianceIncluded: details.includeCompliance || false,
          trustedFormPresent: !!details.trustedFormCertId,
          jornayaPresent: !!details.jornayaLeadId,
        }
      });

      console.log(`Transaction persisted: ${actionType} ${buyerId} -> ${details.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.error('Failed to persist transaction to database:', error);
      // Don't throw - we don't want to fail the auction if logging fails
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
  buyers: EligibleBuyer[];
  bids: BidResponse[];
  winner?: BidResponse;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

export default AuctionEngine;