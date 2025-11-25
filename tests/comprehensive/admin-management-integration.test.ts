/**
 * Admin Management Integration Tests
 * Tests admin functionality for managing different buyer types
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { BuyerType } from '@/types/database';

const prisma = new PrismaClient();

describe('Admin Management Integration Tests', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.buyerServiceZipCode.deleteMany();
    await prisma.buyerServiceConfig.deleteMany();
    await prisma.buyer.deleteMany({ where: { name: { contains: 'Test' } } });
    await prisma.serviceType.deleteMany({ where: { name: { contains: 'test' } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Buyer Type Management', () => {
    it('should create and manage contractors vs networks', async () => {
      // Create test service type
      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'test-landscaping',
          displayName: 'Test Landscaping',
          formSchema: '{}',
          active: true
        }
      });

      // Create contractors
      const contractors = await prisma.buyer.createMany({
        data: [
          {
            name: 'Green Thumb Contractors',
            type: BuyerType.CONTRACTOR,
            apiUrl: 'https://greenthumb.com/api',
            active: false // Pending approval
          },
          {
            name: 'Lawn Care Pros',
            type: BuyerType.CONTRACTOR,
            apiUrl: 'https://lawncarepros.com/api',
            active: true
          }
        ]
      });

      // Create networks
      const networks = await prisma.buyer.createMany({
        data: [
          {
            name: 'National Landscaping Network',
            type: BuyerType.NETWORK,
            apiUrl: 'https://nationallandscape.com/api',
            active: true
          },
          {
            name: 'Regional Garden Network',
            type: BuyerType.NETWORK,
            apiUrl: 'https://regionalgarden.com/api',
            active: true
          }
        ]
      });

      expect(contractors.count).toBe(2);
      expect(networks.count).toBe(2);

      // Test admin queries
      const pendingContractors = await prisma.buyer.findMany({
        where: { type: BuyerType.CONTRACTOR, active: false }
      });

      const activeNetworks = await prisma.buyer.findMany({
        where: { type: BuyerType.NETWORK, active: true }
      });

      expect(pendingContractors).toHaveLength(1);
      expect(pendingContractors[0].name).toBe('Green Thumb Contractors');
      expect(activeNetworks).toHaveLength(2);
    });

    it('should handle contractor approval workflow', async () => {
      // Create pending contractor
      const pendingContractor = await prisma.buyer.create({
        data: {
          name: 'New Contractor LLC',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://newcontractor.com/api',
          authConfig: JSON.stringify({
            contactName: 'John Smith',
            contactEmail: 'john@newcontractor.com',
            contactPhone: '(555) 123-4567',
            businessDescription: 'Professional landscaping services'
          }),
          active: false
        }
      });

      // Admin approves contractor
      const approvedContractor = await prisma.buyer.update({
        where: { id: pendingContractor.id },
        data: { active: true }
      });

      expect(approvedContractor.active).toBe(true);
      expect(approvedContractor.type).toBe('CONTRACTOR');

      // Verify contractor is now in active list
      const activeContractors = await prisma.buyer.findMany({
        where: { type: BuyerType.CONTRACTOR, active: true }
      });

      expect(activeContractors).toContain(
        expect.objectContaining({ id: pendingContractor.id })
      );
    });

    it('should provide buyer type statistics', async () => {
      // Create test data
      await prisma.buyer.createMany({
        data: [
          { name: 'Contractor 1', type: BuyerType.CONTRACTOR, apiUrl: 'url1', active: true },
          { name: 'Contractor 2', type: BuyerType.CONTRACTOR, apiUrl: 'url2', active: true },
          { name: 'Contractor 3', type: BuyerType.CONTRACTOR, apiUrl: 'url3', active: false },
          { name: 'Network 1', type: BuyerType.NETWORK, apiUrl: 'url4', active: true },
          { name: 'Network 2', type: BuyerType.NETWORK, apiUrl: 'url5', active: true }
        ]
      });

      // Get statistics
      const stats = await prisma.buyer.groupBy({
        by: ['type', 'active'],
        _count: { id: true }
      });

      const activeContractors = stats.find(s => s.type === 'CONTRACTOR' && s.active === true)?._count.id || 0;
      const pendingContractors = stats.find(s => s.type === 'CONTRACTOR' && s.active === false)?._count.id || 0;
      const activeNetworks = stats.find(s => s.type === 'NETWORK' && s.active === true)?._count.id || 0;

      expect(activeContractors).toBe(2);
      expect(pendingContractors).toBe(1);
      expect(activeNetworks).toBe(2);
    });
  });

  describe('Service Configuration by Buyer Type', () => {
    let testContractor: any;
    let testNetwork: any;
    let testServiceType: any;

    beforeEach(async () => {
      testServiceType = await prisma.serviceType.create({
        data: {
          name: 'test-electrical',
          displayName: 'Test Electrical Work',
          formSchema: '{}',
          active: true
        }
      });

      testContractor = await prisma.buyer.create({
        data: {
          name: 'Test Electrical Contractor',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://electrical.com/api',
          active: true
        }
      });

      testNetwork = await prisma.buyer.create({
        data: {
          name: 'Test Electrical Network',
          type: BuyerType.NETWORK,
          apiUrl: 'https://electricalnet.com/api',
          active: true
        }
      });
    });

    it('should allow different service configurations per buyer type', async () => {
      // Create different configs for contractor vs network
      const contractorConfig = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id,
          pingTemplate: JSON.stringify({ template: 'contractor-electrical' }),
          postTemplate: JSON.stringify({ template: 'contractor-electrical-post' }),
          fieldMappings: JSON.stringify({ type: 'contractor' }),
          minBid: 75.00, // Higher minimum for contractors
          maxBid: 300.00,
          requiresTrustedForm: true,
          requiresJornaya: true,
          active: true
        }
      });

      const networkConfig = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: testNetwork.id,
          serviceTypeId: testServiceType.id,
          pingTemplate: JSON.stringify({ template: 'network-electrical' }),
          postTemplate: JSON.stringify({ template: 'network-electrical-post' }),
          fieldMappings: JSON.stringify({ type: 'network' }),
          minBid: 50.00, // Lower minimum for networks
          maxBid: 500.00, // Higher maximum for networks
          requiresTrustedForm: false,
          requiresJornaya: false,
          active: true
        }
      });

      // Verify different configurations
      expect(contractorConfig.minBid).toBe(75.00);
      expect(contractorConfig.maxBid).toBe(300.00);
      expect(contractorConfig.requiresTrustedForm).toBe(true);

      expect(networkConfig.minBid).toBe(50.00);
      expect(networkConfig.maxBid).toBe(500.00);
      expect(networkConfig.requiresTrustedForm).toBe(false);

      // Admin can query configurations by buyer type
      const contractorConfigs = await prisma.buyerServiceConfig.findMany({
        where: {
          buyer: { type: BuyerType.CONTRACTOR }
        },
        include: { buyer: true, serviceType: true }
      });

      const networkConfigs = await prisma.buyerServiceConfig.findMany({
        where: {
          buyer: { type: BuyerType.NETWORK }
        },
        include: { buyer: true, serviceType: true }
      });

      expect(contractorConfigs).toHaveLength(1);
      expect(networkConfigs).toHaveLength(1);
    });

    it('should manage service configurations efficiently', async () => {
      // Create configurations for both buyer types
      await prisma.buyerServiceConfig.createMany({
        data: [
          {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            pingTemplate: '{}',
            postTemplate: '{}',
            fieldMappings: '{}',
            minBid: 60.00,
            maxBid: 250.00,
            active: true
          },
          {
            buyerId: testNetwork.id,
            serviceTypeId: testServiceType.id,
            pingTemplate: '{}',
            postTemplate: '{}',
            fieldMappings: '{}',
            minBid: 45.00,
            maxBid: 400.00,
            active: true
          }
        ]
      });

      // Admin can get all configs for a service type
      const allConfigs = await prisma.buyerServiceConfig.findMany({
        where: { serviceTypeId: testServiceType.id },
        include: { buyer: true }
      });

      expect(allConfigs).toHaveLength(2);

      // Admin can filter by buyer type
      const contractorOnly = allConfigs.filter(c => c.buyer.type === 'CONTRACTOR');
      const networkOnly = allConfigs.filter(c => c.buyer.type === 'NETWORK');

      expect(contractorOnly).toHaveLength(1);
      expect(networkOnly).toHaveLength(1);

      // Different bid ranges for different types
      expect(contractorOnly[0].maxBid).toBe(250.00);
      expect(networkOnly[0].maxBid).toBe(400.00);
    });
  });

  describe('Zip Code Management by Buyer Type', () => {
    let testContractor: any;
    let testNetwork: any;
    let testServiceType: any;

    beforeEach(async () => {
      testServiceType = await prisma.serviceType.create({
        data: {
          name: 'test-hvac',
          displayName: 'Test HVAC Services',
          formSchema: '{}',
          active: true
        }
      });

      testContractor = await prisma.buyer.create({
        data: {
          name: 'Test HVAC Contractor',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://hvac.com/api',
          active: true
        }
      });

      testNetwork = await prisma.buyer.create({
        data: {
          name: 'Test HVAC Network',
          type: BuyerType.NETWORK,
          apiUrl: 'https://hvacnet.com/api',
          active: true
        }
      });
    });

    it('should manage zip code assignments per buyer type', async () => {
      const zipCodes = ['20001', '20002', '20003'];

      // Admin assigns zip codes with different constraints per type
      await prisma.buyerServiceZipCode.createMany({
        data: [
          // Contractor assignments - smaller scale
          ...zipCodes.map(zipCode => ({
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode,
            active: true,
            priority: 100,
            maxLeadsPerDay: 5, // Smaller daily limit
            minBid: 80.00,
            maxBid: 300.00
          })),
          // Network assignments - larger scale
          ...zipCodes.map(zipCode => ({
            buyerId: testNetwork.id,
            serviceTypeId: testServiceType.id,
            zipCode,
            active: true,
            priority: 120,
            maxLeadsPerDay: 25, // Larger daily limit
            minBid: 60.00,
            maxBid: 450.00
          }))
        ]
      });

      // Admin can query assignments by buyer type
      const contractorAssignments = await prisma.buyerServiceZipCode.findMany({
        where: {
          buyer: { type: BuyerType.CONTRACTOR },
          serviceTypeId: testServiceType.id
        },
        include: { buyer: true }
      });

      const networkAssignments = await prisma.buyerServiceZipCode.findMany({
        where: {
          buyer: { type: BuyerType.NETWORK },
          serviceTypeId: testServiceType.id
        },
        include: { buyer: true }
      });

      expect(contractorAssignments).toHaveLength(3);
      expect(networkAssignments).toHaveLength(3);

      // Verify different constraints
      expect(contractorAssignments[0].maxLeadsPerDay).toBe(5);
      expect(networkAssignments[0].maxLeadsPerDay).toBe(25);
    });

    it('should provide coverage analysis by buyer type', async () => {
      // Create different coverage patterns
      await prisma.buyerServiceZipCode.createMany({
        data: [
          // Contractor: local coverage
          { buyerId: testContractor.id, serviceTypeId: testServiceType.id, zipCode: '20001', active: true, priority: 100 },
          { buyerId: testContractor.id, serviceTypeId: testServiceType.id, zipCode: '20002', active: true, priority: 95 },
          // Network: wider coverage
          { buyerId: testNetwork.id, serviceTypeId: testServiceType.id, zipCode: '20001', active: true, priority: 120 },
          { buyerId: testNetwork.id, serviceTypeId: testServiceType.id, zipCode: '20002', active: true, priority: 115 },
          { buyerId: testNetwork.id, serviceTypeId: testServiceType.id, zipCode: '20003', active: true, priority: 110 },
          { buyerId: testNetwork.id, serviceTypeId: testServiceType.id, zipCode: '20004', active: true, priority: 105 }
        ]
      });

      // Admin analysis: coverage by buyer type
      const contractorCoverage = await prisma.buyerServiceZipCode.count({
        where: {
          buyer: { type: BuyerType.CONTRACTOR },
          serviceTypeId: testServiceType.id,
          active: true
        }
      });

      const networkCoverage = await prisma.buyerServiceZipCode.count({
        where: {
          buyer: { type: BuyerType.NETWORK },
          serviceTypeId: testServiceType.id,
          active: true
        }
      });

      expect(contractorCoverage).toBe(2); // Local coverage
      expect(networkCoverage).toBe(4); // Wider coverage

      // Coverage overlap analysis
      const overlapQuery = await prisma.$queryRaw`
        SELECT zipCode, COUNT(*) as buyer_count
        FROM buyer_service_zip_codes bszc
        JOIN buyers b ON bszc.buyer_id = b.id
        WHERE bszc.service_type_id = ${testServiceType.id}
        AND bszc.active = 1
        GROUP BY zipCode
        HAVING COUNT(*) > 1
      `;

      expect(Array.isArray(overlapQuery)).toBe(true);
      expect((overlapQuery as any[]).length).toBe(2); // Two overlapping zip codes
    });

    it('should handle bulk zip code management', async () => {
      const zipCodeBatch = Array.from({ length: 20 }, (_, i) => 
        `2${String(i).padStart(4, '0')}`
      );

      // Admin bulk assignment for contractor
      const contractorAssignments = zipCodeBatch.slice(0, 10).map(zipCode => ({
        buyerId: testContractor.id,
        serviceTypeId: testServiceType.id,
        zipCode,
        active: true,
        priority: 90 + Math.floor(Math.random() * 20)
      }));

      // Admin bulk assignment for network
      const networkAssignments = zipCodeBatch.map(zipCode => ({
        buyerId: testNetwork.id,
        serviceTypeId: testServiceType.id,
        zipCode,
        active: true,
        priority: 110 + Math.floor(Math.random() * 20)
      }));

      await prisma.buyerServiceZipCode.createMany({
        data: [...contractorAssignments, ...networkAssignments]
      });

      // Verify bulk assignments
      const totalAssignments = await prisma.buyerServiceZipCode.count({
        where: { serviceTypeId: testServiceType.id }
      });

      expect(totalAssignments).toBe(30); // 10 contractor + 20 network

      // Admin can efficiently query large datasets
      const highPriorityAssignments = await prisma.buyerServiceZipCode.findMany({
        where: {
          serviceTypeId: testServiceType.id,
          priority: { gte: 120 }
        },
        include: { buyer: true },
        orderBy: { priority: 'desc' }
      });

      expect(highPriorityAssignments.length).toBeGreaterThan(0);
    });
  });

  describe('Buyer Performance Analytics by Type', () => {
    let contractors: any[];
    let networks: any[];
    let serviceType: any;

    beforeEach(async () => {
      serviceType = await prisma.serviceType.create({
        data: {
          name: 'test-analytics',
          displayName: 'Test Analytics Service',
          formSchema: '{}',
          active: true
        }
      });

      // Create test buyers
      const contractorData = await prisma.buyer.createMany({
        data: [
          { name: 'Analytics Contractor A', type: BuyerType.CONTRACTOR, apiUrl: 'https://ca.com/api', active: true },
          { name: 'Analytics Contractor B', type: BuyerType.CONTRACTOR, apiUrl: 'https://cb.com/api', active: true }
        ]
      });

      const networkData = await prisma.buyer.createMany({
        data: [
          { name: 'Analytics Network X', type: BuyerType.NETWORK, apiUrl: 'https://nx.com/api', active: true },
          { name: 'Analytics Network Y', type: BuyerType.NETWORK, apiUrl: 'https://ny.com/api', active: true }
        ]
      });

      contractors = await prisma.buyer.findMany({
        where: { type: BuyerType.CONTRACTOR, name: { contains: 'Analytics' } }
      });

      networks = await prisma.buyer.findMany({
        where: { type: BuyerType.NETWORK, name: { contains: 'Analytics' } }
      });
    });

    it('should track performance metrics by buyer type', async () => {
      // Create test leads
      const testLeads = await prisma.lead.createMany({
        data: Array.from({ length: 10 }, (_, i) => ({
          serviceTypeId: serviceType.id,
          formData: JSON.stringify({ project: `Project ${i}` }),
          zipCode: `3000${i}`,
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'COMPLETED',
          winningBuyerId: i < 5 ? contractors[0].id : networks[0].id,
          winningBid: 100 + (i * 10)
        }))
      });

      // Create transaction records
      const transactionData: any[] = [];
      
      // Contractor transactions (lower volume, higher success rate)
      for (let i = 0; i < 5; i++) {
        transactionData.push(
          {
            leadId: (await prisma.lead.findFirst({ skip: i }))!.id,
            buyerId: contractors[0].id,
            actionType: 'PING',
            payload: '{}',
            status: 'SUCCESS',
            bidAmount: 100 + (i * 10),
            responseTime: 800 + Math.random() * 200
          },
          {
            leadId: (await prisma.lead.findFirst({ skip: i }))!.id,
            buyerId: contractors[0].id,
            actionType: 'POST',
            payload: '{}',
            status: 'SUCCESS',
            responseTime: 1200 + Math.random() * 300
          }
        );
      }

      // Network transactions (higher volume, variable success)
      for (let i = 5; i < 10; i++) {
        transactionData.push(
          {
            leadId: (await prisma.lead.findFirst({ skip: i }))!.id,
            buyerId: networks[0].id,
            actionType: 'PING',
            payload: '{}',
            status: i < 8 ? 'SUCCESS' : 'FAILED',
            bidAmount: i < 8 ? 120 + (i * 15) : null,
            responseTime: 600 + Math.random() * 400
          }
        );
      }

      await prisma.transaction.createMany({ data: transactionData });

      // Admin analytics: performance by buyer type
      const contractorStats = await prisma.transaction.groupBy({
        by: ['status'],
        where: {
          buyer: { type: BuyerType.CONTRACTOR }
        },
        _count: { id: true },
        _avg: { responseTime: true }
      });

      const networkStats = await prisma.transaction.groupBy({
        by: ['status'],
        where: {
          buyer: { type: BuyerType.NETWORK }
        },
        _count: { id: true },
        _avg: { responseTime: true }
      });

      const contractorSuccess = contractorStats.find(s => s.status === 'SUCCESS');
      const networkSuccess = networkStats.find(s => s.status === 'SUCCESS');

      expect(contractorSuccess?._count.id).toBe(10); // All successful
      expect(networkSuccess?._count.id).toBe(3); // Some failed

      // Response time comparison
      expect(contractorSuccess?._avg.responseTime).toBeGreaterThan(800);
      expect(networkSuccess?._avg.responseTime).toBeLessThan(1000);
    });

    it('should provide lead distribution analytics', async () => {
      // Create leads won by different buyer types
      await prisma.lead.createMany({
        data: [
          // Contractor wins (smaller projects)
          ...Array.from({ length: 15 }, (_, i) => ({
            serviceTypeId: serviceType.id,
            formData: '{}',
            zipCode: `3001${i}`,
            ownsHome: true,
            timeframe: 'ASAP',
            status: 'COMPLETED',
            winningBuyerId: contractors[i % 2].id,
            winningBid: 50 + (i * 5)
          })),
          // Network wins (larger projects)
          ...Array.from({ length: 8 }, (_, i) => ({
            serviceTypeId: serviceType.id,
            formData: '{}',
            zipCode: `3002${i}`,
            ownsHome: true,
            timeframe: 'ASAP',
            status: 'COMPLETED',
            winningBuyerId: networks[i % 2].id,
            winningBid: 150 + (i * 25)
          }))
        ]
      });

      // Analytics: lead distribution by buyer type
      const leadDistribution = await prisma.lead.groupBy({
        by: ['winningBuyerId'],
        where: {
          status: 'COMPLETED',
          winningBuyer: { type: { in: ['CONTRACTOR', 'NETWORK'] } }
        },
        _count: { id: true },
        _avg: { winningBid: true },
        _sum: { winningBid: true }
      });

      // Separate contractor and network results
      const contractorLeads = leadDistribution.filter(ld => 
        contractors.some(c => c.id === ld.winningBuyerId)
      );

      const networkLeads = leadDistribution.filter(ld => 
        networks.some(n => n.id === ld.winningBuyerId)
      );

      const totalContractorLeads = contractorLeads.reduce((sum, cl) => sum + cl._count.id, 0);
      const totalNetworkLeads = networkLeads.reduce((sum, nl) => sum + nl._count.id, 0);

      expect(totalContractorLeads).toBe(15);
      expect(totalNetworkLeads).toBe(8);

      // Average bid analysis
      const avgContractorBid = contractorLeads.reduce((sum, cl) => sum + (cl._avg.winningBid || 0), 0) / contractorLeads.length;
      const avgNetworkBid = networkLeads.reduce((sum, nl) => sum + (nl._avg.winningBid || 0), 0) / networkLeads.length;

      expect(avgNetworkBid).toBeGreaterThan(avgContractorBid); // Networks typically bid higher
    });
  });

  describe('Admin Dashboard Queries', () => {
    beforeEach(async () => {
      // Set up comprehensive test data
      const serviceTypes = await prisma.serviceType.createMany({
        data: [
          { name: 'dashboard-roofing', displayName: 'Roofing', formSchema: '{}', active: true },
          { name: 'dashboard-plumbing', displayName: 'Plumbing', formSchema: '{}', active: true },
          { name: 'dashboard-electrical', displayName: 'Electrical', formSchema: '{}', active: true }
        ]
      });

      await prisma.buyer.createMany({
        data: [
          // Active contractors
          { name: 'Dashboard Contractor 1', type: BuyerType.CONTRACTOR, apiUrl: 'url1', active: true },
          { name: 'Dashboard Contractor 2', type: BuyerType.CONTRACTOR, apiUrl: 'url2', active: true },
          { name: 'Dashboard Contractor 3', type: BuyerType.CONTRACTOR, apiUrl: 'url3', active: true },
          // Pending contractors
          { name: 'Pending Contractor 1', type: BuyerType.CONTRACTOR, apiUrl: 'url4', active: false },
          { name: 'Pending Contractor 2', type: BuyerType.CONTRACTOR, apiUrl: 'url5', active: false },
          // Active networks
          { name: 'Dashboard Network 1', type: BuyerType.NETWORK, apiUrl: 'url6', active: true },
          { name: 'Dashboard Network 2', type: BuyerType.NETWORK, apiUrl: 'url7', active: true }
        ]
      });
    });

    it('should provide comprehensive dashboard statistics', async () => {
      // Key metrics for admin dashboard
      const totalBuyers = await prisma.buyer.count();
      const activeContractors = await prisma.buyer.count({
        where: { type: BuyerType.CONTRACTOR, active: true }
      });
      const pendingContractors = await prisma.buyer.count({
        where: { type: BuyerType.CONTRACTOR, active: false }
      });
      const activeNetworks = await prisma.buyer.count({
        where: { type: BuyerType.NETWORK, active: true }
      });

      expect(totalBuyers).toBe(7);
      expect(activeContractors).toBe(3);
      expect(pendingContractors).toBe(2);
      expect(activeNetworks).toBe(2);

      // Type distribution
      const typeDistribution = await prisma.buyer.groupBy({
        by: ['type'],
        _count: { id: true }
      });

      const contractorCount = typeDistribution.find(t => t.type === 'CONTRACTOR')?._count.id || 0;
      const networkCount = typeDistribution.find(t => t.type === 'NETWORK')?._count.id || 0;

      expect(contractorCount).toBe(5);
      expect(networkCount).toBe(2);
    });

    it('should support efficient admin search and filtering', async () => {
      // Search contractors by status
      const activeContractors = await prisma.buyer.findMany({
        where: {
          type: BuyerType.CONTRACTOR,
          active: true,
          name: { contains: 'Dashboard' }
        },
        orderBy: { createdAt: 'desc' }
      });

      const pendingContractors = await prisma.buyer.findMany({
        where: {
          type: BuyerType.CONTRACTOR,
          active: false
        }
      });

      expect(activeContractors).toHaveLength(3);
      expect(pendingContractors).toHaveLength(2);

      // Search by name pattern
      const dashboardBuyers = await prisma.buyer.findMany({
        where: {
          name: { contains: 'Dashboard' }
        }
      });

      expect(dashboardBuyers).toHaveLength(5); // 3 contractors + 2 networks
    });

    it('should handle pagination for large buyer lists', async () => {
      // Create additional buyers for pagination testing
      const additionalBuyers = Array.from({ length: 25 }, (_, i) => ({
        name: `Pagination Contractor ${i + 1}`,
        type: BuyerType.CONTRACTOR,
        apiUrl: `https://contractor${i + 1}.com/api`,
        active: i % 3 === 0 // Every third is active
      }));

      await prisma.buyer.createMany({ data: additionalBuyers });

      // Test pagination
      const page1 = await prisma.buyer.findMany({
        where: { type: BuyerType.CONTRACTOR },
        take: 10,
        skip: 0,
        orderBy: { name: 'asc' }
      });

      const page2 = await prisma.buyer.findMany({
        where: { type: BuyerType.CONTRACTOR },
        take: 10,
        skip: 10,
        orderBy: { name: 'asc' }
      });

      const totalContractors = await prisma.buyer.count({
        where: { type: BuyerType.CONTRACTOR }
      });

      expect(page1).toHaveLength(10);
      expect(page2).toHaveLength(10);
      expect(totalContractors).toBe(30); // 5 original + 25 new

      // Ensure no overlap between pages
      const page1Ids = page1.map(b => b.id);
      const page2Ids = page2.map(b => b.id);
      const intersection = page1Ids.filter(id => page2Ids.includes(id));
      
      expect(intersection).toHaveLength(0);
    });
  });
});