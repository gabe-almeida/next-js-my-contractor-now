import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { captureApiError } from '@/lib/sentry';

/**
 * Admin Transactions API
 *
 * WHY: Provides transaction history and audit trail for admin monitoring
 * WHEN: Called by admin transactions page for ping/post tracking
 * HOW: Queries Transaction table with filters, pagination, and buyer details
 */

async function handleGetTransactions(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;
  const url = new URL(req.url);

  // Parse query parameters
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const status = url.searchParams.get('status') || undefined;
  const actionType = url.searchParams.get('actionType') || undefined;
  const buyerId = url.searchParams.get('buyerId') || undefined;
  const leadId = url.searchParams.get('leadId') || undefined;
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  try {
    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    if (actionType) {
      where.actionType = actionType.toUpperCase();
    }

    if (buyerId) {
      where.buyerId = buyerId;
    }

    if (leadId) {
      where.leadId = leadId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Fetch transactions with buyer and lead details
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          buyer: {
            select: {
              id: true,
              name: true,
              displayName: true,
              type: true
            }
          },
          lead: {
            select: {
              id: true,
              zipCode: true,
              status: true,
              serviceType: {
                select: {
                  name: true,
                  displayName: true
                }
              }
            }
          }
        }
      }),
      prisma.transaction.count({ where })
    ]);

    // Transform response
    const transformedTransactions = transactions.map(tx => ({
      id: tx.id,
      leadId: tx.leadId,
      buyerId: tx.buyerId,
      buyerName: tx.buyer.name,
      buyerDisplayName: tx.buyer.displayName,
      buyerType: tx.buyer.type,
      actionType: tx.actionType,
      status: tx.status,
      bidAmount: tx.bidAmount ? Number(tx.bidAmount) : null,
      responseTime: tx.responseTime,
      errorMessage: tx.errorMessage,
      complianceIncluded: tx.complianceIncluded,
      trustedFormPresent: tx.trustedFormPresent,
      jornayaPresent: tx.jornayaPresent,
      isWinner: tx.isWinner,
      lostReason: tx.lostReason,
      cascadePosition: tx.cascadePosition,
      deliveryMethod: tx.deliveryMethod,
      leadZipCode: tx.lead.zipCode,
      leadStatus: tx.lead.status,
      serviceType: tx.lead.serviceType.name,
      serviceDisplayName: tx.lead.serviceType.displayName,
      createdAt: tx.createdAt.toISOString()
    }));

    const response = successResponse(
      {
        transactions: transformedTransactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      },
      requestId
    );

    return NextResponse.json(response);

  } catch (error) {
    captureApiError(error, { route: '/api/admin/transactions', action: 'GET' });
    logger.error('Transactions fetch error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId
    });

    const response = errorResponse(
      'TRANSACTIONS_ERROR',
      'Failed to fetch transactions',
      undefined,
      undefined,
      requestId
    );

    return NextResponse.json(response, { status: 500 });
  }
}

// Export GET handler with admin authentication
export const GET = withMiddleware(handleGetTransactions, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true
});
