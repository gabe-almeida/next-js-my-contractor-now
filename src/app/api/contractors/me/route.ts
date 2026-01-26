/**
 * Contractor Profile API
 *
 * GET /api/contractors/me
 * Returns the authenticated contractor's profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyContractorToken, getContractorById } from '@/lib/services/contractor-auth-service';
import { captureApiError } from '@/lib/sentry';

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Missing or invalid authorization header'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Verify token
    const verification = verifyContractorToken(token);
    if (!verification.valid || !verification.contractorId) {
      return NextResponse.json({
        success: false,
        error: verification.error || 'Invalid token'
      }, { status: 401 });
    }

    // Get contractor data
    const contractor = await getContractorById(verification.contractorId);

    if (!contractor) {
      return NextResponse.json({
        success: false,
        error: 'Contractor not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: contractor
    });

  } catch (error) {
    captureApiError(error, { route: '/api/contractors/me', action: 'GET' });
    console.error('Get contractor profile error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get profile'
    }, { status: 500 });
  }
}
