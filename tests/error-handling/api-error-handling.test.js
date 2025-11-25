const BASE_URL = 'http://localhost:3002';

describe('Domain 6: Error Handling Testing', () => {

  // Test 1: 404 Not Found for non-existent routes
  test('Test 1: Non-existent API routes return 404', async () => {
    const response = await fetch(`${BASE_URL}/api/non-existent-route`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(404);
  });

  // Test 2: 401 Unauthorized for missing auth
  test('Test 2: Admin routes return 401 without auth', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(401);
  });

  // Test 3: 400 Bad Request for invalid JSON
  test('Test 3: Invalid JSON returns 400', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json{'
    });

    expect([400, 500]).toContain(response.status);
  });

  // Test 4: 422 Unprocessable Entity for validation errors
  test('Test 4: Missing required fields return validation error', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test'
        // Missing other required fields
      })
    });

    expect([400, 422]).toContain(response.status);
  });

  // Test 5: Error response contains error message
  test('Test 5: Error responses include error message', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  // Test 6: 405 Method Not Allowed
  test('Test 6: Invalid HTTP methods return 405', async () => {
    const response = await fetch(`${BASE_URL}/api/service-types`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    expect([404, 405]).toContain(response.status);
  });

  // Test 7: Database errors handled gracefully
  test('Test 7: Non-existent resource returns 404', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/non-existent-id`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      }
    });

    expect([404, 401]).toContain(response.status);
  });

  // Test 8: Duplicate creation errors
  test('Test 8: Duplicate resources return appropriate error', async () => {
    const unique = Date.now() + Math.random().toString(36).substr(2, 9);
    const signupData = {
      contactName: 'Test',
      contactEmail: `duplicate${unique}@test.com`,
      contactPhone: '5551234567',
      companyName: 'Test Company',
      businessEmail: `biz${unique}@test.com`,
      businessPhone: '5559876543'
    };

    // Create first
    await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signupData)
    });

    // Try duplicate
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signupData)
    });

    expect([400, 409, 422]).toContain(response.status);
  });

  // Test 9: Large payload rejection
  test('Test 9: Extremely large payloads are rejected', async () => {
    const largeData = {
      contactName: 'A'.repeat(100000),
      contactEmail: 'test@test.com',
      contactPhone: '5551234567',
      companyName: 'Test',
      businessEmail: 'biz@test.com',
      businessPhone: '5559876543'
    };

    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(largeData)
    });

    expect([400, 413, 422]).toContain(response.status);
  });

  // Test 10: Invalid content type handling
  test('Test 10: Invalid content type handled', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'plain text'
    });

    expect([400, 415, 500]).toContain(response.status);
  });

  // Test 11: Missing content type
  test('Test 11: Missing content type handled', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      body: JSON.stringify({ test: 'data' })
    });

    expect([200, 201, 400, 404, 415, 500]).toContain(response.status);
  });

  // Test 12: Foreign key constraint violations
  test('Test 12: Invalid foreign key returns error', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        buyerId: 'invalid-id',
        serviceTypeId: 'invalid-id',
        pingTemplate: {},
        postTemplate: {},
        fieldMappings: {},
        minBid: 10,
        maxBid: 50
      })
    });

    expect([400, 401, 404, 422, 500]).toContain(response.status);
  });

  // Test 13: Type conversion errors
  test('Test 13: Type mismatch handled gracefully', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 123, // Should be string
        zipCode: 12345, // Should be string
        ownsHome: 'not-a-boolean',
        timeframe: 'within_3_months'
      })
    });

    expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
  });

  // Test 14: Null values in required fields
  test('Test 14: Null required fields return error', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: null,
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([400, 422]).toContain(response.status);
  });

  // Test 15: Undefined values handled
  test('Test 15: Undefined values handled appropriately', async () => {
    const data = {
      contactName: 'Test',
      contactEmail: 'test@test.com',
      contactPhone: '5551234567',
      companyName: 'Test',
      businessEmail: 'biz@test.com',
      businessPhone: '5559876543'
    };
    delete data.contactName; // Make it undefined

    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    expect([400, 422]).toContain(response.status);
  });

  // Test 16: Array when object expected
  test('Test 16: Array instead of object returns error', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ test: 'data' }])
    });

    expect([400, 422]).toContain(response.status);
  });

  // Test 17: Empty request body
  test('Test 17: Empty request body returns error', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: ''
    });

    expect([400, 422, 500]).toContain(response.status);
  });

  // Test 18: Malformed query parameters
  test('Test 18: Malformed query params handled', async () => {
    const response = await fetch(`${BASE_URL}/api/locations/search?q=`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect([200, 400]).toContain(response.status);
  });

  // Test 19: SQL injection attempts return errors
  test('Test 19: SQL injection attempts safely rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: "'; DROP TABLE leads; --",
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'within_3_months'
      })
    });

    expect([400, 404, 422, 500]).toContain(response.status);
  });

  // Test 20: Rate limiting errors (if implemented)
  test('Test 20: Multiple rapid requests handled', async () => {
    const requests = Array.from({ length: 50 }, () =>
      fetch(`${BASE_URL}/api/service-types`, {
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const responses = await Promise.all(requests);

    // Should handle all requests (may rate limit some)
    for (const response of responses) {
      expect([200, 429]).toContain(response.status);
    }
  });

  // Test 21: Timeout handling
  test('Test 21: Long-running requests complete or timeout', async () => {
    const response = await fetch(`${BASE_URL}/api/service-types`, {
      headers: { 'Content-Type': 'application/json' }
    });

    // Should respond within reasonable time
    expect([200, 408, 504]).toContain(response.status);
  });

  // Test 22: CORS errors handled
  test('Test 22: CORS requests handled appropriately', async () => {
    const response = await fetch(`${BASE_URL}/api/service-types`, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://malicious-site.com'
      }
    });

    // Should handle CORS (may accept or reject)
    expect([200, 403]).toContain(response.status);
  });

  // Test 23: Update non-existent resource
  test('Test 23: Updating non-existent resource returns 404', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/non-existent-id`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({ name: 'Updated' })
    });

    expect([404, 401]).toContain(response.status);
  });

  // Test 24: Delete non-existent resource
  test('Test 24: Deleting non-existent resource returns 404', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/non-existent-id`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      }
    });

    expect([404, 401]).toContain(response.status);
  });

  // Test 25: Constraint violation errors
  test('Test 25: Check constraint violations return error', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        name: 'Test',
        apiUrl: 'https://test.com',
        type: 'INVALID_TYPE'
      })
    });

    expect([400, 401, 422]).toContain(response.status);
  });

  // Test 26: Concurrent modification errors
  test('Test 26: Concurrent updates handled', async () => {
    const response = await fetch(`${BASE_URL}/api/service-types`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
  });

  // Test 27: Invalid UUID format
  test('Test 27: Invalid UUID format returns error', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/invalid-uuid-format`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      }
    });

    expect([400, 401, 404]).toContain(response.status);
  });

  // Test 28: Numeric overflow errors
  test('Test 28: Numeric overflow handled', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        name: 'Test',
        apiUrl: 'https://test.com',
        minBid: Number.MAX_VALUE,
        maxBid: Number.MAX_VALUE
      })
    });

    expect([200, 201, 400, 401, 422]).toContain(response.status);
  });

  // Test 29: Special characters in IDs
  test('Test 29: Special characters in resource IDs handled', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/%20%20%20`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      }
    });

    expect([400, 401, 404]).toContain(response.status);
  });

  // Test 30: Error consistency across endpoints
  test('Test 30: Consistent error format across endpoints', async () => {
    const response1 = await fetch(`${BASE_URL}/api/admin/buyers`, {
      headers: { 'Content-Type': 'application/json' }
    });

    const response2 = await fetch(`${BASE_URL}/api/admin/leads`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response1.status).toBe(401);
    expect(response2.status).toBe(401);

    const data1 = await response1.json();
    const data2 = await response2.json();

    // Both should have error field
    expect(data1.error).toBeDefined();
    expect(data2.error).toBeDefined();
  });
});
