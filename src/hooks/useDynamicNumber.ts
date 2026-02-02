'use client';

/**
 * useDynamicNumber Hook
 *
 * WHY: Provide dynamic phone number based on affiliate attribution for
 *      Dynamic Number Insertion (DNI). When visitors arrive via affiliate
 *      links, this hook fetches the affiliate's tracking number so they
 *      get credit whether the visitor calls or fills a form.
 *
 * WHEN: Any page/component needs to display a call-to-action phone number.
 *       Used by CallButton component and anywhere a phone number is shown.
 *
 * HOW:
 *   1. Check URL for `ref` param (highest priority)
 *   2. Fall back to `aff_ref` cookie (30-day attribution window)
 *   3. Fetch from /api/tracking-numbers/by-referral
 *   4. Cache result in sessionStorage to avoid repeated fetches
 *   5. Return phone number or fallback
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

// =====================================
// TYPE DEFINITIONS
// =====================================

export interface UseDynamicNumberOptions {
  /** Service type slug (e.g., "windows", "roofing") - required */
  service: string;
  /** Fallback phone number if no affiliate number found */
  fallbackNumber?: string;
  /** Display format for fallback number */
  fallbackDisplayNumber?: string;
  /** Skip fetching (useful for SSR or conditional rendering) */
  skip?: boolean;
}

export interface UseDynamicNumberResult {
  /** E.164 format phone number for tel: links */
  phoneNumber: string | null;
  /** Human-readable display format: (xxx) xxx-xxxx */
  displayNumber: string | null;
  /** Whether currently fetching */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Affiliate name (for attribution display) */
  affiliateName: string | null;
  /** Whether a tracking number was found (not using fallback) */
  hasNumber: boolean;
  /** Whether using affiliate tracking vs fallback */
  isAffiliate: boolean;
  /** Affiliate ID if found */
  affiliateId: string | null;
  /** Refetch the number (useful after navigation) */
  refetch: () => void;
}

interface DniApiResponse {
  success: boolean;
  data?: {
    hasNumber: boolean;
    phoneNumber: string | null;
    phoneNumberDisplay: string | null;
    affiliateId: string | null;
    affiliateName: string | null;
    message?: string;
  };
  error?: string;
}

interface CachedResult {
  phoneNumber: string | null;
  displayNumber: string | null;
  affiliateName: string | null;
  affiliateId: string | null;
  hasNumber: boolean;
  timestamp: number;
}

// =====================================
// CONSTANTS
// =====================================

/** Cache key prefix for sessionStorage */
const CACHE_PREFIX = 'dni_';

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Cookie name for affiliate attribution */
const AFFILIATE_COOKIE_NAME = 'aff_ref';

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Get affiliate ref code from URL or cookie
 * WHY: URL param takes priority (fresh click), cookie is fallback (prior attribution)
 */
function getAffiliateRef(): string | null {
  // Only run on client
  if (typeof window === 'undefined') {
    return null;
  }

  // Check URL param first (highest priority - fresh click)
  const urlParams = new URLSearchParams(window.location.search);
  const urlRef = urlParams.get('ref');
  if (urlRef) {
    return urlRef;
  }

  // Fall back to cookie (prior attribution)
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === AFFILIATE_COOKIE_NAME && value) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/**
 * Get cached result from sessionStorage
 * WHY: Avoid repeated API calls for same service during session
 */
function getCachedResult(service: string, ref: string): CachedResult | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const key = `${CACHE_PREFIX}${service}_${ref}`;
    const cached = sessionStorage.getItem(key);
    if (!cached) {
      return null;
    }

    const parsed: CachedResult = JSON.parse(cached);

    // Check if cache is still valid
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Cache result in sessionStorage
 */
function setCachedResult(
  service: string,
  ref: string,
  result: Omit<CachedResult, 'timestamp'>
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const key = `${CACHE_PREFIX}${service}_${ref}`;
    const toCache: CachedResult = {
      ...result,
      timestamp: Date.now()
    };
    sessionStorage.setItem(key, JSON.stringify(toCache));
  } catch {
    // SessionStorage might be full or disabled - fail silently
  }
}

// =====================================
// HOOK IMPLEMENTATION
// =====================================

export function useDynamicNumber(
  options: UseDynamicNumberOptions
): UseDynamicNumberResult {
  const { service, fallbackNumber, fallbackDisplayNumber, skip = false } = options;

  // State
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [displayNumber, setDisplayNumber] = useState<string | null>(null);
  const [affiliateName, setAffiliateName] = useState<string | null>(null);
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [hasNumber, setHasNumber] = useState(false);
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Memoize affiliate ref to avoid unnecessary re-fetches
  const affiliateRef = useMemo(() => getAffiliateRef(), [fetchTrigger]);

  // Fetch tracking number from API
  const fetchNumber = useCallback(async (signal?: AbortSignal) => {
    // Skip if no service provided
    if (!service) {
      setIsLoading(false);
      return;
    }

    // If no affiliate ref, use fallback immediately
    if (!affiliateRef) {
      setPhoneNumber(fallbackNumber || null);
      setDisplayNumber(fallbackDisplayNumber || null);
      setAffiliateName(null);
      setAffiliateId(null);
      setHasNumber(false);
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cached = getCachedResult(service, affiliateRef);
    if (cached) {
      setPhoneNumber(cached.phoneNumber || fallbackNumber || null);
      setDisplayNumber(cached.displayNumber || fallbackDisplayNumber || null);
      setAffiliateName(cached.affiliateName);
      setAffiliateId(cached.affiliateId);
      setHasNumber(cached.hasNumber);
      setIsLoading(false);
      return;
    }

    // Fetch from API
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        ref: affiliateRef,
        service
      });

      const response = await fetch(`/api/tracking-numbers/by-referral?${params}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        },
        signal
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const result: DniApiResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Invalid API response');
      }

      const { data } = result;

      // Cache the result
      setCachedResult(service, affiliateRef, {
        phoneNumber: data.phoneNumber,
        displayNumber: data.phoneNumberDisplay,
        affiliateName: data.affiliateName,
        affiliateId: data.affiliateId,
        hasNumber: data.hasNumber
      });

      // Update state
      if (data.hasNumber && data.phoneNumber) {
        setPhoneNumber(data.phoneNumber);
        setDisplayNumber(data.phoneNumberDisplay);
        setAffiliateName(data.affiliateName);
        setAffiliateId(data.affiliateId);
        setHasNumber(true);
      } else {
        // No affiliate number - use fallback
        setPhoneNumber(fallbackNumber || null);
        setDisplayNumber(fallbackDisplayNumber || null);
        setAffiliateName(data.affiliateName);
        setAffiliateId(data.affiliateId);
        setHasNumber(false);
      }
    } catch (err) {
      // Ignore abort errors (component unmounted or request cancelled)
      if ((err as Error).name === 'AbortError') {
        return;
      }
      // On error, use fallback silently
      setPhoneNumber(fallbackNumber || null);
      setDisplayNumber(fallbackDisplayNumber || null);
      setAffiliateName(null);
      setAffiliateId(null);
      setHasNumber(false);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [service, affiliateRef, fallbackNumber, fallbackDisplayNumber]);

  // Refetch function
  const refetch = useCallback(() => {
    setFetchTrigger((prev) => prev + 1);
  }, []);

  // Effect to fetch on mount and when dependencies change
  useEffect(() => {
    if (skip) {
      setIsLoading(false);
      return;
    }

    // Create AbortController for cleanup on unmount or re-fetch
    const controller = new AbortController();
    fetchNumber(controller.signal);

    // Cleanup: abort pending request on unmount or dependency change
    return () => {
      controller.abort();
    };
  }, [fetchNumber, skip]);

  // Derived state
  const isAffiliate = hasNumber && !!affiliateId;

  return {
    phoneNumber,
    displayNumber,
    isLoading,
    error,
    affiliateName,
    hasNumber,
    isAffiliate,
    affiliateId,
    refetch
  };
}

export default useDynamicNumber;
