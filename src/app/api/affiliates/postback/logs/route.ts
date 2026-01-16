/**
 * Postback Logs Endpoint
 *
 * WHY: Allows affiliates to view their postback delivery history
 *      for debugging and monitoring purposes.
 *
 * WHEN: When affiliate wants to check if postbacks are being delivered.
 *
 * HOW: Returns paginated list of postback attempts with status.
 *
 * GET /api/affiliates/postback/logs
 * Query params:
 *   - page (default: 1)
 *   - limit (default: 20, max: 100)
 *   - status (success, failed, all)
 *   - from (ISO date)
 *   - to (ISO date)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    // Authenticate affiliate
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing authorization token' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const verification = verifyAffiliateToken(token);

    if (!verification.valid || !verification.affiliateId) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Invalid token' },
        { status: 401 }
      );
    }

    const affiliateId = verification.affiliateId;
    const { searchParams } = new URL(request.url);

    // Parse pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10))
    );
    const skip = (page - 1) * limit;

    // Parse filters
    const statusFilter = searchParams.get('status'); // 'success', 'failed', 'all'
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    // Build where clause for calls that belong to this affiliate
    const callWhere: any = {
      affiliateId,
      // Only include calls that should have postbacks (billable calls)
      isBillable: true
    };

    // Build where clause for activity logs
    const logWhere: any = {
      event: 'postback.sent',
      call: callWhere
    };

    // Date filter
    if (fromDate || toDate) {
      logWhere.timestamp = {};
      if (fromDate) {
        const from = new Date(fromDate);
        if (!isNaN(from.getTime())) {
          logWhere.timestamp.gte = from;
        }
      }
      if (toDate) {
        const to = new Date(toDate);
        if (!isNaN(to.getTime())) {
          logWhere.timestamp.lte = to;
        }
      }
    }

    // Get postback logs
    const [logs, total] = await Promise.all([
      prisma.callActivityLog.findMany({
        where: logWhere,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          call: {
            select: {
              id: true,
              twilioCallSid: true,
              status: true,
              isBillable: true,
              affiliatePayout: true,
              createdAt: true,
              campaign: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }),
      prisma.callActivityLog.count({ where: logWhere })
    ]);

    // Format response
    const formattedLogs = logs
      .map(log => {
        const details = log.details as any;

        // Apply status filter after fetching (JSON field filter)
        if (statusFilter === 'success' && !details?.success) return null;
        if (statusFilter === 'failed' && details?.success) return null;

        return {
          id: log.id,
          timestamp: log.timestamp.toISOString(),
          success: details?.success || false,
          attempt: details?.attempt || 1,
          statusCode: details?.statusCode,
          error: details?.error,
          retryScheduled: details?.retryScheduled,
          call: log.call
            ? {
                id: log.call.id,
                callSid: log.call.twilioCallSid,
                status: log.call.status,
                campaign: log.call.campaign?.name,
                payout: log.call.affiliatePayout
                  ? Number(log.call.affiliatePayout)
                  : null,
                createdAt: log.call.createdAt.toISOString()
              }
            : null
        };
      })
      .filter(Boolean);

    // Get summary stats
    const [successCount, failedCount] = await Promise.all([
      prisma.callActivityLog.count({
        where: {
          ...logWhere,
          details: {
            path: ['success'],
            equals: true
          }
        }
      }),
      prisma.callActivityLog.count({
        where: {
          ...logWhere,
          details: {
            path: ['success'],
            equals: false
          }
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        logs: formattedLogs,
        summary: {
          total,
          successful: successCount,
          failed: failedCount,
          successRate: total > 0
            ? ((successCount / total) * 100).toFixed(2)
            : '0.00'
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      }
    });
  } catch (error) {
    logger.error('Get postback logs error', {
      error: (error as Error).message
    });

    return NextResponse.json(
      { success: false, error: 'Failed to get postback logs' },
      { status: 500 }
    );
  }
}
