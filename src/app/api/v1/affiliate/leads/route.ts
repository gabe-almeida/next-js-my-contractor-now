/**
 * Affiliate API - Leads Endpoint
 *
 * WHY: Provides programmatic access to affiliate's lead commission data.
 *      Enables affiliates to track their lead generation performance.
 *
 * WHEN: Use this endpoint to:
 *       - List lead commissions with filtering and pagination
 *       - Export lead data for reporting
 *       - Track commission status (pending, approved, paid)
 *
 * HOW: Authenticate with API key + secret, then query lead data.
 *
 * GET /api/v1/affiliate/leads
 * Query params:
 *   - page (default: 1)
 *   - limit (default: 50, max: 100)
 *   - status (filter by commission status: PENDING, APPROVED, PAID, REJECTED)
 *   - from (ISO date string)
 *   - to (ISO date string)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  withAffiliateAuth,
  AffiliateApiContext,
  handleCorsOptions
} from '@/lib/middleware/affiliate-api-auth';

// Maximum page size to prevent abuse
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

// Valid commission statuses for filtering
const VALID_COMMISSION_STATUSES = ['PENDING', 'APPROVED', 'PAID', 'REJECTED'];

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return handleCorsOptions();
}

/**
 * GET /api/v1/affiliate/leads
 *
 * List lead commissions for authenticated affiliate with filtering and pagination.
 */
export const GET = withAffiliateAuth(
  async (request: NextRequest, context: AffiliateApiContext) => {
    const { affiliateId } = context;
    const { searchParams } = new URL(request.url);

    // Parse pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10))
    );
    const skip = (page - 1) * limit;

    // Parse filters
    const status = searchParams.get('status');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    // Build where clause
    const where: any = {
      affiliateId
    };

    // Status filter (validate against allowed values)
    if (status) {
      const statuses = status
        .split(',')
        .filter(s => VALID_COMMISSION_STATUSES.includes(s));
      if (statuses.length > 0) {
        where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
      }
    }

    // Date range filter
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        const from = new Date(fromDate);
        if (!isNaN(from.getTime())) {
          where.createdAt.gte = from;
        }
      }
      if (toDate) {
        const to = new Date(toDate);
        if (!isNaN(to.getTime())) {
          where.createdAt.lte = to;
        }
      }
    }

    // Execute query
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
              zipCode: true,
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

    // Format response
    const formattedLeads = commissions.map(commission => ({
      id: commission.id,
      leadId: commission.leadId,
      commission: {
        amount: Number(commission.amount),
        rate: Number(commission.rate),
        status: commission.status
      },
      lead: commission.lead
        ? {
            id: commission.lead.id,
            zipCode: commission.lead.zipCode,
            status: commission.lead.status,
            serviceType: commission.lead.serviceType,
            submittedAt: commission.lead.createdAt.toISOString()
          }
        : null,
      timestamps: {
        created: commission.createdAt.toISOString(),
        approved: commission.approvedAt?.toISOString() || null,
        paid: commission.paidAt?.toISOString() || null,
        rejected: commission.rejectedAt?.toISOString() || null
      },
      rejectReason: commission.rejectReason || null
    }));

    return NextResponse.json({
      success: true,
      data: {
        leads: formattedLeads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      },
      timestamp: new Date().toISOString()
    });
  }
);
