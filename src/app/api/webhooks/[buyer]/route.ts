import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { RedisCache } from '@/config/redis';
import { logger, logBuyerInteraction } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { verifyWebhookAuth } from '@/lib/middleware/webhook-auth';

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
    
    // Validate lead exists
    const leadData = await RedisCache.get(`lead:${leadId}`);
    if (!leadData) {
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
  buyer: string,
  status: string,
  bid: number,
  body: any,
  requestId: string
) {
  const validStatuses = ['accepted', 'rejected', 'error'];
  
  if (!validStatuses.includes(status)) {
    return errorResponse(
      'INVALID_PING_STATUS',
      'Invalid ping response status',
      { status, validStatuses },
      'status',
      requestId
    );
  }
  
  if (status === 'accepted') {
    // Validate bid amount
    if (!bid || typeof bid !== 'number' || bid <= 0) {
      return errorResponse(
        'INVALID_BID',
        'Invalid bid amount for accepted ping',
        { bid },
        'bid',
        requestId
      );
    }
    
    // Store bid in auction system
    await storeBidResponse(leadId, buyer, bid, body);
    
    logger.info('Bid received from buyer', {
      leadId,
      buyer,
      bid,
      requestId
    });
  } else if (status === 'rejected') {
    // Store rejection reason
    await storeBidRejection(leadId, buyer, body.reason || 'No reason provided');
    
    logger.info('Lead rejected by buyer', {
      leadId,
      buyer,
      reason: body.reason,
      requestId
    });
  }
  
  return successResponse({
    message: 'Ping response processed successfully',
    leadId,
    buyer,
    status,
    bid: status === 'accepted' ? bid : undefined
  }, requestId);
}

// Handle post response (final lead delivery confirmation)
async function handlePostResponse(
  leadId: string,
  buyer: string,
  status: string,
  reason: string,
  body: any,
  requestId: string
) {
  const validStatuses = ['delivered', 'failed', 'duplicate', 'invalid'];
  
  if (!validStatuses.includes(status)) {
    return errorResponse(
      'INVALID_POST_STATUS',
      'Invalid post response status',
      { status, validStatuses },
      'status',
      requestId
    );
  }
  
  // Update lead status based on post response
  const lead = await RedisCache.get(`lead:${leadId}`);
  if (lead) {
    if (status === 'delivered') {
      lead.status = 'sold';
      await updateLeadRevenue(leadId, buyer);
    } else {
      lead.status = 'rejected';
    }
    
    lead.updatedAt = new Date();
    await RedisCache.set(`lead:${leadId}`, lead, 3600);
  }
  
  // Store post response
  await storePostResponse(leadId, buyer, status, reason, body);
  
  logger.info('Post response received from buyer', {
    leadId,
    buyer,
    status,
    reason,
    requestId
  });
  
  return successResponse({
    message: 'Post response processed successfully',
    leadId,
    buyer,
    status,
    leadStatus: lead?.status
  }, requestId);
}

// Handle status update
async function handleStatusUpdate(
  leadId: string,
  buyer: string,
  status: string,
  reason: string,
  body: any,
  requestId: string
) {
  // Store status update
  await storeStatusUpdate(leadId, buyer, status, reason, body);
  
  logger.info('Status update received from buyer', {
    leadId,
    buyer,
    status,
    reason,
    requestId
  });
  
  return successResponse({
    message: 'Status update processed successfully',
    leadId,
    buyer,
    status
  }, requestId);
}

// Helper functions
async function getBuyerData(buyerName: string) {
  // In real app, this would query the database
  const buyers = [
    { name: 'homeadvisor', active: true },
    { name: 'modernize', active: true },
    { name: 'angi', active: true }
  ];
  
  return buyers.find(b => b.name.toLowerCase() === buyerName.toLowerCase());
}

async function storeBidResponse(leadId: string, buyer: string, bid: number, body: any) {
  const bidData = {
    leadId,
    buyer,
    bid,
    timestamp: new Date(),
    rawResponse: body
  };
  
  await RedisCache.set(`bid:${leadId}:${buyer}`, bidData, 86400); // Keep for 24 hours
  
  // Add to auction queue
  await RedisCache.redis.sadd(`auction:${leadId}:bids`, `${buyer}:${bid}`);
}

async function storeBidRejection(leadId: string, buyer: string, reason: string) {
  const rejectionData = {
    leadId,
    buyer,
    reason,
    timestamp: new Date()
  };
  
  await RedisCache.set(`rejection:${leadId}:${buyer}`, rejectionData, 86400);
}

async function storePostResponse(leadId: string, buyer: string, status: string, reason: string, body: any) {
  const postData = {
    leadId,
    buyer,
    status,
    reason,
    timestamp: new Date(),
    rawResponse: body
  };
  
  await RedisCache.set(`post:${leadId}:${buyer}`, postData, 86400 * 7); // Keep for 7 days
}

async function storeStatusUpdate(leadId: string, buyer: string, status: string, reason: string, body: any) {
  const updateData = {
    leadId,
    buyer,
    status,
    reason,
    timestamp: new Date(),
    rawResponse: body
  };
  
  await RedisCache.set(`update:${leadId}:${buyer}:${Date.now()}`, updateData, 86400 * 7);
}

async function updateLeadRevenue(leadId: string, buyer: string) {
  // Get the winning bid amount
  const bidData = await RedisCache.get(`bid:${leadId}:${buyer}`);
  
  if (bidData && bidData.bid) {
    // Update revenue tracking
    const today = new Date().toISOString().split('T')[0];
    const revenueKey = `revenue:daily:${today}`;
    
    await RedisCache.redis.incrbyfloat(revenueKey, bidData.bid);
    await RedisCache.redis.expire(revenueKey, 86400 * 90); // Keep for 90 days
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