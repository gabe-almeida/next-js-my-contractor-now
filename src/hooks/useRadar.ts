import { useState, useEffect, useCallback, useRef } from 'react';

interface UseRadarReturn {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  fallbackMode: boolean;
  searchAddresses: (query: string) => Promise<any[]>;
}

// Store the Radar SDK instance globally after dynamic import
let RadarSDK: any = null;
let radarInitialized = false;

export function useRadar(): UseRadarReturn {
  const [isReady, setIsReady] = useState(radarInitialized);
  const [isLoading, setIsLoading] = useState(!radarInitialized);
  const [error, setError] = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const initAttempted = useRef(false);

  useEffect(() => {
    console.log('[Radar] useEffect triggered', { radarInitialized, initAttempted: initAttempted.current });

    // Skip if already initialized or if we've attempted init
    if (radarInitialized || initAttempted.current) {
      console.log('[Radar] Skipping - already initialized or attempted');
      if (radarInitialized) {
        setIsReady(true);
        setIsLoading(false);
      }
      return;
    }
    initAttempted.current = true;

    const initializeRadar = async () => {
      console.log('[Radar] Starting initialization...');
      try {
        setIsLoading(true);
        setError(null);

        // Must be in browser environment
        if (typeof window === 'undefined') {
          console.log('[Radar] SSR detected, enabling fallback mode');
          setFallbackMode(true);
          setIsLoading(false);
          return;
        }

        // Dynamically import Radar SDK (browser-only due to maplibre-gl dependency)
        console.log('[Radar] Dynamically importing SDK...');
        const RadarModule = await import('radar-sdk-js');
        console.log('[Radar] Import complete, RadarModule:', RadarModule);
        RadarSDK = RadarModule.default;

        if (!RadarSDK) {
          throw new Error('Failed to load Radar SDK');
        }

        // Get publishable key
        const publishableKey = process.env.NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY || 'prj_live_pk_91767cffe84243dd66aae8025c9c44e0e5ebce49';

        if (!publishableKey) {
          console.warn('[Radar] Publishable key not found, enabling fallback mode');
          setFallbackMode(true);
          setIsLoading(false);
          return;
        }

        console.log('[Radar] Initializing SDK with key:', publishableKey.substring(0, 20) + '...');

        // Initialize Radar SDK
        RadarSDK.initialize(publishableKey, {
          debug: process.env.NODE_ENV === 'development',
          logLevel: 'info'
        });

        // Mark as globally initialized
        radarInitialized = true;
        setIsReady(true);
        setIsLoading(false);
        console.log('[Radar] SDK initialized successfully');

      } catch (err: any) {
        console.error('[Radar] Failed to initialize SDK:', err);

        if (err.message?.includes('401') || err.message?.includes('unauthorized')) {
          setError('Invalid Radar API key');
        } else if (err.message?.includes('network')) {
          setError('Network error - check internet connection');
        } else {
          setError(`Address validation service unavailable: ${err.message}`);
        }

        setFallbackMode(true);
        setIsLoading(false);
      }
    };

    initializeRadar();
  }, []);

  const searchAddresses = useCallback(async (query: string): Promise<any[]> => {
    console.log('[Radar] searchAddresses called', { query, radarInitialized, hasSDK: !!RadarSDK, fallbackMode });

    // Check if SDK is ready
    if (!radarInitialized || !RadarSDK || fallbackMode) {
      console.log('[Radar] Not ready or in fallback mode, returning empty', { radarInitialized, hasSDK: !!RadarSDK, fallbackMode });
      return [];
    }

    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      console.log('[Radar] Calling autocomplete API for:', query);

      // Call the Radar autocomplete API with US addresses only
      const result = await RadarSDK.autocomplete({
        query: query.trim(),
        countryCode: 'US',
        layers: ['address'],
        limit: 10
      });

      console.log('[Radar] API response:', result);

      // Extract addresses from response
      const addresses = result?.addresses || [];
      console.log('[Radar] Found', addresses.length, 'addresses');

      if (addresses.length === 0) {
        return [];
      }

      // Filter to only include actual street addresses with numbers
      // and transform to expected format
      const filteredAddresses = addresses
        .filter((addr: any) => {
          const formattedAddress = addr.formattedAddress || '';
          const addressLabel = addr.addressLabel || '';

          // Must start with a street number
          const hasStreetNumber = /^\d+\s+/.test(formattedAddress) || /^\d+\s+/.test(addressLabel);

          // Must have a street suffix
          const streetSuffixes = /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|pl|place|way|cir|circle|ter|terrace|pkwy|parkway|hwy|highway|trl|trail|loop|run|path|pass|xing|crossing)\b/i;
          const hasStreetSuffix = streetSuffixes.test(formattedAddress) || streetSuffixes.test(addressLabel);

          // Exclude city-only results
          const isCityOnly = /^[^,]+,\s*[A-Z]{2}\s+\d{5}(-\d{4})?$/.test(formattedAddress.trim());

          const passes = hasStreetNumber && hasStreetSuffix && !isCityOnly;
          if (!passes) {
            console.log('[Radar] Filtered out:', addressLabel || formattedAddress, { hasStreetNumber, hasStreetSuffix, isCityOnly });
          }
          return passes;
        })
        .map((addr: any) => ({
          // Wrap in expected format with nested address property
          address: {
            formattedAddress: addr.formattedAddress,
            addressLabel: addr.addressLabel,
            city: addr.city,
            state: addr.state || addr.stateCode,
            postalCode: addr.postalCode,
            country: addr.country || addr.countryCode || 'US',
            latitude: addr.latitude,
            longitude: addr.longitude,
          },
          distance: addr.distance,
          layer: addr.layer,
        }));

      console.log('[Radar] Returning', filteredAddresses.length, 'filtered addresses');
      return filteredAddresses;

    } catch (err: any) {
      console.error('[Radar] Autocomplete error:', err);

      // If auth error, switch to fallback mode
      if (err.status === 401 || err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        setFallbackMode(true);
        setError('Invalid API key - using fallback mode');
      }

      return [];
    }
  }, [fallbackMode]);

  return {
    isReady,
    isLoading,
    error,
    fallbackMode,
    searchAddresses
  };
}
