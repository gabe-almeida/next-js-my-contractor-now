/**
 * Auction System Integration Tests
 * Tests integration with existing auction system and contractor participation
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { BuyerType, Lead, Buyer } from '@/types/database';
import { AuctionEngine } from '@/lib/auction/engine';
import { BuyerEligibilityService } from '@/lib/services/buyer-eligibility-service';
import { BuyerConfigurationRegistry } from '@/lib/buyers/configurations';

const prisma = new PrismaClient();

// Mock external dependencies
jest.mock('@/lib/buyers/configurations');
jest.mock('@/lib/services/buyer-eligibility-service');

const mockBuyerRegistry = BuyerConfigurationRegistry as jest.Mocked<typeof BuyerConfigurationRegistry>;
const mockEligibilityService = BuyerEligibilityService as jest.Mocked<typeof BuyerEligibilityService>;

describe('3. Integration with Existing Auction System', () => {
  let testContractor: Buyer;
  let testNetworkBuyer: Buyer;
  let testServiceType: any;
  let testLead: any;

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
        name: 'test-roofing',
        displayName: 'Test Roofing Services',
        formSchema: JSON.stringify({ fields: ['projectType', 'budget', 'timeline'] }),
        active: true
      }
    });

    // Create test contractor
    testContractor = await prisma.buyer.create({
      data: {
        name: 'Test Contractor LLC',
        type: BuyerType.CONTRACTOR,
        apiUrl: 'https://testcontractor.com/api/leads',
        authConfig: JSON.stringify({
          contactEmail: 'contractor@test.com',
          contactPhone: '(555) 123-4567',
          contactName: 'John Contractor',
          businessDescription: 'Professional roofing services',
          apiKey: 'test-key-123'
        }),
        active: true,
        pingTimeout: 30,
        postTimeout: 60
      }
    });

    // Create test network buyer for comparison
    testNetworkBuyer = await prisma.buyer.create({
      data: {
        name: 'Test Network Corp',
        type: BuyerType.NETWORK,
        apiUrl: 'https://testnetwork.com/api/leads',
        authConfig: JSON.stringify({
          apiKey: 'network-key-456'
        }),
        active: true,
        pingTimeout: 30,
        postTimeout: 60
      }
    });

    // Create service configurations
    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: testContractor.id,
        serviceTypeId: testServiceType.id,
        pingTemplate: JSON.stringify({ template: 'contractor-ping' }),
        postTemplate: JSON.stringify({ template: 'contractor-post' }),
        fieldMappings: JSON.stringify({ mapping: 'contractor' }),
        minBid: 25.00,
        maxBid: 150.00,
        active: true
      }
    });

    await prisma.buyerServiceConfig.create({
      data: {
        buyerId: testNetworkBuyer.id,
        serviceTypeId: testServiceType.id,
        pingTemplate: JSON.stringify({ template: 'network-ping' }),
        postTemplate: JSON.stringify({ template: 'network-post' }),
        fieldMappings: JSON.stringify({ mapping: 'network' }),
        minBid: 30.00,
        maxBid: 200.00,
        active: true
      }
    });

    // Create test lead
    testLead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: JSON.stringify({
          projectType: 'roof replacement',
          budget: '$15000',
          timeline: '2-4 weeks',
          contactInfo: {
            name: 'Test Customer',
            email: 'customer@test.com',
            phone: '(555) 987-6543'
          }
        }),
        zipCode: '90210',
        ownsHome: true,
        timeframe: 'ASAP',
        status: 'PENDING'
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Contractor Participation in Auctions', () => {
    it('should include contractors in auction eligibility', async () => {
      // Mock eligibility service to return both contractor and network
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [
          {
            buyerId: testContractor.id,
            serviceZone: { id: 'zone1', zipCode: '90210', priority: 1 },
            eligibilityScore: 85,
            reason: 'Active contractor with service coverage'
          },
          {
            buyerId: testNetworkBuyer.id,
            serviceZone: { id: 'zone2', zipCode: '90210', priority: 2 },
            eligibilityScore: 90,
            reason: 'Network buyer with high priority'
          }
        ],
        eligibleCount: 2,
        excludedCount: 0,
        exclusions: []
      });

      // Mock buyer registry
      mockBuyerRegistry.get.mockImplementation((buyerId: string) => {
        if (buyerId === testContractor.id) {
          return {
            id: testContractor.id,
            name: testContractor.name,
            type: testContractor.type,
            globalSettings: {
              complianceRequirements: {
                requireTrustedForm: false,
                requireJornaya: false,
                requireTcpaConsent: true
              }
            },
            authConfig: {
              type: 'apiKey',
              credentials: { apiKey: 'test-key-123' }
            }
          };
        }
        return null;
      });

      mockBuyerRegistry.getServiceConfig.mockReturnValue({
        serviceTypeName: 'test-roofing',
        pricing: { basePrice: 50, minBid: 25, maxBid: 150 },
        webhookConfig: {
          pingUrl: 'https://testcontractor.com/ping',
          postUrl: 'https://testcontractor.com/post',
          timeouts: { ping: 5000, post: 10000 }
        },
        active: true
      });

      const leadData = {
        id: testLead.id,
        serviceTypeId: testServiceType.id,
        zipCode: '90210',
        estimatedValue: 100,
        complianceData: { tcpaConsent: true }
      };

      // Run auction
      const result = await AuctionEngine.runAuction(leadData);

      expect(mockEligibilityService.getEligibleBuyers).toHaveBeenCalledWith({
        serviceTypeId: testServiceType.id,
        zipCode: '90210',
        leadValue: 100,
        maxParticipants: 10,
        requireMinBid: true,
        minBidThreshold: 10
      });

      expect(result.participantCount).toBeGreaterThan(0);
    });

    it('should handle contractor-specific bidding logic', async () => {
      // Mock a contractor response with bid
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          bidAmount: 75.00,
          interested: true,
          message: 'We can handle this roofing project'
        })
      });

      global.fetch = mockFetch;

      // Mock eligibility for contractor only
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [{
          buyerId: testContractor.id,
          serviceZone: { id: 'zone1', zipCode: '90210', priority: 1 },
          eligibilityScore: 85,
          reason: 'Active contractor'
        }],
        eligibleCount: 1,
        excludedCount: 0,
        exclusions: []
      });

      mockBuyerRegistry.get.mockReturnValue({
        id: testContractor.id,
        name: testContractor.name,
        type: testContractor.type,
        globalSettings: {
          complianceRequirements: {
            requireTrustedForm: false,
            requireJornaya: false,
            requireTcpaConsent: false
          }
        },
        authConfig: {
          type: 'apiKey',
          credentials: { apiKey: 'test-key-123' }
        }
      });

      mockBuyerRegistry.getServiceConfig.mockReturnValue({
        serviceTypeName: 'test-roofing',
        pricing: { basePrice: 50, minBid: 25, maxBid: 150 },
        webhookConfig: {
          pingUrl: 'https://testcontractor.com/ping',
          postUrl: 'https://testcontractor.com/post',
          timeouts: { ping: 5000, post: 10000 }
        },
        active: true
      });

      const leadData = {
        id: testLead.id,
        serviceTypeId: testServiceType.id,
        zipCode: '90210',
        estimatedValue: 100
      };

      const result = await AuctionEngine.runAuction(leadData);

      expect(result.winningBuyerId).toBe(testContractor.id);
      expect(result.winningBidAmount).toBe(75.00);
      expect(result.status).toBe('completed');

      // Verify PING was sent to contractor
      expect(mockFetch).toHaveBeenCalledWith(
        'https://testcontractor.com/ping',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-key-123'
          })
        })
      );
    });

    it('should handle mixed contractor and network buyer auctions', async () => {
      // Mock responses for both buyers
      const mockFetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ bidAmount: 80.00, interested: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ bidAmount: 95.00, interested: true })
        });

      global.fetch = mockFetch;

      // Mock eligibility for both buyers
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [
          {
            buyerId: testContractor.id,
            serviceZone: { id: 'zone1', zipCode: '90210', priority: 1 },
            eligibilityScore: 85,
            reason: 'Active contractor'
          },
          {
            buyerId: testNetworkBuyer.id,
            serviceZone: { id: 'zone2', zipCode: '90210', priority: 2 },
            eligibilityScore: 90,
            reason: 'Network buyer'
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

        if (buyerId === testContractor.id) {
          return {
            ...baseConfig,
            id: testContractor.id,
            name: testContractor.name,
            type: testContractor.type,
            authConfig: {
              type: 'apiKey',
              credentials: { apiKey: 'test-key-123' }
            }
          };
        } else if (buyerId === testNetworkBuyer.id) {
          return {
            ...baseConfig,
            id: testNetworkBuyer.id,
            name: testNetworkBuyer.name,
            type: testNetworkBuyer.type,
            authConfig: {
              type: 'apiKey',
              credentials: { apiKey: 'network-key-456' }
            }
          };
        }
        return null;
      });

      mockBuyerRegistry.getServiceConfig.mockImplementation((buyerId: string) => {
        if (buyerId === testContractor.id) {
          return {
            serviceTypeName: 'test-roofing',
            pricing: { basePrice: 50, minBid: 25, maxBid: 150 },
            webhookConfig: {
              pingUrl: 'https://testcontractor.com/ping',
              postUrl: 'https://testcontractor.com/post',
              timeouts: { ping: 5000, post: 10000 }
            },
            active: true
          };
        } else if (buyerId === testNetworkBuyer.id) {
          return {
            serviceTypeName: 'test-roofing',
            pricing: { basePrice: 60, minBid: 30, maxBid: 200 },
            webhookConfig: {
              pingUrl: 'https://testnetwork.com/ping',
              postUrl: 'https://testnetwork.com/post',
              timeouts: { ping: 5000, post: 10000 }
            },
            active: true
          };
        }
        return null;
      });

      const leadData = {
        id: testLead.id,
        serviceTypeId: testServiceType.id,
        zipCode: '90210',
        estimatedValue: 100
      };

      const result = await AuctionEngine.runAuction(leadData);

      // Network buyer should win with higher bid
      expect(result.winningBuyerId).toBe(testNetworkBuyer.id);
      expect(result.winningBidAmount).toBe(95.00);
      expect(result.allBids).toHaveLength(2);
      expect(result.participantCount).toBe(2);
    });
  });

  describe('Contractor-specific Auction Features', () => {
    it('should apply contractor-specific bid validation', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          bidAmount: 250.00, // Exceeds contractor's max bid
          interested: true
        })
      });

      global.fetch = mockFetch;

      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [{
          buyerId: testContractor.id,
          serviceZone: { id: 'zone1', zipCode: '90210', priority: 1 },
          eligibilityScore: 85,
          reason: 'Active contractor'
        }],
        eligibleCount: 1,
        excludedCount: 0,
        exclusions: []
      });

      mockBuyerRegistry.get.mockReturnValue({
        id: testContractor.id,
        name: testContractor.name,
        type: testContractor.type,
        globalSettings: {
          complianceRequirements: {
            requireTrustedForm: false,
            requireJornaya: false,
            requireTcpaConsent: false
          }
        },
        authConfig: {
          type: 'apiKey',
          credentials: { apiKey: 'test-key-123' }
        }
      });

      mockBuyerRegistry.getServiceConfig.mockReturnValue({
        serviceTypeName: 'test-roofing',
        pricing: { basePrice: 50, minBid: 25, maxBid: 150 }, // Max bid is 150
        webhookConfig: {
          pingUrl: 'https://testcontractor.com/ping',
          postUrl: 'https://testcontractor.com/post',
          timeouts: { ping: 5000, post: 10000 }
        },
        active: true
      });

      const leadData = {
        id: testLead.id,
        serviceTypeId: testServiceType.id,
        zipCode: '90210',
        estimatedValue: 100
      };

      const result = await AuctionEngine.runAuction(leadData);

      // Bid should be clamped to max allowed (150)
      expect(result.winningBidAmount).toBe(150.00);
      expect(result.allBids[0].metadata?.originalBid).toBe(250.00);
      expect(result.allBids[0].metadata?.validated).toBe(true);
    });

    it('should handle contractor authentication properly', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ bidAmount: 75.00, interested: true })
      });

      global.fetch = mockFetch;

      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [{
          buyerId: testContractor.id,
          serviceZone: { id: 'zone1', zipCode: '90210', priority: 1 },
          eligibilityScore: 85,
          reason: 'Active contractor'
        }],
        eligibleCount: 1,
        excludedCount: 0,
        exclusions: []
      });

      mockBuyerRegistry.get.mockReturnValue({
        id: testContractor.id,
        name: testContractor.name,
        type: testContractor.type,
        globalSettings: {
          complianceRequirements: {
            requireTrustedForm: false,
            requireJornaya: false,
            requireTcpaConsent: false
          }
        },
        authConfig: {
          type: 'apiKey',
          credentials: { apiKey: 'contractor-auth-key' },
          headers: {
            'X-Company': 'Test Contractor LLC',
            'X-Contact-Email': 'contractor@test.com'
          }
        }
      });

      mockBuyerRegistry.getServiceConfig.mockReturnValue({
        serviceTypeName: 'test-roofing',
        pricing: { basePrice: 50, minBid: 25, maxBid: 150 },
        webhookConfig: {
          pingUrl: 'https://testcontractor.com/ping',
          postUrl: 'https://testcontractor.com/post',
          timeouts: { ping: 5000, post: 10000 },
          headers: {
            'X-Service': 'roofing'
          }
        },
        active: true
      });

      const leadData = {
        id: testLead.id,
        serviceTypeId: testServiceType.id,
        zipCode: '90210',
        estimatedValue: 100
      };

      await AuctionEngine.runAuction(leadData);

      // Verify correct headers were sent
      expect(mockFetch).toHaveBeenCalledWith(
        'https://testcontractor.com/ping',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'contractor-auth-key',
            'X-Company': 'Test Contractor LLC',
            'X-Contact-Email': 'contractor@test.com',
            'X-Service': 'roofing'
          })
        })
      );
    });
  });

  describe('Transaction Logging for Contractors', () => {
    it('should log contractor transactions with proper type identification', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ bidAmount: 60.00, interested: true })
      });

      global.fetch = mockFetch;

      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [{
          buyerId: testContractor.id,
          serviceZone: { id: 'zone1', zipCode: '90210', priority: 1 },
          eligibilityScore: 85,
          reason: 'Active contractor'
        }],
        eligibleCount: 1,
        excludedCount: 0,
        exclusions: []
      });

      mockBuyerRegistry.get.mockReturnValue({
        id: testContractor.id,
        name: testContractor.name,
        type: testContractor.type,
        globalSettings: {
          complianceRequirements: {
            requireTrustedForm: false,
            requireJornaya: false,
            requireTcpaConsent: false
          }
        },
        authConfig: {
          type: 'apiKey',
          credentials: { apiKey: 'test-key-123' }
        }
      });

      mockBuyerRegistry.getServiceConfig.mockReturnValue({
        serviceTypeName: 'test-roofing',
        pricing: { basePrice: 50, minBid: 25, maxBid: 150 },
        webhookConfig: {
          pingUrl: 'https://testcontractor.com/ping',
          postUrl: 'https://testcontractor.com/post',
          timeouts: { ping: 5000, post: 10000 }
        },
        active: true
      });

      const leadData = {
        id: testLead.id,
        serviceTypeId: testServiceType.id,
        zipCode: '90210',
        estimatedValue: 100
      };

      const result = await AuctionEngine.runAuction(leadData);

      // Verify transaction was logged
      const transactions = await prisma.transaction.findMany({
        where: {
          leadId: testLead.id,
          buyerId: testContractor.id
        }
      });

      expect(transactions).toHaveLength(2); // PING and POST
      
      const pingTransaction = transactions.find(t => t.actionType === 'PING');
      const postTransaction = transactions.find(t => t.actionType === 'POST');

      expect(pingTransaction).toBeDefined();
      expect(pingTransaction!.status).toBe('SUCCESS');
      expect(pingTransaction!.bidAmount).toBe(60.00);

      expect(postTransaction).toBeDefined();
      expect(postTransaction!.status).toBe('SUCCESS');
    });
  });
});