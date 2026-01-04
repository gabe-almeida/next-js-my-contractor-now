/**
 * Admin Suspend Affiliate API
 *
 * POST /api/admin/affiliates/[id]/suspend - Suspend affiliate
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth } from '@/lib/security';
import {
  getAffiliateById,
  updateAffiliateStatus
} from '@/lib/services/affiliate-service';
import { AffiliateStatus } from '@/types/database';

export async function POST(
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

    // Get affiliate
    const affiliate = await getAffiliateById(params.id);

    if (!affiliate) {
      return NextResponse.json({
        success: false,
        error: 'Affiliate not found'
      }, { status: 404 });
    }

    if (affiliate.status === AffiliateStatus.SUSPENDED) {
      return NextResponse.json({
        success: false,
        error: 'Affiliate is already suspended'
      }, { status: 400 });
    }

    // Suspend affiliate
    const result = await updateAffiliateStatus(
      params.id,
      AffiliateStatus.SUSPENDED,
      authResult.user?.userId
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.affiliate!.id,
        status: result.affiliate!.status
      },
      message: 'Affiliate suspended successfully'
    });

  } catch (error) {
    console.error('Suspend affiliate error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to suspend affiliate'
    }, { status: 500 });
  }
}
