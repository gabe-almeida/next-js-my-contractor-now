/**
 * Affiliate API - Calls Endpoint
 *
 * WHY: Provides programmatic access to affiliate's call data.
 *      Enables affiliates to integrate call data into their own systems.
 *
 * WHEN: Use this endpoint to:
 *       - List calls with filtering and pagination
 *       - Export call data for reporting
 *       - Build custom dashboards
 *
 * HOW: Authenticate with API key + secret, then query call data.
 *
 * GET /api/v1/affiliate/calls
 * Query params:
 *   - page (default: 1)
 *   - limit (default: 50, max: 100)
 *   - status (filter by call status)
 *   - from (ISO date string)
 *   - to (ISO date string)
 *   - campaignId (filter by campaign)
 *   - qualified (true/false filter by billable)
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

// Valid call statuses for filtering
const VALID_STATUSES = [
  'RINGING',
  'IVR',
  'BIDDING',
  'CONNECTING',
  'CASCADING',
  'CONNECTED',
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'CALLER_HANGUP',
  'NO_BIDS',
  'NO_ANSWER'
];

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return handleCorsOptions();
}

/**
 * GET /api/v1/affiliate/calls
 *
 * List calls for authenticated affiliate with filtering and pagination.
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
    const campaignId = searchParams.get('campaignId');
    const qualifiedFilter = searchParams.get('qualified');

    // Build where clause
    const where: any = {
      affiliateId
    };

    // Status filter (validate against allowed values)
    if (status) {
      const statuses = status.split(',').filter(s => VALID_STATUSES.includes(s));
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

    // Campaign filter
    if (campaignId) {
      where.campaignId = campaignId;
    }

    // Qualified/billable filter
    if (qualifiedFilter !== null) {
      if (qualifiedFilter === 'true') {
        where.isBillable = true;
      } else if (qualifiedFilter === 'false') {
        where.isBillable = false;
      }
    }

    // Execute query
    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          twilioCallSid: true,
          callerPhone: true,
          callerCity: true,
          callerState: true,
          callerZip: true,
          status: true,
          isQualified: true,
          isBillable: true,
          totalDurationSeconds: true,
          connectedDurationSeconds: true,
          disposition: true,
          affiliatePayout: true,
          postbackSent: true,
          createdAt: true,
          endedAt: true,
          // Include campaign info
          campaign: {
            select: {
              id: true,
              name: true,
              serviceType: {
                select: {
                  id: true,
                  name: true,
                  displayName: true
                }
              }
            }
          },
          // Include tracking number
          trackingNumber: {
            select: {
              id: true,
              phoneNumber: true,
              phoneNumberDisplay: true
            }
          }
        }
      }),
      prisma.call.count({ where })
    ]);

    // Format response
    const formattedCalls = calls.map(call => ({
      id: call.id,
      callSid: call.twilioCallSid,
      caller: {
        phone: maskPhoneNumber(call.callerPhone),
        city: call.callerCity,
        state: call.callerState,
        zip: call.callerZip
      },
      trackingNumber: call.trackingNumber
        ? {
            id: call.trackingNumber.id,
            number: call.trackingNumber.phoneNumber,
            display: call.trackingNumber.phoneNumberDisplay
          }
        : null,
      campaign: call.campaign
        ? {
            id: call.campaign.id,
            name: call.campaign.name,
            serviceType: call.campaign.serviceType
          }
        : null,
      status: call.status,
      isQualified: call.isQualified,
      isBillable: call.isBillable,
      duration: {
        total: call.totalDurationSeconds,
        connected: call.connectedDurationSeconds
      },
      disposition: call.disposition,
      payout: call.affiliatePayout ? Number(call.affiliatePayout) : null,
      postbackSent: call.postbackSent,
      timestamps: {
        started: call.createdAt.toISOString(),
        ended: call.endedAt?.toISOString() || null
      }
    }));

    return NextResponse.json({
      success: true,
      data: {
        calls: formattedCalls,
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

/**
 * Mask phone number for privacy
 *
 * WHY: Protects caller privacy in API responses.
 * WHEN: When returning call data.
 * HOW: Shows last 4 digits only.
 */
function maskPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  // Show last 4 digits
  return `***-***-${digits.slice(-4)}`;
}
