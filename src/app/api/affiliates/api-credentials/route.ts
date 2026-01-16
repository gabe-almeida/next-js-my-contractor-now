/**
 * Affiliate API Credentials Endpoint
 *
 * WHY: Allows affiliates to manage their API credentials for
 *      programmatic access to their data.
 *
 * WHEN: When affiliate wants to generate, view status, or revoke API credentials.
 *
 * HOW: Uses affiliate-api-auth-service for credential management.
 *
 * GET /api/affiliates/api-credentials - Get credential status
 * POST /api/affiliates/api-credentials - Generate new credentials
 * DELETE /api/affiliates/api-credentials - Revoke credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import {
  generateApiCredentials,
  revokeApiCredentials,
  hasApiCredentials,
  getMaskedApiKey
} from '@/lib/services/affiliate-api-auth-service';
import { logger } from '@/lib/logger';

/**
 * Authenticate request and return affiliate ID
 */
async function authenticateRequest(
  request: NextRequest
): Promise<{ affiliateId?: string; error?: NextResponse }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Missing authorization token' },
        { status: 401 }
      )
    };
  }

  const token = authHeader.slice(7);
  const verification = verifyAffiliateToken(token);

  if (!verification.valid || !verification.affiliateId) {
    return {
      error: NextResponse.json(
        { success: false, error: verification.error || 'Invalid token' },
        { status: 401 }
      )
    };
  }

  return { affiliateId: verification.affiliateId };
}

/**
 * GET /api/affiliates/api-credentials
 *
 * Get current API credential status (has credentials, masked key).
 */
export async function GET(request: NextRequest) {
  try {
    const { affiliateId, error } = await authenticateRequest(request);
    if (error) return error;

    const [has, masked] = await Promise.all([
      hasApiCredentials(affiliateId!),
      getMaskedApiKey(affiliateId!)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        hasCredentials: has,
        maskedKey: masked
      }
    });
  } catch (error) {
    logger.error('Get API credentials status error', {
      error: (error as Error).message
    });

    return NextResponse.json(
      { success: false, error: 'Failed to get API credential status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/affiliates/api-credentials
 *
 * Generate new API credentials. Will replace any existing credentials.
 */
export async function POST(request: NextRequest) {
  try {
    const { affiliateId, error } = await authenticateRequest(request);
    if (error) return error;

    const result = await generateApiCredentials(affiliateId!);

    if (!result.success || !result.credentials) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to generate credentials' },
        { status: 400 }
      );
    }

    // Get masked key for display
    const maskedKey = await getMaskedApiKey(affiliateId!);

    logger.info('API credentials generated via portal', {
      affiliateId
    });

    return NextResponse.json({
      success: true,
      data: {
        credentials: result.credentials,
        maskedKey
      },
      message: 'API credentials generated. Save your API Secret - it will not be shown again!'
    });
  } catch (error) {
    logger.error('Generate API credentials error', {
      error: (error as Error).message
    });

    return NextResponse.json(
      { success: false, error: 'Failed to generate API credentials' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/affiliates/api-credentials
 *
 * Revoke existing API credentials.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { affiliateId, error } = await authenticateRequest(request);
    if (error) return error;

    const result = await revokeApiCredentials(affiliateId!);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to revoke credentials' },
        { status: 400 }
      );
    }

    logger.info('API credentials revoked via portal', {
      affiliateId
    });

    return NextResponse.json({
      success: true,
      message: 'API credentials revoked successfully'
    });
  } catch (error) {
    logger.error('Revoke API credentials error', {
      error: (error as Error).message
    });

    return NextResponse.json(
      { success: false, error: 'Failed to revoke API credentials' },
      { status: 500 }
    );
  }
}
