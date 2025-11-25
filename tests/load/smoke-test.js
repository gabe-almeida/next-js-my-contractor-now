/**
 * k6 Smoke Test: Quick Verification
 * Minimal load test to verify all endpoints are working before heavier load testing
 *
 * Usage:
 * k6 run tests/load/smoke-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

// Minimal load - just verify functionality
export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || 'test-admin-token';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
    },
  };

  // Test 1: Service Types (public endpoint)
  group('Service Types', function () {
    const response = http.get(`${BASE_URL}/api/service-types`);
    const success = check(response, {
      'service types OK': (r) => r.status === 200,
    });
    if (!success) errorRate.add(1);
  });

  sleep(1);

  // Test 2: Buyers (admin endpoint)
  group('Buyers', function () {
    const response = http.get(`${BASE_URL}/api/admin/buyers`, params);
    const success = check(response, {
      'buyers OK': (r) => r.status === 200,
    });
    if (!success) errorRate.add(1);
  });

  sleep(1);

  // Test 3: Leads (admin endpoint)
  group('Leads', function () {
    const response = http.get(`${BASE_URL}/api/admin/leads?page=1&limit=10`, params);
    const success = check(response, {
      'leads OK': (r) => r.status === 200,
    });
    if (!success) errorRate.add(1);
  });

  sleep(1);

  // Test 4: Service Configs (admin endpoint)
  group('Service Configs', function () {
    const response = http.get(`${BASE_URL}/api/admin/buyers/service-configs`, params);
    const success = check(response, {
      'service configs OK': (r) => r.status === 200,
    });
    if (!success) errorRate.add(1);
  });

  sleep(1);

  // Test 5: Lead Submission
  group('Lead Submission', function () {
    const leadData = {
      serviceTypeId: 'service-roofing-001',
      zipCode: '10001',
      formData: {
        ownsHome: true,
        timeframe: 'ASAP',
        firstName: 'Smoke',
        lastName: 'Test',
        email: 'smoke@test.com',
        phone: '5555555555',
      },
      complianceData: {
        tcpaConsent: true,
        privacyPolicyAccepted: true,
      },
    };

    const response = http.post(
      `${BASE_URL}/api/leads`,
      JSON.stringify(leadData),
      { headers: { 'Content-Type': 'application/json' } }
    );

    const success = check(response, {
      'lead submission OK': (r) => r.status === 200 || r.status === 201,
    });
    if (!success) errorRate.add(1);
  });

  sleep(2);
}

export function setup() {
  console.log('\n========================================');
  console.log('  SMOKE TEST - QUICK VERIFICATION');
  console.log('========================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');
  console.log('Running minimal load test (5 users for 1 minute)');
  console.log('Verifying all critical endpoints respond correctly');
  console.log('========================================\n');

  return { startTime: new Date() };
}

export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000;

  console.log('\n========================================');
  console.log('  SMOKE TEST COMPLETE');
  console.log('========================================');
  console.log(`Duration: ${duration.toFixed(0)} seconds`);
  console.log('');
  console.log('✓ If all checks passed, proceed to load tests');
  console.log('✗ If checks failed, fix issues before load testing');
  console.log('========================================\n');
}
