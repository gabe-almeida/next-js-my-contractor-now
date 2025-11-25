/**
 * Test Suite: Buyer Eligibility Service
 * Comprehensive tests for the buyer eligibility service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BuyerEligibilityService, EligibilityFilter, EligibleBuyer } from '../../../../src/lib/services/buyer-eligibility-service';
import { ServiceZoneRepository } from '../../../../src/lib/repositories/service-zone-repository';
import { BuyerConfigurationRegistry } from '../../../../src/lib/buyers/configurations';
import { RedisCache } from '../../../../src/config/redis';

// Mock dependencies
vi.mock('../../../../src/lib/repositories/service-zone-repository');
vi.mock('../../../../src/lib/buyers/configurations');
vi.mock('../../../../src/config/redis');
vi.mock('../../../../src/lib/logger');

describe('BuyerEligibilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getEligibleBuyers', () => {
    it('should return eligible buyers for a valid service and location', async () => {
      // Mock service zones
      const mockServiceZones = [
        {
          id: 'zone-1',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCode: '90210',
          active: true,
          priority: 95,
          maxLeadsPerDay: 100,
          minBid: 25,
          maxBid: 150,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          buyer: { id: 'buyer-1', name: 'HomeAdvisor', active: true },
          serviceType: { id: 'service-1', name: 'windows', displayName: 'Windows', active: true }
        },
        {
          id: 'zone-2',
          buyerId: 'buyer-2',
          serviceTypeId: 'service-1',
          zipCode: '90210',
          active: true,
          priority: 88,
          maxLeadsPerDay: 75,
          minBid: 20,
          maxBid: 120,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          buyer: { id: 'buyer-2', name: 'Modernize', active: true },
          serviceType: { id: 'service-1', name: 'windows', displayName: 'Windows', active: true }
        }
      ];

      vi.mocked(ServiceZoneRepository.getEligibleBuyers).mockResolvedValue(mockServiceZones);
      vi.mocked(BuyerConfigurationRegistry.get).mockReturnValue({
        id: 'buyer-1',
        name: 'HomeAdvisor',
        slug: 'homeadvisor',
        apiUrl: 'https://api.homeadvisor.com',
        authConfig: { type: 'bearer', credentials: { token: 'test' } },
        active: true,
        serviceConfigs: [],
        globalSettings: {
          defaultTimeout: 5000,
          maxConcurrentRequests: 10,
          rateLimiting: { requestsPerMinute: 100, requestsPerHour: 1000, requestsPerDay: 10000 },
          failoverSettings: { enabled: true, maxFailures: 3, cooldownPeriod: 300000 },
          complianceRequirements: {
            requireTrustedForm: true,
            requireJornaya: true,
            requireTcpaConsent: true,
            additionalRequirements: []
          }
        },
        metadata: { tier: 'premium', maxDailyLeads: 1000, avgResponseTime: 250, qualityScore: 9.2 }
      });

      vi.mocked(BuyerConfigurationRegistry.getServiceConfig).mockReturnValue({
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        serviceTypeName: 'Windows',
        active: true,
        priority: 95,
        pricing: { basePrice: 45, priceModifiers: [], maxBid: 150, minBid: 25, currency: 'USD' },
        pingTemplate: { mappings: [], includeCompliance: false },
        postTemplate: { mappings: [], includeCompliance: true },
        webhookConfig: {
          pingUrl: 'https://api.homeadvisor.com/ping',
          postUrl: 'https://api.homeadvisor.com/post',
          timeouts: { ping: 3000, post: 8000 },
          retryPolicy: { maxAttempts: 3, backoffStrategy: 'exponential', baseDelay: 1000, maxDelay: 10000 }
        }
      });

      vi.mocked(RedisCache.get).mockResolvedValue(null);
      vi.mocked(RedisCache.set).mockResolvedValue();

      const filter: EligibilityFilter = {
        serviceTypeId: 'service-1',
        zipCode: '90210',
        maxParticipants: 5
      };

      const result = await BuyerEligibilityService.getEligibleBuyers(filter);

      expect(result.eligible).toHaveLength(2);
      expect(result.eligible[0].buyerId).toBe('buyer-1');
      expect(result.eligible[0].buyerName).toBe('HomeAdvisor');
      expect(result.eligible[0].eligibilityScore).toBeGreaterThan(0);
      expect(result.excluded).toHaveLength(0);
      expect(result.totalFound).toBe(2);
      expect(result.eligibleCount).toBe(2);
    });

    it('should exclude inactive buyers', async () => {
      const mockServiceZones = [
        {
          id: 'zone-1',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCode: '90210',
          active: true,
          priority: 95,
          maxLeadsPerDay: 100,
          minBid: 25,
          maxBid: 150,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          buyer: { id: 'buyer-1', name: 'HomeAdvisor', active: false }, // Inactive buyer
          serviceType: { id: 'service-1', name: 'windows', displayName: 'Windows', active: true }
        }
      ];

      vi.mocked(ServiceZoneRepository.getEligibleBuyers).mockResolvedValue(mockServiceZones);
      vi.mocked(RedisCache.get).mockResolvedValue(null);
      vi.mocked(RedisCache.set).mockResolvedValue();

      const filter: EligibilityFilter = {
        serviceTypeId: 'service-1',
        zipCode: '90210'
      };

      const result = await BuyerEligibilityService.getEligibleBuyers(filter);

      expect(result.eligible).toHaveLength(0);
      expect(result.excluded).toHaveLength(1);
      expect(result.excluded[0].reason).toBe('BUYER_INACTIVE');
    });

    it('should respect daily lead limits', async () => {
      const mockServiceZones = [
        {
          id: 'zone-1',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCode: '90210',
          active: true,
          priority: 95,
          maxLeadsPerDay: 5, // Low limit
          minBid: 25,
          maxBid: 150,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          buyer: { id: 'buyer-1', name: 'HomeAdvisor', active: true },
          serviceType: { id: 'service-1', name: 'windows', displayName: 'Windows', active: true }
        }
      ];

      vi.mocked(ServiceZoneRepository.getEligibleBuyers).mockResolvedValue(mockServiceZones);
      vi.mocked(RedisCache.get).mockResolvedValue(null);
      vi.mocked(RedisCache.set).mockResolvedValue();
      
      // Mock high daily count (over limit)
      vi.mocked(RedisCache.get).mockImplementation((key) => {
        if (key.startsWith('daily-count:')) {
          return Promise.resolve(10); // Over the limit of 5
        }
        return Promise.resolve(null);
      });

      const filter: EligibilityFilter = {
        serviceTypeId: 'service-1',
        zipCode: '90210'
      };

      const result = await BuyerEligibilityService.getEligibleBuyers(filter);

      expect(result.eligible).toHaveLength(0);
      expect(result.excluded).toHaveLength(1);
      expect(result.excluded[0].reason).toBe('DAILY_LIMIT_EXCEEDED');
    });

    it('should respect max participants limit', async () => {
      const mockServiceZones = Array.from({ length: 10 }, (_, i) => ({
        id: `zone-${i + 1}`,
        buyerId: `buyer-${i + 1}`,
        serviceTypeId: 'service-1',
        zipCode: '90210',
        active: true,
        priority: 90 - i, // Decreasing priority
        maxLeadsPerDay: 100,
        minBid: 25,
        maxBid: 150,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        buyer: { id: `buyer-${i + 1}`, name: `Buyer ${i + 1}`, active: true },
        serviceType: { id: 'service-1', name: 'windows', displayName: 'Windows', active: true }
      }));

      vi.mocked(ServiceZoneRepository.getEligibleBuyers).mockResolvedValue(mockServiceZones);
      vi.mocked(BuyerConfigurationRegistry.get).mockReturnValue({
        id: 'buyer-1',
        name: 'Test Buyer',
        slug: 'test-buyer',
        apiUrl: 'https://api.test.com',
        authConfig: { type: 'bearer', credentials: { token: 'test' } },
        active: true,
        serviceConfigs: [],
        globalSettings: {
          defaultTimeout: 5000,
          maxConcurrentRequests: 10,
          rateLimiting: { requestsPerMinute: 100, requestsPerHour: 1000, requestsPerDay: 10000 },
          failoverSettings: { enabled: true, maxFailures: 3, cooldownPeriod: 300000 },
          complianceRequirements: {
            requireTrustedForm: false,
            requireJornaya: false,
            requireTcpaConsent: false,
            additionalRequirements: []
          }
        },
        metadata: { tier: 'standard', maxDailyLeads: 100, avgResponseTime: 300, qualityScore: 8.0 }
      });

      vi.mocked(BuyerConfigurationRegistry.getServiceConfig).mockReturnValue({
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        serviceTypeName: 'Windows',
        active: true,
        priority: 90,
        pricing: { basePrice: 45, priceModifiers: [], maxBid: 150, minBid: 25, currency: 'USD' },
        pingTemplate: { mappings: [], includeCompliance: false },
        postTemplate: { mappings: [], includeCompliance: true },
        webhookConfig: {
          pingUrl: 'https://api.test.com/ping',
          postUrl: 'https://api.test.com/post',
          timeouts: { ping: 3000, post: 8000 },
          retryPolicy: { maxAttempts: 3, backoffStrategy: 'exponential', baseDelay: 1000, maxDelay: 10000 }
        }
      });

      vi.mocked(RedisCache.get).mockResolvedValue(null);
      vi.mocked(RedisCache.set).mockResolvedValue();

      const filter: EligibilityFilter = {
        serviceTypeId: 'service-1',
        zipCode: '90210',
        maxParticipants: 3
      };

      const result = await BuyerEligibilityService.getEligibleBuyers(filter);

      expect(result.eligible).toHaveLength(3);
      expect(result.excluded.filter(e => e.reason === 'MAX_PARTICIPANTS_EXCEEDED')).toHaveLength(7);
      expect(result.totalFound).toBe(10);
      expect(result.eligibleCount).toBe(3);
    });

    it('should return cached results when available', async () => {
      const cachedResult = {
        eligible: [],
        excluded: [],
        totalFound: 0,
        eligibleCount: 0,
        excludedCount: 0
      };

      vi.mocked(RedisCache.get).mockResolvedValue(cachedResult);

      const filter: EligibilityFilter = {
        serviceTypeId: 'service-1',
        zipCode: '90210'
      };

      const result = await BuyerEligibilityService.getEligibleBuyers(filter);

      expect(result).toEqual(cachedResult);
      expect(ServiceZoneRepository.getEligibleBuyers).not.toHaveBeenCalled();
    });

    it('should handle minimum bid requirements', async () => {
      const mockServiceZones = [
        {
          id: 'zone-1',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCode: '90210',
          active: true,
          priority: 95,
          maxLeadsPerDay: 100,
          minBid: 25,
          maxBid: 50, // Low max bid
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          buyer: { id: 'buyer-1', name: 'HomeAdvisor', active: true },
          serviceType: { id: 'service-1', name: 'windows', displayName: 'Windows', active: true }
        }
      ];

      vi.mocked(ServiceZoneRepository.getEligibleBuyers).mockResolvedValue(mockServiceZones);
      vi.mocked(RedisCache.get).mockResolvedValue(null);
      vi.mocked(RedisCache.set).mockResolvedValue();

      const filter: EligibilityFilter = {
        serviceTypeId: 'service-1',
        zipCode: '90210',
        requireMinBid: true,
        minBidThreshold: 100 // Higher than max bid
      };

      const result = await BuyerEligibilityService.getEligibleBuyers(filter);

      expect(result.eligible).toHaveLength(0);
      expect(result.excluded).toHaveLength(1);
      expect(result.excluded[0].reason).toBe('BID_TOO_LOW');
    });
  });

  describe('isBuyerEligible', () => {
    it('should return true for eligible buyer', async () => {
      const mockServiceZones = [
        {
          id: 'zone-1',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCode: '90210',
          active: true,
          priority: 95,
          maxLeadsPerDay: 100,
          minBid: 25,
          maxBid: 150,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          buyer: { id: 'buyer-1', name: 'HomeAdvisor', active: true },
          serviceType: { id: 'service-1', name: 'windows', displayName: 'Windows', active: true }
        }
      ];

      vi.mocked(ServiceZoneRepository.findMany).mockResolvedValue(mockServiceZones);
      vi.mocked(RedisCache.get).mockResolvedValue(5); // Daily count below limit

      const result = await BuyerEligibilityService.isBuyerEligible('buyer-1', 'service-1', '90210');

      expect(result).toBe(true);
    });

    it('should return false for non-existent service zone', async () => {
      vi.mocked(ServiceZoneRepository.findMany).mockResolvedValue([]);

      const result = await BuyerEligibilityService.isBuyerEligible('buyer-1', 'service-1', '90210');

      expect(result).toBe(false);
    });

    it('should return false when daily limit exceeded', async () => {
      const mockServiceZones = [
        {
          id: 'zone-1',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCode: '90210',
          active: true,
          priority: 95,
          maxLeadsPerDay: 10,
          minBid: 25,
          maxBid: 150,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          buyer: { id: 'buyer-1', name: 'HomeAdvisor', active: true },
          serviceType: { id: 'service-1', name: 'windows', displayName: 'Windows', active: true }
        }
      ];

      vi.mocked(ServiceZoneRepository.findMany).mockResolvedValue(mockServiceZones);
      vi.mocked(RedisCache.get).mockResolvedValue(15); // Daily count above limit

      const result = await BuyerEligibilityService.isBuyerEligible('buyer-1', 'service-1', '90210');

      expect(result).toBe(false);
    });
  });

  describe('getBuyerServiceCoverage', () => {
    it('should return coverage information for buyer', async () => {
      const mockServiceZones = [
        {
          id: 'zone-1',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCode: '90210',
          active: true,
          priority: 95,
          maxLeadsPerDay: 100,
          minBid: 25,
          maxBid: 150,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: 'zone-2',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCode: '94102',
          active: false, // Inactive
          priority: 90,
          maxLeadsPerDay: 50,
          minBid: 20,
          maxBid: 120,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        }
      ];

      vi.mocked(ServiceZoneRepository.findMany).mockResolvedValue(mockServiceZones);
      vi.mocked(ServiceZoneRepository.getZipCodeMetadata)
        .mockResolvedValueOnce({ zipCode: '90210', city: 'Beverly Hills', state: 'CA', county: 'Los Angeles', latitude: 34.0901, longitude: -118.4065, timezone: 'America/Los_Angeles', active: true, createdAt: new Date(), updatedAt: new Date() })
        .mockResolvedValueOnce({ zipCode: '94102', city: 'San Francisco', state: 'CA', county: 'San Francisco', latitude: 37.7849, longitude: -122.4094, timezone: 'America/Los_Angeles', active: true, createdAt: new Date(), updatedAt: new Date() });

      const result = await BuyerEligibilityService.getBuyerServiceCoverage('buyer-1', 'service-1');

      expect(result.totalZipCodes).toBe(2);
      expect(result.activeZipCodes).toBe(1);
      expect(result.states).toContain('CA');
      expect(result.topZipCodes).toHaveLength(1);
      expect(result.topZipCodes[0].zipCode).toBe('90210');
    });
  });

  describe('getServiceAvailability', () => {
    it('should return service availability for location', async () => {
      const mockServiceZones = [
        {
          id: 'zone-1',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCode: '90210',
          active: true,
          priority: 95,
          maxLeadsPerDay: 100,
          minBid: 25,
          maxBid: 150,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          buyer: { id: 'buyer-1', name: 'HomeAdvisor', active: true },
          serviceType: { id: 'service-1', name: 'windows', displayName: 'Windows', active: true }
        }
      ];

      vi.mocked(ServiceZoneRepository.findMany).mockResolvedValue(mockServiceZones);
      vi.mocked(RedisCache.get).mockResolvedValue(5); // Daily count

      const result = await BuyerEligibilityService.getServiceAvailability('90210', 'service-1');

      expect(result.totalBuyers).toBe(1);
      expect(result.activeBuyers).toBe(1);
      expect(result.averagePriority).toBe(95);
      expect(result.buyers).toHaveLength(1);
      expect(result.buyers[0].buyerId).toBe('buyer-1');
      expect(result.buyers[0].active).toBe(true);
    });
  });
});

describe('Eligibility Scoring Algorithm', () => {
  it('should score buyers correctly based on priority and capacity', async () => {
    const mockServiceZones = [
      {
        id: 'zone-1',
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCode: '90210',
        active: true,
        priority: 100, // High priority
        maxLeadsPerDay: 100,
        minBid: 25,
        maxBid: 200, // High max bid
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        buyer: { id: 'buyer-1', name: 'Premium Buyer', active: true },
        serviceType: { id: 'service-1', name: 'windows', displayName: 'Windows', active: true }
      },
      {
        id: 'zone-2',
        buyerId: 'buyer-2',
        serviceTypeId: 'service-1',
        zipCode: '90210',
        active: true,
        priority: 50, // Low priority
        maxLeadsPerDay: 10,
        minBid: 10,
        maxBid: 50, // Low max bid
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        buyer: { id: 'buyer-2', name: 'Budget Buyer', active: true },
        serviceType: { id: 'service-1', name: 'windows', displayName: 'Windows', active: true }
      }
    ];

    vi.mocked(ServiceZoneRepository.getEligibleBuyers).mockResolvedValue(mockServiceZones);
    vi.mocked(BuyerConfigurationRegistry.get).mockImplementation((buyerId) => ({
      id: buyerId,
      name: `Buyer ${buyerId}`,
      slug: `buyer-${buyerId}`,
      apiUrl: 'https://api.test.com',
      authConfig: { type: 'bearer', credentials: { token: 'test' } },
      active: true,
      serviceConfigs: [],
      globalSettings: {
        defaultTimeout: 5000,
        maxConcurrentRequests: 10,
        rateLimiting: { requestsPerMinute: 100, requestsPerHour: 1000, requestsPerDay: 10000 },
        failoverSettings: { enabled: true, maxFailures: 3, cooldownPeriod: 300000 },
        complianceRequirements: {
          requireTrustedForm: false,
          requireJornaya: false,
          requireTcpaConsent: false,
          additionalRequirements: []
        }
      },
      metadata: { tier: 'standard', maxDailyLeads: 100, avgResponseTime: 300, qualityScore: 8.0 }
    }));

    vi.mocked(BuyerConfigurationRegistry.getServiceConfig).mockImplementation((buyerId) => ({
      buyerId,
      serviceTypeId: 'service-1',
      serviceTypeName: 'Windows',
      active: true,
      priority: buyerId === 'buyer-1' ? 95 : 85,
      pricing: { basePrice: 45, priceModifiers: [], maxBid: 150, minBid: 25, currency: 'USD' },
      pingTemplate: { mappings: [], includeCompliance: false },
      postTemplate: { mappings: [], includeCompliance: true },
      webhookConfig: {
        pingUrl: 'https://api.test.com/ping',
        postUrl: 'https://api.test.com/post',
        timeouts: { ping: 3000, post: 8000 },
        retryPolicy: { maxAttempts: 3, backoffStrategy: 'exponential', baseDelay: 1000, maxDelay: 10000 }
      }
    }));

    vi.mocked(RedisCache.get).mockResolvedValue(null);
    vi.mocked(RedisCache.set).mockResolvedValue();

    const filter: EligibilityFilter = {
      serviceTypeId: 'service-1',
      zipCode: '90210'
    };

    const result = await BuyerEligibilityService.getEligibleBuyers(filter);

    expect(result.eligible).toHaveLength(2);
    
    // Premium buyer should be ranked higher
    expect(result.eligible[0].buyerId).toBe('buyer-1');
    expect(result.eligible[0].eligibilityScore).toBeGreaterThan(result.eligible[1].eligibilityScore);
    
    // Budget buyer should be ranked lower
    expect(result.eligible[1].buyerId).toBe('buyer-2');
  });
});