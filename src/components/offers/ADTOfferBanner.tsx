/**
 * ADT Home Security Offer Banner
 *
 * WHY: Monetizes thank you page by displaying ADT Home Security offer.
 *      Revenue is earned when users click and convert through PX network.
 *
 * WHEN: Displayed on thank you page after form submission.
 *       Supports test mode (?test=true) for PX verification.
 *
 * HOW: Builds tracking URL with traffic source attribution (aff_sub)
 *      and lead ID (aff_sub2). On click, fires beacon to track click,
 *      then opens ADT offer in new tab.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';
import { getStoredAttributionData, AttributionData } from '@/utils/attribution';

// ADT/PX tracking parameters (from docs/features/adt-thank-you-offer.md)
const ADT_CONFIG = {
  campaignId: '473',
  affId: '15882',
  hostNameId: '23325',
  baseUrl: 'https://safety-today.adt.com/aff_ad',
};

interface ADTOfferBannerProps {
  leadId: string | null;
  isTestMode?: boolean;
}

/**
 * Builds aff_sub (traffic source) from attribution data.
 * PX allows full text values like "Google", "Facebook", etc.
 */
function buildAffSub(attribution: AttributionData): string {
  let affSub = 'Direct';

  // 1. Use utm_source directly if present (most common case)
  if (attribution.utm_source) {
    affSub = attribution.utm_source;
  }
  // 2. Detect from click IDs if no utm_source
  else if (attribution.gclid || attribution.wbraid || attribution.gbraid) {
    affSub = 'Google';
  } else if (attribution.fbclid || attribution.fbc) {
    affSub = 'Facebook';
  } else if (attribution.msclkid) {
    affSub = 'Microsoft';
  } else if (attribution.ttclid) {
    affSub = 'TikTok';
  } else if (attribution.li_fat_id) {
    affSub = 'LinkedIn';
  } else if (attribution.twclid) {
    affSub = 'Twitter';
  } else if (attribution.rdt_cid) {
    affSub = 'Reddit';
  }
  // 3. Check for affiliate traffic
  else if (attribution.ref || attribution.affiliate_id || attribution.aff) {
    affSub = 'Affiliate';
  }

  // Clean special characters (PX requirement)
  return affSub.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Builds the full ADT tracking URL with attribution parameters.
 */
function buildTrackingUrl(affSub: string, affSub2: string): string {
  const params = new URLSearchParams({
    campaign_id: ADT_CONFIG.campaignId,
    aff_id: ADT_CONFIG.affId,
    hostNameId: ADT_CONFIG.hostNameId,
    aff_sub: affSub,
    aff_sub2: affSub2,
  });

  return `${ADT_CONFIG.baseUrl}?${params.toString()}`;
}

/**
 * Fires a beacon to track the click server-side.
 * Uses sendBeacon for reliability (works even if page is closing).
 */
async function trackClick(
  leadId: string,
  trafficSource: string,
  clickUrl: string
): Promise<void> {
  try {
    const payload = {
      leadId,
      trafficSource,
      clickUrl,
      offerType: 'adt_home_security',
      offerProvider: 'px',
    };

    // Use sendBeacon if available (more reliable)
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: 'application/json',
      });
      navigator.sendBeacon('/api/exit-offers/click', blob);
    } else {
      // Fallback to fetch
      await fetch('/api/exit-offers/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
  } catch (error) {
    // Click tracking is best-effort, don't block user action
    console.error('Failed to track click:', error);
  }
}

export function ADTOfferBanner({ leadId, isTestMode = false }: ADTOfferBannerProps) {
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [affSub, setAffSub] = useState<string>('Direct');

  // Build tracking URL on mount
  useEffect(() => {
    if (isTestMode) {
      // Test mode: use hardcoded test values
      const testAffSub = 'Test';
      const testAffSub2 = leadId || 'test-demo';
      setAffSub(testAffSub);
      setTrackingUrl(buildTrackingUrl(testAffSub, testAffSub2));
    } else if (leadId) {
      // Production mode: build from attribution data
      const attribution = getStoredAttributionData();
      const computedAffSub = buildAffSub(attribution);
      setAffSub(computedAffSub);
      setTrackingUrl(buildTrackingUrl(computedAffSub, leadId));
    }
  }, [leadId, isTestMode]);

  // Handle click - track then open URL
  const handleClick = useCallback(() => {
    if (!trackingUrl) return;

    const effectiveLeadId = isTestMode ? (leadId || 'test-demo') : leadId;

    if (effectiveLeadId) {
      // Fire tracking beacon (non-blocking)
      trackClick(effectiveLeadId, affSub, trackingUrl);
    }

    // Open offer in new tab
    window.open(trackingUrl, '_blank', 'noopener,noreferrer');
  }, [trackingUrl, leadId, affSub, isTestMode]);

  // Don't render if no tracking URL
  if (!trackingUrl) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg overflow-hidden">
      {/* Test Mode Indicator */}
      {isTestMode && (
        <div className="bg-yellow-400 text-yellow-900 text-center text-sm font-semibold py-1">
          TEST MODE - For PX Verification Only
        </div>
      )}

      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
              <ShieldCheckIcon className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-grow text-center md:text-left">
            <h3 className="text-2xl font-bold text-white mb-2">
              Protect Your Home with ADT
            </h3>
            <p className="text-blue-100 mb-4">
              Get a free quote on professional home security. ADT has been
              protecting homes for over 145 years.
            </p>
            <ul className="text-blue-100 text-sm space-y-1 mb-4">
              <li>24/7 Professional monitoring</li>
              <li>Smart home integration</li>
              <li>Free installation available</li>
            </ul>
          </div>

          {/* CTA Button */}
          <div className="flex-shrink-0">
            <button
              onClick={handleClick}
              className="bg-white text-blue-700 px-8 py-4 rounded-lg font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-transform"
            >
              Get Free Quote
            </button>
          </div>
        </div>

        {/* Debug info for test mode */}
        {isTestMode && (
          <div className="mt-4 pt-4 border-t border-white/20 text-xs text-blue-200 font-mono">
            <div>aff_sub: {affSub}</div>
            <div>aff_sub2: {leadId || 'test-demo'}</div>
            <div className="truncate">URL: {trackingUrl}</div>
          </div>
        )}
      </div>
    </div>
  );
}
