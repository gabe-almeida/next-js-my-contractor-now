'use client';

import { useState, useCallback } from 'react';
import { Search, X, MapPin, Building2, Map, Hash, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ServiceAreaMapAdvanced from './ServiceAreaMapAdvanced';

interface Location {
  id: string;
  type: 'city' | 'state' | 'county' | 'zipcode';
  name: string;
  displayName: string;
  state?: string;
}

interface ServiceType {
  id: string;
  name: string;
  displayName: string;
  category: 'construction' | 'repair' | 'maintenance' | 'installation';
  description: string;
  icon: string;
}

interface ServiceLocationMapping {
  serviceId: string;
  locations: Location[];
}

interface ServiceLocationQuizProps {
  onComplete: (data: { 
    selectedServices: ServiceType[];
    serviceLocationMappings: ServiceLocationMapping[];
  }) => void;
  onStepSave: (stepId: string, data: any) => void;
}

const SERVICE_TYPES: ServiceType[] = [
  {
    id: 'roofing',
    name: 'roofing',
    displayName: 'Roofing Services',
    category: 'construction',
    description: 'Roof repair, replacement, installation, and maintenance',
    icon: '🏠'
  },
  {
    id: 'hvac',
    name: 'hvac',
    displayName: 'HVAC Services',
    category: 'installation',
    description: 'Heating, ventilation, and air conditioning systems',
    icon: '❄️'
  }
];

export default function ServiceLocationQuizSimple({ onComplete, onStepSave }: ServiceLocationQuizProps) {
  const [step, setStep] = useState<'services' | 'locations' | 'review'>('services');
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>([]);
  const [serviceLocationMappings, setServiceLocationMappings] = useState<ServiceLocationMapping[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [currentServiceIndex, setCurrentServiceIndex] = useState(0);

  const handleServiceToggle = useCallback((service: ServiceType) => {
    setSelectedServices(prev => {
      const isSelected = prev.find(s => s.id === service.id);
      if (isSelected) {
        // Remove service and its locations
        setServiceLocationMappings(prevMappings => 
          prevMappings.filter(m => m.serviceId !== service.id)
        );
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  }, []);

  const searchLocations = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data.locations || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
  }, []);

  const handleLocationSelect = useCallback((location: Location) => {
    const currentService = selectedServices[currentServiceIndex];
    if (!currentService) return;

    setServiceLocationMappings(prev => {
      const existing = prev.find(m => m.serviceId === currentService.id);
      if (existing) {
        // Check if location already exists
        if (existing.locations.find(l => l.id === location.id)) {
          return prev; // Already exists
        }
        // Add to existing mapping
        return prev.map(m => 
          m.serviceId === currentService.id
            ? { ...m, locations: [...m.locations, location] }
            : m
        );
      } else {
        // Create new mapping
        return [...prev, { serviceId: currentService.id, locations: [location] }];
      }
    });
  }, [selectedServices, currentServiceIndex]);

  const removeLocation = useCallback((serviceId: string, locationId: string) => {
    setServiceLocationMappings(prev =>
      prev.map(m => 
        m.serviceId === serviceId
          ? { ...m, locations: m.locations.filter(l => l.id !== locationId) }
          : m
      )
    );
  }, []);

  const handleNext = () => {
    if (step === 'services' && selectedServices.length > 0) {
      setStep('locations');
    } else if (step === 'locations') {
      setStep('review');
    } else if (step === 'review') {
      onComplete({ selectedServices, serviceLocationMappings });
    }
  };

  const handlePrevious = () => {
    if (step === 'locations') {
      setStep('services');
    } else if (step === 'review') {
      setStep('locations');
    }
  };

  const getCurrentService = () => selectedServices[currentServiceIndex];
  const getCurrentMapping = () => serviceLocationMappings.find(m => m.serviceId === getCurrentService()?.id);

  // Service Selection Step
  if (step === 'services') {
    return (
      <Card className="p-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Select Your Services</h2>
        <p className="text-gray-600 mb-6">Choose the services you want to offer</p>
        <p className="text-sm text-gray-500 mb-4">Selected: {selectedServices.length} services</p>
        
        <div className="space-y-4 mb-8">
          {SERVICE_TYPES.map(service => {
            const isSelected = selectedServices.find(s => s.id === service.id);
            return (
              <button
                key={service.id}
                onClick={() => handleServiceToggle(service)}
                className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start space-x-4">
                  <span className="text-2xl">{service.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold flex items-center gap-2">
                      {service.displayName}
                      {isSelected && <Check className="h-5 w-5 text-blue-600" />}
                    </h3>
                    <p className="text-gray-600 text-sm">{service.description}</p>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 inline-block">
                      {service.category}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" disabled>Previous</Button>
          <Button 
            onClick={handleNext} 
            disabled={selectedServices.length === 0}
          >
            Next Step
          </Button>
        </div>
      </Card>
    );
  }

  // Location Configuration Step
  if (step === 'locations') {
    const currentService = getCurrentService();
    const currentMapping = getCurrentMapping();

    return (
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Configure Service Areas</h2>
        
        {currentService && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{currentService.icon}</span>
                <h3 className="text-xl font-semibold">{currentService.displayName}</h3>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentServiceIndex(Math.max(0, currentServiceIndex - 1))}
                  disabled={currentServiceIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <span className="text-sm text-gray-500">
                  Service {currentServiceIndex + 1} of {selectedServices.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentServiceIndex(Math.min(selectedServices.length - 1, currentServiceIndex + 1))}
                  disabled={currentServiceIndex === selectedServices.length - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mb-4">
              <Input
                placeholder="Search for states, cities, counties, or ZIP codes..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchLocations(e.target.value);
                }}
                className="w-full"
              />
            </div>

            {searchResults.length > 0 && (
              <div className="mb-4 p-4 border rounded-lg bg-gray-50">
                <h4 className="font-medium mb-2">Search Results:</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {searchResults.map(location => (
                    <button
                      key={location.id}
                      onClick={() => handleLocationSelect(location)}
                      className="w-full text-left p-2 hover:bg-white rounded border flex items-center space-x-2"
                    >
                      {location.type === 'city' && <Building2 className="h-4 w-4" />}
                      {location.type === 'state' && <Map className="h-4 w-4" />}
                      {location.type === 'county' && <MapPin className="h-4 w-4" />}
                      {location.type === 'zipcode' && <Hash className="h-4 w-4" />}
                      <span>{location.displayName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentMapping && currentMapping.locations.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Selected Locations for {currentService.displayName}:</h4>
                <div className="space-y-2">
                  {currentMapping.locations.map(location => (
                    <div key={location.id} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                      <div className="flex items-center space-x-2">
                        {location.type === 'city' && <Building2 className="h-4 w-4" />}
                        {location.type === 'state' && <Map className="h-4 w-4" />}
                        {location.type === 'county' && <MapPin className="h-4 w-4" />}
                        {location.type === 'zipcode' && <Hash className="h-4 w-4" />}
                        <span>{location.displayName}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLocation(currentService.id, location.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={handlePrevious}>Previous</Button>
            <Button 
              onClick={handleNext}
              disabled={serviceLocationMappings.length === 0}
            >
              Review Configuration
            </Button>
          </div>
        </Card>

        {/* Coverage Map Visualization */}
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <span>Coverage Map</span>
            {currentService && (
              <span className="text-sm text-gray-500">- {currentService.displayName}</span>
            )}
          </h3>
          <div className="relative">
            <ServiceAreaMapAdvanced 
              locations={currentMapping?.locations || []}
              className="h-96 rounded-lg overflow-hidden border border-gray-200"
            />
          </div>
          {currentMapping && currentMapping.locations.length > 0 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Showing coverage for <span className="font-medium">{currentMapping.locations.length}</span> selected location{currentMapping.locations.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Review Step
  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Review Configuration</h2>
      
      <div className="space-y-6 mb-8">
        <div>
          <h3 className="text-lg font-semibold mb-2">Selected Services ({selectedServices.length})</h3>
          <div className="space-y-2">
            {selectedServices.map(service => (
              <div key={service.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                <span className="text-xl">{service.icon}</span>
                <span className="font-medium">{service.displayName}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Service Area Configuration</h3>
          {serviceLocationMappings.map(mapping => {
            const service = selectedServices.find(s => s.id === mapping.serviceId);
            return (
              <div key={mapping.serviceId} className="mb-4 p-4 border rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-xl">{service?.icon}</span>
                  <span className="font-medium">{service?.displayName}</span>
                  <span className="text-sm text-gray-500">({mapping.locations.length} locations)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mapping.locations.map(location => (
                    <span key={location.id} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                      {location.displayName}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handlePrevious}>Previous</Button>
        <Button onClick={handleNext} className="bg-green-600 hover:bg-green-700">
          Complete Setup
        </Button>
      </div>
    </Card>
  );
}