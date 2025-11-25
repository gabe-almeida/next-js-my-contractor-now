'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, X, MapPin, Building2, Map, Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Location {
  id: string;
  type: 'city' | 'state' | 'county' | 'zipcode';
  name: string;
  displayName: string;
  state?: string;
  county?: string;
  zipCodes?: string[];
  coordinates?: [number, number];
}

interface LocationChooserProps {
  selectedLocations: Location[];
  onLocationChange: (locations: Location[]) => void;
  placeholder?: string;
  maxSelections?: number;
}

// Mock data - in real implementation, this would come from your database
const mockLocations: Location[] = [
  // States
  { id: 'CA', type: 'state', name: 'California', displayName: 'California', coordinates: [36.7783, -119.4179] },
  { id: 'NY', type: 'state', name: 'New York', displayName: 'New York', coordinates: [43.2994, -74.2179] },
  { id: 'TX', type: 'state', name: 'Texas', displayName: 'Texas', coordinates: [31.9686, -99.9018] },
  { id: 'FL', type: 'state', name: 'Florida', displayName: 'Florida', coordinates: [27.7663, -82.6404] },
  
  // Cities
  { id: 'LA-CA', type: 'city', name: 'Los Angeles', displayName: 'Los Angeles, CA', state: 'CA', coordinates: [34.0522, -118.2437] },
  { id: 'NYC-NY', type: 'city', name: 'New York City', displayName: 'New York City, NY', state: 'NY', coordinates: [40.7128, -74.0060] },
  { id: 'SF-CA', type: 'city', name: 'San Francisco', displayName: 'San Francisco, CA', state: 'CA', coordinates: [37.7749, -122.4194] },
  { id: 'MIA-FL', type: 'city', name: 'Miami', displayName: 'Miami, FL', state: 'FL', coordinates: [25.7617, -80.1918] },
  { id: 'HOU-TX', type: 'city', name: 'Houston', displayName: 'Houston, TX', state: 'TX', coordinates: [29.7604, -95.3698] },
  { id: 'CHI-IL', type: 'city', name: 'Chicago', displayName: 'Chicago, IL', state: 'IL', coordinates: [41.8781, -87.6298] },
  
  // Counties
  { id: 'LA-COUNTY-CA', type: 'county', name: 'Los Angeles County', displayName: 'Los Angeles County, CA', state: 'CA' },
  { id: 'COOK-COUNTY-IL', type: 'county', name: 'Cook County', displayName: 'Cook County, IL', state: 'IL' },
  { id: 'HARRIS-COUNTY-TX', type: 'county', name: 'Harris County', displayName: 'Harris County, TX', state: 'TX' },
  
  // ZIP Codes
  { id: '90210', type: 'zipcode', name: '90210', displayName: '90210 (Beverly Hills, CA)', state: 'CA' },
  { id: '10001', type: 'zipcode', name: '10001', displayName: '10001 (New York, NY)', state: 'NY' },
  { id: '33101', type: 'zipcode', name: '33101', displayName: '33101 (Miami, FL)', state: 'FL' },
  { id: '77001', type: 'zipcode', name: '77001', displayName: '77001 (Houston, TX)', state: 'TX' },
  { id: '94102', type: 'zipcode', name: '94102', displayName: '94102 (San Francisco, CA)', state: 'CA' },
];

const getLocationIcon = (type: Location['type']) => {
  switch (type) {
    case 'state': return Map;
    case 'city': return Building2;
    case 'county': return MapPin;
    case 'zipcode': return Hash;
    default: return MapPin;
  }
};

const getLocationColor = (type: Location['type']) => {
  switch (type) {
    case 'state': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'city': return 'bg-green-100 text-green-800 border-green-200';
    case 'county': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'zipcode': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function LocationChooser({ 
  selectedLocations, 
  onLocationChange, 
  placeholder = "Search for cities, states, counties, or ZIP codes...",
  maxSelections 
}: LocationChooserProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter locations based on search term
  const filteredLocations = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    return mockLocations
      .filter(location => 
        location.name.toLowerCase().includes(term) ||
        location.displayName.toLowerCase().includes(term) ||
        (location.state && location.state.toLowerCase().includes(term))
      )
      .filter(location => !selectedLocations.some(selected => selected.id === location.id))
      .slice(0, 10); // Limit results
  }, [searchTerm, selectedLocations]);

  const handleLocationSelect = (location: Location) => {
    if (maxSelections && selectedLocations.length >= maxSelections) {
      return; // Don't add if max reached
    }
    
    const newSelections = [...selectedLocations, location];
    onLocationChange(newSelections);
    setSearchTerm('');
    setShowSuggestions(false);
  };

  const handleLocationRemove = (locationId: string) => {
    const newSelections = selectedLocations.filter(loc => loc.id !== locationId);
    onLocationChange(newSelections);
  };

  const handleSearchFocus = () => {
    setShowSuggestions(true);
    setIsSearching(true);
  };

  const handleSearchBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      setShowSuggestions(false);
      setIsSearching(false);
    }, 200);
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            placeholder={placeholder}
            className="pl-10 pr-4"
          />
        </div>

        {/* Search Suggestions Dropdown */}
        {showSuggestions && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {searchTerm.trim() === '' ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                Start typing to search for locations...
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                No locations found for "{searchTerm}"
              </div>
            ) : (
              <div className="py-1">
                {filteredLocations.map((location) => {
                  const IconComponent = getLocationIcon(location.type);
                  return (
                    <button
                      key={location.id}
                      onClick={() => handleLocationSelect(location)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none flex items-center space-x-3"
                    >
                      <IconComponent className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {location.displayName}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {location.type === 'zipcode' ? 'ZIP Code' : location.type}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Locations */}
      {selectedLocations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900">
              Selected Locations ({selectedLocations.length})
              {maxSelections && (
                <span className="text-gray-500"> / {maxSelections}</span>
              )}
            </h4>
            {selectedLocations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onLocationChange([])}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear all
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedLocations.map((location) => {
              const IconComponent = getLocationIcon(location.type);
              return (
                <Badge
                  key={location.id}
                  variant="secondary"
                  className={`${getLocationColor(location.type)} flex items-center space-x-1 px-3 py-1`}
                >
                  <IconComponent className="h-3 w-3" />
                  <span className="text-xs font-medium">{location.displayName}</span>
                  <button
                    onClick={() => handleLocationRemove(location.id)}
                    className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Filters */}
      <div className="border-t pt-4">
        <div className="text-xs text-gray-500 mb-2">Quick add:</div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const majorCities = mockLocations.filter(loc => 
                loc.type === 'city' && 
                ['Los Angeles', 'New York City', 'Chicago', 'Houston', 'Miami'].includes(loc.name) &&
                !selectedLocations.some(selected => selected.id === loc.id)
              );
              if (majorCities.length > 0) {
                onLocationChange([...selectedLocations, ...majorCities.slice(0, maxSelections ? Math.max(0, maxSelections - selectedLocations.length) : majorCities.length)]);
              }
            }}
            className="text-xs"
          >
            <Building2 className="h-3 w-3 mr-1" />
            Major Cities
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const californiaState = mockLocations.find(loc => loc.id === 'CA');
              if (californiaState && !selectedLocations.some(selected => selected.id === californiaState.id)) {
                onLocationChange([...selectedLocations, californiaState]);
              }
            }}
            className="text-xs"
          >
            <Map className="h-3 w-3 mr-1" />
            California
          </Button>
        </div>
      </div>

      {/* Location Summary */}
      {selectedLocations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="text-xs font-medium text-blue-800 mb-1">Coverage Summary</div>
          <div className="text-xs text-blue-600">
            {selectedLocations.filter(l => l.type === 'state').length} states, {' '}
            {selectedLocations.filter(l => l.type === 'city').length} cities, {' '}
            {selectedLocations.filter(l => l.type === 'county').length} counties, {' '}
            {selectedLocations.filter(l => l.type === 'zipcode').length} ZIP codes
          </div>
        </div>
      )}
    </div>
  );
}