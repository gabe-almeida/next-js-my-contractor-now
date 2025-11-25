'use client';

import { useMemo } from 'react';
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

// Lightweight coordinates - just what we need for positioning
const LOCATION_COORDINATES: Record<string, { x: number; y: number; state: string }> = {
  'leominster-ma': { x: 89.4, y: 15.8, state: 'MA' },
  'worcester-ma': { x: 89.0, y: 16.2, state: 'MA' },
  'boston-ma': { x: 91.4, y: 15.0, state: 'MA' },
  'springfield-ma': { x: 87.0, y: 16.8, state: 'MA' },
  'los-angeles-ca': { x: 11.8, y: 55.0, state: 'CA' },
  'san-francisco-ca': { x: 6.8, y: 42.0, state: 'CA' },
  'san-diego-ca': { x: 11.5, y: 62.0, state: 'CA' },
  'sacramento-ca': { x: 9.5, y: 38.0, state: 'CA' },
  'new-york-ny': { x: 82.0, y: 25.0, state: 'NY' },
  'albany-ny': { x: 85.5, y: 23.5, state: 'NY' },
  'buffalo-ny': { x: 78.0, y: 22.0, state: 'NY' },
  '01453': { x: 89.4, y: 15.8, state: 'MA' },
  '90210': { x: 11.8, y: 55.0, state: 'CA' },
  '10001': { x: 82.0, y: 25.0, state: 'NY' }
};

// Simple state boxes for visualization - much lighter than detailed paths
const STATE_BOXES = {
  'MA': { x: 87, y: 14, width: 6, height: 4 },
  'CA': { x: 6, y: 35, width: 8, height: 30 },
  'NY': { x: 78, y: 20, width: 12, height: 8 },
  'TX': { x: 35, y: 48, width: 15, height: 18 },
  'FL': { x: 75, y: 65, width: 8, height: 10 }
};

export default function ServiceAreaMap({ locations, className }: ServiceAreaMapProps) {
  const locationMarkers = useMemo(() => {
    return locations.map(location => {
      const coords = LOCATION_COORDINATES[location.id];
      if (!coords) return null;

      return {
        ...location,
        x: coords.x,
        y: coords.y,
        state: coords.state
      };
    }).filter(Boolean);
  }, [locations]);

  const stateMarkers = useMemo(() => {
    return locations
      .filter(location => location.type === 'state')
      .map(location => ({
        ...location,
        ...STATE_BOXES[location.id?.toUpperCase() as keyof typeof STATE_BOXES]
      }))
      .filter(marker => marker.x);
  }, [locations]);

  if (locations.length === 0) {
    return (
      <div className={`${className} bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border-2 border-dashed border-blue-200 flex items-center justify-center`}>
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapIcon className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Coverage Map</h3>
          <p className="text-gray-600 text-sm">Select locations to see your coverage area visualized</p>
          <div className="mt-4 text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block">
            📍 Just like Facebook Ads targeting
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden`}>
      {/* Lightweight US Map - Just an outline */}
      <div className="relative w-full h-full min-h-[400px] bg-gradient-to-br from-slate-50 to-blue-50">
        <svg
          viewBox="0 0 100 80"
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Simple US Outline - Super lightweight */}
          <path
            d="M 10 35 L 85 35 L 88 20 L 92 22 L 95 30 L 92 38 L 88 45 L 85 52 L 88 60 L 85 68 L 75 70 L 65 68 L 55 70 L 45 68 L 35 70 L 25 68 L 15 65 L 8 55 L 5 45 L 8 35 Z"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="0.5"
            className="opacity-40"
          />

          {/* Selected States - Simple rectangles */}
          {stateMarkers.map((state, index) => (
            <rect
              key={state.id}
              x={state.x}
              y={state.y}
              width={state.width}
              height={state.height}
              fill="#1877F2"
              fillOpacity="0.25"
              stroke="#1877F2"
              strokeWidth="0.5"
              rx="1"
              className="animate-pulse"
            />
          ))}

          {/* Location Markers with Coverage Areas */}
          {locationMarkers.map((location, index) => (
            <g key={location?.id}>
              {/* Coverage Area Circle */}
              <circle
                cx={location?.x}
                cy={location?.y}
                r={location?.type === 'zipcode' ? '2.5' : location?.type === 'city' ? '3.5' : '5'}
                fill={
                  location?.type === 'city' ? '#1877F2' :
                  location?.type === 'zipcode' ? '#10B981' :
                  location?.type === 'county' ? '#8B5CF6' : '#F59E0B'
                }
                fillOpacity="0.2"
                stroke={
                  location?.type === 'city' ? '#1877F2' :
                  location?.type === 'zipcode' ? '#10B981' :
                  location?.type === 'county' ? '#8B5CF6' : '#F59E0B'
                }
                strokeWidth="0.3"
                strokeOpacity="0.6"
                className="animate-pulse"
                style={{
                  animationDelay: `${index * 0.3}s`,
                  animationDuration: '3s'
                }}
              />
              
              {/* Location Pin */}
              <circle
                cx={location?.x}
                cy={location?.y}
                r="1"
                fill={
                  location?.type === 'city' ? '#1877F2' :
                  location?.type === 'zipcode' ? '#10B981' :
                  location?.type === 'county' ? '#8B5CF6' : '#F59E0B'
                }
                stroke="white"
                strokeWidth="0.3"
                filter="url(#glow)"
                className="animate-bounce"
                style={{
                  animationDelay: `${index * 0.4}s`,
                  animationDuration: '2s'
                }}
              />
            </g>
          ))}
        </svg>

        {/* Location Labels */}
        <div className="absolute inset-0">
          {locationMarkers.map((location, index) => (
            <div
              key={location?.id}
              className="absolute transform -translate-x-1/2 -translate-y-full"
              style={{
                left: `${location?.x}%`,
                top: `${location?.y}%`,
                marginTop: '-8px'
              }}
            >
              <div className="bg-white px-2 py-1 rounded shadow-lg text-xs font-medium text-gray-800 border border-gray-200 whitespace-nowrap">
                {location?.displayName}
              </div>
            </div>
          ))}
        </div>

        {/* Grid overlay for professional look */}
        <div className="absolute inset-0 pointer-events-none">
          <svg viewBox="0 0 100 80" className="w-full h-full opacity-10">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#64748b" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
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
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
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
        </div>
      </div>

      {/* Professional branding */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
        📍 Coverage Visualization
      </div>
    </div>
  );
}