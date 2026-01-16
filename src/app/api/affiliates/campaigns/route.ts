/**
 * Affiliate Campaigns API
 *
 * WHY: Provides affiliate access to their assigned campaigns with tracking numbers.
 *      Essential for the affiliate portal campaigns page to display available campaigns.
 *
 * WHEN: GET - Loading affiliate campaigns page
 *       POST - Requesting access to a new campaign (future feature)
 *
 * HOW: Uses verifyAffiliateToken for auth, getAffiliateCampaigns service for data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken, getAffiliateCampaigns } from '@/lib/services/affiliate-service';
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
 * GET /api/affiliates/campaigns
 *
 * Returns affiliate's campaigns with tracking numbers and stats.
 * Each campaign includes payout info, tracking number (if provisioned),
 * and today's call statistics.
 */
export async function GET(request: NextRequest) {
  try {
    const { affiliateId, error } = getAffiliateIdFromRequest(request);

    if (!affiliateId) {
      return NextResponse.json({
        success: false,
        error
      }, { status: 401 });
    }

    // Use existing service method
    const { campaigns } = await getAffiliateCampaigns(affiliateId);

    // Get today's stats for each campaign
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const campaignIds = campaigns.map(c => c.campaignId);

    // Get today's call counts per campaign
    const todayStats = await prisma.call.groupBy({
      by: ['campaignId'],
      where: {
        affiliateId,
        campaignId: { in: campaignIds },
        createdAt: { gte: todayStart }
      },
      _count: { id: true },
      _sum: { affiliatePayout: true }
    });

    const todayQualified = await prisma.call.groupBy({
      by: ['campaignId'],
      where: {
        affiliateId,
        campaignId: { in: campaignIds },
        createdAt: { gte: todayStart },
        isBillable: true
      },
      _count: { id: true }
    });

    // Map stats by campaign ID
    const statsMap = new Map<string, { calls: number; qualified: number; earnings: number }>();
    for (const stat of todayStats) {
      if (stat.campaignId) {
        statsMap.set(stat.campaignId, {
          calls: stat._count.id,
          qualified: 0,
          earnings: stat._sum.affiliatePayout ? Number(stat._sum.affiliatePayout) : 0
        });
      }
    }
    for (const stat of todayQualified) {
      if (stat.campaignId) {
        const existing = statsMap.get(stat.campaignId);
        if (existing) {
          existing.qualified = stat._count.id;
        }
      }
    }

    // Enrich campaigns with today's stats
    const enrichedCampaigns = campaigns.map(campaign => {
      const todayStat = statsMap.get(campaign.campaignId) || {
        calls: 0,
        qualified: 0,
        earnings: 0
      };

      // Get the tracking number for this campaign (first active one)
      const trackingNumber = campaign.trackingNumbers.find(
        tn => tn.provisioningStatus === 'ACTIVE'
      ) || campaign.trackingNumbers[0] || null;

      return {
        id: campaign.campaignId,
        name: campaign.campaign.name,
        description: campaign.campaign.description,
        serviceType: campaign.campaign.serviceType,
        status: campaign.status,
        callBasePayout: campaign.customCallPayout || campaign.campaign.callBasePayout,
        minCallDuration: campaign.campaign.minCallDuration,
        trackingNumber: trackingNumber ? {
          id: trackingNumber.id,
          phoneNumber: trackingNumber.phoneNumber,
          phoneNumberDisplay: trackingNumber.phoneNumberDisplay,
          provisioningStatus: trackingNumber.provisioningStatus,
          totalCalls: trackingNumber.totalCalls,
          totalQualifiedCalls: trackingNumber.totalQualifiedCalls
        } : null,
        todayStats: {
          calls: todayStat.calls,
          qualifiedCalls: todayStat.qualified,
          earnings: todayStat.earnings
        }
      };
    });

    logger.info('Fetched affiliate campaigns', {
      affiliateId,
      campaignCount: enrichedCampaigns.length
    });

    return NextResponse.json({
      success: true,
      data: enrichedCampaigns
    });

  } catch (err) {
    captureApiError(err, { route: '/api/affiliates/campaigns', action: 'GET' });
    logger.error('Failed to fetch affiliate campaigns', {
      error: (err as Error).message
    });
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch campaigns'
    }, { status: 500 });
  }
}
