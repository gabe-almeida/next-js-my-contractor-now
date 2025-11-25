/**
 * Lead Processor ZIP Code Filtering Integration Test
 * Verifies that the worker correctly filters buyers by ZIP code
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { BuyerType } from '@/types/database';
import { processLead } from '@/workers/lead-processor';
import { BuyerEligibilityService } from '@/lib/services/buyer-eligibility-service';
import { BuyerConfigurationRegistry } from '@/lib/buyers/configurations';

const prisma = new PrismaClient();

// Mock external dependencies
jest.mock('@/lib/buyers/configurations');
jest.mock('@/lib/services/buyer-eligibility-service');

describe('Lead Processor ZIP Code Filtering', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.transaction.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.buyerServiceZipCode.deleteMany();
    await prisma.buyerServiceConfig.deleteMany();
    await prisma.buyer.deleteMany({ where: { name: { contains: 'ZIP Test' } } });
    await prisma.serviceType.deleteMany({ where: { name: { contains: 'zip-test' } } });

    // Reset mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('ZIP Code Filtering', () => {
    it('should only ping buyers with matching ZIP codes', async () => {
      // Step 1: Create service type
      const windowsService = await prisma.serviceType.create({
        data: {
          name: 'zip-test-windows',
          displayName: 'ZIP Test Windows',
          formSchema: JSON.stringify({
            fields: [
              { name: 'projectType', type: 'select', options: ['installation', 'repair'] },
              { name: 'numberOfWindows', type: 'number', min: 1, max: 50 }
            ]
          }),
          active: true
        }
      });

      // Step 2: Create buyers in different ZIP codes
      const buyerCalifornia = await prisma.buyer.create({
        data: {
          name: 'ZIP Test CA Buyer',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://cabuyer.com/api',
          active: true,
          pingTimeout: 30,
          postTimeout: 60
        }
      });

      const buyerNewYork = await prisma.buyer.create({
        data: {
          name: 'ZIP Test NY Buyer',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://nybuyer.com/api',
          active: true,
          pingTimeout: 30,
          postTimeout: 60
        }
      });

      const buyerTexas = await prisma.buyer.create({
        data: {
          name: 'ZIP Test TX Buyer',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://txbuyer.com/api',
          active: true,
          pingTimeout: 30,
          postTimeout: 60
        }
      });

      // Step 3: Configure service for all buyers
      await prisma.buyerServiceConfig.createMany({
        data: [
          {
            buyerId: buyerCalifornia.id,
            serviceTypeId: windowsService.id,
            pingTemplate: JSON.stringify({ template: 'ca-ping' }),
            postTemplate: JSON.stringify({ template: 'ca-post' }),
            fieldMappings: JSON.stringify({}),
            minBid: 50.00,
            maxBid: 300.00,
            active: true
          },
          {
            buyerId: buyerNewYork.id,
            serviceTypeId: windowsService.id,
            pingTemplate: JSON.stringify({ template: 'ny-ping' }),
            postTemplate: JSON.stringify({ template: 'ny-post' }),
            fieldMappings: JSON.stringify({}),
            minBid: 75.00,
            maxBid: 400.00,
            active: true
          },
          {
            buyerId: buyerTexas.id,
            serviceTypeId: windowsService.id,
            pingTemplate: JSON.stringify({ template: 'tx-ping' }),
            postTemplate: JSON.stringify({ template: 'tx-post' }),
            fieldMappings: JSON.stringify({}),
            minBid: 60.00,
            maxBid: 350.00,
            active: true
          }
        ]
      });

      // Step 4: Assign ZIP codes to buyers
      await prisma.buyerServiceZipCode.createMany({
        data: [
          // California buyer only services CA ZIP codes
          { buyerId: buyerCalifornia.id, serviceTypeId: windowsService.id, zipCode: '90210', active: true, priority: 100 },
          { buyerId: buyerCalifornia.id, serviceTypeId: windowsService.id, zipCode: '90211', active: true, priority: 100 },
          // New York buyer only services NY ZIP codes
          { buyerId: buyerNewYork.id, serviceTypeId: windowsService.id, zipCode: '10001', active: true, priority: 100 },
          { buyerId: buyerNewYork.id, serviceTypeId: windowsService.id, zipCode: '10002', active: true, priority: 100 },
          // Texas buyer only services TX ZIP codes
          { buyerId: buyerTexas.id, serviceTypeId: windowsService.id, zipCode: '75001', active: true, priority: 100 },
          { buyerId: buyerTexas.id, serviceTypeId: windowsService.id, zipCode: '75002', active: true, priority: 100 },
        ]
      });

      // Step 5: Create a lead in California ZIP code
      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: windowsService.id,
          formData: JSON.stringify({
            projectType: 'installation',
            numberOfWindows: 5,
            customerName: 'John Doe',
            customerPhone: '(555) 123-4567'
          }),
          zipCode: '90210', // California ZIP
          ownsHome: true,
          timeframe: 'FLEXIBLE',
          status: 'PENDING'
        }
      });

      // Step 6: Mock eligibility service to return only CA buyer
      jest.mocked(BuyerEligibilityService.getEligibleBuyers).mockResolvedValue({
        eligible: [{
          buyerId: buyerCalifornia.id,
          buyerName: buyerCalifornia.name,
          serviceZone: {
            id: 'zone-ca-1',
            buyerId: buyerCalifornia.id,
            serviceTypeId: windowsService.id,
            zipCode: '90210',
            active: true,
            priority: 100,
            maxLeadsPerDay: null,
            minBid: 50.00,
            maxBid: 300.00,
            createdAt: new Date(),
            updatedAt: new Date(),
            buyer: buyerCalifornia,
            serviceType: windowsService
          },
          eligibilityScore: 95,
          constraints: {
            priority: 100,
            currentDailyCount: 0,
            maxLeadsPerDay: undefined,
            minBid: 50.00,
            maxBid: 300.00
          }
        }],
        excluded: [
          {
            buyerId: buyerNewYork.id,
            buyerName: buyerNewYork.name,
            reason: 'ZIP_CODE_MISMATCH',
            details: { requestedZip: '90210', buyerZips: ['10001', '10002'] }
          },
          {
            buyerId: buyerTexas.id,
            buyerName: buyerTexas.name,
            reason: 'ZIP_CODE_MISMATCH',
            details: { requestedZip: '90210', buyerZips: ['75001', '75002'] }
          }
        ],
        totalFound: 3,
        eligibleCount: 1,
        excludedCount: 2
      });

      // Step 7: Mock buyer configurations
      jest.mocked(BuyerConfigurationRegistry.get).mockImplementation((buyerId) => {
        const buyers = {
          [buyerCalifornia.id]: {
            id: buyerCalifornia.id,
            name: buyerCalifornia.name,
            type: buyerCalifornia.type,
            globalSettings: {
              complianceRequirements: {
                requireTrustedForm: false,
                requireJornaya: false,
                requireTcpaConsent: false
              }
            },
            authConfig: {
              type: 'apiKey',
              credentials: { apiKey: 'ca-key-123' }
            }
          }
        };
        return buyers[buyerId] || null;
      });

      jest.mocked(BuyerConfigurationRegistry.getServiceConfig).mockReturnValue({
        serviceTypeName: 'zip-test-windows',
        pricing: { basePrice: 150, minBid: 50, maxBid: 300 },
        webhookConfig: {
          pingUrl: 'https://cabuyer.com/ping',
          postUrl: 'https://cabuyer.com/post',
          timeouts: { ping: 5000, post: 10000 }
        },
        pingTemplate: { mappings: [] },
        postTemplate: { mappings: [] },
        active: true
      });

      // Step 8: Mock HTTP responses
      const mockFetch = jest.fn()
        // CA buyer PING response
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            bidAmount: 250.00,
            accepted: true,
            message: 'We can install your windows'
          })
        })
        // CA buyer POST response
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            accepted: true,
            leadId: 'ca_lead_12345'
          })
        });

      global.fetch = mockFetch;

      // Step 9: Process the lead
      await processLead({ data: { leadId: lead.id } });

      // Step 10: Verify results
      const updatedLead = await prisma.lead.findUnique({
        where: { id: lead.id }
      });

      // Lead should be SOLD to CA buyer
      expect(updatedLead?.status).toBe('SOLD');
      expect(updatedLead?.winningBuyerId).toBe(buyerCalifornia.id);
      expect(updatedLead?.winningBid).toBe(250.00);

      // Verify eligibility service was called with correct ZIP
      expect(BuyerEligibilityService.getEligibleBuyers).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceTypeId: windowsService.id,
          zipCode: '90210'
        })
      );

      // Verify only 2 HTTP calls (1 PING + 1 POST to CA buyer)
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify PING was only sent to CA buyer
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        'https://cabuyer.com/ping',
        expect.objectContaining({ method: 'POST' })
      );

      // Verify POST was sent to CA buyer
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'https://cabuyer.com/post',
        expect.objectContaining({ method: 'POST' })
      );

      console.log('✅ ZIP code filtering test passed - Only CA buyer was pinged for CA ZIP code');
    });

    it('should reject lead when no buyers service the ZIP code', async () => {
      // Create service type
      const service = await prisma.serviceType.create({
        data: {
          name: 'zip-test-roofing',
          displayName: 'ZIP Test Roofing',
          formSchema: JSON.stringify({}),
          active: true
        }
      });

      // Create buyer that only services specific ZIPs
      const buyer = await prisma.buyer.create({
        data: {
          name: 'ZIP Test Limited Buyer',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://limited.com/api',
          active: true,
          pingTimeout: 30,
          postTimeout: 60
        }
      });

      await prisma.buyerServiceConfig.create({
        data: {
          buyerId: buyer.id,
          serviceTypeId: service.id,
          pingTemplate: JSON.stringify({}),
          postTemplate: JSON.stringify({}),
          fieldMappings: JSON.stringify({}),
          minBid: 100.00,
          maxBid: 500.00,
          active: true
        }
      });

      // Buyer only services ZIPs 80001-80003
      await prisma.buyerServiceZipCode.createMany({
        data: [
          { buyerId: buyer.id, serviceTypeId: service.id, zipCode: '80001', active: true, priority: 100 },
          { buyerId: buyer.id, serviceTypeId: service.id, zipCode: '80002', active: true, priority: 100 },
          { buyerId: buyer.id, serviceTypeId: service.id, zipCode: '80003', active: true, priority: 100 },
        ]
      });

      // Create lead in unsupported ZIP code
      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: service.id,
          formData: JSON.stringify({}),
          zipCode: '99999', // Not serviced by any buyer
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'PENDING'
        }
      });

      // Mock eligibility service to return no buyers
      jest.mocked(BuyerEligibilityService.getEligibleBuyers).mockResolvedValue({
        eligible: [],
        excluded: [{
          buyerId: buyer.id,
          buyerName: buyer.name,
          reason: 'ZIP_CODE_MISMATCH',
          details: { requestedZip: '99999', buyerZips: ['80001', '80002', '80003'] }
        }],
        totalFound: 1,
        eligibleCount: 0,
        excludedCount: 1
      });

      // Process the lead
      await processLead({ data: { leadId: lead.id } });

      // Verify lead was rejected
      const updatedLead = await prisma.lead.findUnique({
        where: { id: lead.id }
      });

      expect(updatedLead?.status).toBe('REJECTED');
      expect(updatedLead?.winningBuyerId).toBeNull();
      expect(updatedLead?.winningBid).toBeNull();

      console.log('✅ Lead correctly rejected when no buyers service the ZIP code');
    });

    it('should handle multiple buyers in the same ZIP code', async () => {
      // Create service
      const service = await prisma.serviceType.create({
        data: {
          name: 'zip-test-hvac',
          displayName: 'ZIP Test HVAC',
          formSchema: JSON.stringify({}),
          active: true
        }
      });

      // Create 3 buyers all servicing the same ZIP
      const buyers = await Promise.all([
        prisma.buyer.create({
          data: {
            name: 'ZIP Test HVAC Buyer A',
            type: BuyerType.CONTRACTOR,
            apiUrl: 'https://hvacA.com/api',
            active: true,
            pingTimeout: 30,
            postTimeout: 60
          }
        }),
        prisma.buyer.create({
          data: {
            name: 'ZIP Test HVAC Buyer B',
            type: BuyerType.CONTRACTOR,
            apiUrl: 'https://hvacB.com/api',
            active: true,
            pingTimeout: 30,
            postTimeout: 60
          }
        }),
        prisma.buyer.create({
          data: {
            name: 'ZIP Test HVAC Buyer C',
            type: BuyerType.NETWORK,
            apiUrl: 'https://hvacC.com/api',
            active: true,
            pingTimeout: 30,
            postTimeout: 60
          }
        })
      ]);

      // Configure all buyers for the service
      await prisma.buyerServiceConfig.createMany({
        data: buyers.map(buyer => ({
          buyerId: buyer.id,
          serviceTypeId: service.id,
          pingTemplate: JSON.stringify({}),
          postTemplate: JSON.stringify({}),
          fieldMappings: JSON.stringify({}),
          minBid: 100.00,
          maxBid: 500.00,
          active: true
        }))
      });

      // All buyers service ZIP 60601
      await prisma.buyerServiceZipCode.createMany({
        data: buyers.map((buyer, i) => ({
          buyerId: buyer.id,
          serviceTypeId: service.id,
          zipCode: '60601',
          active: true,
          priority: 100 + (i * 10) // Different priorities
        }))
      });

      // Create lead in shared ZIP
      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: service.id,
          formData: JSON.stringify({}),
          zipCode: '60601',
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'PENDING'
        }
      });

      // Mock all buyers as eligible
      const zones = await prisma.buyerServiceZipCode.findMany({
        where: { zipCode: '60601' },
        include: { buyer: true, serviceType: true }
      });

      jest.mocked(BuyerEligibilityService.getEligibleBuyers).mockResolvedValue({
        eligible: zones.map((zone, i) => ({
          buyerId: zone.buyerId,
          buyerName: zone.buyer.name,
          serviceZone: zone,
          eligibilityScore: 90 + i,
          constraints: { priority: zone.priority, currentDailyCount: 0, maxLeadsPerDay: undefined }
        })),
        excluded: [],
        totalFound: 3,
        eligibleCount: 3,
        excludedCount: 0
      });

      // Mock buyer configs
      jest.mocked(BuyerConfigurationRegistry.get).mockImplementation((buyerId) => ({
        id: buyerId,
        name: 'Test Buyer',
        type: 'CONTRACTOR',
        globalSettings: {
          complianceRequirements: {
            requireTrustedForm: false,
            requireJornaya: false,
            requireTcpaConsent: false
          }
        },
        authConfig: {
          type: 'apiKey',
          credentials: { apiKey: 'test-key' }
        }
      }));

      jest.mocked(BuyerConfigurationRegistry.getServiceConfig).mockReturnValue({
        serviceTypeName: 'zip-test-hvac',
        pricing: { basePrice: 200, minBid: 100, maxBid: 500 },
        webhookConfig: {
          pingUrl: 'https://test.com/ping',
          postUrl: 'https://test.com/post',
          timeouts: { ping: 5000, post: 10000 }
        },
        pingTemplate: { mappings: [] },
        postTemplate: { mappings: [] },
        active: true
      });

      // Mock all 3 PINGs and 1 POST
      const mockFetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ bidAmount: 200, accepted: true }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ bidAmount: 250, accepted: true }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ bidAmount: 300, accepted: true }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ accepted: true }) });

      global.fetch = mockFetch;

      // Process lead
      await processLead({ data: { leadId: lead.id } });

      // Verify all 3 buyers were pinged + 1 POST to winner
      expect(mockFetch).toHaveBeenCalledTimes(4);

      // Verify highest bidder won
      const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
      expect(updatedLead?.winningBid).toBe(300.00);

      console.log('✅ Multiple buyers in same ZIP all participated, highest bidder won');
    });
  });
});
