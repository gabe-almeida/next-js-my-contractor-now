/**
 * Admin Management Workflow Tests
 * Tests admin interfaces and workflows for managing contractors and buyers
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { BuyerType } from '@/types/database';
import request from 'supertest';
import { createApp } from '../utils/testHelpers';

const prisma = new PrismaClient();
const app = createApp();

describe('5. Admin Management Workflows', () => {
  let testContractor: any;
  let testNetworkBuyer: any;
  let testServiceType: any;

  beforeEach(async () => {
    // Clean up test data
    await prisma.transaction.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.buyerServiceZipCode.deleteMany();
    await prisma.buyerServiceConfig.deleteMany();
    await prisma.buyer.deleteMany({ where: { name: { contains: 'Admin Test' } } });
    await prisma.serviceType.deleteMany({ where: { name: { contains: 'admin-test' } } });

    // Create test service type
    testServiceType = await prisma.serviceType.create({
      data: {
        name: 'admin-test-service',
        displayName: 'Admin Test Service',
        formSchema: JSON.stringify({ fields: ['field1', 'field2'] }),
        active: true
      }
    });

    // Create test contractor
    testContractor = await prisma.buyer.create({
      data: {
        name: 'Admin Test Contractor LLC',
        type: BuyerType.CONTRACTOR,
        apiUrl: 'https://admintestcontractor.com/api/leads',
        authConfig: JSON.stringify({
          contactEmail: 'admin@testcontractor.com',
          contactPhone: '(555) 111-2222',
          contactName: 'Admin Test Contractor',
          businessDescription: 'Test contractor for admin workflows',
          apiKey: 'admin-test-key'
        }),
        active: false, // Initially inactive for approval workflow
        pingTimeout: 30,
        postTimeout: 60
      }
    });

    // Create test network buyer for comparison
    testNetworkBuyer = await prisma.buyer.create({
      data: {
        name: 'Admin Test Network',
        type: BuyerType.NETWORK,
        apiUrl: 'https://admintestnetwork.com/api',
        authConfig: JSON.stringify({
          apiKey: 'network-admin-key'
        }),
        active: true,
        pingTimeout: 25,
        postTimeout: 45
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Contractor Approval Workflow', () => {
    it('should list pending contractor registrations', async () => {
      const response = await request(app)
        .get('/api/contractors/signup?status=pending')
        .expect(200);

      expect(response.body.contractors).toBeInstanceOf(Array);
      expect(response.body.pendingCount).toBeGreaterThan(0);

      const testContractorData = response.body.contractors.find(
        (c: any) => c.id === testContractor.id
      );

      expect(testContractorData).toBeDefined();
      expect(testContractorData.active).toBe(false);
      expect(testContractorData.type).toBe(BuyerType.CONTRACTOR);
      expect(testContractorData.contactInfo.contactEmail).toBe('admin@testcontractor.com');
    });

    it('should approve contractor registration', async () => {
      // Update contractor status to active
      const response = await request(app)
        .put(`/api/admin/buyers/${testContractor.id}`)
        .send({ active: true })
        .expect(200);

      expect(response.body.buyer.active).toBe(true);

      // Verify in database
      const updatedContractor = await prisma.buyer.findUnique({
        where: { id: testContractor.id }
      });

      expect(updatedContractor?.active).toBe(true);
    });

    it('should reject contractor registration with reason', async () => {
      const rejectionReason = 'Incomplete documentation provided';

      const response = await request(app)
        .delete(`/api/admin/buyers/${testContractor.id}`)
        .send({ reason: rejectionReason })
        .expect(200);

      expect(response.body.message).toContain('rejected');

      // Verify contractor is removed from database
      const deletedContractor = await prisma.buyer.findUnique({
        where: { id: testContractor.id }
      });

      expect(deletedContractor).toBeNull();
    });

    it('should handle bulk contractor approvals', async () => {
      // Create additional test contractors
      const additionalContractors = await Promise.all([
        prisma.buyer.create({
          data: {
            name: 'Admin Test Contractor 2',
            type: BuyerType.CONTRACTOR,
            apiUrl: 'https://test2.com',
            authConfig: JSON.stringify({ contactEmail: 'test2@contractor.com' }),
            active: false
          }
        }),
        prisma.buyer.create({
          data: {
            name: 'Admin Test Contractor 3',
            type: BuyerType.CONTRACTOR,
            apiUrl: 'https://test3.com',
            authConfig: JSON.stringify({ contactEmail: 'test3@contractor.com' }),
            active: false
          }
        })
      ]);

      const contractorIds = [testContractor.id, ...additionalContractors.map(c => c.id)];

      const response = await request(app)
        .post('/api/admin/buyers/bulk-approve')
        .send({ buyerIds: contractorIds })
        .expect(200);

      expect(response.body.approved).toBe(contractorIds.length);

      // Verify all are now active
      const approvedContractors = await prisma.buyer.findMany({
        where: {
          id: { in: contractorIds },
          active: true
        }
      });

      expect(approvedContractors).toHaveLength(contractorIds.length);
    });
  });

  describe('Service Zone Management', () => {
    beforeEach(async () => {
      // Activate test contractor for service zone tests
      await prisma.buyer.update({
        where: { id: testContractor.id },
        data: { active: true }
      });

      // Create service configuration
      await prisma.buyerServiceConfig.create({
        data: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id,
          pingTemplate: JSON.stringify({ template: 'ping' }),
          postTemplate: JSON.stringify({ template: 'post' }),
          fieldMappings: JSON.stringify({ mapping: 'standard' }),
          minBid: 25.00,
          maxBid: 150.00,
          active: true
        }
      });
    });

    it('should assign service zones to contractor', async () => {
      const zipCodes = ['90210', '90211', '90212'];

      const response = await request(app)
        .post(`/api/admin/buyers/${testContractor.id}/zip-codes`)
        .send({
          serviceTypeId: testServiceType.id,
          zipCodes: zipCodes.map(zip => ({
            zipCode: zip,
            priority: 100,
            maxLeadsPerDay: 10,
            minBid: 30.00,
            maxBid: 120.00
          }))
        })
        .expect(201);

      expect(response.body.created).toBe(zipCodes.length);

      // Verify in database
      const serviceZones = await prisma.buyerServiceZipCode.findMany({
        where: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id
        }
      });

      expect(serviceZones).toHaveLength(zipCodes.length);
      serviceZones.forEach(zone => {
        expect(zipCodes).toContain(zone.zipCode);
        expect(zone.active).toBe(true);
        expect(zone.priority).toBe(100);
      });
    });

    it('should update contractor service zone settings', async () => {
      // First create a service zone
      const serviceZone = await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id,
          zipCode: '90210',
          active: true,
          priority: 100,
          maxLeadsPerDay: 10,
          minBid: 25.00,
          maxBid: 100.00
        }
      });

      // Update settings
      const response = await request(app)
        .put(`/api/admin/service-zones/${serviceZone.id}`)
        .send({
          priority: 120,
          maxLeadsPerDay: 15,
          minBid: 35.00,
          maxBid: 150.00
        })
        .expect(200);

      expect(response.body.serviceZone.priority).toBe(120);
      expect(response.body.serviceZone.maxLeadsPerDay).toBe(15);
      expect(response.body.serviceZone.minBid).toBe(35.00);

      // Verify in database
      const updatedZone = await prisma.buyerServiceZipCode.findUnique({
        where: { id: serviceZone.id }
      });

      expect(updatedZone?.priority).toBe(120);
      expect(updatedZone?.maxLeadsPerDay).toBe(15);
    });

    it('should remove service zones from contractor', async () => {
      // Create service zones
      const serviceZones = await Promise.all([
        prisma.buyerServiceZipCode.create({
          data: {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '90210',
            active: true,
            priority: 100
          }
        }),
        prisma.buyerServiceZipCode.create({
          data: {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '90211',
            active: true,
            priority: 100
          }
        })
      ]);

      // Remove one service zone
      const response = await request(app)
        .delete(`/api/admin/service-zones/${serviceZones[0].id}`)
        .expect(200);

      expect(response.body.message).toContain('deleted');

      // Verify deletion
      const remainingZones = await prisma.buyerServiceZipCode.findMany({
        where: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id
        }
      });

      expect(remainingZones).toHaveLength(1);
      expect(remainingZones[0].id).toBe(serviceZones[1].id);
    });

    it('should provide service coverage analytics', async () => {
      // Create service zones for analytics
      await Promise.all([
        prisma.buyerServiceZipCode.create({
          data: {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '90210',
            active: true,
            priority: 100
          }
        }),
        prisma.buyerServiceZipCode.create({
          data: {
            buyerId: testNetworkBuyer.id,
            serviceTypeId: testServiceType.id,
            zipCode: '90210',
            active: true,
            priority: 90
          }
        }),
        prisma.buyerServiceZipCode.create({
          data: {
            buyerId: testContractor.id,
            serviceTypeId: testServiceType.id,
            zipCode: '90211',
            active: true,
            priority: 100
          }
        })
      ]);

      const response = await request(app)
        .get('/api/admin/service-zones/analytics')
        .expect(200);

      expect(response.body.totalZipCodes).toBeGreaterThan(0);
      expect(response.body.totalBuyers).toBeGreaterThan(0);
      expect(response.body.contractorBuyers).toBeGreaterThan(0);
      expect(response.body.networkBuyers).toBeGreaterThan(0);

      // Should include coverage breakdown
      expect(response.body.coverageByService).toBeDefined();
      expect(response.body.competitionAnalysis).toBeDefined();
    });
  });

  describe('Buyer Configuration Management', () => {
    beforeEach(async () => {
      await prisma.buyer.update({
        where: { id: testContractor.id },
        data: { active: true }
      });
    });

    it('should update contractor webhook configuration', async () => {
      const newConfig = {
        apiUrl: 'https://updated-contractor.com/api/leads',
        pingTimeout: 45,
        postTimeout: 90,
        authConfig: JSON.stringify({
          contactEmail: 'updated@contractor.com',
          apiKey: 'updated-api-key',
          webhookSecret: 'new-secret'
        })
      };

      const response = await request(app)
        .put(`/api/admin/buyers/${testContractor.id}`)
        .send(newConfig)
        .expect(200);

      expect(response.body.buyer.apiUrl).toBe(newConfig.apiUrl);
      expect(response.body.buyer.pingTimeout).toBe(45);
      expect(response.body.buyer.postTimeout).toBe(90);

      // Verify auth config update
      const authConfig = JSON.parse(response.body.buyer.authConfig);
      expect(authConfig.contactEmail).toBe('updated@contractor.com');
      expect(authConfig.apiKey).toBe('updated-api-key');
    });

    it('should test contractor webhook connectivity', async () => {
      // Mock successful webhook test
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'success', message: 'Webhook test successful' })
      });
      global.fetch = mockFetch;

      const response = await request(app)
        .post(`/api/admin/buyers/${testContractor.id}/test-webhook`)
        .send({
          testType: 'ping',
          testPayload: {
            leadId: 'test-lead-123',
            serviceType: 'test-service',
            zipCode: '90210'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.statusCode).toBe(200);
      expect(response.body.responseTime).toBeDefined();

      // Verify test request was made
      expect(mockFetch).toHaveBeenCalledWith(
        testContractor.apiUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle webhook test failures gracefully', async () => {
      // Mock webhook failure
      const mockFetch = jest.fn().mockRejectedValue(new Error('Connection timeout'));
      global.fetch = mockFetch;

      const response = await request(app)
        .post(`/api/admin/buyers/${testContractor.id}/test-webhook`)
        .send({
          testType: 'ping',
          testPayload: { leadId: 'test-lead-456' }
        })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Connection timeout');
    });

    it('should manage contractor service configurations', async () => {
      const serviceConfig = {
        serviceTypeId: testServiceType.id,
        pingTemplate: JSON.stringify({
          template: 'contractor-ping-v2',
          includeCompliance: true
        }),
        postTemplate: JSON.stringify({
          template: 'contractor-post-v2',
          includeAuctionData: true
        }),
        fieldMappings: JSON.stringify({
          leadId: 'lead_id',
          customerName: 'customer_name',
          customerEmail: 'customer_email'
        }),
        requiresTrustedForm: true,
        requiresJornaya: false,
        minBid: 35.00,
        maxBid: 175.00
      };

      const response = await request(app)
        .post(`/api/admin/buyers/${testContractor.id}/service-configs`)
        .send(serviceConfig)
        .expect(201);

      expect(response.body.serviceConfig.serviceTypeId).toBe(testServiceType.id);
      expect(response.body.serviceConfig.requiresTrustedForm).toBe(true);
      expect(response.body.serviceConfig.minBid).toBe(35.00);
      expect(response.body.serviceConfig.maxBid).toBe(175.00);

      // Verify in database
      const dbConfig = await prisma.buyerServiceConfig.findFirst({
        where: {
          buyerId: testContractor.id,
          serviceTypeId: testServiceType.id
        }
      });

      expect(dbConfig).not.toBeNull();
      expect(dbConfig!.requiresTrustedForm).toBe(true);
      expect(dbConfig!.minBid).toBe(35.00);
    });
  });

  describe('Performance and Monitoring', () => {
    it('should provide contractor performance metrics', async () => {
      // Create some test transaction data
      const testLead = await prisma.lead.create({
        data: {
          serviceTypeId: testServiceType.id,
          formData: JSON.stringify({ test: 'data' }),
          zipCode: '90210',
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'COMPLETED',
          winningBuyerId: testContractor.id,
          winningBid: 75.00
        }
      });

      await Promise.all([
        prisma.transaction.create({
          data: {
            leadId: testLead.id,
            buyerId: testContractor.id,
            actionType: 'PING',
            payload: JSON.stringify({ test: 'ping' }),
            response: JSON.stringify({ bidAmount: 75.00, interested: true }),
            status: 'SUCCESS',
            bidAmount: 75.00,
            responseTime: 1250
          }
        }),
        prisma.transaction.create({
          data: {
            leadId: testLead.id,
            buyerId: testContractor.id,
            actionType: 'POST',
            payload: JSON.stringify({ test: 'post' }),
            response: JSON.stringify({ received: true }),
            status: 'SUCCESS',
            responseTime: 850
          }
        })
      ]);

      const response = await request(app)
        .get(`/api/admin/buyers/${testContractor.id}/metrics`)
        .expect(200);

      expect(response.body.buyer.id).toBe(testContractor.id);
      expect(response.body.metrics.totalTransactions).toBeGreaterThan(0);
      expect(response.body.metrics.successRate).toBeGreaterThan(0);
      expect(response.body.metrics.averageResponseTime).toBeGreaterThan(0);
      expect(response.body.metrics.totalWins).toBe(1);
      expect(response.body.metrics.averageBidAmount).toBe(75.00);
    });

    it('should provide system-wide contractor analytics', async () => {
      const response = await request(app)
        .get('/api/admin/analytics')
        .expect(200);

      expect(response.body.totalBuyers).toBeGreaterThan(0);
      expect(response.body.contractorCount).toBeGreaterThan(0);
      expect(response.body.networkCount).toBeGreaterThan(0);
      expect(response.body.activeContractors).toBeDefined();
      expect(response.body.pendingContractors).toBeDefined();
    });

    it('should handle admin dashboard data efficiently', async () => {
      const startTime = process.hrtime.bigint();

      const response = await request(app)
        .get('/api/admin/dashboard')
        .expect(200);

      const queryTime = Number(process.hrtime.bigint() - startTime) / 1000000;

      // Dashboard should load quickly
      expect(queryTime).toBeLessThan(2000); // Under 2 seconds

      // Should include key metrics
      expect(response.body.summary).toBeDefined();
      expect(response.body.recentActivity).toBeDefined();
      expect(response.body.performanceMetrics).toBeDefined();
    });
  });

  describe('Data Export and Reporting', () => {
    it('should export contractor data in CSV format', async () => {
      const response = await request(app)
        .get('/api/admin/buyers/export?format=csv&type=CONTRACTOR')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');

      // Should contain CSV data
      const csvContent = response.text;
      expect(csvContent).toContain('Name,Type,Email,Phone,Status,Created');
      expect(csvContent).toContain(testContractor.name);
    });

    it('should export transaction reports', async () => {
      // Create test transaction
      const testLead = await prisma.lead.create({
        data: {
          serviceTypeId: testServiceType.id,
          formData: JSON.stringify({ test: 'data' }),
          zipCode: '90210',
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'COMPLETED'
        }
      });

      await prisma.transaction.create({
        data: {
          leadId: testLead.id,
          buyerId: testContractor.id,
          actionType: 'PING',
          payload: JSON.stringify({ test: 'ping' }),
          status: 'SUCCESS',
          bidAmount: 65.00,
          responseTime: 1100
        }
      });

      const response = await request(app)
        .get('/api/admin/transactions/export?format=json&buyerId=' + testContractor.id)
        .expect(200);

      expect(response.body.transactions).toBeInstanceOf(Array);
      expect(response.body.transactions.length).toBeGreaterThan(0);
      expect(response.body.transactions[0].buyerId).toBe(testContractor.id);
      expect(response.body.summary).toBeDefined();
    });
  });
});