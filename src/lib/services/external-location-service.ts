/**
 * External Location Service
 * Integrates with external APIs to get comprehensive ZIP code coverage
 */

interface ExternalZipCodeData {
  zipCode: string;
  city: string;
  state: string;
  stateCode: string;
  county: string;
  latitude?: number;
  longitude?: number;
  population?: number;
  timezone?: string;
}

interface LocationSearchResult {
  zipCodes: string[];
  totalCount: number;
  source: 'database' | 'external' | 'hybrid';
}

/**
 * Free ZIP code API using Zippopotam.us
 */
export class ZippopotamService {
  private baseUrl = 'http://api.zippopotam.us';
  private cache = new Map<string, ExternalZipCodeData[]>();
  
  /**
   * Get all ZIP codes for a state
   */
  async getStateZipCodes(stateCode: string): Promise<ExternalZipCodeData[]> {
    const cacheKey = `state:${stateCode}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Note: Zippopotam doesn't have a bulk state endpoint
      // This is a simplified approach - in production you'd need a different strategy
      const response = await fetch(`${this.baseUrl}/us/${stateCode}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const zipCodes: ExternalZipCodeData[] = [];
      
      // Zippopotam returns limited data, this is just an example structure
      if (data.places) {
        data.places.forEach((place: any) => {
          zipCodes.push({
            zipCode: place['post code'],
            city: place['place name'],
            state: data['state'],
            stateCode: data['state abbreviation'],
            county: place['admin name 2'] || '',
            latitude: parseFloat(place.latitude),
            longitude: parseFloat(place.longitude)
          });
        });
      }
      
      this.cache.set(cacheKey, zipCodes);
      return zipCodes;
    } catch (error) {
      console.error('Error fetching state ZIP codes:', error);
      return [];
    }
  }

  /**
   * Get ZIP codes for a city
   */
  async getCityZipCodes(city: string, stateCode: string): Promise<ExternalZipCodeData[]> {
    const cacheKey = `city:${city}:${stateCode}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const response = await fetch(`${this.baseUrl}/us/${stateCode}/${encodeURIComponent(city)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const zipCodes: ExternalZipCodeData[] = [];
      
      if (data.places) {
        data.places.forEach((place: any) => {
          zipCodes.push({
            zipCode: place['post code'],
            city: place['place name'],
            state: data['state'],
            stateCode: data['state abbreviation'],
            county: place['admin name 2'] || '',
            latitude: parseFloat(place.latitude),
            longitude: parseFloat(place.longitude)
          });
        });
      }
      
      this.cache.set(cacheKey, zipCodes);
      return zipCodes;
    } catch (error) {
      console.error('Error fetching city ZIP codes:', error);
      return [];
    }
  }

  /**
   * Validate a ZIP code exists
   */
  async validateZipCode(zipCode: string): Promise<ExternalZipCodeData | null> {
    const cacheKey = `zip:${zipCode}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return cached[0] || null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/us/${zipCode}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      const zipData: ExternalZipCodeData = {
        zipCode: data['post code'],
        city: data.places?.[0]?.['place name'] || '',
        state: data.state,
        stateCode: data['state abbreviation'],
        county: data.places?.[0]?.['admin name 2'] || '',
        latitude: data.places?.[0] ? parseFloat(data.places[0].latitude) : undefined,
        longitude: data.places?.[0] ? parseFloat(data.places[0].longitude) : undefined
      };
      
      this.cache.set(cacheKey, [zipData]);
      return zipData;
    } catch (error) {
      console.error('Error validating ZIP code:', error);
      return null;
    }
  }
}

/**
 * Enhanced location expansion service with external API support
 */
export class EnhancedLocationExpansionService {
  private zippopotamService = new ZippopotamService();
  private fallbackEnabled = true;

  constructor(private useExternalAPIs = true) {}

  /**
   * Get all ZIP codes for a state using external APIs
   */
  async expandStateWithAPI(stateName: string, stateCode?: string): Promise<LocationSearchResult> {
    if (!this.useExternalAPIs) {
      return { zipCodes: [], totalCount: 0, source: 'database' };
    }

    try {
      // If we have state code, use it; otherwise try to derive it
      const code = stateCode || this.getStateCode(stateName);
      if (!code) {
        throw new Error('Could not determine state code');
      }

      const zipData = await this.zippopotamService.getStateZipCodes(code);
      const zipCodes = zipData.map(z => z.zipCode);
      
      return {
        zipCodes,
        totalCount: zipCodes.length,
        source: 'external'
      };
    } catch (error) {
      console.error('External API failed, falling back to mock data:', error);
      
      if (this.fallbackEnabled) {
        // Fallback to your existing mock data expansion
        return this.expandStateWithMockData(stateName);
      }
      
      return { zipCodes: [], totalCount: 0, source: 'database' };
    }
  }

  /**
   * Get all ZIP codes for a city using external APIs
   */
  async expandCityWithAPI(cityName: string, stateCode?: string): Promise<LocationSearchResult> {
    if (!this.useExternalAPIs || !stateCode) {
      return { zipCodes: [], totalCount: 0, source: 'database' };
    }

    try {
      const zipData = await this.zippopotamService.getCityZipCodes(cityName, stateCode);
      const zipCodes = zipData.map(z => z.zipCode);
      
      return {
        zipCodes,
        totalCount: zipCodes.length,
        source: 'external'
      };
    } catch (error) {
      console.error('External API failed for city expansion:', error);
      return { zipCodes: [], totalCount: 0, source: 'database' };
    }
  }

  /**
   * Search ZIP codes with external validation
   */
  async searchZipCodesWithAPI(query: string, limit = 10): Promise<ExternalZipCodeData[]> {
    // If query looks like a ZIP code, validate it
    if (/^\d{5}$/.test(query)) {
      const zipData = await this.zippopotamService.validateZipCode(query);
      return zipData ? [zipData] : [];
    }

    // For other queries, you'd need a more sophisticated search API
    // This is a placeholder - in production you'd use a search-capable service
    return [];
  }

  /**
   * Fallback to mock data (your existing implementation)
   */
  private expandStateWithMockData(stateName: string): LocationSearchResult {
    // Import your existing mock data expansion logic
    // This would use your existing ZIP_CODE_DATABASE
    return { zipCodes: [], totalCount: 0, source: 'database' };
  }

  /**
   * Helper to convert state name to state code
   */
  private getStateCode(stateName: string): string | null {
    const stateMap: Record<string, string> = {
      'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
      'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
      'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
      'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
      'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
      'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
      'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
      'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
      'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
      'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
      'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
      'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
      'Wisconsin': 'WI', 'Wyoming': 'WY'
    };
    
    return stateMap[stateName] || null;
  }
}

/**
 * Database seeding service - populates your ZipCodeMetadata table
 */
export class ZipCodeDatabaseSeeder {
  private enhancedService = new EnhancedLocationExpansionService();

  /**
   * Seed database with ZIP codes from external API
   * This would be run as a one-time setup or periodic update
   */
  async seedZipCodeDatabase(states: string[] = ['CA', 'NY', 'TX', 'FL']): Promise<void> {
    console.log('Starting ZIP code database seeding...');
    
    for (const stateCode of states) {
      try {
        console.log(`Seeding ${stateCode}...`);
        const result = await this.enhancedService.expandStateWithAPI(stateCode, stateCode);
        
        // Here you would insert into your ZipCodeMetadata table
        // await prisma.zipCodeMetadata.createMany({
        //   data: result.zipCodes.map(zipCode => ({
        //     zipCode,
        //     // ... other fields from API
        //   }))
        // });
        
        console.log(`Seeded ${result.totalCount} ZIP codes for ${stateCode}`);
      } catch (error) {
        console.error(`Error seeding ${stateCode}:`, error);
      }
    }
    
    console.log('ZIP code database seeding complete');
  }
}

// Export the enhanced service
export const locationService = new EnhancedLocationExpansionService();
export const zipCodeSeeder = new ZipCodeDatabaseSeeder();