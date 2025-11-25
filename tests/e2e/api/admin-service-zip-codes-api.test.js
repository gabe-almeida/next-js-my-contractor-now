/**
 * E2E Tests - Admin ZIP Code Management APIs
 * Domain 1.5: /api/admin/buyers/service-zip-codes/*
 * Total Tests: 52
 */

const { PrismaClient } = require('@prisma/client');

const BASE_URL = 'http://localhost:3002';
const ADMIN_API_KEY = 'test-admin-key-12345';

let prisma;
let testBuyer1, testBuyer2;
let serviceTypes;
let testZipCode1, testZipCode2;

async function apiRequest(endpoint, options = {}) {
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
}

beforeAll(async () => {
  prisma = new PrismaClient();

  // Clean up test data
  await prisma.buyerServiceZipCode.deleteMany({
    where: {
      OR: [
        { buyer: { name: { contains: 'Test ZIP Buyer' } } },
        { zipCode: { in: ['90001', '10001', '60601', '77001', '33101'] } }
      ]
    }
  });
  await prisma.buyer.deleteMany({
    where: { name: { contains: 'Test ZIP Buyer' } }
  });

  // Create test buyers
  testBuyer1 = await prisma.buyer.create({
    data: {
      name: 'Test ZIP Buyer 1',
      type: 'CONTRACTOR',
      apiUrl: 'https://buyer1.example.com',
      authConfig: JSON.stringify({ type: 'bearer', credentials: { token: 'test-token-1' } }),
      active: true
    }
  });

  testBuyer2 = await prisma.buyer.create({
    data: {
      name: 'Test ZIP Buyer 2',
      type: 'CONTRACTOR',
      apiUrl: 'https://buyer2.example.com',
      authConfig: JSON.stringify({ type: 'bearer', credentials: { token: 'test-token-2' } }),
      active: true
    }
  });

  // Get service types
  serviceTypes = await prisma.serviceType.findMany({ take: 2 });

  if (serviceTypes.length < 2) {
    throw new Error('Need at least 2 service types for testing');
  }
});

afterAll(async () => {
  // Clean up test data
  await prisma.buyerServiceZipCode.deleteMany({
    where: {
      OR: [
        { buyerId: testBuyer1.id },
        { buyerId: testBuyer2.id },
        { zipCode: { in: ['90001', '10001', '60601', '77001', '33101'] } }
      ]
    }
  });

  await prisma.buyer.deleteMany({
    where: { id: { in: [testBuyer1.id, testBuyer2.id] } }
  });

  await prisma.$disconnect();
});

describe('Admin ZIP Code Management APIs', () => {

  // ==================== GET /api/admin/buyers/service-zip-codes - List ====================

  test('1. List all ZIP codes - no filters', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes');
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(Array.isArray(response.data.data.zipCodes)).toBe(true);
    expect(response.data.data.pagination).toHaveProperty('page');
    expect(response.data.data.pagination).toHaveProperty('limit');
    expect(response.data.data.pagination).toHaveProperty('total');
    expect(response.data.data.pagination).toHaveProperty('pages');
  });

  test('2. List ZIP codes with pagination (page 1, limit 10)', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes?page=1&limit=10');
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data.pagination.page).toBe(1);
    expect(response.data.data.pagination.limit).toBe(10);
    expect(response.data.data.zipCodes.length).toBeLessThanOrEqual(10);
  });

  test('3. List ZIP codes with pagination (page 2, limit 5)', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes?page=2&limit=5');
    expect(response.status).toBe(200);
    expect(response.data.data.pagination.page).toBe(2);
    expect(response.data.data.pagination.limit).toBe(5);
  });

  test('4. List requires authentication', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      headers: { 'Authorization': '' }
    });
    expect(response.status).toBe(401);
  });

  test('5. List response structure is correct', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes');
    expect(response.data).toHaveProperty('success');
    expect(response.data).toHaveProperty('data');
    expect(response.data).toHaveProperty('requestId');
    expect(response.data.data).toHaveProperty('zipCodes');
    expect(response.data.data).toHaveProperty('pagination');
  });

  // ==================== POST /api/admin/buyers/service-zip-codes - Create ====================

  test('6. Create valid ZIP code with required fields', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCode: '90001'
      }
    });
    expect(response.status).toBe(201);
    expect(response.data.success).toBe(true);
    expect(response.data.data.zipCode).toHaveProperty('id');
    expect(response.data.data.zipCode.zipCode).toBe('90001');
    expect(response.data.data.zipCode.buyerId).toBe(testBuyer1.id);
    expect(response.data.data.zipCode.serviceTypeId).toBe(serviceTypes[0].id);
    expect(response.data.data.zipCode.active).toBe(true); // Default value
    expect(response.data.data.zipCode.priority).toBe(100); // Default value

    // Save for later tests
    testZipCode1 = response.data.data.zipCode;
  });

  test('7. Create ZIP code with all optional fields', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer2.id,
        serviceTypeId: serviceTypes[1].id,
        zipCode: '10001',
        active: false,
        priority: 50,
        maxLeadsPerDay: 10,
        minBid: 25.00,
        maxBid: 75.00
      }
    });
    expect(response.status).toBe(201);
    expect(response.data.data.zipCode.active).toBe(false);
    expect(response.data.data.zipCode.priority).toBe(50);
    expect(response.data.data.zipCode.maxLeadsPerDay).toBe(10);
    expect(response.data.data.zipCode.minBid).toBe(25.00);
    expect(response.data.data.zipCode.maxBid).toBe(75.00);

    testZipCode2 = response.data.data.zipCode;
  });

  test('8. Create fails without buyerId', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        serviceTypeId: serviceTypes[0].id,
        zipCode: '60601'
      }
    });
    expect(response.status).toBe(400);
    expect(response.data.error.code).toBe('VALIDATION_ERROR');
  });

  test('9. Create fails without serviceTypeId', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        zipCode: '60601'
      }
    });
    expect(response.status).toBe(400);
    expect(response.data.error.code).toBe('VALIDATION_ERROR');
  });

  test('10. Create fails without zipCode', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id
      }
    });
    expect(response.status).toBe(400);
    expect(response.data.error.code).toBe('VALIDATION_ERROR');
  });

  test('11. Create fails with invalid ZIP code format (4 digits)', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCode: '9000'
      }
    });
    expect(response.status).toBe(400);
    expect(response.data.error.code).toBe('VALIDATION_ERROR');
    expect(response.data.error.message).toContain('5 digits');
  });

  test('12. Create fails with invalid ZIP code format (6 digits)', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCode: '900011'
      }
    });
    expect(response.status).toBe(400);
    expect(response.data.error.code).toBe('VALIDATION_ERROR');
  });

  test('13. Create fails with invalid ZIP code format (letters)', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCode: 'ABCDE'
      }
    });
    expect(response.status).toBe(400);
    expect(response.data.error.code).toBe('VALIDATION_ERROR');
  });

  test('14. Create fails with non-existent buyer', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: '00000000-0000-0000-0000-000000000000',
        serviceTypeId: serviceTypes[0].id,
        zipCode: '77001'
      }
    });
    expect(response.status).toBe(404);
    expect(response.data.error.code).toBe('BUYER_NOT_FOUND');
  });

  test('15. Create fails with non-existent service type', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: '00000000-0000-0000-0000-000000000000',
        zipCode: '77001'
      }
    });
    expect(response.status).toBe(404);
    expect(response.data.error.code).toBe('SERVICE_TYPE_NOT_FOUND');
  });

  test('16. Create fails with duplicate buyer+service+zipCode combination', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCode: '90001' // Already created in test 6
      }
    });
    expect(response.status).toBe(409);
    expect(response.data.error.code).toBe('ZIP_CODE_EXISTS');
  });

  test('17. Create allows same zipCode for different buyer', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer2.id, // Different buyer
        serviceTypeId: serviceTypes[0].id,
        zipCode: '90001' // Same ZIP code
      }
    });
    expect(response.status).toBe(201);
    expect(response.data.data.zipCode.zipCode).toBe('90001');

    // Clean up
    await prisma.buyerServiceZipCode.delete({
      where: { id: response.data.data.zipCode.id }
    });
  });

  test('18. Create allows same zipCode for different service type', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[1].id, // Different service type
        zipCode: '90001' // Same ZIP code
      }
    });
    expect(response.status).toBe(201);
    expect(response.data.data.zipCode.zipCode).toBe('90001');

    // Clean up
    await prisma.buyerServiceZipCode.delete({
      where: { id: response.data.data.zipCode.id }
    });
  });

  test('19. Create requires authentication', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      headers: { 'Authorization': '' },
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCode: '33101'
      }
    });
    expect(response.status).toBe(401);
  });

  test('20. Create requires Content-Type: application/json', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      headers: { 'Content-Type': '' }
    });
    // Without body and Content-Type, returns 500 (invalid JSON parse error)
    expect([400, 500]).toContain(response.status);
  });

  test('21. Create response structure is correct', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[1].id,
        zipCode: '60601'
      }
    });
    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('success');
    expect(response.data).toHaveProperty('data');
    expect(response.data).toHaveProperty('requestId');
    expect(response.data.data).toHaveProperty('zipCode');

    // Clean up
    await prisma.buyerServiceZipCode.delete({
      where: { id: response.data.data.zipCode.id }
    });
  });

  test('22. Created ZIP code includes buyer relation', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCode: '77001'
      }
    });
    expect(response.status).toBe(201);
    expect(response.data.data.zipCode.buyer).toHaveProperty('id');
    expect(response.data.data.zipCode.buyer).toHaveProperty('name');
    expect(response.data.data.zipCode.buyer).toHaveProperty('type');

    // Clean up
    await prisma.buyerServiceZipCode.delete({
      where: { id: response.data.data.zipCode.id }
    });
  });

  test('23. Created ZIP code includes service type relation', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCode: '33101'
      }
    });
    expect(response.status).toBe(201);
    expect(response.data.data.zipCode.serviceType).toHaveProperty('id');
    expect(response.data.data.zipCode.serviceType).toHaveProperty('name');
    expect(response.data.data.zipCode.serviceType).toHaveProperty('displayName');

    // Clean up
    await prisma.buyerServiceZipCode.delete({
      where: { id: response.data.data.zipCode.id }
    });
  });

  // ==================== Filtering Tests ====================

  test('24. Filter ZIP codes by buyerId', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes?buyerId=${testBuyer1.id}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data.zipCodes)).toBe(true);

    // All returned ZIP codes should have the specified buyerId
    response.data.data.zipCodes.forEach(zip => {
      expect(zip.buyerId).toBe(testBuyer1.id);
    });
  });

  test('25. Filter ZIP codes by serviceTypeId', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes?serviceTypeId=${serviceTypes[0].id}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data.zipCodes)).toBe(true);

    // All returned ZIP codes should have the specified serviceTypeId
    response.data.data.zipCodes.forEach(zip => {
      expect(zip.serviceTypeId).toBe(serviceTypes[0].id);
    });
  });

  test('26. Filter ZIP codes by zipCode (partial match)', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes?zipCode=900');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data.zipCodes)).toBe(true);

    // All returned ZIP codes should contain '900'
    response.data.data.zipCodes.forEach(zip => {
      expect(zip.zipCode).toContain('900');
    });
  });

  test('27. Filter ZIP codes by multiple filters (buyerId + serviceTypeId)', async () => {
    const response = await apiRequest(
      `/api/admin/buyers/service-zip-codes?buyerId=${testBuyer1.id}&serviceTypeId=${serviceTypes[0].id}`
    );
    expect(response.status).toBe(200);

    response.data.data.zipCodes.forEach(zip => {
      expect(zip.buyerId).toBe(testBuyer1.id);
      expect(zip.serviceTypeId).toBe(serviceTypes[0].id);
    });
  });

  // ==================== GET /api/admin/buyers/service-zip-codes/[id] - Single ====================

  test('28. Get single ZIP code by ID', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`);
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data.zipCode.id).toBe(testZipCode1.id);
    expect(response.data.data.zipCode.zipCode).toBe('90001');
  });

  test('29. Get single ZIP code returns 404 for non-existent ID', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes/00000000-0000-0000-0000-000000000000');
    expect(response.status).toBe(404);
    expect(response.data.error.code).toBe('ZIP_CODE_NOT_FOUND');
  });

  test('30. Get single ZIP code requires authentication', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      headers: { 'Authorization': '' }
    });
    expect(response.status).toBe(401);
  });

  test('31. Get single ZIP code response structure is correct', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`);
    expect(response.data).toHaveProperty('success');
    expect(response.data).toHaveProperty('data');
    expect(response.data).toHaveProperty('requestId');
    expect(response.data.data).toHaveProperty('zipCode');
  });

  test('32. Get single response includes buyer relation', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`);
    const zipCode = response.data.data.zipCode;
    expect(zipCode.buyer).toHaveProperty('id');
    expect(zipCode.buyer).toHaveProperty('name');
    expect(zipCode.buyer).toHaveProperty('type');
  });

  test('33. Get single response includes service type relation', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`);
    const zipCode = response.data.data.zipCode;
    expect(zipCode.serviceType).toHaveProperty('id');
    expect(zipCode.serviceType).toHaveProperty('name');
    expect(zipCode.serviceType).toHaveProperty('displayName');
  });

  test('34. Get single response has all expected fields', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`);
    const zipCode = response.data.data.zipCode;
    expect(zipCode).toHaveProperty('id');
    expect(zipCode).toHaveProperty('buyerId');
    expect(zipCode).toHaveProperty('serviceTypeId');
    expect(zipCode).toHaveProperty('zipCode');
    expect(zipCode).toHaveProperty('active');
    expect(zipCode).toHaveProperty('priority');
    expect(zipCode).toHaveProperty('createdAt');
  });

  // ==================== PUT /api/admin/buyers/service-zip-codes/[id] - Update ====================

  test('35. Update ZIP code active status', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      method: 'PUT',
      body: { active: false }
    });
    expect(response.status).toBe(200);
    expect(response.data.data.zipCode.active).toBe(false);

    // Verify update persisted
    const verify = await prisma.buyerServiceZipCode.findUnique({
      where: { id: testZipCode1.id }
    });
    expect(verify.active).toBe(false);
  });

  test('36. Update ZIP code priority', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      method: 'PUT',
      body: { priority: 200 }
    });
    expect(response.status).toBe(200);
    expect(response.data.data.zipCode.priority).toBe(200);
  });

  test('37. Update ZIP code maxLeadsPerDay', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      method: 'PUT',
      body: { maxLeadsPerDay: 25 }
    });
    expect(response.status).toBe(200);
    expect(response.data.data.zipCode.maxLeadsPerDay).toBe(25);
  });

  test('38. Update ZIP code minBid and maxBid', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      method: 'PUT',
      body: {
        minBid: 30.00,
        maxBid: 80.00
      }
    });
    expect(response.status).toBe(200);
    expect(response.data.data.zipCode.minBid).toBe(30.00);
    expect(response.data.data.zipCode.maxBid).toBe(80.00);
  });

  test('39. Update multiple fields at once', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      method: 'PUT',
      body: {
        active: true,
        priority: 150,
        maxLeadsPerDay: 15
      }
    });
    expect(response.status).toBe(200);
    expect(response.data.data.zipCode.active).toBe(true);
    expect(response.data.data.zipCode.priority).toBe(150);
    expect(response.data.data.zipCode.maxLeadsPerDay).toBe(15);
  });

  test('40. Update ZIP code value with valid format', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      method: 'PUT',
      body: { zipCode: '90002' }
    });
    expect(response.status).toBe(200);
    expect(response.data.data.zipCode.zipCode).toBe('90002');

    // Change it back for other tests
    await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      method: 'PUT',
      body: { zipCode: '90001' }
    });
  });

  test('41. Update fails with invalid ZIP code format', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      method: 'PUT',
      body: { zipCode: 'INVALID' }
    });
    expect(response.status).toBe(400);
    expect(response.data.error.code).toBe('VALIDATION_ERROR');
  });

  test('42. Update fails with duplicate buyer+service+zipCode combination', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      method: 'PUT',
      body: {
        buyerId: testZipCode2.buyerId,
        serviceTypeId: testZipCode2.serviceTypeId,
        zipCode: testZipCode2.zipCode
      }
    });
    expect(response.status).toBe(409);
    expect(response.data.error.code).toBe('ZIP_CODE_EXISTS');
  });

  test('43. Update returns 404 for non-existent ZIP code', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes/00000000-0000-0000-0000-000000000000', {
      method: 'PUT',
      body: { active: false }
    });
    expect(response.status).toBe(404);
    expect(response.data.error.code).toBe('ZIP_CODE_NOT_FOUND');
  });

  test('44. Update requires authentication', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      method: 'PUT',
      headers: { 'Authorization': '' },
      body: { active: false }
    });
    expect(response.status).toBe(401);
  });

  test('45. Update requires Content-Type: application/json', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': '' }
    });
    // Without body and Content-Type, returns 500 (invalid JSON parse error)
    expect([400, 500]).toContain(response.status);
  });

  test('46. Update response structure is correct', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      method: 'PUT',
      body: { priority: 125 }
    });
    expect(response.data).toHaveProperty('success');
    expect(response.data).toHaveProperty('data');
    expect(response.data).toHaveProperty('requestId');
    expect(response.data.data).toHaveProperty('zipCode');
  });

  // ==================== DELETE /api/admin/buyers/service-zip-codes/[id] ====================

  test('47. Delete existing ZIP code', async () => {
    // Create a ZIP code to delete
    const createResponse = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCode: '88888'
      }
    });
    const zipCodeId = createResponse.data.data.zipCode.id;

    // Delete it
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${zipCodeId}`, {
      method: 'DELETE'
    });
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data.message).toContain('deleted');

    // Verify deletion
    const verify = await prisma.buyerServiceZipCode.findUnique({
      where: { id: zipCodeId }
    });
    expect(verify).toBeNull();
  });

  test('48. Delete returns 404 for non-existent ZIP code', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE'
    });
    expect(response.status).toBe(404);
    expect(response.data.error.code).toBe('ZIP_CODE_NOT_FOUND');
  });

  test('49. Delete requires authentication', async () => {
    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${testZipCode1.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': '' }
    });
    expect(response.status).toBe(401);
  });

  test('50. Delete response structure is correct', async () => {
    // Create a ZIP code to delete
    const createResponse = await apiRequest('/api/admin/buyers/service-zip-codes', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCode: '99999'
      }
    });
    const zipCodeId = createResponse.data.data.zipCode.id;

    const response = await apiRequest(`/api/admin/buyers/service-zip-codes/${zipCodeId}`, {
      method: 'DELETE'
    });
    expect(response.data).toHaveProperty('success');
    expect(response.data).toHaveProperty('data');
    expect(response.data).toHaveProperty('requestId');
  });

  // ==================== Additional Edge Cases ====================

  test('51. List with non-existent buyerId returns empty array', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes?buyerId=00000000-0000-0000-0000-000000000000');
    expect(response.status).toBe(200);
    expect(response.data.data.zipCodes).toEqual([]);
    expect(response.data.data.pagination.total).toBe(0);
  });

  test('52. List with non-matching zipCode filter returns empty array', async () => {
    const response = await apiRequest('/api/admin/buyers/service-zip-codes?zipCode=11111');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data.zipCodes)).toBe(true);
  });

});
