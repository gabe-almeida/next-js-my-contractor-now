/**
 * Affiliate Signup API
 *
 * POST /api/affiliates/signup
 * Creates a new affiliate account with PENDING status
 * Requires admin approval before login is allowed
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAffiliate } from '@/lib/services/affiliate-service';
import { captureApiError } from '@/lib/sentry';
import { normalizePhoneNumber, US_PHONE_REGEX } from '@/lib/utils/phone';

// Validation schema for signup
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  companyName: z.string().max(100).optional(),
  phone: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(20)
    .regex(US_PHONE_REGEX, 'Phone number must be exactly 10 digits')
    .transform((val) => normalizePhoneNumber(val) || val) // Normalize to E.164
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = signupSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      }, { status: 400 });
    }

    // Create affiliate
    const result = await createAffiliate(validation.data);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    // Don't return password hash or sensitive data
    const affiliate = result.affiliate!;
    return NextResponse.json({
      success: true,
      data: {
        id: affiliate.id,
        email: affiliate.email,
        firstName: affiliate.firstName,
        lastName: affiliate.lastName,
        status: affiliate.status
      },
      message: 'Registration successful. Your account is pending approval.'
    }, { status: 201 });

  } catch (error) {
    captureApiError(error, { route: '/api/affiliates/signup', action: 'POST' });
    console.error('Affiliate signup error:', error);
    return NextResponse.json({
      success: false,
      error: 'Registration failed'
    }, { status: 500 });
  }
}
