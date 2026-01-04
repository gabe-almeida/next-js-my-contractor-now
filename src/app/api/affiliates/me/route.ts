/**
 * Affiliate Profile API
 *
 * GET /api/affiliates/me - Get current affiliate profile
 * PUT /api/affiliates/me - Update affiliate profile
 * Requires affiliate authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAffiliateById,
  updateAffiliate,
  verifyAffiliateToken
} from '@/lib/services/affiliate-service';

// Validation schema for profile update
const updateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  companyName: z.string().max(100).optional().nullable().transform(v => v ?? undefined),
  phone: z.string().max(20).optional().nullable().transform(v => v ?? undefined)
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

    const affiliate = await getAffiliateById(affiliateId);

    if (!affiliate) {
      return NextResponse.json({
        success: false,
        error: 'Affiliate not found'
      }, { status: 404 });
    }

    // Return profile without sensitive data
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
        createdAt: affiliate.createdAt
      }
    });

  } catch (error) {
    console.error('Get affiliate profile error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get profile'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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
    const validation = updateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      }, { status: 400 });
    }

    // Update affiliate
    const result = await updateAffiliate(affiliateId, validation.data);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    const affiliate = result.affiliate!;
    return NextResponse.json({
      success: true,
      data: {
        id: affiliate.id,
        email: affiliate.email,
        firstName: affiliate.firstName,
        lastName: affiliate.lastName,
        companyName: affiliate.companyName,
        phone: affiliate.phone
      },
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update affiliate profile error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update profile'
    }, { status: 500 });
  }
}
