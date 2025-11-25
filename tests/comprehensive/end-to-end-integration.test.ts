/**
 * End-to-End Integration Tests
 * Tests complete contractor signup to auction participation flow
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

describe('End-to-End Integration Tests', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.transaction.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.buyerServiceZipCode.deleteMany();
    await prisma.buyerServiceConfig.deleteMany();
    await prisma.buyer.deleteMany({ where: { name: { contains: 'E2E Test' } } });
    await prisma.serviceType.deleteMany({ where: { name: { contains: 'e2e' } } });

    // Reset mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Complete Contractor Onboarding Flow', () => {
    it('should handle full contractor signup to auction eligibility flow', async () => {
      // Step 1: Create service types that contractors can serve
      const roofingService = await prisma.serviceType.create({
        data: {
          name: 'e2e-roofing',
          displayName: 'E2E Roofing Services',
          formSchema: JSON.stringify({
            fields: [
              { name: 'projectType', type: 'select', options: ['repair', 'replacement', 'new'] },
              { name: 'budget', type: 'range', min: 1000, max: 50000 },
              { name: 'timeline', type: 'select', options: ['asap', '1-2 weeks', '1-3 months'] }
            ]
          }),
          active: true
        }
      });

      // Step 2: Contractor signs up via public form
      const contractorSignupData = {
        name: 'E2E Test Roofing Contractors LLC',
        contactEmail: 'contact@e2erobing.com',
        contactPhone: '(555) 100-2000',
        contactName: 'John E2E Contractor',
        businessDescription: 'Professional roofing services for residential and commercial properties',
        apiUrl: 'https://e2eroofer.com/api/leads',
        servicesOffered: ['Roofing', 'Gutters', 'Siding'],
        serviceAreas: ['10001', '10002', '10003'],
        businessLicense: 'ROF-2024-001',
        insuranceInfo: 'General liability $2M, Workers comp $1M',
        yearsInBusiness: 8
      };

      const newContractor = await prisma.buyer.create({
        data: {
          name: contractorSignupData.name,
          type: BuyerType.CONTRACTOR, // Auto-assigned by signup API
          apiUrl: contractorSignupData.apiUrl,
          authConfig: JSON.stringify(contractorSignupData),
          active: false, // Pending admin approval
          pingTimeout: 30,
          postTimeout: 60
        }
      });

      expect(newContractor.type).toBe('CONTRACTOR');
      expect(newContractor.active).toBe(false);

      // Step 3: Admin reviews and approves contractor
      const approvedContractor = await prisma.buyer.update({
        where: { id: newContractor.id },
        data: { 
          active: true,
          updatedAt: new Date()
        }
      });

      expect(approvedContractor.active).toBe(true);

      // Step 4: Admin sets up service configuration
      const serviceConfig = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: approvedContractor.id,
          serviceTypeId: roofingService.id,
          pingTemplate: JSON.stringify({
            template: 'roofing-contractor-ping',
            fields: ['customerName', 'customerPhone', 'projectType', 'budget', 'timeline', 'address'],
            complianceFields: ['tcpaConsent', 'privacyPolicy']
          }),
          postTemplate: JSON.stringify({
            template: 'roofing-contractor-post',
            fields: ['customerDetails', 'projectSpecs', 'bidAmount', 'contactWindow']
          }),
          fieldMappings: JSON.stringify({
            customer_name: 'customerName',
            customer_phone: 'customerPhone',
            project_type: 'projectType',
            estimated_budget: 'budget',
            preferred_timeline: 'timeline',
            property_address: 'address',
            tcpa_consent: 'tcpaConsent'
          }),
          minBid: 100.00,
          maxBid: 500.00,
          requiresTrustedForm: true,
          requiresJornaya: true,
          active: true
        }
      });

      expect(serviceConfig.active).toBe(true);
      expect(serviceConfig.minBid).toBe(100.00);

      // Step 5: Admin assigns service zones (zip codes)
      const serviceZones = await prisma.buyerServiceZipCode.createMany({
        data: contractorSignupData.serviceAreas.map(zipCode => ({
          buyerId: approvedContractor.id,
          serviceTypeId: roofingService.id,
          zipCode,
          active: true,
          priority: 100,
          maxLeadsPerDay: 8,
          minBid: 100.00,
          maxBid: 500.00
        }))
      });

      expect(serviceZones.count).toBe(3);

      // Step 6: Verify contractor is now eligible for auctions
      const eligibilityCheck = await prisma.buyerServiceZipCode.findMany({
        where: {
          buyerId: approvedContractor.id,
          serviceTypeId: roofingService.id,
          active: true
        },
        include: {
          buyer: true,
          serviceType: true
        }
      });

      expect(eligibilityCheck).toHaveLength(3);
      expect(eligibilityCheck.every(zone => zone.buyer.active)).toBe(true);
      expect(eligibilityCheck.every(zone => zone.serviceType.active)).toBe(true);

      // Step 7: Test auction eligibility
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [{
          buyerId: approvedContractor.id,
          buyerName: approvedContractor.name,
          serviceZone: {
            id: eligibilityCheck[0].id,
            buyerId: approvedContractor.id,
            serviceTypeId: roofingService.id,
            zipCode: '10001',
            priority: 100,
            active: true,
            buyer: approvedContractor,
            serviceType: roofingService
          },
          eligibilityScore: 85,
          constraints: {
            priority: 100,
            currentDailyCount: 2,
            maxLeadsPerDay: 8,
            minBid: 100.00,
            maxBid: 500.00
          }
        }],
        excluded: [],
        totalFound: 1,
        eligibleCount: 1,
        excludedCount: 0
      });

      const eligibilityResult = await BuyerEligibilityService.getEligibleBuyers({
        serviceTypeId: roofingService.id,
        zipCode: '10001'
      });

      expect(eligibilityResult.eligibleCount).toBe(1);
      expect(eligibilityResult.eligible[0].buyerId).toBe(approvedContractor.id);
      expect(eligibilityResult.eligible[0].serviceZone.buyer.type).toBe('CONTRACTOR');

      console.log('✅ Complete contractor onboarding flow successful');
    });

    it('should handle contractor with multiple service types', async () => {
      // Create multiple service types
      const services = await prisma.serviceType.createMany({
        data: [
          {
            name: 'e2e-roofing-multi',
            displayName: 'E2E Multi Roofing',
            formSchema: '{}',
            active: true
          },
          {
            name: 'e2e-siding-multi',
            displayName: 'E2E Multi Siding',
            formSchema: '{}',
            active: true
          },
          {
            name: 'e2e-gutters-multi',
            displayName: 'E2E Multi Gutters',
            formSchema: '{}',
            active: true
          }
        ]
      });

      const serviceTypes = await prisma.serviceType.findMany({
        where: { name: { contains: 'e2e-' } }
      });

      // Create multi-service contractor
      const multiServiceContractor = await prisma.buyer.create({
        data: {
          name: 'E2E Test Multi-Service Contractor',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://multiservice.com/api',
          authConfig: JSON.stringify({
            servicesOffered: ['Roofing', 'Siding', 'Gutters'],
            serviceAreas: ['20001', '20002']
          }),
          active: true
        }
      });

      // Configure all service types
      await prisma.buyerServiceConfig.createMany({
        data: serviceTypes.map(service => ({
          buyerId: multiServiceContractor.id,
          serviceTypeId: service.id,
          pingTemplate: JSON.stringify({ template: `${service.name}-template` }),
          postTemplate: JSON.stringify({ template: `${service.name}-post` }),
          fieldMappings: JSON.stringify({ mapping: service.name }),
          minBid: 75.00,
          maxBid: 400.00,
          active: true
        }))
      });

      // Assign service zones for all services
      const zoneAssignments: any[] = [];
      serviceTypes.forEach(service => {
        ['20001', '20002'].forEach(zipCode => {
          zoneAssignments.push({
            buyerId: multiServiceContractor.id,
            serviceTypeId: service.id,
            zipCode,
            active: true,
            priority: 110
          });
        });
      });

      await prisma.buyerServiceZipCode.createMany({ data: zoneAssignments });

      // Verify multi-service setup
      const allConfigs = await prisma.buyerServiceConfig.findMany({
        where: { buyerId: multiServiceContractor.id },
        include: { serviceType: true }
      });

      const allZones = await prisma.buyerServiceZipCode.findMany({
        where: { buyerId: multiServiceContractor.id },
        include: { serviceType: true }
      });

      expect(allConfigs).toHaveLength(3); // 3 service types
      expect(allZones).toHaveLength(6); // 3 services × 2 zip codes

      console.log('✅ Multi-service contractor setup successful');
    });
  });

  describe('Full Auction Flow with Mixed Buyer Types', () => {
    let roofingService: any;
    let testContractor: any;
    let testNetwork: any;

    beforeEach(async () => {
      // Set up test environment
      roofingService = await prisma.serviceType.create({
        data: {
          name: 'e2e-auction-roofing',
          displayName: 'E2E Auction Roofing',
          formSchema: JSON.stringify({
            fields: ['projectType', 'budget', 'timeline', 'customerInfo']
          }),
          active: true
        }
      });

      // Create contractor
      testContractor = await prisma.buyer.create({
        data: {
          name: 'E2E Test Auction Contractor',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://auctioncontractor.com/api',
          authConfig: JSON.stringify({
            contactEmail: 'auction@contractor.com',
            businessDescription: 'Auction test contractor'
          }),
          active: true
        }
      });

      // Create network
      testNetwork = await prisma.buyer.create({
        data: {
          name: 'E2E Test Auction Network',
          type: BuyerType.NETWORK,
          apiUrl: 'https://auctionnetwork.com/api',
          authConfig: JSON.stringify({
            organizationId: 'net-12345',
            apiKey: 'network-key-789'
          }),
          active: true
        }
      });

      // Configure both buyers
      await prisma.buyerServiceConfig.createMany({
        data: [
          {
            buyerId: testContractor.id,
            serviceTypeId: roofingService.id,
            pingTemplate: JSON.stringify({ template: 'contractor-auction-ping' }),
            postTemplate: JSON.stringify({ template: 'contractor-auction-post' }),
            fieldMappings: JSON.stringify({ type: 'contractor' }),
            minBid: 150.00,
            maxBid: 600.00,
            active: true
          },
          {
            buyerId: testNetwork.id,
            serviceTypeId: roofingService.id,
            pingTemplate: JSON.stringify({ template: 'network-auction-ping' }),
            postTemplate: JSON.stringify({ template: 'network-auction-post' }),
            fieldMappings: JSON.stringify({ type: 'network' }),
            minBid: 100.00,
            maxBid: 800.00,
            active: true
          }
        ]
      });

      // Set up service zones
      await prisma.buyerServiceZipCode.createMany({
        data: [
          {
            buyerId: testContractor.id,
            serviceTypeId: roofingService.id,
            zipCode: '30001',
            active: true,
            priority: 100,
            maxLeadsPerDay: 10
          },
          {
            buyerId: testNetwork.id,
            serviceTypeId: roofingService.id,
            zipCode: '30001',
            active: true,
            priority: 120,
            maxLeadsPerDay: 50
          }
        ]
      });
    });

    it('should complete full auction flow from lead submission to winner selection', async () => {
      // Step 1: Lead is submitted
      const testLead = await prisma.lead.create({
        data: {
          serviceTypeId: roofingService.id,
          formData: JSON.stringify({
            projectType: 'roof replacement',
            budget: '$25000',
            timeline: '2-4 weeks',
            customerInfo: {
              name: 'E2E Test Customer',
              email: 'customer@e2etest.com',
              phone: '(555) 300-1000',
              address: '123 Test Street, Test City, TC 30001'
            }
          }),
          zipCode: '30001',
          ownsHome: true,
          timeframe: 'FLEXIBLE',
          trustedFormCertId: 'tf_cert_12345',
          jornayaLeadId: 'jornaya_lead_67890',
          complianceData: JSON.stringify({
            tcpaConsent: true,
            privacyPolicyAccepted: true,
            ipAddress: '192.168.1.100',
            timestamp: new Date().toISOString()
          }),
          status: 'PENDING'
        }
      });

      // Step 2: Mock auction eligibility response
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [
          {
            buyerId: testContractor.id,
            buyerName: testContractor.name,
            serviceZone: {
              id: 'zone1',
              buyerId: testContractor.id,
              serviceTypeId: roofingService.id,
              zipCode: '30001',
              priority: 100,
              buyer: { ...testContractor, type: 'CONTRACTOR', active: true },
              serviceType: roofingService
            },
            eligibilityScore: 85,
            constraints: { priority: 100, currentDailyCount: 3, maxLeadsPerDay: 10 }
          },
          {
            buyerId: testNetwork.id,
            buyerName: testNetwork.name,
            serviceZone: {
              id: 'zone2',
              buyerId: testNetwork.id,
              serviceTypeId: roofingService.id,
              zipCode: '30001',
              priority: 120,
              buyer: { ...testNetwork, type: 'NETWORK', active: true },
              serviceType: roofingService
            },
            eligibilityScore: 90,
            constraints: { priority: 120, currentDailyCount: 15, maxLeadsPerDay: 50 }
          }
        ],
        excluded: [],
        totalFound: 2,
        eligibleCount: 2,
        excludedCount: 0
      });

      // Step 3: Mock buyer registry responses
      mockBuyerRegistry.get.mockImplementation((buyerId: string) => {
        if (buyerId === testContractor.id) {
          return {
            id: testContractor.id,
            name: testContractor.name,
            type: testContractor.type,
            globalSettings: {
              complianceRequirements: {
                requireTrustedForm: true,
                requireJornaya: true,
                requireTcpaConsent: true
              }
            },
            authConfig: {
              type: 'apiKey' as const,
              credentials: { apiKey: 'contractor-key-123' }
            }
          };
        } else if (buyerId === testNetwork.id) {
          return {
            id: testNetwork.id,
            name: testNetwork.name,
            type: testNetwork.type,
            globalSettings: {
              complianceRequirements: {
                requireTrustedForm: false,
                requireJornaya: false,
                requireTcpaConsent: true
              }
            },
            authConfig: {
              type: 'apiKey' as const,
              credentials: { apiKey: 'network-key-789' }
            }
          };
        }
        return null;
      });

      mockBuyerRegistry.getServiceConfig.mockImplementation((buyerId: string) => {
        if (buyerId === testContractor.id) {
          return {
            serviceTypeName: 'e2e-auction-roofing',
            pricing: { basePrice: 200, minBid: 150, maxBid: 600 },
            webhookConfig: {
              pingUrl: 'https://auctioncontractor.com/ping',
              postUrl: 'https://auctioncontractor.com/post',
              timeouts: { ping: 5000, post: 10000 }
            },
            active: true
          };
        } else if (buyerId === testNetwork.id) {
          return {
            serviceTypeName: 'e2e-auction-roofing',
            pricing: { basePrice: 180, minBid: 100, maxBid: 800 },
            webhookConfig: {
              pingUrl: 'https://auctionnetwork.com/ping',
              postUrl: 'https://auctionnetwork.com/post',
              timeouts: { ping: 5000, post: 10000 }
            },
            active: true
          };
        }
        return null;
      });

      // Step 4: Mock HTTP responses for PING and POST
      const mockFetch = jest.fn()
        // Contractor PING response
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            bidAmount: 350.00,
            interested: true,
            message: 'We can handle this roofing project',
            estimatedStartDate: '2024-02-15',
            projectDuration: '5-7 days'
          })
        })
        // Network PING response
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            bidAmount: 425.00,
            interested: true,
            message: 'Network partner available for project',
            partnerInfo: 'Regional Roofing Partner'
          })
        })
        // Winner POST response (Network wins)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            accepted: true,
            leadId: 'network_lead_12345',
            assignedPartner: 'Regional Roofing Partner',
            nextSteps: 'Partner will contact customer within 24 hours'
          })
        });

      global.fetch = mockFetch;

      // Step 5: Run the auction
      const leadData = {
        id: testLead.id,
        serviceTypeId: roofingService.id,
        zipCode: '30001',
        estimatedValue: 300,
        trustedFormCertId: testLead.trustedFormCertId,
        jornayaLeadId: testLead.jornayaLeadId,
        complianceData: JSON.parse(testLead.complianceData || '{}')
      };

      const auctionResult = await AuctionEngine.runAuction(leadData);

      // Step 6: Verify auction results
      expect(auctionResult.status).toBe('completed');
      expect(auctionResult.winningBuyerId).toBe(testNetwork.id); // Network had higher bid
      expect(auctionResult.winningBidAmount).toBe(425.00);
      expect(auctionResult.allBids).toHaveLength(2);
      expect(auctionResult.participantCount).toBe(2);
      expect(auctionResult.postResult?.success).toBe(true);

      // Step 7: Verify both buyers participated
      expect(mockFetch).toHaveBeenCalledTimes(3); // 2 PINGs + 1 POST

      // Contractor PING
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        'https://auctioncontractor.com/ping',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'contractor-key-123',
            'X-Request-Type': 'PING'
          })
        })
      );

      // Network PING
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'https://auctionnetwork.com/ping',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'network-key-789',
            'X-Request-Type': 'PING'
          })
        })
      );

      // Winner POST
      expect(mockFetch).toHaveBeenNthCalledWith(3,
        'https://auctionnetwork.com/post',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'network-key-789',
            'X-Request-Type': 'POST'
          })
        })
      );

      // Step 8: Update lead with auction results
      const updatedLead = await prisma.lead.update({
        where: { id: testLead.id },
        data: {
          status: 'COMPLETED',
          winningBuyerId: auctionResult.winningBuyerId,
          winningBid: auctionResult.winningBidAmount
        }
      });

      expect(updatedLead.winningBuyerId).toBe(testNetwork.id);
      expect(updatedLead.winningBid).toBe(425.00);

      console.log('✅ Complete auction flow successful - Network buyer won');
    });

    it('should handle auction with contractor winner', async () => {
      // Create scenario where contractor wins
      const testLead = await prisma.lead.create({
        data: {
          serviceTypeId: roofingService.id,
          formData: JSON.stringify({
            projectType: 'roof repair',
            budget: '$5000',
            timeline: 'ASAP'
          }),
          zipCode: '30001',
          ownsHome: true,
          timeframe: 'URGENT',
          status: 'PENDING'
        }
      });

      // Mock eligibility (contractor only for this scenario)
      mockEligibilityService.getEligibleBuyers.mockResolvedValue({
        eligible: [{
          buyerId: testContractor.id,
          buyerName: testContractor.name,
          serviceZone: {
            id: 'zone1',
            buyerId: testContractor.id,
            serviceTypeId: roofingService.id,
            zipCode: '30001',
            priority: 100,
            buyer: { ...testContractor, type: 'CONTRACTOR', active: true }
          },
          eligibilityScore: 95,
          constraints: { priority: 100, currentDailyCount: 1, maxLeadsPerDay: 10 }
        }],
        excluded: [{
          buyerId: testNetwork.id,
          buyerName: testNetwork.name,
          reason: 'DAILY_LIMIT_EXCEEDED',
          details: { currentDailyCount: 50, maxLeadsPerDay: 50 }
        }],
        totalFound: 2,
        eligibleCount: 1,
        excludedCount: 1
      });

      // Mock contractor config
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
          credentials: { apiKey: 'contractor-key-123' }
        }
      });

      mockBuyerRegistry.getServiceConfig.mockReturnValue({
        serviceTypeName: 'e2e-auction-roofing',
        pricing: { basePrice: 200, minBid: 150, maxBid: 600 },
        webhookConfig: {
          pingUrl: 'https://auctioncontractor.com/ping',
          postUrl: 'https://auctioncontractor.com/post',
          timeouts: { ping: 5000, post: 10000 }
        },
        active: true
      });

      // Mock successful contractor responses
      const mockFetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            bidAmount: 275.00,
            interested: true,
            message: 'Emergency repair specialist available today'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            accepted: true,
            scheduledDate: new Date().toISOString(),
            technicianName: 'John E2E Contractor'
          })
        });

      global.fetch = mockFetch;

      // Run auction
      const auctionResult = await AuctionEngine.runAuction({
        id: testLead.id,
        serviceTypeId: roofingService.id,
        zipCode: '30001',
        estimatedValue: 200
      });

      // Verify contractor wins
      expect(auctionResult.status).toBe('completed');
      expect(auctionResult.winningBuyerId).toBe(testContractor.id);
      expect(auctionResult.winningBidAmount).toBe(275.00);
      expect(auctionResult.participantCount).toBe(1); // Only contractor participated

      console.log('✅ Contractor winner auction flow successful');
    });
  });

  describe('Transaction Logging and Audit Trail', () => {
    it('should create comprehensive audit trail for full flow', async () => {
      // Create test data
      const service = await prisma.serviceType.create({
        data: {
          name: 'e2e-audit-test',
          displayName: 'E2E Audit Test',
          formSchema: '{}',
          active: true
        }
      });

      const contractor = await prisma.buyer.create({
        data: {
          name: 'E2E Test Audit Contractor',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://auditcontractor.com/api',
          active: true
        }
      });

      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: service.id,
          formData: '{}',
          zipCode: '40001',
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'PENDING'
        }
      });

      // Create transactions to simulate auction activity
      await prisma.transaction.createMany({
        data: [
          {
            leadId: lead.id,
            buyerId: contractor.id,
            actionType: 'PING',
            payload: JSON.stringify({
              leadData: { zipCode: '40001', serviceType: 'e2e-audit-test' },
              timestamp: new Date().toISOString()
            }),
            response: JSON.stringify({
              bidAmount: 150.00,
              interested: true
            }),
            status: 'SUCCESS',
            bidAmount: 150.00,
            responseTime: 850,
            complianceIncluded: true,
            trustedFormPresent: false,
            jornayaPresent: false
          },
          {
            leadId: lead.id,
            buyerId: contractor.id,
            actionType: 'POST',
            payload: JSON.stringify({
              leadData: { winningBid: 150.00 },
              timestamp: new Date().toISOString()
            }),
            response: JSON.stringify({
              accepted: true,
              leadId: 'contractor_lead_789'
            }),
            status: 'SUCCESS',
            responseTime: 1200
          }
        ]
      });

      // Verify audit trail
      const auditTrail = await prisma.transaction.findMany({
        where: { leadId: lead.id },
        include: {
          buyer: true,
          lead: {
            include: {
              serviceType: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      expect(auditTrail).toHaveLength(2);

      // PING transaction audit
      const pingTransaction = auditTrail[0];
      expect(pingTransaction.actionType).toBe('PING');
      expect(pingTransaction.status).toBe('SUCCESS');
      expect(pingTransaction.bidAmount).toBe(150.00);
      expect(pingTransaction.responseTime).toBe(850);
      expect(pingTransaction.buyer.type).toBe('CONTRACTOR');

      // POST transaction audit
      const postTransaction = auditTrail[1];
      expect(postTransaction.actionType).toBe('POST');
      expect(postTransaction.status).toBe('SUCCESS');
      expect(postTransaction.responseTime).toBe(1200);

      // Verify payload contains correct data
      const pingPayload = JSON.parse(pingTransaction.payload);
      expect(pingPayload.leadData.zipCode).toBe('40001');

      const postPayload = JSON.parse(postTransaction.payload);
      expect(postPayload.leadData.winningBid).toBe(150.00);

      console.log('✅ Comprehensive audit trail verification successful');
    });

    it('should track buyer type performance over time', async () => {
      // Create multiple buyers and transactions for analysis
      const service = await prisma.serviceType.create({
        data: {
          name: 'e2e-performance-test',
          displayName: 'E2E Performance Test',
          formSchema: '{}',
          active: true
        }
      });

      // Create contractors and networks
      const contractors = await prisma.buyer.createMany({
        data: [
          { name: 'E2E Perf Contractor A', type: BuyerType.CONTRACTOR, apiUrl: 'urlA', active: true },
          { name: 'E2E Perf Contractor B', type: BuyerType.CONTRACTOR, apiUrl: 'urlB', active: true }
        ]
      });

      const networks = await prisma.buyer.createMany({
        data: [
          { name: 'E2E Perf Network X', type: BuyerType.NETWORK, apiUrl: 'urlX', active: true },
          { name: 'E2E Perf Network Y', type: BuyerType.NETWORK, apiUrl: 'urlY', active: true }
        ]
      });

      const allBuyers = await prisma.buyer.findMany({
        where: { name: { contains: 'E2E Perf' } }
      });

      // Create leads and transactions
      for (let i = 0; i < 20; i++) {
        const lead = await prisma.lead.create({
          data: {
            serviceTypeId: service.id,
            formData: `{}`,
            zipCode: `4000${i % 5}`,
            ownsHome: true,
            timeframe: 'ASAP',
            status: 'COMPLETED',
            winningBuyerId: allBuyers[i % allBuyers.length].id,
            winningBid: 100 + (i * 25)
          }
        });

        // Create transaction for each lead
        await prisma.transaction.create({
          data: {
            leadId: lead.id,
            buyerId: allBuyers[i % allBuyers.length].id,
            actionType: 'PING',
            payload: '{}',
            status: i < 18 ? 'SUCCESS' : 'FAILED', // 90% success rate
            bidAmount: i < 18 ? 100 + (i * 25) : null,
            responseTime: 600 + (i * 50)
          }
        });
      }

      // Analyze performance by buyer type
      const performanceByType = await prisma.transaction.groupBy({
        by: ['actionType'],
        where: {
          buyer: { name: { contains: 'E2E Perf' } }
        },
        _count: { id: true },
        _avg: { 
          responseTime: true,
          bidAmount: true
        }
      });

      const contractorTransactions = await prisma.transaction.count({
        where: {
          buyer: { type: BuyerType.CONTRACTOR, name: { contains: 'E2E Perf' } },
          status: 'SUCCESS'
        }
      });

      const networkTransactions = await prisma.transaction.count({
        where: {
          buyer: { type: BuyerType.NETWORK, name: { contains: 'E2E Perf' } },
          status: 'SUCCESS'
        }
      });

      expect(contractorTransactions).toBeGreaterThan(0);
      expect(networkTransactions).toBeGreaterThan(0);
      expect(contractorTransactions + networkTransactions).toBe(18); // 90% of 20

      // Performance metrics
      const avgResponseTime = performanceByType[0]?._avg.responseTime || 0;
      const avgBidAmount = performanceByType[0]?._avg.bidAmount || 0;

      expect(avgResponseTime).toBeGreaterThan(600);
      expect(avgBidAmount).toBeGreaterThan(100);

      console.log('✅ Buyer type performance tracking successful');
    });
  });

  describe('System Integration Edge Cases', () => {
    it('should handle simultaneous contractor and network signups', async () => {
      const service = await prisma.serviceType.create({
        data: {
          name: 'e2e-concurrent-test',
          displayName: 'E2E Concurrent Test',
          formSchema: '{}',
          active: true
        }
      });

      // Simulate concurrent signups
      const concurrentSignups = Array.from({ length: 5 }, (_, i) => 
        prisma.buyer.create({
          data: {
            name: `E2E Test Concurrent Buyer ${i}`,
            type: i % 2 === 0 ? BuyerType.CONTRACTOR : BuyerType.NETWORK,
            apiUrl: `https://concurrent${i}.com/api`,
            active: false
          }
        })
      );

      const createdBuyers = await Promise.all(concurrentSignups);
      expect(createdBuyers).toHaveLength(5);

      // Verify type distribution
      const contractors = createdBuyers.filter(b => b.type === 'CONTRACTOR');
      const networks = createdBuyers.filter(b => b.type === 'NETWORK');

      expect(contractors).toHaveLength(3); // 0, 2, 4
      expect(networks).toHaveLength(2);    // 1, 3

      console.log('✅ Concurrent signup handling successful');
    });

    it('should maintain data consistency under load', async () => {
      const service = await prisma.serviceType.create({
        data: {
          name: 'e2e-consistency-test',
          displayName: 'E2E Consistency Test',
          formSchema: '{}',
          active: true
        }
      });

      const buyer = await prisma.buyer.create({
        data: {
          name: 'E2E Test Consistency Buyer',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://consistency.com/api',
          active: true
        }
      });

      // Create multiple leads simultaneously
      const leadPromises = Array.from({ length: 10 }, (_, i) =>
        prisma.lead.create({
          data: {
            serviceTypeId: service.id,
            formData: JSON.stringify({ index: i }),
            zipCode: `5000${i}`,
            ownsHome: true,
            timeframe: 'ASAP',
            status: 'PENDING'
          }
        })
      );

      const leads = await Promise.all(leadPromises);
      expect(leads).toHaveLength(10);

      // Verify all leads have unique IDs and correct data
      const uniqueIds = new Set(leads.map(l => l.id));
      expect(uniqueIds.size).toBe(10);

      // Verify data consistency
      for (let i = 0; i < leads.length; i++) {
        const formData = JSON.parse(leads[i].formData);
        expect(formData.index).toBe(i);
        expect(leads[i].zipCode).toBe(`5000${i}`);
      }

      console.log('✅ Data consistency under load verified');
    });
  });
});