/**
 * Affiliate Tracking Number Provisioning API
 *
 * WHY: Allows affiliates to provision new tracking numbers for their campaigns.
 *      Each affiliate can have one tracking number per campaign for call attribution.
 *
 * WHEN: POST - Affiliate clicks "Get Tracking Number" on campaigns page.
 *
 * HOW: Uses provisionTrackingNumber service which handles Twilio integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { provisionTrackingNumber } from '@/lib/services/tracking-number-service';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { captureApiError } from '@/lib/sentry';

/**
 * WHY: Extracts and verifies affiliate ID from request authorization header.
 * WHEN: Every API request that requires affiliate authentication.
 * HOW: Parse Bearer token, verify JWT, return affiliate ID or error.
 */
function getAffiliateIdFromRequest(request: NextRequest): {
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

/**
 * POST /api/affiliates/tracking-numbers/provision
 *
 * Provisions a new tracking number for a campaign.
 *
 * Request body:
 * - campaignId: string (required) - Campaign to provision number for
 * - tollFree: boolean (optional, default: true) - Request toll-free number
 * - areaCode: string (optional) - Preferred area code for local numbers
 */
export async function POST(request: NextRequest) {
  try {
    const { affiliateId, error } = getAffiliateIdFromRequest(request);

    if (!affiliateId) {
      return NextResponse.json({
        success: false,
        error
      }, { status: 401 });
    }

    // Parse request body
    let body: { campaignId?: string; tollFree?: boolean; areaCode?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body'
      }, { status: 400 });
    }

    const { campaignId, tollFree = true, areaCode } = body;

    if (!campaignId) {
      return NextResponse.json({
        success: false,
        error: 'campaignId is required'
      }, { status: 400 });
    }

    // Verify affiliate has access to this campaign
    const affiliateCampaign = await prisma.affiliateCampaign.findUnique({
      where: {
        affiliateId_campaignId: { affiliateId, campaignId }
      }
    });

    if (!affiliateCampaign) {
      return NextResponse.json({
        success: false,
        error: 'You do not have access to this campaign'
      }, { status: 403 });
    }

    if (affiliateCampaign.status !== 'APPROVED') {
      return NextResponse.json({
        success: false,
        error: `Campaign access is ${affiliateCampaign.status.toLowerCase()}. Cannot provision numbers.`
      }, { status: 403 });
    }

    // Use the tracking number service to provision
    const result = await provisionTrackingNumber({
      affiliateId,
      campaignId,
      tollFree,
      areaCode
    });

    if (!result.success) {
      logger.warn('Tracking number provisioning failed', {
        affiliateId,
        campaignId,
        error: result.error
      });

      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    logger.info('Tracking number provisioned successfully', {
      affiliateId,
      campaignId,
      trackingNumberId: result.trackingNumber?.id,
      phoneNumber: result.trackingNumber?.phoneNumber
    });

    return NextResponse.json({
      success: true,
      data: {
        id: result.trackingNumber!.id,
        phoneNumber: result.trackingNumber!.phoneNumber,
        phoneNumberDisplay: result.trackingNumber!.phoneNumberDisplay,
        provisioningStatus: result.trackingNumber!.provisioningStatus,
        campaignId: result.trackingNumber!.campaignId
      }
    });

  } catch (err) {
    captureApiError(err, { route: '/api/affiliates/tracking-numbers/provision', action: 'POST' });
    logger.error('Failed to provision tracking number', {
      error: (err as Error).message
    });
    return NextResponse.json({
      success: false,
      error: 'Failed to provision tracking number'
    }, { status: 500 });
  }
}
