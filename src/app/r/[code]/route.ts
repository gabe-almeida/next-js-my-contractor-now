/**
 * Affiliate Link Tracking Route
 *
 * GET /r/[code] - Track affiliate link click and redirect to target
 *
 * WHY: This endpoint handles affiliate tracking links. When a user clicks
 *      an affiliate link (e.g., /r/ABC123), this route:
 *      1. Records the click for the affiliate's statistics
 *      2. Sets an attribution cookie for future lead attribution (FIRST-TOUCH)
 *      3. Redirects the user to the intended destination page
 *
 * WHEN: Called when any user clicks an affiliate tracking link
 *
 * HOW: Extracts code from URL, calls trackClick service, sets cookie
 *      (only if no existing affiliate cookie - first-touch attribution),
 *      and performs 302 redirect to target path with affiliate param
 *
 * ATTRIBUTION MODEL: First-touch within 30-day window
 * - If visitor already has an affiliate cookie, we honor it (don't overwrite)
 * - This prevents cookie stuffing and ensures the original introducer gets credit
 * - Your own retargeting campaigns won't steal affiliate credit
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackClick } from '@/lib/services/affiliate-link-service';

// Cookie configuration
const AFFILIATE_COOKIE_NAME = 'aff_ref';
const AFFILIATE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
const AFFILIATE_TIMESTAMP_COOKIE = 'aff_ref_ts'; // Track when first affiliate was set

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
  // Note: We always track clicks even if we don't set the cookie (for analytics)
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

  // FIRST-TOUCH ATTRIBUTION: Only set cookie if no existing affiliate cookie
  const existingAffiliate = request.cookies.get(AFFILIATE_COOKIE_NAME)?.value;

  if (!existingAffiliate) {
    // No existing affiliate - set the cookie (first touch)
    response.cookies.set(AFFILIATE_COOKIE_NAME, code, {
      maxAge: AFFILIATE_COOKIE_MAX_AGE,
      path: '/',
      httpOnly: false, // Frontend needs to read this for form attribution
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // Also set timestamp so we know when first affiliate was recorded
    response.cookies.set(AFFILIATE_TIMESTAMP_COOKIE, Date.now().toString(), {
      maxAge: AFFILIATE_COOKIE_MAX_AGE,
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
  }
  // If existingAffiliate is set, we honor it (first-touch wins)
  // The click is still tracked for analytics, but the original affiliate keeps credit

  return response;
}
