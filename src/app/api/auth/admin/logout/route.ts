/**
 * Admin Logout API Endpoint
 *
 * WHY: Clear authentication cookies and invalidate session
 * WHEN: Admin clicks logout
 * HOW: Clears httpOnly cookie
 *
 * POST /api/auth/admin/logout
 */

import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear the auth cookie
  response.cookies.set('mcn-auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
    path: '/',
  });

  return response;
}
