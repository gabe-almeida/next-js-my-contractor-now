/**
 * Affiliate Call Detail API
 *
 * WHY: Provides detailed call information including recording URL for playback.
 *      Essential for the call detail page where affiliates review individual calls.
 *
 * WHEN: GET - Loading call detail page
 *
 * HOW: Uses verifyAffiliateToken for auth, generates signed S3 URL for recording.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { generateSignedUrl, extractS3KeyFromUrl } from '@/lib/services/recording-service';
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

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/affiliates/calls/[id]
 *
 * Returns detailed call information with signed recording URL.
 * Verifies the call belongs to the authenticated affiliate.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { affiliateId, error } = getAffiliateIdFromRequest(request);

    if (!affiliateId) {
      return NextResponse.json({
        success: false,
        error
      }, { status: 401 });
    }

    const { id: callId } = await context.params;

    // Fetch call with verification it belongs to this affiliate
    const call = await prisma.call.findFirst({
      where: {
        id: callId,
        affiliateId // Security: ensure call belongs to this affiliate
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            minCallDuration: true,
            callBasePayout: true,
            serviceType: {
              select: { id: true, name: true, displayName: true }
            }
          }
        },
        trackingNumber: {
          select: {
            id: true,
            phoneNumber: true,
            phoneNumberDisplay: true
          }
        },
        activityLogs: {
          where: {
            visibleToAffiliate: true
          },
          orderBy: { timestamp: 'asc' },
          select: {
            id: true,
            timestamp: true,
            event: true,
            message: true,
            level: true
          }
        }
      }
    });

    if (!call) {
      return NextResponse.json({
        success: false,
        error: 'Call not found'
      }, { status: 404 });
    }

    // Generate signed recording URL if available
    let signedRecordingUrl: string | null = null;
    if (call.recordingUrl && call.recordingStatus === 'AVAILABLE') {
      // Extract S3 key from the stored URL
      const s3Key = extractS3KeyFromUrl(call.recordingUrl);
      if (s3Key) {
        // Generate signed URL that expires in 1 hour
        signedRecordingUrl = await generateSignedUrl(s3Key, 3600);
      }
    }

    // Format response with all call details
    const formattedCall = {
      id: call.id,
      createdAt: call.createdAt.toISOString(),
      // Caller info
      callerPhone: call.callerPhone,
      callerPhoneDisplay: call.callerPhoneDisplay,
      callerCity: call.callerCity,
      callerState: call.callerState,
      callerZip: call.callerZip,
      // Timing
      answeredAt: call.answeredAt?.toISOString() || null,
      connectedAt: call.connectedAt?.toISOString() || null,
      endedAt: call.endedAt?.toISOString() || null,
      // Duration
      totalDurationSeconds: call.totalDurationSeconds,
      connectedDurationSeconds: call.connectedDurationSeconds,
      // Status
      status: call.status,
      disposition: call.disposition,
      isBillable: call.isBillable,
      // Financial
      affiliatePayout: call.affiliatePayout ? Number(call.affiliatePayout) : null,
      // Recording
      recordingStatus: call.recordingStatus,
      recordingUrl: signedRecordingUrl,
      recordingDurationSeconds: call.recordingDurationSeconds,
      // Campaign
      campaign: call.campaign ? {
        id: call.campaign.id,
        name: call.campaign.name,
        minCallDuration: call.campaign.minCallDuration,
        callBasePayout: call.campaign.callBasePayout
          ? Number(call.campaign.callBasePayout)
          : null,
        serviceType: call.campaign.serviceType
      } : null,
      // Tracking number
      trackingNumber: call.trackingNumber ? {
        id: call.trackingNumber.id,
        phoneNumber: call.trackingNumber.phoneNumber,
        phoneNumberDisplay: call.trackingNumber.phoneNumberDisplay
      } : null,
      // Activity timeline (affiliate-visible only)
      activityLog: call.activityLogs.map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        event: log.event,
        message: log.message,
        level: log.level
      }))
    };

    logger.info('Fetched affiliate call detail', {
      affiliateId,
      callId,
      hasRecording: !!signedRecordingUrl
    });

    return NextResponse.json({
      success: true,
      data: formattedCall
    });

  } catch (err) {
    captureApiError(err, { route: '/api/affiliates/calls/[id]', action: 'GET' });
    logger.error('Failed to fetch call detail', {
      error: (err as Error).message
    });
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch call details'
    }, { status: 500 });
  }
}
