/**
 * Postback Settings Endpoint
 *
 * WHY: Allows affiliates to configure their postback URL for
 *      receiving real-time conversion notifications.
 *
 * WHEN: When affiliate wants to set up or update their postback configuration.
 *
 * HOW: GET to retrieve current settings, PUT to update settings.
 *
 * GET /api/affiliates/postback - Get current postback configuration
 * PUT /api/affiliates/postback - Update postback configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/affiliates/postback
 *
 * Get current postback configuration for authenticated affiliate.
 */
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

    // Get affiliate postback settings
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: verification.affiliateId },
      select: {
        id: true,
        postbackUrl: true,
        postbackMethod: true
      }
    });

    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        postbackUrl: affiliate.postbackUrl,
        postbackMethod: affiliate.postbackMethod,
        enabled: !!affiliate.postbackUrl
      }
    });
  } catch (error) {
    logger.error('Get postback settings error', {
      error: (error as Error).message
    });

    return NextResponse.json(
      { success: false, error: 'Failed to get postback settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/affiliates/postback
 *
 * Update postback configuration for authenticated affiliate.
 */
export async function PUT(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { postbackUrl, postbackMethod, enabled } = body;

    // If disabling, clear the URL
    if (enabled === false) {
      await prisma.affiliate.update({
        where: { id: affiliateId },
        data: {
          postbackUrl: null
        }
      });

      logger.info('Postback disabled for affiliate', { affiliateId });

      return NextResponse.json({
        success: true,
        data: {
          postbackUrl: null,
          postbackMethod: 'POST',
          enabled: false
        },
        message: 'Postback notifications disabled'
      });
    }

    // Validate URL if provided
    if (postbackUrl) {
      // Validate URL format
      try {
        new URL(postbackUrl);
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid URL format' },
          { status: 400 }
        );
      }

      // Only allow HTTPS in production
      if (
        process.env.NODE_ENV === 'production' &&
        !postbackUrl.startsWith('https://')
      ) {
        return NextResponse.json(
          { success: false, error: 'Postback URL must use HTTPS' },
          { status: 400 }
        );
      }

      // Validate method
      const method = postbackMethod?.toUpperCase() || 'POST';
      if (!['GET', 'POST'].includes(method)) {
        return NextResponse.json(
          { success: false, error: 'Postback method must be GET or POST' },
          { status: 400 }
        );
      }

      // Update affiliate
      await prisma.affiliate.update({
        where: { id: affiliateId },
        data: {
          postbackUrl,
          postbackMethod: method
        }
      });

      logger.info('Postback settings updated', {
        affiliateId,
        url: postbackUrl.slice(0, 50),
        method
      });

      return NextResponse.json({
        success: true,
        data: {
          postbackUrl,
          postbackMethod: method,
          enabled: true
        },
        message: 'Postback settings updated successfully'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Postback URL is required when enabling' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Update postback settings error', {
      error: (error as Error).message
    });

    return NextResponse.json(
      { success: false, error: 'Failed to update postback settings' },
      { status: 500 }
    );
  }
}
