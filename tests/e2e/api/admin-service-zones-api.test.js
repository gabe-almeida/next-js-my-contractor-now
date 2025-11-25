/**
 * E2E Tests - Admin Service Zones APIs
 * Domain 1.6: /api/admin/service-zones/*
 * Total Tests: 57
 */

const { PrismaClient } = require('@prisma/client');

const BASE_URL = 'http://localhost:3002';
const ADMIN_API_KEY = 'test-admin-key-12345';

let prisma;
let testBuyer1, testBuyer2;
let serviceTypes;
let testZone1, testZone2;

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
      buyer: { name: { contains: 'Test Zone Buyer' } }
    }
  });
  await prisma.buyer.deleteMany({
    where: { name: { contains: 'Test Zone Buyer' } }
  });

  // Create test buyers
  testBuyer1 = await prisma.buyer.create({
    data: {
      name: 'Test Zone Buyer 1',
      type: 'CONTRACTOR',
      apiUrl: 'https://buyer1.example.com',
      authConfig: JSON.stringify({ type: 'bearer', credentials: { token: 'test-token-1' } }),
      active: true
    }
  });

  testBuyer2 = await prisma.buyer.create({
    data: {
      name: 'Test Zone Buyer 2',
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
        { buyerId: testBuyer2.id }
      ]
    }
  });

  await prisma.buyer.deleteMany({
    where: { id: { in: [testBuyer1.id, testBuyer2.id] } }
  });

  await prisma.$disconnect();
});

describe('Admin Service Zones APIs', () => {

  // ==================== GET /api/admin/service-zones - List ====================

  test('1. List all service zones - no filters', async () => {
    const response = await apiRequest('/api/admin/service-zones');
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data).toHaveProperty('data');
    expect(response.data.data).toHaveProperty('pagination');
    expect(Array.isArray(response.data.data.data)).toBe(true);
  });

  test('2. List with pagination (page 1, limit 10)', async () => {
    const response = await apiRequest('/api/admin/service-zones?page=1&limit=10');
    expect(response.status).toBe(200);
    expect(response.data.data.pagination.page).toBe(1);
    expect(response.data.data.pagination.limit).toBe(10);
    expect(response.data.data.data.length).toBeLessThanOrEqual(10);
  });

  test('3. List with pagination (page 2, limit 5)', async () => {
    const response = await apiRequest('/api/admin/service-zones?page=2&limit=5');
    expect(response.status).toBe(200);
    expect(response.data.data.pagination.page).toBe(2);
    expect(response.data.data.pagination.limit).toBe(5);
  });

  test('4. List requires authentication', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
      headers: { 'Authorization': '' }
    });
    expect(response.status).toBe(401);
  });

  test('5. List response structure is correct', async () => {
    const response = await apiRequest('/api/admin/service-zones');
    expect(response.data).toHaveProperty('success');
    expect(response.data).toHaveProperty('data');
    expect(response.data).toHaveProperty('requestId');
    expect(response.data.data).toHaveProperty('data');
    expect(response.data.data).toHaveProperty('pagination');
  });

  // ==================== POST /api/admin/service-zones - Create Single ====================

  test('6. Create single service zone with required fields', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCode: '90001'
      }
    });
    expect(response.status).toBe(201);
    expect(response.data.success).toBe(true);
    expect(response.data.data.serviceZone).toHaveProperty('id');
    expect(response.data.data.serviceZone.zipCode).toBe('90001');
    expect(response.data.data.serviceZone.buyerId).toBe(testBuyer1.id);
    expect(response.data.data.serviceZone.serviceTypeId).toBe(serviceTypes[0].id);
    expect(response.data.data.serviceZone.active).toBe(true);
    expect(response.data.data.serviceZone.priority).toBe(100);

    testZone1 = response.data.data.serviceZone;
  });

  test('7. Create service zone with all optional fields', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
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
    expect(response.data.data.serviceZone.active).toBe(false);
    expect(response.data.data.serviceZone.priority).toBe(50);
    expect(response.data.data.serviceZone.maxLeadsPerDay).toBe(10);
    expect(response.data.data.serviceZone.minBid).toBe(25.00);
    expect(response.data.data.serviceZone.maxBid).toBe(75.00);

    testZone2 = response.data.data.serviceZone;
  });

  test('8. Create fails without buyerId', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        serviceTypeId: serviceTypes[0].id,
        zipCode: '60601'
      }
    });
    expect(response.status).toBe(400);
  });

  test('9. Create fails without serviceTypeId', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        zipCode: '60601'
      }
    });
    expect(response.status).toBe(400);
  });

  test('10. Create fails without zipCode', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id
      }
    });
    expect(response.status).toBe(400);
  });

  test('11. Create fails with invalid ZIP code format (4 digits)', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCode: '9000'
      }
    });
    expect(response.status).toBe(400);
  });

  test('12. Create fails with invalid buyerId format', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        buyerId: 'invalid-uuid',
        serviceTypeId: serviceTypes[0].id,
        zipCode: '90001'
      }
    });
    expect(response.status).toBe(400);
  });

  test('13. Create requires authentication', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
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

  test('14. Create requires Content-Type: application/json', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      headers: { 'Content-Type': '' }
    });
    expect([400, 500]).toContain(response.status);
  });

  test('15. Create response structure is correct', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
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
    expect(response.data.data).toHaveProperty('serviceZone');

    // Clean up
    await prisma.buyerServiceZipCode.delete({
      where: { id: response.data.data.serviceZone.id }
    });
  });

  // ==================== POST /api/admin/service-zones - Bulk Create ====================

  test('16. Bulk create service zones with zipCodes array', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCodes: ['77001', '77002', '77003'],
        priority: 75
      }
    });
    expect(response.status).toBe(201);
    expect(response.data.success).toBe(true);
    expect(response.data.data.count).toBe(3);
    expect(Array.isArray(response.data.data.serviceZones)).toBe(true);
    expect(response.data.data.serviceZones.length).toBe(3);

    // Clean up
    for (const zone of response.data.data.serviceZones) {
      await prisma.buyerServiceZipCode.delete({ where: { id: zone.id } });
    }
  });

  test('17. Bulk create with single ZIP code', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCodes: ['88888']
      }
    });
    expect(response.status).toBe(201);
    expect(response.data.data.count).toBe(1);

    // Clean up
    await prisma.buyerServiceZipCode.delete({
      where: { id: response.data.data.serviceZones[0].id }
    });
  });

  test('18. Bulk create fails with empty zipCodes array', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCodes: []
      }
    });
    expect(response.status).toBe(400);
  });

  test('19. Bulk create applies same settings to all zones', async () => {
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        buyerId: testBuyer2.id,
        serviceTypeId: serviceTypes[1].id,
        zipCodes: ['91001', '91002'],
        priority: 60,
        maxLeadsPerDay: 5,
        minBid: 20.00,
        maxBid: 50.00
      }
    });
    expect(response.status).toBe(201);
    expect(response.data.data.serviceZones.length).toBe(2);

    response.data.data.serviceZones.forEach(zone => {
      expect(zone.priority).toBe(60);
      expect(zone.maxLeadsPerDay).toBe(5);
      expect(zone.minBid).toBe(20.00);
      expect(zone.maxBid).toBe(50.00);
    });

    // Clean up
    for (const zone of response.data.data.serviceZones) {
      await prisma.buyerServiceZipCode.delete({ where: { id: zone.id } });
    }
  });

  // ==================== Filtering Tests ====================

  test('20. Filter service zones by buyerId', async () => {
    const response = await apiRequest(`/api/admin/service-zones?buyerId=${testBuyer1.id}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data.data)).toBe(true);

    if (response.data.data.data.length > 0) {
      response.data.data.data.forEach(zone => {
        expect(zone.buyerId).toBe(testBuyer1.id);
      });
    }
  });

  test('21. Filter service zones by serviceTypeId', async () => {
    const response = await apiRequest(`/api/admin/service-zones?serviceTypeId=${serviceTypes[0].id}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data.data)).toBe(true);

    if (response.data.data.data.length > 0) {
      response.data.data.data.forEach(zone => {
        expect(zone.serviceTypeId).toBe(serviceTypes[0].id);
      });
    }
  });

  test('22. Filter service zones by zipCode', async () => {
    const response = await apiRequest('/api/admin/service-zones?zipCode=90001');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data.data)).toBe(true);
  });

  test('23. Filter service zones by active status', async () => {
    const response = await apiRequest('/api/admin/service-zones?active=true');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data.data)).toBe(true);
  });

  test('24. Filter by multiple parameters (buyerId + serviceTypeId)', async () => {
    const response = await apiRequest(
      `/api/admin/service-zones?buyerId=${testBuyer1.id}&serviceTypeId=${serviceTypes[0].id}`
    );
    expect(response.status).toBe(200);

    if (response.data.data.data.length > 0) {
      response.data.data.data.forEach(zone => {
        expect(zone.buyerId).toBe(testBuyer1.id);
        expect(zone.serviceTypeId).toBe(serviceTypes[0].id);
      });
    }
  });

  test('25. Filter by zipCodes array (comma-separated)', async () => {
    const response = await apiRequest('/api/admin/service-zones?zipCodes=90001,10001');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data.data)).toBe(true);
  });

  test('26. Filter without relations (includeRelations=false)', async () => {
    const response = await apiRequest('/api/admin/service-zones?includeRelations=false');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.data.data)).toBe(true);
  });

  // ==================== GET /api/admin/service-zones/[id] - Single ====================

  test('27. Get single service zone by ID', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`);
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data.id).toBe(testZone1.id);
    expect(response.data.data.zipCode).toBe('90001');
  });

  test('28. Get single service zone returns 404 for non-existent ID', async () => {
    const response = await apiRequest('/api/admin/service-zones/00000000-0000-0000-0000-000000000000');
    expect(response.status).toBe(404);
    expect(response.data.error.code).toBe('SERVICE_ZONE_NOT_FOUND');
  });

  test('29. Get single returns 400 for invalid UUID format', async () => {
    const response = await apiRequest('/api/admin/service-zones/invalid-uuid');
    expect(response.status).toBe(400);
    expect(response.data.error.code).toBe('INVALID_ID');
  });

  test('30. Get single service zone requires authentication', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`, {
      headers: { 'Authorization': '' }
    });
    expect(response.status).toBe(401);
  });

  test('31. Get single service zone response structure is correct', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`);
    expect(response.data).toHaveProperty('success');
    expect(response.data).toHaveProperty('data');
    expect(response.data).toHaveProperty('requestId');
  });

  test('32. Get single response has all expected fields', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`);
    const zone = response.data.data;
    expect(zone).toHaveProperty('id');
    expect(zone).toHaveProperty('buyerId');
    expect(zone).toHaveProperty('serviceTypeId');
    expect(zone).toHaveProperty('zipCode');
    expect(zone).toHaveProperty('active');
    expect(zone).toHaveProperty('priority');
    expect(zone).toHaveProperty('createdAt');
  });

  // ==================== PUT /api/admin/service-zones/[id] - Update ====================

  test('33. Update service zone active status', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`, {
      method: 'PUT',
      body: { active: false }
    });
    expect(response.status).toBe(200);
    expect(response.data.data.serviceZone.active).toBe(false);

    // Verify update persisted
    const verify = await prisma.buyerServiceZipCode.findUnique({
      where: { id: testZone1.id }
    });
    expect(verify.active).toBe(false);
  });

  test('34. Update service zone priority', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`, {
      method: 'PUT',
      body: { priority: 200 }
    });
    expect(response.status).toBe(200);
    expect(response.data.data.serviceZone.priority).toBe(200);
  });

  test('35. Update service zone maxLeadsPerDay', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`, {
      method: 'PUT',
      body: { maxLeadsPerDay: 25 }
    });
    expect(response.status).toBe(200);
    expect(response.data.data.serviceZone.maxLeadsPerDay).toBe(25);
  });

  test('36. Update service zone minBid and maxBid', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`, {
      method: 'PUT',
      body: {
        minBid: 30.00,
        maxBid: 80.00
      }
    });
    expect(response.status).toBe(200);
    expect(response.data.data.serviceZone.minBid).toBe(30.00);
    expect(response.data.data.serviceZone.maxBid).toBe(80.00);
  });

  test('37. Update multiple fields at once', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`, {
      method: 'PUT',
      body: {
        active: true,
        priority: 150,
        maxLeadsPerDay: 15
      }
    });
    expect(response.status).toBe(200);
    expect(response.data.data.serviceZone.active).toBe(true);
    expect(response.data.data.serviceZone.priority).toBe(150);
    expect(response.data.data.serviceZone.maxLeadsPerDay).toBe(15);
  });

  test('38. Update fails with priority out of range (too high)', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`, {
      method: 'PUT',
      body: { priority: 1001 }
    });
    expect(response.status).toBe(400);
  });

  test('39. Update fails with priority out of range (too low)', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`, {
      method: 'PUT',
      body: { priority: 0 }
    });
    expect(response.status).toBe(400);
  });

  test('40. Update returns 404 for non-existent service zone', async () => {
    const response = await apiRequest('/api/admin/service-zones/00000000-0000-0000-0000-000000000000', {
      method: 'PUT',
      body: { active: false }
    });
    expect(response.status).toBe(404);
    expect(response.data.error.code).toBe('SERVICE_ZONE_NOT_FOUND');
  });

  test('41. Update requires authentication', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`, {
      method: 'PUT',
      headers: { 'Authorization': '' },
      body: { active: false }
    });
    expect(response.status).toBe(401);
  });

  test('42. Update requires Content-Type: application/json', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': '' }
    });
    expect([400, 500]).toContain(response.status);
  });

  test('43. Update response structure is correct', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`, {
      method: 'PUT',
      body: { priority: 125 }
    });
    expect(response.data).toHaveProperty('success');
    expect(response.data).toHaveProperty('data');
    expect(response.data).toHaveProperty('requestId');
    expect(response.data.data).toHaveProperty('serviceZone');
  });

  // ==================== DELETE /api/admin/service-zones/[id] - Single Delete ====================

  test('44. Delete single service zone', async () => {
    // Create a zone to delete
    const createResponse = await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCode: '99999'
      }
    });
    const zoneId = createResponse.data.data.serviceZone.id;

    // Delete it
    const response = await apiRequest(`/api/admin/service-zones/${zoneId}`, {
      method: 'DELETE'
    });
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data.message).toContain('deleted');

    // Verify deletion
    const verify = await prisma.buyerServiceZipCode.findUnique({
      where: { id: zoneId }
    });
    expect(verify).toBeNull();
  });

  test('45. Delete returns 404 for non-existent service zone', async () => {
    const response = await apiRequest('/api/admin/service-zones/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE'
    });
    expect(response.status).toBe(404);
    expect(response.data.error.code).toBe('SERVICE_ZONE_NOT_FOUND');
  });

  test('46. Delete requires authentication', async () => {
    const response = await apiRequest(`/api/admin/service-zones/${testZone1.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': '' }
    });
    expect(response.status).toBe(401);
  });

  // ==================== DELETE /api/admin/service-zones - Bulk Delete ====================

  test('47. Bulk delete service zones by IDs', async () => {
    // Create zones to delete
    const createResponse = await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCodes: ['66001', '66002', '66003']
      }
    });

    const ids = createResponse.data.data.serviceZones.map(z => z.id);

    // Bulk delete
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'DELETE',
      body: { ids }
    });

    expect(response.status).toBe(200);
    expect(response.data.data.deletedCount).toBe(3);
  });

  test('48. Bulk delete by filter (buyerId + serviceTypeId)', async () => {
    // Create zones to delete
    await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        buyerId: testBuyer2.id,
        serviceTypeId: serviceTypes[1].id,
        zipCodes: ['55001', '55002']
      }
    });

    // Bulk delete by filter
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'DELETE',
      body: {
        buyerId: testBuyer2.id,
        serviceTypeId: serviceTypes[1].id
      }
    });

    expect(response.status).toBe(200);
    expect(response.data.data.deletedCount).toBeGreaterThanOrEqual(2);
  });

  test('49. Bulk delete by zipCodes array', async () => {
    // Create zones to delete
    await apiRequest('/api/admin/service-zones', {
      method: 'POST',
      body: {
        buyerId: testBuyer1.id,
        serviceTypeId: serviceTypes[0].id,
        zipCodes: ['44001', '44002']
      }
    });

    // Bulk delete by zipCodes
    const response = await apiRequest('/api/admin/service-zones', {
      method: 'DELETE',
      body: {
        zipCodes: ['44001', '44002']
      }
    });

    expect(response.status).toBe(200);
    expect(response.data.data.deletedCount).toBeGreaterThanOrEqual(2);
  });

  // ==================== GET /api/admin/service-zones/analytics - Analytics ====================

  test('50. Get service zone analytics - default timeframe', async () => {
    const response = await apiRequest('/api/admin/service-zones/analytics');
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data).toHaveProperty('summary');
    expect(response.data.data).toHaveProperty('distributions');
    expect(response.data.data).toHaveProperty('performance');
    expect(response.data.data).toHaveProperty('trends');
  });

  test('51. Get analytics with buyerId filter', async () => {
    const response = await apiRequest(`/api/admin/service-zones/analytics?buyerId=${testBuyer1.id}`);
    expect(response.status).toBe(200);
    expect(response.data.data).toHaveProperty('summary');
  });

  test('52. Get analytics with serviceTypeId filter', async () => {
    const response = await apiRequest(`/api/admin/service-zones/analytics?serviceTypeId=${serviceTypes[0].id}`);
    expect(response.status).toBe(200);
    expect(response.data.data).toHaveProperty('summary');
  });

  test('53. Get analytics with timeframe parameter', async () => {
    const response = await apiRequest('/api/admin/service-zones/analytics?timeframe=7d');
    expect(response.status).toBe(200);
    expect(response.data.data).toHaveProperty('trends');
  });

  test('54. Analytics requires authentication', async () => {
    const response = await apiRequest('/api/admin/service-zones/analytics', {
      headers: { 'Authorization': '' }
    });
    expect(response.status).toBe(401);
  });

  // ==================== GET /api/admin/service-zones/analytics?type=availability ====================

  test('55. Get service availability for ZIP code', async () => {
    const response = await apiRequest('/api/admin/service-zones/analytics?type=availability&zipCode=90001');
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data).toHaveProperty('zipCode');
    expect(response.data.data).toHaveProperty('availability');
  });

  test('56. Service availability requires zipCode parameter', async () => {
    const response = await apiRequest('/api/admin/service-zones/analytics?type=availability');
    expect(response.status).toBe(400);
    expect(response.data.error.code).toBe('MISSING_ZIP_CODE');
  });

  test('57. Service availability validates ZIP code format', async () => {
    const response = await apiRequest('/api/admin/service-zones/analytics?type=availability&zipCode=invalid');
    expect(response.status).toBe(400);
    expect(response.data.error.code).toBe('INVALID_ZIP_CODE');
  });

});
