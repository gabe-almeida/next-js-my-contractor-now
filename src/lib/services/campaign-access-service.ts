/**
 * Campaign Access Service
 *
 * WHY: Handles affiliate campaign access requests and approval workflow.
 *      Separates access management from campaign queries for modularity.
 *
 * WHEN: Use this service for:
 *       - Affiliates requesting campaign access
 *       - Admin approving/rejecting access requests
 *       - Pausing/resuming affiliate access
 *       - Viewing pending access requests
 *
 * HOW: Import and call appropriate methods. Uses Prisma for database access.
 *      Campaign query methods are in campaign-service.ts
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { AffiliateCampaign } from '@prisma/client';

// =====================================
// TYPE DEFINITIONS
// =====================================

export interface CampaignAccessRequest {
  affiliateId: string;
  campaignId: string;
  notes?: string;
}

export interface CampaignAccessResult {
  success: boolean;
  affiliateCampaign?: AffiliateCampaign;
  error?: string;
}

export interface AccessApprovalOptions {
  customCallPayout?: number;
  customLeadPayout?: number;
  dailyCallCap?: number;
  dailyLeadCap?: number;
}

export interface PendingAccessRequest {
  affiliateCampaign: AffiliateCampaign;
  affiliate: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  campaign: {
    id: string;
    name: string;
  };
}

// =====================================
// ACCESS REQUEST METHODS
// =====================================

/**
 * Request access to a campaign
 *
 * WHY: Affiliates need to request access before promoting campaigns.
 *      This creates an approval workflow for admin oversight.
 * WHEN: "Request Access" button on campaign browse page.
 * HOW: Create AffiliateCampaign record with PENDING status.
 *      Validates affiliate doesn't already have access.
 */
export async function requestCampaignAccess(
  request: CampaignAccessRequest
): Promise<CampaignAccessResult> {
  const { affiliateId, campaignId } = request;

  try {
    // Check if already exists
    const existing = await prisma.affiliateCampaign.findUnique({
      where: {
        affiliateId_campaignId: { affiliateId, campaignId }
      }
    });

    if (existing) {
      if (existing.status === 'PENDING') {
        return { success: false, error: 'Access request already pending' };
      }
      if (existing.status === 'APPROVED') {
        return { success: false, error: 'Already enrolled in this campaign' };
      }
      // If REJECTED or PAUSED, allow re-request
      const updated = await prisma.affiliateCampaign.update({
        where: { id: existing.id },
        data: { status: 'PENDING', approvedAt: null }
      });
      logger.info('Campaign access re-requested', { affiliateId, campaignId });
      return { success: true, affiliateCampaign: updated };
    }

    // Check campaign exists and is active
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    if (!campaign.active) {
      return { success: false, error: 'Campaign is not currently active' };
    }

    // Create access request with campaign default payouts
    const affiliateCampaign = await prisma.affiliateCampaign.create({
      data: {
        affiliateId,
        campaignId,
        status: 'PENDING',
        customCallPayout: campaign.callBasePayout,
        customLeadPayout: campaign.leadBasePayout
      }
    });

    logger.info('Campaign access requested', {
      affiliateId,
      campaignId,
      affiliateCampaignId: affiliateCampaign.id
    });

    return { success: true, affiliateCampaign };
  } catch (error) {
    logger.error('Failed to request campaign access', {
      error: (error as Error).message,
      affiliateId,
      campaignId
    });
    return {
      success: false,
      error: `Failed to request access: ${(error as Error).message}`
    };
  }
}

// =====================================
// ADMIN APPROVAL METHODS
// =====================================

/**
 * Approve campaign access request (admin action)
 *
 * WHY: Admin needs to approve affiliate access for quality control.
 * WHEN: Admin campaign management UI, affiliate approval workflow.
 * HOW: Update AffiliateCampaign status to APPROVED with optional custom payout.
 */
export async function approveCampaignAccess(
  affiliateId: string,
  campaignId: string,
  options?: AccessApprovalOptions
): Promise<CampaignAccessResult> {
  try {
    const existing = await prisma.affiliateCampaign.findUnique({
      where: {
        affiliateId_campaignId: { affiliateId, campaignId }
      }
    });

    if (!existing) {
      return { success: false, error: 'Access request not found' };
    }

    if (existing.status === 'APPROVED') {
      return { success: false, error: 'Access already approved' };
    }

    const updateData: Record<string, unknown> = {
      status: 'APPROVED',
      approvedAt: new Date()
    };

    if (options?.customCallPayout !== undefined) {
      updateData.customCallPayout = options.customCallPayout;
    }
    if (options?.customLeadPayout !== undefined) {
      updateData.customLeadPayout = options.customLeadPayout;
    }
    if (options?.dailyCallCap !== undefined) {
      updateData.dailyCallCap = options.dailyCallCap;
    }
    if (options?.dailyLeadCap !== undefined) {
      updateData.dailyLeadCap = options.dailyLeadCap;
    }

    const affiliateCampaign = await prisma.affiliateCampaign.update({
      where: {
        affiliateId_campaignId: { affiliateId, campaignId }
      },
      data: updateData
    });

    logger.info('Campaign access approved', {
      affiliateId,
      campaignId,
      customCallPayout: options?.customCallPayout
    });

    return { success: true, affiliateCampaign };
  } catch (error) {
    logger.error('Failed to approve campaign access', {
      error: (error as Error).message,
      affiliateId,
      campaignId
    });
    return {
      success: false,
      error: `Failed to approve access: ${(error as Error).message}`
    };
  }
}

/**
 * Reject campaign access request (admin action)
 *
 * WHY: Admin may need to reject affiliates who don't meet requirements.
 * WHEN: Admin campaign management UI, affiliate review workflow.
 * HOW: Update AffiliateCampaign status to REJECTED.
 */
export async function rejectCampaignAccess(
  affiliateId: string,
  campaignId: string,
  reason?: string
): Promise<CampaignAccessResult> {
  try {
    const existing = await prisma.affiliateCampaign.findUnique({
      where: {
        affiliateId_campaignId: { affiliateId, campaignId }
      }
    });

    if (!existing) {
      return { success: false, error: 'Access request not found' };
    }

    const affiliateCampaign = await prisma.affiliateCampaign.update({
      where: {
        affiliateId_campaignId: { affiliateId, campaignId }
      },
      data: { status: 'REJECTED' }
    });

    logger.info('Campaign access rejected', { affiliateId, campaignId, reason });

    return { success: true, affiliateCampaign };
  } catch (error) {
    logger.error('Failed to reject campaign access', {
      error: (error as Error).message,
      affiliateId,
      campaignId
    });
    return {
      success: false,
      error: `Failed to reject access: ${(error as Error).message}`
    };
  }
}

/**
 * Pause affiliate campaign access (admin action)
 *
 * WHY: Admin may need to temporarily pause an affiliate's access.
 * WHEN: Quality issues, policy violations, or campaign adjustments.
 * HOW: Update AffiliateCampaign status to PAUSED.
 */
export async function pauseCampaignAccess(
  affiliateId: string,
  campaignId: string
): Promise<CampaignAccessResult> {
  try {
    const affiliateCampaign = await prisma.affiliateCampaign.update({
      where: {
        affiliateId_campaignId: { affiliateId, campaignId }
      },
      data: { status: 'PAUSED' }
    });

    logger.info('Campaign access paused', { affiliateId, campaignId });

    return { success: true, affiliateCampaign };
  } catch (error) {
    logger.error('Failed to pause campaign access', {
      error: (error as Error).message,
      affiliateId,
      campaignId
    });
    return {
      success: false,
      error: `Failed to pause access: ${(error as Error).message}`
    };
  }
}

// =====================================
// QUERY METHODS
// =====================================

/**
 * Get pending access requests (admin view)
 *
 * WHY: Admin needs to see and process pending affiliate access requests.
 * WHEN: Admin affiliate management page, approval workflow.
 * HOW: Query AffiliateCampaign with PENDING status, includes affiliate info.
 */
export async function getPendingAccessRequests(): Promise<PendingAccessRequest[]> {
  try {
    const pending = await prisma.affiliateCampaign.findMany({
      where: { status: 'PENDING' },
      include: {
        affiliate: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        campaign: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return pending.map(p => ({
      affiliateCampaign: p,
      affiliate: p.affiliate,
      campaign: p.campaign
    }));
  } catch (error) {
    logger.error('Failed to fetch pending access requests', {
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get affiliate campaign access status
 *
 * WHY: Need to check if affiliate has access before operations.
 * WHEN: Provisioning numbers, API calls, dashboard checks.
 * HOW: Single query for specific affiliate/campaign pair.
 */
export async function getAffiliateCampaignAccess(
  affiliateId: string,
  campaignId: string
): Promise<AffiliateCampaign | null> {
  try {
    return prisma.affiliateCampaign.findUnique({
      where: {
        affiliateId_campaignId: { affiliateId, campaignId }
      }
    });
  } catch (error) {
    logger.error('Failed to get affiliate campaign access', {
      error: (error as Error).message,
      affiliateId,
      campaignId
    });
    throw error;
  }
}
