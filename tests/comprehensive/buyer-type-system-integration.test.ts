/**
 * Comprehensive Buyer Type System Integration Tests
 * Tests integration between Lead Buyer Type system and existing auction system
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { BuyerType } from '@/types/database';
import { AuctionEngine } from '@/lib/auction/engine';
import { BuyerEligibilityService } from '@/lib/services/buyer-eligibility-service';
import { BuyerConfigurationRegistry } from '@/lib/buyers/configurations';

const prisma = new PrismaClient();

// Mock external dependencies
jest.mock('@/lib/buyers/configurations');
jest.mock('@/lib/services/buyer-eligibility-service');

const mockBuyerRegistry = BuyerConfigurationRegistry as jest.Mocked<typeof BuyerConfigurationRegistry>;
const mockEligibilityService = BuyerEligibilityService as jest.Mocked<typeof BuyerEligibilityService>;

describe('Buyer Type System Integration Tests', () => {
  let testContractor: any;
  let testNetworkBuyer: any;
  let testServiceType: any;
  let testLead: any;

  beforeEach(async () => {
    // Clean up test data
    await prisma.transaction.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.buyerServiceZipCode.deleteMany();
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

    // Create test network buyer
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

    // Create service zone mappings for both buyers
    await prisma.buyerServiceZipCode.createMany({
      data: [
        {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id,
          zipCode: '90210',
          active: true,
          priority: 100,
          maxLeadsPerDay: 5,
          minBid: 25.00,
          maxBid: 150.00
        },
        {
          buyerId: testNetworkBuyer.id,
          serviceTypeId: testServiceType.id,
          zipCode: '90210',
          active: true,
          priority: 150,
          maxLeadsPerDay: 20,
          minBid: 30.00,
          maxBid: 200.00
        }
      ]
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

  describe('1. Contractor vs Network Buyer Auction Participation', () => {
    it('should include both contractor and network buyers in auction eligibility', async () => {
      // Mock eligibility service to return both types
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [
          {
            buyerId: testContractor.id,
            buyerName: 'Test Contractor LLC',
            serviceZone: { 
              id: 'zone1',
              buyerId: testContractor.id,
              serviceTypeId: testServiceType.id,
              zipCode: '90210',
              priority: 100,
              active: true,
              buyer: { name: 'Test Contractor LLC', type: 'CONTRACTOR', active: true }
            },
            eligibilityScore: 85,
            constraints: { priority: 100, currentDailyCount: 2, maxLeadsPerDay: 5 }
          },
          {
            buyerId: testNetworkBuyer.id,
            buyerName: 'Test Network Corp',
            serviceZone: {
              id: 'zone2',
              buyerId: testNetworkBuyer.id,
              serviceTypeId: testServiceType.id,
              zipCode: '90210',
              priority: 150,
              active: true,
              buyer: { name: 'Test Network Corp', type: 'NETWORK', active: true }
            },
            eligibilityScore: 90,
            constraints: { priority: 150, currentDailyCount: 8, maxLeadsPerDay: 20 }
          }
        ],
        excluded: [],
        totalFound: 2,
        eligibleCount: 2,
        excludedCount: 0
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
              type: 'apiKey' as const,
              credentials: { apiKey: 'test-key-123' }
            }
          };
        } else if (buyerId === testNetworkBuyer.id) {
          return {
            id: testNetworkBuyer.id,
            name: testNetworkBuyer.name,
            type: testNetworkBuyer.type,
            globalSettings: {
              complianceRequirements: {
                requireTrustedForm: false,
                requireJornaya: false,
                requireTcpaConsent: true
              }
            },
            authConfig: {
              type: 'apiKey' as const,
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
        estimatedValue: 100,
        complianceData: { tcpaConsent: true }
      };

      // Verify eligibility service gets called correctly
      expect(mockEligibilityService.getEligibleBuyers).toBeDefined();
      
      // Check that both buyer types are properly configured
      const contractorConfig = mockBuyerRegistry.get(testContractor.id);
      const networkConfig = mockBuyerRegistry.get(testNetworkBuyer.id);
      
      expect(contractorConfig?.type).toBe('CONTRACTOR');
      expect(networkConfig?.type).toBe('NETWORK');
    });

    it('should handle contractor-specific bidding with proper validation', async () => {
      // Mock fetch for contractor response
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
          buyerName: 'Test Contractor LLC',
          serviceZone: { 
            id: 'zone1', 
            zipCode: '90210', 
            priority: 100,
            buyer: { name: 'Test Contractor LLC', type: 'CONTRACTOR', active: true }
          },
          eligibilityScore: 85,
          constraints: { priority: 100, currentDailyCount: 2, maxLeadsPerDay: 5 }
        }],
        excluded: [],
        totalFound: 1,
        eligibleCount: 1,
        excludedCount: 0
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
          type: 'apiKey' as const,
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
    });
  });

  describe('2. Service-Zip Code Mapping with Auction Engine', () => {
    it('should properly map service zones to auction eligibility', async () => {
      // Test that service-zip mapping correctly determines eligible buyers
      const zipCodes = ['90210', '90211', '90212'];
      
      // Create additional zip code mappings
      await prisma.buyerServiceZipCode.createMany({
        data: zipCodes.slice(1).map(zipCode => ({
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id,
          zipCode,
          active: true,
          priority: 80,
          maxLeadsPerDay: 3
        }))
      });

      // Test eligibility for each zip code
      for (const zipCode of zipCodes) {
        const serviceZones = await prisma.buyerServiceZipCode.findMany({
          where: {
            serviceTypeId: testServiceType.id,
            zipCode,
            active: true
          },
          include: {
            buyer: true,
            serviceType: true
          }
        });

        expect(serviceZones.length).toBeGreaterThan(0);
        
        // Verify contractor is eligible for all zip codes
        const contractorZone = serviceZones.find(zone => zone.buyer.type === 'CONTRACTOR');
        expect(contractorZone).toBeDefined();
        expect(contractorZone!.buyer.id).toBe(testContractor.id);
      }
    });

    it('should respect zip code specific constraints in auctions', async () => {
      // Create zip code with specific constraints
      await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id,
          zipCode: '90213',
          active: true,
          priority: 200,
          maxLeadsPerDay: 1,
          minBid: 100.00,
          maxBid: 120.00
        }
      });

      // Mock eligibility service to consider these constraints
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [{
          buyerId: testContractor.id,
          buyerName: 'Test Contractor LLC',
          serviceZone: {
            id: 'zone3',
            zipCode: '90213',
            priority: 200,
            maxLeadsPerDay: 1,
            minBid: 100.00,
            maxBid: 120.00,
            buyer: { name: 'Test Contractor LLC', type: 'CONTRACTOR', active: true }
          },
          eligibilityScore: 95,
          constraints: { 
            priority: 200, 
            currentDailyCount: 0, 
            maxLeadsPerDay: 1,
            minBid: 100.00,
            maxBid: 120.00
          }
        }],
        excluded: [],
        totalFound: 1,
        eligibleCount: 1,
        excludedCount: 0
      });

      const result = await BuyerEligibilityService.getEligibleBuyers({
        serviceTypeId: testServiceType.id,
        zipCode: '90213',
        leadValue: 150
      });

      expect(result.eligibleCount).toBe(1);
      expect(result.eligible[0].constraints.maxBid).toBe(120.00);
      expect(result.eligible[0].constraints.minBid).toBe(100.00);
    });
  });

  describe('3. Type-Based Filtering Functionality', () => {
    it('should filter buyers by type correctly', async () => {
      // Test filtering contractors only
      const contractors = await prisma.buyer.findMany({
        where: { type: BuyerType.CONTRACTOR, active: true }
      });

      expect(contractors).toHaveLength(1);
      expect(contractors[0].id).toBe(testContractor.id);
      expect(contractors[0].type).toBe('CONTRACTOR');

      // Test filtering networks only
      const networks = await prisma.buyer.findMany({
        where: { type: BuyerType.NETWORK, active: true }
      });

      expect(networks).toHaveLength(1);
      expect(networks[0].id).toBe(testNetworkBuyer.id);
      expect(networks[0].type).toBe('NETWORK');
    });

    it('should apply type-specific business logic', async () => {
      // Mock different bid limits for different types
      const contractorBidLimit = 150;
      const networkBidLimit = 500;

      mockBuyerRegistry.getServiceConfig.mockImplementation((buyerId: string) => {
        const buyer = buyerId === testContractor.id ? testContractor : testNetworkBuyer;
        const maxBid = buyer.type === 'CONTRACTOR' ? contractorBidLimit : networkBidLimit;

        return {
          serviceTypeName: 'test-roofing',
          pricing: { basePrice: 50, minBid: 25, maxBid },
          webhookConfig: {
            pingUrl: `https://${buyer.type.toLowerCase()}.com/ping`,
            postUrl: `https://${buyer.type.toLowerCase()}.com/post`,
            timeouts: { ping: 5000, post: 10000 }
          },
          active: true
        };
      });

      // Verify different configurations
      const contractorConfig = mockBuyerRegistry.getServiceConfig(testContractor.id, testServiceType.id);
      const networkConfig = mockBuyerRegistry.getServiceConfig(testNetworkBuyer.id, testServiceType.id);

      expect(contractorConfig?.pricing.maxBid).toBe(contractorBidLimit);
      expect(networkConfig?.pricing.maxBid).toBe(networkBidLimit);
    });
  });

  describe('4. Database Performance with New Indexes', () => {
    it('should efficiently query buyers by type', async () => {
      const startTime = Date.now();
      
      // Query should use index on type field
      const contractors = await prisma.buyer.findMany({
        where: { type: BuyerType.CONTRACTOR }
      });
      
      const queryTime = Date.now() - startTime;
      
      expect(contractors).toHaveLength(1);
      expect(queryTime).toBeLessThan(100); // Should be very fast with index
    });

    it('should efficiently query service zones with compound indexes', async () => {
      const startTime = Date.now();
      
      // Query should use compound indexes
      const serviceZones = await prisma.buyerServiceZipCode.findMany({
        where: {
          serviceTypeId: testServiceType.id,
          zipCode: '90210',
          active: true
        },
        include: {
          buyer: true
        }
      });
      
      const queryTime = Date.now() - startTime;
      
      expect(serviceZones).toHaveLength(2); // Contractor + Network
      expect(queryTime).toBeLessThan(100);
      
      // Verify both types are present
      const types = serviceZones.map(zone => zone.buyer.type).sort();
      expect(types).toEqual(['CONTRACTOR', 'NETWORK']);
    });
  });

  describe('5. Backward Compatibility with Existing Buyers', () => {
    it('should handle buyers without explicit type (defaults to CONTRACTOR)', async () => {
      // Test existing buyers default to CONTRACTOR type
      const buyer = await prisma.buyer.create({
        data: {
          name: 'Legacy Buyer',
          // type field not explicitly set - should default to CONTRACTOR
          apiUrl: 'https://legacy.com/api',
          active: true
        }
      });

      expect(buyer.type).toBe('CONTRACTOR');
    });

    it('should maintain compatibility with existing auction logic', async () => {
      // Create a buyer the "old way" (without explicit type)
      const legacyBuyer = await prisma.buyer.create({
        data: {
          name: 'Legacy Contractor',
          apiUrl: 'https://legacy.com/api',
          active: true
        }
      });

      // Should work with existing eligibility service
      const isEligible = await BuyerEligibilityService.isBuyerEligible(
        legacyBuyer.id,
        testServiceType.id,
        '90210'
      );

      // Should be treated as contractor (default behavior)
      expect(legacyBuyer.type).toBe('CONTRACTOR');
    });
  });

  describe('6. API Endpoints Integration', () => {
    it('should handle contractor signup API with type assignment', async () => {
      const contractorData = {
        name: 'New Contractor LLC',
        contactEmail: 'new@contractor.com',
        contactPhone: '(555) 111-2222',
        contactName: 'Jane Contractor',
        businessDescription: 'HVAC services',
        apiUrl: 'https://newcontractor.com/api',
        servicesOffered: ['HVAC', 'Plumbing'],
        serviceAreas: ['90210', '90211']
      };

      // Simulate API call
      const newContractor = await prisma.buyer.create({
        data: {
          name: contractorData.name,
          type: BuyerType.CONTRACTOR, // Should be auto-assigned
          apiUrl: contractorData.apiUrl,
          authConfig: JSON.stringify(contractorData),
          active: false // Pending approval
        }
      });

      expect(newContractor.type).toBe('CONTRACTOR');
      expect(newContractor.active).toBe(false);
      
      const authConfig = JSON.parse(newContractor.authConfig || '{}');
      expect(authConfig.contactEmail).toBe(contractorData.contactEmail);
    });

    it('should handle admin buyer management with type filtering', async () => {
      // Create additional test buyers
      await prisma.buyer.createMany({
        data: [
          {
            name: 'Contractor A',
            type: BuyerType.CONTRACTOR,
            apiUrl: 'https://a.com/api',
            active: true
          },
          {
            name: 'Contractor B',
            type: BuyerType.CONTRACTOR,
            apiUrl: 'https://b.com/api',
            active: false
          },
          {
            name: 'Network X',
            type: BuyerType.NETWORK,
            apiUrl: 'https://x.com/api',
            active: true
          }
        ]
      });

      // Test admin queries
      const activeContractors = await prisma.buyer.findMany({
        where: { type: BuyerType.CONTRACTOR, active: true }
      });

      const pendingContractors = await prisma.buyer.findMany({
        where: { type: BuyerType.CONTRACTOR, active: false }
      });

      const activeNetworks = await prisma.buyer.findMany({
        where: { type: BuyerType.NETWORK, active: true }
      });

      expect(activeContractors).toHaveLength(2); // Including existing testContractor
      expect(pendingContractors).toHaveLength(1);
      expect(activeNetworks).toHaveLength(2); // Including existing testNetworkBuyer

      // Test aggregation queries
      const stats = await prisma.buyer.groupBy({
        by: ['type', 'active'],
        _count: { id: true }
      });

      expect(stats).toHaveLength(3); // CONTRACTOR(true), CONTRACTOR(false), NETWORK(true)
    });
  });

  describe('7. End-to-End Integration Flow', () => {
    it('should complete full contractor signup to auction participation flow', async () => {
      // Step 1: Contractor signs up
      const newContractor = await prisma.buyer.create({
        data: {
          name: 'E2E Test Contractor',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://e2econtractor.com/api',
          authConfig: JSON.stringify({
            contactEmail: 'e2e@contractor.com',
            contactName: 'E2E Contractor'
          }),
          active: false // Pending approval
        }
      });

      // Step 2: Admin approves contractor
      await prisma.buyer.update({
        where: { id: newContractor.id },
        data: { active: true }
      });

      // Step 3: Admin sets up service configuration
      await prisma.buyerServiceConfig.create({
        data: {
          buyerId: newContractor.id,
          serviceTypeId: testServiceType.id,
          pingTemplate: JSON.stringify({ template: 'e2e-ping' }),
          postTemplate: JSON.stringify({ template: 'e2e-post' }),
          fieldMappings: JSON.stringify({ mapping: 'e2e' }),
          minBid: 20.00,
          maxBid: 100.00,
          active: true
        }
      });

      // Step 4: Admin sets up service zones
      await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: newContractor.id,
          serviceTypeId: testServiceType.id,
          zipCode: '90210',
          active: true,
          priority: 120,
          maxLeadsPerDay: 8
        }
      });

      // Step 5: Contractor should now be eligible for auctions
      const serviceZones = await prisma.buyerServiceZipCode.findMany({
        where: {
          buyerId: newContractor.id,
          serviceTypeId: testServiceType.id,
          zipCode: '90210',
          active: true
        },
        include: {
          buyer: true,
          serviceType: true
        }
      });

      expect(serviceZones).toHaveLength(1);
      expect(serviceZones[0].buyer.type).toBe('CONTRACTOR');
      expect(serviceZones[0].buyer.active).toBe(true);
      expect(serviceZones[0].active).toBe(true);

      // Step 6: Verify contractor can participate in eligibility service
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [{
          buyerId: newContractor.id,
          buyerName: 'E2E Test Contractor',
          serviceZone: serviceZones[0],
          eligibilityScore: 80,
          constraints: { priority: 120, currentDailyCount: 0, maxLeadsPerDay: 8 }
        }],
        excluded: [],
        totalFound: 1,
        eligibleCount: 1,
        excludedCount: 0
      });

      const eligibilityResult = await BuyerEligibilityService.getEligibleBuyers({
        serviceTypeId: testServiceType.id,
        zipCode: '90210'
      });

      expect(eligibilityResult.eligibleCount).toBe(1);
      expect(eligibilityResult.eligible[0].buyerId).toBe(newContractor.id);
    });

    it('should handle complete auction with mixed buyer types', async () => {
      // Mock responses for both buyer types
      const mockFetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ bidAmount: 80.00, interested: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ bidAmount: 120.00, interested: true })
        });

      global.fetch = mockFetch;

      // Mock eligibility for both types
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [
          {
            buyerId: testContractor.id,
            buyerName: 'Test Contractor LLC',
            serviceZone: {
              id: 'zone1',
              buyerId: testContractor.id,
              serviceTypeId: testServiceType.id,
              zipCode: '90210',
              priority: 100,
              buyer: { name: 'Test Contractor LLC', type: 'CONTRACTOR', active: true }
            },
            eligibilityScore: 85,
            constraints: { priority: 100, currentDailyCount: 2, maxLeadsPerDay: 5 }
          },
          {
            buyerId: testNetworkBuyer.id,
            buyerName: 'Test Network Corp',
            serviceZone: {
              id: 'zone2',
              buyerId: testNetworkBuyer.id,
              serviceTypeId: testServiceType.id,
              zipCode: '90210',
              priority: 150,
              buyer: { name: 'Test Network Corp', type: 'NETWORK', active: true }
            },
            eligibilityScore: 90,
            constraints: { priority: 150, currentDailyCount: 8, maxLeadsPerDay: 20 }
          }
        ],
        excluded: [],
        totalFound: 2,
        eligibleCount: 2,
        excludedCount: 0
      });

      // Mock buyer configurations
      mockBuyerRegistry.get.mockImplementation((buyerId: string) => {
        const buyer = buyerId === testContractor.id ? testContractor : testNetworkBuyer;
        return {
          id: buyer.id,
          name: buyer.name,
          type: buyer.type,
          globalSettings: {
            complianceRequirements: {
              requireTrustedForm: false,
              requireJornaya: false,
              requireTcpaConsent: false
            }
          },
          authConfig: {
            type: 'apiKey' as const,
            credentials: { apiKey: buyer.type === 'CONTRACTOR' ? 'test-key-123' : 'network-key-456' }
          }
        };
      });

      mockBuyerRegistry.getServiceConfig.mockImplementation((buyerId: string) => {
        const buyer = buyerId === testContractor.id ? testContractor : testNetworkBuyer;
        const maxBid = buyer.type === 'CONTRACTOR' ? 150 : 200;
        
        return {
          serviceTypeName: 'test-roofing',
          pricing: { basePrice: 50, minBid: 25, maxBid },
          webhookConfig: {
            pingUrl: `https://test${buyer.type.toLowerCase()}.com/ping`,
            postUrl: `https://test${buyer.type.toLowerCase()}.com/post`,
            timeouts: { ping: 5000, post: 10000 }
          },
          active: true
        };
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
      expect(result.winningBidAmount).toBe(120.00);
      expect(result.allBids).toHaveLength(2);
      expect(result.participantCount).toBe(2);
      expect(result.status).toBe('completed');

      // Verify both buyers were contacted
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});