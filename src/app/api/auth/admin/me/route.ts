/**
 * Get Current Admin User Endpoint
 *
 * WHY: Retrieve authenticated user info for client-side auth state
 * WHEN: App loads, auth state needs to be verified
 * HOW: Validates JWT from cookie/header, returns user info
 *
 * GET /api/auth/admin/me
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getPermissionsForRole, getAdminById } from '@/lib/services/admin-auth-service';

export async function GET(request: NextRequest) {
  try {
    // Get token from cookie or Authorization header
    const cookieToken = request.cookies.get('mcn-auth-token')?.value;
    const headerToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get fresh user data from database
    const user = await getAdminById(payload.userId);
    if (!user || !user.active) {
      return NextResponse.json(
        { success: false, error: 'User not found or deactivated' },
        { status: 401 }
      );
    }

    // Return user with permissions
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: getPermissionsForRole(user.role),
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get user' },
      { status: 500 }
    );
  }
}
