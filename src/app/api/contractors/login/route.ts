/**
 * Contractor Login API
 *
 * POST /api/contractors/login
 * Authenticates contractor and returns JWT token
 * Only works for contractors with loginEnabled = true
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateContractor } from '@/lib/services/contractor-auth-service';
import { captureApiError } from '@/lib/sentry';

// Validation schema for login
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

    // Authenticate contractor
    const result = await authenticateContractor(email, password);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 401 });
    }

    // Return token and contractor info
    return NextResponse.json({
      success: true,
      data: {
        token: result.token,
        contractor: result.contractor
      }
    });

  } catch (error) {
    captureApiError(error, { route: '/api/contractors/login', action: 'POST' });
    console.error('Contractor login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Login failed'
    }, { status: 500 });
  }
}
