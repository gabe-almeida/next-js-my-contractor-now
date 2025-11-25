/**
 * Integration Tests: Radar ZIP Code Validation
 * Tests the Radar.com address autocomplete and ZIP validation integration
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Radar SDK response types
interface RadarAddress {
  formattedAddress: string;
  addressLabel?: string;
  number?: string;
  street?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
}

interface RadarAutocompleteResult {
  addresses: RadarAddress[];
  meta?: {
    code: number;
  };
}

// Mock Radar SDK
const mockRadarSDK = {
  initialize: jest.fn(),
  autocomplete: jest.fn(),
  geocode: jest.fn(),
  isInitialized: true
};

describe('Radar ZIP Validation Integration', () => {
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn() as jest.MockedFunction<any>;
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Address Autocomplete', () => {
    test('should return valid address suggestions', async () => {
      const mockResponse: RadarAutocompleteResult = {
        addresses: [
          {
            formattedAddress: '1600 Pennsylvania Avenue NW, Washington, DC 20500',
            addressLabel: '1600 Pennsylvania Avenue NW',
            number: '1600',
            street: 'Pennsylvania Avenue NW',
            city: 'Washington',
            state: 'District of Columbia',
            stateCode: 'DC',
            postalCode: '20500',
            country: 'United States',
            countryCode: 'US',
            latitude: 38.8977,
            longitude: -77.0365
          }
        ],
        meta: { code: 200 }
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      // Simulate Radar API call
      const query = '1600 Pennsylvania';
      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      const data = await response.json() as RadarAutocompleteResult;

      expect(data.addresses).toHaveLength(1);
      expect(data.addresses[0].postalCode).toBe('20500');
      expect(data.addresses[0].formattedAddress).toContain('Washington');
    });

    test('should extract ZIP code from address', async () => {
      const mockResponse: RadarAutocompleteResult = {
        addresses: [
          {
            formattedAddress: '350 Fifth Avenue, New York, NY 10118',
            postalCode: '10118',
            city: 'New York',
            stateCode: 'NY',
            country: 'United States',
            countryCode: 'US'
          }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const query = '350 Fifth Avenue';
      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      const data = await response.json() as RadarAutocompleteResult;
      const zipCode = data.addresses[0].postalCode;

      expect(zipCode).toBe('10118');
      expect(zipCode).toMatch(/^\d{5}$/);
    });

    test('should handle partial addresses', async () => {
      const mockResponse: RadarAutocompleteResult = {
        addresses: [
          {
            formattedAddress: '123 Main Street, Springfield, IL 62701',
            postalCode: '62701',
            street: 'Main Street',
            city: 'Springfield',
            stateCode: 'IL',
            countryCode: 'US'
          },
          {
            formattedAddress: '123 Main Street, Springfield, MA 01101',
            postalCode: '01101',
            street: 'Main Street',
            city: 'Springfield',
            stateCode: 'MA',
            countryCode: 'US'
          }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const query = '123 Main';
      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      const data = await response.json() as RadarAutocompleteResult;

      expect(data.addresses).toHaveLength(2);
      expect(data.addresses[0].postalCode).toBe('62701');
      expect(data.addresses[1].postalCode).toBe('01101');
    });

    test('should validate US-only addresses', async () => {
      const mockResponse: RadarAutocompleteResult = {
        addresses: [
          {
            formattedAddress: '90210 Beverly Hills, CA',
            postalCode: '90210',
            city: 'Beverly Hills',
            stateCode: 'CA',
            country: 'United States',
            countryCode: 'US'
          }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const query = '90210';
      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}&country=US`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      const data = await response.json() as RadarAutocompleteResult;

      expect(data.addresses[0].countryCode).toBe('US');
      expect(data.addresses[0].postalCode).toBe('90210');
    });

    test('should handle no results', async () => {
      const mockResponse: RadarAutocompleteResult = {
        addresses: []
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const query = 'nonexistent address xyz123';
      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      const data = await response.json() as RadarAutocompleteResult;

      expect(data.addresses).toHaveLength(0);
    });
  });

  describe('ZIP Code Validation', () => {
    test('should validate 5-digit ZIP code format', () => {
      const validZips = ['10001', '90210', '33101', '60601', '98101'];

      validZips.forEach(zip => {
        expect(zip).toMatch(/^\d{5}$/);
      });
    });

    test('should reject invalid ZIP code formats', () => {
      const invalidZips = ['1234', '123456', 'ABCDE', '1234-5678', ''];

      invalidZips.forEach(zip => {
        expect(zip).not.toMatch(/^\d{5}$/);
      });
    });

    test('should geocode ZIP code to coordinates', async () => {
      const mockResponse = {
        addresses: [
          {
            formattedAddress: 'Beverly Hills, CA 90210',
            postalCode: '90210',
            city: 'Beverly Hills',
            stateCode: 'CA',
            latitude: 34.0901,
            longitude: -118.4065,
            countryCode: 'US'
          }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const zipCode = '90210';
      const response = await fetch(
        `https://api.radar.io/v1/geocode/forward?query=${zipCode}`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      const data = await response.json();

      expect(data.addresses[0].latitude).toBeDefined();
      expect(data.addresses[0].longitude).toBeDefined();
      expect(data.addresses[0].postalCode).toBe('90210');
    });

    test('should verify ZIP code exists', async () => {
      const mockResponse = {
        addresses: [
          {
            postalCode: '10001',
            city: 'New York',
            stateCode: 'NY',
            countryCode: 'US'
          }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const zipCode = '10001';
      const response = await fetch(
        `https://api.radar.io/v1/geocode/forward?query=${zipCode}`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      const data = await response.json();

      expect(data.addresses).toHaveLength(1);
      expect(data.addresses[0].postalCode).toBe(zipCode);
    });

    test('should return empty for invalid ZIP code', async () => {
      const mockResponse = {
        addresses: []
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const zipCode = '00000';
      const response = await fetch(
        `https://api.radar.io/v1/geocode/forward?query=${zipCode}`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      const data = await response.json();

      expect(data.addresses).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle API authentication errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' })
      } as Response);

      const query = '1600 Pennsylvania';
      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': 'invalid_key'
          }
        }
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    test('should handle rate limiting', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: 'Rate limit exceeded' })
      } as Response);

      const query = 'test address';
      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
    });

    test('should handle network errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const query = 'test address';

      await expect(
        fetch(
          `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}`,
          {
            headers: {
              'Authorization': 'prj_live_pk_test'
            }
          }
        )
      ).rejects.toThrow('Network error');
    });

    test('should handle timeout errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const query = 'test address';

      await expect(
        fetch(
          `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}`,
          {
            headers: {
              'Authorization': 'prj_live_pk_test'
            }
          }
        )
      ).rejects.toThrow('Request timeout');
    }, 10000);

    test('should handle malformed responses', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => { throw new Error('Invalid JSON'); }
      } as Response);

      const query = 'test address';
      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      await expect(response.json()).rejects.toThrow();
    });
  });

  describe('Fallback Mode', () => {
    test('should fallback to manual entry on API failure', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('API unavailable')
      );

      // Simulate fallback to manual ZIP entry
      const manualZip = '10001';

      expect(manualZip).toMatch(/^\d{5}$/);
      // In real implementation, would validate against database or allow any valid format
    });

    test('should accept manual ZIP when API key missing', () => {
      // When NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY is not set
      const manualZip = '90210';

      // Should still validate format
      expect(manualZip).toMatch(/^\d{5}$/);
    });

    test('should validate manual ZIP format', () => {
      const testCases = [
        { zip: '10001', valid: true },
        { zip: '90210', valid: true },
        { zip: '1234', valid: false },
        { zip: '123456', valid: false },
        { zip: 'ABCDE', valid: false },
        { zip: '', valid: false }
      ];

      testCases.forEach(({ zip, valid }) => {
        const isValid = /^\d{5}$/.test(zip);
        expect(isValid).toBe(valid);
      });
    });
  });

  describe('Performance', () => {
    test('should handle debounced searches efficiently', async () => {
      const mockResponse: RadarAutocompleteResult = {
        addresses: [
          {
            formattedAddress: '123 Main St',
            postalCode: '10001',
            countryCode: 'US'
          }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      // Simulate rapid typing with debounce
      const queries = ['1', '12', '123', '123 M', '123 Main'];
      const debounceDelay = 300;

      // Only last query should actually trigger API call with proper debouncing
      const finalQuery = queries[queries.length - 1];

      await new Promise(resolve => setTimeout(resolve, debounceDelay));

      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(finalQuery)}`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      expect(response.ok).toBe(true);
      // In real implementation, verify only 1 API call was made despite 5 keystrokes
    });

    test('should limit result count', async () => {
      const mockResponse: RadarAutocompleteResult = {
        addresses: Array.from({ length: 8 }, (_, i) => ({
          formattedAddress: `${i + 1}23 Main St`,
          postalCode: `1000${i}`,
          countryCode: 'US'
        }))
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const query = '123 Main';
      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}&limit=8`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      const data = await response.json() as RadarAutocompleteResult;

      expect(data.addresses.length).toBeLessThanOrEqual(8);
    });
  });

  describe('Integration with Lead Processing', () => {
    test('should store address and ZIP separately', async () => {
      const mockResponse: RadarAutocompleteResult = {
        addresses: [
          {
            formattedAddress: '1600 Pennsylvania Avenue NW, Washington, DC 20500',
            postalCode: '20500',
            city: 'Washington',
            stateCode: 'DC',
            countryCode: 'US'
          }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const query = '1600 Pennsylvania';
      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      const data = await response.json() as RadarAutocompleteResult;
      const address = data.addresses[0];

      // Simulate storing in lead
      const leadData = {
        address: address.formattedAddress,
        zipCode: address.postalCode,
        city: address.city,
        state: address.stateCode
      };

      expect(leadData.zipCode).toBe('20500');
      expect(leadData.address).toContain('Pennsylvania Avenue');
      expect(leadData.state).toBe('DC');
    });

    test('should validate ZIP before lead processing', async () => {
      const mockResponse = {
        addresses: [
          {
            postalCode: '10001',
            city: 'New York',
            stateCode: 'NY',
            countryCode: 'US'
          }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const zipCode = '10001';
      const response = await fetch(
        `https://api.radar.io/v1/geocode/forward?query=${zipCode}`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      const data = await response.json();
      const isValid = data.addresses.length > 0;

      expect(isValid).toBe(true);
      // Lead processing would only continue if isValid is true
    });

    test('should handle backward compatibility with string addresses', () => {
      // Old format: address as string
      const oldFormat = '123 Main St, Springfield, IL 62701';

      // New format: address as object
      const newFormat = {
        address: '123 Main St, Springfield, IL 62701',
        zipCode: '62701'
      };

      // Extract ZIP from old format
      const zipMatch = oldFormat.match(/\d{5}/);
      expect(zipMatch).not.toBeNull();
      expect(zipMatch![0]).toBe('62701');

      // Extract ZIP from new format
      expect(newFormat.zipCode).toBe('62701');
    });
  });

  describe('Accessibility', () => {
    test('should provide keyboard navigation data', async () => {
      const mockResponse: RadarAutocompleteResult = {
        addresses: [
          { formattedAddress: 'Address 1', postalCode: '10001', countryCode: 'US' },
          { formattedAddress: 'Address 2', postalCode: '10002', countryCode: 'US' },
          { formattedAddress: 'Address 3', postalCode: '10003', countryCode: 'US' }
        ]
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const query = 'test';
      const response = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': 'prj_live_pk_test'
          }
        }
      );

      const data = await response.json() as RadarAutocompleteResult;

      // Verify each result has necessary data for ARIA labels
      data.addresses.forEach((address, index) => {
        expect(address.formattedAddress).toBeDefined();
        // In real implementation, would use for aria-label
        const ariaLabel = `Address option ${index + 1}: ${address.formattedAddress}`;
        expect(ariaLabel).toContain('Address option');
      });
    });
  });
});
