/**
 * Create Forwarding Configuration API
 *
 * WHY: Affiliates need to create forwarding configurations to forward calls from
 *      their own tracking systems (Ringba, etc.) to our ingress numbers.
 * WHEN: Affiliate selects "Forward from my own number" in campaign setup.
 * HOW: Validates request, assigns ingress number, generates credentials if needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { assignForwardingConfig } from '@/lib/services/ingress-number-service';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

interface CreateForwardingRequest {
  affiliateId: string;
  campaignId: string;
  ingressNumberId?: string;
  generateSipCredentials?: boolean;
}

/**
 * Extract and verify affiliate from Authorization header
 */
function getAffiliateFromRequest(request: NextRequest): {
  affiliateId: string | null;
  error: string | null;
} {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { affiliateId: null, error: 'Authorization required' };
  }

  const token = authHeader.substring(7);
  const verification = verifyAffiliateToken(token);

  if (!verification.valid) {
    return { affiliateId: null, error: verification.error || 'Invalid token' };
  }

  return { affiliateId: verification.affiliateId!, error: null };
}

export async function POST(request: NextRequest) {
  try {
    // Verify affiliate is authenticated
    const { affiliateId: authedAffiliateId, error: authError } = getAffiliateFromRequest(request);

    if (!authedAffiliateId) {
      return NextResponse.json(
        { success: false, error: authError },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CreateForwardingRequest = await request.json();
    const { affiliateId, campaignId, ingressNumberId, generateSipCredentials } = body;

    // Validate required fields
    if (!affiliateId || !campaignId) {
      return NextResponse.json(
        { success: false, error: 'affiliateId and campaignId are required' },
        { status: 400 }
      );
    }

    // Security: Ensure affiliate can only create configs for themselves
    if (authedAffiliateId !== affiliateId) {
      logger.warn({
        event: 'api.forwarding.unauthorized',
        message: 'Affiliate attempted to create forwarding for another affiliate',
        requestingAffiliateId: authedAffiliateId,
        targetAffiliateId: affiliateId,
      });

      return NextResponse.json(
        { success: false, error: 'You can only configure forwarding for your own campaigns' },
        { status: 403 }
      );
    }

    logger.info({
      event: 'api.forwarding.create.start',
      message: 'Creating forwarding configuration',
      affiliateId,
      campaignId,
      ingressNumberId: ingressNumberId || 'auto',
      generateSipCredentials,
    });

    // Create the forwarding configuration
    const result = await assignForwardingConfig({
      affiliateId,
      campaignId,
      ingressNumberId,
      generateSipCredentials,
    });

    if (!result.success) {
      logger.warn({
        event: 'api.forwarding.create.failed',
        message: result.error || 'Failed to create forwarding configuration',
        affiliateId,
        campaignId,
      });

      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create forwarding configuration' },
        { status: 400 }
      );
    }

    logger.info({
      event: 'api.forwarding.create.success',
      message: 'Forwarding configuration created successfully',
      affiliateId,
      campaignId,
      trackingNumberId: result.trackingNumber?.id,
    });

    return NextResponse.json({
      success: true,
      trackingNumber: result.trackingNumber,
      forwardingConfig: result.forwardingConfig,
    });
  } catch (error) {
    logger.error({
      event: 'api.forwarding.create.error',
      message: 'Error creating forwarding configuration',
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    Sentry.captureException(error, {
      tags: { component: 'forwarding-api' },
    });

    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
