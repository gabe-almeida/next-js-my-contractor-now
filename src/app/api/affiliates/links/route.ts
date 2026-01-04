/**
 * Affiliate Links API
 *
 * GET /api/affiliates/links - List affiliate's tracking links
 * POST /api/affiliates/links - Create new tracking link
 * Requires affiliate authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import {
  getLinksByAffiliateId,
  createLink,
  buildTrackingUrl
} from '@/lib/services/affiliate-link-service';

// Validation schema for creating a link
// Accepts both targetPath and targetUrl for compatibility
const createLinkSchema = z.object({
  targetPath: z.string().min(1).optional(),
  targetUrl: z.string().min(1).optional(),
  code: z.string().min(4).max(20).regex(/^[a-zA-Z0-9-_]+$/).optional(),
  customCode: z.string().min(4).max(20).regex(/^[a-zA-Z0-9-_]+$/).optional(),
  name: z.string().max(100).optional()
}).refine(
  (data) => data.targetPath || data.targetUrl,
  { message: 'Target path or URL is required' }
);

/**
 * Extracts and verifies affiliate ID from request
 */
function getAffiliateIdFromRequest(request: NextRequest): {
  affiliateId: string | null;
  error: string | null;
} {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { affiliateId: null, error: 'Authorization required' };
  }

  const token = authHeader.substring(7);
  const verification = verifyAffiliateToken(token);

  if (!verification.valid) {
    return { affiliateId: null, error: verification.error || 'Invalid token' };
  }

  return { affiliateId: verification.affiliateId!, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const { affiliateId, error } = getAffiliateIdFromRequest(request);

    if (!affiliateId) {
      return NextResponse.json({
        success: false,
        error
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const result = await getLinksByAffiliateId(affiliateId, {
      page,
      limit,
      activeOnly
    });

    // Add full URL to each link
    const linksWithUrls = result.links.map(link => ({
      ...link,
      trackingUrl: buildTrackingUrl(link.code)
    }));

    return NextResponse.json({
      success: true,
      data: linksWithUrls,
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total
      }
    });

  } catch (error) {
    console.error('Get affiliate links error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get links'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { affiliateId, error } = getAffiliateIdFromRequest(request);

    if (!affiliateId) {
      return NextResponse.json({
        success: false,
        error
      }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validation = createLinkSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      }, { status: 400 });
    }

    // Create link
    const result = await createLink(affiliateId, validation.data);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    const link = result.link!;
    return NextResponse.json({
      success: true,
      data: {
        ...link,
        trackingUrl: buildTrackingUrl(link.code)
      },
      message: 'Link created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Create affiliate link error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create link'
    }, { status: 500 });
  }
}
