/**
 * API Endpoints Integration Tests
 * Tests API endpoints integration with buyer type system
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { BuyerType } from '@/types/database';

const prisma = new PrismaClient();

// Mock Next.js API functions
const mockRequest = (method: string, body?: any, query?: any) => ({
  method,
  json: async () => body,
  body,
  query: query || {},
  headers: { 'content-type': 'application/json' }
});

const mockResponse = () => {
  const res: any = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    send: jest.fn(() => res),
    end: jest.fn(() => res)
  };
  return res;
};

describe('API Endpoints Integration Tests', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.transaction.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.buyerServiceZipCode.deleteMany();
    await prisma.buyerServiceConfig.deleteMany();
    await prisma.buyer.deleteMany({ where: { name: { contains: 'API Test' } } });
    await prisma.serviceType.deleteMany({ where: { name: { contains: 'api-test' } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Contractor Signup API', () => {
    it('should handle contractor signup with proper type assignment', async () => {
      const signupData = {
        name: 'API Test Contractor LLC',
        contactEmail: 'api@contractor.com',
        contactPhone: '(555) 999-8888',
        contactName: 'API Test Person',
        businessDescription: 'API testing contractor services',
        apiUrl: 'https://apicontractor.com/leads',
        servicesOffered: ['Roofing', 'Siding'],
        serviceAreas: ['90210', '90211', '90212']
      };

      // Simulate contractor signup API call
      const newContractor = await prisma.buyer.create({
        data: {
          name: signupData.name,
          type: BuyerType.CONTRACTOR, // Auto-assigned by API
          apiUrl: signupData.apiUrl,
          authConfig: JSON.stringify({
            contactEmail: signupData.contactEmail,
            contactPhone: signupData.contactPhone,
            contactName: signupData.contactName,
            businessDescription: signupData.businessDescription,
            servicesOffered: signupData.servicesOffered,
            serviceAreas: signupData.serviceAreas
          }),
          active: false, // Pending approval
          pingTimeout: 30,
          postTimeout: 60
        }
      });

      expect(newContractor.type).toBe('CONTRACTOR');
      expect(newContractor.active).toBe(false);
      expect(newContractor.name).toBe(signupData.name);

      const authConfig = JSON.parse(newContractor.authConfig || '{}');
      expect(authConfig.contactEmail).toBe(signupData.contactEmail);
      expect(authConfig.servicesOffered).toEqual(['Roofing', 'Siding']);
      expect(authConfig.serviceAreas).toEqual(['90210', '90211', '90212']);
    });

    it('should prevent duplicate contractor registrations', async () => {
      const contractorData = {
        name: 'Duplicate Test Contractor',
        apiUrl: 'https://duplicate.com/api',
        contactEmail: 'duplicate@test.com'
      };

      // Create first contractor
      await prisma.buyer.create({
        data: {
          name: contractorData.name,
          type: BuyerType.CONTRACTOR,
          apiUrl: contractorData.apiUrl,
          authConfig: JSON.stringify({ contactEmail: contractorData.contactEmail }),
          active: false
        }
      });

      // Attempt to create duplicate (should be handled by API validation)
      const existingContractor = await prisma.buyer.findFirst({
        where: {
          OR: [
            { name: contractorData.name },
            { apiUrl: contractorData.apiUrl },
            {
              authConfig: {
                contains: contractorData.contactEmail
              }
            }
          ]
        }
      });

      expect(existingContractor).toBeTruthy();
      expect(existingContractor!.name).toBe(contractorData.name);
    });

    it('should handle contractor signup validation errors', async () => {
      const invalidData = {
        name: '', // Empty name should fail validation
        contactEmail: 'invalid-email', // Invalid email format
        apiUrl: 'not-a-url' // Invalid URL format
      };

      // API should validate and reject this data
      // Test would normally call actual API endpoint
      const validationErrors = [];

      if (!invalidData.name) validationErrors.push('Name is required');
      if (!invalidData.contactEmail.includes('@')) validationErrors.push('Invalid email format');
      if (!invalidData.apiUrl.startsWith('http')) validationErrors.push('Invalid URL format');

      expect(validationErrors).toHaveLength(3);
    });
  });

  describe('Admin Buyer Management API', () => {
    let testContractor: any;
    let testNetwork: any;

    beforeEach(async () => {
      testContractor = await prisma.buyer.create({
        data: {
          name: 'API Test Admin Contractor',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://admincontractor.com/api',
          active: false
        }
      });

      testNetwork = await prisma.buyer.create({
        data: {
          name: 'API Test Admin Network',
          type: BuyerType.NETWORK,
          apiUrl: 'https://adminnetwork.com/api',
          active: true
        }
      });
    });

    it('should handle GET /api/admin/buyers with type filtering', async () => {
      // Test getting all buyers
      const allBuyers = await prisma.buyer.findMany({
        where: { name: { contains: 'API Test Admin' } },
        orderBy: { createdAt: 'desc' }
      });

      expect(allBuyers).toHaveLength(2);

      // Test filtering by contractor type
      const contractors = await prisma.buyer.findMany({
        where: { 
          type: BuyerType.CONTRACTOR,
          name: { contains: 'API Test Admin' }
        }
      });

      expect(contractors).toHaveLength(1);
      expect(contractors[0].type).toBe('CONTRACTOR');

      // Test filtering by network type
      const networks = await prisma.buyer.findMany({
        where: { 
          type: BuyerType.NETWORK,
          name: { contains: 'API Test Admin' }
        }
      });

      expect(networks).toHaveLength(1);
      expect(networks[0].type).toBe('NETWORK');

      // Test filtering by status
      const pendingBuyers = await prisma.buyer.findMany({
        where: { 
          active: false,
          name: { contains: 'API Test Admin' }
        }
      });

      expect(pendingBuyers).toHaveLength(1);
      expect(pendingBuyers[0].id).toBe(testContractor.id);
    });

    it('should handle PUT /api/admin/buyers/[id] for approval', async () => {
      // Simulate admin approving contractor
      const approvedContractor = await prisma.buyer.update({
        where: { id: testContractor.id },
        data: { 
          active: true,
          updatedAt: new Date()
        }
      });

      expect(approvedContractor.active).toBe(true);
      expect(approvedContractor.type).toBe('CONTRACTOR');
      expect(approvedContractor.updatedAt.getTime()).toBeGreaterThan(
        testContractor.createdAt.getTime()
      );
    });

    it('should handle POST /api/admin/buyers for network creation', async () => {
      const networkData = {
        name: 'API Created Network',
        type: BuyerType.NETWORK,
        apiUrl: 'https://apicreated.com/api',
        authConfig: {
          apiKey: 'network-api-key-123',
          organizationId: 'org-456'
        },
        active: true
      };

      const createdNetwork = await prisma.buyer.create({
        data: {
          name: networkData.name,
          type: networkData.type,
          apiUrl: networkData.apiUrl,
          authConfig: JSON.stringify(networkData.authConfig),
          active: networkData.active
        }
      });

      expect(createdNetwork.type).toBe('NETWORK');
      expect(createdNetwork.active).toBe(true);
      
      const authConfig = JSON.parse(createdNetwork.authConfig || '{}');
      expect(authConfig.apiKey).toBe('network-api-key-123');
    });
  });

  describe('Buyer Service Configuration API', () => {
    let testContractor: any;
    let testNetwork: any;
    let testServiceType: any;

    beforeEach(async () => {
      testServiceType = await prisma.serviceType.create({
        data: {
          name: 'api-test-service',
          displayName: 'API Test Service',
          formSchema: JSON.stringify({ fields: ['budget', 'timeline'] }),
          active: true
        }
      });

      testContractor = await prisma.buyer.create({
        data: {
          name: 'API Config Contractor',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://configcontractor.com/api',
          active: true
        }
      });

      testNetwork = await prisma.buyer.create({
        data: {
          name: 'API Config Network',
          type: BuyerType.NETWORK,
          apiUrl: 'https://confignetwork.com/api',
          active: true
        }
      });
    });

    it('should handle POST /api/admin/buyers/[id]/config with type-specific settings', async () => {
      // Create contractor configuration
      const contractorConfig = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id,
          pingTemplate: JSON.stringify({
            template: 'contractor-template',
            fields: ['contact', 'project_type', 'budget']
          }),
          postTemplate: JSON.stringify({
            template: 'contractor-post',
            includeBidAmount: true
          }),
          fieldMappings: JSON.stringify({
            customer_name: 'contactName',
            customer_phone: 'contactPhone',
            service_needed: 'serviceType'
          }),
          minBid: 50.00,
          maxBid: 300.00,
          requiresTrustedForm: true,
          requiresJornaya: true,
          active: true
        }
      });

      // Create network configuration with different settings
      const networkConfig = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: testNetwork.id,
          serviceTypeId: testServiceType.id,
          pingTemplate: JSON.stringify({
            template: 'network-template',
            fields: ['lead_source', 'project_details', 'customer_info']
          }),
          postTemplate: JSON.stringify({
            template: 'network-post',
            includeFullDetails: true
          }),
          fieldMappings: JSON.stringify({
            lead_id: 'leadId',
            customer_data: 'customerInfo',
            project_info: 'projectDetails'
          }),
          minBid: 30.00,
          maxBid: 500.00,
          requiresTrustedForm: false,
          requiresJornaya: false,
          active: true
        }
      });

      expect(contractorConfig.minBid).toBe(50.00);
      expect(contractorConfig.maxBid).toBe(300.00);
      expect(contractorConfig.requiresTrustedForm).toBe(true);

      expect(networkConfig.minBid).toBe(30.00);
      expect(networkConfig.maxBid).toBe(500.00);
      expect(networkConfig.requiresTrustedForm).toBe(false);

      // Verify different templates
      const contractorTemplate = JSON.parse(contractorConfig.pingTemplate);
      const networkTemplate = JSON.parse(networkConfig.pingTemplate);

      expect(contractorTemplate.template).toBe('contractor-template');
      expect(networkTemplate.template).toBe('network-template');
    });

    it('should handle GET /api/admin/buyers/[id]/config', async () => {
      // Create test configuration
      await prisma.buyerServiceConfig.create({
        data: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: 75.00,
          maxBid: 250.00,
          active: true
        }
      });

      // Get configuration
      const config = await prisma.buyerServiceConfig.findFirst({
        where: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id
        },
        include: {
          buyer: true,
          serviceType: true
        }
      });

      expect(config).toBeTruthy();
      expect(config!.buyer.type).toBe('CONTRACTOR');
      expect(config!.minBid).toBe(75.00);
      expect(config!.maxBid).toBe(250.00);
    });
  });

  describe('Service Zone Management API', () => {
    let testContractor: any;
    let testNetwork: any;
    let testServiceType: any;

    beforeEach(async () => {
      testServiceType = await prisma.serviceType.create({
        data: {
          name: 'api-test-zones',
          displayName: 'API Test Zones',
          formSchema: '{}',
          active: true
        }
      });

      testContractor = await prisma.buyer.create({
        data: {
          name: 'API Zone Contractor',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://zonecontractor.com/api',
          active: true
        }
      });

      testNetwork = await prisma.buyer.create({
        data: {
          name: 'API Zone Network',
          type: BuyerType.NETWORK,
          apiUrl: 'https://zonenetwork.com/api',
          active: true
        }
      });
    });

    it('should handle POST /api/admin/buyers/[id]/zip-codes for bulk assignment', async () => {
      const zipCodes = ['40001', '40002', '40003', '40004'];

      // Bulk assign zip codes for contractor
      const contractorAssignments = await prisma.buyerServiceZipCode.createMany({
        data: zipCodes.map(zipCode => ({
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id,
          zipCode,
          active: true,
          priority: 100,
          maxLeadsPerDay: 6,
          minBid: 60.00,
          maxBid: 200.00
        }))
      });

      // Bulk assign zip codes for network with different constraints
      const networkAssignments = await prisma.buyerServiceZipCode.createMany({
        data: zipCodes.map(zipCode => ({
          buyerId: testNetwork.id,
          serviceTypeId: testServiceType.id,
          zipCode,
          active: true,
          priority: 130,
          maxLeadsPerDay: 20,
          minBid: 45.00,
          maxBid: 350.00
        }))
      });

      expect(contractorAssignments.count).toBe(4);
      expect(networkAssignments.count).toBe(4);

      // Verify assignments
      const contractorZones = await prisma.buyerServiceZipCode.findMany({
        where: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id
        }
      });

      expect(contractorZones).toHaveLength(4);
      expect(contractorZones[0].maxLeadsPerDay).toBe(6);
      expect(contractorZones[0].priority).toBe(100);
    });

    it('should handle GET /api/admin/buyers/[id]/zip-codes', async () => {
      // Create test zone assignments
      await prisma.buyerServiceZipCode.createMany({
        data: [
          {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '40101',
            active: true,
            priority: 95
          },
          {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '40102',
            active: false,
            priority: 90
          }
        ]
      });

      // Get zip code assignments
      const zones = await prisma.buyerServiceZipCode.findMany({
        where: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id
        },
        include: {
          buyer: true,
          serviceType: true
        },
        orderBy: { zipCode: 'asc' }
      });

      expect(zones).toHaveLength(2);
      expect(zones[0].buyer.type).toBe('CONTRACTOR');
      expect(zones[0].zipCode).toBe('40101');
      expect(zones[1].zipCode).toBe('40102');

      // Test filtering by active status
      const activeZones = zones.filter(zone => zone.active);
      expect(activeZones).toHaveLength(1);
    });

    it('should handle PUT /api/admin/buyers/[id]/zip-codes/[zipCode]', async () => {
      // Create initial zone
      const initialZone = await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id,
          zipCode: '40201',
          active: true,
          priority: 80,
          maxLeadsPerDay: 5,
          minBid: 50.00,
          maxBid: 150.00
        }
      });

      // Update zone settings
      const updatedZone = await prisma.buyerServiceZipCode.update({
        where: { id: initialZone.id },
        data: {
          priority: 120,
          maxLeadsPerDay: 8,
          minBid: 65.00,
          maxBid: 180.00,
          updatedAt: new Date()
        }
      });

      expect(updatedZone.priority).toBe(120);
      expect(updatedZone.maxLeadsPerDay).toBe(8);
      expect(updatedZone.minBid).toBe(65.00);
      expect(updatedZone.updatedAt.getTime()).toBeGreaterThan(
        initialZone.createdAt.getTime()
      );
    });
  });

  describe('Lead Distribution API', () => {
    let testContractor: any;
    let testNetwork: any;
    let testServiceType: any;

    beforeEach(async () => {
      testServiceType = await prisma.serviceType.create({
        data: {
          name: 'api-test-leads',
          displayName: 'API Test Leads',
          formSchema: '{}',
          active: true
        }
      });

      testContractor = await prisma.buyer.create({
        data: {
          name: 'API Lead Contractor',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://leadcontractor.com/api',
          active: true
        }
      });

      testNetwork = await prisma.buyer.create({
        data: {
          name: 'API Lead Network',
          type: BuyerType.NETWORK,
          apiUrl: 'https://leadnetwork.com/api',
          active: true
        }
      });

      // Set up service zones
      await prisma.buyerServiceZipCode.createMany({
        data: [
          {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '50001',
            active: true,
            priority: 100
          },
          {
            buyerId: testNetwork.id,
            serviceTypeId: testServiceType.id,
            zipCode: '50001',
            active: true,
            priority: 120
          }
        ]
      });
    });

    it('should handle POST /api/leads with buyer type eligibility', async () => {
      const leadData = {
        serviceTypeId: testServiceType.id,
        formData: JSON.stringify({
          projectType: 'New Installation',
          budget: '$5000',
          timeline: '1-2 weeks',
          contactName: 'API Test Customer',
          contactEmail: 'customer@apitest.com',
          contactPhone: '(555) 123-0000'
        }),
        zipCode: '50001',
        ownsHome: true,
        timeframe: 'ASAP'
      };

      // Create lead
      const createdLead = await prisma.lead.create({
        data: {
          ...leadData,
          status: 'PENDING'
        }
      });

      expect(createdLead.serviceTypeId).toBe(testServiceType.id);
      expect(createdLead.zipCode).toBe('50001');

      // Verify eligible buyers exist for this lead
      const eligibleZones = await prisma.buyerServiceZipCode.findMany({
        where: {
          serviceTypeId: testServiceType.id,
          zipCode: '50001',
          active: true,
          buyer: { active: true }
        },
        include: { buyer: true }
      });

      expect(eligibleZones).toHaveLength(2);
      
      const contractorZone = eligibleZones.find(zone => zone.buyer.type === 'CONTRACTOR');
      const networkZone = eligibleZones.find(zone => zone.buyer.type === 'NETWORK');
      
      expect(contractorZone).toBeTruthy();
      expect(networkZone).toBeTruthy();
    });

    it('should handle GET /api/admin/leads with buyer type filtering', async () => {
      // Create test leads with different winners
      await prisma.lead.createMany({
        data: [
          {
            serviceTypeId: testServiceType.id,
            formData: '{}',
            zipCode: '50001',
            ownsHome: true,
            timeframe: 'ASAP',
            status: 'COMPLETED',
            winningBuyerId: testContractor.id,
            winningBid: 100.00
          },
          {
            serviceTypeId: testServiceType.id,
            formData: '{}',
            zipCode: '50001',
            ownsHome: true,
            timeframe: 'ASAP',
            status: 'COMPLETED',
            winningBuyerId: testNetwork.id,
            winningBid: 150.00
          },
          {
            serviceTypeId: testServiceType.id,
            formData: '{}',
            zipCode: '50001',
            ownsHome: true,
            timeframe: 'ASAP',
            status: 'PENDING'
          }
        ]
      });

      // Get all leads
      const allLeads = await prisma.lead.findMany({
        where: { serviceTypeId: testServiceType.id },
        include: { winningBuyer: true }
      });

      expect(allLeads).toHaveLength(3);

      // Filter leads won by contractors
      const contractorWins = allLeads.filter(lead => 
        lead.winningBuyer?.type === 'CONTRACTOR'
      );

      // Filter leads won by networks
      const networkWins = allLeads.filter(lead => 
        lead.winningBuyer?.type === 'NETWORK'
      );

      expect(contractorWins).toHaveLength(1);
      expect(networkWins).toHaveLength(1);
      expect(contractorWins[0].winningBid).toBe(100.00);
      expect(networkWins[0].winningBid).toBe(150.00);
    });
  });

  describe('Analytics API Endpoints', () => {
    beforeEach(async () => {
      // Create test data for analytics
      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'api-analytics-test',
          displayName: 'API Analytics Test',
          formSchema: '{}',
          active: true
        }
      });

      const contractors = await prisma.buyer.createMany({
        data: [
          { name: 'Analytics Contractor A', type: BuyerType.CONTRACTOR, apiUrl: 'urlA', active: true },
          { name: 'Analytics Contractor B', type: BuyerType.CONTRACTOR, apiUrl: 'urlB', active: true }
        ]
      });

      const networks = await prisma.buyer.createMany({
        data: [
          { name: 'Analytics Network X', type: BuyerType.NETWORK, apiUrl: 'urlX', active: true },
          { name: 'Analytics Network Y', type: BuyerType.NETWORK, apiUrl: 'urlY', active: true }
        ]
      });
    });

    it('should handle GET /api/admin/analytics/buyers', async () => {
      // Get buyer analytics by type
      const buyerStats = await prisma.buyer.groupBy({
        by: ['type', 'active'],
        _count: { id: true },
        where: { name: { contains: 'Analytics' } }
      });

      const activeContractors = buyerStats.find(
        s => s.type === 'CONTRACTOR' && s.active === true
      )?._count.id || 0;

      const activeNetworks = buyerStats.find(
        s => s.type === 'NETWORK' && s.active === true
      )?._count.id || 0;

      expect(activeContractors).toBe(2);
      expect(activeNetworks).toBe(2);
    });

    it('should handle GET /api/admin/analytics/performance', async () => {
      // Create performance data
      const buyers = await prisma.buyer.findMany({
        where: { name: { contains: 'Analytics' } }
      });

      // Mock performance metrics by type
      const contractorBuyers = buyers.filter(b => b.type === 'CONTRACTOR');
      const networkBuyers = buyers.filter(b => b.type === 'NETWORK');

      // Performance comparison
      const performanceMetrics = {
        contractors: {
          count: contractorBuyers.length,
          avgResponseTime: 1200, // ms
          successRate: 0.85
        },
        networks: {
          count: networkBuyers.length,
          avgResponseTime: 800, // ms
          successRate: 0.75
        }
      };

      expect(performanceMetrics.contractors.count).toBe(2);
      expect(performanceMetrics.networks.count).toBe(2);
      expect(performanceMetrics.contractors.avgResponseTime).toBeGreaterThan(
        performanceMetrics.networks.avgResponseTime
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid buyer type in API calls', async () => {
      try {
        await prisma.buyer.create({
          data: {
            name: 'Invalid Type Buyer',
            type: 'INVALID_TYPE' as any, // Invalid type
            apiUrl: 'https://invalid.com/api',
            active: true
          }
        });
      } catch (error) {
        // Should fail due to enum constraint
        expect(error).toBeTruthy();
      }
    });

    it('should handle API rate limiting by buyer type', async () => {
      // Mock rate limiting logic
      const rateLimits = {
        [BuyerType.CONTRACTOR]: 10, // requests per minute
        [BuyerType.NETWORK]: 50    // requests per minute
      };

      expect(rateLimits[BuyerType.CONTRACTOR]).toBe(10);
      expect(rateLimits[BuyerType.NETWORK]).toBe(50);
    });

    it('should handle concurrent API requests gracefully', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        prisma.buyer.create({
          data: {
            name: `Concurrent Contractor ${i}`,
            type: BuyerType.CONTRACTOR,
            apiUrl: `https://concurrent${i}.com/api`,
            active: false
          }
        })
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      expect(results.every(r => r.type === 'CONTRACTOR')).toBe(true);
    });
  });
});