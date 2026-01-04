/**
 * Affiliate Leads API
 *
 * GET /api/affiliates/leads - List referred leads (privacy-safe)
 * Only shows lead ID, service type, status, and commission - NO customer PII
 * Requires affiliate authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { prisma } from '@/lib/prisma';

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
    const skip = (page - 1) * limit;
    const serviceTypeId = searchParams.get('serviceTypeId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Get leads that have commissions for this affiliate
    const where: any = {
      affiliateId
    };

    if (serviceTypeId) {
      where.lead = { serviceTypeId };
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [commissions, total] = await Promise.all([
      prisma.affiliateCommission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lead: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              serviceType: {
                select: {
                  id: true,
                  name: true,
                  displayName: true
                }
              }
            }
          }
        }
      }),
      prisma.affiliateCommission.count({ where })
    ]);

    // Format response - privacy-safe, no PII
    const leads = commissions.map(commission => ({
      leadId: commission.lead.id,
      serviceType: commission.lead.serviceType?.displayName || 'Unknown',
      leadStatus: commission.lead.status,
      leadDate: commission.lead.createdAt,
      commissionAmount: Number(commission.amount),
      commissionStatus: commission.status,
      commissionDate: commission.createdAt
    }));

    return NextResponse.json({
      success: true,
      data: leads,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get affiliate leads error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get leads'
    }, { status: 500 });
  }
}
