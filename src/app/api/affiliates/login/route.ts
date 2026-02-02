/**
 * Affiliate Login API
 *
 * POST /api/affiliates/login
 * Authenticates affiliate and returns JWT token
 * Only works for ACTIVE affiliates
 *
 * SECURITY:
 * - Rate limited to prevent brute-force attacks (5 attempts/15min, 1hr block)
 * - Generic error messages to prevent account enumeration
 * - Secure cookie settings for token storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateAffiliate } from '@/lib/services/affiliate-service';
import { captureApiError } from '@/lib/sentry';
import { checkRateLimit, penalizeClient } from '@/lib/rate-limiter';

// Validation schema for login
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false)
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

    const { email, password, rememberMe } = validation.data;

    // Authenticate affiliate
    const result = await authenticateAffiliate(email, password, rememberMe);

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
    const affiliate = result.affiliate!;
    const response = NextResponse.json({
      success: true,
      data: {
        token: result.token,
        affiliate: {
          id: affiliate.id,
          email: affiliate.email,
          firstName: affiliate.firstName,
          lastName: affiliate.lastName,
          companyName: affiliate.companyName,
          commissionRate: affiliate.commissionRate,
          status: affiliate.status
        }
      }
    });

    // Set secure httpOnly cookie for the token
    const isProduction = process.env.NODE_ENV === 'production';

    response.cookies.set('affiliate_token', result.token!, {
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

    response.cookies.set('user_type', 'affiliate', {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600
    });

    return response;

  } catch (error) {
    captureApiError(error, { route: '/api/affiliates/login', action: 'POST' });
    console.error('Affiliate login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Login failed'
    }, { status: 500 });
  }
}
