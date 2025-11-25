/**
 * Backward Compatibility Tests
 * Tests that existing network buyers continue to function with new contractor system
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { BuyerType, Buyer, Lead } from '@/types/database';
import { AuctionEngine } from '@/lib/auction/engine';
import { BuyerEligibilityService } from '@/lib/services/buyer-eligibility-service';
import { BuyerConfigurationRegistry } from '@/lib/buyers/configurations';
import request from 'supertest';
import { createApp } from '../utils/testHelpers';

const prisma = new PrismaClient();
const app = createApp();

// Mock external dependencies
jest.mock('@/lib/buyers/configurations');
jest.mock('@/lib/services/buyer-eligibility-service');

const mockBuyerRegistry = BuyerConfigurationRegistry as jest.Mocked<typeof BuyerConfigurationRegistry>;
const mockEligibilityService = BuyerEligibilityService as jest.Mocked<typeof BuyerEligibilityService>;

describe('4. Backward Compatibility with Existing Buyers', () => {
  let existingNetworkBuyer: Buyer;
  let legacyNetworkBuyer: Buyer;
  let newContractor: Buyer;
  let testServiceType: any;

  beforeEach(async () => {
    // Clean up test data
    await prisma.transaction.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.buyerServiceConfig.deleteMany();
    await prisma.buyer.deleteMany({ where: { name: { contains: 'Test' } } });
    await prisma.serviceType.deleteMany({ where: { name: { contains: 'test' } } });

    // Create test service type
    testServiceType = await prisma.serviceType.create({
      data: {
        name: 'test-hvac',
        displayName: 'Test HVAC Services',
        formSchema: JSON.stringify({ fields: ['systemType', 'budget', 'urgency'] }),
        active: true
      }
    });

    // Create existing network buyer (pre-contractor system)
    existingNetworkBuyer = await prisma.buyer.create({
      data: {
        name: 'Legacy Network Corp',
        type: BuyerType.NETWORK,
        apiUrl: 'https://legacy-network.com/api/leads',
        authConfig: JSON.stringify({
          apiKey: 'legacy-key-789',
          webhookSecret: 'legacy-secret'
        }),
        active: true,
        pingTimeout: 25, // Different settings
        postTimeout: 45,
        createdAt: new Date('2023-01-01'), // Created before contractor system
        updatedAt: new Date('2023-06-01')
      }
    });

    // Create another legacy network buyer with different configuration
    legacyNetworkBuyer = await prisma.buyer.create({
      data: {
        name: 'Old School Networks LLC',
        type: BuyerType.NETWORK,
        apiUrl: 'https://oldschool.com/webhook',
        authConfig: JSON.stringify({
          username: 'oldschool',
          password: 'legacy123',
          customHeaders: {
            'X-Legacy-Version': '1.0'
          }
        }),
        active: true,
        pingTimeout: 30,
        postTimeout: 90,
        createdAt: new Date('2022-05-15'),
        updatedAt: new Date('2023-03-10')
      }
    });

    // Create new contractor for comparison
    newContractor = await prisma.buyer.create({
      data: {
        name: 'New Contractor LLC',
        type: BuyerType.CONTRACTOR,
        apiUrl: 'https://newcontractor.com/api/leads',
        authConfig: JSON.stringify({
          contactEmail: 'owner@newcontractor.com',
          contactPhone: '(555) 888-9999',
          contactName: 'New Contractor Owner',
          businessDescription: 'Modern HVAC contractor',
          apiKey: 'new-contractor-key'
        }),
        active: true,
        pingTimeout: 30,
        postTimeout: 60,
        createdAt: new Date(), // Created after contractor system
        updatedAt: new Date()
      }
    });

    // Create service configurations for all buyers
    const buyers = [existingNetworkBuyer, legacyNetworkBuyer, newContractor];
    for (const buyer of buyers) {
      await prisma.buyerServiceConfig.create({
        data: {
          buyerId: buyer.id,
          serviceTypeId: testServiceType.id,
          pingTemplate: JSON.stringify({ 
            template: `${buyer.type.toLowerCase()}-ping`,
            version: buyer.type === BuyerType.NETWORK ? '1.0' : '2.0'
          }),
          postTemplate: JSON.stringify({ 
            template: `${buyer.type.toLowerCase()}-post`,
            version: buyer.type === BuyerType.NETWORK ? '1.0' : '2.0'
          }),
          fieldMappings: JSON.stringify({ 
            mapping: buyer.type.toLowerCase(),
            legacy: buyer.createdAt < new Date('2024-01-01')
          }),
          minBid: buyer.type === BuyerType.NETWORK ? 40.00 : 25.00,
          maxBid: buyer.type === BuyerType.NETWORK ? 250.00 : 150.00,
          active: true
        }
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Legacy Network Buyer Functionality', () => {
    it('should maintain existing network buyer operations', async () => {
      // Create service zone mapping for legacy buyer (simulating existing setup)
      await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: existingNetworkBuyer.id,
          serviceTypeId: testServiceType.id,
          zipCode: '10001',
          active: true,
          priority: 100,
          maxLeadsPerDay: 50,
          minBid: 40.00,
          maxBid: 200.00
        }
      });

      // Mock eligibility service to include legacy buyer
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [{
          buyerId: existingNetworkBuyer.id,
          serviceZone: { 
            id: 'legacy-zone-1', 
            zipCode: '10001', 
            priority: 100,
            maxLeadsPerDay: 50
          },
          eligibilityScore: 95,
          reason: 'Legacy network buyer with established coverage'
        }],
        eligibleCount: 1,
        excludedCount: 0,
        exclusions: []
      });

      // Mock buyer registry for legacy buyer
      mockBuyerRegistry.get.mockReturnValue({
        id: existingNetworkBuyer.id,
        name: existingNetworkBuyer.name,
        type: existingNetworkBuyer.type,
        globalSettings: {
          complianceRequirements: {
            requireTrustedForm: false,
            requireJornaya: false,
            requireTcpaConsent: false
          }
        },
        authConfig: {
          type: 'apiKey',
          credentials: { apiKey: 'legacy-key-789' },
          headers: {
            'X-Legacy-Version': '1.0',
            'X-Webhook-Secret': 'legacy-secret'
          }
        }
      });

      mockBuyerRegistry.getServiceConfig.mockReturnValue({
        serviceTypeName: 'test-hvac',
        pricing: { basePrice: 75, minBid: 40, maxBid: 250 },
        webhookConfig: {
          pingUrl: 'https://legacy-network.com/api/ping',
          postUrl: 'https://legacy-network.com/api/leads',
          timeouts: { ping: 25000, post: 45000 } // Legacy timeouts
        },
        active: true
      });

      // Mock successful response
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          status: 'accepted',
          price: 85.00,
          leadId: 'legacy-lead-123'
        })
      });
      global.fetch = mockFetch;

      const leadData = {
        id: 'test-lead-legacy',
        serviceTypeId: testServiceType.id,
        zipCode: '10001',
        estimatedValue: 120
      };

      const result = await AuctionEngine.runAuction(leadData);

      // Verify legacy buyer functionality still works
      expect(result.winningBuyerId).toBe(existingNetworkBuyer.id);
      expect(result.winningBidAmount).toBe(85.00);
      expect(result.status).toBe('completed');

      // Verify legacy-specific request format
      expect(mockFetch).toHaveBeenCalledWith(
        'https://legacy-network.com/api/ping',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'legacy-key-789',
            'X-Legacy-Version': '1.0',
            'X-Webhook-Secret': 'legacy-secret'
          })
        })
      );
    });

    it('should handle legacy authentication methods', async () => {
      // Test basic auth legacy buyer
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [{
          buyerId: legacyNetworkBuyer.id,
          serviceZone: { id: 'legacy-zone-2', zipCode: '10002', priority: 90 },
          eligibilityScore: 88,
          reason: 'Legacy buyer with basic auth'
        }],
        eligibleCount: 1,
        excludedCount: 0,
        exclusions: []
      });

      mockBuyerRegistry.get.mockReturnValue({
        id: legacyNetworkBuyer.id,
        name: legacyNetworkBuyer.name,
        type: legacyNetworkBuyer.type,
        globalSettings: {
          complianceRequirements: {
            requireTrustedForm: false,
            requireJornaya: false,
            requireTcpaConsent: false
          }
        },
        authConfig: {
          type: 'basic',
          credentials: { 
            username: 'oldschool',
            password: 'legacy123'
          },
          headers: {
            'X-Legacy-Version': '1.0'
          }
        }
      });

      mockBuyerRegistry.getServiceConfig.mockReturnValue({
        serviceTypeName: 'test-hvac',
        pricing: { basePrice: 65, minBid: 35, maxBid: 180 },
        webhookConfig: {
          pingUrl: 'https://oldschool.com/ping',
          postUrl: 'https://oldschool.com/webhook',
          timeouts: { ping: 30000, post: 90000 }
        },
        active: true
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          accepted: true,
          bid: 65.00
        })
      });
      global.fetch = mockFetch;

      const leadData = {
        id: 'test-lead-basic-auth',
        serviceTypeId: testServiceType.id,
        zipCode: '10002',
        estimatedValue: 100
      };

      await AuctionEngine.runAuction(leadData);

      // Verify basic auth header was properly formed
      const expectedAuth = btoa('oldschool:legacy123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://oldschool.com/ping',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Basic ${expectedAuth}`,
            'X-Legacy-Version': '1.0'
          })
        })
      );
    });

    it('should preserve legacy data formats and mappings', async () => {
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [{
          buyerId: existingNetworkBuyer.id,
          serviceZone: { id: 'legacy-zone-1', zipCode: '10001', priority: 100 },
          eligibilityScore: 92,
          reason: 'Legacy network buyer'
        }],
        eligibleCount: 1,
        excludedCount: 0,
        exclusions: []
      });

      mockBuyerRegistry.get.mockReturnValue({
        id: existingNetworkBuyer.id,
        name: existingNetworkBuyer.name,
        type: existingNetworkBuyer.type,
        globalSettings: {
          complianceRequirements: {
            requireTrustedForm: false,
            requireJornaya: false,
            requireTcpaConsent: false
          }
        },
        authConfig: {
          type: 'apiKey',
          credentials: { apiKey: 'legacy-key-789' }
        }
      });

      mockBuyerRegistry.getServiceConfig.mockReturnValue({
        serviceTypeName: 'test-hvac',
        pricing: { basePrice: 75, minBid: 40, maxBid: 250 },
        webhookConfig: {
          pingUrl: 'https://legacy-network.com/api/ping',
          postUrl: 'https://legacy-network.com/api/leads',
          timeouts: { ping: 25000, post: 45000 }
        },
        active: true
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'accepted', price: 75.00 })
      });
      global.fetch = mockFetch;

      const leadData = {
        id: 'test-lead-data-format',
        serviceTypeId: testServiceType.id,
        zipCode: '10001',
        estimatedValue: 100,
        formData: {
          systemType: 'central_air',
          budget: '5000-8000',
          urgency: 'this_week',
          customerInfo: {
            name: 'Test Customer',
            phone: '(555) 123-4567',
            email: 'customer@test.com'
          }
        }
      };

      // Mock template engine to handle legacy format
      const originalTransform = require('@/lib/templates/engine').TemplateEngine.transform;
      require('@/lib/templates/engine').TemplateEngine.transform = jest.fn().mockResolvedValue({
        // Legacy format expected by existing network
        lead_id: leadData.id,
        service_type: 'hvac',
        customer_name: 'Test Customer',
        customer_phone: '(555) 123-4567',
        customer_email: 'customer@test.com',
        project_details: {
          system_type: 'central_air',
          budget_range: '5000-8000',
          timeline: 'this_week'
        },
        zip_code: '10001',
        estimated_value: 100,
        legacy_format: true // Indicates legacy formatting
      });

      await AuctionEngine.runAuction(leadData);

      // Verify legacy data format was used
      expect(mockFetch).toHaveBeenCalledWith(
        'https://legacy-network.com/api/ping',
        expect.objectContaining({
          body: expect.stringContaining('legacy_format')
        })
      );

      // Restore original transform
      require('@/lib/templates/engine').TemplateEngine.transform = originalTransform;
    });
  });

  describe('Mixed Environment Compatibility', () => {
    it('should handle auctions with both legacy and new buyers', async () => {
      // Setup service zone mappings
      await Promise.all([
        prisma.buyerServiceZipCode.create({
          data: {
            buyerId: existingNetworkBuyer.id,
            serviceTypeId: testServiceType.id,
            zipCode: '10005',
            active: true,
            priority: 90
          }
        }),
        prisma.buyerServiceZipCode.create({
          data: {
            buyerId: newContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '10005',
            active: true,
            priority: 95
          }
        })
      ]);

      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [
          {
            buyerId: existingNetworkBuyer.id,
            serviceZone: { id: 'legacy-zone', zipCode: '10005', priority: 90 },
            eligibilityScore: 88,
            reason: 'Legacy network buyer'
          },
          {
            buyerId: newContractor.id,
            serviceZone: { id: 'contractor-zone', zipCode: '10005', priority: 95 },
            eligibilityScore: 92,
            reason: 'New contractor'
          }
        ],
        eligibleCount: 2,
        excludedCount: 0,
        exclusions: []
      });

      mockBuyerRegistry.get.mockImplementation((buyerId: string) => {
        const baseConfig = {
          globalSettings: {
            complianceRequirements: {
              requireTrustedForm: false,
              requireJornaya: false,
              requireTcpaConsent: false
            }
          }
        };

        if (buyerId === existingNetworkBuyer.id) {
          return {
            ...baseConfig,
            id: existingNetworkBuyer.id,
            name: existingNetworkBuyer.name,
            type: existingNetworkBuyer.type,
            authConfig: {
              type: 'apiKey',
              credentials: { apiKey: 'legacy-key-789' }
            }
          };
        } else if (buyerId === newContractor.id) {
          return {
            ...baseConfig,
            id: newContractor.id,
            name: newContractor.name,
            type: newContractor.type,
            authConfig: {
              type: 'apiKey',
              credentials: { apiKey: 'new-contractor-key' }
            }
          };
        }
        return null;
      });

      mockBuyerRegistry.getServiceConfig.mockImplementation((buyerId: string) => {
        if (buyerId === existingNetworkBuyer.id) {
          return {
            serviceTypeName: 'test-hvac',
            pricing: { basePrice: 75, minBid: 40, maxBid: 250 },
            webhookConfig: {
              pingUrl: 'https://legacy-network.com/api/ping',
              postUrl: 'https://legacy-network.com/api/leads',
              timeouts: { ping: 25000, post: 45000 }
            },
            active: true
          };
        } else if (buyerId === newContractor.id) {
          return {
            serviceTypeName: 'test-hvac',
            pricing: { basePrice: 50, minBid: 25, maxBid: 150 },
            webhookConfig: {
              pingUrl: 'https://newcontractor.com/api/ping',
              postUrl: 'https://newcontractor.com/api/leads',
              timeouts: { ping: 30000, post: 60000 }
            },
            active: true
          };
        }
        return null;
      });

      // Mock responses - network bids higher
      const mockFetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'accepted', price: 95.00 })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ bidAmount: 75.00, interested: true })
        });
      global.fetch = mockFetch;

      const leadData = {
        id: 'test-lead-mixed',
        serviceTypeId: testServiceType.id,
        zipCode: '10005',
        estimatedValue: 120
      };

      const result = await AuctionEngine.runAuction(leadData);

      // Network buyer should win with higher bid
      expect(result.winningBuyerId).toBe(existingNetworkBuyer.id);
      expect(result.winningBidAmount).toBe(95.00);
      expect(result.allBids).toHaveLength(2);
      expect(result.participantCount).toBe(2);

      // Verify both buyers were contacted with appropriate formats
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should maintain performance with mixed buyer types', async () => {
      // Create multiple buyers of each type
      const additionalBuyers = await Promise.all([
        ...Array(3).fill(0).map((_, i) =>
          prisma.buyer.create({
            data: {
              name: `Legacy Network ${i + 1}`,
              type: BuyerType.NETWORK,
              apiUrl: `https://legacy${i + 1}.com/api`,
              authConfig: JSON.stringify({ apiKey: `legacy-key-${i + 1}` }),
              active: true,
              createdAt: new Date('2023-01-01')
            }
          })
        ),
        ...Array(3).fill(0).map((_, i) =>
          prisma.buyer.create({
            data: {
              name: `New Contractor ${i + 1}`,
              type: BuyerType.CONTRACTOR,
              apiUrl: `https://contractor${i + 1}.com/api`,
              authConfig: JSON.stringify({ 
                contactEmail: `contractor${i + 1}@test.com`,
                apiKey: `contractor-key-${i + 1}`
              }),
              active: true,
              createdAt: new Date()
            }
          })
        )
      ]);

      // Create service configurations for all buyers
      for (const buyer of additionalBuyers) {
        await prisma.buyerServiceConfig.create({
          data: {
            buyerId: buyer.id,
            serviceTypeId: testServiceType.id,
            pingTemplate: JSON.stringify({ template: 'standard' }),
            postTemplate: JSON.stringify({ template: 'standard' }),
            fieldMappings: JSON.stringify({ mapping: 'standard' }),
            minBid: buyer.type === BuyerType.NETWORK ? 40.00 : 25.00,
            maxBid: buyer.type === BuyerType.NETWORK ? 250.00 : 150.00,
            active: true
          }
        });

        await prisma.buyerServiceZipCode.create({
          data: {
            buyerId: buyer.id,
            serviceTypeId: testServiceType.id,
            zipCode: '10010',
            active: true,
            priority: 85
          }
        });
      }

      // Mock all buyers as eligible
      const allBuyerIds = [
        existingNetworkBuyer.id,
        newContractor.id,
        ...additionalBuyers.map(b => b.id)
      ];

      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: allBuyerIds.map((id, index) => ({
          buyerId: id,
          serviceZone: { id: `zone-${index}`, zipCode: '10010', priority: 85 },
          eligibilityScore: 85 + Math.random() * 10,
          reason: 'Active buyer'
        })),
        eligibleCount: allBuyerIds.length,
        excludedCount: 0,
        exclusions: []
      });

      // Mock configurations
      mockBuyerRegistry.get.mockImplementation((buyerId: string) => ({
        id: buyerId,
        name: 'Mock Buyer',
        type: additionalBuyers.find(b => b.id === buyerId)?.type || BuyerType.NETWORK,
        globalSettings: {
          complianceRequirements: {
            requireTrustedForm: false,
            requireJornaya: false,
            requireTcpaConsent: false
          }
        },
        authConfig: {
          type: 'apiKey',
          credentials: { apiKey: 'mock-key' }
        }
      }));

      mockBuyerRegistry.getServiceConfig.mockReturnValue({
        serviceTypeName: 'test-hvac',
        pricing: { basePrice: 60, minBid: 30, maxBid: 200 },
        webhookConfig: {
          pingUrl: 'https://mock.com/ping',
          postUrl: 'https://mock.com/post',
          timeouts: { ping: 5000, post: 10000 }
        },
        active: true
      });

      // Mock fast responses
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          bidAmount: 60.00 + Math.random() * 40,
          interested: true
        })
      });
      global.fetch = mockFetch;

      const leadData = {
        id: 'test-lead-performance',
        serviceTypeId: testServiceType.id,
        zipCode: '10010',
        estimatedValue: 150
      };

      const startTime = process.hrtime.bigint();
      const result = await AuctionEngine.runAuction(leadData);
      const auctionTime = Number(process.hrtime.bigint() - startTime) / 1000000;

      // Performance should be acceptable even with mixed types
      expect(auctionTime).toBeLessThan(10000); // Under 10 seconds
      expect(result.participantCount).toBe(allBuyerIds.length);
      expect(result.allBids.length).toBe(allBuyerIds.length);
      expect(result.status).toBe('completed');
    });
  });

  describe('Data Migration Compatibility', () => {
    it('should handle existing buyer data without corruption', async () => {
      // Verify existing buyer data integrity
      const existingBuyer = await prisma.buyer.findUnique({
        where: { id: existingNetworkBuyer.id }
      });

      expect(existingBuyer).not.toBeNull();
      expect(existingBuyer!.type).toBe(BuyerType.NETWORK);
      expect(existingBuyer!.name).toBe('Legacy Network Corp');
      expect(existingBuyer!.createdAt).toEqual(new Date('2023-01-01'));

      // Verify auth config parsing still works
      const authConfig = JSON.parse(existingBuyer!.authConfig || '{}');
      expect(authConfig.apiKey).toBe('legacy-key-789');
      expect(authConfig.webhookSecret).toBe('legacy-secret');

      // Verify service config compatibility
      const serviceConfig = await prisma.buyerServiceConfig.findFirst({
        where: {
          buyerId: existingNetworkBuyer.id,
          serviceTypeId: testServiceType.id
        }
      });

      expect(serviceConfig).not.toBeNull();
      expect(serviceConfig!.active).toBe(true);

      const pingTemplate = JSON.parse(serviceConfig!.pingTemplate);
      expect(pingTemplate.template).toBe('network-ping');
      expect(pingTemplate.version).toBe('1.0');
    });

    it('should support schema changes without breaking existing data', async () => {
      // Add new field to existing buyer (simulating schema migration)
      await prisma.buyer.update({
        where: { id: existingNetworkBuyer.id },
        data: {
          authConfig: JSON.stringify({
            apiKey: 'legacy-key-789',
            webhookSecret: 'legacy-secret',
            // New field added in migration
            migrationVersion: '2.0',
            backwardCompatible: true
          })
        }
      });

      // Verify data can still be read and used
      const updated = await prisma.buyer.findUnique({
        where: { id: existingNetworkBuyer.id }
      });

      const authConfig = JSON.parse(updated!.authConfig || '{}');
      expect(authConfig.apiKey).toBe('legacy-key-789'); // Original field preserved
      expect(authConfig.migrationVersion).toBe('2.0'); // New field added
      expect(authConfig.backwardCompatible).toBe(true);

      // Verify auction system still works with modified data
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [{
          buyerId: existingNetworkBuyer.id,
          serviceZone: { id: 'zone-1', zipCode: '10001', priority: 100 },
          eligibilityScore: 90,
          reason: 'Updated legacy buyer'
        }],
        eligibleCount: 1,
        excludedCount: 0,
        exclusions: []
      });

      mockBuyerRegistry.get.mockReturnValue({
        id: existingNetworkBuyer.id,
        name: existingNetworkBuyer.name,
        type: existingNetworkBuyer.type,
        globalSettings: {
          complianceRequirements: {
            requireTrustedForm: false,
            requireJornaya: false,
            requireTcpaConsent: false
          }
        },
        authConfig: {
          type: 'apiKey',
          credentials: { apiKey: 'legacy-key-789' }
        }
      });

      mockBuyerRegistry.getServiceConfig.mockReturnValue({
        serviceTypeName: 'test-hvac',
        pricing: { basePrice: 75, minBid: 40, maxBid: 250 },
        webhookConfig: {
          pingUrl: 'https://legacy-network.com/api/ping',
          postUrl: 'https://legacy-network.com/api/leads',
          timeouts: { ping: 25000, post: 45000 }
        },
        active: true
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'accepted', price: 80.00 })
      });
      global.fetch = mockFetch;

      const leadData = {
        id: 'test-lead-schema-change',
        serviceTypeId: testServiceType.id,
        zipCode: '10001',
        estimatedValue: 120
      };

      const result = await AuctionEngine.runAuction(leadData);

      expect(result.winningBuyerId).toBe(existingNetworkBuyer.id);
      expect(result.status).toBe('completed');
    });
  });
});