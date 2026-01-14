/**
 * Page View Tracking Hook
 *
 * WHY: Track page views for conversion funnel analytics.
 * WHEN: Used on homepage and service pages to record visits.
 * HOW: Generates session ID, sends page view to API on mount.
 */

'use client';

import { useEffect } from 'react';

// Generate or retrieve session ID from sessionStorage
function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = sessionStorage.getItem('mcn_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('mcn_session_id', sessionId);
  }
  return sessionId;
}

interface TrackPageOptions {
  pageType: 'HOME' | 'SERVICE';
  pagePath: string;
  serviceSlug?: string;
}

export function usePageTracking(options: TrackPageOptions) {
  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId) return;

    // Track page view
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        pageType: options.pageType,
        pagePath: options.pagePath,
        serviceSlug: options.serviceSlug,
        referrer: document.referrer || null
      })
    }).catch(err => {
      // Silently fail - don't break user experience for analytics
      console.error('Page tracking failed:', err);
    });
  }, [options.pageType, options.pagePath, options.serviceSlug]);
}
