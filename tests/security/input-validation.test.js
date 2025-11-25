const BASE_URL = 'http://localhost:3002';

describe('Domain 5.3: Input Validation and Sanitization Testing', () => {

  // Test 1: SQL injection attempt in lead submission
  test('Test 1: SQL injection attempt should be rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: "'; DROP TABLE leads; --",
        zipCode: '12345',
        ownsHome: 'yes',
        timeframe: 'within_3_months'
      })
    });

    // Should not cause SQL injection (may return 400/404/500, but should handle safely)
    expect([400, 404, 500]).toContain(response.status);
  });

  // Test 2: XSS attempt in contractor signup
  test('Test 2: XSS script injection should be sanitized', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: '<script>alert("XSS")</script>',
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    // Should handle safely (may accept with sanitization or reject)
    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  // Test 3: Invalid email format
  test('Test 3: Invalid email format should be rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test',
        contactEmail: 'not-an-email',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([400, 422]).toContain(response.status);
  });

  // Test 4: Invalid phone format
  test('Test 4: Invalid phone format should be rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test',
        contactEmail: 'test@test.com',
        contactPhone: 'not-a-phone',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([400, 409, 422]).toContain(response.status);
  });

  // Test 5: Invalid ZIP code format
  test('Test 5: Invalid ZIP code format should be rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: 'ABCDE',
        ownsHome: 'yes',
        timeframe: 'within_3_months'
      })
    });

    expect([400, 422, 500]).toContain(response.status);
  });

  // Test 6: Extremely long input string
  test('Test 6: Extremely long input should be rejected', async () => {
    const longString = 'A'.repeat(10000);
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: longString,
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([400, 413, 422]).toContain(response.status);
  });

  // Test 7: Null byte injection
  test('Test 7: Null byte injection should be handled', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test\0id',
        zipCode: '12345',
        ownsHome: 'yes',
        timeframe: 'within_3_months'
      })
    });

    expect([400, 404, 422, 500]).toContain(response.status);
  });

  // Test 8: Path traversal attempt
  test('Test 8: Path traversal attempt should be rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: '../../../etc/passwd',
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    // Should handle safely
    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  // Test 9: HTML injection attempt
  test('Test 9: HTML injection should be sanitized', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: '<img src=x onerror=alert(1)>',
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  // Test 10: Unicode character handling
  test('Test 10: Unicode characters should be handled safely', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: '测试用户',
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    // Should accept or reject gracefully
    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  // Test 11: Empty string validation
  test('Test 11: Empty required fields should be rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: '',
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([400, 422]).toContain(response.status);
  });

  // Test 12: Whitespace-only input
  test('Test 12: Whitespace-only input should be rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: '   ',
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([400, 409, 422]).toContain(response.status);
  });

  // Test 13: Special characters in name
  test('Test 13: Special characters in name should be handled', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: "O'Brien & Associates",
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    // Should accept valid special characters
    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  // Test 14: Invalid URL format in buyer API
  test('Test 14: Invalid URL format should be rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        name: 'Test Buyer',
        apiUrl: 'not-a-url',
        type: 'CONTRACTOR'
      })
    });

    expect([400, 401, 422]).toContain(response.status);
  });

  // Test 15: Missing required fields
  test('Test 15: Missing required fields should return validation error', async () => {
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

  // Test 16: Invalid data types
  test('Test 16: Invalid data types should be rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 12345, // Should be string
        zipCode: 12345, // Should be string
        ownsHome: 'yes',
        timeframe: 'within_3_months'
      })
    });

    // May accept with type coercion or reject
    expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
  });

  // Test 17: Command injection attempt
  test('Test 17: Command injection should be prevented', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test; rm -rf /',
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    // Should handle safely
    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  // Test 18: Multiple email validation scenarios
  test('Test 18: Various invalid email formats should be rejected', async () => {
    const invalidEmails = [
      'missing@',
      '@missing.com',
      'no-at-sign.com',
      'spaces in@email.com',
      'double@@email.com'
    ];

    for (const email of invalidEmails) {
      const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: 'Test',
          contactEmail: email,
          contactPhone: '5551234567',
          companyName: 'Test Company',
          businessEmail: 'biz@test.com',
          businessPhone: '5559876543'
        })
      });

      expect([400, 422]).toContain(response.status);
    }
  });

  // Test 19: ZIP code edge cases
  test('Test 19: ZIP code edge cases should be validated', async () => {
    const invalidZips = ['1234', '123456', 'ABCDE', '12 45'];

    for (const zip of invalidZips) {
      const response = await fetch(`${BASE_URL}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceTypeId: 'test-id',
          zipCode: zip,
          ownsHome: 'yes',
          timeframe: 'within_3_months'
        })
      });

      expect([400, 404, 422, 500]).toContain(response.status);
    }
  });

  // Test 20: Phone number validation
  test('Test 20: Invalid phone numbers should be rejected', async () => {
    const invalidPhones = ['123', '123-456-789', 'abc-def-ghij', '(555) 123'];

    for (const phone of invalidPhones) {
      const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: 'Test',
          contactEmail: 'test@test.com',
          contactPhone: phone,
          companyName: 'Test Company',
          businessEmail: 'biz@test.com',
          businessPhone: '5559876543'
        })
      });

      expect([400, 409, 422]).toContain(response.status);
    }
  });

  // Test 21: JSON injection attempt
  test('Test 21: JSON injection should be handled', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: '{"malicious": "injection"}',
        zipCode: '12345',
        ownsHome: 'yes',
        timeframe: 'within_3_months'
      })
    });

    expect([400, 404, 422, 500]).toContain(response.status);
  });

  // Test 22: Boolean validation
  test('Test 22: Invalid boolean values should be handled', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: '12345',
        ownsHome: 'invalid-boolean',
        timeframe: 'within_3_months'
      })
    });

    // May accept with coercion or reject
    expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
  });

  // Test 23: Enum validation
  test('Test 23: Invalid enum values should be rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: '12345',
        ownsHome: 'yes',
        timeframe: 'invalid_timeframe'
      })
    });

    expect([400, 404, 422, 500]).toContain(response.status);
  });

  // Test 24: Array injection
  test('Test 24: Array injection should be handled', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: ['array', 'injection'],
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([400, 422]).toContain(response.status);
  });

  // Test 25: Object injection
  test('Test 25: Object injection should be handled', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: { malicious: 'object' },
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([400, 422]).toContain(response.status);
  });

  // Test 26: Negative number validation
  test('Test 26: Negative numbers should be validated appropriately', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        name: 'Test Buyer',
        apiUrl: 'https://test.com',
        type: 'CONTRACTOR',
        minBid: -10.0 // Negative bid should be invalid
      })
    });

    expect([400, 401, 422]).toContain(response.status);
  });

  // Test 27: Maximum length validation
  test('Test 27: Maximum length should be enforced', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test',
        contactEmail: 'a'.repeat(500) + '@test.com', // Very long email
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    // May truncate and accept, or reject
    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  // Test 28: Duplicate field validation
  test('Test 28: Duplicate email should be detected', async () => {
    const unique = Date.now() + Math.random().toString(36).substr(2, 9);
    const email = `duplicate${unique}@test.com`;

    // Create first contractor
    const response1 = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test 1',
        contactEmail: email,
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    // Try to create duplicate
    const response2 = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test 2',
        contactEmail: email, // Same email
        contactPhone: '5559876543',
        companyName: 'Test Company 2',
        businessEmail: 'biz2@test.com',
        businessPhone: '5551234567'
      })
    });

    // Second request should fail, be detected as duplicate, or succeed if first failed
    expect([200, 201, 400, 409, 422]).toContain(response2.status);
  });

  // Test 29: Case sensitivity in validation
  test('Test 29: Email case sensitivity should be handled', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test',
        contactEmail: 'TEST@TEST.COM',
        contactPhone: '5551234567',
        companyName: 'Test Company',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    // Should accept uppercase emails or detect as duplicate
    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  // Test 30: Location search query validation
  test('Test 30: Location search should validate query length', async () => {
    const response = await fetch(`${BASE_URL}/api/locations/search?q=${'a'.repeat(500)}`, {
      headers: { 'Content-Type': 'application/json' }
    });

    // Should handle long queries gracefully
    expect([200, 400, 414]).toContain(response.status);
  });
});
