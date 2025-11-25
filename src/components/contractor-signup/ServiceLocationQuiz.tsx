'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, MapPin, Building2, Map, Hash, ChevronLeft, ChevronRight, Check, Filter, RotateCcw, Briefcase, Settings, Target, FileCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

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
  locations: {
    states: Location[];
    cities: Location[];
    counties: Location[];
    zipCodes: Location[];
  };
}

interface QuizStep {
  id: string;
  title: string;
  description: string;
  type: 'service-selection' | 'location-configuration' | 'review';
  completed: boolean;
}

interface ServiceLocationQuizProps {
  onComplete: (data: { 
    selectedServices: ServiceType[];
    serviceLocationMappings: ServiceLocationMapping[];
  }) => void;
  onStepSave?: (stepId: string, data: any) => void;
  initialData?: { 
    selectedServices?: ServiceType[];
    serviceLocationMappings?: ServiceLocationMapping[];
  };
  className?: string;
}

// Available service types
const AVAILABLE_SERVICES: ServiceType[] = [
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
  },
  {
    id: 'plumbing',
    name: 'plumbing',
    displayName: 'Plumbing Services',
    category: 'repair',
    description: 'Pipe repair, installation, fixture replacement',
    icon: '🔧'
  },
  {
    id: 'electrical',
    name: 'electrical',
    displayName: 'Electrical Services',
    category: 'installation',
    description: 'Wiring, panel upgrades, fixture installation',
    icon: '⚡'
  },
  {
    id: 'windows',
    name: 'windows',
    displayName: 'Window Services',
    category: 'installation',
    description: 'Window replacement, repair, and installation',
    icon: '🪟'
  },
  {
    id: 'bathrooms',
    name: 'bathrooms',
    displayName: 'Bathroom Remodeling',
    category: 'construction',
    description: 'Complete bathroom renovation and remodeling',
    icon: '🛁'
  },
  {
    id: 'kitchens',
    name: 'kitchens',
    displayName: 'Kitchen Remodeling',
    category: 'construction',
    description: 'Kitchen renovation, cabinet, and countertop installation',
    icon: '🍳'
  },
  {
    id: 'flooring',
    name: 'flooring',
    displayName: 'Flooring Services',
    category: 'installation',
    description: 'Hardwood, tile, carpet, and laminate installation',
    icon: '🪨'
  },
  {
    id: 'landscaping',
    name: 'landscaping',
    displayName: 'Landscaping Services',
    category: 'maintenance',
    description: 'Lawn care, garden design, tree services',
    icon: '🌳'
  },
  {
    id: 'painting',
    name: 'painting',
    displayName: 'Painting Services',
    category: 'maintenance',
    description: 'Interior and exterior painting services',
    icon: '🎨'
  }
];

// Enhanced location data
const mockLocations: Location[] = [
  // States
  { id: 'CA', type: 'state', name: 'California', displayName: 'California', coordinates: [36.7783, -119.4179] },
  { id: 'NY', type: 'state', name: 'New York', displayName: 'New York', coordinates: [43.2994, -74.2179] },
  { id: 'TX', type: 'state', name: 'Texas', displayName: 'Texas', coordinates: [31.9686, -99.9018] },
  { id: 'FL', type: 'state', name: 'Florida', displayName: 'Florida', coordinates: [27.7663, -82.6404] },
  { id: 'IL', type: 'state', name: 'Illinois', displayName: 'Illinois', coordinates: [40.6331, -89.3985] },
  
  // Major Cities
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
  { id: '10001', type: 'zipcode', name: '10001', displayName: '10001 (Manhattan, NY)', state: 'NY' },
  { id: '33101', type: 'zipcode', name: '33101', displayName: '33101 (Miami, FL)', state: 'FL' },
  { id: '77001', type: 'zipcode', name: '77001', displayName: '77001 (Houston, TX)', state: 'TX' },
  { id: '94102', type: 'zipcode', name: '94102', displayName: '94102 (San Francisco, CA)', state: 'CA' },
  { id: '60601', type: 'zipcode', name: '60601', displayName: '60601 (Chicago, IL)', state: 'IL' },
];

const QUIZ_STEPS: QuizStep[] = [
  {
    id: 'service-selection',
    title: 'Select Your Services',
    description: 'Choose the services you want to offer to customers',
    type: 'service-selection',
    completed: false
  },
  {
    id: 'location-configuration',
    title: 'Configure Service Areas',
    description: 'Set up location coverage for each selected service',
    type: 'location-configuration',
    completed: false
  },
  {
    id: 'review',
    title: 'Review & Confirm',
    description: 'Review your service and location configuration',
    type: 'review',
    completed: false
  }
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
    case 'state': return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
    case 'city': return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
    case 'county': return 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200';
    case 'zipcode': return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200';
  }
};

const getCategoryColor = (category: ServiceType['category']) => {
  switch (category) {
    case 'construction': return 'bg-red-100 text-red-800 border-red-200';
    case 'installation': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'repair': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'maintenance': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const STORAGE_KEY = 'service-location-quiz-progress';

export default function ServiceLocationQuiz({
  onComplete,
  onStepSave,
  initialData,
  className = ''
}: ServiceLocationQuizProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState(QUIZ_STEPS);
  
  // Service selection state
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>(
    initialData?.selectedServices || []
  );
  
  // Location configuration state
  const [serviceLocationMappings, setServiceLocationMappings] = useState<ServiceLocationMapping[]>(
    initialData?.serviceLocationMappings || []
  );
  
  // Current location configuration state
  const [currentServiceIndex, setCurrentServiceIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Location['type'] | 'all'>('all');
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;
  
  // Current service being configured
  const currentService = selectedServices[currentServiceIndex];
  const currentMapping = serviceLocationMappings.find(m => m.serviceId === currentService?.id) || {
    serviceId: currentService?.id || '',
    locations: { states: [], cities: [], counties: [], zipCodes: [] }
  };

  // Progress calculation
  const progressPercentage = useMemo(() => {
    let progress = 0;
    
    if (selectedServices.length > 0) progress += 33;
    
    const configuredServices = serviceLocationMappings.filter(mapping => {
      const totalLocations = Object.values(mapping.locations).flat().length;
      return totalLocations > 0;
    });
    if (configuredServices.length === selectedServices.length && selectedServices.length > 0) {
      progress += 33;
    }
    
    if (currentStepIndex === steps.length - 1) progress += 34;
    
    return progress;
  }, [selectedServices, serviceLocationMappings, currentStepIndex]);

  // Save progress to localStorage
  const saveProgress = useCallback(() => {
    const progressData = {
      selectedServices,
      serviceLocationMappings,
      currentStepIndex,
      currentServiceIndex
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData));
  }, [selectedServices, serviceLocationMappings, currentStepIndex, currentServiceIndex]);

  // Load progress from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData && !initialData) {
      try {
        const parsed = JSON.parse(savedData);
        console.log('Loading saved data:', parsed);
        if (parsed.selectedServices) setSelectedServices(parsed.selectedServices);
        if (parsed.serviceLocationMappings) setServiceLocationMappings(parsed.serviceLocationMappings);
        if (typeof parsed.currentStepIndex === 'number') setCurrentStepIndex(parsed.currentStepIndex);
        if (typeof parsed.currentServiceIndex === 'number') setCurrentServiceIndex(parsed.currentServiceIndex);
      } catch (error) {
        console.error('Error loading saved progress:', error);
      }
    } else {
      console.log('localStorage data:', savedData, 'initialData:', initialData);
    }
  }, [initialData]);

  // Auto-save when state changes (except during initial load)
  useEffect(() => {
    // Skip auto-save on initial mount
    if (selectedServices.length === 0 && serviceLocationMappings.length === 0 && currentStepIndex === 0) {
      return;
    }
    
    const timeoutId = setTimeout(() => {
      const progressData = {
        selectedServices,
        serviceLocationMappings,
        currentStepIndex,
        currentServiceIndex
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData));
    }, 500); // Debounce saves

    return () => clearTimeout(timeoutId);
  }, [selectedServices, serviceLocationMappings, currentStepIndex, currentServiceIndex]);


  // Search locations using SmartyStreets API
  const searchLocations = useCallback(async (query: string, type: string = 'all') => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}&type=${type}`);
      if (response.ok) {
        const data = await response.json();
        const allCurrentLocations = Object.values(currentMapping.locations).flat();
        
        // Filter out already selected locations
        const availableLocations = (data.locations || []).filter(
          (location: Location) => !allCurrentLocations.some(selected => selected.id === location.id)
        );
        
        setSearchResults(availableLocations);
      } else {
        console.error('Location search failed:', response.status);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Location search error:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [currentMapping]);

  // Debounced search effect
  useEffect(() => {
    if (currentStep.type !== 'location-configuration') {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchLocations(searchTerm, activeFilter);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, activeFilter, currentStep.type, searchLocations]);

  // Use search results instead of mock data
  const filteredLocations = searchResults;

  // Handle service selection
  const handleServiceToggle = useCallback((service: ServiceType) => {
    setSelectedServices(prev => {
      const isSelected = prev.some(s => s.id === service.id);
      const newServices = isSelected 
        ? prev.filter(s => s.id !== service.id)
        : [...prev, service];
      
      return newServices;
    });
    
    // Remove location mappings for deselected services in a separate effect
    setServiceLocationMappings(prevMappings => {
      const isSelected = prevMappings.some(m => m.serviceId === service.id);
      return isSelected 
        ? prevMappings.filter(m => m.serviceId !== service.id)
        : prevMappings;
    });
  }, []);

  // Handle location selection for current service
  const handleLocationSelect = (location: Location) => {
    setServiceLocationMappings(prev => {
      const existingIndex = prev.findIndex(m => m.serviceId === currentService.id);
      const locationCategory = location.type === 'zipcode' ? 'zipCodes' :
        location.type === 'city' ? 'cities' :
        location.type === 'county' ? 'counties' :
        location.type === 'state' ? 'states' :
        `${location.type}s` as keyof ServiceLocationMapping['locations'];
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        const existingLocations = updated[existingIndex].locations[locationCategory] || [];
        updated[existingIndex] = {
          ...updated[existingIndex],
          locations: {
            ...updated[existingIndex].locations,
            [locationCategory]: [...existingLocations, location]
          }
        };
        return updated;
      } else {
        return [...prev, {
          serviceId: currentService.id,
          locations: {
            states: locationCategory === 'states' ? [location] : [],
            cities: locationCategory === 'cities' ? [location] : [],
            counties: locationCategory === 'counties' ? [location] : [],
            zipCodes: locationCategory === 'zipCodes' ? [location] : []
          }
        }];
      }
    });
    
    setSearchTerm('');
    setShowSuggestions(false);
  };

  // Handle location removal
  const handleLocationRemove = (locationId: string) => {
    setServiceLocationMappings(prev => {
      const existingIndex = prev.findIndex(m => m.serviceId === currentService.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const mapping = updated[existingIndex];
        
        // Remove from all location categories
        Object.keys(mapping.locations).forEach(key => {
          const locationKey = key as keyof ServiceLocationMapping['locations'];
          mapping.locations[locationKey] = mapping.locations[locationKey].filter(loc => loc.id !== locationId);
        });
        
        updated[existingIndex] = mapping;
        return updated;
      }
      return prev;
    });
  };

  // Step navigation
  const handleNextStep = () => {
    saveProgress();
    
    if (currentStep.type === 'service-selection') {
      // Initialize location mappings for selected services
      const newMappings = selectedServices
        .filter(service => !serviceLocationMappings.some(m => m.serviceId === service.id))
        .map(service => ({
          serviceId: service.id,
          locations: { states: [], cities: [], counties: [], zipCodes: [] }
        }));
      
      if (newMappings.length > 0) {
        setServiceLocationMappings(prev => [...prev, ...newMappings]);
      }
      
      setCurrentServiceIndex(0);
    }
    
    if (isLastStep) {
      onComplete({ selectedServices, serviceLocationMappings });
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePreviousStep = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const canProceed = useMemo(() => {
    switch (currentStep.type) {
      case 'service-selection':
        return selectedServices.length > 0;
      case 'location-configuration':
        // Check that all selected services have at least one location configured
        if (selectedServices.length === 0) return false;
        const configuredServiceIds = serviceLocationMappings
          .filter(mapping => {
            const totalLocations = Object.values(mapping.locations).flat().length;
            return totalLocations > 0;
          })
          .map(mapping => mapping.serviceId);
        return selectedServices.every(service => configuredServiceIds.includes(service.id));
      case 'review':
        return selectedServices.length > 0 && 
               selectedServices.every(service => {
                 const mapping = serviceLocationMappings.find(m => m.serviceId === service.id);
                 return mapping && Object.values(mapping.locations).flat().length > 0;
               });
      default:
        return false;
    }
  }, [currentStep.type, selectedServices, serviceLocationMappings]);

  // Location configuration navigation
  const handleServiceNavigation = (direction: 'next' | 'previous') => {
    if (direction === 'next' && currentServiceIndex < selectedServices.length - 1) {
      setCurrentServiceIndex(prev => prev + 1);
    } else if (direction === 'previous' && currentServiceIndex > 0) {
      setCurrentServiceIndex(prev => prev - 1);
    }
    setSearchTerm('');
    setActiveFilter('all');
  };

  return (
    <div className={`max-w-4xl mx-auto space-y-6 ${className}`}>
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-gray-700">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <span className="text-gray-500">
            {progressPercentage}% Complete
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Step Navigation */}
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex-shrink-0 flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              index === currentStepIndex
                ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                : index < currentStepIndex
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            {step.completed && index !== currentStepIndex && (
              <Check className="h-4 w-4" />
            )}
            <span>{step.title}</span>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <Card className="p-6">
        {/* Service Selection Step */}
        {currentStep.type === 'service-selection' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                <Briefcase className="h-6 w-6" />
                <span>{currentStep.title}</span>
              </h2>
              <p className="text-gray-600">{currentStep.description}</p>
              <div className="text-sm text-gray-500">
                Selected: {selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AVAILABLE_SERVICES.map(service => {
                const isSelected = selectedServices.some(s => s.id === service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => handleServiceToggle(service)}
                    className={`p-4 border-2 rounded-lg text-left transition-all hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    aria-pressed={isSelected}
                    role="checkbox"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="text-2xl">{service.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">{service.displayName}</h3>
                          <div className="flex items-center">
                            <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-500' 
                                : 'border-gray-300'
                            }`}>
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                        <Badge 
                          variant="secondary" 
                          className={`mt-2 text-xs ${getCategoryColor(service.category)}`}
                        >
                          {service.category}
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Location Configuration Step */}
        {currentStep.type === 'location-configuration' && selectedServices.length > 0 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                <Target className="h-6 w-6" />
                <span>{currentStep.title}</span>
              </h2>
              <p className="text-gray-600">Configure service areas for each of your selected services.</p>
            </div>

            {/* Service Navigation */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
              <Button
                variant="outline"
                onClick={() => handleServiceNavigation('previous')}
                disabled={currentServiceIndex === 0}
                className="flex items-center space-x-1"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous Service</span>
              </Button>

              <div className="text-center">
                <div className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                  <span>{currentService?.icon}</span>
                  <span>{currentService?.displayName}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Service {currentServiceIndex + 1} of {selectedServices.length}
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => handleServiceNavigation('next')}
                disabled={currentServiceIndex === selectedServices.length - 1}
                className="flex items-center space-x-1"
              >
                <span>Next Service</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Location Search */}
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Search for states, cities, counties, or ZIP codes..."
                  className="pl-10 pr-4 h-12 text-base"
                />
              </div>

              {/* Filter Buttons */}
              <div className="flex space-x-2">
                <Button
                  variant={activeFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter('all')}
                  className="flex items-center space-x-1"
                >
                  <Filter className="h-4 w-4" />
                  <span>All Types</span>
                </Button>
                {(['state', 'city', 'county', 'zipcode'] as const).map(type => {
                  const IconComponent = getLocationIcon(type);
                  return (
                    <Button
                      key={type}
                      variant={activeFilter === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveFilter(type)}
                      className="flex items-center space-x-1 capitalize"
                    >
                      <IconComponent className="h-4 w-4" />
                      <span>{type === 'zipcode' ? 'ZIP Codes' : 
                        type === 'city' ? 'Cities' :
                        type === 'county' ? 'Counties' :
                        type === 'state' ? 'States' :
                        `${type}s`}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Search Results */}
            {showSuggestions && searchTerm && (
              <div className="border rounded-lg shadow-lg bg-white max-h-64 overflow-y-auto">
                {searchLoading ? (
                  <div className="p-4 text-center text-gray-500">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Searching locations...</span>
                    </div>
                  </div>
                ) : filteredLocations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {searchTerm.length < 2 
                      ? "Type at least 2 characters to search" 
                      : `No locations found for "${searchTerm}"`}
                  </div>
                ) : (
                  <div className="py-2">
                    {filteredLocations.map((location) => {
                      const IconComponent = getLocationIcon(location.type);
                      return (
                        <button
                          key={location.id}
                          onClick={() => handleLocationSelect(location)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors"
                        >
                          <IconComponent className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{location.displayName}</div>
                            <div className="text-sm text-gray-500 capitalize">
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

            {/* Current Service Locations */}
            {Object.values(currentMapping.locations).some(arr => arr.length > 0) && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">
                  Locations for {currentService?.displayName}
                </h4>
                
                {Object.entries(currentMapping.locations).map(([locationType, locations]) => {
                  if (locations.length === 0) return null;
                  
                  const displayType = locationType === 'zipCodes' ? 'ZIP Codes' :
                    locationType === 'cities' ? 'Cities' :
                    locationType === 'counties' ? 'Counties' :
                    locationType === 'states' ? 'States' :
                    locationType.charAt(0).toUpperCase() + locationType.slice(1);
                  
                  return (
                    <div key={locationType} className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">{displayType} ({locations.length})</div>
                      <div className="flex flex-wrap gap-2">
                        {locations.map((location) => {
                          const IconComponent = getLocationIcon(location.type);
                          return (
                            <div
                              key={location.id}
                              className={`flex items-center space-x-1 px-3 py-1 rounded-lg border-2 ${getLocationColor(location.type)}`}
                            >
                              <IconComponent className="h-3 w-3" />
                              <span className="text-xs font-medium">{location.displayName}</span>
                              <button
                                onClick={() => handleLocationRemove(location.id)}
                                className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Review Step */}
        {currentStep.type === 'review' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                <FileCheck className="h-6 w-6" />
                <span>{currentStep.title}</span>
              </h2>
              <p className="text-gray-600">{currentStep.description}</p>
            </div>

            <div className="space-y-6">
              {selectedServices.map(service => {
                const mapping = serviceLocationMappings.find(m => m.serviceId === service.id);
                const locationCount = mapping ? Object.values(mapping.locations).flat().length : 0;
                
                return (
                  <Card key={service.id} className="p-4 border-2 border-gray-200">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">{service.icon}</span>
                        <div>
                          <h3 className="font-medium text-gray-900">{service.displayName}</h3>
                          <p className="text-sm text-gray-600">{locationCount} locations configured</p>
                        </div>
                      </div>
                      
                      {mapping && (
                        <div className="space-y-2">
                          {Object.entries(mapping.locations).map(([locationType, locations]) => {
                            if (locations.length === 0) return null;
                            
                            return (
                              <div key={locationType} className="text-sm">
                                <span className="font-medium capitalize">
                                  {locationType === 'zipCodes' ? 'ZIP Codes' : locationType}:
                                </span>
                                <span className="ml-2 text-gray-600">
                                  {locations.map(loc => loc.displayName).join(', ')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={handlePreviousStep}
            disabled={isFirstStep}
            className="flex items-center space-x-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </Button>

          <Button
            onClick={handleNextStep}
            disabled={!canProceed}
            className="flex items-center space-x-2"
          >
            <span>{isLastStep ? 'Complete Setup' : 'Next Step'}</span>
            {!isLastStep && <ChevronRight className="h-4 w-4" />}
            {isLastStep && <Check className="h-4 w-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}