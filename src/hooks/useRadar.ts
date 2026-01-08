import { useState, useEffect, useRef } from 'react';
import Radar from 'radar-sdk-js';
import 'radar-sdk-js/dist/radar.css';
import { secureLog } from '@/lib/security';

interface UseRadarReturn {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  fallbackMode: boolean;
  searchAddresses: (query: string) => Promise<any[]>;
}

export function useRadar(): UseRadarReturn {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const radarRef = useRef<typeof Radar | null>(null);

  useEffect(() => {
    const initializeRadar = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if we're in browser environment
        if (typeof window === 'undefined') {
          setFallbackMode(true);
          setIsLoading(false);
          return;
        }

        // Use the correct publishable key from environment or hardcoded fallback
        const publishableKey = process.env.NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY || 'prj_live_pk_91767cffe84243dd66aae8025c9c44e0e5ebce49';

        if (!publishableKey) {
          secureLog.warn('Radar publishable key not found, enabling fallback mode');
          setFallbackMode(true);
          setIsLoading(false);
          return;
        }

        // Initialize Radar SDK with options as per documentation
        await Radar.initialize(publishableKey, {
          debug: false
        });
        
        radarRef.current = Radar;
        setIsReady(true);
        secureLog.log('Radar SDK initialized successfully');
        
      } catch (error: any) {
        secureLog.error('Failed to initialize Radar SDK:', error);
        
        // Check for specific error types
        if (error.message?.includes('401') || error.message?.includes('unauthorized') || error.message?.includes('Unauthorized')) {
          setError('Invalid Radar API key');
        } else if (error.message?.includes('network') || error.name === 'NetworkError') {
          setError('Network error - check internet connection');
        } else if (error.message?.includes('timeout')) {
          setError('Address service is taking too long to respond');
        } else {
          setError(`Address validation service unavailable: ${error.message}`);
        }
        
        setFallbackMode(true);
      } finally {
        setIsLoading(false);
      }
    };

    initializeRadar();
  }, []);

  const searchAddresses = async (query: string): Promise<any[]> => {
    if (!isReady || fallbackMode || !radarRef.current) {
      secureLog.log('Radar not ready, using fallback mode');
      return [];
    }

    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      secureLog.log('Searching addresses for query', { queryLength: query.length });
      
      // Use the correct Radar.autocomplete API as per documentation
      const result = await radarRef.current.autocomplete({
        query: query.trim(),
        limit: 10
      });

      secureLog.log('Radar autocomplete result received', { resultCount: Array.isArray(result) ? result.length : 1 });

      // Handle different possible response formats from Radar API
      let addresses: any[] = [];
      if (result?.addresses && Array.isArray(result.addresses)) {
        addresses = result.addresses;
      } else if (Array.isArray(result)) {
        addresses = result;
      } else if (result) {
        // If result is a single object, wrap it in an array
        addresses = [result];
      }
      
      // Filter to only include actual street addresses (not just cities or places)
      // and transform to expected format (RadarAutocompleteResult with nested address)
      const filteredAddresses = addresses
        .filter((addr: any) => {
          // Get the formatted address from wherever it exists in the response
          const formattedAddress = addr.formattedAddress || addr.address?.formattedAddress || '';
          const addressLabel = addr.addressLabel || addr.address?.addressLabel || '';

          // Check if the address contains a street number and street name
          const hasStreetNumber = /^\d+\s+/.test(formattedAddress) || /^\d+\s+/.test(addressLabel);

          // Check for common street suffixes
          const hasStreetSuffix = /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|pl|place|way|cir|circle|ter|terrace|pkwy|parkway|hwy|highway)\b/i.test(formattedAddress) ||
                                 /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|pl|place|way|cir|circle|ter|terrace|pkwy|parkway|hwy|highway)\b/i.test(addressLabel);

          // Exclude results that are just "City, State ZIP" format
          const isCityOnly = /^[^,]+,\s*[A-Z]{2}\s+\d{5}(-\d{4})?$/.test(formattedAddress.trim());

          return hasStreetNumber && hasStreetSuffix && !isCityOnly;
        })
        .map((addr: any) => {
          // Transform to expected RadarAutocompleteResult format with nested address
          // The Radar API returns flat objects, but our types expect { address: {...} }
          if (addr.address) {
            // Already in expected format
            return addr;
          }
          // Wrap flat API response in expected structure
          return {
            address: {
              formattedAddress: addr.formattedAddress,
              addressLabel: addr.addressLabel,
              city: addr.city,
              state: addr.state || addr.stateCode,
              postalCode: addr.postalCode,
              country: addr.country || addr.countryCode,
              latitude: addr.latitude,
              longitude: addr.longitude,
            },
            distance: addr.distance,
            layer: addr.layer,
          };
        });

      return filteredAddresses;
    } catch (error: any) {
      secureLog.error('Radar autocomplete error:', error);
      
      // If we get auth errors, switch to fallback mode
      if (error.status === 401 || error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        setFallbackMode(true);
        setError('Invalid API key - using fallback mode');
      } else {
        secureLog.warn('Autocomplete failed but continuing in normal mode');
      }
      
      return [];
    }
  };

  return {
    isReady,
    isLoading,
    error,
    fallbackMode,
    searchAddresses
  };
}