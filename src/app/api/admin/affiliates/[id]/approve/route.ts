/**
 * Admin Approve Affiliate API
 *
 * POST /api/admin/affiliates/[id]/approve - Approve pending affiliate
 * Requires admin authentication
 *
 * WHY: Approves pending affiliates and auto-creates their default tracking link.
 * WHEN: Admin clicks "Approve" on a PENDING affiliate in the admin panel.
 * HOW: Updates status to ACTIVE, then creates a default tracking link so
 *      affiliates can immediately start sharing their link after approval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth } from '@/lib/security';
import {
  getAffiliateById,
  updateAffiliateStatus
} from '@/lib/services/affiliate-service';
import { createLink } from '@/lib/services/affiliate-link-service';
import { AffiliateStatus } from '@/types/database';
import { captureApiError } from '@/lib/sentry';

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

    if (affiliate.status !== AffiliateStatus.PENDING) {
      return NextResponse.json({
        success: false,
        error: `Cannot approve affiliate with status ${affiliate.status}`
      }, { status: 400 });
    }

    // Approve affiliate
    const result = await updateAffiliateStatus(
      params.id,
      AffiliateStatus.ACTIVE,
      authResult.user?.userId
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    // Auto-create default tracking link for newly approved affiliate
    // This ensures they have a usable link immediately after approval
    let defaultLinkCode: string | null = null;
    try {
      const linkResult = await createLink(params.id, {
        name: 'Default Link',
        targetPath: '/'
      });
      if (linkResult.success && linkResult.link) {
        defaultLinkCode = linkResult.link.code;
      }
    } catch (linkError) {
      // Log but don't fail the approval - link creation is a nice-to-have
      console.warn('Failed to create default link for affiliate:', linkError);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.affiliate!.id,
        status: result.affiliate!.status,
        defaultLinkCode
      },
      message: 'Affiliate approved successfully'
    });

  } catch (error) {
    captureApiError(error, { route: '/api/admin/affiliates/[id]/approve', action: 'POST' });
    console.error('Approve affiliate error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to approve affiliate'
    }, { status: 500 });
  }
}
