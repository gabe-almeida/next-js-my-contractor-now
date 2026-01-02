import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { RedisCache } from '@/config/redis';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { Lead, Transaction } from '@/types';
import { prisma } from '@/lib/prisma';
import {
  changeLeadStatus,
  getValidNextStatuses,
  getValidNextDispositions
} from '@/lib/services/lead-accounting-service';
import { LeadStatus, LeadDisposition, ChangeSource } from '@/types/database';

// Get specific lead with full details
async function handleGetLead(
  req: EnhancedRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = params;

  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      const response = errorResponse(
        'INVALID_ID',
        'Invalid lead ID format',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 400 });
    }

    // Get lead from database with all relations
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        serviceType: {
          select: {
            id: true,
            name: true,
            displayName: true
          }
        },
        winningBuyer: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        transactions: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        complianceAudits: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10 // Last 10 compliance audits
        }
      }
    });

    if (!lead) {
      const response = errorResponse(
        'LEAD_NOT_FOUND',
        'Lead not found',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 404 });
    }

    // Parse form data JSON
    let parsedFormData: any = {};
    try {
      parsedFormData = JSON.parse(lead.formData);
    } catch (e) {
      logger.warn('Failed to parse lead formData', { leadId: lead.id });
    }

    // Parse compliance data if present
    let parsedComplianceData: any = {};
    if (lead.complianceData) {
      try {
        parsedComplianceData = JSON.parse(lead.complianceData);
      } catch (e) {
        logger.warn('Failed to parse compliance data', { leadId: lead.id });
      }
    }

    // Calculate auction results from transactions
    const auctionResults = calculateAuctionResults(lead.transactions);

    // Prepare detailed lead response
    const detailedLead = {
      id: lead.id,
      serviceTypeId: lead.serviceTypeId,
      serviceType: lead.serviceType,
      status: lead.status,
      formData: {
        ...parsedFormData,
        zipCode: lead.zipCode,
        ownsHome: lead.ownsHome,
        timeframe: lead.timeframe
      },
      winningBuyer: lead.winningBuyer,
      winningBid: lead.winningBid,
      compliance: {
        trustedFormCertUrl: lead.trustedFormCertUrl,
        trustedFormCertId: lead.trustedFormCertId,
        jornayaLeadId: lead.jornayaLeadId,
        complianceData: parsedComplianceData,
        leadQualityScore: lead.leadQualityScore,
        audits: lead.complianceAudits.map(audit => ({
          id: audit.id,
          eventType: audit.eventType,
          eventData: audit.eventData,
          ipAddress: audit.ipAddress,
          userAgent: audit.userAgent,
          createdAt: audit.createdAt
        }))
      },
      metadata: {
        processingDuration: calculateProcessingDuration(lead),
        qualityScore: lead.leadQualityScore || calculateLeadQuality(parsedFormData, lead)
      },
      transactions: lead.transactions.map(tx => ({
        id: tx.id,
        buyerId: tx.buyerId,
        actionType: tx.actionType,
        status: tx.status,
        bidAmount: tx.bidAmount,
        responseTime: tx.responseTime,
        createdAt: tx.createdAt
      })),
      auctionResults,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt
    };

    const response = successResponse(detailedLead, requestId);
    return NextResponse.json(response);

  } catch (error) {
    logger.error('Admin lead fetch error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId,
      leadId: id
    });

    const response = errorResponse(
      'FETCH_ERROR',
      'Failed to fetch lead details',
      undefined,
      undefined,
      requestId
    );

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * Update lead status (admin operation)
 *
 * WHY: Allows super admins to change lead status with full audit trail.
 * WHEN: Admin needs to scrub, reject, or manually change a lead's state.
 * HOW: Uses centralized lead-accounting-service for validation and history.
 */
async function handleUpdateLeadStatus(
  req: EnhancedRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = params;

  try {
    const body = await req.json();
    const { status, disposition, reason, adminUserId } = body;

    // Validate status - now includes SCRUBBED and DUPLICATE
    const validStatuses = Object.values(LeadStatus);
    const statusUpper = status?.toUpperCase() as LeadStatus;

    if (!statusUpper || !validStatuses.includes(statusUpper)) {
      return NextResponse.json(
        errorResponse(
          'INVALID_STATUS',
          'Invalid lead status',
          { status, validStatuses },
          'status',
          requestId
        ),
        { status: 400 }
      );
    }

    // Validate disposition if provided
    let dispositionUpper: LeadDisposition | undefined;
    if (disposition) {
      const validDispositions = Object.values(LeadDisposition);
      dispositionUpper = disposition.toUpperCase() as LeadDisposition;
      if (!validDispositions.includes(dispositionUpper)) {
        return NextResponse.json(
          errorResponse(
            'INVALID_DISPOSITION',
            'Invalid lead disposition',
            { disposition, validDispositions },
            'disposition',
            requestId
          ),
          { status: 400 }
        );
      }
    }

    // Require reason for admin changes
    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        errorResponse(
          'MISSING_REASON',
          'Reason is required for status changes',
          undefined,
          'reason',
          requestId
        ),
        { status: 400 }
      );
    }

    // Use centralized service for atomic update with history
    const result = await changeLeadStatus({
      leadId: id,
      newStatus: statusUpper,
      newDisposition: dispositionUpper,
      reason: reason.trim(),
      adminUserId,
      changeSource: ChangeSource.ADMIN,
      ipAddress: req.context.ip
    });

    if (!result.success) {
      return NextResponse.json(
        errorResponse(
          'STATUS_CHANGE_FAILED',
          result.error || 'Failed to update status',
          undefined,
          undefined,
          requestId
        ),
        { status: 400 }
      );
    }

    // Clear related caches
    await RedisCache.delete(`lead:${id}`);

    return NextResponse.json(
      successResponse({
        leadId: id,
        status: result.lead?.status,
        disposition: result.lead?.disposition,
        updatedAt: result.lead?.updatedAt,
        historyEntry: {
          id: result.historyEntry?.id,
          createdAt: result.historyEntry?.createdAt
        }
      }, requestId)
    );

  } catch (error) {
    logger.error('Lead status update error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId,
      leadId: id
    });

    return NextResponse.json(
      errorResponse('UPDATE_ERROR', 'Failed to update lead status', undefined, undefined, requestId),
      { status: 500 }
    );
  }
}

// Helper functions
function calculateAuctionResults(transactions: any[]) {
  // Filter ping transactions with successful bids
  const pingTransactions = transactions.filter(
    tx => tx.actionType === 'PING' && tx.status === 'SUCCESS'
  );

  if (pingTransactions.length === 0) {
    return null;
  }

  // Sort by bidAmount descending
  const bidsWithAmount = pingTransactions.filter(tx => tx.bidAmount && tx.bidAmount > 0);
  const sortedBids = bidsWithAmount.sort((a, b) => (b.bidAmount || 0) - (a.bidAmount || 0));

  const winningBid = sortedBids[0];

  return {
    winningBuyerId: winningBid?.buyerId,
    winningBid: winningBid?.bidAmount,
    allBids: sortedBids.map(tx => ({
      buyerId: tx.buyerId,
      bid: tx.bidAmount,
      accepted: tx.status === 'SUCCESS',
      responseTime: tx.responseTime
    })),
    totalResponseTime: pingTransactions.reduce((sum, tx) => sum + (tx.responseTime || 0), 0),
    status: 'completed' as const
  };
}

function calculateProcessingDuration(lead: any): number {
  if (lead.status === 'PENDING') {
    return Date.now() - new Date(lead.createdAt).getTime();
  }
  // Calculate from createdAt to updatedAt
  return new Date(lead.updatedAt).getTime() - new Date(lead.createdAt).getTime();
}

function calculateLeadQuality(formData: any, lead: any): number {
  let score = 50; // Base score

  // Boost for complete information
  if (formData.email) score += 10;
  if (formData.phone) score += 10;
  if (formData.address) score += 5;

  // Boost for urgency
  if (lead.timeframe === 'IMMEDIATE') score += 20;
  else if (lead.timeframe === '1_3_MONTHS') score += 10;

  // Boost for home ownership
  if (lead.ownsHome) score += 5;

  return Math.min(100, Math.max(0, score));
}

// Note: Status transition validation now handled by lead-accounting-service

// Export route handlers with admin authentication
export const GET = withMiddleware(
  handleGetLead,
  {
    rateLimiter: 'admin',
    enableLogging: true,
    requireAuth: true,
    enableCors: true
  }
);

export const PUT = withMiddleware(
  handleUpdateLeadStatus,
  {
    rateLimiter: 'admin',
    enableLogging: true,
    requireAuth: true,
    validateContentType: true,
    enableCors: true
  }
);