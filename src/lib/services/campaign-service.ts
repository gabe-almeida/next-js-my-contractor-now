/**
 * Campaign Service
 *
 * WHY: Centralizes campaign query operations for the pay-per-call system.
 *      Provides consistent campaign data access for affiliates and admin.
 *
 * WHEN: Use this service for:
 *       - Admin browsing/managing campaigns
 *       - Affiliates browsing available campaigns
 *       - Getting campaign details and payout rates
 *
 * HOW: Import and call appropriate methods. Uses Prisma for database access.
 *      For affiliate access management, use campaign-access-service.ts
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Campaign } from '@prisma/client';

// =====================================
// TYPE DEFINITIONS
// =====================================

export interface CampaignWithDetails extends Campaign {
  serviceType: {
    id: string;
    name: string;
    slug: string;
    displayName: string;
  };
  _count: {
    affiliateCampaigns: number;
    trackingNumbers: number;
  };
}

export interface CampaignListParams {
  serviceTypeId?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

export interface CampaignListResult {
  campaigns: CampaignWithDetails[];
  total: number;
  page: number;
  totalPages: number;
}

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Map campaign to include slug in service type
 *
 * WHY: URL routing uses slugs, but DB stores name.
 * HOW: Convert name to lowercase with hyphens.
 */
function mapCampaignWithSlug(campaign: any): CampaignWithDetails {
  return {
    ...campaign,
    serviceType: {
      ...campaign.serviceType,
      slug: campaign.serviceType.name.toLowerCase().replace(/\s+/g, '-')
    }
  };
}

// =====================================
// CAMPAIGN QUERY METHODS
// =====================================

/**
 * Get all campaigns with optional filtering
 *
 * WHY: Admin and affiliates need to browse available campaigns.
 * WHEN: Campaign list page, campaign selection dropdowns.
 * HOW: Query with optional filters, includes service type and counts.
 */
export async function getCampaigns(
  params: CampaignListParams = {}
): Promise<CampaignListResult> {
  const { serviceTypeId, active, page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (serviceTypeId) where.serviceTypeId = serviceTypeId;
  if (active !== undefined) where.active = active;

  try {
    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        include: {
          serviceType: {
            select: { id: true, name: true, displayName: true }
          },
          _count: {
            select: { affiliateCampaigns: true, trackingNumbers: true }
          }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.campaign.count({ where })
    ]);

    return {
      campaigns: campaigns.map(mapCampaignWithSlug),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    logger.error('Failed to fetch campaigns', {
      error: (error as Error).message,
      params
    });
    throw error;
  }
}

/**
 * Get active campaigns by service type
 *
 * WHY: Affiliates browse campaigns to find ones to promote.
 * WHEN: Affiliate campaigns page, "Browse Campaigns" flow.
 * HOW: Filter by active status and optionally by service type.
 */
export async function getCampaignsByServiceType(
  serviceTypeId?: string
): Promise<CampaignWithDetails[]> {
  const where: Record<string, unknown> = { active: true };
  if (serviceTypeId) where.serviceTypeId = serviceTypeId;

  try {
    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        serviceType: {
          select: { id: true, name: true, displayName: true }
        },
        _count: {
          select: { affiliateCampaigns: true, trackingNumbers: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return campaigns.map(mapCampaignWithSlug);
  } catch (error) {
    logger.error('Failed to fetch campaigns by service type', {
      serviceTypeId,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get campaign by ID with full details
 *
 * WHY: Need full campaign info for detail views and validation.
 * WHEN: Campaign detail page, number provisioning, access requests.
 * HOW: Single query with includes for service type and counts.
 */
export async function getCampaignById(
  campaignId: string
): Promise<CampaignWithDetails | null> {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        serviceType: {
          select: { id: true, name: true, displayName: true }
        },
        _count: {
          select: { affiliateCampaigns: true, trackingNumbers: true }
        }
      }
    });

    if (!campaign) return null;
    return mapCampaignWithSlug(campaign);
  } catch (error) {
    logger.error('Failed to fetch campaign by ID', {
      campaignId,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get campaigns available to an affiliate (not yet enrolled)
 *
 * WHY: Affiliates need to see which campaigns they can request access to.
 * WHEN: "Browse Campaigns" page, campaign discovery flow.
 * HOW: Get active campaigns excluding ones affiliate is already part of.
 */
export async function getAvailableCampaignsForAffiliate(
  affiliateId: string
): Promise<CampaignWithDetails[]> {
  try {
    const existingCampaigns = await prisma.affiliateCampaign.findMany({
      where: { affiliateId },
      select: { campaignId: true }
    });

    const excludeIds = existingCampaigns.map(c => c.campaignId);

    const campaigns = await prisma.campaign.findMany({
      where: {
        active: true,
        ...(excludeIds.length > 0 && { id: { notIn: excludeIds } })
      },
      include: {
        serviceType: {
          select: { id: true, name: true, displayName: true }
        },
        _count: {
          select: { affiliateCampaigns: true, trackingNumbers: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return campaigns.map(mapCampaignWithSlug);
  } catch (error) {
    logger.error('Failed to fetch available campaigns for affiliate', {
      affiliateId,
      error: (error as Error).message
    });
    throw error;
  }
}

// Re-export access functions from campaign-access-service
export {
  requestCampaignAccess,
  approveCampaignAccess,
  rejectCampaignAccess,
  pauseCampaignAccess,
  getPendingAccessRequests,
  type CampaignAccessRequest,
  type CampaignAccessResult
} from './campaign-access-service';
