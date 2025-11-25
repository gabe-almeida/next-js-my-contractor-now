/**
 * Location Expansion Service
 * Converts visual location selections (states, cities, counties) to ZIP codes for database storage
 */

interface Location {
  id: string;
  type: 'city' | 'state' | 'county' | 'zipcode';
  name: string;
  displayName: string;
  state?: string;
  county?: string;
  coordinates?: [number, number];
}

interface ZipCodeData {
  zipCode: string;
  city: string;
  state: string;
  county: string;
  stateCode: string;
  latitude?: number;
  longitude?: number;
}

interface ServiceLocationMapping {
  serviceId: string;
  locations: {
    states: Location[];
    cities: Location[];
    counties: Location[];
    zipCodes: Location[];
  };
}

interface ExpandedServiceMapping {
  serviceId: string;
  zipCodes: string[];
  summary: {
    totalZipCodes: number;
    fromStates: number;
    fromCities: number;
    fromCounties: number;
    directZipCodes: number;
  };
}

// Mock comprehensive ZIP code database (in production, this would come from a real database)
// This is a simplified version - a real implementation would have 40,000+ ZIP codes
const ZIP_CODE_DATABASE: ZipCodeData[] = [
  // California
  { zipCode: '90210', city: 'Beverly Hills', state: 'California', stateCode: 'CA', county: 'Los Angeles County', latitude: 34.0901, longitude: -118.4065 },
  { zipCode: '90211', city: 'Beverly Hills', state: 'California', stateCode: 'CA', county: 'Los Angeles County', latitude: 34.0834, longitude: -118.4004 },
  { zipCode: '90212', city: 'Beverly Hills', state: 'California', stateCode: 'CA', county: 'Los Angeles County', latitude: 34.0901, longitude: -118.3987 },
  { zipCode: '90028', city: 'Los Angeles', state: 'California', stateCode: 'CA', county: 'Los Angeles County', latitude: 34.1016, longitude: -118.3267 },
  { zipCode: '90029', city: 'Los Angeles', state: 'California', stateCode: 'CA', county: 'Los Angeles County', latitude: 34.0959, longitude: -118.2948 },
  { zipCode: '90210', city: 'Beverly Hills', state: 'California', stateCode: 'CA', county: 'Los Angeles County' },
  { zipCode: '94102', city: 'San Francisco', state: 'California', stateCode: 'CA', county: 'San Francisco County' },
  { zipCode: '94103', city: 'San Francisco', state: 'California', stateCode: 'CA', county: 'San Francisco County' },
  { zipCode: '94104', city: 'San Francisco', state: 'California', stateCode: 'CA', county: 'San Francisco County' },
  { zipCode: '95014', city: 'Cupertino', state: 'California', stateCode: 'CA', county: 'Santa Clara County' },
  { zipCode: '95123', city: 'San Jose', state: 'California', stateCode: 'CA', county: 'Santa Clara County' },
  { zipCode: '92101', city: 'San Diego', state: 'California', stateCode: 'CA', county: 'San Diego County' },
  { zipCode: '92102', city: 'San Diego', state: 'California', stateCode: 'CA', county: 'San Diego County' },
  
  // New York
  { zipCode: '10001', city: 'New York', state: 'New York', stateCode: 'NY', county: 'New York County' },
  { zipCode: '10002', city: 'New York', state: 'New York', stateCode: 'NY', county: 'New York County' },
  { zipCode: '10003', city: 'New York', state: 'New York', stateCode: 'NY', county: 'New York County' },
  { zipCode: '10004', city: 'New York', state: 'New York', stateCode: 'NY', county: 'New York County' },
  { zipCode: '11201', city: 'Brooklyn', state: 'New York', stateCode: 'NY', county: 'Kings County' },
  { zipCode: '11202', city: 'Brooklyn', state: 'New York', stateCode: 'NY', county: 'Kings County' },
  { zipCode: '12201', city: 'Albany', state: 'New York', stateCode: 'NY', county: 'Albany County' },
  { zipCode: '14201', city: 'Buffalo', state: 'New York', stateCode: 'NY', county: 'Erie County' },
  
  // Texas
  { zipCode: '77001', city: 'Houston', state: 'Texas', stateCode: 'TX', county: 'Harris County' },
  { zipCode: '77002', city: 'Houston', state: 'Texas', stateCode: 'TX', county: 'Harris County' },
  { zipCode: '77003', city: 'Houston', state: 'Texas', stateCode: 'TX', county: 'Harris County' },
  { zipCode: '78201', city: 'San Antonio', state: 'Texas', stateCode: 'TX', county: 'Bexar County' },
  { zipCode: '78202', city: 'San Antonio', state: 'Texas', stateCode: 'TX', county: 'Bexar County' },
  { zipCode: '75201', city: 'Dallas', state: 'Texas', stateCode: 'TX', county: 'Dallas County' },
  { zipCode: '75202', city: 'Dallas', state: 'Texas', stateCode: 'TX', county: 'Dallas County' },
  { zipCode: '73301', city: 'Austin', state: 'Texas', stateCode: 'TX', county: 'Travis County' },
  
  // Florida
  { zipCode: '33101', city: 'Miami', state: 'Florida', stateCode: 'FL', county: 'Miami-Dade County' },
  { zipCode: '33102', city: 'Miami', state: 'Florida', stateCode: 'FL', county: 'Miami-Dade County' },
  { zipCode: '33103', city: 'Miami', state: 'Florida', stateCode: 'FL', county: 'Miami-Dade County' },
  { zipCode: '32801', city: 'Orlando', state: 'Florida', stateCode: 'FL', county: 'Orange County' },
  { zipCode: '33601', city: 'Tampa', state: 'Florida', stateCode: 'FL', county: 'Hillsborough County' },
  { zipCode: '32301', city: 'Tallahassee', state: 'Florida', stateCode: 'FL', county: 'Leon County' },
  
  // Illinois
  { zipCode: '60601', city: 'Chicago', state: 'Illinois', stateCode: 'IL', county: 'Cook County' },
  { zipCode: '60602', city: 'Chicago', state: 'Illinois', stateCode: 'IL', county: 'Cook County' },
  { zipCode: '60603', city: 'Chicago', state: 'Illinois', stateCode: 'IL', county: 'Cook County' },
  { zipCode: '60604', city: 'Chicago', state: 'Illinois', stateCode: 'IL', county: 'Cook County' },
  { zipCode: '62701', city: 'Springfield', state: 'Illinois', stateCode: 'IL', county: 'Sangamon County' },
];

/**
 * Expands a state selection to all ZIP codes in that state
 */
function expandState(stateName: string): string[] {
  const stateZips = ZIP_CODE_DATABASE.filter(zip => 
    zip.state === stateName || zip.stateCode === stateName
  );
  return stateZips.map(zip => zip.zipCode);
}

/**
 * Expands a city selection to all ZIP codes in that city
 */
function expandCity(cityName: string, stateName?: string): string[] {
  let cityZips = ZIP_CODE_DATABASE.filter(zip => 
    zip.city.toLowerCase() === cityName.toLowerCase()
  );
  
  // Filter by state if provided for more accurate matching
  if (stateName) {
    cityZips = cityZips.filter(zip => 
      zip.state === stateName || zip.stateCode === stateName
    );
  }
  
  return cityZips.map(zip => zip.zipCode);
}

/**
 * Expands a county selection to all ZIP codes in that county
 */
function expandCounty(countyName: string, stateName?: string): string[] {
  let countyZips = ZIP_CODE_DATABASE.filter(zip => 
    zip.county.toLowerCase() === countyName.toLowerCase()
  );
  
  // Filter by state if provided for more accurate matching
  if (stateName) {
    countyZips = countyZips.filter(zip => 
      zip.state === stateName || zip.stateCode === stateName
    );
  }
  
  return countyZips.map(zip => zip.zipCode);
}

/**
 * Validates that a ZIP code exists in our database
 */
function validateZipCode(zipCode: string): boolean {
  return ZIP_CODE_DATABASE.some(zip => zip.zipCode === zipCode);
}

/**
 * Main function to expand service location mappings to ZIP codes
 */
export function expandServiceLocationsToZipCodes(
  serviceLocationMappings: ServiceLocationMapping[]
): ExpandedServiceMapping[] {
  return serviceLocationMappings.map(mapping => {
    const allZipCodes = new Set<string>();
    let fromStates = 0;
    let fromCities = 0;
    let fromCounties = 0;
    let directZipCodes = 0;

    // Expand states
    mapping.locations.states.forEach(state => {
      const stateZips = expandState(state.name);
      stateZips.forEach(zip => allZipCodes.add(zip));
      fromStates += stateZips.length;
    });

    // Expand cities
    mapping.locations.cities.forEach(city => {
      const cityZips = expandCity(city.name, city.state);
      cityZips.forEach(zip => allZipCodes.add(zip));
      fromCities += cityZips.length;
    });

    // Expand counties
    mapping.locations.counties.forEach(county => {
      const countyZips = expandCounty(county.name, county.state);
      countyZips.forEach(zip => allZipCodes.add(zip));
      fromCounties += countyZips.length;
    });

    // Add direct ZIP codes
    mapping.locations.zipCodes.forEach(zipLocation => {
      if (validateZipCode(zipLocation.name)) {
        allZipCodes.add(zipLocation.name);
        directZipCodes++;
      }
    });

    return {
      serviceId: mapping.serviceId,
      zipCodes: Array.from(allZipCodes).sort(),
      summary: {
        totalZipCodes: allZipCodes.size,
        fromStates,
        fromCities, 
        fromCounties,
        directZipCodes
      }
    };
  });
}

/**
 * Get ZIP code details for display purposes
 */
export function getZipCodeDetails(zipCode: string): ZipCodeData | null {
  return ZIP_CODE_DATABASE.find(zip => zip.zipCode === zipCode) || null;
}

/**
 * Get summary statistics for expanded locations
 */
export function getExpansionSummary(expandedMappings: ExpandedServiceMapping[]): {
  totalServices: number;
  totalUniqueZipCodes: number;
  averageZipsPerService: number;
  expansionBreakdown: {
    fromStates: number;
    fromCities: number;
    fromCounties: number;
    directZipCodes: number;
  };
} {
  const allUniqueZips = new Set<string>();
  let totalFromStates = 0;
  let totalFromCities = 0;
  let totalFromCounties = 0;
  let totalDirectZipCodes = 0;

  expandedMappings.forEach(mapping => {
    mapping.zipCodes.forEach(zip => allUniqueZips.add(zip));
    totalFromStates += mapping.summary.fromStates;
    totalFromCities += mapping.summary.fromCities;
    totalFromCounties += mapping.summary.fromCounties;
    totalDirectZipCodes += mapping.summary.directZipCodes;
  });

  return {
    totalServices: expandedMappings.length,
    totalUniqueZipCodes: allUniqueZips.size,
    averageZipsPerService: expandedMappings.length > 0 
      ? Math.round(Array.from(allUniqueZips).length / expandedMappings.length)
      : 0,
    expansionBreakdown: {
      fromStates: totalFromStates,
      fromCities: totalFromCities,
      fromCounties: totalFromCounties,
      directZipCodes: totalDirectZipCodes
    }
  };
}

/**
 * Preview function to show what ZIP codes would be generated without actually expanding
 * Useful for the UI to show users what they're selecting
 */
export function previewLocationExpansion(location: Location): {
  estimatedZipCount: number;
  sampleZipCodes: string[];
  locationType: string;
} {
  let zipCodes: string[] = [];
  
  switch (location.type) {
    case 'state':
      zipCodes = expandState(location.name);
      break;
    case 'city':
      zipCodes = expandCity(location.name, location.state);
      break;
    case 'county':
      zipCodes = expandCounty(location.name, location.state);
      break;
    case 'zipcode':
      zipCodes = validateZipCode(location.name) ? [location.name] : [];
      break;
  }

  return {
    estimatedZipCount: zipCodes.length,
    sampleZipCodes: zipCodes.slice(0, 5), // Show first 5 as preview
    locationType: location.type
  };
}

/**
 * Database query helper - would be used to load ZIP codes from the actual database
 * This is a placeholder for the real implementation
 */
export async function loadZipCodeDatabase(): Promise<ZipCodeData[]> {
  // In production, this would query the ZipCodeMetadata table
  // For now, return our mock data
  return Promise.resolve(ZIP_CODE_DATABASE);
}

/**
 * Search ZIP codes by various criteria
 */
export function searchZipCodes(query: string, limit = 10): ZipCodeData[] {
  const lowerQuery = query.toLowerCase();
  
  return ZIP_CODE_DATABASE
    .filter(zip => 
      zip.zipCode.includes(query) ||
      zip.city.toLowerCase().includes(lowerQuery) ||
      zip.state.toLowerCase().includes(lowerQuery) ||
      zip.county.toLowerCase().includes(lowerQuery)
    )
    .slice(0, limit);
}

// Export types for use in other modules
export type {
  ZipCodeData,
  ExpandedServiceMapping,
  ServiceLocationMapping
};