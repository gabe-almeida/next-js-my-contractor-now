/**
 * Admin Approve Commissions API
 *
 * POST /api/admin/commissions/approve - Bulk approve commissions
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAdminAuth } from '@/lib/security';
import { approveCommissions } from '@/lib/services/affiliate-commission-service';

// Validation schema
const approveSchema = z.object({
  commissionIds: z.array(z.string().uuid()).min(1, 'At least one commission ID required')
});

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
    const validation = approveSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      }, { status: 400 });
    }

    // Approve commissions
    const result = await approveCommissions(
      validation.data.commissionIds,
      authResult.user?.userId
    );

    return NextResponse.json({
      success: result.success,
      data: {
        processed: result.processed,
        failed: result.failed
      },
      errors: result.errors,
      message: `${result.processed} commissions approved${result.failed > 0 ? `, ${result.failed} failed` : ''}`
    });

  } catch (error) {
    console.error('Approve commissions error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to approve commissions'
    }, { status: 500 });
  }
}
