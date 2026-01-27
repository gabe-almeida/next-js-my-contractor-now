/**
 * Admin Call Detail API
 *
 * WHY: Provides comprehensive call detail including all bids, cascade history,
 *      and PING responses for admin debugging and auditing.
 * WHEN: Admin clicks on a call to view full auction details.
 * HOW: Fetches call with all related CallBid records and activity logs.
 */

import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';

async function handleGetCallDetail(
  req: EnhancedRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = params;

  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        errorResponse('INVALID_ID', 'Invalid call ID format', { id }, 'id', requestId),
        { status: 400 }
      );
    }

    // Fetch call with all relations
    const call = await prisma.call.findUnique({
      where: { id },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            minCallDuration: true,
            callBasePayout: true,
          },
        },
        serviceType: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
        trackingNumber: {
          select: {
            id: true,
            phoneNumber: true,
            phoneNumberDisplay: true,
          },
        },
        affiliate: {
          select: {
            id: true,
            companyName: true,
            contactEmail: true,
          },
        },
        winningBuyer: {
          select: {
            id: true,
            name: true,
            displayName: true,
            type: true,
          },
        },
        // Get all bids for this call
        bids: {
          orderBy: [{ bidAmount: 'desc' }, { responseTimeMs: 'asc' }],
          include: {
            buyer: {
              select: {
                id: true,
                name: true,
                displayName: true,
                type: true,
              },
            },
          },
        },
        // Get activity logs
        activityLogs: {
          orderBy: { timestamp: 'asc' },
          select: {
            id: true,
            timestamp: true,
            event: true,
            message: true,
            level: true,
            details: true,
          },
        },
      },
    });

    if (!call) {
      return NextResponse.json(
        errorResponse('CALL_NOT_FOUND', 'Call not found', { id }, 'id', requestId),
        { status: 404 }
      );
    }

    // Format bids with detailed info
    const formattedBids = call.bids.map((bid, index) => {
      const pingResponse = bid.pingResponse as Record<string, any> | null;

      return {
        rank: index + 1,
        buyerId: bid.buyerId,
        buyerName: bid.buyer?.displayName || bid.buyer?.name || 'Unknown',
        buyerType: bid.buyer?.type || 'UNKNOWN',
        bidAmount: Number(bid.bidAmount),
        responseTimeMs: bid.responseTimeMs,
        bidStatus: bid.bidStatus,
        transferNumber: bid.transferNumber,
        isWinner: bid.buyerId === call.winningBuyerId,
        // PING response details (for network buyers)
        pingResponse: pingResponse
          ? {
              bidId: pingResponse.bidId,
              expireInSeconds: pingResponse.expireInSeconds,
              expiresAt: pingResponse.expiresAt,
              phoneNumber: pingResponse.phoneNumber,
              bidTerms: pingResponse.bidTerms,
              warnings: pingResponse.warnings,
              rawResponse: pingResponse.rawResponse,
            }
          : null,
        createdAt: bid.createdAt,
      };
    });

    // Calculate auction summary
    const auctionSummary = {
      eligibleBuyersCount: call.eligibleBuyersCount || 0,
      bidsReceived: formattedBids.length,
      auctionDurationMs: call.auctionDurationMs,
      auctionStartedAt: call.auctionStartedAt,
      auctionCompletedAt: call.auctionCompletedAt,
      winningBid: call.winningBid ? Number(call.winningBid) : null,
      winnerName: call.winningBuyer?.displayName || call.winningBuyer?.name || null,
      winnerId: call.winningBuyerId,
    };

    // Calculate cascade summary
    const cascadeSummary = {
      position: call.cascadePosition,
      attempts: call.cascadeAttempts,
      maxDepth: call.maxCascadeDepth,
    };

    // Timing breakdown
    const timing = {
      createdAt: call.createdAt,
      answeredAt: call.answeredAt,
      ivrCompletedAt: call.ivrCompletedAt,
      auctionStartedAt: call.auctionStartedAt,
      auctionCompletedAt: call.auctionCompletedAt,
      connectedAt: call.connectedAt,
      buyerAnsweredAt: call.buyerAnsweredAt,
      endedAt: call.endedAt,
      // Durations
      totalDurationSeconds: call.totalDurationSeconds,
      connectedDurationSeconds: call.connectedDurationSeconds,
      buyerRingDurationSeconds: call.buyerRingDurationSeconds,
      recordingDurationSeconds: call.recordingDurationSeconds,
    };

    // Financial summary
    const financials = {
      isBillable: call.isBillable,
      buyerCharge: call.buyerCharge ? Number(call.buyerCharge) : null,
      affiliatePayout: call.affiliatePayout ? Number(call.affiliatePayout) : null,
      platformMargin: call.platformMargin ? Number(call.platformMargin) : null,
    };

    // Build detailed response
    const detailedCall = {
      id: call.id,
      twilioCallSid: call.twilioCallSid,
      status: call.status,
      previousStatus: call.previousStatus,
      disposition: call.disposition,
      hangupReason: call.hangupReason,

      // Caller info
      caller: {
        phone: call.callerPhone,
        phoneDisplay: call.callerPhoneDisplay,
        city: call.callerCity,
        state: call.callerState,
        zip: call.callerZip,
        name: call.callerName,
      },

      // IVR info
      ivr: {
        responses: call.ivrResponses,
        isQualified: call.isQualified,
        completedAt: call.ivrCompletedAt,
      },

      // Source info
      source: {
        campaign: call.campaign,
        serviceType: call.serviceType,
        trackingNumber: call.trackingNumber,
        affiliate: call.affiliate,
      },

      // Auction details
      auction: auctionSummary,
      bids: formattedBids,
      cascade: cascadeSummary,

      // Timing
      timing,

      // Recording
      recording: {
        sid: call.recordingSid,
        url: call.recordingUrl,
        status: call.recordingStatus,
        durationSeconds: call.recordingDurationSeconds,
      },

      // Financials
      financials,

      // Postback status
      postback: {
        sent: call.postbackSent,
        sentAt: call.postbackSentAt,
        response: call.postbackResponse,
      },

      // Abandonment tracking
      abandonment: {
        phase: call.abandonmentPhase,
        reason: call.abandonmentReason,
      },

      // Activity log
      activityLog: call.activityLogs,

      // Metadata
      createdAt: call.createdAt,
      updatedAt: call.updatedAt,
    };

    return NextResponse.json(successResponse(detailedCall, requestId));
  } catch (error) {
    captureApiError(error, { route: '/api/admin/calls/[id]', action: 'GET' });
    logger.error('Admin call detail fetch error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId,
      callId: id,
    });

    return NextResponse.json(
      errorResponse('FETCH_ERROR', 'Failed to fetch call details', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

export const GET = withMiddleware(handleGetCallDetail, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true,
});
