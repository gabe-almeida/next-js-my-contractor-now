/**
 * Test Call PING API Endpoint
 *
 * WHY: Allow admins to test call PING configuration before going live.
 *      Sends a test PING with sample call data and displays the result.
 *
 * WHEN: Admin clicks "Test PING" button in Network Call Config settings.
 *
 * HOW:
 *   1. Parse the PING configuration from request body
 *   2. Generate sample call data for testing
 *   3. Transform sample data using CallTransformer
 *   4. Send actual PING request to the configured URL
 *   5. Return the transformed payload, response, and timing
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  CallTransformer,
  type CallFieldMappingConfig,
  type CallData,
} from '@/lib/templates/call-transformer';
import * as Sentry from '@sentry/nextjs';

// =====================================
// TYPE DEFINITIONS
// =====================================

interface TestCallPingRequest {
  serviceTypeId?: string;
  callPingUrl: string;
  callFieldMappings?: CallFieldMappingConfig;
  authType?: string;
  authConfig?: string;
}

// =====================================
// SAMPLE DATA
// =====================================

/**
 * WHY: Generate realistic sample call data for testing.
 * WHEN: Admin tests PING configuration.
 */
function getSampleCallData(): CallData {
  return {
    id: 'test-call-' + Date.now(),
    twilioCallSid: 'CA' + 'x'.repeat(32).replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    ),
    callerPhone: '+15551234567',
    callerPhoneDisplay: '(555) 123-4567',
    callerCity: 'Los Angeles',
    callerState: 'CA',
    callerZip: '90210',
    callerName: 'John Doe',
    isQualified: true,
    ivrResponses: {
      ownsHome: true,
      timeframe: 'within_3_months',
    },
    serviceType: {
      id: 'test-service-id',
      name: 'windows',
      displayName: 'Windows',
    },
    campaign: {
      id: 'test-campaign-id',
      name: 'Test Campaign',
    },
    createdAt: new Date(),
  };
}

// =====================================
// HANDLERS
// =====================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: buyerId } = await params;

  try {
    const body = (await request.json()) as TestCallPingRequest;
    const { callPingUrl, callFieldMappings, authType, authConfig } = body;

    // Validate required fields
    if (!callPingUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'PING URL is required',
        },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(callPingUrl);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid URL format',
        },
        { status: 400 }
      );
    }

    logger.info({
      event: 'admin.test_call_ping',
      message: 'Testing call PING configuration',
      buyerId,
      url: callPingUrl,
    });

    // Generate sample call data
    const sampleCall = getSampleCallData();

    // Parse and apply field mappings
    const mappingConfig = callFieldMappings
      ? CallTransformer.parseConfig(callFieldMappings as unknown) ||
        callFieldMappings
      : null;

    // Transform call data to PING payload
    const payload = CallTransformer.transform(sampleCall, mappingConfig);

    // Add test indicator to payload
    payload._test = true;
    payload._testTimestamp = new Date().toISOString();

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Type': 'CALL_PING_TEST',
      'X-Timestamp': new Date().toISOString(),
    };

    // Add authentication if configured
    if (authConfig) {
      try {
        const auth = JSON.parse(authConfig);
        switch (authType) {
          case 'apiKey':
            if (auth.apiKey) {
              headers['X-API-Key'] = auth.apiKey;
            }
            if (auth.headerName && auth.apiKey) {
              headers[auth.headerName] = auth.apiKey;
            }
            break;
          case 'bearer':
            if (auth.token) {
              headers['Authorization'] = `Bearer ${auth.token}`;
            }
            break;
          case 'basic':
            if (auth.username && auth.password) {
              const credentials = Buffer.from(
                `${auth.username}:${auth.password}`
              ).toString('base64');
              headers['Authorization'] = `Basic ${credentials}`;
            }
            break;
        }
      } catch {
        logger.warn('Failed to parse auth config for test PING');
      }
    }

    // Send test PING with timeout
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for tests

    try {
      const response = await fetch(callPingUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTimeMs = Date.now() - startTime;

      // Parse response
      let responseData: unknown;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        responseData = { _rawText: text.substring(0, 500) };
      }

      logger.info({
        event: 'admin.test_call_ping.complete',
        message: 'Test PING completed',
        buyerId,
        status: response.status,
        responseTimeMs,
        success: response.ok,
      });

      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: `PING returned ${response.status}: ${response.statusText}`,
          payload,
          response: responseData,
          responseTimeMs,
        });
      }

      return NextResponse.json({
        success: true,
        payload,
        response: responseData,
        responseTimeMs,
        status: response.status,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const responseTimeMs = Date.now() - startTime;

      const isTimeout =
        fetchError instanceof Error &&
        (fetchError.message.includes('abort') ||
          fetchError.name === 'AbortError');

      logger.warn({
        event: 'admin.test_call_ping.failed',
        message: 'Test PING request failed',
        buyerId,
        error: (fetchError as Error).message,
        isTimeout,
        responseTimeMs,
      });

      return NextResponse.json({
        success: false,
        error: isTimeout
          ? `Request timed out after ${responseTimeMs}ms`
          : (fetchError as Error).message,
        payload,
        responseTimeMs,
      });
    }
  } catch (error) {
    logger.error({
      event: 'admin.test_call_ping.error',
      message: 'Error processing test PING request',
      buyerId,
      error: (error as Error).message,
    });

    Sentry.captureException(error, {
      tags: { component: 'test-call-ping' },
      extra: { buyerId },
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process test request',
      },
      { status: 500 }
    );
  }
}
