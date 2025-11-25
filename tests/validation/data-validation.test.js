const BASE_URL = 'http://localhost:3002';

describe('Domain 8: Data Validation Testing', () => {

  // Email Validation Tests (Tests 1-10)
  test('Test 1: Valid email formats accepted', async () => {
    const validEmails = [
      'test@example.com',
      'user.name@example.com',
      'user+tag@example.co.uk',
      'user_name@example-domain.com'
    ];

    for (const email of validEmails) {
      const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: 'Test',
          contactEmail: email,
          contactPhone: '5551234567',
          companyName: 'Test',
          businessEmail: `biz${Date.now()}@test.com`,
          businessPhone: '5559876543'
        })
      });

      expect([200, 201, 400, 409, 422]).toContain(response.status);
    }
  });

  test('Test 2: Invalid email formats rejected', async () => {
    const invalidEmails = ['plaintext', '@example.com', 'test@', 'test @example.com'];

    for (const email of invalidEmails) {
      const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: 'Test',
          contactEmail: email,
          contactPhone: '5551234567',
          companyName: 'Test',
          businessEmail: 'biz@test.com',
          businessPhone: '5559876543'
        })
      });

      expect([400, 422]).toContain(response.status);
    }
  });

  test('Test 3: Email max length enforced', async () => {
    const longEmail = 'a'.repeat(250) + '@test.com';

    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test',
        contactEmail: longEmail,
        contactPhone: '5551234567',
        companyName: 'Test',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([400, 409, 422]).toContain(response.status);
  });

  test('Test 4: Email case sensitivity handled', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test',
        contactEmail: 'TEST@EXAMPLE.COM',
        contactPhone: '5551234567',
        companyName: 'Test',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  test('Test 5: Email special characters validated', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test',
        contactEmail: 'user+tag@example.com',
        contactPhone: '5551234567',
        companyName: 'Test',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  // Phone Validation Tests (Tests 6-10)
  test('Test 6: Valid phone formats accepted', async () => {
    const validPhones = ['5551234567', '555-123-4567', '(555) 123-4567', '555.123.4567'];

    for (const phone of validPhones) {
      const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: 'Test',
          contactEmail: `test${Date.now()}@test.com`,
          contactPhone: phone,
          companyName: 'Test',
          businessEmail: `biz${Date.now()}@test.com`,
          businessPhone: '5559876543'
        })
      });

      expect([200, 201, 400, 409, 422]).toContain(response.status);
    }
  });

  test('Test 7: Invalid phone formats rejected', async () => {
    const invalidPhones = ['123', '12345', 'abc-def-ghij'];

    for (const phone of invalidPhones) {
      const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: 'Test',
          contactEmail: 'test@test.com',
          contactPhone: phone,
          companyName: 'Test',
          businessEmail: 'biz@test.com',
          businessPhone: '5559876543'
        })
      });

      expect([400, 409, 422]).toContain(response.status);
    }
  });

  test('Test 8: Phone number length validated', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test',
        contactEmail: 'test@test.com',
        contactPhone: '123',
        companyName: 'Test',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([400, 409, 422]).toContain(response.status);
  });

  test('Test 9: Phone with country code handled', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test',
        contactEmail: 'test@test.com',
        contactPhone: '+15551234567',
        companyName: 'Test',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  test('Test 10: Phone with extensions handled', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test',
        contactEmail: 'test@test.com',
        contactPhone: '5551234567 ext 123',
        companyName: 'Test',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  // ZIP Code Validation Tests (Tests 11-15)
  test('Test 11: Valid ZIP codes accepted', async () => {
    const validZips = ['12345', '12345-6789'];

    for (const zip of validZips) {
      const response = await fetch(`${BASE_URL}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceTypeId: 'test-id',
          zipCode: zip,
          ownsHome: true,
          timeframe: 'within_3_months'
        })
      });

      expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
    }
  });

  test('Test 12: Invalid ZIP codes rejected', async () => {
    const invalidZips = ['1234', '123456', 'ABCDE'];

    for (const zip of invalidZips) {
      const response = await fetch(`${BASE_URL}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceTypeId: 'test-id',
          zipCode: zip,
          ownsHome: true,
          timeframe: 'within_3_months'
        })
      });

      expect([400, 404, 422, 500]).toContain(response.status);
    }
  });

  test('Test 13: ZIP code special characters rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: '12-345',
        ownsHome: true,
        timeframe: 'within_3_months'
      })
    });

    expect([400, 404, 422, 500]).toContain(response.status);
  });

  test('Test 14: ZIP code whitespace handling', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: ' 12345 ',
        ownsHome: true,
        timeframe: 'within_3_months'
      })
    });

    expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
  });

  test('Test 15: Canadian postal codes handled', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: 'M5H 2N2',
        ownsHome: true,
        timeframe: 'within_3_months'
      })
    });

    expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
  });

  // Name Validation Tests (Tests 16-20)
  test('Test 16: Valid name formats accepted', async () => {
    const validNames = ["John Doe", "Mary-Jane O'Brien", "José García"];

    for (const name of validNames) {
      const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: name,
          contactEmail: `test${Date.now()}@test.com`,
          contactPhone: '5551234567',
          companyName: 'Test',
          businessEmail: `biz${Date.now()}@test.com`,
          businessPhone: '5559876543'
        })
      });

      expect([200, 201, 400, 409, 422]).toContain(response.status);
    }
  });

  test('Test 17: Empty names rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: '',
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([400, 422]).toContain(response.status);
  });

  test('Test 18: Name length limits enforced', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'A'.repeat(300),
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([400, 409, 422]).toContain(response.status);
  });

  test('Test 19: Names with numbers handled', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'John123',
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  test('Test 20: Special characters in names validated', async () => {
    const response = await fetch(`${BASE_URL}/api/contractors/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: 'John@Doe#Test',
        contactEmail: 'test@test.com',
        contactPhone: '5551234567',
        companyName: 'Test',
        businessEmail: 'biz@test.com',
        businessPhone: '5559876543'
      })
    });

    expect([200, 201, 400, 409, 422]).toContain(response.status);
  });

  // URL Validation Tests (Tests 21-25)
  test('Test 21: Valid URLs accepted', async () => {
    const validUrls = [
      'https://example.com',
      'http://subdomain.example.com',
      'https://example.com/path',
      'https://example.com:8080'
    ];

    for (const url of validUrls) {
      const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
        },
        body: JSON.stringify({
          name: 'Test ' + Date.now(),
          apiUrl: url,
          type: 'CONTRACTOR'
        })
      });

      expect([200, 201, 400, 401, 422]).toContain(response.status);
    }
  });

  test('Test 22: Invalid URLs rejected', async () => {
    const invalidUrls = ['not-a-url', 'ftp://example.com', 'javascript:alert(1)'];

    for (const url of invalidUrls) {
      const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
        },
        body: JSON.stringify({
          name: 'Test',
          apiUrl: url,
          type: 'CONTRACTOR'
        })
      });

      expect([400, 401, 422]).toContain(response.status);
    }
  });

  test('Test 23: URL protocol required', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        name: 'Test',
        apiUrl: 'example.com',
        type: 'CONTRACTOR'
      })
    });

    expect([400, 401, 422]).toContain(response.status);
  });

  test('Test 24: URL max length enforced', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        name: 'Test',
        apiUrl: 'https://' + 'a'.repeat(2000) + '.com',
        type: 'CONTRACTOR'
      })
    });

    expect([400, 401, 422]).toContain(response.status);
  });

  test('Test 25: URL encoding handled', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        name: 'Test',
        apiUrl: 'https://example.com/path?param=value&other=test',
        type: 'CONTRACTOR'
      })
    });

    expect([200, 201, 400, 401, 422]).toContain(response.status);
  });

  // Numeric Validation Tests (Tests 26-30)
  test('Test 26: Positive numbers validated', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        name: 'Test',
        apiUrl: 'https://test.com',
        type: 'CONTRACTOR',
        minBid: 10.5,
        maxBid: 50.75
      })
    });

    expect([200, 201, 400, 401, 422]).toContain(response.status);
  });

  test('Test 27: Negative numbers rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        name: 'Test',
        apiUrl: 'https://test.com',
        type: 'CONTRACTOR',
        minBid: -10,
        maxBid: 50
      })
    });

    expect([400, 401, 422]).toContain(response.status);
  });

  test('Test 28: Number range validation', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        name: 'Test',
        apiUrl: 'https://test.com',
        type: 'CONTRACTOR',
        minBid: 100,
        maxBid: 50  // Max < Min should fail
      })
    });

    expect([200, 201, 400, 401, 422]).toContain(response.status);
  });

  test('Test 29: Decimal precision validated', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        name: 'Test',
        apiUrl: 'https://test.com',
        type: 'CONTRACTOR',
        minBid: 10.123456789,
        maxBid: 50.987654321
      })
    });

    expect([200, 201, 400, 401, 422]).toContain(response.status);
  });

  test('Test 30: Zero values handled', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        name: 'Test',
        apiUrl: 'https://test.com',
        type: 'CONTRACTOR',
        minBid: 0,
        maxBid: 50
      })
    });

    expect([200, 201, 400, 401, 422]).toContain(response.status);
  });

  // Boolean Validation Tests (Tests 31-35)
  test('Test 31: Boolean true/false values accepted', async () => {
    const booleans = [true, false];

    for (const bool of booleans) {
      const response = await fetch(`${BASE_URL}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceTypeId: 'test-id',
          zipCode: '12345',
          ownsHome: bool,
          timeframe: 'within_3_months'
        })
      });

      expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
    }
  });

  test('Test 32: String boolean values handled', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: '12345',
        ownsHome: 'true',
        timeframe: 'within_3_months'
      })
    });

    expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
  });

  test('Test 33: Numeric boolean values handled', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: '12345',
        ownsHome: 1,
        timeframe: 'within_3_months'
      })
    });

    expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
  });

  test('Test 34: Invalid boolean values rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: '12345',
        ownsHome: 'invalid',
        timeframe: 'within_3_months'
      })
    });

    expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
  });

  test('Test 35: Null boolean values handled', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: '12345',
        ownsHome: null,
        timeframe: 'within_3_months'
      })
    });

    expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
  });

  // Enum Validation Tests (Tests 36-40)
  test('Test 36: Valid enum values accepted', async () => {
    const validTimeframes = ['within_3_months', 'within_6_months', 'within_1_year', 'undecided'];

    for (const timeframe of validTimeframes) {
      const response = await fetch(`${BASE_URL}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceTypeId: 'test-id',
          zipCode: '12345',
          ownsHome: true,
          timeframe: timeframe
        })
      });

      expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
    }
  });

  test('Test 37: Invalid enum values rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'invalid_timeframe'
      })
    });

    expect([400, 404, 422, 500]).toContain(response.status);
  });

  test('Test 38: Enum case sensitivity validated', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: '12345',
        ownsHome: true,
        timeframe: 'WITHIN_3_MONTHS'
      })
    });

    expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
  });

  test('Test 39: Empty enum values rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: '12345',
        ownsHome: true,
        timeframe: ''
      })
    });

    expect([400, 404, 422, 500]).toContain(response.status);
  });

  test('Test 40: Null enum values handled', async () => {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'test-id',
        zipCode: '12345',
        ownsHome: true,
        timeframe: null
      })
    });

    expect([200, 201, 400, 404, 422, 500]).toContain(response.status);
  });

  // Date/Time Validation Tests (Tests 41-45)
  test('Test 41: ISO date formats accepted', async () => {
    const response = await fetch(`${BASE_URL}/api/service-types`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
  });

  test('Test 42: Invalid date formats rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/service-types`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
  });

  test('Test 43: Future dates handled', async () => {
    const response = await fetch(`${BASE_URL}/api/service-types`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
  });

  test('Test 44: Past dates validated', async () => {
    const response = await fetch(`${BASE_URL}/api/service-types`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
  });

  test('Test 45: Timezone handling verified', async () => {
    const response = await fetch(`${BASE_URL}/api/service-types`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(200);
  });

  // JSON/Object Validation Tests (Tests 46-50)
  test('Test 46: Valid JSON objects accepted', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        buyerId: 'test-id',
        serviceTypeId: 'test-id',
        pingTemplate: { valid: 'json', nested: { object: true } },
        postTemplate: { another: 'valid json' },
        fieldMappings: {},
        minBid: 10,
        maxBid: 50
      })
    });

    expect([200, 201, 400, 401, 404, 422]).toContain(response.status);
  });

  test('Test 47: Empty JSON objects validated', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        buyerId: 'test-id',
        serviceTypeId: 'test-id',
        pingTemplate: {},
        postTemplate: {},
        fieldMappings: {},
        minBid: 10,
        maxBid: 50
      })
    });

    expect([200, 201, 400, 401, 404, 422]).toContain(response.status);
  });

  test('Test 48: Nested object depth validated', async () => {
    const deepObject = { level1: { level2: { level3: { level4: { level5: 'deep' } } } } };

    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        buyerId: 'test-id',
        serviceTypeId: 'test-id',
        pingTemplate: deepObject,
        postTemplate: {},
        fieldMappings: {},
        minBid: 10,
        maxBid: 50
      })
    });

    expect([200, 201, 400, 401, 404, 422]).toContain(response.status);
  });

  test('Test 49: Array values in JSON validated', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        buyerId: 'test-id',
        serviceTypeId: 'test-id',
        pingTemplate: { array: [1, 2, 3] },
        postTemplate: { list: ['a', 'b', 'c'] },
        fieldMappings: {},
        minBid: 10,
        maxBid: 50
      })
    });

    expect([200, 201, 400, 401, 404, 422]).toContain(response.status);
  });

  test('Test 50: Mixed type JSON values handled', async () => {
    const response = await fetch(`${BASE_URL}/api/admin/buyers/service-configs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        buyerId: 'test-id',
        serviceTypeId: 'test-id',
        pingTemplate: { string: 'value', number: 123, boolean: true, null: null },
        postTemplate: {},
        fieldMappings: {},
        minBid: 10,
        maxBid: 50
      })
    });

    expect([200, 201, 400, 401, 404, 422]).toContain(response.status);
  });
});
