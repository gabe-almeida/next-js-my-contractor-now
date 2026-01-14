/**
 * Page View Tracking API
 *
 * WHY: Record page views for conversion funnel analytics.
 * WHEN: Called from frontend on page load (homepage, service pages).
 * HOW: Stores page view with session ID for unique visitor tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, pageType, pagePath, serviceSlug, referrer } = body;

    if (!sessionId || !pageType || !pagePath) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get IP and user agent from headers
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    await prisma.pageView.create({
      data: {
        sessionId,
        pageType,
        pagePath,
        serviceSlug: serviceSlug || null,
        referrer: referrer || null,
        userAgent,
        ipAddress
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking page view:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track page view' },
      { status: 500 }
    );
  }
}
