/**
 * k6 Load Test: Lead Submission
 * Tests the /api/leads endpoint under various load scenarios
 *
 * Usage:
 * k6 run tests/load/lead-submission-load.js
 * k6 run --vus 10 --duration 30s tests/load/lead-submission-load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const leadCreationTime = new Trend('lead_creation_time');
const successfulLeads = new Counter('successful_leads');
const failedLeads = new Counter('failed_leads');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '5m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.01'],    // Error rate must be below 1%
    errors: ['rate<0.05'],             // Error rate below 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Sample service type IDs (replace with actual IDs from your database)
const SERVICE_TYPES = [
  'service-roofing-001',
  'service-hvac-001',
  'service-plumbing-001',
  'service-electrical-001',
  'service-windows-001',
];

// Sample ZIP codes
const ZIP_CODES = [
  '10001', '90210', '60601', '33101', '98101',
  '75201', '30301', '02101', '85001', '55401',
];

// Generate realistic lead data
function generateLeadData() {
  const serviceTypeId = SERVICE_TYPES[Math.floor(Math.random() * SERVICE_TYPES.length)];
  const zipCode = ZIP_CODES[Math.floor(Math.random() * ZIP_CODES.length)];

  return {
    serviceTypeId,
    zipCode,
    formData: {
      ownsHome: Math.random() > 0.3,
      timeframe: ['ASAP', 'WITHIN_WEEK', 'WITHIN_MONTH', 'FLEXIBLE'][Math.floor(Math.random() * 4)],
      firstName: `User${Math.floor(Math.random() * 10000)}`,
      lastName: `Test${Math.floor(Math.random() * 10000)}`,
      email: `user${Math.floor(Math.random() * 10000)}@example.com`,
      phone: `555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
      description: 'Load test lead submission',
    },
    complianceData: {
      tcpaConsent: true,
      privacyPolicyAccepted: true,
      ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      userAgent: 'k6-load-test/1.0',
    },
  };
}

export default function () {
  const leadData = generateLeadData();

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const startTime = new Date();
  const response = http.post(
    `${BASE_URL}/api/leads`,
    JSON.stringify(leadData),
    params
  );
  const endTime = new Date();
  const duration = endTime - startTime;

  // Record metrics
  leadCreationTime.add(duration);

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has leadId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.leadId !== undefined;
      } catch {
        return false;
      }
    },
    'response time < 3s': (r) => r.timings.duration < 3000,
  });

  if (success) {
    successfulLeads.add(1);
  } else {
    failedLeads.add(1);
    errorRate.add(1);
    console.error(`Failed request: ${response.status} - ${response.body}`);
  }

  // Think time - simulate real user behavior
  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

// Setup function - runs once before the test
export function setup() {
  console.log('Starting lead submission load test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Test will ramp up to 100 concurrent users over 26 minutes');
  return { startTime: new Date() };
}

// Teardown function - runs once after the test
export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000 / 60; // minutes
  console.log(`\nLoad test completed in ${duration.toFixed(2)} minutes`);
  console.log('Check the summary below for detailed metrics');
}
