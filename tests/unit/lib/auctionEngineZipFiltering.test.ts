/**
 * Unit Tests for Auction Engine with ZIP Code Filtering
 * Tests auction participation logic based on service-zip mappings
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  mockBuyers,
  mockServiceTypes,
  mockBuyerServiceConfigs,
  mockServiceZipMappings,
  mockTestLeads,
  expectedParticipationResults,
  edgeCaseScenarios
} from '@/tests/fixtures/buyerServiceZipMappingData';

// Enhanced Auction Engine with ZIP filtering
class AuctionEngineWithZipFiltering {
  private buyerServiceZipMappings: any[];

  constructor(mappings: any[] = []) {
    this.buyerServiceZipMappings = mappings;
  }

  /**
   * Get eligible buyers for a lead based on service type and ZIP code
   */
  async getEligibleBuyersWithZipFiltering(
    serviceTypeId: string,
    zipCode: string,
    complianceData?: any
  ): Promise<{
    buyerId: string;
    priority: number;
    serviceConfig: any;
  }[]> {
    // Find all mappings for this service type and ZIP code
    const eligibleMappings = this.buyerServiceZipMappings.filter(mapping => 
      mapping.serviceTypeId === serviceTypeId &&
      mapping.zipCodes.includes(zipCode) &&
      mapping.active
    );

    if (eligibleMappings.length === 0) {
      return [];
    }

    // Get buyer service configs for eligible buyers
    const eligibleBuyers = [];
    
    for (const mapping of eligibleMappings) {
      const serviceConfig = mockBuyerServiceConfigs.find(config =>
        config.buyerId === mapping.buyerId &&
        config.serviceTypeId === serviceTypeId &&
        config.active
      );

      if (serviceConfig) {
        // Check compliance requirements
        if (this.meetsComplianceRequirements(serviceConfig, complianceData)) {
          eligibleBuyers.push({
            buyerId: mapping.buyerId,
            priority: mapping.priority,
            serviceConfig
          });
        }
      }
    }

    // Sort by priority (lower number = higher priority)
    return eligibleBuyers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check if lead meets buyer's compliance requirements
   */
  private meetsComplianceRequirements(serviceConfig: any, complianceData?: any): boolean {
    // TrustedForm requirement
    if (serviceConfig.requiresTrustedForm && !complianceData?.trustedFormCertId) {
      return false;
    }

    // Jornaya requirement  
    if (serviceConfig.requiresJornaya && !complianceData?.jornayaLeadId) {
      return false;
    }

    return true;
  }

  /**
   * Run auction with ZIP filtering
   */
  async runAuctionWithZipFiltering(lead: any): Promise<{
    leadId: string;
    eligibleBuyers: string[];
    participantCount: number;
    winningBuyerId?: string;
    allBids: any[];
    filterReasons: Record<string, string[]>;
  }> {
    const filterReasons: Record<string, string[]> = {};

    // Get eligible buyers based on ZIP code
    const eligibleBuyers = await this.getEligibleBuyersWithZipFiltering(
      lead.serviceTypeId,
      lead.zipCode,
      lead.complianceData ? JSON.parse(lead.complianceData) : undefined
    );

    // Track filtering reasons
    const allBuyersForService = mockBuyerServiceConfigs
      .filter(config => config.serviceTypeId === lead.serviceTypeId)
      .map(config => config.buyerId);

    for (const buyerId of allBuyersForService) {
      if (!eligibleBuyers.find(eb => eb.buyerId === buyerId)) {
        filterReasons[buyerId] = [];

        // Check if no ZIP coverage
        const hasZipCoverage = this.buyerServiceZipMappings.some(mapping =>
          mapping.buyerId === buyerId &&
          mapping.serviceTypeId === lead.serviceTypeId &&
          mapping.zipCodes.includes(lead.zipCode) &&
          mapping.active
        );

        if (!hasZipCoverage) {
          filterReasons[buyerId].push('No ZIP code coverage');
        }

        // Check compliance requirements
        const serviceConfig = mockBuyerServiceConfigs.find(config =>
          config.buyerId === buyerId && config.serviceTypeId === lead.serviceTypeId
        );

        if (serviceConfig && hasZipCoverage) {
          const complianceData = lead.complianceData ? JSON.parse(lead.complianceData) : {};
          
          if (serviceConfig.requiresTrustedForm && !complianceData.trustedFormCertId) {
            filterReasons[buyerId].push('Missing TrustedForm certificate');
          }
          
          if (serviceConfig.requiresJornaya && !complianceData.jornayaLeadId) {
            filterReasons[buyerId].push('Missing Jornaya lead ID');
          }
        }
      }
    }

    // Simulate bidding process
    const bids = eligibleBuyers.map(buyer => ({
      buyerId: buyer.buyerId,
      bidAmount: this.generateMockBid(buyer.serviceConfig),
      success: true,
      responseTime: Math.floor(Math.random() * 5000) + 1000
    }));

    // Select winner (highest bid)
    const winningBid = bids.length > 0 
      ? bids.reduce((prev, current) => prev.bidAmount > current.bidAmount ? prev : current)
      : undefined;

    return {
      leadId: lead.id,
      eligibleBuyers: eligibleBuyers.map(eb => eb.buyerId),
      participantCount: eligibleBuyers.length,
      winningBuyerId: winningBid?.buyerId,
      allBids: bids,
      filterReasons
    };
  }

  /**
   * Generate mock bid based on service config
   */
  private generateMockBid(serviceConfig: any): number {
    const { minBid, maxBid } = serviceConfig;
    return Math.floor(Math.random() * (maxBid - minBid) + minBid);
  }

  /**
   * Get coverage statistics for a buyer
   */
  getCoverageStats(buyerId: string): {
    totalServices: number;
    totalZipCodes: number;
    serviceBreakdown: Record<string, number>;
  } {
    const buyerMappings = this.buyerServiceZipMappings.filter(
      mapping => mapping.buyerId === buyerId && mapping.active
    );

    const allZipCodes = new Set<string>();
    const serviceBreakdown: Record<string, number> = {};

    buyerMappings.forEach(mapping => {
      mapping.zipCodes.forEach((zip: string) => allZipCodes.add(zip));
      
      const serviceName = mockServiceTypes.find(st => st.id === mapping.serviceTypeId)?.name || mapping.serviceTypeId;
      serviceBreakdown[serviceName] = mapping.zipCodes.length;
    });

    return {
      totalServices: buyerMappings.length,
      totalZipCodes: allZipCodes.size,
      serviceBreakdown
    };
  }

  /**
   * Find overlapping coverage between buyers
   */
  findOverlappingCoverage(serviceTypeId: string): {
    zipCode: string;
    buyers: string[];
    priorityOrder: { buyerId: string; priority: number }[];
  }[] {
    const serviceMapping = this.buyerServiceZipMappings.filter(
      mapping => mapping.serviceTypeId === serviceTypeId && mapping.active
    );

    const zipCodeToBuyers = new Map<string, { buyerId: string; priority: number }[]>();

    serviceMapping.forEach(mapping => {
      mapping.zipCodes.forEach((zipCode: string) => {
        if (!zipCodeToBuyers.has(zipCode)) {
          zipCodeToBuyers.set(zipCode, []);
        }
        zipCodeToBuyers.get(zipCode)!.push({
          buyerId: mapping.buyerId,
          priority: mapping.priority
        });
      });
    });

    const overlaps = [];
    for (const [zipCode, buyers] of zipCodeToBuyers) {
      if (buyers.length > 1) {
        overlaps.push({
          zipCode,
          buyers: buyers.map(b => b.buyerId),
          priorityOrder: buyers.sort((a, b) => a.priority - b.priority)
        });
      }
    }

    return overlaps;
  }

  /**
   * Validate mapping consistency
   */
  validateMappingConsistency(): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for invalid ZIP codes
    this.buyerServiceZipMappings.forEach(mapping => {
      mapping.zipCodes.forEach((zipCode: string) => {
        if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
          issues.push(`Invalid ZIP code format: ${zipCode} in mapping ${mapping.id}`);
        }
      });
    });

    // Check for duplicate mappings (same buyer + service + zip)
    const seen = new Set<string>();
    this.buyerServiceZipMappings.forEach(mapping => {
      mapping.zipCodes.forEach((zipCode: string) => {
        const key = `${mapping.buyerId}:${mapping.serviceTypeId}:${zipCode}`;
        if (seen.has(key)) {
          issues.push(`Duplicate mapping found: ${key}`);
        }
        seen.add(key);
      });
    });

    // Check for mappings with no buyer service config
    this.buyerServiceZipMappings.forEach(mapping => {
      const hasServiceConfig = mockBuyerServiceConfigs.some(config =>
        config.buyerId === mapping.buyerId &&
        config.serviceTypeId === mapping.serviceTypeId &&
        config.active
      );

      if (!hasServiceConfig) {
        issues.push(`No active service config found for mapping ${mapping.id}`);
      }
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

describe('Auction Engine with ZIP Code Filtering', () => {
  let auctionEngine: AuctionEngineWithZipFiltering;

  beforeEach(() => {
    auctionEngine = new AuctionEngineWithZipFiltering(mockServiceZipMappings);
  });

  describe('getEligibleBuyersWithZipFiltering', () => {
    it('should find eligible buyers for premium ZIP code with multiple coverage', async () => {
      const result = await auctionEngine.getEligibleBuyersWithZipFiltering('service-1', '90210');
      
      const buyerIds = result.map(r => r.buyerId);
      expect(buyerIds).toEqual(expect.arrayContaining(['buyer-1', 'buyer-2', 'buyer-3']));
      expect(result.length).toBe(3);
      
      // Check priority ordering (lower number = higher priority)
      expect(result[0].priority).toBeLessThanOrEqual(result[1].priority);
      expect(result[1].priority).toBeLessThanOrEqual(result[2].priority);
    });

    it('should find limited buyers for specialized service and ZIP', async () => {
      const result = await auctionEngine.getEligibleBuyersWithZipFiltering('service-2', '98101');
      
      const buyerIds = result.map(r => r.buyerId);
      expect(buyerIds).toEqual(expect.arrayContaining(['buyer-1', 'buyer-3']));
      expect(result.length).toBe(2);
    });

    it('should return empty array for uncovered ZIP code', async () => {
      const result = await auctionEngine.getEligibleBuyersWithZipFiltering('service-1', '99999');
      expect(result).toEqual([]);
    });

    it('should filter out inactive mappings', async () => {
      // Add inactive mapping
      const inactiveMappings = [...mockServiceZipMappings, {
        id: 'inactive-mapping',
        buyerId: 'buyer-2',
        serviceTypeId: 'service-1',
        zipCodes: ['99998'],
        active: false,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const engineWithInactive = new AuctionEngineWithZipFiltering(inactiveMappings);
      const result = await engineWithInactive.getEligibleBuyersWithZipFiltering('service-1', '99998');
      
      expect(result).toEqual([]);
    });

    it('should respect compliance requirements', async () => {
      // Test with missing TrustedForm for buyer that requires it
      const complianceData = {
        jornayaLeadId: 'jornaya-123'
        // Missing trustedFormCertId
      };

      const result = await auctionEngine.getEligibleBuyersWithZipFiltering(
        'service-1', 
        '90210', 
        complianceData
      );

      // buyer-1 and buyer-3 require TrustedForm, so they should be filtered out
      const buyerIds = result.map(r => r.buyerId);
      expect(buyerIds).toEqual(['buyer-2']); // Only buyer-2 doesn't require TrustedForm
    });
  });

  describe('runAuctionWithZipFiltering', () => {
    it('should run auction for premium ZIP code lead', async () => {
      const lead = mockTestLeads[0]; // 90210 roofing lead
      const result = await auctionEngine.runAuctionWithZipFiltering(lead);

      expect(result.leadId).toBe('lead-1');
      expect(result.eligibleBuyers).toEqual(expectedParticipationResults['lead-1']);
      expect(result.participantCount).toBe(3);
      expect(result.winningBuyerId).toBeDefined();
      expect(result.allBids).toHaveLength(3);
    });

    it('should run auction for limited coverage lead', async () => {
      const lead = mockTestLeads[1]; // 98101 windows lead
      const result = await auctionEngine.runAuctionWithZipFiltering(lead);

      expect(result.leadId).toBe('lead-2');
      expect(result.eligibleBuyers).toEqual(expectedParticipationResults['lead-2']);
      expect(result.participantCount).toBe(2);
    });

    it('should handle lead with no coverage', async () => {
      const lead = mockTestLeads[2]; // 99999 uncovered lead
      const result = await auctionEngine.runAuctionWithZipFiltering(lead);

      expect(result.leadId).toBe('lead-3');
      expect(result.eligibleBuyers).toEqual([]);
      expect(result.participantCount).toBe(0);
      expect(result.winningBuyerId).toBeUndefined();
      expect(result.allBids).toHaveLength(0);
    });

    it('should provide filter reasons for excluded buyers', async () => {
      const lead = mockTestLeads[2]; // Uncovered ZIP
      const result = await auctionEngine.runAuctionWithZipFiltering(lead);

      expect(result.filterReasons).toBeDefined();
      
      // All buyers should be filtered due to no ZIP coverage
      Object.values(result.filterReasons).forEach(reasons => {
        expect(reasons).toContain('No ZIP code coverage');
      });
    });

    it('should handle compliance filtering correctly', async () => {
      const lead = {
        ...mockTestLeads[0],
        complianceData: JSON.stringify({
          // Missing both TrustedForm and Jornaya
          ipAddress: '192.168.1.1'
        })
      };

      const result = await auctionEngine.runAuctionWithZipFiltering(lead);

      // Only buyer-2 should be eligible (doesn't require compliance)
      expect(result.eligibleBuyers).toEqual(['buyer-2']);
      
      // Check filter reasons for other buyers
      expect(result.filterReasons['buyer-1']).toContain('Missing TrustedForm certificate');
      expect(result.filterReasons['buyer-3']).toContain('Missing TrustedForm certificate');
      expect(result.filterReasons['buyer-3']).toContain('Missing Jornaya lead ID');
    });

    it('should handle ultra-premium service correctly', async () => {
      const lead = mockTestLeads[4]; // Bathrooms in 90210
      const result = await auctionEngine.runAuctionWithZipFiltering(lead);

      expect(result.leadId).toBe('lead-5');
      expect(result.eligibleBuyers).toEqual(['buyer-3']); // Only Angi does bathrooms in 90210
      expect(result.participantCount).toBe(1);
    });
  });

  describe('getCoverageStats', () => {
    it('should calculate coverage stats for buyer with multiple services', async () => {
      const stats = auctionEngine.getCoverageStats('buyer-1');

      expect(stats.totalServices).toBe(2); // ROOFING and WINDOWS
      expect(stats.totalZipCodes).toBeGreaterThan(0);
      expect(stats.serviceBreakdown).toHaveProperty('ROOFING');
      expect(stats.serviceBreakdown).toHaveProperty('WINDOWS');
    });

    it('should calculate coverage stats for buyer with single service', async () => {
      const stats = auctionEngine.getCoverageStats('buyer-2');

      expect(stats.totalServices).toBe(1); // Only ROOFING
      expect(stats.serviceBreakdown).toHaveProperty('ROOFING');
      expect(stats.serviceBreakdown).not.toHaveProperty('WINDOWS');
    });

    it('should handle buyer with comprehensive coverage', async () => {
      const stats = auctionEngine.getCoverageStats('buyer-3');

      expect(stats.totalServices).toBe(3); // All services
      expect(stats.serviceBreakdown).toHaveProperty('ROOFING');
      expect(stats.serviceBreakdown).toHaveProperty('WINDOWS');
      expect(stats.serviceBreakdown).toHaveProperty('BATHROOMS');
    });
  });

  describe('findOverlappingCoverage', () => {
    it('should find ZIP codes with multiple buyer coverage', async () => {
      const overlaps = auctionEngine.findOverlappingCoverage('service-1');

      const overlap90210 = overlaps.find(o => o.zipCode === '90210');
      expect(overlap90210).toBeDefined();
      expect(overlap90210!.buyers).toEqual(expect.arrayContaining(['buyer-1', 'buyer-2', 'buyer-3']));
      
      // Check priority ordering
      expect(overlap90210!.priorityOrder[0].priority).toBeLessThanOrEqual(overlap90210!.priorityOrder[1].priority);
    });

    it('should identify priority conflicts', async () => {
      const overlaps = auctionEngine.findOverlappingCoverage('service-1');
      const manhattanOverlap = overlaps.find(o => o.zipCode === '10001');
      
      expect(manhattanOverlap).toBeDefined();
      expect(manhattanOverlap!.buyers.length).toBeGreaterThan(1);
      
      // Verify priority ordering is correct
      const priorities = manhattanOverlap!.priorityOrder.map(p => p.priority);
      const sortedPriorities = [...priorities].sort((a, b) => a - b);
      expect(priorities).toEqual(sortedPriorities);
    });

    it('should return empty array for service with no overlaps', async () => {
      // Create engine with non-overlapping mappings
      const noOverlapMappings = [
        {
          id: 'mapping-unique-1',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-unique',
          zipCodes: ['11111'],
          active: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'mapping-unique-2',
          buyerId: 'buyer-2',
          serviceTypeId: 'service-unique',
          zipCodes: ['22222'],
          active: true,
          priority: 2,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const engineNoOverlap = new AuctionEngineWithZipFiltering(noOverlapMappings);
      const overlaps = engineNoOverlap.findOverlappingCoverage('service-unique');

      expect(overlaps).toEqual([]);
    });
  });

  describe('validateMappingConsistency', () => {
    it('should pass validation for valid mappings', async () => {
      const result = auctionEngine.validateMappingConsistency();
      
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('should detect invalid ZIP code formats', async () => {
      const invalidMappings = [...mockServiceZipMappings, {
        id: 'invalid-zip-mapping',
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: ['invalid-zip', '9021'], // Invalid formats
        active: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const engineWithInvalid = new AuctionEngineWithZipFiltering(invalidMappings);
      const result = engineWithInvalid.validateMappingConsistency();

      expect(result.valid).toBe(false);
      expect(result.issues).toContain(expect.stringContaining('Invalid ZIP code format'));
    });

    it('should detect mappings without service configs', async () => {
      const orphanMappings = [...mockServiceZipMappings, {
        id: 'orphan-mapping',
        buyerId: 'non-existent-buyer',
        serviceTypeId: 'service-1',
        zipCodes: ['90210'],
        active: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const engineWithOrphan = new AuctionEngineWithZipFiltering(orphanMappings);
      const result = engineWithOrphan.validateMappingConsistency();

      expect(result.valid).toBe(false);
      expect(result.issues).toContain(expect.stringContaining('No active service config'));
    });
  });

  describe('Edge Cases', () => {
    it('should handle buyer with multiple services in same ZIP', async () => {
      const { buyerId, expectedServices } = edgeCaseScenarios.multipleServicesPerBuyer;
      
      // Check roofing coverage
      const roofingResult = await auctionEngine.getEligibleBuyersWithZipFiltering('service-1', '90210');
      expect(roofingResult.some(r => r.buyerId === buyerId)).toBe(true);
      
      // Check windows coverage
      const windowsResult = await auctionEngine.getEligibleBuyersWithZipFiltering('service-2', '90210');
      expect(windowsResult.some(r => r.buyerId === buyerId)).toBe(true);
    });

    it('should handle ZIP codes with overlapping buyer coverage', async () => {
      const { zipCode, expectedBuyers } = edgeCaseScenarios.overlappingZipCodes;
      
      const result = await auctionEngine.getEligibleBuyersWithZipFiltering('service-1', zipCode);
      const buyerIds = result.map(r => r.buyerId);
      
      expectedBuyers.forEach(buyerId => {
        expect(buyerIds).toContain(buyerId);
      });
    });

    it('should respect priority ordering in overlapping coverage', async () => {
      const { zipCode, service, expectedWinner } = edgeCaseScenarios.priorityConflicts;
      
      const result = await auctionEngine.getEligibleBuyersWithZipFiltering(service, zipCode);
      
      // Highest priority (lowest number) should be first
      expect(result[0].buyerId).toBe(expectedWinner);
    });

    it('should handle empty ZIP code arrays gracefully', async () => {
      const emptyZipMappings = [{
        id: 'empty-zip-mapping',
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: [], // Empty array
        active: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const engineWithEmpty = new AuctionEngineWithZipFiltering(emptyZipMappings);
      const result = await engineWithEmpty.getEligibleBuyersWithZipFiltering('service-1', '90210');
      
      expect(result).toEqual([]);
    });
  });
});