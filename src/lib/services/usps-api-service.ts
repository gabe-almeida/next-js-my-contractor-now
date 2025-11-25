/**
 * USPS Web Tools API Integration
 * Official FREE API for ZIP code validation and city/state lookup
 * https://www.usps.com/business/web-tools-apis/
 */

interface USPSConfig {
  userId: string;
  baseUrl?: string;
}

interface USPSZipCodeDetails {
  zipCode: string;
  city: string;
  state: string;
  stateCode: string;
}

interface USPSCityStateResult {
  zipCode: string;
  city: string;
  state: string;
}

export class USPSAPIService {
  private config: USPSConfig;
  private cache = new Map<string, any>();
  private baseUrl = 'https://secure.shippingapis.com/ShippingAPI.dll';

  constructor(config: USPSConfig) {
    this.config = config;
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
  }

  /**
   * Get city and state for a ZIP code
   * Uses USPS CityStateLookup API
   */
  async getCityStateFromZip(zipCode: string): Promise<USPSCityStateResult | null> {
    const cacheKey = `zip:${zipCode}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const xml = this.buildCityStateLookupXML(zipCode);
      const response = await fetch(`${this.baseUrl}?API=CityStateLookup&XML=${encodeURIComponent(xml)}`);
      
      if (!response.ok) {
        throw new Error(`USPS API error: ${response.status}`);
      }

      const xmlText = await response.text();
      const result = this.parseCityStateResponse(xmlText);
      
      if (result) {
        this.cache.set(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching city/state from USPS:', error);
      return null;
    }
  }

  /**
   * Validate ZIP code format and get city/state
   * Uses USPS ZipCodeLookup API  
   */
  async validateZipCode(zipCode: string): Promise<USPSZipCodeDetails | null> {
    // Basic format validation first
    if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
      return null;
    }

    const cacheKey = `validate:${zipCode}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const xml = this.buildZipCodeLookupXML(zipCode);
      const response = await fetch(`${this.baseUrl}?API=ZipCodeLookup&XML=${encodeURIComponent(xml)}`);
      
      if (!response.ok) {
        throw new Error(`USPS API error: ${response.status}`);
      }

      const xmlText = await response.text();
      const result = this.parseZipCodeResponse(xmlText);
      
      if (result) {
        this.cache.set(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      console.error('Error validating ZIP code with USPS:', error);
      return null;
    }
  }

  /**
   * Get ZIP codes for a city/state combination
   * Note: USPS doesn't have a direct "get all ZIPs for city" endpoint
   * This is a workaround using known ZIP ranges
   */
  async getZipCodesForCity(city: string, state: string): Promise<string[]> {
    const cacheKey = `city:${city}:${state}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // USPS doesn't provide this directly, so we use ZIP code ranges
      // This is a simplified approach - production would need a more comprehensive method
      const zipRanges = this.getZipCodeRangesForState(state);
      const validZips: string[] = [];

      // Test ZIP codes in ranges for this city
      for (const range of zipRanges) {
        for (let zip = range.start; zip <= range.end && validZips.length < 50; zip++) {
          const zipCode = zip.toString().padStart(5, '0');
          const result = await this.getCityStateFromZip(zipCode);
          
          if (result && result.city.toLowerCase() === city.toLowerCase()) {
            validZips.push(zipCode);
          }
        }
      }

      this.cache.set(cacheKey, validZips);
      return validZips;
    } catch (error) {
      console.error('Error getting ZIP codes for city:', error);
      return [];
    }
  }

  /**
   * Bulk validation of multiple ZIP codes
   * USPS allows up to 5 ZIP codes per request
   */
  async bulkValidateZipCodes(zipCodes: string[]): Promise<(USPSZipCodeDetails | null)[]> {
    const results: (USPSZipCodeDetails | null)[] = [];
    
    // Process in batches of 5 (USPS limit)
    for (let i = 0; i < zipCodes.length; i += 5) {
      const batch = zipCodes.slice(i, i + 5);
      
      try {
        const xml = this.buildBulkZipCodeLookupXML(batch);
        const response = await fetch(`${this.baseUrl}?API=ZipCodeLookup&XML=${encodeURIComponent(xml)}`);
        
        if (!response.ok) {
          // Add nulls for failed batch
          results.push(...batch.map(() => null));
          continue;
        }

        const xmlText = await response.text();
        const batchResults = this.parseBulkZipCodeResponse(xmlText);
        results.push(...batchResults);
        
        // Rate limiting - be respectful to USPS servers
        await this.delay(100);
      } catch (error) {
        console.error('Error in bulk ZIP code validation:', error);
        results.push(...batch.map(() => null));
      }
    }

    return results;
  }

  /**
   * Build XML for CityStateLookup API
   */
  private buildCityStateLookupXML(zipCode: string): string {
    return `
      <CityStateLookupRequest USERID="${this.config.userId}">
        <ZipCode ID="0">
          <Zip5>${zipCode}</Zip5>
        </ZipCode>
      </CityStateLookupRequest>
    `.trim();
  }

  /**
   * Build XML for ZipCodeLookup API
   */
  private buildZipCodeLookupXML(zipCode: string): string {
    return `
      <ZipCodeLookupRequest USERID="${this.config.userId}">
        <Address ID="0">
          <FirmName></FirmName>
          <Address1></Address1>
          <Address2></Address2>
          <City></City>
          <State></State>
          <Zip5>${zipCode}</Zip5>
          <Zip4></Zip4>
        </Address>
      </ZipCodeLookupRequest>
    `.trim();
  }

  /**
   * Build XML for bulk ZIP code lookup
   */
  private buildBulkZipCodeLookupXML(zipCodes: string[]): string {
    const addresses = zipCodes.map((zip, index) => `
      <Address ID="${index}">
        <FirmName></FirmName>
        <Address1></Address1>
        <Address2></Address2>
        <City></City>
        <State></State>
        <Zip5>${zip}</Zip5>
        <Zip4></Zip4>
      </Address>
    `).join('');

    return `
      <ZipCodeLookupRequest USERID="${this.config.userId}">
        ${addresses}
      </ZipCodeLookupRequest>
    `.trim();
  }

  /**
   * Parse CityStateLookup XML response
   */
  private parseCityStateResponse(xmlText: string): USPSCityStateResult | null {
    try {
      // Simple XML parsing (in production, use a proper XML parser)
      const cityMatch = xmlText.match(/<City>(.*?)<\/City>/);
      const stateMatch = xmlText.match(/<State>(.*?)<\/State>/);
      const zipMatch = xmlText.match(/<Zip5>(.*?)<\/Zip5>/);

      if (cityMatch && stateMatch && zipMatch) {
        return {
          zipCode: zipMatch[1],
          city: cityMatch[1],
          state: stateMatch[1]
        };
      }

      return null;
    } catch (error) {
      console.error('Error parsing USPS XML response:', error);
      return null;
    }
  }

  /**
   * Parse ZipCodeLookup XML response
   */
  private parseZipCodeResponse(xmlText: string): USPSZipCodeDetails | null {
    try {
      const cityMatch = xmlText.match(/<City>(.*?)<\/City>/);
      const stateMatch = xmlText.match(/<State>(.*?)<\/State>/);
      const zipMatch = xmlText.match(/<Zip5>(.*?)<\/Zip5>/);

      if (cityMatch && stateMatch && zipMatch) {
        return {
          zipCode: zipMatch[1],
          city: cityMatch[1],
          state: stateMatch[1],
          stateCode: this.getStateAbbreviation(stateMatch[1])
        };
      }

      return null;
    } catch (error) {
      console.error('Error parsing ZIP code response:', error);
      return null;
    }
  }

  /**
   * Parse bulk ZIP code lookup response
   */
  private parseBulkZipCodeResponse(xmlText: string): (USPSZipCodeDetails | null)[] {
    try {
      const results: (USPSZipCodeDetails | null)[] = [];
      const addressMatches = xmlText.match(/<Address[^>]*>[\s\S]*?<\/Address>/g) || [];

      for (const addressXml of addressMatches) {
        const cityMatch = addressXml.match(/<City>(.*?)<\/City>/);
        const stateMatch = addressXml.match(/<State>(.*?)<\/State>/);
        const zipMatch = addressXml.match(/<Zip5>(.*?)<\/Zip5>/);

        if (cityMatch && stateMatch && zipMatch) {
          results.push({
            zipCode: zipMatch[1],
            city: cityMatch[1],
            state: stateMatch[1],
            stateCode: this.getStateAbbreviation(stateMatch[1])
          });
        } else {
          results.push(null);
        }
      }

      return results;
    } catch (error) {
      console.error('Error parsing bulk ZIP code response:', error);
      return [];
    }
  }

  /**
   * Get ZIP code ranges for states (simplified)
   */
  private getZipCodeRangesForState(stateCode: string): Array<{start: number, end: number}> {
    const ranges: Record<string, Array<{start: number, end: number}>> = {
      'CA': [{start: 90001, end: 96162}],
      'NY': [{start: 10001, end: 14975}],
      'TX': [{start: 73001, end: 79999}],
      'FL': [{start: 32003, end: 34997}],
      // Add more states as needed
    };

    return ranges[stateCode] || [];
  }

  /**
   * Convert state name to abbreviation
   */
  private getStateAbbreviation(stateName: string): string {
    const stateMap: Record<string, string> = {
      'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
      'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
      'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
      // ... add all states
    };

    return stateMap[stateName.toUpperCase()] || stateName;
  }

  /**
   * Simple delay utility for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Factory function
export const createUSPSService = (userId: string) => {
  return new USPSAPIService({ userId });
};

// Usage example:
// const uspsService = createUSPSService(process.env.USPS_USER_ID!);
// const result = await uspsService.getCityStateFromZip('90210');
// console.log(result); // { zipCode: '90210', city: 'BEVERLY HILLS', state: 'CA' }