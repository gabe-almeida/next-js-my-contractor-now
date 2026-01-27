/**
 * Reset Password API
 *
 * GET /api/auth/reset-password?token=xxx - Verify token validity
 * POST /api/auth/reset-password - Complete password reset
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyResetToken, completePasswordReset } from '@/lib/services/password-reset-service';
import { captureApiError } from '@/lib/sentry';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

// Verify token validity
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token is required'
      }, { status: 400 });
    }

    const result = await verifyResetToken(token);

    return NextResponse.json({
      success: true,
      valid: result.valid
    });

  } catch (error) {
    captureApiError(error, { route: '/api/auth/reset-password', action: 'GET' });
    console.error('Verify reset token error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to verify token'
    }, { status: 500 });
  }
}

// Complete password reset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = resetPasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 });
    }

    const { token, password } = validation.data;
    const result = await completePasswordReset(token, password);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    captureApiError(error, { route: '/api/auth/reset-password', action: 'POST' });
    console.error('Reset password error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to reset password'
    }, { status: 500 });
  }
}
