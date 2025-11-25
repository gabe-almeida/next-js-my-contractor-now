const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Domain 3.1: Database Schema Validation', () => {

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Test 1: All required tables exist
  test('Test 1: All required tables should exist in database', async () => {
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'
    `;

    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('service_types');
    expect(tableNames).toContain('buyers');
    expect(tableNames).toContain('buyer_service_configs');
    expect(tableNames).toContain('leads');
    expect(tableNames).toContain('transactions');
    expect(tableNames).toContain('compliance_audit_log');
    expect(tableNames).toContain('buyer_service_zip_codes');
    expect(tableNames).toContain('zip_code_metadata');
  });

  // Test 2: ServiceType table structure
  test('Test 2: ServiceType table should have correct columns', async () => {
    const columns = await prisma.$queryRaw`PRAGMA table_info(service_types)`;
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('display_name');
    expect(columnNames).toContain('form_schema');
    expect(columnNames).toContain('active');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
  });

  // Test 3: Buyer table structure
  test('Test 3: Buyer table should have correct columns', async () => {
    const columns = await prisma.$queryRaw`PRAGMA table_info(buyers)`;
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('type');
    expect(columnNames).toContain('api_url');
    expect(columnNames).toContain('auth_config');
    expect(columnNames).toContain('ping_timeout');
    expect(columnNames).toContain('post_timeout');
    expect(columnNames).toContain('active');
    expect(columnNames).toContain('contact_name');
    expect(columnNames).toContain('contact_email');
    expect(columnNames).toContain('contact_phone');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
  });

  // Test 4: Lead table structure
  test('Test 4: Lead table should have correct columns', async () => {
    const columns = await prisma.$queryRaw`PRAGMA table_info(leads)`;
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('service_type_id');
    expect(columnNames).toContain('form_data');
    expect(columnNames).toContain('zip_code');
    expect(columnNames).toContain('owns_home');
    expect(columnNames).toContain('timeframe');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('winning_buyer_id');
    expect(columnNames).toContain('winning_bid');
    expect(columnNames).toContain('trusted_form_cert_url');
    expect(columnNames).toContain('jornaya_lead_id');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
  });

  // Test 5: Transaction table structure
  test('Test 5: Transaction table should have correct columns', async () => {
    const columns = await prisma.$queryRaw`PRAGMA table_info(transactions)`;
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('lead_id');
    expect(columnNames).toContain('buyer_id');
    expect(columnNames).toContain('action_type');
    expect(columnNames).toContain('payload');
    expect(columnNames).toContain('response');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('bid_amount');
    expect(columnNames).toContain('response_time');
    expect(columnNames).toContain('created_at');
  });

  // Test 6: Indexes exist on Lead table
  test('Test 6: Lead table should have required indexes', async () => {
    const indexes = await prisma.$queryRaw`PRAGMA index_list(leads)`;
    const indexNames = indexes.map(i => i.name);

    // Check that indexes exist (names may vary)
    expect(indexes.length).toBeGreaterThan(0);
  });

  // Test 7: Indexes exist on Transaction table
  test('Test 7: Transaction table should have required indexes', async () => {
    const indexes = await prisma.$queryRaw`PRAGMA index_list(transactions)`;

    expect(indexes.length).toBeGreaterThan(0);
  });

  // Test 8: Foreign keys are defined
  test('Test 8: Foreign key constraints should be defined', async () => {
    const fks = await prisma.$queryRaw`PRAGMA foreign_key_list(leads)`;

    expect(fks.length).toBeGreaterThan(0);
  });

  // Test 9: Unique constraint on ServiceType name
  test('Test 9: ServiceType name should have unique constraint', async () => {
    const serviceType1 = await prisma.serviceType.create({
      data: {
        name: 'UniqueTest' + Date.now(),
        displayName: 'Unique Test',
        formSchema: '{}',
        active: true
      }
    });

    // Attempt to create duplicate should fail
    await expect(
      prisma.serviceType.create({
        data: {
          name: serviceType1.name,
          displayName: 'Duplicate',
          formSchema: '{}',
          active: true
        }
      })
    ).rejects.toThrow();

    // Cleanup
    await prisma.serviceType.delete({ where: { id: serviceType1.id } });
  });

  // Test 10: Unique constraint on buyer+service+zip combination
  test('Test 10: BuyerServiceZipCode should enforce unique constraint', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Test Buyer ' + Date.now(),
        type: 'CONTRACTOR',
        apiUrl: 'https://test.com',
        active: true
      }
    });

    const serviceType = await prisma.serviceType.findFirst();

    const zipCode1 = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId: buyer.id,
        serviceTypeId: serviceType.id,
        zipCode: '12345',
        active: true
      }
    });

    // Duplicate should fail
    await expect(
      prisma.buyerServiceZipCode.create({
        data: {
          buyerId: buyer.id,
          serviceTypeId: serviceType.id,
          zipCode: '12345',
          active: true
        }
      })
    ).rejects.toThrow();

    // Cleanup
    await prisma.buyerServiceZipCode.delete({ where: { id: zipCode1.id } });
    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 11: Default values are set - ServiceType active
  test('Test 11: ServiceType active should default to true', async () => {
    const serviceType = await prisma.serviceType.create({
      data: {
        name: 'DefaultTest' + Date.now(),
        displayName: 'Default Test',
        formSchema: '{}'
      }
    });

    expect(serviceType.active).toBe(true);

    await prisma.serviceType.delete({ where: { id: serviceType.id } });
  });

  // Test 12: Default values - Buyer type
  test('Test 12: Buyer type should default to CONTRACTOR', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Default Type Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    expect(buyer.type).toBe('CONTRACTOR');

    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 13: Default values - Buyer timeouts
  test('Test 13: Buyer timeouts should have default values', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Default Timeout Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    expect(buyer.pingTimeout).toBe(30);
    expect(buyer.postTimeout).toBe(60);

    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 14: Default values - Lead status
  test('Test 14: Lead status should default to PENDING', async () => {
    const serviceType = await prisma.serviceType.findFirst();

    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: serviceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    expect(lead.status).toBe('PENDING');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  // Test 15: UUID generation works
  test('Test 15: UUID should be auto-generated for new records', async () => {
    const serviceType = await prisma.serviceType.create({
      data: {
        name: 'UUIDTest' + Date.now(),
        displayName: 'UUID Test',
        formSchema: '{}',
        active: true
      }
    });

    expect(serviceType.id).toBeDefined();
    expect(typeof serviceType.id).toBe('string');
    expect(serviceType.id.length).toBeGreaterThan(0);

    // Should match UUID v4 pattern
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidPattern.test(serviceType.id)).toBe(true);

    await prisma.serviceType.delete({ where: { id: serviceType.id } });
  });

  // Test 16: Timestamps are auto-generated
  test('Test 16: createdAt timestamp should be auto-generated', async () => {
    const beforeCreate = new Date();

    const buyer = await prisma.buyer.create({
      data: {
        name: 'Timestamp Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    const afterCreate = new Date();

    expect(buyer.createdAt).toBeDefined();
    expect(buyer.createdAt instanceof Date).toBe(true);
    expect(buyer.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime() - 1000);
    expect(buyer.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime() + 1000);

    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 17: updatedAt timestamp auto-updates
  test('Test 17: updatedAt timestamp should auto-update on modification', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'UpdatedAt Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    const originalUpdatedAt = buyer.updatedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updatedBuyer = await prisma.buyer.update({
      where: { id: buyer.id },
      data: { name: buyer.name + ' Updated' }
    });

    expect(updatedBuyer.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());

    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 18: BuyerServiceConfig table structure
  test('Test 18: BuyerServiceConfig table should have correct columns', async () => {
    const columns = await prisma.$queryRaw`PRAGMA table_info(buyer_service_configs)`;
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('buyer_id');
    expect(columnNames).toContain('service_type_id');
    expect(columnNames).toContain('ping_template');
    expect(columnNames).toContain('post_template');
    expect(columnNames).toContain('field_mappings');
    expect(columnNames).toContain('requires_trustedform');
    expect(columnNames).toContain('requires_jornaya');
    expect(columnNames).toContain('min_bid');
    expect(columnNames).toContain('max_bid');
    expect(columnNames).toContain('active');
  });

  // Test 19: ComplianceAuditLog table structure
  test('Test 19: ComplianceAuditLog table should have correct columns', async () => {
    const columns = await prisma.$queryRaw`PRAGMA table_info(compliance_audit_log)`;
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('lead_id');
    expect(columnNames).toContain('event_type');
    expect(columnNames).toContain('event_data');
    expect(columnNames).toContain('ip_address');
    expect(columnNames).toContain('user_agent');
    expect(columnNames).toContain('created_at');
  });

  // Test 20: BuyerServiceZipCode table structure
  test('Test 20: BuyerServiceZipCode table should have correct columns', async () => {
    const columns = await prisma.$queryRaw`PRAGMA table_info(buyer_service_zip_codes)`;
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('buyer_id');
    expect(columnNames).toContain('service_type_id');
    expect(columnNames).toContain('zip_code');
    expect(columnNames).toContain('active');
    expect(columnNames).toContain('priority');
    expect(columnNames).toContain('max_leads_per_day');
    expect(columnNames).toContain('min_bid');
    expect(columnNames).toContain('max_bid');
  });

  // Test 21: ZipCodeMetadata table structure
  test('Test 21: ZipCodeMetadata table should have correct columns', async () => {
    const columns = await prisma.$queryRaw`PRAGMA table_info(zip_code_metadata)`;
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('zip_code');
    expect(columnNames).toContain('city');
    expect(columnNames).toContain('state');
    expect(columnNames).toContain('county');
    expect(columnNames).toContain('latitude');
    expect(columnNames).toContain('longitude');
    expect(columnNames).toContain('timezone');
    expect(columnNames).toContain('active');
  });

  // Test 22: Default values - BuyerServiceConfig minBid/maxBid
  test('Test 22: BuyerServiceConfig should have default bid values', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Bid Defaults Test ' + Date.now(),
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
        fieldMappings: '{}'
      }
    });

    expect(config.minBid).toBe(0.00);
    expect(config.maxBid).toBe(999.99);

    await prisma.buyerServiceConfig.delete({ where: { id: config.id } });
    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 23: Default values - Transaction compliance flags
  test('Test 23: Transaction compliance flags should default to false', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Transaction Defaults Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    const serviceType = await prisma.serviceType.findFirst();

    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: serviceType.id,
        formData: '{}',
        zipCode: '12345',
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
        status: 'PENDING'
      }
    });

    expect(transaction.complianceIncluded).toBe(false);
    expect(transaction.trustedFormPresent).toBe(false);
    expect(transaction.jornayaPresent).toBe(false);

    await prisma.transaction.delete({ where: { id: transaction.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 24: Default values - BuyerServiceZipCode priority
  test('Test 24: BuyerServiceZipCode priority should default to 100', async () => {
    const buyer = await prisma.buyer.create({
      data: {
        name: 'Priority Default Test ' + Date.now(),
        apiUrl: 'https://test.com',
        active: true
      }
    });

    const serviceType = await prisma.serviceType.findFirst();

    const zipCode = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId: buyer.id,
        serviceTypeId: serviceType.id,
        zipCode: '99999',
        active: true
      }
    });

    expect(zipCode.priority).toBe(100);

    await prisma.buyerServiceZipCode.delete({ where: { id: zipCode.id } });
    await prisma.buyer.delete({ where: { id: buyer.id } });
  });

  // Test 25: Column data types are correct
  test('Test 25: Column data types should match schema definitions', async () => {
    const columns = await prisma.$queryRaw`PRAGMA table_info(leads)`;

    // Find specific columns and verify types
    const statusColumn = columns.find(c => c.name === 'status');
    expect(statusColumn).toBeDefined();
    expect(statusColumn.type).toBe('TEXT');

    const ownsHomeColumn = columns.find(c => c.name === 'owns_home');
    expect(ownsHomeColumn).toBeDefined();
    // SQLite stores booleans as INTEGER (0/1)
    expect(['INTEGER', 'BOOLEAN']).toContain(ownsHomeColumn.type);
  });
});
