/**
 * List Ingress Numbers API
 *
 * WHY: Affiliates need to see available ingress numbers when configuring forwarding.
 * WHEN: Affiliate opens forwarding setup UI in their portal.
 * HOW: Query active ingress numbers from the pool with usage counts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAffiliateToken } from '@/lib/services/affiliate-service';
import { listIngressNumbers } from '@/lib/services/ingress-number-service';
import { logger } from '@/lib/logger';

/**
 * Extract and verify affiliate from Authorization header
 */
function getAffiliateFromRequest(request: NextRequest): {
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
    // Verify affiliate is authenticated
    const { affiliateId, error } = getAffiliateFromRequest(request);

    if (!affiliateId) {
      return NextResponse.json(
        { success: false, error },
        { status: 401 }
      );
    }

    // Get available ingress numbers
    const ingressNumbers = await listIngressNumbers();

    // Filter to only active ones and format for frontend
    const availableNumbers = ingressNumbers
      .filter((num) => num.active && num.provisioningStatus === 'ACTIVE')
      .map((num) => ({
        id: num.id,
        phoneNumber: num.phoneNumber,
        phoneNumberDisplay: num.phoneNumberDisplay,
        active: num.active,
        usageCount: num.activeForwardingCount,
      }));

    logger.info({
      event: 'api.ingress_numbers.list',
      message: `Listed ${availableNumbers.length} available ingress numbers`,
      affiliateId,
    });

    return NextResponse.json({
      success: true,
      numbers: availableNumbers,
    });
  } catch (error) {
    logger.error({
      event: 'api.ingress_numbers.error',
      message: 'Error listing ingress numbers',
      error: (error as Error).message,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to load ingress numbers' },
      { status: 500 }
    );
  }
}
