/**
 * Admin Login API Endpoint
 *
 * WHY: Authenticate admin users and issue JWT tokens
 * WHEN: Admin submits login form
 * HOW: Validates credentials, returns token + user info
 *
 * POST /api/auth/admin/login
 * Body: { email: string, password: string }
 * Returns: { success: boolean, token?: string, user?: object, error?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminLogin } from '@/lib/services/admin-auth-service';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0]?.message || 'Invalid input',
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // Attempt login
    const result = await adminLogin(email, password);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }

    // Create response with httpOnly cookie
    const response = NextResponse.json({
      success: true,
      user: result.user,
      token: result.token, // Also return token for localStorage
    });

    // Set httpOnly cookie for SSR/middleware auth
    response.cookies.set('mcn-auth-token', result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}
