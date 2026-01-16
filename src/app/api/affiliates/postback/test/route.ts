/**
 * Postback Test Endpoint
 *
 * WHY: Allows affiliates to test their postback URL configuration
 *      before relying on it for live call data.
 *
 * WHEN: When affiliate configures or updates their postback URL.
 *
 * HOW: Sends a test postback payload to the configured URL and
 *      returns the result to the affiliate.
 *
 * POST /api/affiliates/postback/test
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { testPostbackUrl } from '@/lib/services/postback-service';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Authenticate affiliate
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing authorization token' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const verification = verifyAffiliateToken(token);

    if (!verification.valid || !verification.affiliateId) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Invalid token' },
        { status: 401 }
      );
    }

    const affiliateId = verification.affiliateId;

    // Parse request body
    const body = await request.json();
    const { postbackUrl, postbackMethod } = body;

    // Validate URL
    if (!postbackUrl || typeof postbackUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Postback URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(postbackUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Only allow HTTPS in production
    if (process.env.NODE_ENV === 'production' && !postbackUrl.startsWith('https://')) {
      return NextResponse.json(
        { success: false, error: 'Postback URL must use HTTPS' },
        { status: 400 }
      );
    }

    // Validate method
    const method = postbackMethod?.toUpperCase() || 'POST';
    if (!['GET', 'POST'].includes(method)) {
      return NextResponse.json(
        { success: false, error: 'Postback method must be GET or POST' },
        { status: 400 }
      );
    }

    logger.info('Testing postback URL', {
      affiliateId,
      url: postbackUrl.slice(0, 50)
    });

    // Send test postback
    const result = await testPostbackUrl(affiliateId, postbackUrl, method);

    return NextResponse.json({
      success: result.success,
      data: {
        tested: true,
        url: postbackUrl,
        method,
        statusCode: result.statusCode,
        responseBody: result.responseBody?.slice(0, 500),
        error: result.error
      },
      message: result.success
        ? 'Postback test successful! Your URL received the test payload.'
        : `Postback test failed: ${result.error}`
    });
  } catch (error) {
    logger.error('Postback test error', {
      error: (error as Error).message
    });

    return NextResponse.json(
      { success: false, error: 'Failed to test postback URL' },
      { status: 500 }
    );
  }
}
