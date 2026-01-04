/**
 * Admin Affiliate Detail API
 *
 * GET /api/admin/affiliates/[id] - Get affiliate details with stats
 * PUT /api/admin/affiliates/[id] - Update affiliate
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAdminAuth } from '@/lib/security';
import {
  getAffiliateById,
  updateAffiliate,
  updateCommissionRate,
  updateAffiliateStatus
} from '@/lib/services/affiliate-service';
import { getAffiliateStats } from '@/lib/services/affiliate-commission-service';
import { AffiliateStatus } from '@/types/database';

// Validation schema for updating affiliate
const updateAffiliateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  companyName: z.string().max(100).optional().nullable().transform(v => v ?? undefined),
  phone: z.string().max(20).optional().nullable().transform(v => v ?? undefined),
  commissionRate: z.number().min(0).max(1).optional(),
  status: z.nativeEnum(AffiliateStatus).optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate admin auth
    const authResult = await validateAdminAuth(request);
    if (!authResult.valid) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Unauthorized'
      }, { status: 401 });
    }

    // Get affiliate with stats
    const [affiliate, stats] = await Promise.all([
      getAffiliateById(params.id),
      getAffiliateStats(params.id)
    ]);

    if (!affiliate) {
      return NextResponse.json({
        success: false,
        error: 'Affiliate not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: affiliate.id,
        email: affiliate.email,
        firstName: affiliate.firstName,
        lastName: affiliate.lastName,
        companyName: affiliate.companyName,
        phone: affiliate.phone,
        commissionRate: affiliate.commissionRate,
        status: affiliate.status,
        emailVerified: affiliate.emailVerified,
        createdAt: affiliate.createdAt,
        stats: {
          // Field names match frontend expectations
          totalEarnings: stats.totalEarned,
          pendingEarnings: stats.pendingCommissions,
          approvedCommissions: stats.approvedCommissions,
          availableBalance: stats.availableForWithdrawal,
          totalClicks: stats.totalClicks,
          totalConversions: stats.totalConversions,
          conversionRate: Math.round(stats.conversionRate * 10000) / 100,
          totalLinks: stats.activeLinks
        }
      }
    });

  } catch (error) {
    console.error('Get admin affiliate error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get affiliate'
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate admin auth
    const authResult = await validateAdminAuth(request);
    if (!authResult.valid) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Unauthorized'
      }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validation = updateAffiliateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { commissionRate, status, ...profileData } = validation.data;

    // Update profile fields
    if (Object.keys(profileData).length > 0) {
      const result = await updateAffiliate(params.id, profileData);
      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 400 });
      }
    }

    // Update commission rate if provided
    if (commissionRate !== undefined) {
      const result = await updateCommissionRate(
        params.id,
        commissionRate,
        authResult.user?.userId
      );
      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 400 });
      }
    }

    // Update status if provided
    if (status !== undefined) {
      const result = await updateAffiliateStatus(
        params.id,
        status,
        authResult.user?.userId
      );
      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 400 });
      }
    }

    // Get updated affiliate
    const affiliate = await getAffiliateById(params.id);

    return NextResponse.json({
      success: true,
      data: affiliate,
      message: 'Affiliate updated successfully'
    });

  } catch (error) {
    console.error('Update admin affiliate error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update affiliate'
    }, { status: 500 });
  }
}
