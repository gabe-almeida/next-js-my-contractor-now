/**
 * Unified Login API
 *
 * POST /api/auth/login
 * Authenticates any user type (admin, affiliate, contractor) and returns
 * appropriate token and redirect path.
 *
 * SECURITY:
 * - Rate limited to prevent brute-force attacks (5 attempts/15min, 1hr block)
 * - Generic error messages to prevent account enumeration
 * - Secure cookie settings for token storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateUnified } from '@/lib/services/unified-auth-service';
import { captureApiError } from '@/lib/sentry';
import { checkRateLimit, penalizeClient } from '@/lib/rate-limiter';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

// Generic error message to prevent account enumeration
const GENERIC_AUTH_ERROR = 'Invalid email or password';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 5 attempts per 15 minutes, blocked for 1 hour
    const rateLimitResult = await checkRateLimit(request, 'authAttempts');
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Too many login attempts. Please try again later.'
      }, { status: 429 });
    }

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
      // Apply penalty for failed login (progressive blocking)
      await penalizeClient(request, 'authFailures', 1);

      // Return generic error to prevent account enumeration
      // Only show specific messages for non-security-sensitive states
      const safeError = result.error === 'Account pending approval'
        ? 'Account pending approval'
        : GENERIC_AUTH_ERROR;

      return NextResponse.json({
        success: false,
        error: safeError
      }, { status: 401 });
    }

    // Create response with secure cookie
    const response = NextResponse.json({
      success: true,
      data: {
        token: result.token,
        userType: result.userType,
        user: result.user,
        redirectPath: result.redirectPath
      }
    });

    // Set secure httpOnly cookie for the token (more secure than localStorage)
    const tokenKey = `${result.userType}_token`;
    const isProduction = process.env.NODE_ENV === 'production';

    response.cookies.set(tokenKey, result.token!, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600 // 1 hour - matches JWT expiration
    });

    response.cookies.set('auth_token', result.token!, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600
    });

    // Set user_type as non-httpOnly so frontend can read it
    response.cookies.set('user_type', result.userType!, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600
    });

    return response;

  } catch (error) {
    captureApiError(error, { route: '/api/auth/login', action: 'POST' });
    console.error('Unified login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Login failed'
    }, { status: 500 });
  }
}
