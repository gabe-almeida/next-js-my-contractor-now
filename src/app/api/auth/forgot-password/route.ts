/**
 * Forgot Password API
 *
 * POST /api/auth/forgot-password
 * Initiates password reset by sending email with reset link.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset } from '@/lib/services/password-reset-service';
import { captureApiError } from '@/lib/sentry';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = forgotPasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email address'
      }, { status: 400 });
    }

    const { email } = validation.data;
    const result = await requestPasswordReset(email);

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, you will receive a password reset link.'
    });

  } catch (error) {
    captureApiError(error, { route: '/api/auth/forgot-password', action: 'POST' });
    console.error('Forgot password error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process request'
    }, { status: 500 });
  }
}
