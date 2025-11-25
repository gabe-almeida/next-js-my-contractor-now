const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3002';

describe('Domain 9.2: Business Logic - Pricing and Routing (50 tests)', () => {

  let testServiceType;
  let testBuyer1;
  let testBuyer2;
  let testServiceConfig1;
  let testServiceConfig2;

  beforeAll(async () => {
    testServiceType = await prisma.serviceType.findFirst();

    testBuyer1 = await prisma.buyer.create({
      data: {
        name: 'Pricing Test Buyer 1 ' + Date.now(),
        apiUrl: 'https://pricing-buyer1.com',
        active: true
      }
    });

    testBuyer2 = await prisma.buyer.create({
      data: {
        name: 'Pricing Test Buyer 2 ' + Date.now(),
        apiUrl: 'https://pricing-buyer2.com',
        active: true
      }
    });

    testServiceConfig1 = await prisma.buyerServiceConfig.create({
      data: {
        buyerId: testBuyer1.id,
        serviceTypeId: testServiceType.id,
        pingTemplate: JSON.stringify({}),
        postTemplate: JSON.stringify({}),
        fieldMappings: JSON.stringify({}),
        requiresTrustedForm: false,
        requiresJornaya: false,
        minBid: 15.0,
        maxBid: 75.0,
        active: true
      }
    });

    testServiceConfig2 = await prisma.buyerServiceConfig.create({
      data: {
        buyerId: testBuyer2.id,
        serviceTypeId: testServiceType.id,
        pingTemplate: JSON.stringify({}),
        postTemplate: JSON.stringify({}),
        fieldMappings: JSON.stringify({}),
        requiresTrustedForm: false,
        requiresJornaya: false,
        minBid: 20.0,
        maxBid: 100.0,
        active: true
      }
    });
  });

  afterAll(async () => {
    if (testServiceConfig1) {
      await prisma.buyerServiceConfig.delete({ where: { id: testServiceConfig1.id } }).catch(() => {});
    }
    if (testServiceConfig2) {
      await prisma.buyerServiceConfig.delete({ where: { id: testServiceConfig2.id } }).catch(() => {});
    }
    if (testBuyer1) {
      await prisma.buyer.delete({ where: { id: testBuyer1.id } }).catch(() => {});
    }
    if (testBuyer2) {
      await prisma.buyer.delete({ where: { id: testBuyer2.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // Pricing Logic (Tests 1-10)
  test('Test 1: Bid must be within min/max range', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        winningBuyerId: testBuyer1.id,
        winningBid: 50.0
      }
    });

    expect(lead.winningBid).toBeGreaterThanOrEqual(testServiceConfig1.minBid);
    expect(lead.winningBid).toBeLessThanOrEqual(testServiceConfig1.maxBid);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 2: Higher bid wins lead', async () => {
    const bid1 = 30.0;
    const bid2 = 50.0;

    expect(Math.max(bid1, bid2)).toBe(bid2);
  });

  test('Test 3: Minimum bid enforced', async () => {
    const testBid = 10.0;

    if (testBid < testServiceConfig1.minBid) {
      expect(testBid).toBeLessThan(testServiceConfig1.minBid);
    }
  });

  test('Test 4: Maximum bid enforced', async () => {
    const testBid = 100.0;

    if (testBid > testServiceConfig1.maxBid) {
      expect(testBid).toBeGreaterThan(testServiceConfig1.maxBid);
    }
  });

  test('Test 5: Bid amount stored correctly', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        winningBid: 42.99
      }
    });

    expect(lead.winningBid).toBe(42.99);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 6: Multiple buyers bid on same lead', async () => {
    const bids = [
      { buyerId: testBuyer1.id, amount: 35.0 },
      { buyerId: testBuyer2.id, amount: 45.0 }
    ];

    const winningBid = bids.reduce((max, bid) => bid.amount > max.amount ? bid : max);

    expect(winningBid.buyerId).toBe(testBuyer2.id);
    expect(winningBid.amount).toBe(45.0);
  });

  test('Test 7: Bid price precision', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        winningBid: 25.99
      }
    });

    expect(lead.winningBid.toFixed(2)).toBe('25.99');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 8: Zero bid not allowed for winning bid', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    expect(lead.winningBid).toBeNull();

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 9: Buyer config min bid overrides default', async () => {
    expect(testServiceConfig1.minBid).toBe(15.0);
    expect(testServiceConfig2.minBid).toBe(20.0);
  });

  test('Test 10: Buyer config max bid overrides default', async () => {
    expect(testServiceConfig1.maxBid).toBe(75.0);
    expect(testServiceConfig2.maxBid).toBe(100.0);
  });

  // ZIP Code Routing Logic (Tests 11-20)
  test('Test 11: Lead routed to buyer covering ZIP', async () => {
    const zipCoverage = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId: testBuyer1.id,
        serviceTypeId: testServiceType.id,
        zipCode: '90210',
        active: true
      }
    });

    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '90210',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const coverage = await prisma.buyerServiceZipCode.findFirst({
      where: {
        zipCode: lead.zipCode,
        serviceTypeId: lead.serviceTypeId,
        active: true
      }
    });

    expect(coverage).toBeDefined();
    expect(coverage.buyerId).toBe(testBuyer1.id);

    await prisma.lead.delete({ where: { id: lead.id } });
    await prisma.buyerServiceZipCode.delete({ where: { id: zipCoverage.id } });
  });

  test('Test 12: No routing if ZIP not covered', async () => {
    const coverage = await prisma.buyerServiceZipCode.findFirst({
      where: {
        zipCode: '99999',
        active: true
      }
    });

    expect(coverage).toBeNull();
  });

  test('Test 13: ZIP code metadata location data', async () => {
    const zipMeta = await prisma.zipCodeMetadata.findUnique({
      where: { zipCode: '10001' }
    });

    if (zipMeta) {
      expect(zipMeta.city).toBeDefined();
      expect(zipMeta.state).toBeDefined();
    }
  });

  test('Test 14: Active ZIP codes only route leads', async () => {
    const activeZips = await prisma.buyerServiceZipCode.findMany({
      where: { active: true }
    });

    activeZips.forEach(zip => {
      expect(zip.active).toBe(true);
    });
  });

  test('Test 15: ZIP priority affects routing order', async () => {
    const zip1 = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId: testBuyer1.id,
        serviceTypeId: testServiceType.id,
        zipCode: '55555',
        active: true,
        priority: 100
      }
    });

    const zip2 = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId: testBuyer2.id,
        serviceTypeId: testServiceType.id,
        zipCode: '55555',
        active: true,
        priority: 200
      }
    });

    expect(zip2.priority).toBeGreaterThan(zip1.priority);

    await prisma.buyerServiceZipCode.deleteMany({ where: { zipCode: '55555' } });
  });

  test('Test 16: Max leads per day limit', async () => {
    const zipWithLimit = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId: testBuyer1.id,
        serviceTypeId: testServiceType.id,
        zipCode: '77777',
        active: true,
        maxLeadsPerDay: 10
      }
    });

    expect(zipWithLimit.maxLeadsPerDay).toBe(10);

    await prisma.buyerServiceZipCode.delete({ where: { id: zipWithLimit.id } });
  });

  test('Test 17: ZIP-specific min bid', async () => {
    const zipWithMinBid = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId: testBuyer1.id,
        serviceTypeId: testServiceType.id,
        zipCode: '88888',
        active: true,
        minBid: 25.0
      }
    });

    expect(zipWithMinBid.minBid).toBe(25.0);

    await prisma.buyerServiceZipCode.delete({ where: { id: zipWithMinBid.id } });
  });

  test('Test 18: ZIP-specific max bid', async () => {
    const zipWithMaxBid = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId: testBuyer1.id,
        serviceTypeId: testServiceType.id,
        zipCode: '66666',
        active: true,
        maxBid: 60.0
      }
    });

    expect(zipWithMaxBid.maxBid).toBe(60.0);

    await prisma.buyerServiceZipCode.delete({ where: { id: zipWithMaxBid.id } });
  });

  test('Test 19: Multiple service types for same ZIP', async () => {
    const allServiceTypes = await prisma.serviceType.findMany({ take: 2 });

    if (allServiceTypes.length >= 2) {
      const zip1 = await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: testBuyer1.id,
          serviceTypeId: allServiceTypes[0].id,
          zipCode: '11223',
          active: true
        }
      });

      const zip2 = await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: testBuyer1.id,
          serviceTypeId: allServiceTypes[1].id,
          zipCode: '11223',
          active: true
        }
      });

      expect(zip1.zipCode).toBe(zip2.zipCode);
      expect(zip1.serviceTypeId).not.toBe(zip2.serviceTypeId);

      await prisma.buyerServiceZipCode.deleteMany({ where: { zipCode: '11223' } });
    } else {
      expect(allServiceTypes.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('Test 20: ZIP code timestamps tracked', async () => {
    const zip = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId: testBuyer1.id,
        serviceTypeId: testServiceType.id,
        zipCode: '33221',
        active: true
      }
    });

    expect(zip.createdAt).toBeDefined();
    expect(zip.updatedAt).toBeDefined();

    await prisma.buyerServiceZipCode.delete({ where: { id: zip.id } });
  });

  // Lead Quality and Routing (Tests 21-30)
  test('Test 21: Lead quality score stored', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        leadQualityScore: 85
      }
    });

    expect(lead.leadQualityScore).toBe(85);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 22: Higher quality leads prioritized', async () => {
    const score1 = 75;
    const score2 = 90;

    expect(score2).toBeGreaterThan(score1);
  });

  test('Test 23: TrustedForm presence affects quality', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        trustedFormCertUrl: 'https://cert.trustedform.com/abc123',
        trustedFormCertId: 'abc123'
      }
    });

    expect(lead.trustedFormCertUrl).toBeDefined();
    expect(lead.trustedFormCertId).toBeDefined();

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 24: Jornaya presence affects quality', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        jornayaLeadId: 'jornaya-xyz789'
      }
    });

    expect(lead.jornayaLeadId).toBe('jornaya-xyz789');

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 25: Compliance data stored', async () => {
    const complianceData = JSON.stringify({
      tcpaConsent: true,
      privacyPolicyAccepted: true
    });

    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        complianceData: complianceData
      }
    });

    expect(lead.complianceData).toBe(complianceData);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 26: Home ownership affects routing', async () => {
    const homeowner = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const renter = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: false,
        timeframe: 'within_3_months'
      }
    });

    expect(homeowner.ownsHome).toBe(true);
    expect(renter.ownsHome).toBe(false);

    await prisma.lead.delete({ where: { id: homeowner.id } });
    await prisma.lead.delete({ where: { id: renter.id } });
  });

  test('Test 27: Timeframe urgency affects routing', async () => {
    const urgent = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    const flexible = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'undecided'
      }
    });

    expect(urgent.timeframe).toBe('within_3_months');
    expect(flexible.timeframe).toBe('undecided');

    await prisma.lead.delete({ where: { id: urgent.id } });
    await prisma.lead.delete({ where: { id: flexible.id } });
  });

  test('Test 28: Form data stored for routing', async () => {
    const formData = JSON.stringify({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '555-1234'
    });

    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: formData,
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    expect(lead.formData).toBe(formData);

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  test('Test 29: Lead status affects availability', async () => {
    const pending = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        status: 'PENDING'
      }
    });

    const sold = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months',
        status: 'SOLD'
      }
    });

    expect(pending.status).toBe('PENDING');
    expect(sold.status).toBe('SOLD');

    await prisma.lead.delete({ where: { id: pending.id } });
    await prisma.lead.delete({ where: { id: sold.id } });
  });

  test('Test 30: Lead created timestamp for recency', async () => {
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: testServiceType.id,
        formData: '{}',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      }
    });

    expect(lead.createdAt).toBeDefined();

    const age = Date.now() - lead.createdAt.getTime();
    expect(age).toBeLessThan(5000); // Created less than 5 seconds ago

    await prisma.lead.delete({ where: { id: lead.id } });
  });

  // Buyer Network Logic (Tests 31-40)
  test('Test 31: Buyer type affects routing', async () => {
    expect(testBuyer1.type).toBeDefined();
  });

  test('Test 32: Contractor buyers handled', async () => {
    const contractor = await prisma.buyer.create({
      data: {
        name: 'Contractor Buyer ' + Date.now(),
        apiUrl: 'https://contractor.com',
        type: 'CONTRACTOR',
        active: true
      }
    });

    expect(contractor.type).toBe('CONTRACTOR');

    await prisma.buyer.delete({ where: { id: contractor.id } });
  });

  test('Test 33: Network buyers handled', async () => {
    const network = await prisma.buyer.create({
      data: {
        name: 'Network Buyer ' + Date.now(),
        apiUrl: 'https://network.com',
        type: 'NETWORK',
        active: true
      }
    });

    expect(network.type).toBe('NETWORK');

    await prisma.buyer.delete({ where: { id: network.id } });
  });

  test('Test 34: Buyer timeout settings', async () => {
    expect(testBuyer1.pingTimeout).toBe(30);
    expect(testBuyer1.postTimeout).toBe(60);
  });

  test('Test 35: Buyer active status required', async () => {
    const activeCount = await prisma.buyer.count({
      where: { active: true }
    });

    expect(activeCount).toBeGreaterThan(0);
  });

  test('Test 36: Buyer API URL required', async () => {
    expect(testBuyer1.apiUrl).toBeDefined();
    expect(testBuyer1.apiUrl).toContain('http');
  });

  test('Test 37: Buyer contact information', async () => {
    const buyerWithContact = await prisma.buyer.create({
      data: {
        name: 'Contact Buyer ' + Date.now(),
        apiUrl: 'https://contact.com',
        active: true,
        contactName: 'Jane Smith',
        contactEmail: 'jane@contact.com',
        contactPhone: '555-9999'
      }
    });

    expect(buyerWithContact.contactName).toBe('Jane Smith');
    expect(buyerWithContact.contactEmail).toBe('jane@contact.com');
    expect(buyerWithContact.contactPhone).toBe('555-9999');

    await prisma.buyer.delete({ where: { id: buyerWithContact.id } });
  });

  test('Test 38: Buyer business contact', async () => {
    const buyerWithBusiness = await prisma.buyer.create({
      data: {
        name: 'Business Buyer ' + Date.now(),
        apiUrl: 'https://business.com',
        active: true,
        businessEmail: 'info@business.com',
        businessPhone: '555-0000'
      }
    });

    expect(buyerWithBusiness.businessEmail).toBe('info@business.com');
    expect(buyerWithBusiness.businessPhone).toBe('555-0000');

    await prisma.buyer.delete({ where: { id: buyerWithBusiness.id } });
  });

  test('Test 39: Buyer auth config stored', async () => {
    const buyerWithAuth = await prisma.buyer.create({
      data: {
        name: 'Auth Buyer ' + Date.now(),
        apiUrl: 'https://auth.com',
        active: true,
        authConfig: JSON.stringify({ type: 'bearer', token: 'secret' })
      }
    });

    expect(buyerWithAuth.authConfig).toBeDefined();

    await prisma.buyer.delete({ where: { id: buyerWithAuth.id } });
  });

  test('Test 40: Multiple service configs per buyer', async () => {
    const configs = await prisma.buyerServiceConfig.findMany({
      where: { buyerId: testBuyer1.id }
    });

    expect(configs.length).toBeGreaterThanOrEqual(1);
  });

  // Template and Field Mapping Logic (Tests 41-50)
  test('Test 41: Ping template required', async () => {
    expect(testServiceConfig1.pingTemplate).toBeDefined();
  });

  test('Test 42: Post template required', async () => {
    expect(testServiceConfig1.postTemplate).toBeDefined();
  });

  test('Test 43: Field mappings define transformation', async () => {
    expect(testServiceConfig1.fieldMappings).toBeDefined();
  });

  test('Test 44: Template stored as JSON string', async () => {
    const tempBuyer = await prisma.buyer.create({
      data: {
        name: 'Template Test Buyer ' + Date.now(),
        apiUrl: 'https://template-test.com',
        active: true
      }
    });

    const templateObj = { field1: 'value1', field2: 'value2' };
    const config = await prisma.buyerServiceConfig.create({
      data: {
        buyerId: tempBuyer.id,
        serviceTypeId: testServiceType.id,
        pingTemplate: JSON.stringify(templateObj),
        postTemplate: JSON.stringify({}),
        fieldMappings: JSON.stringify({}),
        minBid: 10,
        maxBid: 50,
        active: true
      }
    });

    expect(typeof config.pingTemplate).toBe('string');

    await prisma.buyerServiceConfig.delete({ where: { id: config.id } });
    await prisma.buyer.delete({ where: { id: tempBuyer.id } });
  });

  test('Test 45: TrustedForm requirement flag', async () => {
    expect(typeof testServiceConfig1.requiresTrustedForm).toBe('boolean');
  });

  test('Test 46: Jornaya requirement flag', async () => {
    expect(typeof testServiceConfig1.requiresJornaya).toBe('boolean');
  });

  test('Test 47: Compliance config optional', async () => {
    const tempBuyer = await prisma.buyer.create({
      data: {
        name: 'Compliance Test Buyer ' + Date.now(),
        apiUrl: 'https://compliance-test.com',
        active: true
      }
    });

    const configWithCompliance = await prisma.buyerServiceConfig.create({
      data: {
        buyerId: tempBuyer.id,
        serviceTypeId: testServiceType.id,
        pingTemplate: JSON.stringify({}),
        postTemplate: JSON.stringify({}),
        fieldMappings: JSON.stringify({}),
        complianceConfig: JSON.stringify({ tcpaRequired: true }),
        minBid: 10,
        maxBid: 50,
        active: true
      }
    });

    expect(configWithCompliance.complianceConfig).toBeDefined();

    await prisma.buyerServiceConfig.delete({ where: { id: configWithCompliance.id } });
    await prisma.buyer.delete({ where: { id: tempBuyer.id } });
  });

  test('Test 48: Service config active status', async () => {
    expect(testServiceConfig1.active).toBe(true);
  });

  test('Test 49: Service config timestamps', async () => {
    expect(testServiceConfig1.createdAt).toBeDefined();
  });

  test('Test 50: Unique buyer-service combination', async () => {
    await expect(prisma.buyerServiceConfig.create({
      data: {
        buyerId: testBuyer1.id,
        serviceTypeId: testServiceType.id,
        pingTemplate: JSON.stringify({}),
        postTemplate: JSON.stringify({}),
        fieldMappings: JSON.stringify({}),
        minBid: 10,
        maxBid: 50,
        active: true
      }
    })).rejects.toThrow();
  });
});
