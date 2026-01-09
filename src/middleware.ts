/**
 * Next.js Middleware - Route Protection
 *
 * WHY: Protect admin routes at the edge before page renders
 * WHEN: Every request to /admin/* routes (except /admin/login)
 * HOW: Verify JWT from cookie, redirect to login if invalid
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const PROTECTED_ROUTES = ['/admin'];

// Routes that should NOT be protected (public auth routes)
const PUBLIC_AUTH_ROUTES = ['/admin/login', '/api/auth/admin/login'];

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

  // Get token from cookie
  const token = request.cookies.get('mcn-auth-token')?.value;

  // No token - redirect to login
  if (!token) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode token to check expiry (basic check)
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check if token is expired
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    // Token expired - clear cookie and redirect
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    const response = NextResponse.redirect(loginUrl);
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
  ],
};
