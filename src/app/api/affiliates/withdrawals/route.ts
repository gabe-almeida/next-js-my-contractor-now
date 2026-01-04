/**
 * Affiliate Withdrawals API
 *
 * GET /api/affiliates/withdrawals - List withdrawal requests
 * POST /api/affiliates/withdrawals - Create withdrawal request
 * Requires affiliate authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import {
  getWithdrawalsByAffiliateId,
  createWithdrawalRequest,
  getAvailableBalance
} from '@/lib/services/affiliate-withdrawal-service';

// Validation schema for withdrawal request
const withdrawalSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['paypal', 'bank_transfer', 'check']),
  methodDetails: z.string().optional()
});

/**
 * Extracts and verifies affiliate ID from request
 */
function getAffiliateIdFromRequest(request: NextRequest): {
  affiliateId: string | null;
  error: string | null;
} {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { affiliateId: null, error: 'Authorization required' };
  }

  const token = authHeader.substring(7);
  const verification = verifyAffiliateToken(token);

  if (!verification.valid) {
    return { affiliateId: null, error: verification.error || 'Invalid token' };
  }

  return { affiliateId: verification.affiliateId!, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const { affiliateId, error } = getAffiliateIdFromRequest(request);

    if (!affiliateId) {
      return NextResponse.json({
        success: false,
        error
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // Get withdrawals and available balance
    const [result, availableBalance] = await Promise.all([
      getWithdrawalsByAffiliateId(affiliateId, { page, limit }),
      getAvailableBalance(affiliateId)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        withdrawals: result.withdrawals.map(w => ({
          id: w.id,
          amount: w.amount,
          method: w.method,
          status: w.status,
          processedAt: w.processedAt,
          notes: w.notes,
          createdAt: w.createdAt
        })),
        availableBalance
      },
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total
      }
    });

  } catch (error) {
    console.error('Get affiliate withdrawals error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get withdrawals'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { affiliateId, error } = getAffiliateIdFromRequest(request);

    if (!affiliateId) {
      return NextResponse.json({
        success: false,
        error
      }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validation = withdrawalSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      }, { status: 400 });
    }

    // Create withdrawal request
    const result = await createWithdrawalRequest(affiliateId, validation.data);

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
        amount: withdrawal.amount,
        method: withdrawal.method,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt
      },
      message: 'Withdrawal request submitted successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Create withdrawal request error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create withdrawal request'
    }, { status: 500 });
  }
}
