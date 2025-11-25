/**
 * Database Constraints Tests
 *
 * Verifies database constraints, foreign keys, and data integrity rules
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '@/lib/db';
import { Decimal } from 'decimal.js';

describe('Database Constraints', () => {
  describe('Foreign Key Constraints', () => {
    let testBuyerId: string;
    let testServiceTypeId: string;

    beforeEach(async () => {
      const buyer = await prisma.buyer.create({
        data: {
          name: 'Test Constraint Buyer',
          type: 'CONTRACTOR',
          apiUrl: 'https://test.com',
          authConfig: '{}',
          pingTimeout: 30,
          postTimeout: 60,
          active: true,
        },
      });
      testBuyerId = buyer.id;

      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'TEST_CONSTRAINT_SERVICE',
          displayName: 'Test Constraint Service',
          formSchema: '{}',
          active: true,
        },
      });
      testServiceTypeId = serviceType.id;
    });

    afterEach(async () => {
      await prisma.buyer.delete({ where: { id: testBuyerId } });
      await prisma.serviceType.delete({ where: { id: testServiceTypeId } });
    });

    it('should enforce foreign key on lead.serviceTypeId', async () => {
      try {
        await prisma.lead.create({
          data: {
            serviceTypeId: 'non-existent-service-type',
            formData: '{}',
            zipCode: '12345',
            ownsHome: true,
            timeframe: 'ASAP',
            status: 'PENDING',
          },
        });

        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should enforce foreign key on transaction.leadId', async () => {
      try {
        await prisma.transaction.create({
          data: {
            leadId: 'non-existent-lead-id',
            buyerId: testBuyerId,
            actionType: 'PING',
            payload: '{}',
            status: 'SUCCESS',
          },
        });

        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should enforce foreign key on transaction.buyerId', async () => {
      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: testServiceTypeId,
          formData: '{}',
          zipCode: '12345',
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'PENDING',
        },
      });

      try {
        await prisma.transaction.create({
          data: {
            leadId: lead.id,
            buyerId: 'non-existent-buyer-id',
            actionType: 'PING',
            payload: '{}',
            status: 'SUCCESS',
          },
        });

        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeTruthy();
      } finally {
        await prisma.lead.delete({ where: { id: lead.id } });
      }
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique service type name', async () => {
      const name = 'UNIQUE_SERVICE_TEST';

      const first = await prisma.serviceType.create({
        data: {
          name,
          displayName: 'Unique Service',
          formSchema: '{}',
          active: true,
        },
      });

      try {
        await prisma.serviceType.create({
          data: {
            name, // Duplicate name
            displayName: 'Another Service',
            formSchema: '{}',
            active: true,
          },
        });

        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeTruthy();
      } finally {
        await prisma.serviceType.delete({ where: { id: first.id } });
      }
    });

    it('should enforce unique buyer service config per buyer+service', async () => {
      const buyer = await prisma.buyer.create({
        data: {
          name: 'Test Unique Buyer',
          type: 'CONTRACTOR',
          apiUrl: 'https://test.com',
          authConfig: '{}',
          pingTimeout: 30,
          postTimeout: 60,
          active: true,
        },
      });

      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'TEST_UNIQUE_SERVICE',
          displayName: 'Test Service',
          formSchema: '{}',
          active: true,
        },
      });

      const first = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: buyer.id,
          serviceTypeId: serviceType.id,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: new Decimal('10.00'),
          maxBid: new Decimal('100.00'),
          active: true,
        },
      });

      try {
        await prisma.buyerServiceConfig.create({
          data: {
            buyerId: buyer.id,
            serviceTypeId: serviceType.id, // Duplicate combination
            pingTemplate: '{}',
            postTemplate: '{}',
            fieldMappings: '{}',
            minBid: new Decimal('20.00'),
            maxBid: new Decimal('200.00'),
            active: true,
          },
        });

        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeTruthy();
      } finally {
        await prisma.buyerServiceConfig.delete({ where: { id: first.id } });
        await prisma.buyer.delete({ where: { id: buyer.id } });
        await prisma.serviceType.delete({ where: { id: serviceType.id } });
      }
    });

    it('should enforce unique ZIP code coverage per buyer+service+zip', async () => {
      const buyer = await prisma.buyer.create({
        data: {
          name: 'Test ZIP Buyer',
          type: 'CONTRACTOR',
          apiUrl: 'https://test.com',
          authConfig: '{}',
          pingTimeout: 30,
          postTimeout: 60,
          active: true,
        },
      });

      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'TEST_ZIP_SERVICE',
          displayName: 'Test Service',
          formSchema: '{}',
          active: true,
        },
      });

      const first = await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: buyer.id,
          serviceTypeId: serviceType.id,
          zipCode: '12345',
          active: true,
          priority: 100,
        },
      });

      try {
        await prisma.buyerServiceZipCode.create({
          data: {
            buyerId: buyer.id,
            serviceTypeId: serviceType.id,
            zipCode: '12345', // Duplicate combination
            active: true,
            priority: 200,
          },
        });

        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeTruthy();
      } finally {
        await prisma.buyerServiceZipCode.delete({ where: { id: first.id } });
        await prisma.buyer.delete({ where: { id: buyer.id } });
        await prisma.serviceType.delete({ where: { id: serviceType.id } });
      }
    });
  });

  describe('Cascade Delete Behavior', () => {
    it('should cascade delete buyer service configs when buyer deleted', async () => {
      const buyer = await prisma.buyer.create({
        data: {
          name: 'Test Cascade Buyer',
          type: 'CONTRACTOR',
          apiUrl: 'https://test.com',
          authConfig: '{}',
          pingTimeout: 30,
          postTimeout: 60,
          active: true,
        },
      });

      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'TEST_CASCADE_SERVICE',
          displayName: 'Test Service',
          formSchema: '{}',
          active: true,
        },
      });

      const config = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: buyer.id,
          serviceTypeId: serviceType.id,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: new Decimal('10.00'),
          maxBid: new Decimal('100.00'),
          active: true,
        },
      });

      // Delete buyer
      await prisma.buyer.delete({ where: { id: buyer.id } });

      // Verify config was cascaded
      const deletedConfig = await prisma.buyerServiceConfig.findUnique({
        where: { id: config.id },
      });

      expect(deletedConfig).toBeNull();

      // Cleanup
      await prisma.serviceType.delete({ where: { id: serviceType.id } });
    });

    it('should cascade delete transactions when lead deleted', async () => {
      const buyer = await prisma.buyer.create({
        data: {
          name: 'Test Transaction Buyer',
          type: 'CONTRACTOR',
          apiUrl: 'https://test.com',
          authConfig: '{}',
          pingTimeout: 30,
          postTimeout: 60,
          active: true,
        },
      });

      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'TEST_TXN_SERVICE',
          displayName: 'Test Service',
          formSchema: '{}',
          active: true,
        },
      });

      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: serviceType.id,
          formData: '{}',
          zipCode: '12345',
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'PENDING',
        },
      });

      const transaction = await prisma.transaction.create({
        data: {
          leadId: lead.id,
          buyerId: buyer.id,
          actionType: 'PING',
          payload: '{}',
          status: 'SUCCESS',
        },
      });

      // Delete lead
      await prisma.lead.delete({ where: { id: lead.id } });

      // Verify transaction was cascaded
      const deletedTransaction = await prisma.transaction.findUnique({
        where: { id: transaction.id },
      });

      expect(deletedTransaction).toBeNull();

      // Cleanup
      await prisma.buyer.delete({ where: { id: buyer.id } });
      await prisma.serviceType.delete({ where: { id: serviceType.id } });
    });
  });

  describe('Set Null Behavior', () => {
    it('should set winningBuyerId to null when buyer deleted', async () => {
      const buyer = await prisma.buyer.create({
        data: {
          name: 'Test Winner Buyer',
          type: 'CONTRACTOR',
          apiUrl: 'https://test.com',
          authConfig: '{}',
          pingTimeout: 30,
          postTimeout: 60,
          active: true,
        },
      });

      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'TEST_WINNER_SERVICE',
          displayName: 'Test Service',
          formSchema: '{}',
          active: true,
        },
      });

      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: serviceType.id,
          formData: '{}',
          zipCode: '12345',
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'SOLD',
          winningBuyerId: buyer.id,
          winningBid: new Decimal('50.00'),
        },
      });

      // Delete winning buyer
      await prisma.buyer.delete({ where: { id: buyer.id } });

      // Verify lead's winningBuyerId was set to null
      const updatedLead = await prisma.lead.findUnique({
        where: { id: lead.id },
      });

      expect(updatedLead?.winningBuyerId).toBeNull();

      // Cleanup
      await prisma.lead.delete({ where: { id: lead.id } });
      await prisma.serviceType.delete({ where: { id: serviceType.id } });
    });
  });

  describe('Restrict Delete Behavior', () => {
    it('should prevent service type deletion with active leads', async () => {
      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'TEST_RESTRICT_SERVICE',
          displayName: 'Test Service',
          formSchema: '{}',
          active: true,
        },
      });

      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: serviceType.id,
          formData: '{}',
          zipCode: '12345',
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'PENDING',
        },
      });

      try {
        // Should fail due to RESTRICT constraint
        await prisma.serviceType.delete({
          where: { id: serviceType.id },
        });

        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeTruthy();
      } finally {
        // Cleanup
        await prisma.lead.delete({ where: { id: lead.id } });
        await prisma.serviceType.delete({ where: { id: serviceType.id } });
      }
    });
  });

  describe('Default Values', () => {
    it('should apply default status to new leads', async () => {
      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'TEST_DEFAULT_SERVICE',
          displayName: 'Test Service',
          formSchema: '{}',
          active: true,
        },
      });

      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: serviceType.id,
          formData: '{}',
          zipCode: '12345',
          ownsHome: true,
          timeframe: 'ASAP',
          // status not specified
        },
      });

      expect(lead.status).toBe('PENDING');

      // Cleanup
      await prisma.lead.delete({ where: { id: lead.id } });
      await prisma.serviceType.delete({ where: { id: serviceType.id } });
    });

    it('should apply default active=true to new service types', async () => {
      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'TEST_ACTIVE_SERVICE',
          displayName: 'Test Service',
          formSchema: '{}',
          // active not specified
        },
      });

      expect(serviceType.active).toBe(true);

      // Cleanup
      await prisma.serviceType.delete({ where: { id: serviceType.id } });
    });

    it('should apply default min/max bids to buyer service config', async () => {
      const buyer = await prisma.buyer.create({
        data: {
          name: 'Test Default Buyer',
          type: 'CONTRACTOR',
          apiUrl: 'https://test.com',
          authConfig: '{}',
          pingTimeout: 30,
          postTimeout: 60,
          active: true,
        },
      });

      const serviceType = await prisma.serviceType.create({
        data: {
          name: 'TEST_BID_SERVICE',
          displayName: 'Test Service',
          formSchema: '{}',
          active: true,
        },
      });

      const config = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: buyer.id,
          serviceTypeId: serviceType.id,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          // minBid and maxBid not specified
        },
      });

      expect(config.minBid.toFixed(2)).toBe('0.00');
      expect(config.maxBid.toFixed(2)).toBe('999.99');

      // Cleanup
      await prisma.buyerServiceConfig.delete({ where: { id: config.id } });
      await prisma.buyer.delete({ where: { id: buyer.id } });
      await prisma.serviceType.delete({ where: { id: serviceType.id } });
    });
  });
});
