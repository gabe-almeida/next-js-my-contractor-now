/**
 * SmartyStreets Integration for Complete ZIP Code Coverage
 * Handles all 42,000+ US ZIP codes with official USPS data
 */

interface SmartyStreetsConfig {
  authId: string;
  authToken: string;
  baseUrl?: string;
}

interface SmartyStreetsZipResponse {
  input_index: number;
  city_states: Array<{
    city: string;
    state_abbreviation: string;
    state: string;
    default_city: boolean;
  }>;
  zipcodes: Array<{
    zipcode: string;
    zipcode_type: string;
    county_fips: string;
    county_name: string;
    latitude: number;
    longitude: number;
    precision: string;
  }>;
}

interface SmartyStreetsCityResponse {
  input_index: number;
  input_id: string;
  city: string;
  state: string;
  zipcodes: Array<{
    zipcode: string;
    county_fips: string;
    county_name: string;
    latitude: number;
    longitude: number;
    precision: string;
  }>;
}

export class SmartyStreetsService {
  private config: SmartyStreetsConfig;
  private cache = new Map<string, any>();
  private baseUrl = 'https://us-zipcode-api.smartystreets.com';

  constructor(config: SmartyStreetsConfig) {
    this.config = config;
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
  }

  /**
   * Get all ZIP codes for a city
   */
  async getCityZipCodes(city: string, state: string): Promise<string[]> {
    const cacheKey = `city:${city}:${state}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${this.baseUrl}/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Auth-Token ${this.config.authToken}`
        },
        body: JSON.stringify([{
          input_id: "1",
          city: city,
          state: state
        }])
      });

      if (!response.ok) {
        throw new Error(`SmartyStreets API error: ${response.status}`);
      }

      const data: SmartyStreetsCityResponse[] = await response.json();
      const zipCodes = data[0]?.zipcodes?.map(z => z.zipcode) || [];
      
      this.cache.set(cacheKey, zipCodes);
      return zipCodes;
    } catch (error) {
      console.error('Error fetching city ZIP codes from SmartyStreets:', error);
      return [];
    }
  }

  /**
   * Get all ZIP codes for a state (requires multiple API calls)
   * Note: SmartyStreets doesn't have a direct "get all zips for state" endpoint
   * This would require getting major cities first, then their ZIP codes
   */
  async getStateZipCodes(stateCode: string): Promise<string[]> {
    const cacheKey = `state:${stateCode}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Get major cities for the state first (you'd need a separate service for this)
      const majorCities = await this.getMajorCitiesForState(stateCode);
      
      const allZipCodes = new Set<string>();
      
      // Get ZIP codes for each major city
      for (const city of majorCities) {
        const cityZips = await this.getCityZipCodes(city, stateCode);
        cityZips.forEach(zip => allZipCodes.add(zip));
      }
      
      const zipCodesArray = Array.from(allZipCodes);
      this.cache.set(cacheKey, zipCodesArray);
      return zipCodesArray;
      
    } catch (error) {
      console.error('Error fetching state ZIP codes from SmartyStreets:', error);
      return [];
    }
  }

  /**
   * Validate and get details for a specific ZIP code
   */
  async getZipCodeDetails(zipCode: string): Promise<{
    zipCode: string;
    city: string;
    state: string;
    county: string;
    latitude: number;
    longitude: number;
  } | null> {
    const cacheKey = `zip:${zipCode}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${this.baseUrl}/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Auth-Token ${this.config.authToken}`
        },
        body: JSON.stringify([{
          input_id: "1",
          zipcode: zipCode
        }])
      });

      if (!response.ok) {
        throw new Error(`SmartyStreets API error: ${response.status}`);
      }

      const data: SmartyStreetsZipResponse[] = await response.json();
      
      if (!data[0] || !data[0].city_states[0] || !data[0].zipcodes[0]) {
        return null;
      }

      const result = {
        zipCode: data[0].zipcodes[0].zipcode,
        city: data[0].city_states[0].city,
        state: data[0].city_states[0].state_abbreviation,
        county: data[0].zipcodes[0].county_name,
        latitude: data[0].zipcodes[0].latitude,
        longitude: data[0].zipcodes[0].longitude
      };
      
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting ZIP code details from SmartyStreets:', error);
      return null;
    }
  }

  /**
   * Bulk ZIP code lookup (more efficient for multiple ZIP codes)
   */
  async bulkZipCodeLookup(zipCodes: string[]): Promise<Array<{
    zipCode: string;
    city: string;
    state: string;
    county: string;
    latitude: number;
    longitude: number;
  } | null>> {
    try {
      const lookupData = zipCodes.map((zip, index) => ({
        input_id: index.toString(),
        zipcode: zip
      }));

      const response = await fetch(`${this.baseUrl}/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Auth-Token ${this.config.authToken}`
        },
        body: JSON.stringify(lookupData)
      });

      if (!response.ok) {
        throw new Error(`SmartyStreets API error: ${response.status}`);
      }

      const data: SmartyStreetsZipResponse[] = await response.json();
      
      return data.map(item => {
        if (!item.city_states[0] || !item.zipcodes[0]) {
          return null;
        }

        return {
          zipCode: item.zipcodes[0].zipcode,
          city: item.city_states[0].city,
          state: item.city_states[0].state_abbreviation,
          county: item.zipcodes[0].county_name,
          latitude: item.zipcodes[0].latitude,
          longitude: item.zipcodes[0].longitude
        };
      });
    } catch (error) {
      console.error('Error in bulk ZIP code lookup:', error);
      return zipCodes.map(() => null);
    }
  }

  /**
   * Helper method to get major cities for a state
   * In production, you'd use another service or database for this
   */
  private async getMajorCitiesForState(stateCode: string): Promise<string[]> {
    // This is a simplified list - in production you'd get this from a comprehensive database
    const majorCitiesByState: Record<string, string[]> = {
      'CA': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Oakland', 'Sacramento', 'Long Beach', 'Anaheim', 'Riverside', 'Santa Ana'],
      'NY': ['New York', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany', 'New Rochelle', 'Mount Vernon', 'Schenectady', 'Utica'],
      'TX': ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Lubbock'],
      'FL': ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Hialeah', 'Tallahassee', 'Fort Lauderdale', 'Port St. Lucie', 'Cape Coral'],
      // Add more states as needed
    };

    return majorCitiesByState[stateCode] || [];
  }

  /**
   * Get usage statistics (helpful for monitoring API consumption)
   */
  getUsageStats(): {
    cacheSize: number;
    cachedQueries: string[];
  } {
    return {
      cacheSize: this.cache.size,
      cachedQueries: Array.from(this.cache.keys())
    };
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export configured service
export const createSmartyStreetsService = (authId: string, authToken: string) => {
  return new SmartyStreetsService({ authId, authToken });
};

// Usage example:
// const smartyStreets = createSmartyStreetsService(
//   process.env.SMARTYSTREETS_AUTH_ID!,
//   process.env.SMARTYSTREETS_AUTH_TOKEN!
// );
// const zipCodes = await smartyStreets.getCityZipCodes('Los Angeles', 'CA');