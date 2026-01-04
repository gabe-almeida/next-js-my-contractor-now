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

// Validation schema for signup
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  companyName: z.string().max(100).optional(),
  phone: z.string().max(20).optional()
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
    console.error('Affiliate signup error:', error);
    return NextResponse.json({
      success: false,
      error: 'Registration failed'
    }, { status: 500 });
  }
}
