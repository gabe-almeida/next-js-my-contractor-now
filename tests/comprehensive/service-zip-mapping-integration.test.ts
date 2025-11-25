/**
 * Service-Zip Code Mapping Integration Tests
 * Tests integration of service zone mapping with auction engine and buyer eligibility
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { BuyerType } from '@/types/database';
import { BuyerEligibilityService } from '@/lib/services/buyer-eligibility-service';
import { ServiceZoneRepository } from '@/lib/repositories/service-zone-repository';

const prisma = new PrismaClient();

describe('Service-Zip Code Mapping Integration Tests', () => {
  let testContractor: any;
  let testNetworkBuyer: any;
  let testServiceType: any;

  beforeEach(async () => {
    // Clean up test data
    await prisma.buyerServiceZipCode.deleteMany();
    await prisma.buyerServiceConfig.deleteMany();
    await prisma.buyer.deleteMany({ where: { name: { contains: 'Test' } } });
    await prisma.serviceType.deleteMany({ where: { name: { contains: 'test' } } });

    // Create test service type
    testServiceType = await prisma.serviceType.create({
      data: {
        name: 'test-plumbing',
        displayName: 'Test Plumbing Services',
        formSchema: JSON.stringify({ fields: ['issueType', 'urgency', 'budget'] }),
        active: true
      }
    });

    // Create test contractor
    testContractor = await prisma.buyer.create({
      data: {
        name: 'Test Plumbing Contractor',
        type: BuyerType.CONTRACTOR,
        apiUrl: 'https://plumbingcontractor.com/api',
        active: true
      }
    });

    // Create test network buyer
    testNetworkBuyer = await prisma.buyer.create({
      data: {
        name: 'Test Plumbing Network',
        type: BuyerType.NETWORK,
        apiUrl: 'https://plumbingnetwork.com/api',
        active: true
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Service Zone Creation and Mapping', () => {
    it('should create service zones for contractor and network buyers', async () => {
      const zipCodes = ['10001', '10002', '10003'];
      
      // Create service zones for contractor
      const contractorZones = await prisma.buyerServiceZipCode.createMany({
        data: zipCodes.map(zipCode => ({
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id,
          zipCode,
          active: true,
          priority: 100,
          maxLeadsPerDay: 5,
          minBid: 50.00,
          maxBid: 200.00
        }))
      });

      // Create service zones for network buyer with different constraints
      const networkZones = await prisma.buyerServiceZipCode.createMany({
        data: zipCodes.map((zipCode, index) => ({
          buyerId: testNetworkBuyer.id,
          serviceTypeId: testServiceType.id,
          zipCode,
          active: true,
          priority: 150 + (index * 10), // Variable priority
          maxLeadsPerDay: 25,
          minBid: 40.00,
          maxBid: 300.00
        }))
      });

      expect(contractorZones.count).toBe(3);
      expect(networkZones.count).toBe(3);

      // Verify zones are correctly stored
      const allZones = await prisma.buyerServiceZipCode.findMany({
        where: { serviceTypeId: testServiceType.id },
        include: { buyer: true }
      });

      expect(allZones).toHaveLength(6); // 3 contractor + 3 network
      
      const contractorZoneCount = allZones.filter(zone => zone.buyer.type === 'CONTRACTOR').length;
      const networkZoneCount = allZones.filter(zone => zone.buyer.type === 'NETWORK').length;
      
      expect(contractorZoneCount).toBe(3);
      expect(networkZoneCount).toBe(3);
    });

    it('should handle overlapping service zones correctly', async () => {
      const commonZipCode = '10001';
      
      // Both buyers serve the same zip code with different constraints
      await prisma.buyerServiceZipCode.createMany({
        data: [
          {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: commonZipCode,
            active: true,
            priority: 80, // Lower priority
            maxLeadsPerDay: 3,
            minBid: 60.00,
            maxBid: 150.00
          },
          {
            buyerId: testNetworkBuyer.id,
            serviceTypeId: testServiceType.id,
            zipCode: commonZipCode,
            active: true,
            priority: 120, // Higher priority
            maxLeadsPerDay: 15,
            minBid: 45.00,
            maxBid: 250.00
          }
        ]
      });

      // Query overlapping zones
      const zones = await prisma.buyerServiceZipCode.findMany({
        where: {
          serviceTypeId: testServiceType.id,
          zipCode: commonZipCode
        },
        include: { buyer: true },
        orderBy: { priority: 'desc' }
      });

      expect(zones).toHaveLength(2);
      expect(zones[0].buyer.type).toBe('NETWORK'); // Higher priority first
      expect(zones[0].priority).toBe(120);
      expect(zones[1].buyer.type).toBe('CONTRACTOR');
      expect(zones[1].priority).toBe(80);
    });
  });

  describe('Buyer Eligibility Service Integration', () => {
    beforeEach(async () => {
      // Set up comprehensive service zone mapping
      await prisma.buyerServiceZipCode.createMany({
        data: [
          // Contractor coverage
          {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '10001',
            active: true,
            priority: 100,
            maxLeadsPerDay: 5,
            minBid: 50.00,
            maxBid: 200.00
          },
          {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '10002',
            active: true,
            priority: 90,
            maxLeadsPerDay: 3,
            minBid: 75.00,
            maxBid: 175.00
          },
          // Network coverage
          {
            buyerId: testNetworkBuyer.id,
            serviceTypeId: testServiceType.id,
            zipCode: '10001',
            active: true,
            priority: 150,
            maxLeadsPerDay: 20,
            minBid: 40.00,
            maxBid: 300.00
          },
          {
            buyerId: testNetworkBuyer.id,
            serviceTypeId: testServiceType.id,
            zipCode: '10003',
            active: true,
            priority: 140,
            maxLeadsPerDay: 15,
            minBid: 50.00,
            maxBid: 250.00
          }
        ]
      });
    });

    it('should return eligible buyers based on service zones', async () => {
      // Test zip code with both contractor and network coverage
      const result1 = await BuyerEligibilityService.getEligibleBuyers({
        serviceTypeId: testServiceType.id,
        zipCode: '10001'
      });

      expect(result1.eligibleCount).toBe(2);
      expect(result1.eligible.map(e => e.buyerId)).toContain(testContractor.id);
      expect(result1.eligible.map(e => e.buyerId)).toContain(testNetworkBuyer.id);

      // Network should have higher eligibility score due to higher priority
      const networkEligible = result1.eligible.find(e => e.buyerId === testNetworkBuyer.id);
      const contractorEligible = result1.eligible.find(e => e.buyerId === testContractor.id);
      
      expect(networkEligible!.eligibilityScore).toBeGreaterThan(contractorEligible!.eligibilityScore);

      // Test zip code with only contractor coverage
      const result2 = await BuyerEligibilityService.getEligibleBuyers({
        serviceTypeId: testServiceType.id,
        zipCode: '10002'
      });

      expect(result2.eligibleCount).toBe(1);
      expect(result2.eligible[0].buyerId).toBe(testContractor.id);

      // Test zip code with only network coverage
      const result3 = await BuyerEligibilityService.getEligibleBuyers({
        serviceTypeId: testServiceType.id,
        zipCode: '10003'
      });

      expect(result3.eligibleCount).toBe(1);
      expect(result3.eligible[0].buyerId).toBe(testNetworkBuyer.id);
    });

    it('should respect zip code specific constraints', async () => {
      const result = await BuyerEligibilityService.getEligibleBuyers({
        serviceTypeId: testServiceType.id,
        zipCode: '10002',
        requireMinBid: true,
        minBidThreshold: 100.00 // Above contractor's max bid for this zip
      });

      // Contractor should be excluded due to bid threshold
      expect(result.eligibleCount).toBe(0);
      expect(result.excludedCount).toBe(1);
      expect(result.excluded[0].reason).toBe('BID_TOO_LOW');
      expect(result.excluded[0].buyerId).toBe(testContractor.id);
    });

    it('should handle daily lead limits correctly', async () => {
      // Mock a scenario where contractor has reached daily limit
      jest.spyOn(BuyerEligibilityService as any, 'getDailyLeadCount')
        .mockImplementation(async (buyerId: string) => {
          if (buyerId === testContractor.id) {
            return 5; // At max limit
          }
          return 2; // Network buyer below limit
        });

      const result = await BuyerEligibilityService.getEligibleBuyers({
        serviceTypeId: testServiceType.id,
        zipCode: '10001'
      });

      // Only network buyer should be eligible
      expect(result.eligibleCount).toBe(1);
      expect(result.eligible[0].buyerId).toBe(testNetworkBuyer.id);
      
      // Contractor should be excluded due to daily limit
      expect(result.excludedCount).toBe(1);
      expect(result.excluded[0].reason).toBe('DAILY_LIMIT_EXCEEDED');
      expect(result.excluded[0].buyerId).toBe(testContractor.id);
    });
  });

  describe('Service Zone Repository Integration', () => {
    beforeEach(async () => {
      // Create comprehensive test data
      await prisma.buyerServiceZipCode.createMany({
        data: [
          {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '90210',
            active: true,
            priority: 100,
            maxLeadsPerDay: 8
          },
          {
            buyerId: testNetworkBuyer.id,
            serviceTypeId: testServiceType.id,
            zipCode: '90210',
            active: true,
            priority: 150,
            maxLeadsPerDay: 25
          }
        ]
      });

      // Add zip code metadata
      await prisma.zipCodeMetadata.upsert({
        where: { zipCode: '90210' },
        update: {},
        create: {
          zipCode: '90210',
          city: 'Beverly Hills',
          state: 'CA',
          county: 'Los Angeles',
          latitude: 34.0901,
          longitude: -118.4065
        }
      });
    });

    it('should retrieve service zones with proper buyer type distinction', async () => {
      const serviceZones = await ServiceZoneRepository.getEligibleBuyers(
        testServiceType.id,
        '90210'
      );

      expect(serviceZones).toHaveLength(2);
      
      const contractorZone = serviceZones.find(zone => zone.buyer?.type === 'CONTRACTOR');
      const networkZone = serviceZones.find(zone => zone.buyer?.type === 'NETWORK');
      
      expect(contractorZone).toBeDefined();
      expect(networkZone).toBeDefined();
      
      expect(contractorZone!.priority).toBe(100);
      expect(networkZone!.priority).toBe(150);
      expect(contractorZone!.maxLeadsPerDay).toBe(8);
      expect(networkZone!.maxLeadsPerDay).toBe(25);
    });

    it('should handle buyer service coverage analysis by type', async () => {
      // Add more coverage for testing
      await prisma.buyerServiceZipCode.createMany({
        data: [
          {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '90211',
            active: true,
            priority: 95
          },
          {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '90212',
            active: false, // Inactive
            priority: 85
          }
        ]
      });

      const contractorCoverage = await BuyerEligibilityService.getBuyerServiceCoverage(
        testContractor.id,
        testServiceType.id
      );

      expect(contractorCoverage.totalZipCodes).toBe(3); // Including inactive
      expect(contractorCoverage.activeZipCodes).toBe(2); // Only active
      expect(contractorCoverage.topZipCodes).toHaveLength(2);
      
      // Should be sorted by priority (descending)
      expect(contractorCoverage.topZipCodes[0].priority).toBe(100);
      expect(contractorCoverage.topZipCodes[1].priority).toBe(95);
    });

    it('should analyze service availability by zip code with buyer types', async () => {
      const availability = await BuyerEligibilityService.getServiceAvailability('90210');
      
      expect(availability.totalBuyers).toBe(2);
      expect(availability.activeBuyers).toBe(2);
      expect(availability.buyers).toHaveLength(2);
      
      // Should be sorted by priority
      expect(availability.buyers[0].priority).toBe(150); // Network buyer first
      expect(availability.buyers[1].priority).toBe(100); // Contractor second
      
      // Verify buyer type information is preserved
      const contractorInfo = availability.buyers.find(b => b.buyerId === testContractor.id);
      const networkInfo = availability.buyers.find(b => b.buyerId === testNetworkBuyer.id);
      
      expect(contractorInfo).toBeDefined();
      expect(networkInfo).toBeDefined();
    });
  });

  describe('Performance and Indexing', () => {
    beforeEach(async () => {
      // Create larger dataset for performance testing
      const zipCodes = Array.from({ length: 50 }, (_, i) => `1000${i.toString().padStart(2, '0')}`);
      const serviceZoneData: any[] = [];
      
      zipCodes.forEach(zipCode => {
        serviceZoneData.push(
          {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode,
            active: true,
            priority: Math.floor(Math.random() * 100) + 50
          },
          {
            buyerId: testNetworkBuyer.id,
            serviceTypeId: testServiceType.id,
            zipCode,
            active: Math.random() > 0.1, // 90% active
            priority: Math.floor(Math.random() * 100) + 100
          }
        );
      });

      await prisma.buyerServiceZipCode.createMany({ data: serviceZoneData });
    });

    it('should efficiently query service zones with compound indexes', async () => {
      const startTime = Date.now();
      
      // This query should use compound indexes efficiently
      const zones = await prisma.buyerServiceZipCode.findMany({
        where: {
          serviceTypeId: testServiceType.id,
          zipCode: { in: ['10001', '10002', '10003', '10004', '10005'] },
          active: true
        },
        include: { buyer: true },
        orderBy: { priority: 'desc' }
      });
      
      const queryTime = Date.now() - startTime;
      
      expect(zones.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(200); // Should be fast with proper indexing
      
      // Verify results are properly ordered
      for (let i = 1; i < zones.length; i++) {
        expect(zones[i - 1].priority).toBeGreaterThanOrEqual(zones[i].priority);
      }
    });

    it('should efficiently query buyers by type and service coverage', async () => {
      const startTime = Date.now();
      
      // Query should use buyer type index
      const contractorZones = await prisma.buyerServiceZipCode.findMany({
        where: {
          buyer: { type: BuyerType.CONTRACTOR },
          serviceTypeId: testServiceType.id,
          active: true
        },
        include: { buyer: true }
      });
      
      const queryTime = Date.now() - startTime;
      
      expect(contractorZones.length).toBe(50); // All contractor zones
      expect(queryTime).toBeLessThan(200);
      expect(contractorZones.every(zone => zone.buyer.type === 'CONTRACTOR')).toBe(true);
    });

    it('should handle concurrent eligibility queries efficiently', async () => {
      const zipCodes = ['10001', '10002', '10003', '10004', '10005'];
      const startTime = Date.now();
      
      // Run multiple eligibility queries concurrently
      const promises = zipCodes.map(zipCode =>
        BuyerEligibilityService.getEligibleBuyers({
          serviceTypeId: testServiceType.id,
          zipCode
        })
      );
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      expect(results).toHaveLength(5);
      expect(totalTime).toBeLessThan(1000); // Should handle concurrent queries efficiently
      
      // Verify all results are valid
      results.forEach((result, index) => {
        expect(result.totalFound).toBeGreaterThan(0);
        expect(result.eligibleCount).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle non-existent zip codes gracefully', async () => {
      const result = await BuyerEligibilityService.getEligibleBuyers({
        serviceTypeId: testServiceType.id,
        zipCode: '00000' // Non-existent zip code
      });

      expect(result.eligibleCount).toBe(0);
      expect(result.totalFound).toBe(0);
      expect(result.excluded).toHaveLength(0);
    });

    it('should handle inactive service types', async () => {
      // Create inactive service type
      const inactiveService = await prisma.serviceType.create({
        data: {
          name: 'inactive-service',
          displayName: 'Inactive Service',
          formSchema: '{}',
          active: false
        }
      });

      await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: testContractor.id,
          serviceTypeId: inactiveService.id,
          zipCode: '10001',
          active: true,
          priority: 100
        }
      });

      const result = await BuyerEligibilityService.getEligibleBuyers({
        serviceTypeId: inactiveService.id,
        zipCode: '10001'
      });

      // Should exclude buyer due to inactive service type
      expect(result.eligibleCount).toBe(0);
      expect(result.excludedCount).toBe(1);
      expect(result.excluded[0].reason).toBe('SERVICE_TYPE_INACTIVE');
    });

    it('should handle inactive buyers in service zones', async () => {
      // Deactivate contractor
      await prisma.buyer.update({
        where: { id: testContractor.id },
        data: { active: false }
      });

      await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id,
          zipCode: '10001',
          active: true,
          priority: 100
        }
      });

      const result = await BuyerEligibilityService.getEligibleBuyers({
        serviceTypeId: testServiceType.id,
        zipCode: '10001'
      });

      // Should exclude inactive buyer
      expect(result.eligibleCount).toBe(0);
      expect(result.excludedCount).toBe(1);
      expect(result.excluded[0].reason).toBe('BUYER_INACTIVE');
    });

    it('should handle mixed active/inactive service zones', async () => {
      await prisma.buyerServiceZipCode.createMany({
        data: [
          {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '10001',
            active: true,
            priority: 100
          },
          {
            buyerId: testNetworkBuyer.id,
            serviceTypeId: testServiceType.id,
            zipCode: '10001',
            active: false, // Inactive zone
            priority: 150
          }
        ]
      });

      const result = await BuyerEligibilityService.getEligibleBuyers({
        serviceTypeId: testServiceType.id,
        zipCode: '10001'
      });

      // Only active contractor should be eligible
      expect(result.eligibleCount).toBe(1);
      expect(result.eligible[0].buyerId).toBe(testContractor.id);
    });
  });
});