/**
 * Admin Tracking Numbers API
 *
 * WHY: Provides admin access to all tracking numbers across affiliates
 *      for monitoring costs and usage.
 *
 * WHEN: GET - Admin views tracking numbers list or cost dashboard
 *
 * HOW: Returns all tracking numbers with affiliate info and call stats.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth } from '@/lib/security';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';

// Twilio pricing (approximate monthly cost per number)
const TWILIO_LOCAL_MONTHLY_COST = 1.15;
const TWILIO_TOLL_FREE_MONTHLY_COST = 2.15;

/**
 * Check if phone number is toll-free
 */
function isTollFree(phoneNumber: string): boolean {
  return (
    phoneNumber.startsWith('+1800') ||
    phoneNumber.startsWith('+1833') ||
    phoneNumber.startsWith('+1844') ||
    phoneNumber.startsWith('+1855') ||
    phoneNumber.startsWith('+1866') ||
    phoneNumber.startsWith('+1877') ||
    phoneNumber.startsWith('+1888')
  );
}

/**
 * GET /api/admin/tracking-numbers
 *
 * Returns all tracking numbers with stats and cost information.
 *
 * Query params:
 * - status: Filter by provisioning status (ACTIVE, PENDING, RELEASED, etc.)
 * - affiliateId: Filter by specific affiliate
 * - includeInactive: Include released/failed numbers (default: false)
 * - summary: Return only summary stats for cost dashboard (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateAdminAuth(request);
    if (!authResult.valid) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Unauthorized'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const affiliateId = searchParams.get('affiliateId');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const summaryOnly = searchParams.get('summary') === 'true';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.provisioningStatus = status;
    } else if (!includeInactive) {
      where.provisioningStatus = { in: ['ACTIVE', 'PENDING', 'PROVISIONING'] };
    }

    if (affiliateId) {
      where.affiliateId = affiliateId;
    }

    // Fetch tracking numbers with relations
    const trackingNumbers = await prisma.trackingNumber.findMany({
      where,
      include: {
        affiliate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            email: true
          }
        },
        campaign: {
          select: {
            id: true,
            name: true
          }
        },
        serviceType: {
          select: {
            id: true,
            name: true,
            displayName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate 30-day call activity for each number
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCallCounts = await prisma.call.groupBy({
      by: ['trackingNumberId'],
      where: {
        trackingNumberId: { in: trackingNumbers.map(tn => tn.id) },
        createdAt: { gte: thirtyDaysAgo }
      },
      _count: { id: true }
    });

    const recentCallMap = new Map(
      recentCallCounts.map(c => [c.trackingNumberId, c._count.id])
    );

    // Format response
    const formattedNumbers = trackingNumbers.map(tn => {
      const tollFree = isTollFree(tn.phoneNumber);
      const monthlyCost = tollFree ? TWILIO_TOLL_FREE_MONTHLY_COST : TWILIO_LOCAL_MONTHLY_COST;
      const recentCalls = recentCallMap.get(tn.id) || 0;

      return {
        id: tn.id,
        phoneNumber: tn.phoneNumber,
        phoneNumberDisplay: tn.phoneNumberDisplay,
        provisioningStatus: tn.provisioningStatus,
        provisioningType: tn.provisioningType,
        isTollFree: tollFree,
        monthlyCost,
        totalCalls: tn.totalCalls,
        totalQualifiedCalls: tn.totalQualifiedCalls,
        recentCalls, // Last 30 days
        isInactive: recentCalls === 0 && tn.provisioningStatus === 'ACTIVE',
        createdAt: tn.createdAt.toISOString(),
        affiliate: tn.affiliate ? {
          id: tn.affiliate.id,
          name: tn.affiliate.companyName || `${tn.affiliate.firstName} ${tn.affiliate.lastName}`,
          email: tn.affiliate.email
        } : null,
        campaign: tn.campaign ? {
          id: tn.campaign.id,
          name: tn.campaign.name
        } : null,
        serviceType: tn.serviceType ? {
          id: tn.serviceType.id,
          name: tn.serviceType.displayName || tn.serviceType.name
        } : null
      };
    });

    // Calculate summary stats
    const activeNumbers = formattedNumbers.filter(tn => tn.provisioningStatus === 'ACTIVE');
    const tollFreeCount = activeNumbers.filter(tn => tn.isTollFree).length;
    const localCount = activeNumbers.length - tollFreeCount;
    const totalMonthlyCost = activeNumbers.reduce((sum, tn) => sum + tn.monthlyCost, 0);
    const inactiveCount = activeNumbers.filter(tn => tn.isInactive).length;
    const inactiveMonthlyCost = activeNumbers
      .filter(tn => tn.isInactive)
      .reduce((sum, tn) => sum + tn.monthlyCost, 0);

    // Group by affiliate for cost breakdown
    const costByAffiliate = new Map<string, { name: string; count: number; cost: number; calls: number }>();
    for (const tn of activeNumbers) {
      const affId = tn.affiliate?.id || 'unassigned';
      const affName = tn.affiliate?.name || 'Unassigned';
      const existing = costByAffiliate.get(affId) || { name: affName, count: 0, cost: 0, calls: 0 };
      existing.count += 1;
      existing.cost += tn.monthlyCost;
      existing.calls += tn.totalCalls;
      costByAffiliate.set(affId, existing);
    }

    const affiliateCostBreakdown = Array.from(costByAffiliate.entries())
      .map(([id, data]) => ({ affiliateId: id, ...data }))
      .sort((a, b) => b.cost - a.cost);

    const summary = {
      totalNumbers: activeNumbers.length,
      tollFreeCount,
      localCount,
      totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
      inactiveNumbers: inactiveCount,
      inactiveMonthlyCost: Math.round(inactiveMonthlyCost * 100) / 100,
      potentialSavings: Math.round(inactiveMonthlyCost * 100) / 100,
      totalCalls: activeNumbers.reduce((sum, tn) => sum + tn.totalCalls, 0),
      totalQualifiedCalls: activeNumbers.reduce((sum, tn) => sum + tn.totalQualifiedCalls, 0),
      affiliateCostBreakdown
    };

    if (summaryOnly) {
      return NextResponse.json({
        success: true,
        data: { summary }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        trackingNumbers: formattedNumbers,
        summary
      }
    });

  } catch (error) {
    captureApiError(error, { route: '/api/admin/tracking-numbers', action: 'GET' });
    console.error('Get admin tracking numbers error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get tracking numbers'
    }, { status: 500 });
  }
}
