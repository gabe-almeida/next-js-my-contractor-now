/**
 * Unified Login API
 *
 * POST /api/auth/login
 * Authenticates any user type (admin, affiliate, contractor) and returns
 * appropriate token and redirect path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateUnified } from '@/lib/services/unified-auth-service';
import { captureApiError } from '@/lib/sentry';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { email, password } = validation.data;

    // Authenticate against all user tables
    const result = await authenticateUnified(email, password);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 401 });
    }

    // Return token, user type, and redirect path
    return NextResponse.json({
      success: true,
      data: {
        token: result.token,
        userType: result.userType,
        user: result.user,
        redirectPath: result.redirectPath
      }
    });

  } catch (error) {
    captureApiError(error, { route: '/api/auth/login', action: 'POST' });
    console.error('Unified login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Login failed'
    }, { status: 500 });
  }
}
