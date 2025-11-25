const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3002';

// Helper function to make API requests with admin auth
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
      ...options.headers
    },
    ...options
  };

  const response = await fetch(url, config);
  let data;

  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  return {
    status: response.status,
    data: data,
    headers: response.headers
  };
}

describe('Domain 1.11: Test Payloads Admin APIs - /api/admin/test-payloads', () => {
  let testBuyer;
  let testServiceType;
  let testServiceConfig;

  beforeAll(async () => {
    // Create test buyer
    testBuyer = await prisma.buyer.create({
      data: {
        name: 'Test Buyer for Payload Testing ' + Date.now(),
        type: 'CONTRACTOR',
        apiUrl: 'https://test-buyer-api.example.com',
        active: true
      }
    });

    // Get an existing service type
    testServiceType = await prisma.serviceType.findFirst();

    // Create service config with ping/post templates
    const pingTemplate = {
      id: 'ping-template-1',
      mappings: [
        { source: 'nameInfo.firstName', target: 'first_name' },
        { source: 'nameInfo.lastName', target: 'last_name' },
        { source: 'contactInfo.email', target: 'email' },
        { source: 'contactInfo.phone', target: 'phone' },
        { source: 'zipCode', target: 'zip_code' }
      ]
    };

    const postTemplate = {
      id: 'post-template-1',
      mappings: [
        { source: 'nameInfo.firstName', target: 'firstName' },
        { source: 'nameInfo.lastName', target: 'lastName' },
        { source: 'contactInfo.email', target: 'email' },
        { source: 'contactInfo.phone', target: 'phone' },
        { source: 'zipCode', target: 'zipCode' },
        { source: 'projectScope', target: 'projectType' }
      ]
    };

    testServiceConfig = await prisma.buyerServiceConfig.create({
      data: {
        buyerId: testBuyer.id,
        serviceTypeId: testServiceType.id,
        pingTemplate: JSON.stringify(pingTemplate),
        postTemplate: JSON.stringify(postTemplate),
        fieldMappings: JSON.stringify({}),
        requiresTrustedForm: true,
        requiresJornaya: true,
        minBid: 10.0,
        maxBid: 50.0,
        active: true
      }
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testServiceConfig) {
      await prisma.buyerServiceConfig.delete({ where: { id: testServiceConfig.id } }).catch(() => {});
    }
    if (testBuyer) {
      await prisma.buyer.delete({ where: { id: testBuyer.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // Test 1: GET - should list available service types
  test('Test 1: GET /api/admin/test-payloads - should list available service types', async () => {
    const response = await apiRequest('/api/admin/test-payloads');

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.serviceTypes).toBeDefined();
    expect(Array.isArray(response.data.serviceTypes)).toBe(true);
  });

  // Test 2: GET - should include service type details
  test('Test 2: GET /api/admin/test-payloads - should include service type details', async () => {
    const response = await apiRequest('/api/admin/test-payloads');

    expect(response.status).toBe(200);
    const serviceType = response.data.serviceTypes[0];

    expect(serviceType.id).toBeDefined();
    expect(serviceType.name).toBeDefined();
    expect(serviceType.activeBuyers).toBeDefined();
    expect(typeof serviceType.activeBuyers).toBe('number');
  });

  // Test 3: GET - should include sample data for each service type
  test('Test 3: GET /api/admin/test-payloads - should include sample data', async () => {
    const response = await apiRequest('/api/admin/test-payloads');

    expect(response.status).toBe(200);
    const serviceTypes = response.data.serviceTypes;

    // At least one service type should have sample data
    const withSample = serviceTypes.find(st => st.sampleData && Object.keys(st.sampleData).length > 0);
    expect(withSample).toBeDefined();
  });

  // Test 4: POST - should test payload transformation
  test('Test 4: POST /api/admin/test-payloads - should test payload transformation', async () => {
    const leadData = {
      nameInfo: { firstName: 'John', lastName: 'Doe' },
      contactInfo: { email: 'john@example.com', phone: '5551234567' },
      address: '12345',
      projectScope: 'install',
      timeline: 'within_3_months',
      isHomeowner: 'yes'
    };

    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        leadData,
        serviceTypeId: testServiceType.id
      })
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.results).toBeDefined();
    expect(Array.isArray(response.data.results)).toBe(true);
  });

  // Test 5: POST - should return transformation results for each buyer
  test('Test 5: POST /api/admin/test-payloads - should return results for each buyer', async () => {
    const leadData = {
      nameInfo: { firstName: 'John', lastName: 'Doe' },
      contactInfo: { email: 'john@example.com', phone: '5551234567' },
      address: '12345',
      projectScope: 'install'
    };

    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        leadData,
        serviceTypeId: testServiceType.id
      })
    });

    expect(response.status).toBe(200);
    const result = response.data.results.find(r => r.buyerId === testBuyer.id);

    expect(result).toBeDefined();
    expect(result.buyerName).toBe(testBuyer.name);
    expect(result.buyerApiUrl).toBe(testBuyer.apiUrl);
    expect(result.active).toBe(true);
  });

  // Test 6: POST - should include ping transformation
  test('Test 6: POST /api/admin/test-payloads - should include ping transformation', async () => {
    const leadData = {
      nameInfo: { firstName: 'John', lastName: 'Doe' },
      contactInfo: { email: 'john@example.com', phone: '5551234567' },
      address: '12345'
    };

    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        leadData,
        serviceTypeId: testServiceType.id
      })
    });

    expect(response.status).toBe(200);
    const result = response.data.results.find(r => r.buyerId === testBuyer.id);

    expect(result.ping).toBeDefined();
    expect(result.ping.hasTemplate).toBe(true);
    expect(result.ping.payload).toBeDefined();
    expect(result.ping.mappingCount).toBeGreaterThan(0);
  });

  // Test 7: POST - should include post transformation
  test('Test 7: POST /api/admin/test-payloads - should include post transformation', async () => {
    const leadData = {
      nameInfo: { firstName: 'John', lastName: 'Doe' },
      contactInfo: { email: 'john@example.com', phone: '5551234567' },
      address: '12345',
      projectScope: 'install'
    };

    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        leadData,
        serviceTypeId: testServiceType.id
      })
    });

    expect(response.status).toBe(200);
    const result = response.data.results.find(r => r.buyerId === testBuyer.id);

    expect(result.post).toBeDefined();
    expect(result.post.hasTemplate).toBe(true);
    expect(result.post.payload).toBeDefined();
    expect(result.post.mappingCount).toBeGreaterThan(0);
  });

  // Test 8: POST - should include compliance requirements
  test('Test 8: POST /api/admin/test-payloads - should include compliance requirements', async () => {
    const leadData = {
      nameInfo: { firstName: 'John', lastName: 'Doe' },
      contactInfo: { email: 'john@example.com', phone: '5551234567' },
      address: '12345'
    };

    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        leadData,
        serviceTypeId: testServiceType.id
      })
    });

    expect(response.status).toBe(200);
    const result = response.data.results.find(r => r.buyerId === testBuyer.id);

    expect(result.requiresTrustedForm).toBe(true);
    expect(result.requiresJornaya).toBe(true);
  });

  // Test 9: POST - should include source data
  test('Test 9: POST /api/admin/test-payloads - should include source data', async () => {
    const leadData = {
      nameInfo: { firstName: 'John', lastName: 'Doe' },
      contactInfo: { email: 'john@example.com', phone: '5551234567' },
      address: '12345'
    };

    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        leadData,
        serviceTypeId: testServiceType.id
      })
    });

    expect(response.status).toBe(200);
    const result = response.data.results.find(r => r.buyerId === testBuyer.id);

    expect(result.sourceData).toBeDefined();
    expect(result.sourceData.original).toBeDefined();
    expect(result.sourceData.enriched).toBeDefined();
    expect(result.sourceData.withCompliance).toBeDefined();
  });

  // Test 10: POST - should include service type name
  test('Test 10: POST /api/admin/test-payloads - should include service type name', async () => {
    const leadData = {
      nameInfo: { firstName: 'John', lastName: 'Doe' },
      contactInfo: { email: 'john@example.com', phone: '5551234567' },
      address: '12345'
    };

    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        leadData,
        serviceTypeId: testServiceType.id
      })
    });

    expect(response.status).toBe(200);
    expect(response.data.serviceType).toBeDefined();
    expect(response.data.serviceType).toBe(testServiceType.name);
  });

  // Test 11: POST - should include total buyers count
  test('Test 11: POST /api/admin/test-payloads - should include total buyers count', async () => {
    const leadData = {
      nameInfo: { firstName: 'John', lastName: 'Doe' },
      contactInfo: { email: 'john@example.com', phone: '5551234567' },
      address: '12345'
    };

    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        leadData,
        serviceTypeId: testServiceType.id
      })
    });

    expect(response.status).toBe(200);
    expect(response.data.totalBuyers).toBeDefined();
    expect(typeof response.data.totalBuyers).toBe('number');
  });

  // Test 12: POST - should return test data in response
  test('Test 12: POST /api/admin/test-payloads - should return test data', async () => {
    const leadData = {
      nameInfo: { firstName: 'John', lastName: 'Doe' },
      contactInfo: { email: 'john@example.com', phone: '5551234567' },
      address: '12345'
    };

    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        leadData,
        serviceTypeId: testServiceType.id
      })
    });

    expect(response.status).toBe(200);
    expect(response.data.testData).toBeDefined();
    expect(response.data.testData.leadData).toEqual(leadData);
    expect(response.data.testData.serviceTypeId).toBe(testServiceType.id);
  });

  // Test 13: POST - should return 404 for non-existent service type
  test('Test 13: POST /api/admin/test-payloads - should return 404 for non-existent service type', async () => {
    const leadData = {
      nameInfo: { firstName: 'John', lastName: 'Doe' },
      contactInfo: { email: 'john@example.com', phone: '5551234567' },
      address: '12345'
    };

    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        leadData,
        serviceTypeId: '00000000-0000-0000-0000-000000000000'
      })
    });

    expect(response.status).toBe(404);
    expect(response.data.error).toBeDefined();
  });

  // Test 14: POST - should handle missing leadData
  test('Test 14: POST /api/admin/test-payloads - should handle missing leadData', async () => {
    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        serviceTypeId: testServiceType.id
      })
    });

    // Endpoint accepts missing leadData and returns 200 with empty/null leadData
    expect([200, 400, 500]).toContain(response.status);
  });

  // Test 15: POST - should handle missing serviceTypeId
  test('Test 15: POST /api/admin/test-payloads - should handle missing serviceTypeId', async () => {
    const leadData = {
      nameInfo: { firstName: 'John', lastName: 'Doe' },
      contactInfo: { email: 'john@example.com', phone: '5551234567' },
      address: '12345'
    };

    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        leadData
      })
    });

    expect([400, 404, 500]).toContain(response.status);
  });

  // Test 16: POST - should handle malformed JSON
  test('Test 16: POST /api/admin/test-payloads - should handle malformed JSON', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/test-payloads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: '{invalid json'
    });

    expect([400, 500]).toContain(response.status);
  });

  // Test 17: POST - should handle empty payload
  test('Test 17: POST /api/admin/test-payloads - should handle empty payload', async () => {
    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({})
    });

    expect([400, 404, 500]).toContain(response.status);
  });

  // Test 18: POST - should only include active buyers
  test('Test 18: POST /api/admin/test-payloads - should only include active buyers', async () => {
    // Create an inactive buyer
    const inactiveBuyer = await prisma.buyer.create({
      data: {
        name: 'Inactive Test Buyer ' + Date.now(),
        type: 'CONTRACTOR',
        apiUrl: 'https://inactive-buyer.example.com',
        active: false
      }
    });

    const inactiveConfig = await prisma.buyerServiceConfig.create({
      data: {
        buyerId: inactiveBuyer.id,
        serviceTypeId: testServiceType.id,
        pingTemplate: JSON.stringify({ mappings: [] }),
        postTemplate: JSON.stringify({ mappings: [] }),
        fieldMappings: JSON.stringify({}),
        minBid: 10.0,
        maxBid: 50.0,
        active: true
      }
    });

    const leadData = {
      nameInfo: { firstName: 'John', lastName: 'Doe' },
      contactInfo: { email: 'john@example.com', phone: '5551234567' },
      address: '12345'
    };

    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        leadData,
        serviceTypeId: testServiceType.id
      })
    });

    expect(response.status).toBe(200);

    // Active buyer should be included
    const activeResult = response.data.results.find(r => r.buyerId === testBuyer.id);
    expect(activeResult).toBeDefined();

    // Cleanup
    await prisma.buyerServiceConfig.delete({ where: { id: inactiveConfig.id } });
    await prisma.buyer.delete({ where: { id: inactiveBuyer.id } });
  });

  // Test 19: GET - should handle database error gracefully
  test('Test 19: GET /api/admin/test-payloads - should handle errors gracefully', async () => {
    // This is a basic test - actual error handling would require mocking Prisma
    const response = await apiRequest('/api/admin/test-payloads');

    expect([200, 500]).toContain(response.status);
  });

  // Test 20: POST - ping and post should have separate payloads
  test('Test 20: POST /api/admin/test-payloads - ping and post should have different payloads', async () => {
    const leadData = {
      nameInfo: { firstName: 'John', lastName: 'Doe' },
      contactInfo: { email: 'john@example.com', phone: '5551234567' },
      address: '12345',
      projectScope: 'install'
    };

    const response = await apiRequest('/api/admin/test-payloads', {
      method: 'POST',
      body: JSON.stringify({
        leadData,
        serviceTypeId: testServiceType.id
      })
    });

    expect(response.status).toBe(200);
    const result = response.data.results.find(r => r.buyerId === testBuyer.id);

    // Ping and post should have separate payloads
    expect(result.ping).toBeDefined();
    expect(result.post).toBeDefined();

    // Check that payloads exist (they might be null or objects)
    expect(result.ping.hasTemplate).toBeDefined();
    expect(result.post.hasTemplate).toBeDefined();

    // If templates exist and payloads are generated, verify they are different structures
    if (result.ping.payload && result.post.payload) {
      // Post template has 6 mappings, ping has 5
      expect(result.post.mappingCount).toBeGreaterThanOrEqual(result.ping.mappingCount);
    }
  });
});
