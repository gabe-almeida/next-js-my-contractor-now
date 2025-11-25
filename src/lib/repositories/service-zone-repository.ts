/**
 * Service Zone Repository
 * Repository pattern for managing buyer service coverage areas
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';
import { RedisCache } from '../../config/redis';

// Initialize Prisma client
const prisma = new PrismaClient();

export interface ServiceZone {
  id: string;
  buyerId: string;
  serviceTypeId: string;
  zipCode: string;
  active: boolean;
  priority: number;
  maxLeadsPerDay?: number;
  minBid?: number;
  maxBid?: number;
  createdAt: Date;
  updatedAt: Date;
  buyer?: {
    id: string;
    name: string;
    active: boolean;
  };
  serviceType?: {
    id: string;
    name: string;
    displayName: string;
    active: boolean;
  };
}

export interface ServiceZoneFilter {
  buyerId?: string;
  serviceTypeId?: string;
  zipCode?: string;
  zipCodes?: string[];
  state?: string;
  active?: boolean;
  includeRelations?: boolean;
}

export interface ServiceZoneInput {
  buyerId: string;
  serviceTypeId: string;
  zipCode: string;
  active?: boolean;
  priority?: number;
  maxLeadsPerDay?: number;
  minBid?: number;
  maxBid?: number;
}

export interface BulkServiceZoneInput {
  buyerId: string;
  serviceTypeId: string;
  zipCodes: string[];
  active?: boolean;
  priority?: number;
  maxLeadsPerDay?: number;
  minBid?: number;
  maxBid?: number;
}

export interface ZipCodeMetadata {
  zipCode: string;
  city: string;
  state: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  active: boolean;
}

export class ServiceZoneRepository {
  private static readonly CACHE_PREFIX = 'service-zones:';
  private static readonly CACHE_TTL = 1800; // 30 minutes

  /**
   * Create a new service zone
   */
  static async create(input: ServiceZoneInput): Promise<ServiceZone> {
    try {
      // Validate buyer and service type exist and are active
      const buyer = await prisma.buyer.findUnique({
        where: { id: input.buyerId },
        select: { id: true, name: true, active: true }
      });

      if (!buyer) {
        throw new Error(`Buyer not found: ${input.buyerId}`);
      }

      if (!buyer.active) {
        throw new Error(`Buyer is not active: ${buyer.name}`);
      }

      const serviceType = await prisma.serviceType.findUnique({
        where: { id: input.serviceTypeId },
        select: { id: true, name: true, displayName: true, active: true }
      });

      if (!serviceType) {
        throw new Error(`Service type not found: ${input.serviceTypeId}`);
      }

      if (!serviceType.active) {
        throw new Error(`Service type is not active: ${serviceType.name}`);
      }

      // Create the service zone
      const serviceZone = await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: input.buyerId,
          serviceTypeId: input.serviceTypeId,
          zipCode: input.zipCode,
          active: input.active ?? true,
          priority: input.priority ?? 100,
          maxLeadsPerDay: input.maxLeadsPerDay,
          minBid: input.minBid,
          maxBid: input.maxBid,
        },
        include: {
          buyer: {
            select: { id: true, name: true, active: true }
          },
          serviceType: {
            select: { id: true, name: true, displayName: true, active: true }
          }
        }
      });

      // Clear relevant caches
      await this.clearCaches(input.buyerId, input.serviceTypeId, input.zipCode);

      logger.info('Service zone created', {
        serviceZoneId: serviceZone.id,
        buyerId: input.buyerId,
        serviceTypeId: input.serviceTypeId,
        zipCode: input.zipCode
      });

      return serviceZone;
    } catch (error) {
      logger.error('Failed to create service zone', {
        input,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Create multiple service zones in bulk
   */
  static async createBulk(input: BulkServiceZoneInput): Promise<ServiceZone[]> {
    try {
      // Validate buyer and service type exist and are active
      const buyer = await prisma.buyer.findUnique({
        where: { id: input.buyerId },
        select: { id: true, name: true, active: true }
      });

      if (!buyer) {
        throw new Error(`Buyer not found: ${input.buyerId}`);
      }

      if (!buyer.active) {
        throw new Error(`Buyer is not active: ${buyer.name}`);
      }

      const serviceType = await prisma.serviceType.findUnique({
        where: { id: input.serviceTypeId },
        select: { id: true, name: true, displayName: true, active: true }
      });

      if (!serviceType) {
        throw new Error(`Service type not found: ${input.serviceTypeId}`);
      }

      if (!serviceType.active) {
        throw new Error(`Service type is not active: ${serviceType.name}`);
      }

      // Create all service zones in a transaction
      const serviceZones = await prisma.$transaction(
        input.zipCodes.map(zipCode => 
          prisma.buyerServiceZipCode.upsert({
            where: {
              buyerId_serviceTypeId_zipCode: {
                buyerId: input.buyerId,
                serviceTypeId: input.serviceTypeId,
                zipCode: zipCode
              }
            },
            create: {
              buyerId: input.buyerId,
              serviceTypeId: input.serviceTypeId,
              zipCode: zipCode,
              active: input.active ?? true,
              priority: input.priority ?? 100,
              maxLeadsPerDay: input.maxLeadsPerDay,
              minBid: input.minBid,
              maxBid: input.maxBid,
            },
            update: {
              active: input.active ?? true,
              priority: input.priority ?? 100,
              maxLeadsPerDay: input.maxLeadsPerDay,
              minBid: input.minBid,
              maxBid: input.maxBid,
              updatedAt: new Date()
            },
            include: {
              buyer: {
                select: { id: true, name: true, active: true }
              },
              serviceType: {
                select: { id: true, name: true, displayName: true, active: true }
              }
            }
          })
        )
      );

      // Clear relevant caches
      await this.clearCaches(input.buyerId, input.serviceTypeId);

      logger.info('Bulk service zones created', {
        buyerId: input.buyerId,
        serviceTypeId: input.serviceTypeId,
        zipCodeCount: input.zipCodes.length
      });

      return serviceZones;
    } catch (error) {
      logger.error('Failed to create bulk service zones', {
        input,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get service zones by filter
   */
  static async findMany(filter: ServiceZoneFilter = {}): Promise<ServiceZone[]> {
    try {
      const cacheKey = this.generateCacheKey('findMany', filter);
      
      // Try cache first
      const cached = await RedisCache.get<ServiceZone[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Build where clause
      const where: any = {};
      
      if (filter.buyerId) {
        where.buyerId = filter.buyerId;
      }
      
      if (filter.serviceTypeId) {
        where.serviceTypeId = filter.serviceTypeId;
      }
      
      if (filter.zipCode) {
        where.zipCode = filter.zipCode;
      }
      
      if (filter.zipCodes && filter.zipCodes.length > 0) {
        where.zipCode = { in: filter.zipCodes };
      }
      
      if (filter.active !== undefined) {
        where.active = filter.active;
      }

      // Handle state filter (requires join with zip code metadata)
      if (filter.state) {
        const stateZipCodes = await this.getZipCodesByState(filter.state);
        where.zipCode = where.zipCode 
          ? { in: stateZipCodes.filter(zip => (where.zipCode as any).in?.includes(zip) || where.zipCode === zip) }
          : { in: stateZipCodes };
      }

      const include = filter.includeRelations ? {
        buyer: {
          select: { id: true, name: true, active: true }
        },
        serviceType: {
          select: { id: true, name: true, displayName: true, active: true }
        }
      } : undefined;

      const serviceZones = await prisma.buyerServiceZipCode.findMany({
        where,
        include,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ]
      });

      // Cache the result
      await RedisCache.set(cacheKey, serviceZones, this.CACHE_TTL);

      return serviceZones;
    } catch (error) {
      logger.error('Failed to find service zones', {
        filter,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get eligible buyers for a specific service type and zip code
   */
  static async getEligibleBuyers(serviceTypeId: string, zipCode: string): Promise<ServiceZone[]> {
    try {
      const cacheKey = this.generateCacheKey('eligible', { serviceTypeId, zipCode });
      
      // Try cache first
      const cached = await RedisCache.get<ServiceZone[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const eligibleBuyers = await prisma.buyerServiceZipCode.findMany({
        where: {
          serviceTypeId,
          zipCode,
          active: true,
          buyer: {
            active: true
          },
          serviceType: {
            active: true
          }
        },
        include: {
          buyer: {
            select: { id: true, name: true, active: true }
          },
          serviceType: {
            select: { id: true, name: true, displayName: true, active: true }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ]
      });

      // Cache the result with shorter TTL for frequently accessed data
      await RedisCache.set(cacheKey, eligibleBuyers, 900); // 15 minutes

      return eligibleBuyers;
    } catch (error) {
      logger.error('Failed to get eligible buyers', {
        serviceTypeId,
        zipCode,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Update a service zone
   */
  static async update(id: string, updates: Partial<ServiceZoneInput>): Promise<ServiceZone> {
    try {
      // Get existing service zone for cache invalidation
      const existing = await prisma.buyerServiceZipCode.findUnique({
        where: { id }
      });

      if (!existing) {
        throw new Error(`Service zone not found: ${id}`);
      }

      const serviceZone = await prisma.buyerServiceZipCode.update({
        where: { id },
        data: {
          active: updates.active,
          priority: updates.priority,
          maxLeadsPerDay: updates.maxLeadsPerDay,
          minBid: updates.minBid,
          maxBid: updates.maxBid,
          updatedAt: new Date()
        },
        include: {
          buyer: {
            select: { id: true, name: true, active: true }
          },
          serviceType: {
            select: { id: true, name: true, displayName: true, active: true }
          }
        }
      });

      // Clear relevant caches
      await this.clearCaches(existing.buyerId, existing.serviceTypeId, existing.zipCode);

      logger.info('Service zone updated', {
        serviceZoneId: id,
        updates
      });

      return serviceZone;
    } catch (error) {
      logger.error('Failed to update service zone', {
        id,
        updates,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Delete a service zone
   */
  static async delete(id: string): Promise<void> {
    try {
      // Get existing service zone for cache invalidation
      const existing = await prisma.buyerServiceZipCode.findUnique({
        where: { id }
      });

      if (!existing) {
        throw new Error(`Service zone not found: ${id}`);
      }

      await prisma.buyerServiceZipCode.delete({
        where: { id }
      });

      // Clear relevant caches
      await this.clearCaches(existing.buyerId, existing.serviceTypeId, existing.zipCode);

      logger.info('Service zone deleted', {
        serviceZoneId: id,
        buyerId: existing.buyerId,
        serviceTypeId: existing.serviceTypeId,
        zipCode: existing.zipCode
      });
    } catch (error) {
      logger.error('Failed to delete service zone', {
        id,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Delete multiple service zones
   */
  static async deleteBulk(filter: ServiceZoneFilter): Promise<number> {
    try {
      // Build where clause
      const where: any = {};
      
      if (filter.buyerId) {
        where.buyerId = filter.buyerId;
      }
      
      if (filter.serviceTypeId) {
        where.serviceTypeId = filter.serviceTypeId;
      }
      
      if (filter.zipCode) {
        where.zipCode = filter.zipCode;
      }
      
      if (filter.zipCodes && filter.zipCodes.length > 0) {
        where.zipCode = { in: filter.zipCodes };
      }

      const result = await prisma.buyerServiceZipCode.deleteMany({
        where
      });

      // Clear all related caches
      await this.clearCaches(filter.buyerId, filter.serviceTypeId);

      logger.info('Bulk service zones deleted', {
        filter,
        deletedCount: result.count
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to delete bulk service zones', {
        filter,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get zip code metadata
   */
  static async getZipCodeMetadata(zipCode: string): Promise<ZipCodeMetadata | null> {
    try {
      const metadata = await prisma.zipCodeMetadata.findUnique({
        where: { zipCode }
      });

      return metadata;
    } catch (error) {
      logger.error('Failed to get zip code metadata', {
        zipCode,
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Get all zip codes for a state
   */
  static async getZipCodesByState(state: string): Promise<string[]> {
    try {
      const cacheKey = `zip-codes:state:${state}`;
      
      // Try cache first
      const cached = await RedisCache.get<string[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const zipCodes = await prisma.zipCodeMetadata.findMany({
        where: { state: state.toUpperCase() },
        select: { zipCode: true }
      });

      const zipCodeList = zipCodes.map(z => z.zipCode);
      
      // Cache for 24 hours (zip codes don't change often)
      await RedisCache.set(cacheKey, zipCodeList, 86400);

      return zipCodeList;
    } catch (error) {
      logger.error('Failed to get zip codes by state', {
        state,
        error: (error as Error).message
      });
      return [];
    }
  }

  /**
   * Get service coverage statistics
   */
  static async getServiceCoverageStats(buyerId?: string, serviceTypeId?: string): Promise<{
    totalZones: number;
    activeZones: number;
    statesCovered: number;
    averagePriority: number;
  }> {
    try {
      const where: any = {};
      
      if (buyerId) {
        where.buyerId = buyerId;
      }
      
      if (serviceTypeId) {
        where.serviceTypeId = serviceTypeId;
      }

      const [totalZones, activeZones, avgPriority, stateData] = await Promise.all([
        prisma.buyerServiceZipCode.count({ where }),
        prisma.buyerServiceZipCode.count({ where: { ...where, active: true } }),
        prisma.buyerServiceZipCode.aggregate({
          where,
          _avg: { priority: true }
        }),
        prisma.buyerServiceZipCode.findMany({
          where,
          select: {
            zipCode: true
          }
        })
      ]);

      // Get unique states from zip codes
      const zipCodes = stateData.map(z => z.zipCode);
      const statesData = await prisma.zipCodeMetadata.findMany({
        where: {
          zipCode: { in: zipCodes }
        },
        select: { state: true },
        distinct: ['state']
      });

      return {
        totalZones,
        activeZones,
        statesCovered: statesData.length,
        averagePriority: avgPriority._avg.priority || 100
      };
    } catch (error) {
      logger.error('Failed to get service coverage stats', {
        buyerId,
        serviceTypeId,
        error: (error as Error).message
      });
      return {
        totalZones: 0,
        activeZones: 0,
        statesCovered: 0,
        averagePriority: 100
      };
    }
  }

  /**
   * Clear relevant caches
   */
  private static async clearCaches(buyerId?: string, serviceTypeId?: string, zipCode?: string): Promise<void> {
    const patterns = [
      `${this.CACHE_PREFIX}*`,
      'eligible:*',
      'zip-codes:*'
    ];

    // Clear specific cache patterns
    if (buyerId) {
      patterns.push(`*buyer:${buyerId}*`);
    }
    
    if (serviceTypeId) {
      patterns.push(`*service:${serviceTypeId}*`);
    }
    
    if (zipCode) {
      patterns.push(`*zip:${zipCode}*`);
    }

    try {
      await Promise.all(patterns.map(pattern => RedisCache.deletePattern(pattern)));
    } catch (error) {
      logger.warn('Failed to clear some caches', { error: (error as Error).message });
    }
  }

  /**
   * Generate cache key for queries
   */
  private static generateCacheKey(operation: string, params: any): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    
    return `${this.CACHE_PREFIX}${operation}:${sortedParams}`;
  }
}

export default ServiceZoneRepository;