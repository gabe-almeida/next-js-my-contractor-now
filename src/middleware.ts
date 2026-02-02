/**
 * Next.js Middleware - Route Protection
 *
 * WHY: Protect admin routes at the edge before page renders
 * WHEN: Every request to /admin/* routes
 * HOW: Verify JWT from cookie, redirect to unified /login if invalid
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const PROTECTED_ROUTES = ['/admin', '/affiliate/dashboard', '/affiliate/links', '/affiliate/commissions', '/affiliate/withdrawals', '/affiliate/settings', '/affiliate/calls', '/affiliate/campaigns'];

// Routes that should NOT be protected (public auth routes)
const PUBLIC_AUTH_ROUTES = ['/api/auth/admin/login', '/api/auth/login'];

// Simple JWT decode (no verification - just to check expiry)
// Full verification happens in API routes
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public auth routes
  if (PUBLIC_AUTH_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if this is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Get token from cookie (check all possible cookie names)
  const token = request.cookies.get('admin_token')?.value
    || request.cookies.get('affiliate_token')?.value
    || request.cookies.get('contractor_token')?.value
    || request.cookies.get('auth_token')?.value
    || request.cookies.get('mcn-auth-token')?.value;

  // No token - redirect to unified login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode token to check expiry (basic check)
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check if token is expired
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    // Token expired - clear ALL auth cookies and redirect
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('admin_token');
    response.cookies.delete('affiliate_token');
    response.cookies.delete('contractor_token');
    response.cookies.delete('auth_token');
    response.cookies.delete('user_type');
    response.cookies.delete('mcn-auth-token');
    return response;
  }

  // Token exists and not expired - allow request
  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    // Match all admin routes except static files
    '/admin/:path*',
    // Match admin API routes (for additional protection)
    '/api/admin/:path*',
    // Match protected affiliate routes
    '/affiliate/dashboard/:path*',
    '/affiliate/links/:path*',
    '/affiliate/commissions/:path*',
    '/affiliate/withdrawals/:path*',
    '/affiliate/settings/:path*',
    '/affiliate/calls/:path*',
    '/affiliate/campaigns/:path*',
  ],
};
