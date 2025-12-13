'use client';

import { useMemo, useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, Marker, Annotation, ZoomableGroup } from 'react-simple-maps';
import { MapPin, Hash, Building2, Map as MapIcon } from 'lucide-react';

interface Location {
  id: string;
  type: 'city' | 'state' | 'county' | 'zipcode';
  name: string;
  displayName: string;
  state?: string;
}

interface ServiceAreaMapProps {
  locations: Location[];
  className?: string;
}

// State ID mapping for topojson
const STATE_ID_MAP: Record<string, string> = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09', 'DE': '10',
  'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19', 'KS': '20',
  'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
  'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36',
  'NC': '37', 'ND': '38', 'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45',
  'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54',
  'WI': '55', 'WY': '56'
};

// City coordinates for markers
const CITY_COORDINATES: Record<string, { coordinates: [number, number]; state: string }> = {
  'leominster-ma': { coordinates: [-71.7595, 42.5251], state: 'MA' },
  'worcester-ma': { coordinates: [-71.8023, 42.2626], state: 'MA' },
  'boston-ma': { coordinates: [-71.0589, 42.3601], state: 'MA' },
  'springfield-ma': { coordinates: [-72.5301, 42.1015], state: 'MA' },
  'los-angeles-ca': { coordinates: [-118.2437, 34.0522], state: 'CA' },
  'san-francisco-ca': { coordinates: [-122.4194, 37.7749], state: 'CA' },
  'san-diego-ca': { coordinates: [-117.1611, 32.7157], state: 'CA' },
  'sacramento-ca': { coordinates: [-121.4944, 38.5816], state: 'CA' },
  'new-york-ny': { coordinates: [-74.0059, 40.7128], state: 'NY' },
  'albany-ny': { coordinates: [-73.7562, 42.6526], state: 'NY' },
  'buffalo-ny': { coordinates: [-78.8784, 42.8864], state: 'NY' },
  '01453': { coordinates: [-71.7595, 42.5251], state: 'MA' }, // Leominster ZIP
  '90210': { coordinates: [-118.4065, 34.0901], state: 'CA' }, // Beverly Hills ZIP
  '10001': { coordinates: [-73.9967, 40.7505], state: 'NY' }, // Manhattan ZIP
};

// State center coordinates for zoom calculations
const STATE_CENTERS: Record<string, [number, number]> = {
  'MA': [-71.5, 42.2],
  'CA': [-119.4, 37.0],
  'NY': [-75.5, 42.9],
  'TX': [-99.9, 31.5],
  'FL': [-81.5, 27.6],
};

export default function ServiceAreaMapAdvanced({ locations, className }: ServiceAreaMapProps) {
  // Default US center view
  const DEFAULT_CENTER: [number, number] = [-96, 38];
  const DEFAULT_ZOOM = 1;

  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);

  const selectedStates = useMemo(() => {
    const states = new Set<string>();
    locations.forEach(location => {
      if (location.type === 'state') {
        states.add(STATE_ID_MAP[location.id?.toUpperCase()] || location.id);
      } else if (location.state) {
        states.add(STATE_ID_MAP[location.state] || location.state);
      }
    });
    return states;
  }, [locations]);

  const cityMarkers = useMemo(() => {
    return locations
      .filter(location => location.type === 'city' || location.type === 'zipcode')
      .map(location => {
        const coords = CITY_COORDINATES[location.id];
        if (!coords) return null;
        return {
          ...location,
          ...coords
        };
      })
      .filter(Boolean);
  }, [locations]);

  // Calculate optimal zoom and center based on selected locations
  useEffect(() => {
    if (locations.length === 0) {
      // Reset to default US view
      setMapCenter(DEFAULT_CENTER);
      setMapZoom(DEFAULT_ZOOM);
      return;
    }

    // Collect all coordinates
    const allCoords: [number, number][] = [];

    locations.forEach(location => {
      // Get coordinates from city/zip markers
      const cityCoord = CITY_COORDINATES[location.id];
      if (cityCoord) {
        allCoords.push(cityCoord.coordinates);
      }

      // Get state center if it's a state selection
      if (location.type === 'state' && location.state) {
        const stateCenter = STATE_CENTERS[location.state];
        if (stateCenter) {
          allCoords.push(stateCenter);
        }
      }

      // For locations with state, also get state center as fallback
      if (location.state && !cityCoord) {
        const stateCenter = STATE_CENTERS[location.state];
        if (stateCenter) {
          allCoords.push(stateCenter);
        }
      }
    });

    if (allCoords.length === 0) {
      setMapCenter(DEFAULT_CENTER);
      setMapZoom(DEFAULT_ZOOM);
      return;
    }

    // Calculate bounding box
    const lons = allCoords.map(c => c[0]);
    const lats = allCoords.map(c => c[1]);

    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Calculate center
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;

    // Calculate zoom based on spread
    const lonSpread = maxLon - minLon;
    const latSpread = maxLat - minLat;
    const maxSpread = Math.max(lonSpread, latSpread);

    // Determine zoom level based on geographic spread
    let zoom = DEFAULT_ZOOM;
    if (allCoords.length === 1) {
      zoom = 4; // Single location - zoom in close
    } else if (maxSpread < 2) {
      zoom = 5; // Very small area (single city area)
    } else if (maxSpread < 5) {
      zoom = 3.5; // Small area (few cities in same region)
    } else if (maxSpread < 10) {
      zoom = 2.5; // Medium area (state level)
    } else if (maxSpread < 20) {
      zoom = 1.8; // Large area (multi-state region)
    } else {
      zoom = 1.2; // Very large area (coast to coast)
    }

    setMapCenter([centerLon, centerLat]);
    setMapZoom(zoom);
  }, [locations]);


  return (
    <div className={`${className} relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden`}>
      {/* React Simple Maps US Map with animated zoom */}
      <div className="relative w-full h-full min-h-[400px]">
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{
            scale: 1000,
          }}
          width={975}
          height={610}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup
            center={mapCenter}
            zoom={mapZoom}
            minZoom={0.8}
            maxZoom={8}
            translateExtent={[[-200, -200], [1200, 800]]}
          >
            <Geographies geography="/data/us-states.json">
              {({ geographies }) =>
                geographies.map((geo) => {
                  const isSelected = selectedStates.has(geo.id);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isSelected ? '#1877F2' : '#E5E7EB'}
                      fillOpacity={isSelected ? 0.7 : 0.3}
                      stroke="#9CA3AF"
                      strokeWidth={0.5}
                      style={{
                        default: {
                          outline: 'none',
                          transition: 'fill 0.3s ease, fill-opacity 0.3s ease',
                        },
                        hover: {
                          outline: 'none',
                          fill: isSelected ? '#1565C0' : '#D1D5DB',
                        },
                        pressed: {
                          outline: 'none',
                        },
                      }}
                    />
                  );
                })
              }
            </Geographies>

            {/* City and ZIP Code Markers */}
            {cityMarkers.map((location, index) => (
              <Marker key={location?.id} coordinates={location?.coordinates}>
                <circle
                  r={location?.type === 'zipcode' ? 4 : 6}
                  fill={
                    location?.type === 'city' ? '#1877F2' :
                    location?.type === 'zipcode' ? '#10B981' : '#F59E0B'
                  }
                  stroke="white"
                  strokeWidth={2}
                  opacity={0.9}
                  style={{
                    animation: `pulse 2s infinite`,
                    animationDelay: `${index * 0.3}s`
                  }}
                />
              </Marker>
            ))}

            {/* City Labels */}
            {cityMarkers.slice(0, 10).map((location) => ( // Limit to first 10 to avoid clutter
              <Annotation
                key={`label-${location?.id}`}
                subject={location?.coordinates}
                dx={15}
                dy={-10}
                connector={false}
              >
                <text
                  textAnchor="start"
                  fontSize={12}
                  fill="#374151"
                  fontWeight="500"
                  className="drop-shadow-sm"
                  style={{
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.8))'
                  }}
                >
                  {location?.displayName}
                </text>
              </Annotation>
            ))}
          </ZoomableGroup>
        </ComposableMap>

        {/* Pulse animation and zoom transition styles */}
        <style jsx global>{`
          @keyframes pulse {
            0% { opacity: 0.9; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
            100% { opacity: 0.9; transform: scale(1); }
          }
          /* Smooth zoom/pan animation for the map */
          .rsm-zoomable-group {
            transition: transform 0.5s ease-out;
          }
        `}</style>
      </div>

      {/* Enhanced Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 text-sm">
        <div className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-500" />
          Coverage Areas
        </div>
        <div className="space-y-2">
          {locations.some(l => l.type === 'city') && (
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
              <span className="text-gray-700 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Cities
              </span>
            </div>
          )}
          {locations.some(l => l.type === 'zipcode') && (
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
              <span className="text-gray-700 flex items-center gap-1">
                <Hash className="w-3 h-3" />
                ZIP Codes
              </span>
            </div>
          )}
          {locations.some(l => l.type === 'state') && (
            <div className="flex items-center space-x-3">
              <div className="w-4 h-3 bg-blue-500 opacity-70 rounded-sm shadow-sm"></div>
              <span className="text-gray-700 flex items-center gap-1">
                <MapIcon className="w-3 h-3" />
                States
              </span>
            </div>
          )}
          {locations.some(l => l.type === 'county') && (
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-purple-500 shadow-sm"></div>
              <span className="text-gray-700 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Counties
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Coverage Stats */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{locations.length}</div>
          <div className="text-xs text-gray-600">Location{locations.length !== 1 ? 's' : ''}</div>
          <div className="text-xs text-gray-500 mt-1">
            {selectedStates.size} state{selectedStates.size !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Professional branding */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
        📍 Interactive US Map
      </div>
    </div>
  );
}