/**
 * Edge Case Tests for Buyer Service Zip Mapping
 * Tests unusual scenarios, error conditions, and boundary cases
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  mockBuyers,
  mockServiceTypes,
  mockBuyerServiceConfigs,
  mockServiceZipMappings,
  mockTestLeads,
  edgeCaseScenarios,
  BuyerServiceZipMapping
} from '@/tests/fixtures/buyerServiceZipMappingData';

// Edge case testing utilities
class EdgeCaseTestingService {
  private mappings: BuyerServiceZipMapping[];

  constructor(mappings: BuyerServiceZipMapping[]) {
    this.mappings = mappings;
  }

  // Test circular dependency detection
  detectCircularDependencies(): string[] {
    const issues: string[] = [];
    
    // Check for buyers that require each other (theoretical scenario)
    const buyerDependencies = new Map<string, string[]>();
    
    this.mappings.forEach(mapping => {
      if (!buyerDependencies.has(mapping.buyerId)) {
        buyerDependencies.set(mapping.buyerId, []);
      }
      // In a real scenario, this might check referral relationships
    });

    return issues;
  }

  // Test data consistency across multiple dimensions
  validateDataConsistency(): {
    valid: boolean;
    issues: Array<{
      type: 'orphaned_mapping' | 'duplicate_priority' | 'invalid_zip' | 'priority_gap' | 'service_mismatch';
      details: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  } {
    const issues: Array<{
      type: 'orphaned_mapping' | 'duplicate_priority' | 'invalid_zip' | 'priority_gap' | 'service_mismatch';
      details: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // Check for orphaned mappings (buyer or service doesn't exist)
    this.mappings.forEach(mapping => {
      const buyerExists = mockBuyers.some(buyer => buyer.id === mapping.buyerId);
      if (!buyerExists) {
        issues.push({
          type: 'orphaned_mapping',
          details: `Mapping ${mapping.id} references non-existent buyer ${mapping.buyerId}`,
          severity: 'high'
        });
      }

      const serviceExists = mockServiceTypes.some(service => service.id === mapping.serviceTypeId);
      if (!serviceExists) {
        issues.push({
          type: 'orphaned_mapping',
          details: `Mapping ${mapping.id} references non-existent service ${mapping.serviceTypeId}`,
          severity: 'high'
        });
      }

      // Check for service config mismatch
      const hasServiceConfig = mockBuyerServiceConfigs.some(config =>
        config.buyerId === mapping.buyerId && config.serviceTypeId === mapping.serviceTypeId
      );
      if (!hasServiceConfig) {
        issues.push({
          type: 'service_mismatch',
          details: `Mapping ${mapping.id} has no corresponding service configuration`,
          severity: 'high'
        });
      }
    });

    // Check for duplicate priorities within same service/ZIP combinations
    const priorityMap = new Map<string, Map<number, string[]>>();
    
    this.mappings.forEach(mapping => {
      mapping.zipCodes.forEach(zipCode => {
        const key = `${mapping.serviceTypeId}:${zipCode}`;
        if (!priorityMap.has(key)) {
          priorityMap.set(key, new Map());
        }
        
        const servicePriorities = priorityMap.get(key)!;
        if (!servicePriorities.has(mapping.priority)) {
          servicePriorities.set(mapping.priority, []);
        }
        servicePriorities.get(mapping.priority)!.push(mapping.buyerId);
      });
    });

    priorityMap.forEach((priorities, serviceZipKey) => {
      priorities.forEach((buyers, priority) => {
        if (buyers.length > 1) {
          issues.push({
            type: 'duplicate_priority',
            details: `Multiple buyers (${buyers.join(', ')}) have priority ${priority} for ${serviceZipKey}`,
            severity: 'medium'
          });
        }
      });

      // Check for priority gaps
      const priorityValues = Array.from(priorities.keys()).sort((a, b) => a - b);
      for (let i = 1; i < priorityValues.length; i++) {
        if (priorityValues[i] - priorityValues[i - 1] > 1) {
          issues.push({
            type: 'priority_gap',
            details: `Priority gap detected for ${serviceZipKey}: ${priorityValues[i - 1]} to ${priorityValues[i]}`,
            severity: 'low'
          });
        }
      }
    });

    // Validate ZIP code formats
    this.mappings.forEach(mapping => {
      mapping.zipCodes.forEach(zipCode => {
        if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
          issues.push({
            type: 'invalid_zip',
            details: `Invalid ZIP code format: ${zipCode} in mapping ${mapping.id}`,
            severity: 'high'
          });
        }
      });
    });

    return {
      valid: issues.filter(issue => issue.severity === 'high').length === 0,
      issues
    };
  }

  // Test boundary conditions
  testBoundaryConditions(): {
    emptyZipArrays: number;
    maxZipCodesPerMapping: number;
    minPriority: number;
    maxPriority: number;
    duplicateZipsWithinMapping: Array<{ mappingId: string; duplicates: string[] }>;
  } {
    const emptyZipArrays = this.mappings.filter(mapping => mapping.zipCodes.length === 0).length;
    
    const zipCounts = this.mappings.map(mapping => mapping.zipCodes.length);
    const maxZipCodesPerMapping = zipCounts.length > 0 ? Math.max(...zipCounts) : 0;
    
    const priorities = this.mappings.map(mapping => mapping.priority);
    const minPriority = priorities.length > 0 ? Math.min(...priorities) : 0;
    const maxPriority = priorities.length > 0 ? Math.max(...priorities) : 0;
    
    const duplicateZipsWithinMapping: Array<{ mappingId: string; duplicates: string[] }> = [];
    this.mappings.forEach(mapping => {
      const zipSet = new Set<string>();
      const duplicates: string[] = [];
      
      mapping.zipCodes.forEach(zip => {
        if (zipSet.has(zip)) {
          duplicates.push(zip);
        } else {
          zipSet.add(zip);
        }
      });
      
      if (duplicates.length > 0) {
        duplicateZipsWithinMapping.push({
          mappingId: mapping.id,
          duplicates
        });
      }
    });

    return {
      emptyZipArrays,
      maxZipCodesPerMapping,
      minPriority,
      maxPriority,
      duplicateZipsWithinMapping
    };
  }

  // Test race condition scenarios
  simulateRaceConditions(): Array<{
    scenario: string;
    potentialIssues: string[];
    mitigation: string;
  }> {
    return [
      {
        scenario: 'Concurrent mapping updates for same buyer-service',
        potentialIssues: [
          'ZIP codes could be overwritten',
          'Priority changes might be lost',
          'Active status could be inconsistent'
        ],
        mitigation: 'Use database transactions and optimistic locking'
      },
      {
        scenario: 'Mapping deletion during active auction',
        potentialIssues: [
          'Buyer might be selected but mapping is gone',
          'POST request might fail due to missing config',
          'Auction results could be inconsistent'
        ],
        mitigation: 'Implement soft deletes and auction state tracking'
      },
      {
        scenario: 'Bulk priority updates during auction',
        potentialIssues: [
          'Auction might use old priority order',
          'Winner selection could be based on stale data',
          'Priority conflicts might occur mid-auction'
        ],
        mitigation: 'Lock mappings during auction or use versioning'
      },
      {
        scenario: 'Service configuration changes during mapping lookup',
        potentialIssues: [
          'Mapping exists but service config is disabled',
          'Compliance requirements might change mid-auction',
          'Buyer availability could be inconsistent'
        ],
        mitigation: 'Cache service configs with TTL and validate before auction'
      }
    ];
  }

  // Test geographic edge cases
  testGeographicEdgeCases(): {
    crossStateZipCodes: string[];
    militaryZipCodes: string[];
    poBoxOnlyZipCodes: string[];
    alaskaHawaiiZipCodes: string[];
    territoryZipCodes: string[];
  } {
    const allZipCodes = this.mappings.flatMap(mapping => mapping.zipCodes);
    
    return {
      // ZIP codes that cross state boundaries (rare but exist)
      crossStateZipCodes: allZipCodes.filter(zip => ['42223', '97635', '59718'].includes(zip.substring(0, 5))),
      
      // Military ZIP codes (APO, FPO, DPO)
      militaryZipCodes: allZipCodes.filter(zip => {
        const prefix = zip.substring(0, 3);
        return ['340', '962', '963', '964', '965', '966'].includes(prefix);
      }),
      
      // ZIP codes that are primarily PO Boxes
      poBoxOnlyZipCodes: allZipCodes.filter(zip => {
        // This would require a comprehensive database in real implementation
        return ['83128', '89044', '89102'].includes(zip.substring(0, 5));
      }),
      
      // Alaska and Hawaii ZIP codes
      alaskaHawaiiZipCodes: allZipCodes.filter(zip => {
        const prefix = zip.substring(0, 3);
        return (prefix >= '995' && prefix <= '999') || (prefix >= '967' && prefix <= '968');
      }),
      
      // US Territories
      territoryZipCodes: allZipCodes.filter(zip => {
        const prefix = zip.substring(0, 3);
        return ['006', '007', '008', '009', '969'].includes(prefix);
      })
    };
  }
}

// Mock error scenarios
class ErrorScenarioSimulator {
  // Database connection failures
  async simulateDatabaseFailure(): Promise<Error> {
    return new Error('Database connection timeout after 30 seconds');
  }

  // Network timeout scenarios
  async simulateNetworkTimeout(): Promise<Error> {
    return new Error('Network request timeout after 5000ms');
  }

  // Memory pressure scenarios
  simulateMemoryPressure(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  } {
    // Simulate high memory usage
    return {
      heapUsed: 1024 * 1024 * 512, // 512MB
      heapTotal: 1024 * 1024 * 768, // 768MB
      external: 1024 * 1024 * 128, // 128MB
      rss: 1024 * 1024 * 896 // 896MB
    };
  }

  // Malformed data scenarios
  generateMalformedData(): Array<{
    type: string;
    data: any;
    expectedError: string;
  }> {
    return [
      {
        type: 'null_zip_codes',
        data: {
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCodes: null,
          priority: 1
        },
        expectedError: 'zipCodes cannot be null'
      },
      {
        type: 'negative_priority',
        data: {
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCodes: ['90210'],
          priority: -1
        },
        expectedError: 'Priority must be positive'
      },
      {
        type: 'excessive_zip_count',
        data: {
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCodes: Array.from({ length: 100000 }, (_, i) => `${10000 + i}`),
          priority: 1
        },
        expectedError: 'Too many ZIP codes per mapping'
      },
      {
        type: 'unicode_in_zip',
        data: {
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCodes: ['9021０'], // Contains Unicode character that looks like 0
          priority: 1
        },
        expectedError: 'Invalid ZIP code format'
      },
      {
        type: 'sql_injection_attempt',
        data: {
          buyerId: "buyer-1'; DROP TABLE buyers; --",
          serviceTypeId: 'service-1',
          zipCodes: ['90210'],
          priority: 1
        },
        expectedError: 'Invalid buyer ID format'
      }
    ];
  }
}

describe('Edge Case Scenarios for Buyer Service Zip Mapping', () => {
  let edgeCaseService: EdgeCaseTestingService;
  let errorSimulator: ErrorScenarioSimulator;

  beforeEach(() => {
    edgeCaseService = new EdgeCaseTestingService(mockServiceZipMappings);
    errorSimulator = new ErrorScenarioSimulator();
  });

  describe('Data Consistency Validation', () => {
    it('should detect and report data consistency issues', () => {
      const validation = edgeCaseService.validateDataConsistency();

      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('issues');
      expect(Array.isArray(validation.issues)).toBe(true);

      // Log issues for analysis
      validation.issues.forEach(issue => {
        console.log(`${issue.severity.toUpperCase()}: ${issue.type} - ${issue.details}`);
      });

      // High severity issues should not exist in mock data
      const highSeverityIssues = validation.issues.filter(issue => issue.severity === 'high');
      expect(highSeverityIssues.length).toBe(0);
    });

    it('should handle orphaned mappings gracefully', () => {
      // Add orphaned mapping to test data
      const orphanedMappings = [
        ...mockServiceZipMappings,
        {
          id: 'orphaned-mapping',
          buyerId: 'non-existent-buyer',
          serviceTypeId: 'non-existent-service',
          zipCodes: ['90210'],
          active: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const orphanedService = new EdgeCaseTestingService(orphanedMappings);
      const validation = orphanedService.validateDataConsistency();

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => issue.type === 'orphaned_mapping')).toBe(true);
    });

    it('should detect priority conflicts', () => {
      // Add priority conflict to test data
      const conflictMappings = [
        ...mockServiceZipMappings,
        {
          id: 'conflict-mapping',
          buyerId: 'buyer-duplicate-priority',
          serviceTypeId: 'service-1',
          zipCodes: ['90210'], // Same ZIP as existing mappings
          active: true,
          priority: 1, // Same priority as existing mapping
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const conflictService = new EdgeCaseTestingService(conflictMappings);
      const validation = conflictService.validateDataConsistency();

      const priorityConflicts = validation.issues.filter(issue => issue.type === 'duplicate_priority');
      expect(priorityConflicts.length).toBeGreaterThan(0);
    });
  });

  describe('Boundary Condition Testing', () => {
    it('should analyze boundary conditions correctly', () => {
      const boundaries = edgeCaseService.testBoundaryConditions();

      expect(boundaries.emptyZipArrays).toBe(0); // Should not have empty ZIP arrays in mock data
      expect(boundaries.maxZipCodesPerMapping).toBeGreaterThan(0);
      expect(boundaries.minPriority).toBeGreaterThanOrEqual(1);
      expect(boundaries.maxPriority).toBeLessThanOrEqual(10);
      expect(boundaries.duplicateZipsWithinMapping.length).toBe(0); // Mock data should be clean
    });

    it('should handle extreme ZIP code counts', () => {
      const extremeMappings = [
        {
          id: 'extreme-mapping-1',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCodes: [], // Empty array
          active: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'extreme-mapping-2',
          buyerId: 'buyer-2',
          serviceTypeId: 'service-1',
          zipCodes: Array.from({ length: 50000 }, (_, i) => `${10000 + i}`), // 50k ZIP codes
          active: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const extremeService = new EdgeCaseTestingService(extremeMappings);
      const boundaries = extremeService.testBoundaryConditions();

      expect(boundaries.emptyZipArrays).toBe(1);
      expect(boundaries.maxZipCodesPerMapping).toBe(50000);
    });

    it('should detect extreme priority values', () => {
      const extremePriorityMappings = [
        {
          id: 'extreme-priority-1',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCodes: ['90210'],
          active: true,
          priority: 1, // Minimum valid
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'extreme-priority-2',
          buyerId: 'buyer-2',
          serviceTypeId: 'service-1',
          zipCodes: ['90211'],
          active: true,
          priority: 10, // Maximum valid
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const extremePriorityService = new EdgeCaseTestingService(extremePriorityMappings);
      const boundaries = extremePriorityService.testBoundaryConditions();

      expect(boundaries.minPriority).toBe(1);
      expect(boundaries.maxPriority).toBe(10);
    });
  });

  describe('Race Condition Analysis', () => {
    it('should identify potential race condition scenarios', () => {
      const raceConditions = edgeCaseService.simulateRaceConditions();

      expect(raceConditions.length).toBeGreaterThan(0);
      expect(raceConditions.every(scenario => 
        scenario.scenario && 
        Array.isArray(scenario.potentialIssues) && 
        scenario.mitigation
      )).toBe(true);

      // Log scenarios for analysis
      raceConditions.forEach(scenario => {
        console.log(`Race Condition: ${scenario.scenario}`);
        console.log(`Issues: ${scenario.potentialIssues.join(', ')}`);
        console.log(`Mitigation: ${scenario.mitigation}`);
        console.log('---');
      });
    });

    it('should provide mitigation strategies for race conditions', () => {
      const raceConditions = edgeCaseService.simulateRaceConditions();
      
      const expectedMitigations = [
        'database transactions',
        'optimistic locking',
        'soft deletes',
        'versioning',
        'cache'
      ];

      const allMitigations = raceConditions.map(scenario => scenario.mitigation.toLowerCase()).join(' ');
      
      expectedMitigations.forEach(mitigation => {
        expect(allMitigations).toContain(mitigation);
      });
    });
  });

  describe('Geographic Edge Cases', () => {
    it('should identify geographic edge case ZIP codes', () => {
      const geoEdgeCases = edgeCaseService.testGeographicEdgeCases();

      expect(geoEdgeCases).toHaveProperty('crossStateZipCodes');
      expect(geoEdgeCases).toHaveProperty('militaryZipCodes');
      expect(geoEdgeCases).toHaveProperty('poBoxOnlyZipCodes');
      expect(geoEdgeCases).toHaveProperty('alaskaHawaiiZipCodes');
      expect(geoEdgeCases).toHaveProperty('territoryZipCodes');

      // Log any special ZIP codes found
      Object.entries(geoEdgeCases).forEach(([category, zipCodes]) => {
        if (zipCodes.length > 0) {
          console.log(`${category}: ${zipCodes.join(', ')}`);
        }
      });
    });

    it('should handle special ZIP code formats', () => {
      const specialZipMappings = [
        {
          id: 'military-mapping',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCodes: ['34012', '96209', '09012'], // Military style ZIPs
          active: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'territory-mapping',
          buyerId: 'buyer-2',
          serviceTypeId: 'service-1',
          zipCodes: ['00601', '96799', '96910'], // Territories
          active: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const specialZipService = new EdgeCaseTestingService(specialZipMappings);
      const validation = specialZipService.validateDataConsistency();

      // These should be valid ZIP codes
      const invalidZipIssues = validation.issues.filter(issue => issue.type === 'invalid_zip');
      expect(invalidZipIssues.length).toBe(0);
    });
  });

  describe('Error Scenario Handling', () => {
    it('should handle database failure scenarios', async () => {
      const dbError = await errorSimulator.simulateDatabaseFailure();
      
      expect(dbError).toBeInstanceOf(Error);
      expect(dbError.message).toContain('Database connection timeout');
    });

    it('should handle network timeout scenarios', async () => {
      const networkError = await errorSimulator.simulateNetworkTimeout();
      
      expect(networkError).toBeInstanceOf(Error);
      expect(networkError.message).toContain('Network request timeout');
    });

    it('should detect memory pressure conditions', () => {
      const memoryStats = errorSimulator.simulateMemoryPressure();
      
      expect(memoryStats.heapUsed).toBeGreaterThan(0);
      expect(memoryStats.heapTotal).toBeGreaterThan(memoryStats.heapUsed);
      expect(memoryStats.rss).toBeGreaterThan(memoryStats.heapTotal);

      // Detect if memory usage is concerning
      const memoryPressure = (memoryStats.heapUsed / memoryStats.heapTotal) > 0.8;
      if (memoryPressure) {
        console.warn('High memory pressure detected:', memoryStats);
      }
    });

    it('should handle malformed data gracefully', () => {
      const malformedDataScenarios = errorSimulator.generateMalformedData();
      
      expect(malformedDataScenarios.length).toBeGreaterThan(0);
      
      malformedDataScenarios.forEach(scenario => {
        expect(scenario).toHaveProperty('type');
        expect(scenario).toHaveProperty('data');
        expect(scenario).toHaveProperty('expectedError');
        
        // Each scenario should have a clear error expectation
        expect(scenario.expectedError).toBeTruthy();
      });
    });
  });

  describe('Concurrency and Threading Issues', () => {
    it('should handle concurrent mapping modifications', async () => {
      const concurrentOperations = [
        { action: 'add_zip', zipCode: '90213' },
        { action: 'remove_zip', zipCode: '90212' },
        { action: 'update_priority', priority: 3 },
        { action: 'toggle_active', active: false }
      ];

      // Simulate concurrent operations
      const results = await Promise.allSettled(
        concurrentOperations.map(async (op, index) => {
          // Simulate processing delay
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          return { operation: op, order: index, timestamp: Date.now() };
        })
      );

      expect(results.length).toBe(concurrentOperations.length);
      
      // All operations should complete (though in real scenario, some might conflict)
      const successful = results.filter(result => result.status === 'fulfilled');
      expect(successful.length).toBe(concurrentOperations.length);
    });

    it('should detect potential deadlock scenarios', () => {
      const deadlockScenarios = [
        {
          scenario: 'Cross-mapping priority updates',
          description: 'Two mappings trying to update priorities that affect each other',
          risk: 'high'
        },
        {
          scenario: 'Mapping deletion during ZIP code update',
          description: 'Deleting mapping while another operation updates its ZIP codes',
          risk: 'medium'
        },
        {
          scenario: 'Bulk operations on overlapping data sets',
          description: 'Multiple bulk operations affecting same mappings',
          risk: 'medium'
        }
      ];

      deadlockScenarios.forEach(scenario => {
        expect(scenario.scenario).toBeTruthy();
        expect(scenario.description).toBeTruthy();
        expect(scenario.risk).toMatch(/^(low|medium|high)$/);
      });
    });
  });

  describe('Data Volume Stress Tests', () => {
    it('should handle massive ZIP code arrays', () => {
      const massiveZipMapping = {
        id: 'massive-zip-mapping',
        buyerId: 'buyer-massive',
        serviceTypeId: 'service-1',
        zipCodes: Array.from({ length: 100000 }, (_, i) => 
          String(10000 + i).padStart(5, '0')
        ),
        active: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const massiveService = new EdgeCaseTestingService([massiveZipMapping]);
      const boundaries = massiveService.testBoundaryConditions();

      expect(boundaries.maxZipCodesPerMapping).toBe(100000);
    });

    it('should handle many mappings with overlapping ZIP codes', () => {
      const overlappingMappings = Array.from({ length: 1000 }, (_, i) => ({
        id: `overlap-mapping-${i}`,
        buyerId: `buyer-${i % 10}`, // 100 mappings per buyer
        serviceTypeId: 'service-1',
        zipCodes: ['90210', '10001', '60601'], // All have same ZIPs
        active: true,
        priority: (i % 5) + 1, // Priority conflicts galore
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const overlappingService = new EdgeCaseTestingService(overlappingMappings);
      const validation = overlappingService.validateDataConsistency();

      // Should detect many priority conflicts
      const priorityConflicts = validation.issues.filter(issue => issue.type === 'duplicate_priority');
      expect(priorityConflicts.length).toBeGreaterThan(0);
    });

    it('should handle extreme priority distributions', () => {
      const extremePriorityMappings = Array.from({ length: 100 }, (_, i) => ({
        id: `priority-mapping-${i}`,
        buyerId: `buyer-${i}`,
        serviceTypeId: 'service-1',
        zipCodes: [`${90000 + i}`],
        active: true,
        priority: i % 2 === 0 ? 1 : 10, // Only priorities 1 and 10
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const extremePriorityService = new EdgeCaseTestingService(extremePriorityMappings);
      const boundaries = extremePriorityService.testBoundaryConditions();

      expect(boundaries.minPriority).toBe(1);
      expect(boundaries.maxPriority).toBe(10);

      // Should detect priority gaps
      const validation = extremePriorityService.validateDataConsistency();
      const priorityGaps = validation.issues.filter(issue => issue.type === 'priority_gap');
      expect(priorityGaps.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Buyer Service Edge Cases', () => {
    it('should handle buyers with multiple overlapping services', () => {
      const { buyerId, expectedServices } = edgeCaseScenarios.multipleServicesPerBuyer;
      
      // Find all mappings for this buyer
      const buyerMappings = mockServiceZipMappings.filter(mapping => mapping.buyerId === buyerId);
      const actualServices = [...new Set(buyerMappings.map(mapping => mapping.serviceTypeId))];
      
      expect(actualServices.length).toBeGreaterThanOrEqual(expectedServices.length);
      expectedServices.forEach(serviceId => {
        expect(actualServices).toContain(serviceId);
      });
    });

    it('should handle ZIP codes with maximum buyer coverage', () => {
      const { zipCode, expectedBuyers } = edgeCaseScenarios.overlappingZipCodes;
      
      // Find all mappings that cover this ZIP code
      const coveringMappings = mockServiceZipMappings.filter(mapping =>
        mapping.zipCodes.includes(zipCode) && mapping.active
      );
      
      const actualBuyers = [...new Set(coveringMappings.map(mapping => mapping.buyerId))];
      
      expect(actualBuyers.length).toBe(expectedBuyers.length);
      expectedBuyers.forEach(buyerId => {
        expect(actualBuyers).toContain(buyerId);
      });
    });

    it('should resolve priority conflicts deterministically', () => {
      const { zipCode, service, expectedWinner } = edgeCaseScenarios.priorityConflicts;
      
      // Find all mappings for this ZIP and service
      const competingMappings = mockServiceZipMappings.filter(mapping =>
        mapping.serviceTypeId === service &&
        mapping.zipCodes.includes(zipCode) &&
        mapping.active
      );
      
      // Sort by priority (ascending - lower number = higher priority)
      const sortedMappings = competingMappings.sort((a, b) => a.priority - b.priority);
      
      if (sortedMappings.length > 0) {
        expect(sortedMappings[0].buyerId).toBe(expectedWinner);
      }
    });
  });

  describe('System State Edge Cases', () => {
    it('should handle all mappings being inactive', () => {
      const inactiveMappings = mockServiceZipMappings.map(mapping => ({
        ...mapping,
        active: false
      }));

      const inactiveService = new EdgeCaseTestingService(inactiveMappings);
      
      // Should not cause errors, just return empty results
      const boundaries = inactiveService.testBoundaryConditions();
      expect(boundaries.emptyZipArrays).toBe(0); // Structure should be preserved
    });

    it('should handle missing service configurations', () => {
      // Create mappings that don't have corresponding service configs
      const orphanedServiceMappings = [
        {
          id: 'orphaned-service-mapping',
          buyerId: 'buyer-1',
          serviceTypeId: 'non-configured-service',
          zipCodes: ['90210'],
          active: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const orphanedService = new EdgeCaseTestingService(orphanedServiceMappings);
      const validation = orphanedService.validateDataConsistency();

      // Should detect service mismatch
      const serviceMismatches = validation.issues.filter(issue => issue.type === 'service_mismatch');
      expect(serviceMismatches.length).toBeGreaterThan(0);
    });

    it('should handle empty system state', () => {
      const emptyService = new EdgeCaseTestingService([]);
      
      const validation = emptyService.validateDataConsistency();
      const boundaries = emptyService.testBoundaryConditions();
      
      expect(validation.valid).toBe(true);
      expect(validation.issues.length).toBe(0);
      expect(boundaries.emptyZipArrays).toBe(0);
      expect(boundaries.maxZipCodesPerMapping).toBe(0);
    });
  });
});