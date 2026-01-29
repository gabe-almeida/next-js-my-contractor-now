/**
 * Exit Offers Click Tracking Endpoint
 *
 * WHY: Records when users click on exit offers (e.g., ADT banner) for
 *      conversion tracking and analytics. Helps match postback conversions
 *      to specific clicks and understand click-through rates.
 *
 * WHEN: Called from thank you page when user clicks an offer banner.
 *       Uses sendBeacon for reliability even if page is closing.
 *
 * HOW: POST with JSON body containing leadId, trafficSource, clickUrl.
 *      Stores click record in database for later postback matching.
 *      Returns 200 OK immediately (best-effort tracking).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface ClickPayload {
  leadId: string;
  trafficSource: string;
  clickUrl: string;
  offerType: string;
  offerProvider: string;
}

/**
 * POST /api/exit-offers/click
 *
 * Records a click on an exit offer.
 * Best-effort tracking - returns 200 even on errors to not block user.
 */
export async function POST(request: NextRequest) {
  // Get IP and user agent for fraud detection
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null;

  const userAgent = request.headers.get('user-agent') || null;

  try {
    // Parse body - handle both JSON and sendBeacon blob
    const contentType = request.headers.get('content-type') || '';
    let payload: ClickPayload;

    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else if (contentType.includes('text/plain')) {
      // sendBeacon might send as text/plain even with JSON content
      const text = await request.text();
      payload = JSON.parse(text);
    } else {
      // Try to parse as JSON anyway (sendBeacon quirk)
      try {
        const text = await request.text();
        payload = JSON.parse(text);
      } catch {
        logger.warn('Exit offer click - invalid payload format', {
          contentType,
          ip: ipAddress,
        });
        return new Response('OK', { status: 200 });
      }
    }

    // Validate required fields
    if (!payload.leadId || !payload.clickUrl || !payload.offerType) {
      logger.warn('Exit offer click - missing required fields', {
        hasLeadId: !!payload.leadId,
        hasClickUrl: !!payload.clickUrl,
        hasOfferType: !!payload.offerType,
        ip: ipAddress,
      });
      return new Response('OK', { status: 200 });
    }

    // Verify lead exists (optional - don't fail if not found)
    let leadId: string | null = null;

    if (payload.leadId && payload.leadId !== 'test-demo') {
      const lead = await prisma.lead.findUnique({
        where: { id: payload.leadId },
        select: { id: true },
      });

      if (lead) {
        leadId = lead.id;
      } else {
        logger.warn('Exit offer click - lead not found', {
          leadId: payload.leadId,
          ip: ipAddress,
        });
        // Continue anyway - still record the click for debugging
      }
    }

    // Store click record
    const click = await prisma.exitOfferClick.create({
      data: {
        leadId,
        offerType: payload.offerType,
        offerProvider: payload.offerProvider || 'unknown',
        trafficSource: payload.trafficSource || 'unknown',
        clickUrl: payload.clickUrl,
        userAgent,
        ipAddress,
        clickedAt: new Date(),
      },
    });

    logger.info('Exit offer click recorded', {
      id: click.id,
      leadId,
      offerType: payload.offerType,
      trafficSource: payload.trafficSource,
    });

    return new Response('OK', { status: 200 });
  } catch (error) {
    // Log error but still return 200 - best effort tracking
    logger.error('Exit offer click tracking error', {
      error: (error as Error).message,
      ip: ipAddress,
    });

    return new Response('OK', { status: 200 });
  }
}
