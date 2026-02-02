/**
 * GET /api/tracking-numbers/by-referral
 *
 * WHY: Enable landing pages to fetch affiliate's tracking number for
 *      Dynamic Number Insertion (DNI). When visitors arrive via affiliate
 *      links (?ref=xxx), the page shows the affiliate's tracking number
 *      so they get credit whether the visitor calls or fills a form.
 *
 * WHEN: Landing page loads with ?ref= param or aff_ref cookie present.
 *       Called by the useDynamicNumber hook on client-side.
 *
 * HOW:
 *   1. Parse ref (affiliate code) and service (service type slug) params
 *   2. Look up AffiliateLink by code to find the affiliate
 *   3. Find affiliate's campaign for that service type
 *   4. Get active TrackingNumber for that campaign
 *   5. Return formatted response with phone number or fallback
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// =====================================
// TYPE DEFINITIONS
// =====================================

interface DniResponse {
  success: true;
  data: {
    hasNumber: boolean;
    phoneNumber: string | null;
    phoneNumberDisplay: string | null;
    affiliateId: string | null;
    affiliateName: string | null;
    message?: string;
    provisionUrl?: string;
  };
}

interface DniErrorResponse {
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

// =====================================
// GET HANDLER
// =====================================

export async function GET(
  request: NextRequest
): Promise<NextResponse<DniResponse | DniErrorResponse>> {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);

  // Extract query parameters
  const ref = searchParams.get('ref');
  const service = searchParams.get('service');

  // Validate required parameters
  if (!ref) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing required parameter: ref'
      } as DniErrorResponse,
      { status: 400 }
    );
  }

  if (!service) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing required parameter: service'
      } as DniErrorResponse,
      { status: 400 }
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
        isActive: true
      },
      include: {
        affiliate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            status: true
          }
        }
      }
    });

    // If no affiliate link found or affiliate is not active
    if (!affiliateLink) {
      logger.debug('DNI lookup: Unknown referral code', { ref: sanitizedRef });
      return NextResponse.json({
        success: true,
        data: {
          hasNumber: false,
          phoneNumber: null,
          phoneNumberDisplay: null,
          affiliateId: null,
          affiliateName: null,
          message: 'Unknown referral code'
        }
      });
    }

    // If affiliate is not active (suspended, pending, etc.)
    if (affiliateLink.affiliate.status !== 'ACTIVE') {
      logger.debug('DNI lookup: Affiliate not active', {
        ref: sanitizedRef,
        affiliateId: affiliateLink.affiliate.id,
        status: affiliateLink.affiliate.status
      });
      return NextResponse.json({
        success: true,
        data: {
          hasNumber: false,
          phoneNumber: null,
          phoneNumberDisplay: null,
          affiliateId: null,
          affiliateName: null,
          message: 'Affiliate not active'
        }
      });
    }

    const affiliateId = affiliateLink.affiliate.id;
    const affiliateName = formatAffiliateName(affiliateLink.affiliate);

    // Step 2: Find the service type by slug/name
    const serviceType = await prisma.serviceType.findFirst({
      where: {
        OR: [
          { name: sanitizedService },
          { name: sanitizedService.toLowerCase() }
        ],
        active: true
      }
    });

    if (!serviceType) {
      logger.debug('DNI lookup: Unknown service type', {
        service: sanitizedService,
        affiliateId
      });
      return NextResponse.json({
        success: true,
        data: {
          hasNumber: false,
          phoneNumber: null,
          phoneNumberDisplay: null,
          affiliateId,
          affiliateName,
          message: 'Unknown service type'
        }
      });
    }

    // Step 3: Find affiliate's approved campaign for this service type
    const affiliateCampaign = await prisma.affiliateCampaign.findFirst({
      where: {
        affiliateId,
        status: 'APPROVED',
        campaign: {
          serviceTypeId: serviceType.id,
          active: true
        }
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!affiliateCampaign) {
      logger.debug('DNI lookup: No approved campaign for service', {
        affiliateId,
        serviceType: serviceType.name
      });
      return NextResponse.json({
        success: true,
        data: {
          hasNumber: false,
          phoneNumber: null,
          phoneNumberDisplay: null,
          affiliateId,
          affiliateName,
          message: 'Affiliate has not joined a campaign for this service',
          provisionUrl: '/affiliate/campaigns'
        }
      });
    }

    // Step 4: Get active TrackingNumber for that campaign
    // Prefer most recently provisioned active number
    const trackingNumber = await prisma.trackingNumber.findFirst({
      where: {
        affiliateId,
        campaignId: affiliateCampaign.campaignId,
        provisioningStatus: 'ACTIVE'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!trackingNumber) {
      logger.debug('DNI lookup: Affiliate has no tracking number for campaign', {
        affiliateId,
        campaignId: affiliateCampaign.campaignId
      });
      return NextResponse.json({
        success: true,
        data: {
          hasNumber: false,
          phoneNumber: null,
          phoneNumberDisplay: null,
          affiliateId,
          affiliateName,
          message: 'Affiliate has not provisioned a number for this service',
          provisionUrl: '/affiliate/campaigns'
        }
      });
    }

    // Success - return the tracking number
    const duration = Date.now() - startTime;
    logger.info('DNI lookup successful', {
      ref: sanitizedRef,
      service: sanitizedService,
      affiliateId,
      trackingNumberId: trackingNumber.id,
      durationMs: duration
    });

    return NextResponse.json({
      success: true,
      data: {
        hasNumber: true,
        phoneNumber: trackingNumber.phoneNumber,
        phoneNumberDisplay: trackingNumber.phoneNumberDisplay,
        affiliateId,
        affiliateName
      }
    });
  } catch (error) {
    logger.error('DNI lookup failed', {
      ref: sanitizedRef,
      service: sanitizedService,
      error: (error as Error).message
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to lookup tracking number'
      } as DniErrorResponse,
      { status: 500 }
    );
  }
}
