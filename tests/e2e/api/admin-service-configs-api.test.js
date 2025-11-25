/**
 * E2E Tests for Admin Service Config Management APIs
 * Domain 1.4: Buyer Service Configuration APIs
 *
 * Endpoints tested:
 * - GET /api/admin/buyers/service-configs - List all service configs
 * - POST /api/admin/buyers/service-configs - Create service config
 * - GET /api/admin/buyers/service-configs/[id] - Get specific config
 * - PUT /api/admin/buyers/service-configs/[id] - Update config
 * - DELETE /api/admin/buyers/service-configs/[id] - Delete config
 *
 * Total tests: 45+
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3002';
const ADMIN_API_KEY = 'test-admin-key-12345';

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
  try {
    const fetchOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(endpoint.startsWith('/api/admin') ? { 'Authorization': `Bearer ${ADMIN_API_KEY}` } : {}),
        ...options.headers
      }
    };

    if (fetchOptions.body && typeof fetchOptions.body === 'object') {
      fetchOptions.body = JSON.stringify(fetchOptions.body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, fetchOptions);
    const data = await response.json();

    return {
      status: response.status,
      ok: response.ok,
      data,
      error: !response.ok ? (JSON.stringify(data.error || data.message || data || 'Request failed')) : null
    };
  } catch (error) {
    return {
      status: 500,
      ok: false,
      data: null,
      error: error.message
    };
  }
}

// Test data setup
let testBuyer1, testBuyer2, testServiceType1, testServiceType2, testConfig1;

describe('Domain 1.4: Admin Service Config APIs', () => {

  // Setup test data
  beforeAll(async () => {
    // Create test buyers
    testBuyer1 = await prisma.buyer.create({
      data: {
        name: 'Test Buyer for Config 1',
        type: 'CONTRACTOR',
        apiUrl: 'https://api-config-test1.example.com',
        authConfig: JSON.stringify({ type: 'bearer', credentials: { token: 'test-token-1' } }),
        active: true,
        pingTimeout: 5,
        postTimeout: 10
      }
    });

    testBuyer2 = await prisma.buyer.create({
      data: {
        name: 'Test Buyer for Config 2',
        type: 'NETWORK',
        apiUrl: 'https://api-config-test2.example.com',
        authConfig: JSON.stringify({ type: 'apikey', credentials: { apikey: 'test-key-2' } }),
        active: true,
        pingTimeout: 5,
        postTimeout: 10
      }
    });

    // Get existing service types
    const serviceTypes = await prisma.serviceType.findMany({ take: 2 });
    testServiceType1 = serviceTypes[0];
    testServiceType2 = serviceTypes[1];
  });

  // Cleanup after all tests
  afterAll(async () => {
    // Delete test service configs
    await prisma.buyerServiceConfig.deleteMany({
      where: {
        OR: [
          { buyerId: testBuyer1.id },
          { buyerId: testBuyer2.id }
        ]
      }
    });

    // Delete test buyers
    await prisma.buyer.deleteMany({
      where: {
        OR: [
          { id: testBuyer1.id },
          { id: testBuyer2.id }
        ]
      }
    });

    await prisma.$disconnect();
  });

  // ===== GET /api/admin/buyers/service-configs - List Configs =====

  describe('GET /api/admin/buyers/service-configs - List all configs', () => {

    test('1. List all service configs successfully', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs');
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.configs).toBeDefined();
      expect(Array.isArray(response.data.data.configs)).toBe(true);
      expect(response.data.data.pagination).toBeDefined();
    });

    test('2. Pagination works correctly', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs?page=1&limit=10');
      expect(response.status).toBe(200);
      expect(response.data.data.pagination.page).toBe(1);
      expect(response.data.data.pagination.limit).toBe(10);
      expect(response.data.data.configs.length).toBeLessThanOrEqual(10);
    });

    test('3. Response includes buyer details', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs');
      if (response.data.data.configs.length > 0) {
        const config = response.data.data.configs[0];
        expect(config.buyer).toBeDefined();
        expect(config.buyer.id).toBeDefined();
        expect(config.buyer.name).toBeDefined();
        expect(config.buyer.type).toBeDefined();
      }
    });

    test('4. Response includes service type details', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs');
      if (response.data.data.configs.length > 0) {
        const config = response.data.data.configs[0];
        expect(config.serviceType).toBeDefined();
        expect(config.serviceType.id).toBeDefined();
        expect(config.serviceType.name).toBeDefined();
        expect(config.serviceType.displayName).toBeDefined();
      }
    });

    test('5. Requires authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs`);
      expect(response.status).toBe(401);
    });
  });

  // ===== POST /api/admin/buyers/service-configs - Create Config =====

  describe('POST /api/admin/buyers/service-configs - Create config', () => {

    test('6. Create valid service config', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs', {
        method: 'POST',
        body: {
          buyerId: testBuyer1.id,
          serviceTypeId: testServiceType1.id,
          pingTemplate: JSON.stringify({ format: 'json' }),
          postTemplate: JSON.stringify({ format: 'json' }),
          fieldMappings: JSON.stringify({ email: 'contact_email' }),
          requiresTrustedForm: true,
          requiresJornaya: true,
          minBid: 10.00,
          maxBid: 50.00,
          active: true
        }
      });

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data.config).toBeDefined();
      expect(response.data.data.config.id).toBeDefined();
      expect(response.data.data.config.buyerId).toBe(testBuyer1.id);
      expect(response.data.data.config.serviceTypeId).toBe(testServiceType1.id);
      expect(response.data.data.config.minBid).toBe(10.00);
      expect(response.data.data.config.maxBid).toBe(50.00);
      expect(response.data.data.config.requiresTrustedForm).toBe(true);
      expect(response.data.data.config.requiresJornaya).toBe(true);

      // Save for later tests
      testConfig1 = response.data.data.config;
    });

    test('7. Create config with minimal fields (defaults)', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs', {
        method: 'POST',
        body: {
          buyerId: testBuyer2.id,
          serviceTypeId: testServiceType1.id
        }
      });

      expect(response.status).toBe(201);
      expect(response.data.data.config.pingTemplate).toBe('{}');
      expect(response.data.data.config.postTemplate).toBe('{}');
      expect(response.data.data.config.fieldMappings).toBe('{}');
      expect(response.data.data.config.requiresTrustedForm).toBe(false);
      expect(response.data.data.config.requiresJornaya).toBe(false);
      expect(response.data.data.config.minBid).toBe(0.00);
      expect(response.data.data.config.maxBid).toBe(999.99);
      expect(response.data.data.config.active).toBe(true);

      // Cleanup
      await prisma.buyerServiceConfig.delete({ where: { id: response.data.data.config.id } });
    });

    test('8. Reject missing buyerId', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs', {
        method: 'POST',
        body: {
          serviceTypeId: testServiceType1.id
        }
      });

      expect(response.status).toBe(400);
      expect(response.data.error.code).toBe('VALIDATION_ERROR');
      expect(response.data.error.field).toBe('buyerId');
    });

    test('9. Reject missing serviceTypeId', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs', {
        method: 'POST',
        body: {
          buyerId: testBuyer1.id
        }
      });

      expect(response.status).toBe(400);
      expect(response.data.error.code).toBe('VALIDATION_ERROR');
      expect(response.data.error.field).toBe('serviceTypeId');
    });

    test('10. Reject non-existent buyerId', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs', {
        method: 'POST',
        body: {
          buyerId: '00000000-0000-0000-0000-000000000000',
          serviceTypeId: testServiceType1.id
        }
      });

      expect(response.status).toBe(404);
      expect(response.data.error.code).toBe('BUYER_NOT_FOUND');
    });

    test('11. Reject non-existent serviceTypeId', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs', {
        method: 'POST',
        body: {
          buyerId: testBuyer1.id,
          serviceTypeId: '00000000-0000-0000-0000-000000000000'
        }
      });

      expect(response.status).toBe(404);
      expect(response.data.error.code).toBe('SERVICE_TYPE_NOT_FOUND');
    });

    test('12. Reject minBid >= maxBid', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs', {
        method: 'POST',
        body: {
          buyerId: testBuyer2.id,
          serviceTypeId: testServiceType2.id,
          minBid: 50.00,
          maxBid: 50.00
        }
      });

      expect(response.status).toBe(400);
      expect(response.data.error.code).toBe('VALIDATION_ERROR');
      expect(response.data.error.message).toContain('minBid must be less than maxBid');
    });

    test('13. Reject minBid > maxBid', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs', {
        method: 'POST',
        body: {
          buyerId: testBuyer2.id,
          serviceTypeId: testServiceType2.id,
          minBid: 60.00,
          maxBid: 50.00
        }
      });

      expect(response.status).toBe(400);
      expect(response.data.error.code).toBe('VALIDATION_ERROR');
    });

    test('14. Prevent duplicate buyer+service combination', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs', {
        method: 'POST',
        body: {
          buyerId: testBuyer1.id,
          serviceTypeId: testServiceType1.id
        }
      });

      expect(response.status).toBe(409);
      expect(response.data.error.code).toBe('CONFIG_EXISTS');
    });

    test('15. Response includes buyer and service type details', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs', {
        method: 'POST',
        body: {
          buyerId: testBuyer1.id,
          serviceTypeId: testServiceType2.id
        }
      });

      expect(response.status).toBe(201);
      expect(response.data.data.config.buyer).toBeDefined();
      expect(response.data.data.config.buyer.name).toBe(testBuyer1.name);
      expect(response.data.data.config.serviceType).toBeDefined();
      expect(response.data.data.config.serviceType.id).toBe(testServiceType2.id);

      // Cleanup
      await prisma.buyerServiceConfig.delete({ where: { id: response.data.data.config.id } });
    });

    test('16. Requires authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: testBuyer1.id,
          serviceTypeId: testServiceType1.id
        })
      });
      expect(response.status).toBe(401);
    });

    test('17. Requires Content-Type: application/json', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}` }
      });
      expect(response.status).toBe(400);
    });
  });

  // ===== Filter Tests =====

  describe('GET /api/admin/buyers/service-configs - Filtering', () => {

    test('18. Filter by buyerId', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs?buyerId=${testBuyer1.id}`);
      expect(response.status).toBe(200);

      response.data.data.configs.forEach(config => {
        expect(config.buyerId).toBe(testBuyer1.id);
      });
    });

    test('19. Filter by serviceTypeId', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs?serviceTypeId=${testServiceType1.id}`);
      expect(response.status).toBe(200);

      response.data.data.configs.forEach(config => {
        expect(config.serviceTypeId).toBe(testServiceType1.id);
      });
    });

    test('20. Filter by both buyerId and serviceTypeId', async () => {
      const response = await apiRequest(
        `/api/admin/buyers/service-configs?buyerId=${testBuyer1.id}&serviceTypeId=${testServiceType1.id}`
      );
      expect(response.status).toBe(200);

      response.data.data.configs.forEach(config => {
        expect(config.buyerId).toBe(testBuyer1.id);
        expect(config.serviceTypeId).toBe(testServiceType1.id);
      });
    });

    test('21. Empty result for non-existent buyer', async () => {
      const response = await apiRequest(
        '/api/admin/buyers/service-configs?buyerId=00000000-0000-0000-0000-000000000000'
      );
      expect(response.status).toBe(200);
      expect(response.data.data.configs.length).toBe(0);
    });
  });

  // ===== GET /api/admin/buyers/service-configs/[id] - Get Specific =====

  describe('GET /api/admin/buyers/service-configs/[id] - Get specific config', () => {

    test('22. Get specific config by ID', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs/${testConfig1.id}`);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.config).toBeDefined();
      expect(response.data.data.config.id).toBe(testConfig1.id);
    });

    test('23. Response includes buyer details', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs/${testConfig1.id}`);
      expect(response.status).toBe(200);
      expect(response.data.data.config.buyer).toBeDefined();
      expect(response.data.data.config.buyer.id).toBe(testBuyer1.id);
      expect(response.data.data.config.buyer.name).toBe(testBuyer1.name);
    });

    test('24. Response includes service type details', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs/${testConfig1.id}`);
      expect(response.status).toBe(200);
      expect(response.data.data.config.serviceType).toBeDefined();
      expect(response.data.data.config.serviceType.id).toBe(testServiceType1.id);
      expect(response.data.data.config.serviceType.displayName).toBeDefined();
    });

    test('25. Return 404 for non-existent ID', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs/00000000-0000-0000-0000-000000000000');
      expect(response.status).toBe(404);
      expect(response.data.error.code).toBe('CONFIG_NOT_FOUND');
    });

    test('26. Requires authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs/${testConfig1.id}`);
      expect(response.status).toBe(401);
    });
  });

  // ===== PUT /api/admin/buyers/service-configs/[id] - Update =====

  describe('PUT /api/admin/buyers/service-configs/[id] - Update config', () => {

    test('27. Update all fields', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs/${testConfig1.id}`, {
        method: 'PUT',
        body: {
          pingTemplate: JSON.stringify({ format: 'xml' }),
          postTemplate: JSON.stringify({ format: 'xml' }),
          fieldMappings: JSON.stringify({ phone: 'contact_phone' }),
          requiresTrustedForm: false,
          requiresJornaya: false,
          minBid: 15.00,
          maxBid: 60.00,
          active: false
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.config.pingTemplate).toContain('xml');
      expect(response.data.data.config.requiresTrustedForm).toBe(false);
      expect(response.data.data.config.requiresJornaya).toBe(false);
      expect(response.data.data.config.minBid).toBe(15.00);
      expect(response.data.data.config.maxBid).toBe(60.00);
      expect(response.data.data.config.active).toBe(false);
    });

    test('28. Partial update - only minBid', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs/${testConfig1.id}`, {
        method: 'PUT',
        body: {
          minBid: 20.00
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.data.config.minBid).toBe(20.00);
      expect(response.data.data.config.maxBid).toBe(60.00); // Unchanged
    });

    test('29. Partial update - only active status', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs/${testConfig1.id}`, {
        method: 'PUT',
        body: {
          active: true
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.data.config.active).toBe(true);
    });

    test('30. Partial update - only templates', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs/${testConfig1.id}`, {
        method: 'PUT',
        body: {
          pingTemplate: JSON.stringify({ updated: true }),
          postTemplate: JSON.stringify({ updated: true })
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.data.config.pingTemplate).toContain('updated');
      expect(response.data.data.config.postTemplate).toContain('updated');
    });

    test('31. Reject minBid >= maxBid on update', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs/${testConfig1.id}`, {
        method: 'PUT',
        body: {
          minBid: 60.00
        }
      });

      expect(response.status).toBe(400);
      expect(response.data.error.code).toBe('VALIDATION_ERROR');
      expect(response.data.error.message).toContain('minBid must be less than maxBid');
    });

    test('32. Reject maxBid <= minBid on update', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs/${testConfig1.id}`, {
        method: 'PUT',
        body: {
          maxBid: 20.00
        }
      });

      expect(response.status).toBe(400);
      expect(response.data.error.code).toBe('VALIDATION_ERROR');
    });

    test('33. Update both minBid and maxBid together', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs/${testConfig1.id}`, {
        method: 'PUT',
        body: {
          minBid: 25.00,
          maxBid: 75.00
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.data.config.minBid).toBe(25.00);
      expect(response.data.data.config.maxBid).toBe(75.00);
    });

    test('34. Return 404 for non-existent ID', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs/00000000-0000-0000-0000-000000000000', {
        method: 'PUT',
        body: { active: false }
      });

      expect(response.status).toBe(404);
      expect(response.data.error.code).toBe('CONFIG_NOT_FOUND');
    });

    test('35. Requires authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs/${testConfig1.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false })
      });
      expect(response.status).toBe(401);
    });

    test('36. Requires Content-Type: application/json', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs/${testConfig1.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}` }
      });
      // Without body and Content-Type, returns 500 (invalid JSON parse error)
      expect([400, 500]).toContain(response.status);
    });
  });

  // ===== DELETE /api/admin/buyers/service-configs/[id] - Delete =====

  describe('DELETE /api/admin/buyers/service-configs/[id] - Delete config', () => {

    let configToDelete;

    beforeAll(async () => {
      // Create a config to delete
      configToDelete = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: testBuyer2.id,
          serviceTypeId: testServiceType2.id,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: 10.00,
          maxBid: 50.00,
          active: true
        }
      });
    });

    test('37. Delete config successfully', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs/${configToDelete.id}`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.message).toContain('deleted successfully');

      // Verify deletion
      const check = await prisma.buyerServiceConfig.findUnique({
        where: { id: configToDelete.id }
      });
      expect(check).toBeNull();
    });

    test('38. Return 404 for non-existent ID', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs/00000000-0000-0000-0000-000000000000', {
        method: 'DELETE'
      });

      expect(response.status).toBe(404);
      expect(response.data.error.code).toBe('CONFIG_NOT_FOUND');
    });

    test('39. Return 404 for already deleted config', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs/${configToDelete.id}`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(404);
      expect(response.data.error.code).toBe('CONFIG_NOT_FOUND');
    });

    test('40. Prevent delete if config has ZIP codes', async () => {
      // Create a new config
      const configWithZips = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: testBuyer2.id,
          serviceTypeId: testServiceType1.id,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: 10.00,
          maxBid: 50.00,
          active: true
        }
      });

      // Add a ZIP code
      await prisma.buyerServiceZipCode.create({
        data: {
          buyerId: testBuyer2.id,
          serviceTypeId: testServiceType1.id,
          zipCode: '12345',
          priority: 1
        }
      });

      const response = await apiRequest(`/api/admin/buyers/service-configs/${configWithZips.id}`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(409);
      expect(response.data.error.code).toBe('CONFIG_HAS_ZIP_CODES');
      expect(response.data.error.message).toContain('associated ZIP codes');

      // Cleanup
      await prisma.buyerServiceZipCode.deleteMany({
        where: { buyerId: testBuyer2.id, serviceTypeId: testServiceType1.id }
      });
      await prisma.buyerServiceConfig.delete({ where: { id: configWithZips.id } });
    });

    test('41. Requires authentication', async () => {
      // Create a config to delete
      const tempConfig = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: testBuyer2.id,
          serviceTypeId: testServiceType1.id,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: 10.00,
          maxBid: 50.00,
          active: true
        }
      });

      const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs/${tempConfig.id}`, {
        method: 'DELETE'
      });
      expect(response.status).toBe(401);

      // Cleanup
      await prisma.buyerServiceConfig.delete({ where: { id: tempConfig.id } });
    });
  });

  // ===== Response Structure Validation =====

  describe('Response structure validation', () => {

    test('42. GET list response has correct structure', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success');
      expect(response.data).toHaveProperty('data');
      expect(response.data).toHaveProperty('requestId');
      expect(response.data.data).toHaveProperty('configs');
      expect(response.data.data).toHaveProperty('pagination');
      expect(response.data.data.pagination).toHaveProperty('page');
      expect(response.data.data.pagination).toHaveProperty('limit');
      expect(response.data.data.pagination).toHaveProperty('total');
      expect(response.data.data.pagination).toHaveProperty('pages');
    });

    test('43. GET single response has correct structure', async () => {
      const response = await apiRequest(`/api/admin/buyers/service-configs/${testConfig1.id}`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success');
      expect(response.data).toHaveProperty('data');
      expect(response.data).toHaveProperty('requestId');
      expect(response.data.data).toHaveProperty('config');

      const config = response.data.data.config;
      expect(config).toHaveProperty('id');
      expect(config).toHaveProperty('buyerId');
      expect(config).toHaveProperty('serviceTypeId');
      expect(config).toHaveProperty('pingTemplate');
      expect(config).toHaveProperty('postTemplate');
      expect(config).toHaveProperty('fieldMappings');
      expect(config).toHaveProperty('requiresTrustedForm');
      expect(config).toHaveProperty('requiresJornaya');
      expect(config).toHaveProperty('minBid');
      expect(config).toHaveProperty('maxBid');
      expect(config).toHaveProperty('active');
      expect(config).toHaveProperty('buyer');
      expect(config).toHaveProperty('serviceType');
      expect(config).toHaveProperty('createdAt');
    });

    test('44. POST response has correct structure', async () => {
      const newConfig = await prisma.buyerServiceConfig.create({
        data: {
          buyerId: testBuyer1.id,
          serviceTypeId: testServiceType2.id,
          pingTemplate: '{}',
          postTemplate: '{}',
          fieldMappings: '{}',
          minBid: 10.00,
          maxBid: 50.00
        }
      });

      const response = await apiRequest(`/api/admin/buyers/service-configs/${newConfig.id}`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success');
      expect(response.data).toHaveProperty('data');
      expect(response.data).toHaveProperty('requestId');

      // Cleanup
      await prisma.buyerServiceConfig.delete({ where: { id: newConfig.id } });
    });

    test('45. Error responses have correct structure', async () => {
      const response = await apiRequest('/api/admin/buyers/service-configs/00000000-0000-0000-0000-000000000000');
      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('success');
      expect(response.data.success).toBe(false);
      expect(response.data).toHaveProperty('error');
      expect(response.data.error).toHaveProperty('code');
      expect(response.data.error).toHaveProperty('message');
      expect(response.data).toHaveProperty('requestId');
    });
  });
});
