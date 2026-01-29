/**
 * ADT Home Security - Postback Endpoint
 *
 * WHY: Receives conversion notifications from PX/ADT when users complete
 *      actions after clicking our thank you page offer. Generates revenue.
 *
 * WHEN: Called by PX/ADT servers when a conversion occurs. We record the
 *       conversion and match it to our lead for attribution.
 *
 * HOW: GET request with query params (token, aff_sub, aff_sub2, transaction_id, payout).
 *      Validates token, checks for duplicates, stores conversion record.
 *      Returns 200 OK to acknowledge receipt (idempotent).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Constants for this offer
const OFFER_TYPE = 'adt_home_security';
const OFFER_PROVIDER = 'px';

interface PostbackParams {
  token?: string;
  aff_sub?: string;
  aff_sub2?: string;
  transaction_id?: string;
  payout?: string;
}

/**
 * Parses payout from various formats to a number.
 * PX may send: "45.00", "45", 45.00, or nothing.
 */
function parsePayout(value: string | undefined | null): number {
  if (!value) return 0;

  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Validates the postback token against our secret.
 */
function validateToken(token: string | undefined): boolean {
  const secret = process.env.ADT_POSTBACK_SECRET;

  // If no secret configured, log warning and allow (for discovery phase)
  if (!secret) {
    logger.warn('ADT_POSTBACK_SECRET not configured - allowing all postbacks');
    return true;
  }

  return token === secret;
}

/**
 * GET /api/postback/adt
 *
 * Main postback handler - PX typically uses GET requests.
 * Validates token, records conversion, returns 200 OK.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params: PostbackParams = {
    token: url.searchParams.get('token') || undefined,
    aff_sub: url.searchParams.get('aff_sub') || undefined,
    aff_sub2: url.searchParams.get('aff_sub2') || undefined,
    transaction_id: url.searchParams.get('transaction_id') || undefined,
    payout: url.searchParams.get('payout') || undefined,
  };

  // Get IP for logging and fraud detection
  const sourceIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Store raw payload for debugging
  const rawPayload = {
    method: 'GET',
    params: Object.fromEntries(url.searchParams),
    headers: {
      'user-agent': request.headers.get('user-agent'),
      'x-forwarded-for': request.headers.get('x-forwarded-for'),
    },
    ip: sourceIp,
    timestamp: new Date().toISOString(),
  };

  // Log all postbacks for monitoring
  logger.info('ADT Postback received', {
    ...rawPayload,
    hasToken: !!params.token,
    transactionId: params.transaction_id,
  });

  // Also console.log for Render logs
  console.log('ADT Postback:', JSON.stringify({
    transactionId: params.transaction_id,
    affSub2: params.aff_sub2,
    payout: params.payout,
    ip: sourceIp,
  }));

  // 1. Validate token
  if (!validateToken(params.token)) {
    logger.warn('ADT Postback rejected - invalid token', {
      ip: sourceIp,
      transactionId: params.transaction_id,
    });

    // Return 200 even for invalid token (don't give attackers info)
    // But don't record the conversion
    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // 2. Validate required params
  if (!params.transaction_id) {
    logger.warn('ADT Postback missing transaction_id', { ip: sourceIp });
    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  if (!params.aff_sub2) {
    logger.warn('ADT Postback missing aff_sub2 (lead ID)', {
      transactionId: params.transaction_id,
      ip: sourceIp,
    });
    // Still record - but with leadNotFound flag
  }

  try {
    // 3. Check for duplicate transaction_id (idempotent)
    const existingConversion = await prisma.exitOfferConversion.findUnique({
      where: { transactionId: params.transaction_id },
    });

    if (existingConversion) {
      logger.info('ADT Postback duplicate - already recorded', {
        transactionId: params.transaction_id,
        existingId: existingConversion.id,
      });

      // Return 200 OK - idempotent behavior
      return new Response('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 4. Look up lead by aff_sub2
    let leadId: string | null = null;
    let leadNotFound = false;

    if (params.aff_sub2) {
      const lead = await prisma.lead.findUnique({
        where: { id: params.aff_sub2 },
        select: { id: true },
      });

      if (lead) {
        leadId = lead.id;
      } else {
        leadNotFound = true;
        logger.warn('ADT Postback lead not found', {
          affSub2: params.aff_sub2,
          transactionId: params.transaction_id,
        });
      }
    } else {
      leadNotFound = true;
    }

    // 5. Try to match to a click (within 24h window)
    let clickId: string | null = null;

    if (leadId) {
      const recentClick = await prisma.exitOfferClick.findFirst({
        where: {
          leadId,
          offerType: OFFER_TYPE,
          clickedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
          },
        },
        orderBy: { clickedAt: 'desc' },
        select: { id: true },
      });

      if (recentClick) {
        clickId = recentClick.id;
      }
    }

    // 6. Parse payout
    const payout = parsePayout(params.payout);

    // Warn on zero/negative payout
    if (payout <= 0) {
      logger.warn('ADT Postback zero/negative payout', {
        payout,
        transactionId: params.transaction_id,
      });
    }

    // Determine status based on payout
    let status = 'confirmed';
    if (payout < 0) {
      status = 'reversed'; // Negative payout might indicate chargeback
    }

    // 7. Store conversion record
    const conversion = await prisma.exitOfferConversion.create({
      data: {
        clickId,
        leadId,
        offerType: OFFER_TYPE,
        offerProvider: OFFER_PROVIDER,
        transactionId: params.transaction_id,
        payout,
        payoutCurrency: 'USD',
        affSub: params.aff_sub,
        affSub2: params.aff_sub2,
        status,
        leadNotFound,
        rawPayload,
        sourceIp,
        receivedAt: new Date(),
      },
    });

    logger.info('ADT Postback conversion recorded', {
      id: conversion.id,
      transactionId: params.transaction_id,
      leadId,
      payout,
      leadNotFound,
    });

    // Return 200 OK
    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    logger.error('ADT Postback processing error', {
      error: (error as Error).message,
      transactionId: params.transaction_id,
      ip: sourceIp,
    });

    // Return 200 anyway - we don't want PX to retry forever
    // We logged the error and can investigate
    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * POST /api/postback/adt
 *
 * Alternative handler for networks that prefer POST.
 * Handles JSON, form-urlencoded, and plain text bodies.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams);

  // Get IP
  const sourceIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Parse body based on content type
  const contentType = request.headers.get('content-type') || '';
  let body: Record<string, unknown> = {};

  try {
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const formData = await request.formData();
      body = Object.fromEntries(formData) as Record<string, unknown>;
    } else {
      const text = await request.text();
      body = { raw: text };
    }
  } catch (error) {
    body = { parseError: (error as Error).message };
  }

  // Merge query params and body (query params take precedence)
  const params: PostbackParams = {
    token: String(queryParams.token || body.token || ''),
    aff_sub: String(queryParams.aff_sub || body.aff_sub || ''),
    aff_sub2: String(queryParams.aff_sub2 || body.aff_sub2 || ''),
    transaction_id: String(queryParams.transaction_id || body.transaction_id || ''),
    payout: String(queryParams.payout || body.payout || ''),
  };

  // Log everything for monitoring
  logger.info('ADT Postback received (POST)', {
    method: 'POST',
    contentType,
    queryParams,
    body,
    ip: sourceIp,
    timestamp: new Date().toISOString(),
  });

  // Reuse GET handler logic by constructing a URL with params
  const getUrl = new URL(request.url);
  Object.entries(params).forEach(([key, value]) => {
    if (value) getUrl.searchParams.set(key, value);
  });

  // Create a new request with merged params and forward to GET handler
  const getRequest = new NextRequest(getUrl, {
    headers: request.headers,
  });

  return GET(getRequest);
}
