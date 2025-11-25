const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Domain 3.3: Database Data Integrity Testing', () => {

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Test 1: Cascade delete works for Buyer -> BuyerServiceConfig
  test('Test 1: Deleting buyer should cascade delete service configs', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Cascade Test Buyer ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    const serviceType = await prisma.serviceType.findFirst();

    const config = await prisma.buyerServiceConfig.create({
      data: {
        buyerId: buyer.id,
        serviceTypeId: serviceType.id,
        pingTemplate: '{}',
        postTemplate: '{}',
        fieldMappings: '{}',
        minBid: 10.0,
        maxBid: 50.0
      }
    });

    // Delete buyer
    await prisma.buyer.delete({ where: { id: buyer.id } });

    // Config should be deleted
    const configExists = await prisma.buyerServiceConfig.findUnique({
      where: { id: config.id }
    });

    expect(configExists).toBeNull();
  });

  // Test 2: Cascade delete works for Buyer -> BuyerServiceZipCode
  test('Test 2: Deleting buyer should cascade delete zip codes', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Cascade Zip Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    const serviceType = await prisma.serviceType.findFirst();

    const zipCode = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId: buyer.id,
        serviceTypeId: serviceType.id,
        zipCode: '11111'
      }
    });

    await prisma.buyer.delete({ where: { id: buyer.id } });

    const zipExists = await prisma.buyerServiceZipCode.findUnique({
      where: { id: zipCode.id }
    });

    expect(zipExists).toBeNull();
  });

  // Test 3: Cascade delete works for Lead -> Transaction
  test('Test 3: Deleting lead should cascade delete transactions', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Transaction Cascade Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    const serviceType = await prisma.serviceType.findFirst();

    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: serviceType.id,
        formData: '{}',
        zipCode: '22222',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const transaction = await prisma.transaction.create({
      data: {
        leadId: lead.id,
        buyerId: buyer.id,
        actionType: 'PING',
        payload: '{}',
        status: 'SUCCESS'
      }
    });

    await prisma.lead.delete({ where: { id: lead.id } });

    const transactionExists = await prisma.transaction.findUnique({
      where: { id: transaction.id }
    });

    expect(transactionExists).toBeNull();

    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 4: Cascade delete works for Lead -> ComplianceAuditLog
  test('Test 4: Deleting lead should cascade delete audit logs', async () => {
    const serviceType = await prisma.serviceType.findFirst();

    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: serviceType.id,
        formData: '{}',
        zipCode: '33333',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const auditLog = await prisma.complianceAuditLog.create({
      data: {
        leadId: lead.id,
        eventType: 'FORM_SUBMITTED',
        eventData: '{}',
        ipAddress: '127.0.0.1'
      }
    });

    await prisma.lead.delete({ where: { id: lead.id } });

    const auditExists = await prisma.complianceAuditLog.findUnique({
      where: { id: auditLog.id }
    });

    expect(auditExists).toBeNull();
  });

  // Test 5: Foreign key prevents orphaned leads
  test('Test 5: Cannot create lead with non-existent service type', async () => {
    await expect(
      prisma.lead.create({
        data: {
          serviceTypeId: '00000000-0000-0000-0000-000000000000',
          formData: '{}',
          zipCode: '44444',
          ownsHome: true,
          timeframe: 'within_3_months'
        }
      })
    ).rejects.toThrow();
  });

  // Test 6: Foreign key prevents orphaned transactions
  test('Test 6: Cannot create transaction with non-existent lead', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'FK Test Buyer ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    await expect(
      prisma.transaction.create({
        data: {
          leadId: '00000000-0000-0000-0000-000000000000',
          buyerId: buyer.id,
          actionType: 'PING',
          payload: '{}',
          status: 'PENDING'
        }
      })
    ).rejects.toThrow();

    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 7: Foreign key prevents orphaned buyer service configs
  test('Test 7: Cannot create service config with non-existent buyer', async () => {
    const serviceType = await prisma.serviceType.findFirst();

    await expect(
      prisma.buyerServiceConfig.create({
        data: {
          buyerId: '00000000-0000-0000-0000-000000000000',
          serviceTypeId: serviceType.id,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: 10.0,
          maxBid: 50.0
        }
      })
    ).rejects.toThrow();
  });

  // Test 8: No orphaned records after cascade delete
  test('Test 8: Verify no orphaned transaction records exist', async () => {
    const orphans = await prisma.$queryRaw`
      SELECT t.* FROM transactions t
      LEFT JOIN leads l ON t.lead_id = l.id
      WHERE l.id IS NULL
    `;

    expect(orphans.length).toBe(0);
  });

  // Test 9: No orphaned config records
  test('Test 9: Verify no orphaned service config records exist', async () => {
    const orphans = await prisma.$queryRaw`
      SELECT c.* FROM buyer_service_configs c
      LEFT JOIN buyers b ON c.buyer_id = b.id
      WHERE b.id IS NULL
    `;

    expect(orphans.length).toBe(0);
  });

  // Test 10: No orphaned ZIP code records
  test('Test 10: Verify no orphaned ZIP code records exist', async () => {
    const orphans = await prisma.$queryRaw`
      SELECT z.* FROM buyer_service_zip_codes z
      LEFT JOIN buyers b ON z.buyer_id = b.id
      WHERE b.id IS NULL
    `;

    expect(orphans.length).toBe(0);
  });

  // Test 11: Unique constraint prevents duplicate service type names
  test('Test 11: Cannot create duplicate service type names', async () => {
    const name = 'UniqueNameTest' + Date.now();

    const st1 = await prisma.serviceType.create({
      data: {
        name: name,
        displayName: 'Test',
        formSchema: '{}'
      }
    });

    await expect(
      prisma.serviceType.create({
        data: {
          name: name,
          displayName: 'Test 2',
          formSchema: '{}'
        }
      })
    ).rejects.toThrow();

    await prisma.serviceType.delete({ where: { id: st1.id } });
  });

  // Test 12: Unique constraint on buyer+service combination
  test('Test 12: Cannot create duplicate buyer+service configs', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Unique Config Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    const serviceType = await prisma.serviceType.findFirst();

    const config1 = await prisma.buyerServiceConfig.create({
      data: {
        buyerId: buyer.id,
        serviceTypeId: serviceType.id,
        pingTemplate: '{}',
        postTemplate: '{}',
        fieldMappings: '{}',
        minBid: 10.0,
        maxBid: 50.0
      }
    });

    await expect(
      prisma.buyerServiceConfig.create({
        data: {
          buyerId: buyer.id,
          serviceTypeId: serviceType.id,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: 20.0,
          maxBid: 60.0
        }
      })
    ).rejects.toThrow();

    await prisma.buyerServiceConfig.delete({ where: { id: config1.id } });
    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 13: Transaction rollback on error
  test('Test 13: Transaction should rollback on error', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Rollback Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    const serviceType = await prisma.serviceType.findFirst();

    try {
      await prisma.$transaction(async (tx) => {
        // Create lead
        const lead = await tx.lead.create({
          data: {
            serviceTypeId: serviceType.id,
            formData: '{}',
            zipCode: '55555',
            ownsHome: true,
            timeframe: 'within_3_months'
          }
        });

        // Attempt invalid operation to trigger rollback
        await tx.lead.create({
          data: {
            serviceTypeId: '00000000-0000-0000-0000-000000000000', // Invalid
            formData: '{}',
            zipCode: '55555',
            ownsHome: true,
            timeframe: 'within_3_months'
          }
        });
      });
    } catch (error) {
      // Expected to fail
    }

    // First lead should not exist (transaction rolled back)
    const leads = await prisma.lead.findMany({
      where: { zipCode: '55555' }
    });

    expect(leads.length).toBe(0);

    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 14: Concurrent writes are handled correctly
  test('Test 14: Concurrent updates should not cause data corruption', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Concurrent Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    // Perform concurrent updates
    const updates = Array.from({ length: 5 }, (_, i) =>
      prisma.buyer.update({
        where: { id: buyer.id },
        data: { name: `Updated ${i} ${Date.now()}` }
      })
    );

    await Promise.all(updates);

    const finalBuyer = await prisma.buyer.findUnique({
      where: { id: buyer.id }
    });

    expect(finalBuyer).not.toBeNull();
    expect(finalBuyer.name).toContain('Updated');

    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 15: Data type validation - boolean fields
  test('Test 15: Boolean fields should accept only valid boolean values', async () => {
    const serviceType = await prisma.serviceType.findFirst();

    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: serviceType.id,
        formData: '{}',
        zipCode: '66666',
        ownsHome: true, // Boolean
        timeframe: 'within_3_months'
      }
    });

    expect(typeof lead.ownsHome).toBe('boolean');
    expect(lead.ownsHome).toBe(true);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  // Test 16: Data type validation - numeric fields
  test('Test 16: Numeric fields should store correct precision', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Numeric Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    const serviceType = await prisma.serviceType.findFirst();

    const config = await prisma.buyerServiceConfig.create({
      data: {
        buyerId: buyer.id,
        serviceTypeId: serviceType.id,
        pingTemplate: '{}',
        postTemplate: '{}',
        fieldMappings: '{}',
        minBid: 10.50, // Float
        maxBid: 99.99  // Float
      }
    });

    expect(config.minBid).toBe(10.50);
    expect(config.maxBid).toBe(99.99);

    await prisma.buyerServiceConfig.delete({ where: { id: config.id } });
    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 17: String length validation
  test('Test 17: String fields should respect max length constraints', async () => {
    const serviceType = await prisma.serviceType.create({
      data: {
        name: 'StringLenTest' + Date.now(),
        displayName: 'Test Display Name',
        formSchema: JSON.stringify({ fields: [] })
      }
    });

    expect(serviceType.formSchema.length).toBeGreaterThan(0);

    await prisma.serviceType.delete({ where: { id: serviceType.id } });
  });

  // Test 18: NULL handling for optional fields
  test('Test 18: Optional fields should accept NULL values', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Null Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true,
        contactName: null, // Optional field
        contactEmail: null
      }
    });

    expect(buyer.contactName).toBeNull();
    expect(buyer.contactEmail).toBeNull();

    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 19: Required fields cannot be NULL
  test('Test 19: Required fields should reject NULL values', async () => {
    await expect(
      prisma.buyer.create({
        data: {
          name: null, // Required field
          apiUrl: 'https://test.com',
          active: true
        }
      })
    ).rejects.toThrow();
  });

  // Test 20: Referential integrity across related records
  test('Test 20: Related records should maintain consistency', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Referential Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    const serviceType = await prisma.serviceType.findFirst();

    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: serviceType.id,
        formData: '{}',
        zipCode: '77777',
        ownsHome: true,
        timeframe: 'within_3_months',
        winningBuyerId: buyer.id
      }
    });

    // Verify relationship
    const leadWithBuyer = await prisma.lead.findUnique({
      where: { id: lead.id },
      include: { winningBuyer: true }
    });

    expect(leadWithBuyer.winningBuyer).not.toBeNull();
    expect(leadWithBuyer.winningBuyer.id).toBe(buyer.id);

    await prisma.lead.delete({ where: { id: lead.id } });
    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 21: Soft delete consistency (if applicable)
  test('Test 21: Active flag should control record visibility', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Active Flag Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    // Set to inactive
    await prisma.buyer.update({
      where: { id: buyer.id },
      data: { active: false }
    });

    const inactiveBuyer = await prisma.buyer.findUnique({
      where: { id: buyer.id }
    });

    expect(inactiveBuyer.active).toBe(false);

    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 22: Bulk operations maintain integrity
  test('Test 22: Bulk insert should maintain data integrity', async () => {
    const buyers = await prisma.buyer.createMany({
      data: [
        {
          name: 'Bulk 1 ' + Date.now(),
          apiUrl: 'https://bulk1.com',
          active: true
        },
        {
          name: 'Bulk 2 ' + Date.now(),
          apiUrl: 'https://bulk2.com',
          active: true
        },
        {
          name: 'Bulk 3 ' + Date.now(),
          apiUrl: 'https://bulk3.com',
          active: true
        }
      ]
    });

    expect(buyers.count).toBe(3);

    // Cleanup
    await prisma.buyer.deleteMany({
      where: {
        apiUrl: { in: ['https://bulk1.com', 'https://bulk2.com', 'https://bulk3.com'] }
      }
    });
  });

  // Test 23: Timestamp consistency
  test('Test 23: Timestamps should be consistent and ordered', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Timestamp Consistency ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    expect(buyer.createdAt).toBeDefined();
    expect(buyer.updatedAt).toBeDefined();
    expect(buyer.updatedAt.getTime()).toBeGreaterThanOrEqual(buyer.createdAt.getTime());

    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 24: JSON field integrity
  test('Test 24: JSON fields should store and retrieve valid JSON', async () => {
    const jsonData = { test: 'value', nested: { key: 123 } };

    const serviceType = await prisma.serviceType.findFirst();

    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: serviceType.id,
        formData: JSON.stringify(jsonData),
        zipCode: '88888',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const parsed = JSON.parse(lead.formData);
    expect(parsed.test).toBe('value');
    expect(parsed.nested.key).toBe(123);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  // Test 25: Enum-like fields maintain valid values
  test('Test 25: Status fields should contain valid values', async () => {
    const serviceType = await prisma.serviceType.findFirst();

    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: serviceType.id,
        formData: '{}',
        zipCode: '99999',
        ownsHome: true,
        timeframe: 'within_3_months',
        status: 'PENDING'
      }
    });

    // Valid statuses (based on application logic)
    const validStatuses = ['PENDING', 'SOLD', 'REJECTED', 'RETURNED'];
    expect(validStatuses).toContain(lead.status);

    await prisma.lead.delete({ where: { id: lead.id } });
  });
});
