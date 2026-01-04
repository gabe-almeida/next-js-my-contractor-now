/**
 * Affiliate Link Detail API
 *
 * PUT /api/affiliates/links/[id] - Update a tracking link
 * DELETE /api/affiliates/links/[id] - Delete (deactivate) a tracking link
 * Requires affiliate authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import {
  updateLink,
  deleteLink,
  buildTrackingUrl
} from '@/lib/services/affiliate-link-service';

// Validation schema for updating a link
const updateLinkSchema = z.object({
  name: z.string().max(100).optional(),
  isActive: z.boolean().optional()
});

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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const validation = updateLinkSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      }, { status: 400 });
    }

    // Update link
    const result = await updateLink(params.id, affiliateId, validation.data);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: result.error === 'Unauthorized' ? 403 : 400 });
    }

    const link = result.link!;
    return NextResponse.json({
      success: true,
      data: {
        ...link,
        trackingUrl: buildTrackingUrl(link.code)
      },
      message: 'Link updated successfully'
    });

  } catch (error) {
    console.error('Update affiliate link error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update link'
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { affiliateId, error } = getAffiliateIdFromRequest(request);

    if (!affiliateId) {
      return NextResponse.json({
        success: false,
        error
      }, { status: 401 });
    }

    // Delete (deactivate) link
    const result = await deleteLink(params.id, affiliateId);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: result.error === 'Unauthorized' ? 403 : 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Link deleted successfully'
    });

  } catch (error) {
    console.error('Delete affiliate link error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete link'
    }, { status: 500 });
  }
}
