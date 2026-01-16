/**
 * Release Forwarding Configuration API
 *
 * WHY: Affiliates may want to stop forwarding and switch to platform-provisioned
 *      numbers, or simply deactivate a campaign.
 * WHEN: Affiliate clicks "Release Forwarding" in their portal.
 * HOW: Validates ownership, checks for active calls, then releases config.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { releaseForwardingConfig } from '@/lib/services/ingress-number-service';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

interface ReleaseForwardingRequest {
  trackingNumberId: string;
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
    const body: ReleaseForwardingRequest = await request.json();
    const { trackingNumberId } = body;

    // Validate required fields
    if (!trackingNumberId) {
      return NextResponse.json(
        { success: false, error: 'trackingNumberId is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const trackingNumber = await prisma.trackingNumber.findUnique({
      where: { id: trackingNumberId },
      select: {
        id: true,
        affiliateId: true,
        provisioningType: true,
      },
    });

    if (!trackingNumber) {
      return NextResponse.json(
        { success: false, error: 'Forwarding configuration not found' },
        { status: 404 }
      );
    }

    if (trackingNumber.affiliateId !== authedAffiliateId) {
      logger.warn({
        event: 'api.forwarding.release.unauthorized',
        message: 'Affiliate attempted to release forwarding for another affiliate',
        requestingAffiliateId: authedAffiliateId,
        trackingNumberAffiliateId: trackingNumber.affiliateId,
        trackingNumberId,
      });

      return NextResponse.json(
        { success: false, error: 'You can only release your own forwarding configurations' },
        { status: 403 }
      );
    }

    if (trackingNumber.provisioningType !== 'FORWARDING') {
      return NextResponse.json(
        { success: false, error: 'This is not a forwarding configuration' },
        { status: 400 }
      );
    }

    logger.info({
      event: 'api.forwarding.release.start',
      message: 'Releasing forwarding configuration',
      affiliateId: authedAffiliateId,
      trackingNumberId,
    });

    // Release the forwarding configuration
    const result = await releaseForwardingConfig(trackingNumberId);

    if (!result.success) {
      logger.warn({
        event: 'api.forwarding.release.failed',
        message: result.error || 'Failed to release forwarding configuration',
        trackingNumberId,
      });

      return NextResponse.json(
        { success: false, error: result.error || 'Failed to release forwarding configuration' },
        { status: 400 }
      );
    }

    logger.info({
      event: 'api.forwarding.release.success',
      message: 'Forwarding configuration released successfully',
      affiliateId: authedAffiliateId,
      trackingNumberId,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    logger.error({
      event: 'api.forwarding.release.error',
      message: 'Error releasing forwarding configuration',
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
