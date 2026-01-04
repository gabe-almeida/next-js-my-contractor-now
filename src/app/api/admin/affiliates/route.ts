/**
 * Admin Affiliates API
 *
 * GET /api/admin/affiliates - List all affiliates
 * POST /api/admin/affiliates - Create affiliate (admin-approved)
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAdminAuth } from '@/lib/security';
import { prisma } from '@/lib/prisma';
import {
  listAffiliates,
  createAffiliate,
  updateAffiliateStatus
} from '@/lib/services/affiliate-service';
import { AffiliateStatus } from '@/types/database';

// Validation schema for admin creating affiliate
const createAffiliateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  companyName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  autoApprove: z.boolean().optional().default(true)
});

export async function GET(request: NextRequest) {
  try {
    // Validate admin auth
    const authResult = await validateAdminAuth(request);
    if (!authResult.valid) {
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Unauthorized'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status') as AffiliateStatus | null;
    const search = searchParams.get('search');

    const result = await listAffiliates({
      page,
      limit,
      status: status || undefined,
      search: search || undefined
    });

    // Get earnings aggregations for all affiliates in the result
    const affiliateIds = result.affiliates.map(a => a.id);
    const earningsAggregations = await prisma.affiliateCommission.groupBy({
      by: ['affiliateId'],
      where: {
        affiliateId: { in: affiliateIds },
        status: 'APPROVED'
      },
      _sum: { amount: true }
    });
    const earningsMap = new Map(
      earningsAggregations.map(e => [e.affiliateId, Number(e._sum.amount) || 0])
    );

    // Format affiliates for admin view with earnings
    const affiliates = result.affiliates.map(affiliate => ({
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
      totalEarnings: earningsMap.get(affiliate.id) || 0
    }));

    return NextResponse.json({
      success: true,
      data: affiliates,
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total
      }
    });

  } catch (error) {
    console.error('Get admin affiliates error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get affiliates'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const validation = createAffiliateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { autoApprove, ...affiliateData } = validation.data;

    // Create affiliate
    const result = await createAffiliate(affiliateData);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    // Auto-approve if requested
    if (autoApprove) {
      await updateAffiliateStatus(result.affiliate!.id, AffiliateStatus.ACTIVE);
      result.affiliate!.status = AffiliateStatus.ACTIVE;
    }

    const affiliate = result.affiliate!;
    return NextResponse.json({
      success: true,
      data: {
        id: affiliate.id,
        email: affiliate.email,
        firstName: affiliate.firstName,
        lastName: affiliate.lastName,
        status: affiliate.status
      },
      message: 'Affiliate created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Create admin affiliate error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create affiliate'
    }, { status: 500 });
  }
}
