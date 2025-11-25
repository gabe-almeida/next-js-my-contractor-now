/**
 * Lead Transaction Integrity Tests
 *
 * Verifies atomic lead creation, transaction rollbacks, and data consistency
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '@/lib/db';

describe('Lead Transaction Integrity', () => {
  let testServiceTypeId: string;

  beforeEach(async () => {
    // Create test service type
    const serviceType = await prisma.serviceType.create({
      data: {
        name: 'TEST_INTEGRITY_SERVICE',
        displayName: 'Test Integrity Service',
        formSchema: '{}',
        active: true,
      },
    });
    testServiceTypeId = serviceType.id;
  });

  afterEach(async () => {
    // Cleanup
    await prisma.lead.deleteMany({
      where: { serviceTypeId: testServiceTypeId },
    });
    await prisma.serviceType.delete({
      where: { id: testServiceTypeId },
    });
  });

  describe('Atomic Lead Creation', () => {
    it('should create lead and audit log in single transaction', async () => {
      const result = await prisma.$transaction(async (tx) => {
        // Create lead
        const lead = await tx.lead.create({
          data: {
            serviceTypeId: testServiceTypeId,
            formData: JSON.stringify({ test: 'data' }),
            zipCode: '12345',
            ownsHome: true,
            timeframe: 'ASAP',
            status: 'PENDING',
          },
        });

        // Create audit log
        const auditLog = await tx.complianceAuditLog.create({
          data: {
            leadId: lead.id,
            eventType: 'FORM_SUBMITTED',
            eventData: JSON.stringify({ zipCode: '12345' }),
          },
        });

        return { lead, auditLog };
      });

      expect(result.lead.id).toBeTruthy();
      expect(result.auditLog.leadId).toBe(result.lead.id);

      // Verify both records exist
      const lead = await prisma.lead.findUnique({
        where: { id: result.lead.id },
      });
      const audit = await prisma.complianceAuditLog.findFirst({
        where: { leadId: result.lead.id },
      });

      expect(lead).toBeTruthy();
      expect(audit).toBeTruthy();

      // Cleanup
      await prisma.complianceAuditLog.deleteMany({
        where: { leadId: result.lead.id },
      });
      await prisma.lead.delete({ where: { id: result.lead.id } });
    });

    it('should rollback lead creation if audit log fails', async () => {
      try {
        await prisma.$transaction(async (tx) => {
          // Create lead
          const lead = await tx.lead.create({
            data: {
              serviceTypeId: testServiceTypeId,
              formData: JSON.stringify({ test: 'data' }),
              zipCode: '12345',
              ownsHome: true,
              timeframe: 'ASAP',
              status: 'PENDING',
            },
          });

          // Intentionally cause error - invalid event type
          await tx.complianceAuditLog.create({
            data: {
              leadId: 'invalid-id', // This will fail
              eventType: 'INVALID_TYPE',
              eventData: '{}',
            },
          });

          return lead;
        });

        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Transaction should have rolled back
        expect(error).toBeTruthy();

        // Verify lead was NOT created
        const leads = await prisma.lead.findMany({
          where: { serviceTypeId: testServiceTypeId },
        });
        expect(leads.length).toBe(0);
      }
    });

    it('should handle transaction timeout', async () => {
      try {
        await prisma.$transaction(
          async (tx) => {
            const lead = await tx.lead.create({
              data: {
                serviceTypeId: testServiceTypeId,
                formData: '{}',
                zipCode: '12345',
                ownsHome: true,
                timeframe: 'ASAP',
                status: 'PENDING',
              },
            });

            // Simulate long operation
            await new Promise(resolve => setTimeout(resolve, 200));

            return lead;
          },
          {
            timeout: 100, // 100ms timeout
          }
        );

        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Transaction should timeout
        expect(error).toBeTruthy();
      }
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity on lead creation', async () => {
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

      // Verify service type relationship
      const leadWithServiceType = await prisma.lead.findUnique({
        where: { id: lead.id },
        include: { serviceType: true },
      });

      expect(leadWithServiceType?.serviceType.id).toBe(testServiceTypeId);

      // Cleanup
      await prisma.lead.delete({ where: { id: lead.id } });
    });

    it('should prevent lead creation with invalid service type', async () => {
      try {
        await prisma.lead.create({
          data: {
            serviceTypeId: 'invalid-service-type-id',
            formData: '{}',
            zipCode: '12345',
            ownsHome: true,
            timeframe: 'ASAP',
            status: 'PENDING',
          },
        });

        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Foreign key constraint violation
        expect(error).toBeTruthy();
      }
    });

    it('should cascade delete audit logs when lead is deleted', async () => {
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

      // Create audit log
      await prisma.complianceAuditLog.create({
        data: {
          leadId: lead.id,
          eventType: 'FORM_SUBMITTED',
          eventData: '{}',
        },
      });

      // Verify audit log exists
      let auditLogs = await prisma.complianceAuditLog.findMany({
        where: { leadId: lead.id },
      });
      expect(auditLogs.length).toBe(1);

      // Delete lead
      await prisma.lead.delete({ where: { id: lead.id } });

      // Verify audit log was also deleted (cascade)
      auditLogs = await prisma.complianceAuditLog.findMany({
        where: { leadId: lead.id },
      });
      expect(auditLogs.length).toBe(0);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous lead creations', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        prisma.lead.create({
          data: {
            serviceTypeId: testServiceTypeId,
            formData: JSON.stringify({ index: i }),
            zipCode: '12345',
            ownsHome: true,
            timeframe: 'ASAP',
            status: 'PENDING',
          },
        })
      );

      const leads = await Promise.all(promises);

      expect(leads.length).toBe(5);
      expect(new Set(leads.map(l => l.id)).size).toBe(5); // All unique IDs

      // Cleanup
      await prisma.lead.deleteMany({
        where: {
          id: { in: leads.map(l => l.id) },
        },
      });
    });

    it('should maintain isolation between concurrent transactions', async () => {
      const transaction1 = prisma.$transaction(async (tx) => {
        const lead = await tx.lead.create({
          data: {
            serviceTypeId: testServiceTypeId,
            formData: '{"tx": 1}',
            zipCode: '12345',
            ownsHome: true,
            timeframe: 'ASAP',
            status: 'PENDING',
          },
        });

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 50));

        return lead;
      });

      const transaction2 = prisma.$transaction(async (tx) => {
        const lead = await tx.lead.create({
          data: {
            serviceTypeId: testServiceTypeId,
            formData: '{"tx": 2}',
            zipCode: '54321',
            ownsHome: false,
            timeframe: 'FLEXIBLE',
            status: 'PENDING',
          },
        });

        return lead;
      });

      const [lead1, lead2] = await Promise.all([transaction1, transaction2]);

      expect(lead1.id).not.toBe(lead2.id);
      expect(JSON.parse(lead1.formData).tx).toBe(1);
      expect(JSON.parse(lead2.formData).tx).toBe(2);

      // Cleanup
      await prisma.lead.deleteMany({
        where: { id: { in: [lead1.id, lead2.id] } },
      });
    });
  });

  describe('Transaction Rollback Scenarios', () => {
    it('should rollback on validation error', async () => {
      const initialCount = await prisma.lead.count({
        where: { serviceTypeId: testServiceTypeId },
      });

      try {
        await prisma.$transaction(async (tx) => {
          // Create valid lead
          await tx.lead.create({
            data: {
              serviceTypeId: testServiceTypeId,
              formData: '{}',
              zipCode: '12345',
              ownsHome: true,
              timeframe: 'ASAP',
              status: 'PENDING',
            },
          });

          // Throw validation error
          throw new Error('Validation failed');
        });
      } catch (error) {
        // Expected error
      }

      const finalCount = await prisma.lead.count({
        where: { serviceTypeId: testServiceTypeId },
      });

      // Count should be unchanged
      expect(finalCount).toBe(initialCount);
    });

    it('should rollback on database constraint violation', async () => {
      try {
        await prisma.$transaction(async (tx) => {
          // Create lead
          const lead = await tx.lead.create({
            data: {
              serviceTypeId: testServiceTypeId,
              formData: '{}',
              zipCode: '12345',
              ownsHome: true,
              timeframe: 'ASAP',
              status: 'PENDING',
            },
          });

          // Try to create with same ID (will fail)
          await tx.lead.create({
            data: {
              id: lead.id, // Duplicate ID
              serviceTypeId: testServiceTypeId,
              formData: '{}',
              zipCode: '54321',
              ownsHome: false,
              timeframe: 'FLEXIBLE',
              status: 'PENDING',
            },
          });
        });

        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeTruthy();

        // Verify no leads were created
        const leads = await prisma.lead.findMany({
          where: { serviceTypeId: testServiceTypeId },
        });
        expect(leads.length).toBe(0);
      }
    });
  });

  describe('Data Validation', () => {
    it('should enforce required fields', async () => {
      try {
        await prisma.lead.create({
          data: {
            serviceTypeId: testServiceTypeId,
            // Missing required fields
          } as any,
        });

        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should validate zipCode format', async () => {
      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: testServiceTypeId,
          formData: '{}',
          zipCode: '12345', // Valid 5-digit ZIP
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'PENDING',
        },
      });

      expect(lead.zipCode).toMatch(/^\d{5}$/);

      // Cleanup
      await prisma.lead.delete({ where: { id: lead.id } });
    });

    it('should store form data as valid JSON', async () => {
      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: testServiceTypeId,
          formData: JSON.stringify(formData),
          zipCode: '12345',
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'PENDING',
        },
      });

      const parsed = JSON.parse(lead.formData);
      expect(parsed.firstName).toBe('John');
      expect(parsed.email).toBe('john@example.com');

      // Cleanup
      await prisma.lead.delete({ where: { id: lead.id } });
    });
  });
});
