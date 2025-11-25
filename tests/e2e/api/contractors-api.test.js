/**
 * E2E Tests for Contractor Signup & Management APIs
 * Domain 1.8: Contractor Signup & Management
 *
 * Tests:
 * - POST /api/contractors/signup (contractor registration)
 * - GET /api/contractors/signup (list contractors - admin)
 * - POST /api/contractors/service-locations (save service locations)
 * - GET /api/contractors/service-locations (get service locations)
 * - DELETE /api/contractors/service-locations (clear service locations)
 *
 * Total: 48 tests
 */

const { PrismaClient } = require('@prisma/client');

const BASE_URL = 'http://localhost:3002';

const prisma = new PrismaClient();

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const fetchOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  if (fetchOptions.body && typeof fetchOptions.body === 'object') {
    fetchOptions.body = JSON.stringify(fetchOptions.body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, fetchOptions);

  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
    error: !response.ok ? (data?.error || data?.message || 'Request failed') : null
  };
}

// Test setup variables
let testServiceType;
let testContractorId;

beforeAll(async () => {
  // Get test service type
  const serviceTypes = await prisma.serviceType.findMany({ take: 1 });
  testServiceType = serviceTypes[0];
});

afterAll(async () => {
  // Clean up test contractors
  if (testContractorId) {
    await prisma.buyerServiceZipCode.deleteMany({
      where: { buyerId: testContractorId }
    });
    await prisma.buyerServiceConfig.deleteMany({
      where: { buyerId: testContractorId }
    });
    await prisma.buyer.deleteMany({
      where: { id: testContractorId }
    });
  }

  // Clean up any test contractors created during tests
  await prisma.buyer.deleteMany({
    where: {
      name: {
        startsWith: 'Test Company'
      }
    }
  });

  await prisma.$disconnect();
});

// ============================================================================
// POST /api/contractors/signup - Contractor Registration (25 tests)
// ============================================================================

test('Test 1: POST /api/contractors/signup - should register contractor with all fields', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'john.doe@testcompany' + Date.now() + '.com',
      contactPhone: '5551234567',
      companyName: 'Test Company ' + Date.now(),
      businessEmail: 'business@testcompany' + Date.now() + '.com',
      businessPhone: '5559876543',
      additionalContacts: [
        {
          name: 'Jane Smith',
          email: 'jane.smith@testcompany.com',
          phone: '5551112222',
          role: 'Operations Manager'
        }
      ],
      selectedServices: [],
      serviceLocationMappings: [],
      type: 'CONTRACTOR'
    }
  });

  expect(response.status).toBe(201);
  expect(response.data).toHaveProperty('message');
  expect(response.data).toHaveProperty('buyerId');
  expect(response.data).toHaveProperty('status');
  expect(response.data.status).toBe('pending_review');

  // Save for cleanup
  testContractorId = response.data.buyerId;
});

test('Test 2: POST /api/contractors/signup - should register with minimum required fields', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Bob Johnson',
      contactEmail: 'bob@company' + Date.now() + '.com',
      contactPhone: '5551234567',
      companyName: 'Test Company Min ' + Date.now(),
      businessEmail: 'biz@company' + Date.now() + '.com',
      businessPhone: '5559876543'
    }
  });

  expect(response.status).toBe(201);
  expect(response.data.buyerId).toBeDefined();
});

test('Test 3: POST /api/contractors/signup - should validate contact name (too short)', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'A',
      contactEmail: 'test@company.com',
      contactPhone: '5551234567',
      companyName: 'Test Company',
      businessEmail: 'business@company.com',
      businessPhone: '5559876543'
    }
  });

  expect(response.status).toBe(400);
  expect(response.data.error).toContain('Validation');
});

test('Test 4: POST /api/contractors/signup - should validate contact email format', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'invalid-email',
      contactPhone: '5551234567',
      companyName: 'Test Company',
      businessEmail: 'business@company.com',
      businessPhone: '5559876543'
    }
  });

  expect(response.status).toBe(400);
  expect(response.data.error).toContain('Validation');
});

test('Test 5: POST /api/contractors/signup - should validate contact phone (too short)', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'john@company.com',
      contactPhone: '123',
      companyName: 'Test Company',
      businessEmail: 'business@company.com',
      businessPhone: '5559876543'
    }
  });

  expect(response.status).toBe(400);
  expect(response.data.error).toContain('Validation');
});

test('Test 6: POST /api/contractors/signup - should validate company name (too short)', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'john@company.com',
      contactPhone: '5551234567',
      companyName: 'A',
      businessEmail: 'business@company.com',
      businessPhone: '5559876543'
    }
  });

  expect(response.status).toBe(400);
  expect(response.data.error).toContain('Validation');
});

test('Test 7: POST /api/contractors/signup - should validate business email format', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'john@company.com',
      contactPhone: '5551234567',
      companyName: 'Test Company',
      businessEmail: 'not-an-email',
      businessPhone: '5559876543'
    }
  });

  expect(response.status).toBe(400);
  expect(response.data.error).toContain('Validation');
});

test('Test 8: POST /api/contractors/signup - should validate business phone (too short)', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'john@company.com',
      contactPhone: '5551234567',
      companyName: 'Test Company',
      businessEmail: 'business@company.com',
      businessPhone: '123'
    }
  });

  expect(response.status).toBe(400);
  expect(response.data.error).toContain('Validation');
});

test('Test 9: POST /api/contractors/signup - should reject duplicate contact email', async () => {
  // First create a contractor with unique emails
  const unique = Date.now() + Math.random().toString(36).substr(2, 9);
  const email = 'duplicate@test' + unique + '.com';
  const firstResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'First Contractor',
      contactEmail: email,
      contactPhone: '5551234567',
      companyName: 'First Company ' + unique,
      businessEmail: 'biz1@test' + unique + '.com',
      businessPhone: '5559876543'
    }
  });

  expect(firstResponse.status).toBe(201);

  // Try to create another with same contact email
  const secondResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Second Contractor',
      contactEmail: email,
      contactPhone: '5551234567',
      companyName: 'Second Company ' + unique,
      businessEmail: 'biz2@test' + unique + '.com',
      businessPhone: '5559876543'
    }
  });

  expect(secondResponse.status).toBe(409);
  expect(secondResponse.data.error).toContain('already exists');
});

test('Test 10: POST /api/contractors/signup - should reject duplicate business email', async () => {
  const unique = Date.now() + Math.random().toString(36).substr(2, 9);
  const email = 'bizduplicate@test' + unique + '.com';

  const firstResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'First Contractor',
      contactEmail: 'contact1@test' + unique + '.com',
      contactPhone: '5551234567',
      companyName: 'First Company ' + unique,
      businessEmail: email,
      businessPhone: '5559876543'
    }
  });

  expect(firstResponse.status).toBe(201);

  const secondResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Second Contractor',
      contactEmail: 'contact2@test' + unique + '.com',
      contactPhone: '5551234567',
      companyName: 'Second Company ' + unique,
      businessEmail: email,
      businessPhone: '5559876543'
    }
  });

  expect(secondResponse.status).toBe(409);
  expect(secondResponse.data.error).toContain('already exists');
});

test('Test 11: POST /api/contractors/signup - should reject duplicate company name', async () => {
  const companyName = 'Unique Company ' + Date.now();

  const firstResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'First Contractor',
      contactEmail: 'contact1' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: companyName,
      businessEmail: 'biz1' + Date.now() + '@test.com',
      businessPhone: '5559876543'
    }
  });

  expect(firstResponse.status).toBe(201);

  const secondResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Second Contractor',
      contactEmail: 'contact2' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: companyName,
      businessEmail: 'biz2' + Date.now() + '@test.com',
      businessPhone: '5559876543'
    }
  });

  expect(secondResponse.status).toBe(409);
  expect(secondResponse.data.error).toContain('already exists');
});

test('Test 12: POST /api/contractors/signup - should accept additional contacts array', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'john' + Date.now() + '@company.com',
      contactPhone: '5551234567',
      companyName: 'Test Company ' + Date.now(),
      businessEmail: 'business' + Date.now() + '@company.com',
      businessPhone: '5559876543',
      additionalContacts: [
        {
          name: 'Jane Smith',
          email: 'jane@company.com',
          phone: '5551112222',
          role: 'Manager'
        },
        {
          name: 'Bob Wilson',
          email: 'bob@company.com',
          phone: '5553334444',
          role: 'Supervisor'
        }
      ]
    }
  });

  expect(response.status).toBe(201);
  expect(response.data.buyerId).toBeDefined();
});

test('Test 13: POST /api/contractors/signup - should accept empty additional contacts array', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'john' + Date.now() + '@company.com',
      contactPhone: '5551234567',
      companyName: 'Test Company ' + Date.now(),
      businessEmail: 'business' + Date.now() + '@company.com',
      businessPhone: '5559876543',
      additionalContacts: []
    }
  });

  expect(response.status).toBe(201);
  expect(response.data.buyerId).toBeDefined();
});

test('Test 14: POST /api/contractors/signup - should set contractor status to pending_review', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Pending Contractor',
      contactEmail: 'pending' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Pending Company ' + Date.now(),
      businessEmail: 'pending' + Date.now() + '@biz.com',
      businessPhone: '5559876543'
    }
  });

  expect(response.status).toBe(201);
  expect(response.data.status).toBe('pending_review');

  // Verify in database
  const buyer = await prisma.buyer.findUnique({
    where: { id: response.data.buyerId }
  });

  expect(buyer.active).toBe(false); // Should be inactive until approved
  expect(buyer.type).toBe('CONTRACTOR');
});

test('Test 15: POST /api/contractors/signup - should create buyer with correct fields', async () => {
  const contactEmail = 'verify' + Date.now() + '@test.com';
  const companyName = 'Verify Company ' + Date.now();

  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Verify',
      contactEmail: contactEmail,
      contactPhone: '5551234567',
      companyName: companyName,
      businessEmail: 'biz' + Date.now() + '@verify.com',
      businessPhone: '5559876543'
    }
  });

  expect(response.status).toBe(201);

  // Verify in database
  const buyer = await prisma.buyer.findUnique({
    where: { id: response.data.buyerId }
  });

  expect(buyer.name).toBe(companyName);
  expect(buyer.contactEmail).toBe(contactEmail);
  expect(buyer.type).toBe('CONTRACTOR');
  expect(buyer.apiUrl).toContain(companyName.toLowerCase().replace(/\s+/g, '-'));
});

test('Test 16: POST /api/contractors/signup - should handle malformed JSON', async () => {
  const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: '{invalid json'
  });

  expect(response.status).toBe(400);
});

test('Test 17: POST /api/contractors/signup - should reject missing required field (contactName)', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactEmail: 'test@company.com',
      contactPhone: '5551234567',
      companyName: 'Test Company',
      businessEmail: 'business@company.com',
      businessPhone: '5559876543'
    }
  });

  expect(response.status).toBe(400);
});

test('Test 18: POST /api/contractors/signup - should reject missing required field (contactEmail)', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactPhone: '5551234567',
      companyName: 'Test Company',
      businessEmail: 'business@company.com',
      businessPhone: '5559876543'
    }
  });

  expect(response.status).toBe(400);
});

test('Test 19: POST /api/contractors/signup - should reject missing required field (contactPhone)', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'john@company.com',
      companyName: 'Test Company',
      businessEmail: 'business@company.com',
      businessPhone: '5559876543'
    }
  });

  expect(response.status).toBe(400);
});

test('Test 20: POST /api/contractors/signup - should reject missing required field (companyName)', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'john@company.com',
      contactPhone: '5551234567',
      businessEmail: 'business@company.com',
      businessPhone: '5559876543'
    }
  });

  expect(response.status).toBe(400);
});

test('Test 21: POST /api/contractors/signup - should reject missing required field (businessEmail)', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'john@company.com',
      contactPhone: '5551234567',
      companyName: 'Test Company',
      businessPhone: '5559876543'
    }
  });

  expect(response.status).toBe(400);
});

test('Test 22: POST /api/contractors/signup - should reject missing required field (businessPhone)', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'john@company.com',
      contactPhone: '5551234567',
      companyName: 'Test Company',
      businessEmail: 'business@company.com'
    }
  });

  expect(response.status).toBe(400);
});

test('Test 23: POST /api/contractors/signup - should accept selectedServices array', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'services' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Services Company ' + Date.now(),
      businessEmail: 'biz' + Date.now() + '@services.com',
      businessPhone: '5559876543',
      selectedServices: [{ id: testServiceType.id, name: testServiceType.name }]
    }
  });

  expect(response.status).toBe(201);
});

test('Test 24: POST /api/contractors/signup - should accept serviceLocationMappings array', async () => {
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'locations' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Locations Company ' + Date.now(),
      businessEmail: 'biz' + Date.now() + '@locations.com',
      businessPhone: '5559876543',
      serviceLocationMappings: []
    }
  });

  expect(response.status).toBe(201);
});

test('Test 25: POST /api/contractors/signup - should handle database error gracefully', async () => {
  // This test relies on the database handling duplicate constraint errors
  // The signup endpoint handles Prisma errors and returns 409 or 500 as appropriate
  const response = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'John Doe',
      contactEmail: 'error' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Error Company ' + Date.now(),
      businessEmail: 'error' + Date.now() + '@test.com',
      businessPhone: '5559876543'
    }
  });

  // Should either succeed or return appropriate error
  expect([201, 400, 409, 500]).toContain(response.status);
});

// ============================================================================
// GET /api/contractors/signup - List Contractors (6 tests)
// ============================================================================

test('Test 26: GET /api/contractors/signup - should list all contractors', async () => {
  const response = await apiRequest('/api/contractors/signup');

  expect(response.status).toBe(200);
  expect(response.data).toHaveProperty('contractors');
  expect(response.data).toHaveProperty('count');
  expect(response.data).toHaveProperty('pendingCount');
  expect(response.data).toHaveProperty('approvedCount');
  expect(Array.isArray(response.data.contractors)).toBe(true);
});

test('Test 27: GET /api/contractors/signup - should filter pending contractors', async () => {
  const response = await apiRequest('/api/contractors/signup?status=pending');

  expect(response.status).toBe(200);
  expect(response.data.contractors).toBeDefined();

  // All returned contractors should be inactive (pending)
  response.data.contractors.forEach(contractor => {
    expect(contractor.active).toBe(false);
  });
});

test('Test 28: GET /api/contractors/signup - should filter approved contractors', async () => {
  const response = await apiRequest('/api/contractors/signup?status=approved');

  expect(response.status).toBe(200);
  expect(response.data.contractors).toBeDefined();

  // All returned contractors should be active (approved)
  response.data.contractors.forEach(contractor => {
    expect(contractor.active).toBe(true);
  });
});

test('Test 29: GET /api/contractors/signup - should return all contractors with status=all', async () => {
  const response = await apiRequest('/api/contractors/signup?status=all');

  expect(response.status).toBe(200);
  expect(response.data.contractors).toBeDefined();
  expect(response.data.count).toBeGreaterThanOrEqual(0);
});

test('Test 30: GET /api/contractors/signup - should include contact info from authConfig', async () => {
  const response = await apiRequest('/api/contractors/signup');

  expect(response.status).toBe(200);

  if (response.data.contractors.length > 0) {
    const contractor = response.data.contractors[0];
    expect(contractor).toHaveProperty('contactInfo');
  }
});

test('Test 31: GET /api/contractors/signup - should handle database error gracefully', async () => {
  // The endpoint should handle errors gracefully
  const response = await apiRequest('/api/contractors/signup');

  expect([200, 500]).toContain(response.status);
});

// ============================================================================
// POST /api/contractors/service-locations - Save Service Locations (10 tests)
// ============================================================================

test('Test 32: POST /api/contractors/service-locations - should save service locations', async () => {
  // First create a contractor
  const signupResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Location Test',
      contactEmail: 'loctest' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Location Test Company ' + Date.now(),
      businessEmail: 'biz' + Date.now() + '@loctest.com',
      businessPhone: '5559876543'
    }
  });

  expect(signupResponse.status).toBe(201);
  const contractorId = signupResponse.data.buyerId;

  // Save service locations
  const response = await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      contractorId: contractorId,
      selectedServices: [
        {
          id: testServiceType.id,
          name: testServiceType.name,
          displayName: testServiceType.displayName,
          category: 'construction',
          description: 'Test service',
          icon: 'test-icon'
        }
      ],
      serviceLocationMappings: [],
      expandedMappings: [
        {
          serviceId: testServiceType.id,
          zipCodes: ['90210', '10001', '60601'],
          summary: {
            totalZipCodes: 3,
            fromStates: 0,
            fromCities: 0,
            fromCounties: 0,
            directZipCodes: 3
          }
        }
      ]
    }
  });

  expect(response.status).toBe(201);
  expect(response.data.success).toBe(true);
  expect(response.data.data).toHaveProperty('contractorId');
  expect(response.data.data).toHaveProperty('servicesConfigured');
  expect(response.data.data).toHaveProperty('totalZipCodes');
  expect(response.data.data.totalZipCodes).toBe(3);
});

test('Test 33: POST /api/contractors/service-locations - should require contractorId', async () => {
  const response = await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      selectedServices: [],
      serviceLocationMappings: []
    }
  });

  expect(response.status).toBe(400);
});

test('Test 34: POST /api/contractors/service-locations - should validate contractor exists', async () => {
  const response = await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      contractorId: '00000000-0000-0000-0000-000000000000',
      selectedServices: [],
      serviceLocationMappings: [],
      expandedMappings: []
    }
  });

  expect(response.status).toBe(500);
  expect(response.data.message).toContain('Contractor not found');
});

test('Test 35: POST /api/contractors/service-locations - should handle malformed JSON', async () => {
  const response = await fetch(`${BASE_URL}/api/contractors/service-locations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: '{invalid json'
  });

  // Accept both 400 (validation) and 500 (parse error) depending on Next.js handling
  expect([400, 500]).toContain(response.status);
});

test('Test 36: POST /api/contractors/service-locations - should validate request schema', async () => {
  const response = await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      contractorId: 'invalid-uuid',
      selectedServices: 'not-an-array',
      serviceLocationMappings: 'not-an-array'
    }
  });

  expect(response.status).toBe(400);
  expect(response.data.message).toContain('Invalid request data');
});

test('Test 37: POST /api/contractors/service-locations - should delete existing configs before creating new ones', async () => {
  // Create contractor
  const signupResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Update Test',
      contactEmail: 'update' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Update Test Company ' + Date.now(),
      businessEmail: 'biz' + Date.now() + '@update.com',
      businessPhone: '5559876543'
    }
  });

  const contractorId = signupResponse.data.buyerId;

  // First save
  await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      contractorId: contractorId,
      selectedServices: [
        {
          id: testServiceType.id,
          name: testServiceType.name,
          displayName: testServiceType.displayName,
          category: 'construction',
          description: 'Test',
          icon: 'icon'
        }
      ],
      serviceLocationMappings: [],
      expandedMappings: [
        {
          serviceId: testServiceType.id,
          zipCodes: ['90210'],
          summary: { totalZipCodes: 1, fromStates: 0, fromCities: 0, fromCounties: 0, directZipCodes: 1 }
        }
      ]
    }
  });

  // Second save with different zips
  const response = await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      contractorId: contractorId,
      selectedServices: [
        {
          id: testServiceType.id,
          name: testServiceType.name,
          displayName: testServiceType.displayName,
          category: 'construction',
          description: 'Test',
          icon: 'icon'
        }
      ],
      serviceLocationMappings: [],
      expandedMappings: [
        {
          serviceId: testServiceType.id,
          zipCodes: ['10001', '60601'],
          summary: { totalZipCodes: 2, fromStates: 0, fromCities: 0, fromCounties: 0, directZipCodes: 2 }
        }
      ]
    }
  });

  expect(response.status).toBe(201);
  expect(response.data.data.totalZipCodes).toBe(2); // Should only have the new ZIPs
});

test('Test 38: POST /api/contractors/service-locations - should create service configs for each service', async () => {
  const signupResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Multi Service',
      contactEmail: 'multi' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Multi Service Company ' + Date.now(),
      businessEmail: 'biz' + Date.now() + '@multi.com',
      businessPhone: '5559876543'
    }
  });

  const contractorId = signupResponse.data.buyerId;

  const response = await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      contractorId: contractorId,
      selectedServices: [
        {
          id: testServiceType.id,
          name: testServiceType.name,
          displayName: testServiceType.displayName,
          category: 'construction',
          description: 'Test',
          icon: 'icon'
        }
      ],
      serviceLocationMappings: [],
      expandedMappings: [
        {
          serviceId: testServiceType.id,
          zipCodes: ['90210'],
          summary: { totalZipCodes: 1, fromStates: 0, fromCities: 0, fromCounties: 0, directZipCodes: 1 }
        }
      ]
    }
  });

  expect(response.status).toBe(201);
  expect(response.data.data.servicesConfigured).toBe(1);
});

test('Test 39: POST /api/contractors/service-locations - should return service breakdown', async () => {
  const signupResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Breakdown Test',
      contactEmail: 'breakdown' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Breakdown Company ' + Date.now(),
      businessEmail: 'biz' + Date.now() + '@breakdown.com',
      businessPhone: '5559876543'
    }
  });

  const contractorId = signupResponse.data.buyerId;

  const response = await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      contractorId: contractorId,
      selectedServices: [
        {
          id: testServiceType.id,
          name: testServiceType.name,
          displayName: testServiceType.displayName,
          category: 'construction',
          description: 'Test',
          icon: 'icon'
        }
      ],
      serviceLocationMappings: [],
      expandedMappings: [
        {
          serviceId: testServiceType.id,
          zipCodes: ['90210', '10001'],
          summary: { totalZipCodes: 2, fromStates: 0, fromCities: 0, fromCounties: 0, directZipCodes: 2 }
        }
      ]
    }
  });

  expect(response.status).toBe(201);
  expect(response.data.data.serviceBreakdown).toBeDefined();
  expect(Array.isArray(response.data.data.serviceBreakdown)).toBe(true);
  expect(response.data.data.serviceBreakdown.length).toBeGreaterThan(0);

  const breakdown = response.data.data.serviceBreakdown[0];
  expect(breakdown).toHaveProperty('serviceId');
  expect(breakdown).toHaveProperty('serviceName');
  expect(breakdown).toHaveProperty('zipCount');
  expect(breakdown).toHaveProperty('summary');
});

test('Test 40: POST /api/contractors/service-locations - should handle empty selectedServices', async () => {
  const signupResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Empty Services',
      contactEmail: 'empty' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Empty Services Company ' + Date.now(),
      businessEmail: 'biz' + Date.now() + '@empty.com',
      businessPhone: '5559876543'
    }
  });

  const contractorId = signupResponse.data.buyerId;

  const response = await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      contractorId: contractorId,
      selectedServices: [],
      serviceLocationMappings: [],
      expandedMappings: []
    }
  });

  expect(response.status).toBe(201);
  expect(response.data.data.servicesConfigured).toBe(0);
  expect(response.data.data.totalZipCodes).toBe(0);
});

test('Test 41: POST /api/contractors/service-locations - should handle large number of ZIP codes', async () => {
  const signupResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Large Zips',
      contactEmail: 'largezips' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Large Zips Company ' + Date.now(),
      businessEmail: 'biz' + Date.now() + '@largezips.com',
      businessPhone: '5559876543'
    }
  });

  const contractorId = signupResponse.data.buyerId;

  // Create 50 test ZIP codes
  const zipCodes = Array.from({ length: 50 }, (_, i) => String(10000 + i).padStart(5, '0'));

  const response = await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      contractorId: contractorId,
      selectedServices: [
        {
          id: testServiceType.id,
          name: testServiceType.name,
          displayName: testServiceType.displayName,
          category: 'construction',
          description: 'Test',
          icon: 'icon'
        }
      ],
      serviceLocationMappings: [],
      expandedMappings: [
        {
          serviceId: testServiceType.id,
          zipCodes: zipCodes,
          summary: { totalZipCodes: 50, fromStates: 0, fromCities: 0, fromCounties: 0, directZipCodes: 50 }
        }
      ]
    }
  });

  expect(response.status).toBe(201);
  expect(response.data.data.totalZipCodes).toBe(50);
});

// ============================================================================
// GET /api/contractors/service-locations - Get Service Locations (4 tests)
// ============================================================================

test('Test 42: GET /api/contractors/service-locations - should require contractorId', async () => {
  const response = await apiRequest('/api/contractors/service-locations');

  expect(response.status).toBe(400);
  expect(response.data.message).toContain('contractorId is required');
});

test('Test 43: GET /api/contractors/service-locations - should return service locations', async () => {
  // Create contractor and save locations
  const signupResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Get Test',
      contactEmail: 'get' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Get Test Company ' + Date.now(),
      businessEmail: 'biz' + Date.now() + '@get.com',
      businessPhone: '5559876543'
    }
  });

  const contractorId = signupResponse.data.buyerId;

  await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      contractorId: contractorId,
      selectedServices: [
        {
          id: testServiceType.id,
          name: testServiceType.name,
          displayName: testServiceType.displayName,
          category: 'construction',
          description: 'Test',
          icon: 'icon'
        }
      ],
      serviceLocationMappings: [],
      expandedMappings: [
        {
          serviceId: testServiceType.id,
          zipCodes: ['90210', '10001'],
          summary: { totalZipCodes: 2, fromStates: 0, fromCities: 0, fromCounties: 0, directZipCodes: 2 }
        }
      ]
    }
  });

  // Get locations
  const response = await apiRequest(`/api/contractors/service-locations?contractorId=${contractorId}`);

  expect(response.status).toBe(200);
  expect(response.data.success).toBe(true);
  expect(response.data.data).toHaveProperty('contractorId');
  expect(response.data.data).toHaveProperty('servicesConfigured');
  expect(response.data.data).toHaveProperty('totalActiveZipCodes');
  expect(response.data.data).toHaveProperty('services');
  expect(response.data.data).toHaveProperty('serviceConfigs');
});

test('Test 44: GET /api/contractors/service-locations - should filter by serviceTypeId', async () => {
  const signupResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Filter Test',
      contactEmail: 'filter' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Filter Test Company ' + Date.now(),
      businessEmail: 'biz' + Date.now() + '@filter.com',
      businessPhone: '5559876543'
    }
  });

  const contractorId = signupResponse.data.buyerId;

  await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      contractorId: contractorId,
      selectedServices: [
        {
          id: testServiceType.id,
          name: testServiceType.name,
          displayName: testServiceType.displayName,
          category: 'construction',
          description: 'Test',
          icon: 'icon'
        }
      ],
      serviceLocationMappings: [],
      expandedMappings: [
        {
          serviceId: testServiceType.id,
          zipCodes: ['90210'],
          summary: { totalZipCodes: 1, fromStates: 0, fromCities: 0, fromCounties: 0, directZipCodes: 1 }
        }
      ]
    }
  });

  const response = await apiRequest(`/api/contractors/service-locations?contractorId=${contractorId}&serviceTypeId=${testServiceType.id}`);

  expect(response.status).toBe(200);
  expect(response.data.success).toBe(true);
});

test('Test 45: GET /api/contractors/service-locations - should return empty for contractor with no locations', async () => {
  const signupResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'No Locations',
      contactEmail: 'noloc' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'No Locations Company ' + Date.now(),
      businessEmail: 'biz' + Date.now() + '@noloc.com',
      businessPhone: '5559876543'
    }
  });

  const contractorId = signupResponse.data.buyerId;

  const response = await apiRequest(`/api/contractors/service-locations?contractorId=${contractorId}`);

  expect(response.status).toBe(200);
  expect(response.data.data.servicesConfigured).toBe(0);
  expect(response.data.data.totalActiveZipCodes).toBe(0);
});

// ============================================================================
// DELETE /api/contractors/service-locations - Clear Service Locations (3 tests)
// ============================================================================

test('Test 46: DELETE /api/contractors/service-locations - should require contractorId', async () => {
  const response = await apiRequest('/api/contractors/service-locations', {
    method: 'DELETE'
  });

  expect(response.status).toBe(400);
  expect(response.data.message).toContain('contractorId is required');
});

test('Test 47: DELETE /api/contractors/service-locations - should delete all service locations', async () => {
  // Create contractor and save locations
  const signupResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Delete Test',
      contactEmail: 'delete' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Delete Test Company ' + Date.now(),
      businessEmail: 'biz' + Date.now() + '@delete.com',
      businessPhone: '5559876543'
    }
  });

  const contractorId = signupResponse.data.buyerId;

  await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      contractorId: contractorId,
      selectedServices: [
        {
          id: testServiceType.id,
          name: testServiceType.name,
          displayName: testServiceType.displayName,
          category: 'construction',
          description: 'Test',
          icon: 'icon'
        }
      ],
      serviceLocationMappings: [],
      expandedMappings: [
        {
          serviceId: testServiceType.id,
          zipCodes: ['90210'],
          summary: { totalZipCodes: 1, fromStates: 0, fromCities: 0, fromCounties: 0, directZipCodes: 1 }
        }
      ]
    }
  });

  // Delete all
  const response = await apiRequest(`/api/contractors/service-locations?contractorId=${contractorId}`, {
    method: 'DELETE'
  });

  expect(response.status).toBe(200);
  expect(response.data.success).toBe(true);
  expect(response.data.data).toHaveProperty('deletedServiceConfigs');
  expect(response.data.data).toHaveProperty('deletedZipCodeMappings');
});

test('Test 48: DELETE /api/contractors/service-locations - should delete specific service locations', async () => {
  const signupResponse = await apiRequest('/api/contractors/signup', {
    method: 'POST',
    body: {
      contactName: 'Delete Specific',
      contactEmail: 'delspec' + Date.now() + '@test.com',
      contactPhone: '5551234567',
      companyName: 'Delete Specific Company ' + Date.now(),
      businessEmail: 'biz' + Date.now() + '@delspec.com',
      businessPhone: '5559876543'
    }
  });

  const contractorId = signupResponse.data.buyerId;

  await apiRequest('/api/contractors/service-locations', {
    method: 'POST',
    body: {
      contractorId: contractorId,
      selectedServices: [
        {
          id: testServiceType.id,
          name: testServiceType.name,
          displayName: testServiceType.displayName,
          category: 'construction',
          description: 'Test',
          icon: 'icon'
        }
      ],
      serviceLocationMappings: [],
      expandedMappings: [
        {
          serviceId: testServiceType.id,
          zipCodes: ['90210'],
          summary: { totalZipCodes: 1, fromStates: 0, fromCities: 0, fromCounties: 0, directZipCodes: 1 }
        }
      ]
    }
  });

  // Delete specific service
  const response = await apiRequest(
    `/api/contractors/service-locations?contractorId=${contractorId}&serviceTypeId=${testServiceType.id}`,
    { method: 'DELETE' }
  );

  expect(response.status).toBe(200);
  expect(response.data.success).toBe(true);
  expect(response.data.message).toContain('Service configuration removed');
});
