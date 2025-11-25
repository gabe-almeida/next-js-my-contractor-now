/**
 * Buyer Eligibility Service
 * Business logic for determining buyer eligibility based on service zones
 */

import { ServiceZoneRepository, ServiceZone } from '../repositories/service-zone-repository';
import { BuyerServiceConfig } from '../../types/database';
import { BuyerConfigurationRegistry } from '../buyers/configurations';
import { logger } from '../logger';
import { RedisCache } from '../../config/redis';

export interface EligibilityFilter {
  serviceTypeId: string;
  zipCode: string;
  leadValue?: number;
  timeframe?: string;
  excludeBuyers?: string[];
  maxParticipants?: number;
  requireMinBid?: boolean;
  minBidThreshold?: number;
}

export interface EligibleBuyer {
  buyerId: string;
  buyerName: string;
  serviceZone: ServiceZone;
  buyerConfig?: BuyerServiceConfig;
  eligibilityScore: number;
  constraints: {
    maxLeadsPerDay?: number;
    currentDailyCount: number;
    minBid?: number;
    maxBid?: number;
    priority: number;
  };
}

export interface EligibilityResult {
  eligible: EligibleBuyer[];
  excluded: {
    buyerId: string;
    buyerName: string;
    reason: string;
    details?: any;
  }[];
  totalFound: number;
  eligibleCount: number;
  excludedCount: number;
}

export class BuyerEligibilityService {
  private static readonly CACHE_PREFIX = 'eligibility:';
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Get eligible buyers for a specific service and location
   */
  static async getEligibleBuyers(filter: EligibilityFilter): Promise<EligibilityResult> {
    try {
      const cacheKey = this.generateCacheKey(filter);
      
      // Try cache first for frequently accessed combinations
      const cached = await RedisCache.get<EligibilityResult>(cacheKey);
      if (cached) {
        logger.debug('Eligibility result served from cache', { filter });
        return cached;
      }

      // Get all service zones for the given service type and zip code
      const serviceZones = await ServiceZoneRepository.getEligibleBuyers(
        filter.serviceTypeId,
        filter.zipCode
      );

      if (serviceZones.length === 0) {
        const result: EligibilityResult = {
          eligible: [],
          excluded: [],
          totalFound: 0,
          eligibleCount: 0,
          excludedCount: 0
        };

        // Cache empty results for shorter time
        await RedisCache.set(cacheKey, result, 60); // 1 minute

        return result;
      }

      // Process each service zone to determine eligibility
      const eligible: EligibleBuyer[] = [];
      const excluded: EligibilityResult['excluded'] = [];

      for (const serviceZone of serviceZones) {
        try {
          const eligibilityCheck = await this.checkBuyerEligibility(serviceZone, filter);
          
          if (eligibilityCheck.eligible) {
            eligible.push(eligibilityCheck.buyer!);
          } else {
            excluded.push({
              buyerId: serviceZone.buyerId,
              buyerName: serviceZone.buyer?.name || 'Unknown',
              reason: eligibilityCheck.reason!,
              details: eligibilityCheck.details
            });
          }
        } catch (error) {
          logger.warn('Error checking buyer eligibility', {
            buyerId: serviceZone.buyerId,
            error: (error as Error).message
          });
          
          excluded.push({
            buyerId: serviceZone.buyerId,
            buyerName: serviceZone.buyer?.name || 'Unknown',
            reason: 'ELIGIBILITY_CHECK_FAILED',
            details: { error: (error as Error).message }
          });
        }
      }

      // Sort eligible buyers by eligibility score (descending)
      eligible.sort((a, b) => b.eligibilityScore - a.eligibilityScore);

      // Apply max participants limit
      const limitedEligible = filter.maxParticipants 
        ? eligible.slice(0, filter.maxParticipants)
        : eligible;

      // Add excluded participants if we hit the limit
      if (filter.maxParticipants && eligible.length > filter.maxParticipants) {
        const limitExcluded = eligible.slice(filter.maxParticipants);
        limitExcluded.forEach(buyer => {
          excluded.push({
            buyerId: buyer.buyerId,
            buyerName: buyer.buyerName,
            reason: 'MAX_PARTICIPANTS_EXCEEDED',
            details: { maxParticipants: filter.maxParticipants }
          });
        });
      }

      const result: EligibilityResult = {
        eligible: limitedEligible,
        excluded,
        totalFound: serviceZones.length,
        eligibleCount: limitedEligible.length,
        excludedCount: excluded.length
      };

      // Cache the result
      await RedisCache.set(cacheKey, result, this.CACHE_TTL);

      logger.info('Buyer eligibility determined', {
        serviceTypeId: filter.serviceTypeId,
        zipCode: filter.zipCode,
        totalFound: result.totalFound,
        eligible: result.eligibleCount,
        excluded: result.excludedCount
      });

      return result;

    } catch (error) {
      logger.error('Failed to get eligible buyers', {
        filter,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Check if a specific buyer is eligible for a lead
   */
  static async isBuyerEligible(
    buyerId: string, 
    serviceTypeId: string, 
    zipCode: string
  ): Promise<boolean> {
    try {
      const serviceZones = await ServiceZoneRepository.findMany({
        buyerId,
        serviceTypeId,
        zipCode,
        active: true,
        includeRelations: true
      });

      if (serviceZones.length === 0) {
        return false;
      }

      // Check if buyer and service type are active
      const serviceZone = serviceZones[0];
      if (!serviceZone.buyer?.active || !serviceZone.serviceType?.active) {
        return false;
      }

      // Check daily lead limits
      const dailyCount = await this.getDailyLeadCount(buyerId, serviceTypeId);
      if (serviceZone.maxLeadsPerDay && dailyCount >= serviceZone.maxLeadsPerDay) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to check buyer eligibility', {
        buyerId,
        serviceTypeId,
        zipCode,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Get service coverage for a buyer
   */
  static async getBuyerServiceCoverage(
    buyerId: string, 
    serviceTypeId?: string
  ): Promise<{
    totalZipCodes: number;
    activeZipCodes: number;
    states: string[];
    topZipCodes: { zipCode: string; priority: number; city?: string; state?: string; }[];
  }> {
    try {
      const filter: any = { buyerId, includeRelations: false };
      if (serviceTypeId) {
        filter.serviceTypeId = serviceTypeId;
      }

      const serviceZones = await ServiceZoneRepository.findMany(filter);
      const activeZones = serviceZones.filter(zone => zone.active);

      // Get top zip codes by priority
      const topZipCodes = activeZones
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 20)
        .map(zone => ({
          zipCode: zone.zipCode,
          priority: zone.priority
        }));

      // Get zip code metadata for top zip codes
      const zipCodeDetails = await Promise.all(
        topZipCodes.map(async (zc) => {
          const metadata = await ServiceZoneRepository.getZipCodeMetadata(zc.zipCode);
          return {
            zipCode: zc.zipCode,
            priority: zc.priority,
            city: metadata?.city,
            state: metadata?.state
          };
        })
      );

      // Get unique states
      const states = Array.from(new Set(
        zipCodeDetails
          .map(zc => zc.state)
          .filter(state => state)
      )) as string[];

      return {
        totalZipCodes: serviceZones.length,
        activeZipCodes: activeZones.length,
        states,
        topZipCodes: zipCodeDetails
      };

    } catch (error) {
      logger.error('Failed to get buyer service coverage', {
        buyerId,
        serviceTypeId,
        error: (error as Error).message
      });
      
      return {
        totalZipCodes: 0,
        activeZipCodes: 0,
        states: [],
        topZipCodes: []
      };
    }
  }

  /**
   * Get service availability for a zip code
   */
  static async getServiceAvailability(
    zipCode: string,
    serviceTypeId?: string
  ): Promise<{
    totalBuyers: number;
    activeBuyers: number;
    averagePriority: number;
    buyers: {
      buyerId: string;
      buyerName: string;
      priority: number;
      active: boolean;
      constraints: any;
    }[];
  }> {
    try {
      const filter: any = { zipCode, includeRelations: true };
      if (serviceTypeId) {
        filter.serviceTypeId = serviceTypeId;
      }

      const serviceZones = await ServiceZoneRepository.findMany(filter);
      const activeBuyers = serviceZones.filter(zone => 
        zone.active && zone.buyer?.active && zone.serviceType?.active
      );

      const buyers = await Promise.all(
        serviceZones.map(async (zone) => ({
          buyerId: zone.buyerId,
          buyerName: zone.buyer?.name || 'Unknown',
          priority: zone.priority,
          active: zone.active && !!zone.buyer?.active && !!zone.serviceType?.active,
          constraints: {
            maxLeadsPerDay: zone.maxLeadsPerDay,
            currentDailyCount: await this.getDailyLeadCount(zone.buyerId, zone.serviceTypeId),
            minBid: zone.minBid,
            maxBid: zone.maxBid
          }
        }))
      );

      const averagePriority = serviceZones.length > 0
        ? serviceZones.reduce((sum, zone) => sum + zone.priority, 0) / serviceZones.length
        : 0;

      return {
        totalBuyers: serviceZones.length,
        activeBuyers: activeBuyers.length,
        averagePriority,
        buyers: buyers.sort((a, b) => b.priority - a.priority)
      };

    } catch (error) {
      logger.error('Failed to get service availability', {
        zipCode,
        serviceTypeId,
        error: (error as Error).message
      });
      
      return {
        totalBuyers: 0,
        activeBuyers: 0,
        averagePriority: 0,
        buyers: []
      };
    }
  }

  /**
   * Check individual buyer eligibility
   */
  private static async checkBuyerEligibility(
    serviceZone: ServiceZone, 
    filter: EligibilityFilter
  ): Promise<{
    eligible: boolean;
    buyer?: EligibleBuyer;
    reason?: string;
    details?: any;
  }> {
    const { buyerId, serviceTypeId } = serviceZone;

    // Check if buyer is in exclude list
    if (filter.excludeBuyers?.includes(buyerId)) {
      return {
        eligible: false,
        reason: 'BUYER_EXCLUDED',
        details: { excludedBuyers: filter.excludeBuyers }
      };
    }

    // Check if buyer and service type are active
    if (!serviceZone.buyer?.active) {
      return {
        eligible: false,
        reason: 'BUYER_INACTIVE',
        details: { buyerName: serviceZone.buyer?.name }
      };
    }

    if (!serviceZone.serviceType?.active) {
      return {
        eligible: false,
        reason: 'SERVICE_TYPE_INACTIVE',
        details: { serviceTypeName: serviceZone.serviceType?.name }
      };
    }

    // Check daily lead limits
    const currentDailyCount = await this.getDailyLeadCount(buyerId, serviceTypeId);
    if (serviceZone.maxLeadsPerDay && currentDailyCount >= serviceZone.maxLeadsPerDay) {
      return {
        eligible: false,
        reason: 'DAILY_LIMIT_EXCEEDED',
        details: { 
          maxLeadsPerDay: serviceZone.maxLeadsPerDay,
          currentDailyCount 
        }
      };
    }

    // Check bid requirements
    if (filter.requireMinBid && filter.minBidThreshold) {
      if (serviceZone.maxBid && serviceZone.maxBid < filter.minBidThreshold) {
        return {
          eligible: false,
          reason: 'BID_TOO_LOW',
          details: { 
            maxBid: serviceZone.maxBid,
            required: filter.minBidThreshold 
          }
        };
      }
    }

    // Get buyer configuration for additional eligibility checks
    let buyerConfig: BuyerServiceConfig | undefined;
    try {
      buyerConfig = BuyerConfigurationRegistry.getServiceConfig(buyerId, serviceTypeId);
    } catch (error) {
      logger.warn('Could not get buyer configuration', { 
        buyerId, 
        serviceTypeId, 
        error: (error as Error).message 
      });
    }

    // Calculate eligibility score
    const eligibilityScore = this.calculateEligibilityScore(serviceZone, buyerConfig, filter);

    const eligibleBuyer: EligibleBuyer = {
      buyerId,
      buyerName: serviceZone.buyer?.name || 'Unknown',
      serviceZone,
      buyerConfig,
      eligibilityScore,
      constraints: {
        maxLeadsPerDay: serviceZone.maxLeadsPerDay,
        currentDailyCount,
        minBid: serviceZone.minBid,
        maxBid: serviceZone.maxBid,
        priority: serviceZone.priority
      }
    };

    return {
      eligible: true,
      buyer: eligibleBuyer
    };
  }

  /**
   * Calculate eligibility score for ranking
   */
  private static calculateEligibilityScore(
    serviceZone: ServiceZone,
    buyerConfig?: BuyerServiceConfig,
    filter?: EligibilityFilter
  ): number {
    let score = 0;

    // Base priority score (0-100)
    score += serviceZone.priority;

    // Bid capacity bonus
    if (serviceZone.maxBid) {
      score += Math.min(serviceZone.maxBid * 0.1, 50); // Up to 50 points for high bids
    }

    // Daily capacity bonus
    if (serviceZone.maxLeadsPerDay) {
      const remainingCapacity = serviceZone.maxLeadsPerDay - (serviceZone.constraints?.currentDailyCount || 0);
      score += Math.min(remainingCapacity * 2, 20); // Up to 20 points for remaining capacity
    }

    // Buyer configuration bonus
    if (buyerConfig?.active) {
      score += 10;
      
      // Priority bonus from buyer config
      if (buyerConfig.priority) {
        score += buyerConfig.priority * 0.1;
      }
    }

    // Recency bonus (newer zones get slight preference)
    const daysSinceCreation = (Date.now() - serviceZone.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 30) {
      score += (30 - daysSinceCreation) * 0.1; // Up to 3 points for new zones
    }

    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get daily lead count for a buyer/service combination
   */
  private static async getDailyLeadCount(
    buyerId: string,
    serviceTypeId: string
  ): Promise<number> {
    const cacheKey = `daily-count:${buyerId}:${serviceTypeId}:${new Date().toISOString().split('T')[0]}`;

    try {
      // Try cache first
      const cached = await RedisCache.get<number>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Query database for successful POST transactions today
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
          },
          lead: {
            serviceTypeId
          }
        }
      });

      // Cache for 5 minutes to balance freshness and performance
      await RedisCache.set(cacheKey, count, 300);

      return count;
    } catch (error) {
      logger.warn('Failed to get daily lead count', {
        buyerId,
        serviceTypeId,
        error: (error as Error).message
      });
      return 0;
    }
  }

  /**
   * Generate cache key for eligibility queries
   */
  private static generateCacheKey(filter: EligibilityFilter): string {
    const keyParts = [
      `service:${filter.serviceTypeId}`,
      `zip:${filter.zipCode}`,
      filter.leadValue ? `value:${filter.leadValue}` : '',
      filter.maxParticipants ? `max:${filter.maxParticipants}` : '',
      filter.requireMinBid ? `minBid:${filter.minBidThreshold || 0}` : '',
      filter.excludeBuyers?.length ? `exclude:${filter.excludeBuyers.sort().join(',')}` : ''
    ].filter(Boolean).join('|');

    return `${this.CACHE_PREFIX}${keyParts}`;
  }
}

export default BuyerEligibilityService;