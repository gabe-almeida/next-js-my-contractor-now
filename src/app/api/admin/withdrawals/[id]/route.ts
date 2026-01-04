/**
 * Admin Withdrawal Detail API
 *
 * PUT /api/admin/withdrawals/[id] - Process withdrawal (complete/fail)
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAdminAuth } from '@/lib/security';
import {
  getWithdrawalById,
  processWithdrawal
} from '@/lib/services/affiliate-withdrawal-service';

// Validation schema
const processSchema = z.object({
  action: z.enum(['start_processing', 'complete', 'fail']),
  notes: z.string().max(500).optional()
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

    const withdrawal = await getWithdrawalById(params.id);

    if (!withdrawal) {
      return NextResponse.json({
        success: false,
        error: 'Withdrawal not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: withdrawal.id,
        affiliateId: withdrawal.affiliateId,
        amount: withdrawal.amount,
        method: withdrawal.method,
        methodDetails: withdrawal.methodDetails,
        status: withdrawal.status,
        processedAt: withdrawal.processedAt,
        processedBy: withdrawal.processedBy,
        notes: withdrawal.notes,
        createdAt: withdrawal.createdAt,
        affiliate: withdrawal.affiliate
      }
    });

  } catch (error) {
    console.error('Get admin withdrawal error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get withdrawal'
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
    const validation = processSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      }, { status: 400 });
    }

    // Process withdrawal
    const result = await processWithdrawal(
      params.id,
      validation.data.action,
      validation.data.notes,
      authResult.user?.userId
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    const withdrawal = result.withdrawal!;
    return NextResponse.json({
      success: true,
      data: {
        id: withdrawal.id,
        status: withdrawal.status,
        processedAt: withdrawal.processedAt
      },
      message: `Withdrawal ${validation.data.action.replace('_', ' ')} successfully`
    });

  } catch (error) {
    console.error('Process withdrawal error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process withdrawal'
    }, { status: 500 });
  }
}
