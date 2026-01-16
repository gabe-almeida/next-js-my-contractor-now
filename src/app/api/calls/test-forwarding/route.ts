/**
 * Test Forwarding Configuration API
 *
 * WHY: Affiliates need to verify their forwarding setup before going live.
 *      This endpoint validates credentials and returns test TwiML that confirms
 *      the forwarding identification was successful.
 *
 * WHEN: Affiliate clicks "Test Configuration" in forwarding setup UI,
 *       or makes a test call through their external system.
 *
 * HOW:
 *   1. Parse SIP headers/URL params like real incoming call handler
 *   2. Validate affiliate/campaign identification
 *   3. Return TwiML that plays confirmation message (not full auction flow)
 *
 * TEST MODES:
 *   - API Mode: POST with JSON body containing test data
 *   - Webhook Mode: POST with form data (simulates Twilio webhook)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { parseForwardingIdentification } from '@/lib/call/forwarding-parser';
import { isIngressNumber } from '@/lib/services/ingress-number-service';
import { prisma } from '@/lib/prisma';
import { createTwimlResponse } from '@/lib/twilio/verify-signature';

// =====================================
// TYPE DEFINITIONS
// =====================================

interface TestForwardingRequest {
  // The ingress number being called
  ingressPhoneNumber: string;

  // Test SIP headers (optional)
  sipHeaders?: Record<string, string>;

  // Test URL parameters (optional)
  urlParams?: Record<string, string>;

  // For webhook simulation
  From?: string;
  To?: string;
  CallSid?: string;
}

interface TestResult {
  success: boolean;
  identificationSource: string;
  affiliateId: string | null;
  campaignId: string | null;
  serviceTypeId: string | null;
  affiliateName: string | null;
  campaignName: string | null;
  error: string | null;
  rawMetadata: object | null;
  twiml?: string;
}

// =====================================
// MAIN HANDLER
// =====================================

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';

  try {
    let testData: TestForwardingRequest;

    // Parse request based on content type
    if (contentType.includes('application/json')) {
      // API Mode: JSON body
      testData = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // Webhook Mode: Form data (simulating Twilio)
      const formData = await request.formData();
      testData = Object.fromEntries(formData.entries()) as unknown as TestForwardingRequest;
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type. Use application/json or application/x-www-form-urlencoded' },
        { status: 400 }
      );
    }

    // Determine ingress number
    const ingressPhone = testData.ingressPhoneNumber || testData.To;

    if (!ingressPhone) {
      return NextResponse.json(
        { error: 'ingressPhoneNumber or To is required' },
        { status: 400 }
      );
    }

    logger.info({
      event: 'api.test_forwarding.start',
      message: 'Testing forwarding configuration',
      ingressPhoneNumber: ingressPhone,
    });

    // Verify this is actually an ingress number
    const isIngress = await isIngressNumber(ingressPhone);

    if (!isIngress) {
      const errorMessage = `${ingressPhone} is not an ingress number. Check that you're calling the correct number.`;
      const result: TestResult = {
        success: false,
        identificationSource: 'none',
        affiliateId: null,
        campaignId: null,
        serviceTypeId: null,
        affiliateName: null,
        campaignName: null,
        error: errorMessage,
        rawMetadata: null,
      };

      // If this looks like a webhook, return TwiML
      if (testData.CallSid) {
        return createTwimlResponse(buildTestRejectionTwiml(errorMessage));
      }

      return NextResponse.json(result);
    }

    // Build payload to simulate Twilio webhook
    const simulatedPayload: Record<string, string | undefined> = {
      From: testData.From || '+15551234567',
      To: ingressPhone,
      CallSid: testData.CallSid || `TEST_${Date.now()}`,
    };

    // Add SIP headers
    if (testData.sipHeaders) {
      for (const [key, value] of Object.entries(testData.sipHeaders)) {
        simulatedPayload[`SipHeader_${key}`] = value;
      }
    }

    // Add URL parameters
    if (testData.urlParams) {
      for (const [key, value] of Object.entries(testData.urlParams)) {
        simulatedPayload[key] = value;
      }
    }

    // Parse forwarding identification
    const identification = await parseForwardingIdentification(simulatedPayload, ingressPhone);

    // Look up names for affiliate and campaign
    let affiliateName: string | null = null;
    let campaignName: string | null = null;

    if (identification.affiliateId) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { id: identification.affiliateId },
        select: { firstName: true, lastName: true, companyName: true },
      });
      affiliateName = affiliate
        ? affiliate.companyName || `${affiliate.firstName} ${affiliate.lastName}`
        : null;
    }

    if (identification.campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: identification.campaignId },
        select: { name: true },
      });
      campaignName = campaign?.name || null;
    }

    const result: TestResult = {
      success: identification.success,
      identificationSource: identification.source,
      affiliateId: identification.affiliateId,
      campaignId: identification.campaignId,
      serviceTypeId: identification.serviceTypeId,
      affiliateName,
      campaignName,
      error: identification.error || null,
      rawMetadata: identification.rawMetadata,
    };

    logger.info({
      event: 'api.test_forwarding.complete',
      message: result.success ? 'Forwarding test successful' : 'Forwarding test failed',
      ...result,
    });

    // If this is a webhook simulation, return TwiML
    if (testData.CallSid) {
      if (result.success) {
        result.twiml = buildTestSuccessTwiml(affiliateName, campaignName);
        return createTwimlResponse(result.twiml);
      } else {
        const errorMsg = result.error || 'Unknown error';
        result.twiml = buildTestRejectionTwiml(errorMsg);
        return createTwimlResponse(result.twiml);
      }
    }

    // Return JSON result
    return NextResponse.json(result);
  } catch (error) {
    logger.error({
      event: 'api.test_forwarding.error',
      message: 'Error testing forwarding configuration',
      error: (error as Error).message,
    });

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - returns documentation for the test endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/calls/test-forwarding',
    description: 'Test your forwarding configuration before going live',
    usage: {
      json: {
        method: 'POST',
        contentType: 'application/json',
        body: {
          ingressPhoneNumber: '+18441234567',
          sipHeaders: {
            'X-Affiliate-ID': 'your-affiliate-id',
            'X-Campaign-ID': 'your-campaign-id',
          },
        },
      },
      urlParams: {
        method: 'POST',
        contentType: 'application/json',
        body: {
          ingressPhoneNumber: '+18441234567',
          urlParams: {
            affiliate_id: 'your-affiliate-id',
            campaign_id: 'your-campaign-id',
          },
        },
      },
      webhook: {
        method: 'POST',
        contentType: 'application/x-www-form-urlencoded',
        note: 'Simulates Twilio webhook, returns TwiML',
      },
    },
    response: {
      success: 'boolean - whether identification succeeded',
      identificationSource: 'sip_header | url_param | forwarding_id | none',
      affiliateId: 'string or null',
      campaignId: 'string or null',
      affiliateName: 'string or null',
      campaignName: 'string or null',
      error: 'string or null - error message if failed',
      rawMetadata: 'object - raw parsed headers/params',
    },
  });
}

// =====================================
// TWIML BUILDERS
// =====================================

function buildTestSuccessTwiml(affiliateName: string | null, campaignName: string | null): string {
  const affiliateMsg = affiliateName ? `Affiliate: ${affiliateName}. ` : '';
  const campaignMsg = campaignName ? `Campaign: ${campaignName}. ` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">
    Forwarding configuration test successful. ${affiliateMsg}${campaignMsg}Your calls will be tracked correctly. Thank you for testing.
  </Say>
  <Hangup/>
</Response>`;
}

function buildTestRejectionTwiml(error: string): string {
  // Sanitize error message for TwiML (no special chars)
  const safeError = error
    .replace(/[<>&'"]/g, '')
    .substring(0, 200);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">
    Forwarding configuration test failed. ${safeError}. Please check your configuration and try again.
  </Say>
  <Hangup/>
</Response>`;
}
