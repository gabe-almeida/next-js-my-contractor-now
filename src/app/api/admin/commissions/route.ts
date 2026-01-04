/**
 * Admin Commissions API
 *
 * GET /api/admin/commissions - List pending commissions
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth } from '@/lib/security';
import { getPendingCommissions } from '@/lib/services/affiliate-commission-service';

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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const result = await getPendingCommissions({ page, limit });

    // Format commissions for admin view
    const commissions = result.commissions.map(commission => ({
      id: commission.id,
      affiliateId: commission.affiliateId,
      leadId: commission.leadId,
      amount: commission.amount,
      rate: commission.rate,
      status: commission.status,
      createdAt: commission.createdAt,
      affiliate: commission.affiliate ? {
        email: (commission.affiliate as any).email,
        firstName: (commission.affiliate as any).firstName,
        lastName: (commission.affiliate as any).lastName
      } : null,
      lead: commission.lead ? {
        serviceType: (commission.lead as any).serviceType?.displayName,
        winningBid: (commission.lead as any).winningBid
      } : null
    }));

    return NextResponse.json({
      success: true,
      data: commissions,
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total
      }
    });

  } catch (error) {
    console.error('Get admin commissions error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get commissions'
    }, { status: 500 });
  }
}
