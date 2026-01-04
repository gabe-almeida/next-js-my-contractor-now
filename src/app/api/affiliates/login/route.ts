/**
 * Affiliate Login API
 *
 * POST /api/affiliates/login
 * Authenticates affiliate and returns JWT token
 * Only works for ACTIVE affiliates
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateAffiliate } from '@/lib/services/affiliate-service';

// Validation schema for login
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false)
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

    const { email, password, rememberMe } = validation.data;

    // Authenticate affiliate
    const result = await authenticateAffiliate(email, password, rememberMe);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 401 });
    }

    // Return token and affiliate info
    const affiliate = result.affiliate!;
    return NextResponse.json({
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

  } catch (error) {
    console.error('Affiliate login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Login failed'
    }, { status: 500 });
  }
}
