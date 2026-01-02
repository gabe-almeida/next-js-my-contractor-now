import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { RedisCache } from '@/config/redis';
import { logger, logBuyerInteraction } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { verifyWebhookAuth } from '@/lib/middleware/webhook-auth';
import { prisma } from '@/lib/prisma';
import { recordSystemStatusChange } from '@/lib/services/lead-accounting-service';
import { LeadStatus, LeadDisposition, ChangeSource } from '@/types/database';
import { BuyerResponseParser } from '@/lib/buyers/response-parser';
import { NormalizedPingStatus, NormalizedPostStatus } from '@/types/response-mapping';

// Webhook endpoint for buyer responses
async function handleBuyerWebhook(
  req: EnhancedRequest,
  { params }: { params: { buyer: string } }
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { buyer } = params;

  try {
    // SECURITY: Verify webhook signature before processing
    const { error: authError, body: bodyText } = await verifyWebhookAuth(req, buyer);
    if (authError) {
      // Signature verification failed - return error without processing
      logger.warn('Webhook signature verification failed', {
        buyer,
        requestId,
        ip: req.headers.get('x-forwarded-for') || 'unknown'
      });
      return authError;
    }

    // Parse the verified body
    const body = JSON.parse(bodyText || '{}');
    const { leadId, action, status, bid, reason, transactionId } = body;
    
    // Validate required fields
    if (!leadId || !action || !status) {
      const response = errorResponse(
        'MISSING_REQUIRED_FIELDS',
        'Missing required webhook fields: leadId, action, status',
        { receivedFields: Object.keys(body) },
        undefined,
        requestId
      );
      return NextResponse.json(response, { status: 400 });
    }
    
    // Validate buyer exists and is active
    const buyerData = await getBuyerData(buyer);
    if (!buyerData) {
      const response = errorResponse(
        'BUYER_NOT_FOUND',
        'Unknown buyer',
        { buyer },
        'buyer',
        requestId
      );
      return NextResponse.json(response, { status: 404 });
    }
    
    if (!buyerData.active) {
      const response = errorResponse(
        'BUYER_INACTIVE',
        'Buyer is not active',
        { buyer },
        'buyer',
        requestId
      );
      return NextResponse.json(response, { status: 403 });
    }
    
    // Validate lead exists in database (source of truth)
    const leadExists = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true }
    });
    if (!leadExists) {
      const response = errorResponse(
        'LEAD_NOT_FOUND',
        'Lead not found',
        { leadId },
        'leadId',
        requestId
      );
      return NextResponse.json(response, { status: 404 });
    }

    // Process webhook based on action type
    let webhookResponse;
    
    switch (action) {
      case 'ping_response':
        webhookResponse = await handlePingResponse(leadId, buyer, status, bid, body, requestId);
        break;
        
      case 'post_response':
        webhookResponse = await handlePostResponse(leadId, buyer, status, reason, body, requestId);
        break;
        
      case 'status_update':
        webhookResponse = await handleStatusUpdate(leadId, buyer, status, reason, body, requestId);
        break;
        
      default:
        const response = errorResponse(
          'UNKNOWN_ACTION',
          'Unknown webhook action',
          { action, supportedActions: ['ping_response', 'post_response', 'status_update'] },
          'action',
          requestId
        );
        return NextResponse.json(response, { status: 400 });
    }
    
    // Log webhook interaction
    logBuyerInteraction(buyer, action, {
      leadId,
      status,
      bid,
      transactionId,
      requestId
    });
    
    // Store webhook for audit trail
    await storeWebhookAudit(buyer, leadId, action, body, requestId);
    
    return NextResponse.json(webhookResponse);
    
  } catch (error) {
    logger.error('Webhook processing error', {
      error: (error as Error).message,
      requestId,
      buyer,
      stack: (error as Error).stack
    });
    
    const response = errorResponse(
      'WEBHOOK_PROCESSING_ERROR',
      'Failed to process webhook',
      undefined,
      undefined,
      requestId
    );
    
    return NextResponse.json(response, { status: 500 });
  }
}

// Handle ping response (bid submission)
async function handlePingResponse(
  leadId: string,
  buyerName: string,
  rawStatus: string,
  bid: number,
  body: any,
  requestId: string
) {
  // Get buyer ID from name for parser lookup
  const buyerRecord = await prisma.buyer.findFirst({
    where: { name: { equals: buyerName, mode: 'insensitive' } },
    select: { id: true }
  });

  // Use BuyerResponseParser to normalize the status using buyer's configured mappings
  // Pass 200 as HTTP status since webhook was received successfully
  const parsedResponse = await BuyerResponseParser.parsePingResponse(
    buyerRecord?.id || buyerName,
    200,
    { status: rawStatus, bid, ...body }
  );

  const normalizedStatus: NormalizedPingStatus = parsedResponse.status;
  const extractedBid = parsedResponse.bidAmount || bid;

  // Ensure we have buyer ID for database persistence
  const buyerId = buyerRecord?.id;
  if (!buyerId) {
    logger.error('Buyer ID not found for webhook transaction', { buyerName, leadId });
    return errorResponse(
      'BUYER_NOT_FOUND',
      'Buyer record not found',
      { buyerName },
      'buyer',
      requestId
    );
  }

  if (normalizedStatus === 'accepted') {
    // Validate bid amount
    if (!extractedBid || extractedBid <= 0) {
      return errorResponse(
        'INVALID_BID',
        'Invalid bid amount for accepted ping',
        { bid: extractedBid, rawStatus, normalizedStatus },
        'bid',
        requestId
      );
    }

    // Store bid in auction system (now persists to database)
    await storeBidResponse(leadId, buyerId, buyerName, extractedBid, body);

    logger.info('Bid received from buyer', {
      leadId,
      buyer: buyerName,
      bid: extractedBid,
      rawStatus,
      normalizedStatus,
      requestId
    });
  } else if (normalizedStatus === 'rejected') {
    // Store rejection reason (now persists to database)
    await storeBidRejection(leadId, buyerId, buyerName, body.reason || 'No reason provided');

    logger.info('Lead rejected by buyer', {
      leadId,
      buyer: buyerName,
      reason: body.reason,
      rawStatus,
      normalizedStatus,
      requestId
    });
  } else {
    // Error status
    logger.warn('Ping response error from buyer', {
      leadId,
      buyer: buyerName,
      rawStatus,
      normalizedStatus,
      requestId
    });
  }

  return successResponse({
    message: 'Ping response processed successfully',
    leadId,
    buyer: buyerName,
    rawStatus,
    normalizedStatus,
    bid: normalizedStatus === 'accepted' ? extractedBid : undefined
  }, requestId);
}

// Handle post response (final lead delivery confirmation)
async function handlePostResponse(
  leadId: string,
  buyerName: string,
  rawStatus: string,
  reason: string,
  body: any,
  requestId: string
) {
  // Get buyer ID from name for parser lookup
  const buyerRecord = await prisma.buyer.findFirst({
    where: { name: { equals: buyerName, mode: 'insensitive' } },
    select: { id: true }
  });

  // Use BuyerResponseParser to normalize the status using buyer's configured mappings
  // Pass 200 as HTTP status since webhook was received successfully
  const parsedResponse = await BuyerResponseParser.parsePostResponse(
    buyerRecord?.id || buyerName,
    200,
    { status: rawStatus, reason, ...body }
  );

  const normalizedStatus: NormalizedPostStatus = parsedResponse.status;
  const extractedReason = parsedResponse.reason || reason;

  // Ensure we have buyer ID for database persistence
  const buyerId = buyerRecord?.id;
  if (!buyerId) {
    logger.error('Buyer ID not found for webhook transaction', { buyerName, leadId });
    return errorResponse(
      'BUYER_NOT_FOUND',
      'Buyer record not found',
      { buyerName },
      'buyer',
      requestId
    );
  }

  // Get current lead from database
  const dbLead = await prisma.lead.findUnique({
    where: { id: leadId }
  });

  if (!dbLead) {
    return errorResponse(
      'LEAD_NOT_FOUND',
      'Lead not found in database',
      { leadId },
      'leadId',
      requestId
    );
  }

  const oldStatus = dbLead.status as LeadStatus;
  let newStatus: LeadStatus;
  let newDisposition: LeadDisposition | undefined;
  let historyReason: string;

  // Map normalized status to database status
  if (normalizedStatus === 'delivered') {
    newStatus = LeadStatus.SOLD;
    newDisposition = LeadDisposition.DELIVERED;
    historyReason = `Lead delivered to buyer ${buyerName}`;
    await updateLeadRevenue(leadId, buyerName);
  } else if (normalizedStatus === 'duplicate') {
    newStatus = LeadStatus.DUPLICATE;
    historyReason = `Buyer ${buyerName} reported duplicate: ${extractedReason || 'No reason provided'}`;
  } else if (normalizedStatus === 'invalid') {
    newStatus = LeadStatus.REJECTED;
    historyReason = `Buyer ${buyerName} reported invalid lead: ${extractedReason || 'No reason provided'}`;
  } else {
    // failed
    newStatus = LeadStatus.REJECTED;
    historyReason = `Buyer ${buyerName} rejected: ${extractedReason || rawStatus}`;
  }

  // Update database with optimistic locking
  const updateResult = await prisma.lead.updateMany({
    where: {
      id: leadId,
      status: oldStatus // Only update if status hasn't changed
    },
    data: {
      status: newStatus,
      ...(newDisposition && { disposition: newDisposition }),
      updatedAt: new Date()
    }
  });

  // Track the actual final status applied to the database
  let finalStatus: LeadStatus = newStatus;
  let forceUpdated = false;

  // Record history if update succeeded
  if (updateResult.count > 0) {
    await recordSystemStatusChange(
      leadId,
      oldStatus,
      newStatus,
      historyReason,
      ChangeSource.WEBHOOK
    );
  } else {
    // Race condition detected - status changed between read and update
    // Re-fetch to see current state and log the conflict
    const currentLead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { status: true }
    });

    logger.warn('Webhook update skipped due to race condition', {
      leadId,
      buyer: buyerName,
      attemptedTransition: `${oldStatus} → ${newStatus}`,
      currentStatus: currentLead?.status || 'unknown',
      rawStatus,
      normalizedStatus,
      requestId
    });

    // If buyer says delivery failed but we marked as SOLD, this is critical
    // The buyer's response should take precedence since they know if delivery succeeded
    if ((normalizedStatus === 'failed' || normalizedStatus === 'invalid') && currentLead?.status === 'SOLD') {
      logger.error('CRITICAL: Buyer reports delivery failure but lead marked SOLD', {
        leadId,
        buyer: buyerName,
        reason: extractedReason,
        rawStatus,
        normalizedStatus,
        requestId
      });
      // Force update to DELIVERY_FAILED since buyer response is authoritative
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          status: LeadStatus.DELIVERY_FAILED,
          updatedAt: new Date()
        }
      });
      await recordSystemStatusChange(
        leadId,
        LeadStatus.SOLD,
        LeadStatus.DELIVERY_FAILED,
        `Buyer ${buyerName} reported delivery failure (overriding SOLD): ${extractedReason || rawStatus}`,
        ChangeSource.WEBHOOK
      );
      finalStatus = LeadStatus.DELIVERY_FAILED;
      forceUpdated = true;
    }
  }

  // Also update Redis cache for consistency
  const lead = await RedisCache.get<{ status: string; updatedAt: Date; [key: string]: unknown }>(`lead:${leadId}`);
  if (lead) {
    lead.status = finalStatus;
    lead.updatedAt = new Date();
    await RedisCache.set(`lead:${leadId}`, lead, 3600);
  }

  // Store post response (now persists to database)
  await storePostResponse(leadId, buyerId, buyerName, rawStatus, extractedReason, body);

  logger.info('Post response received from buyer', {
    leadId,
    buyer: buyerName,
    rawStatus,
    normalizedStatus,
    finalStatus,
    forceUpdated,
    reason: extractedReason,
    requestId
  });

  return successResponse({
    message: 'Post response processed successfully',
    leadId,
    buyer: buyerName,
    rawStatus,
    normalizedStatus,
    leadStatus: finalStatus,
    forceUpdated
  }, requestId);
}

// Handle status update
async function handleStatusUpdate(
  leadId: string,
  buyerName: string,
  status: string,
  reason: string,
  body: any,
  requestId: string
) {
  // Get buyer ID for database persistence
  const buyerRecord = await prisma.buyer.findFirst({
    where: { name: { equals: buyerName, mode: 'insensitive' } },
    select: { id: true }
  });

  if (!buyerRecord?.id) {
    logger.error('Buyer ID not found for webhook transaction', { buyerName, leadId });
    return errorResponse(
      'BUYER_NOT_FOUND',
      'Buyer record not found',
      { buyerName },
      'buyer',
      requestId
    );
  }

  // Store status update (now persists to database)
  await storeStatusUpdate(leadId, buyerRecord.id, buyerName, status, reason, body);

  logger.info('Status update received from buyer', {
    leadId,
    buyer: buyerName,
    status,
    reason,
    requestId
  });

  return successResponse({
    message: 'Status update processed successfully',
    leadId,
    buyer: buyerName,
    status
  }, requestId);
}

// Helper functions
async function getBuyerData(buyerName: string): Promise<{ id: string; name: string; active: boolean } | null> {
  const buyer = await prisma.buyer.findFirst({
    where: {
      name: { equals: buyerName, mode: 'insensitive' }
    },
    select: {
      id: true,
      name: true,
      active: true
    }
  });

  return buyer;
}

async function storeBidResponse(leadId: string, buyerId: string, buyerName: string, bid: number, body: any) {
  const bidData = {
    leadId,
    buyer: buyerName,
    bid,
    timestamp: new Date(),
    rawResponse: body
  };

  // Store in Redis for quick access during auction
  await RedisCache.set(`bid:${leadId}:${buyerName}`, bidData, 86400); // Keep for 24 hours

  // Add to auction queue
  await RedisCache.sadd(`auction:${leadId}:bids`, `${buyerName}:${bid}`);

  // CRITICAL: Persist to database for audit trail and admin visibility
  await prisma.transaction.create({
    data: {
      leadId,
      buyerId,
      actionType: 'PING_WEBHOOK',
      payload: JSON.stringify({ source: 'webhook', action: 'ping_response' }),
      response: JSON.stringify(body),
      status: 'SUCCESS',
      bidAmount: bid,
      responseTime: null, // Webhook doesn't provide response time
      complianceIncluded: false,
      trustedFormPresent: false,
      jornayaPresent: false
    }
  });
}

async function storeBidRejection(leadId: string, buyerId: string, buyerName: string, reason: string) {
  const rejectionData = {
    leadId,
    buyer: buyerName,
    reason,
    timestamp: new Date()
  };

  // Store in Redis for quick lookup
  await RedisCache.set(`rejection:${leadId}:${buyerName}`, rejectionData, 86400);

  // CRITICAL: Persist to database for audit trail and admin visibility
  await prisma.transaction.create({
    data: {
      leadId,
      buyerId,
      actionType: 'PING_WEBHOOK',
      payload: JSON.stringify({ source: 'webhook', action: 'ping_response' }),
      response: JSON.stringify({ status: 'rejected', reason }),
      status: 'FAILED',
      bidAmount: null,
      responseTime: null,
      errorMessage: reason,
      complianceIncluded: false,
      trustedFormPresent: false,
      jornayaPresent: false
    }
  });
}

async function storePostResponse(
  leadId: string,
  buyerId: string,
  buyerName: string,
  status: string,
  reason: string | null,
  body: any
) {
  const postData = {
    leadId,
    buyer: buyerName,
    status,
    reason: reason || null,
    timestamp: new Date(),
    rawResponse: body
  };

  // Store in Redis for quick lookup
  await RedisCache.set(`post:${leadId}:${buyerName}`, postData, 86400 * 7); // Keep for 7 days

  // Determine if this was a successful delivery
  const isSuccess = status === 'delivered' || status === 'success' || status === 'accepted';

  // CRITICAL: Persist to database for audit trail and admin visibility
  await prisma.transaction.create({
    data: {
      leadId,
      buyerId,
      actionType: 'POST_WEBHOOK',
      payload: JSON.stringify({ source: 'webhook', action: 'post_response' }),
      response: JSON.stringify(body),
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      bidAmount: null, // POST doesn't have bid amount
      responseTime: null,
      errorMessage: !isSuccess ? (reason || status) : null,
      complianceIncluded: false,
      trustedFormPresent: false,
      jornayaPresent: false
    }
  });
}

async function storeStatusUpdate(
  leadId: string,
  buyerId: string,
  buyerName: string,
  status: string,
  reason: string,
  body: any
) {
  const updateData = {
    leadId,
    buyer: buyerName,
    status,
    reason,
    timestamp: new Date(),
    rawResponse: body
  };

  // Store in Redis with timestamp key for history
  await RedisCache.set(`update:${leadId}:${buyerName}:${Date.now()}`, updateData, 86400 * 7);

  // CRITICAL: Persist to database for audit trail and admin visibility
  await prisma.transaction.create({
    data: {
      leadId,
      buyerId,
      actionType: 'STATUS_UPDATE',
      payload: JSON.stringify({ source: 'webhook', action: 'status_update' }),
      response: JSON.stringify(body),
      status: status.toUpperCase() === 'SUCCESS' ? 'SUCCESS' : 'INFO',
      bidAmount: null,
      responseTime: null,
      errorMessage: reason || null,
      complianceIncluded: false,
      trustedFormPresent: false,
      jornayaPresent: false
    }
  });
}

async function updateLeadRevenue(leadId: string, buyer: string) {
  // Get the winning bid amount
  const bidData = await RedisCache.get<{ bid?: number; [key: string]: unknown }>(`bid:${leadId}:${buyer}`);

  if (bidData && bidData.bid) {
    // Update revenue tracking
    const today = new Date().toISOString().split('T')[0];
    const revenueKey = `revenue:daily:${today}`;

    await RedisCache.incrbyfloat(revenueKey, bidData.bid);
    await RedisCache.expire(revenueKey, 86400 * 90); // Keep for 90 days
  }
}

async function storeWebhookAudit(buyer: string, leadId: string, action: string, body: any, requestId: string) {
  const auditData = {
    buyer,
    leadId,
    action,
    payload: body,
    timestamp: new Date(),
    requestId,
    ip: 'webhook' // In real app, get from request
  };
  
  const auditKey = `webhook_audit:${buyer}:${leadId}:${Date.now()}`;
  await RedisCache.set(auditKey, auditData, 86400 * 30); // Keep for 30 days
}

// Export POST handler for webhooks
export const POST = withMiddleware(
  handleBuyerWebhook,
  {
    rateLimiter: 'webhook',
    enableLogging: true,
    validateContentType: true,
    enableCors: false // Webhooks typically don't need CORS
  }
);