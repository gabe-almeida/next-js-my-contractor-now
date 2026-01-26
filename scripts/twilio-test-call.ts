/**
 * Twilio Test Call Script
 *
 * WHY: Execute automated test calls for the Twilio integration test suite.
 * WHEN: Run via `npx ts-node scripts/twilio-test-call.ts <command>`
 * HOW: Uses Twilio SDK to make calls and verify functionality.
 *
 * Commands:
 *   login           - Authenticate and get JWT token
 *   provision       - Provision a tracking number for test campaign
 *   call <number>   - Make a test call to the given tracking number
 *   status <sid>    - Check status of a call by SID
 */

import twilio from 'twilio';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const PRODUCTION_URL = 'https://mycontractornow.com';
const TEST_EMAIL = 'test-affiliate@mycontractornow.com';
const TEST_PASSWORD = 'test123';
const TEST_CAMPAIGN_ID = 'test-campaign-001';

// Twilio credentials - Use API Key authentication instead of Auth Token
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const apiKey = process.env.TWILIO_API_KEY!;
const apiSecret = process.env.TWILIO_API_SECRET!;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER!;

// Initialize with API Key credentials
const twilioClient = twilio(apiKey, apiSecret, { accountSid });

interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    affiliate: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  };
  error?: string;
}

interface ProvisionResponse {
  success: boolean;
  data?: {
    id: string;
    phoneNumber: string;
    phoneNumberDisplay: string;
    provisioningStatus: string;
    campaignId: string;
  };
  error?: string;
}

/**
 * Login to affiliate portal and get JWT token
 */
async function login(): Promise<string | null> {
  console.log('=== PHASE A.1: Logging in to affiliate portal ===');
  console.log(`URL: ${PRODUCTION_URL}/api/affiliates/login`);
  console.log(`Email: ${TEST_EMAIL}`);

  try {
    const response = await fetch(`${PRODUCTION_URL}/api/affiliates/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        rememberMe: false
      })
    });

    const data: LoginResponse = await response.json();

    if (!data.success) {
      console.error('Login failed:', data.error);
      return null;
    }

    console.log('Login successful!');
    console.log(`Affiliate ID: ${data.data!.affiliate.id}`);
    console.log(`Name: ${data.data!.affiliate.firstName} ${data.data!.affiliate.lastName}`);
    console.log(`Token: ${data.data!.token.substring(0, 30)}...`);

    return data.data!.token;
  } catch (error) {
    console.error('Login request failed:', error);
    return null;
  }
}

/**
 * Provision a tracking number for the test campaign
 */
async function provisionNumber(token: string): Promise<string | null> {
  console.log('\n=== PHASE A.4-A.6: Provisioning tracking number ===');
  console.log(`Campaign ID: ${TEST_CAMPAIGN_ID}`);
  console.log('Number type: Toll-free');

  try {
    const response = await fetch(`${PRODUCTION_URL}/api/affiliates/tracking-numbers/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        campaignId: TEST_CAMPAIGN_ID,
        tollFree: true
      })
    });

    const data: ProvisionResponse = await response.json();

    if (!data.success) {
      console.error('Provisioning failed:', data.error);
      return null;
    }

    console.log('Provisioning successful!');
    console.log(`Tracking Number ID: ${data.data!.id}`);
    console.log(`Phone Number: ${data.data!.phoneNumber}`);
    console.log(`Display: ${data.data!.phoneNumberDisplay}`);
    console.log(`Status: ${data.data!.provisioningStatus}`);

    return data.data!.phoneNumber;
  } catch (error) {
    console.error('Provisioning request failed:', error);
    return null;
  }
}

/**
 * Make a test call using Twilio SDK
 */
async function makeTestCall(trackingNumber: string, durationSeconds: number = 35): Promise<string | null> {
  console.log('\n=== Making test call ===');
  console.log(`From: ${twilioPhoneNumber}`);
  console.log(`To: ${trackingNumber}`);
  console.log(`Duration: ~${durationSeconds} seconds`);

  try {
    // TwiML that says a message and pauses to simulate real call duration
    const twiml = `<Response>
      <Say voice="alice">This is an automated test call for the affiliate tracking system.</Say>
      <Pause length="${durationSeconds}"/>
      <Say voice="alice">Test complete. Thank you.</Say>
    </Response>`;

    const call = await twilioClient.calls.create({
      to: trackingNumber,
      from: twilioPhoneNumber,
      twiml: twiml,
      statusCallback: `${PRODUCTION_URL}/api/calls/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    });

    console.log('Call initiated!');
    console.log(`Call SID: ${call.sid}`);
    console.log(`Status: ${call.status}`);
    console.log(`Direction: ${call.direction}`);

    return call.sid;
  } catch (error) {
    console.error('Failed to make call:', error);
    return null;
  }
}

/**
 * Check status of a call
 */
async function checkCallStatus(callSid: string): Promise<void> {
  console.log(`\n=== Checking call status for ${callSid} ===`);

  try {
    const call = await twilioClient.calls(callSid).fetch();

    console.log(`Status: ${call.status}`);
    console.log(`Direction: ${call.direction}`);
    console.log(`Duration: ${call.duration} seconds`);
    console.log(`Start Time: ${call.startTime}`);
    console.log(`End Time: ${call.endTime}`);
    console.log(`From: ${call.from}`);
    console.log(`To: ${call.to}`);
    console.log(`Price: ${call.price} ${call.priceUnit}`);
  } catch (error) {
    console.error('Failed to fetch call:', error);
  }
}

/**
 * Wait for call to complete with timeout
 */
async function waitForCallCompletion(callSid: string, timeoutMs: number = 120000): Promise<boolean> {
  console.log(`\nWaiting for call ${callSid} to complete (timeout: ${timeoutMs / 1000}s)...`);
  const startTime = Date.now();
  const pollInterval = 5000; // Check every 5 seconds

  while (Date.now() - startTime < timeoutMs) {
    try {
      const call = await twilioClient.calls(callSid).fetch();
      console.log(`  Status: ${call.status} (elapsed: ${Math.round((Date.now() - startTime) / 1000)}s)`);

      if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(call.status)) {
        console.log(`\nCall finished with status: ${call.status}`);
        return call.status === 'completed';
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error('Error polling call status:', error);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  console.log('Timeout waiting for call completion');
  return false;
}

/**
 * List available phone numbers from Twilio
 */
async function listAvailableNumbers(): Promise<void> {
  console.log('\n=== Available Toll-Free Numbers ===');

  try {
    const numbers = await twilioClient.availablePhoneNumbers('US')
      .tollFree
      .list({ limit: 5 });

    for (const num of numbers) {
      console.log(`  ${num.phoneNumber} - ${num.friendlyName}`);
    }
  } catch (error) {
    console.error('Failed to list numbers:', error);
  }
}

/**
 * Main entry point
 */
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  console.log('=========================================');
  console.log('  Twilio Integration Test Script');
  console.log('=========================================\n');

  if (!accountSid || !authToken) {
    console.error('ERROR: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in .env');
    process.exit(1);
  }

  switch (command) {
    case 'login': {
      const token = await login();
      if (token) {
        console.log('\n=== Copy this token for subsequent commands ===');
        console.log(token);
      }
      break;
    }

    case 'provision': {
      const token = await login();
      if (!token) {
        console.error('Cannot provision without authentication');
        process.exit(1);
      }
      await provisionNumber(token);
      break;
    }

    case 'call': {
      if (!arg) {
        console.error('Usage: npx ts-node scripts/twilio-test-call.ts call <tracking_number>');
        process.exit(1);
      }
      const duration = process.argv[4] ? parseInt(process.argv[4]) : 35;
      const callSid = await makeTestCall(arg, duration);
      if (callSid) {
        console.log('\nWaiting 60 seconds for webhooks to process...');
        const completed = await waitForCallCompletion(callSid, 180000);
        if (completed) {
          console.log('\nCall completed successfully!');
          console.log(`\nCall SID for database verification: ${callSid}`);
        }
      }
      break;
    }

    case 'status': {
      if (!arg) {
        console.error('Usage: npx ts-node scripts/twilio-test-call.ts status <call_sid>');
        process.exit(1);
      }
      await checkCallStatus(arg);
      break;
    }

    case 'list-numbers': {
      await listAvailableNumbers();
      break;
    }

    case 'full-test': {
      // Run complete test: login -> provision -> call -> verify
      console.log('Running full integration test...\n');

      // Step 1: Login
      const token = await login();
      if (!token) {
        console.error('FAILED: Could not authenticate');
        process.exit(1);
      }

      // Step 2: Provision
      const trackingNumber = await provisionNumber(token);
      if (!trackingNumber) {
        console.error('FAILED: Could not provision tracking number');
        process.exit(1);
      }

      // Step 3: Wait for number to be ready
      console.log('\nWaiting 10 seconds for number to be fully provisioned...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Step 4: Make call
      const callSid = await makeTestCall(trackingNumber, 35);
      if (!callSid) {
        console.error('FAILED: Could not initiate call');
        process.exit(1);
      }

      // Step 5: Wait for completion
      const completed = await waitForCallCompletion(callSid, 180000);
      if (completed) {
        console.log('\n========================================');
        console.log('  FULL TEST COMPLETED SUCCESSFULLY!');
        console.log('========================================');
        console.log(`\nTracking Number: ${trackingNumber}`);
        console.log(`Call SID: ${callSid}`);
        console.log('\nNext: Run verify-call-db.ts to check database records');
      } else {
        console.error('\nFAILED: Call did not complete successfully');
        process.exit(1);
      }
      break;
    }

    default:
      console.log('Usage: npx ts-node scripts/twilio-test-call.ts <command> [args]');
      console.log('\nCommands:');
      console.log('  login            - Authenticate and get JWT token');
      console.log('  provision        - Provision a tracking number for test campaign');
      console.log('  call <number> [duration] - Make a test call (default 35s duration)');
      console.log('  status <sid>     - Check status of a call by SID');
      console.log('  list-numbers     - List available toll-free numbers');
      console.log('  full-test        - Run complete test (login -> provision -> call)');
      process.exit(1);
  }
}

main().catch(console.error);
