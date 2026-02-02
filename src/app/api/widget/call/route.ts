/**
 * GET /api/widget/call
 *
 * WHY: Enable affiliates to embed a call button widget on their own websites.
 *      This CORS-enabled endpoint allows cross-origin requests from affiliate
 *      domains, returning the affiliate's tracking number for their widget.
 *
 * WHEN: Called by the embeddable widget script (public/widget/call.js) when
 *       it initializes on an affiliate's website.
 *
 * HOW:
 *   1. Handle CORS preflight (OPTIONS) and actual (GET) requests
 *   2. Parse ref (affiliate code) and service (service type slug) params
 *   3. Look up affiliate's tracking number (reuses DNI lookup logic)
 *   4. Return JSON response with CORS headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limiter';

// =====================================
// CORS CONFIGURATION
// =====================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // Allow any origin (affiliates can embed anywhere)
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
};

// =====================================
// TYPE DEFINITIONS
// =====================================

interface WidgetResponse {
  success: true;
  data: {
    hasNumber: boolean;
    phoneNumber: string | null;
    phoneNumberDisplay: string | null;
    affiliateName: string | null;
    serviceName: string | null;
  };
}

interface WidgetErrorResponse {
  success: false;
  error: string;
}

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Format affiliate name for display
 * WHY: Prefer company name, fall back to first + last name
 */
function formatAffiliateName(affiliate: {
  companyName: string | null;
  firstName: string;
  lastName: string;
}): string {
  if (affiliate.companyName) {
    return affiliate.companyName;
  }
  return `${affiliate.firstName} ${affiliate.lastName}`.trim();
}

/**
 * Create a response with CORS headers
 */
function corsResponse<T>(data: T, status: number = 200): NextResponse<T> {
  return NextResponse.json(data, {
    status,
    headers: CORS_HEADERS,
  });
}

// =====================================
// OPTIONS HANDLER (CORS Preflight)
// =====================================

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// =====================================
// GET HANDLER
// =====================================

export async function GET(
  request: NextRequest
): Promise<NextResponse<WidgetResponse | WidgetErrorResponse>> {
  // Rate limiting - prevent abuse of widget API
  const rateLimitResult = await checkRateLimit(request, 'api');
  if (!rateLimitResult.allowed) {
    return corsResponse(
      {
        success: false,
        error: 'Too many requests. Please try again later.',
      } as WidgetErrorResponse,
      429
    );
  }

  const startTime = Date.now();
  const { searchParams } = new URL(request.url);

  // Extract query parameters
  const ref = searchParams.get('ref');
  const service = searchParams.get('service');

  // Validate required parameters
  if (!ref) {
    return corsResponse(
      {
        success: false,
        error: 'Missing required parameter: ref',
      } as WidgetErrorResponse,
      400
    );
  }

  if (!service) {
    return corsResponse(
      {
        success: false,
        error: 'Missing required parameter: service',
      } as WidgetErrorResponse,
      400
    );
  }

  // Sanitize inputs to prevent injection
  const sanitizedRef = ref.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
  const sanitizedService = service.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);

  try {
    // Step 1: Look up AffiliateLink by code to find the affiliate
    const affiliateLink = await prisma.affiliateLink.findFirst({
      where: {
        code: sanitizedRef,
        isActive: true,
      },
      include: {
        affiliate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            status: true,
          },
        },
      },
    });

    // If no affiliate link found or affiliate is not active
    if (!affiliateLink || affiliateLink.affiliate.status !== 'ACTIVE') {
      logger.debug('Widget API: Invalid affiliate lookup', {
        ref: sanitizedRef,
        found: !!affiliateLink,
      });
      return corsResponse({
        success: true,
        data: {
          hasNumber: false,
          phoneNumber: null,
          phoneNumberDisplay: null,
          affiliateName: null,
          serviceName: null,
        },
      });
    }

    const affiliateId = affiliateLink.affiliate.id;
    const affiliateName = formatAffiliateName(affiliateLink.affiliate);

    // Step 2: Find the service type by slug/name
    const serviceType = await prisma.serviceType.findFirst({
      where: {
        OR: [
          { name: sanitizedService },
          { name: sanitizedService.toLowerCase() },
        ],
        active: true,
      },
    });

    if (!serviceType) {
      logger.debug('Widget API: Unknown service type', {
        service: sanitizedService,
      });
      return corsResponse({
        success: true,
        data: {
          hasNumber: false,
          phoneNumber: null,
          phoneNumberDisplay: null,
          affiliateName,
          serviceName: null,
        },
      });
    }

    // Step 3: Find affiliate's approved campaign for this service type
    const affiliateCampaign = await prisma.affiliateCampaign.findFirst({
      where: {
        affiliateId,
        status: 'APPROVED',
        campaign: {
          serviceTypeId: serviceType.id,
          active: true,
        },
      },
    });

    if (!affiliateCampaign) {
      logger.debug('Widget API: No approved campaign', {
        affiliateId,
        serviceType: serviceType.name,
      });
      return corsResponse({
        success: true,
        data: {
          hasNumber: false,
          phoneNumber: null,
          phoneNumberDisplay: null,
          affiliateName,
          serviceName: serviceType.name,
        },
      });
    }

    // Step 4: Get active TrackingNumber for that campaign
    const trackingNumber = await prisma.trackingNumber.findFirst({
      where: {
        affiliateId,
        campaignId: affiliateCampaign.campaignId,
        provisioningStatus: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!trackingNumber) {
      logger.debug('Widget API: No tracking number', {
        affiliateId,
        campaignId: affiliateCampaign.campaignId,
      });
      return corsResponse({
        success: true,
        data: {
          hasNumber: false,
          phoneNumber: null,
          phoneNumberDisplay: null,
          affiliateName,
          serviceName: serviceType.name,
        },
      });
    }

    // Success - return the tracking number
    const duration = Date.now() - startTime;
    logger.info('Widget API lookup successful', {
      ref: sanitizedRef,
      service: sanitizedService,
      affiliateId,
      durationMs: duration,
    });

    return corsResponse({
      success: true,
      data: {
        hasNumber: true,
        phoneNumber: trackingNumber.phoneNumber,
        phoneNumberDisplay: trackingNumber.phoneNumberDisplay,
        affiliateName,
        serviceName: serviceType.name,
      },
    });
  } catch (error) {
    logger.error('Widget API lookup failed', {
      ref: sanitizedRef,
      service: sanitizedService,
      error: (error as Error).message,
    });

    return corsResponse(
      {
        success: false,
        error: 'Failed to lookup tracking number',
      } as WidgetErrorResponse,
      500
    );
  }
}
