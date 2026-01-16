/**
 * Tracking Number Query Service
 *
 * WHY: Provides query and lookup methods for tracking numbers.
 *      Separates read operations from provisioning for modularity.
 *
 * WHEN: Use this service for:
 *       - Looking up tracking numbers for incoming calls
 *       - Admin listing and searching tracking numbers
 *       - Getting tracking number statistics
 *       - Affiliate dashboard queries
 *
 * HOW: Uses Prisma for database queries.
 *      For provisioning operations, use tracking-number-service.ts
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { TrackingNumber } from '@prisma/client';

// =====================================
// TYPE DEFINITIONS
// =====================================

export interface TrackingNumberWithDetails extends TrackingNumber {
  campaign: {
    id: string;
    name: string;
    serviceTypeId: string;
    callBasePayout: number | null;
    minCallDuration: number;
  } | null;
  affiliate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  serviceType: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  _count?: {
    calls: number;
  };
}

export interface TrackingNumberStats {
  totalCalls: number;
  qualifiedCalls: number;
  totalRevenue: number;
  avgCallDuration: number;
}

export interface TrackingNumberListParams {
  affiliateId?: string;
  campaignId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// =====================================
// COMMON INCLUDES
// =====================================

const trackingNumberIncludes = {
  campaign: {
    select: {
      id: true,
      name: true,
      serviceTypeId: true,
      callBasePayout: true,
      minCallDuration: true
    }
  },
  affiliate: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  },
  serviceType: {
    select: {
      id: true,
      name: true,
      displayName: true
    }
  }
};

// =====================================
// QUERY METHODS
// =====================================

/**
 * Get all tracking numbers for an affiliate
 *
 * WHY: Affiliate dashboard shows their tracking numbers with stats.
 * WHEN: Campaigns page, tracking numbers list, affiliate dashboard.
 * HOW: Query with campaign and service type includes for context.
 */
export async function getTrackingNumbersByAffiliate(
  affiliateId: string
): Promise<TrackingNumberWithDetails[]> {
  try {
    const trackingNumbers = await prisma.trackingNumber.findMany({
      where: {
        affiliateId,
        provisioningStatus: { in: ['ACTIVE', 'PENDING', 'PROVISIONING'] }
      },
      include: {
        ...trackingNumberIncludes,
        _count: {
          select: { calls: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return trackingNumbers as TrackingNumberWithDetails[];
  } catch (error) {
    logger.error('Failed to fetch tracking numbers for affiliate', {
      affiliateId,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get tracking number by phone number
 *
 * WHY: Incoming call webhook needs to identify affiliate/campaign from the
 *      dialed phone number for attribution and routing.
 * WHEN: /api/calls/incoming receives a call.
 * HOW: Lookup by phone number (normalized) with all necessary context.
 */
export async function getTrackingNumberByPhone(
  phoneNumber: string
): Promise<TrackingNumberWithDetails | null> {
  try {
    const digits = phoneNumber.replace(/\D/g, '');

    const formats = [
      phoneNumber,
      digits,
      `+${digits}`,
      `+1${digits.slice(-10)}`
    ];

    const trackingNumber = await prisma.trackingNumber.findFirst({
      where: {
        phoneNumber: { in: formats },
        provisioningStatus: 'ACTIVE'
      },
      include: trackingNumberIncludes
    });

    return trackingNumber as TrackingNumberWithDetails | null;
  } catch (error) {
    logger.error('Failed to lookup tracking number by phone', {
      phoneNumber,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get tracking number by ID
 *
 * WHY: Need to fetch specific tracking number details for management.
 * WHEN: Tracking number detail view, edit operations.
 * HOW: Single query with related data.
 */
export async function getTrackingNumberById(
  trackingNumberId: string
): Promise<TrackingNumberWithDetails | null> {
  try {
    const trackingNumber = await prisma.trackingNumber.findUnique({
      where: { id: trackingNumberId },
      include: {
        ...trackingNumberIncludes,
        _count: {
          select: { calls: true }
        }
      }
    });

    return trackingNumber as TrackingNumberWithDetails | null;
  } catch (error) {
    logger.error('Failed to fetch tracking number by ID', {
      trackingNumberId,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get tracking number statistics
 *
 * WHY: Show call counts and revenue per number for performance tracking.
 * WHEN: Affiliate tracking numbers page, number detail view.
 * HOW: Aggregate from calls table for the specific tracking number.
 */
export async function getTrackingNumberStats(
  trackingNumberId: string
): Promise<TrackingNumberStats> {
  try {
    const stats = await prisma.call.aggregate({
      where: { trackingNumberId },
      _count: { id: true },
      _sum: {
        affiliatePayout: true,
        connectedDurationSeconds: true
      }
    });

    const qualifiedCalls = await prisma.call.count({
      where: {
        trackingNumberId,
        isBillable: true
      }
    });

    const avgDuration =
      stats._count.id > 0 && stats._sum.connectedDurationSeconds
        ? Math.round(Number(stats._sum.connectedDurationSeconds) / stats._count.id)
        : 0;

    return {
      totalCalls: stats._count.id,
      qualifiedCalls,
      totalRevenue: stats._sum.affiliatePayout
        ? Number(stats._sum.affiliatePayout)
        : 0,
      avgCallDuration: avgDuration
    };
  } catch (error) {
    logger.error('Failed to fetch tracking number stats', {
      trackingNumberId,
      error: (error as Error).message
    });
    throw error;
  }
}

// =====================================
// ADMIN METHODS
// =====================================

/**
 * List all tracking numbers (admin view)
 *
 * WHY: Admin needs oversight of all provisioned numbers.
 * WHEN: Admin tracking numbers page, system monitoring.
 * HOW: Paginated query with optional filters.
 */
export async function listTrackingNumbers(params: TrackingNumberListParams): Promise<{
  trackingNumbers: TrackingNumberWithDetails[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { affiliateId, campaignId, status, page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (affiliateId) where.affiliateId = affiliateId;
  if (campaignId) where.campaignId = campaignId;
  if (status) where.provisioningStatus = status;

  try {
    const [trackingNumbers, total] = await Promise.all([
      prisma.trackingNumber.findMany({
        where,
        skip,
        take: limit,
        include: {
          ...trackingNumberIncludes,
          _count: {
            select: { calls: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.trackingNumber.count({ where })
    ]);

    return {
      trackingNumbers: trackingNumbers as TrackingNumberWithDetails[],
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    logger.error('Failed to list tracking numbers', {
      error: (error as Error).message,
      params
    });
    throw error;
  }
}

/**
 * Update tracking number (increment call counters)
 *
 * WHY: After each call, we update denormalized stats on the tracking number
 *      for quick dashboard queries without aggregation.
 * WHEN: After call completion in the call flow handlers.
 * HOW: Atomic increment of totalCalls and optionally totalQualifiedCalls.
 */
export async function incrementTrackingNumberStats(
  trackingNumberId: string,
  isQualified: boolean
): Promise<void> {
  try {
    await prisma.trackingNumber.update({
      where: { id: trackingNumberId },
      data: {
        totalCalls: { increment: 1 },
        ...(isQualified && { totalQualifiedCalls: { increment: 1 } })
      }
    });
  } catch (error) {
    logger.warn('Failed to increment tracking number stats', {
      trackingNumberId,
      isQualified,
      error: (error as Error).message
    });
  }
}
