/**
 * Affiliate Link Tracking Route
 *
 * GET /r/[code] - Track affiliate link click and redirect to target
 *
 * WHY: This endpoint handles affiliate tracking links. When a user clicks
 *      an affiliate link (e.g., /r/ABC123), this route:
 *      1. Records the click for the affiliate's statistics
 *      2. Sets an attribution cookie for future lead attribution
 *      3. Redirects the user to the intended destination page
 *
 * WHEN: Called when any user clicks an affiliate tracking link
 *
 * HOW: Extracts code from URL, calls trackClick service, sets cookie,
 *      and performs 302 redirect to target path with affiliate param
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackClick } from '@/lib/services/affiliate-link-service';

// Cookie configuration
const AFFILIATE_COOKIE_NAME = 'aff_ref';
const AFFILIATE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;

  if (!code) {
    // No code provided - redirect to home
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Track the click and get affiliate info
  const result = await trackClick(code);

  if (!result.success || !result.targetPath) {
    // Invalid code or inactive link - redirect to home
    // Don't expose error to user, just redirect gracefully
    console.warn('Invalid affiliate link code:', code);
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Build redirect URL with affiliate attribution in query param
  const targetUrl = new URL(result.targetPath, request.url);
  targetUrl.searchParams.set('ref', code);

  // Create redirect response
  const response = NextResponse.redirect(targetUrl, 302);

  // Set attribution cookie
  // HttpOnly: false - allows frontend JS to read for form submission
  // Secure: true in production
  // SameSite: Lax - allows cookie on cross-site navigation (needed for affiliate links)
  response.cookies.set(AFFILIATE_COOKIE_NAME, code, {
    maxAge: AFFILIATE_COOKIE_MAX_AGE,
    path: '/',
    httpOnly: false, // Frontend needs to read this for form attribution
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  return response;
}
