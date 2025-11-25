import { NextRequest, NextResponse } from 'next/server';

interface SmartyStreetsResponse {
  input_index: number;
  candidate_index: number;
  addressee: string;
  delivery_line_1: string;
  last_line: string;
  delivery_point_barcode: string;
  components: {
    primary_number: string;
    street_name: string;
    street_suffix: string;
    city_name: string;
    default_city_name: string;
    state_abbreviation: string;
    zipcode: string;
    plus4_code: string;
  };
  metadata: {
    record_type: string;
    zip_type: string;
    county_fips: string;
    county_name: string;
    carrier_route: string;
    congressional_district: string;
    building_default_indicator: string;
    rdi: string;
    elot_sequence: string;
    elot_sort: string;
    latitude: number;
    longitude: number;
    precision: string;
    time_zone: string;
    utc_offset: number;
    dst: boolean;
    ews_match: boolean;
  };
}

interface LocationResult {
  id: string;
  type: 'city' | 'state' | 'county' | 'zipcode';
  name: string;
  displayName: string;
  state?: string;
  county?: string;
  coordinates?: [number, number];
}

// Enhanced demo data - comprehensive US locations
const DEMO_LOCATIONS = [
  // Massachusetts
  { id: 'leominster-ma', type: 'city' as const, name: 'Leominster', displayName: 'Leominster, MA', state: 'MA' },
  { id: 'worcester-ma', type: 'city' as const, name: 'Worcester', displayName: 'Worcester, MA', state: 'MA' },
  { id: 'boston-ma', type: 'city' as const, name: 'Boston', displayName: 'Boston, MA', state: 'MA' },
  { id: 'springfield-ma', type: 'city' as const, name: 'Springfield', displayName: 'Springfield, MA', state: 'MA' },
  
  // California
  { id: 'los-angeles-ca', type: 'city' as const, name: 'Los Angeles', displayName: 'Los Angeles, CA', state: 'CA' },
  { id: 'san-francisco-ca', type: 'city' as const, name: 'San Francisco', displayName: 'San Francisco, CA', state: 'CA' },
  { id: 'san-diego-ca', type: 'city' as const, name: 'San Diego', displayName: 'San Diego, CA', state: 'CA' },
  { id: 'sacramento-ca', type: 'city' as const, name: 'Sacramento', displayName: 'Sacramento, CA', state: 'CA' },
  
  // New York
  { id: 'new-york-ny', type: 'city' as const, name: 'New York', displayName: 'New York, NY', state: 'NY' },
  { id: 'albany-ny', type: 'city' as const, name: 'Albany', displayName: 'Albany, NY', state: 'NY' },
  { id: 'buffalo-ny', type: 'city' as const, name: 'Buffalo', displayName: 'Buffalo, NY', state: 'NY' },
  
  // States
  { id: 'ca', type: 'state' as const, name: 'California', displayName: 'California', state: 'CA' },
  { id: 'ny', type: 'state' as const, name: 'New York', displayName: 'New York', state: 'NY' },
  { id: 'tx', type: 'state' as const, name: 'Texas', displayName: 'Texas', state: 'TX' },
  { id: 'fl', type: 'state' as const, name: 'Florida', displayName: 'Florida', state: 'FL' },
  { id: 'ma', type: 'state' as const, name: 'Massachusetts', displayName: 'Massachusetts', state: 'MA' },
  
  // Counties
  { id: 'los-angeles-county', type: 'county' as const, name: 'Los Angeles County', displayName: 'Los Angeles County, CA', state: 'CA' },
  { id: 'worcester-county', type: 'county' as const, name: 'Worcester County', displayName: 'Worcester County, MA', state: 'MA' },
  
  // ZIP codes
  { id: '01453', type: 'zipcode' as const, name: '01453', displayName: '01453 (Leominster, MA)', state: 'MA' },
  { id: '90210', type: 'zipcode' as const, name: '90210', displayName: '90210 (Beverly Hills, CA)', state: 'CA' },
  { id: '10001', type: 'zipcode' as const, name: '10001', displayName: '10001 (Manhattan, NY)', state: 'NY' }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'all';

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ locations: [] });
    }

    // Simulate API delay for realistic feel
    await new Promise(resolve => setTimeout(resolve, 200));

    const searchTerm = query.toLowerCase();
    
    // Filter demo locations by search term
    let matchedLocations = DEMO_LOCATIONS.filter(location => 
      location.name.toLowerCase().includes(searchTerm) ||
      location.displayName.toLowerCase().includes(searchTerm)
    );

    // Filter by type if specified
    if (type !== 'all') {
      matchedLocations = matchedLocations.filter(location => location.type === type);
    }

    // Limit results
    const locations = matchedLocations.slice(0, 15);

    return NextResponse.json({ 
      locations: locations,
      message: locations.length > 0 
        ? `Found ${locations.length} location(s) matching "${query}"` 
        : 'Demo API ready - SmartyStreets will replace this when activated'
    });

  } catch (error) {
    console.error('Location search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}