'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, MapPin, Building2, Map, Hash, ChevronLeft, ChevronRight, Check, Filter, RotateCcw } from 'lucide-react';
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

interface QuizStep {
  id: string;
  title: string;
  description: string;
  allowedTypes: Location['type'][];
  minSelections?: number;
  maxSelections?: number;
  completed: boolean;
  selectedLocations: Location[];
}

interface QuizLocationChooserProps {
  onComplete: (allSelections: { [stepId: string]: Location[] }) => void;
  onStepSave?: (stepId: string, selections: Location[]) => void;
  initialData?: { [stepId: string]: Location[] };
  className?: string;
}

// Enhanced mock data with more comprehensive coverage
const mockLocations: Location[] = [
  // States
  { id: 'CA', type: 'state', name: 'California', displayName: 'California', coordinates: [36.7783, -119.4179] },
  { id: 'NY', type: 'state', name: 'New York', displayName: 'New York', coordinates: [43.2994, -74.2179] },
  { id: 'TX', type: 'state', name: 'Texas', displayName: 'Texas', coordinates: [31.9686, -99.9018] },
  { id: 'FL', type: 'state', name: 'Florida', displayName: 'Florida', coordinates: [27.7663, -82.6404] },
  { id: 'IL', type: 'state', name: 'Illinois', displayName: 'Illinois', coordinates: [40.6331, -89.3985] },
  { id: 'PA', type: 'state', name: 'Pennsylvania', displayName: 'Pennsylvania', coordinates: [41.2033, -77.1945] },
  { id: 'OH', type: 'state', name: 'Ohio', displayName: 'Ohio', coordinates: [40.4173, -82.9071] },
  { id: 'GA', type: 'state', name: 'Georgia', displayName: 'Georgia', coordinates: [32.1656, -82.9001] },
  { id: 'NC', type: 'state', name: 'North Carolina', displayName: 'North Carolina', coordinates: [35.7596, -79.0193] },
  { id: 'MI', type: 'state', name: 'Michigan', displayName: 'Michigan', coordinates: [44.3148, -85.6024] },
  
  // Major Cities
  { id: 'LA-CA', type: 'city', name: 'Los Angeles', displayName: 'Los Angeles, CA', state: 'CA', coordinates: [34.0522, -118.2437] },
  { id: 'NYC-NY', type: 'city', name: 'New York City', displayName: 'New York City, NY', state: 'NY', coordinates: [40.7128, -74.0060] },
  { id: 'SF-CA', type: 'city', name: 'San Francisco', displayName: 'San Francisco, CA', state: 'CA', coordinates: [37.7749, -122.4194] },
  { id: 'MIA-FL', type: 'city', name: 'Miami', displayName: 'Miami, FL', state: 'FL', coordinates: [25.7617, -80.1918] },
  { id: 'HOU-TX', type: 'city', name: 'Houston', displayName: 'Houston, TX', state: 'TX', coordinates: [29.7604, -95.3698] },
  { id: 'CHI-IL', type: 'city', name: 'Chicago', displayName: 'Chicago, IL', state: 'IL', coordinates: [41.8781, -87.6298] },
  { id: 'PHI-PA', type: 'city', name: 'Philadelphia', displayName: 'Philadelphia, PA', state: 'PA', coordinates: [39.9526, -75.1652] },
  { id: 'PHX-AZ', type: 'city', name: 'Phoenix', displayName: 'Phoenix, AZ', state: 'AZ', coordinates: [33.4484, -112.0740] },
  { id: 'SA-TX', type: 'city', name: 'San Antonio', displayName: 'San Antonio, TX', state: 'TX', coordinates: [29.4241, -98.4936] },
  { id: 'SD-CA', type: 'city', name: 'San Diego', displayName: 'San Diego, CA', state: 'CA', coordinates: [32.7157, -117.1611] },
  { id: 'DAL-TX', type: 'city', name: 'Dallas', displayName: 'Dallas, TX', state: 'TX', coordinates: [32.7767, -96.7970] },
  { id: 'SJ-CA', type: 'city', name: 'San Jose', displayName: 'San Jose, CA', state: 'CA', coordinates: [37.3382, -121.8863] },
  { id: 'ATL-GA', type: 'city', name: 'Atlanta', displayName: 'Atlanta, GA', state: 'GA', coordinates: [33.7490, -84.3880] },
  
  // Counties
  { id: 'LA-COUNTY-CA', type: 'county', name: 'Los Angeles County', displayName: 'Los Angeles County, CA', state: 'CA' },
  { id: 'COOK-COUNTY-IL', type: 'county', name: 'Cook County', displayName: 'Cook County, IL', state: 'IL' },
  { id: 'HARRIS-COUNTY-TX', type: 'county', name: 'Harris County', displayName: 'Harris County, TX', state: 'TX' },
  { id: 'MARICOPA-COUNTY-AZ', type: 'county', name: 'Maricopa County', displayName: 'Maricopa County, AZ', state: 'AZ' },
  { id: 'SD-COUNTY-CA', type: 'county', name: 'San Diego County', displayName: 'San Diego County, CA', state: 'CA' },
  { id: 'OC-COUNTY-CA', type: 'county', name: 'Orange County', displayName: 'Orange County, CA', state: 'CA' },
  { id: 'MIAMI-DADE-FL', type: 'county', name: 'Miami-Dade County', displayName: 'Miami-Dade County, FL', state: 'FL' },
  { id: 'KINGS-COUNTY-NY', type: 'county', name: 'Kings County', displayName: 'Kings County (Brooklyn), NY', state: 'NY' },
  
  // ZIP Codes
  { id: '90210', type: 'zipcode', name: '90210', displayName: '90210 (Beverly Hills, CA)', state: 'CA' },
  { id: '10001', type: 'zipcode', name: '10001', displayName: '10001 (Manhattan, NY)', state: 'NY' },
  { id: '33101', type: 'zipcode', name: '33101', displayName: '33101 (Miami, FL)', state: 'FL' },
  { id: '77001', type: 'zipcode', name: '77001', displayName: '77001 (Houston, TX)', state: 'TX' },
  { id: '94102', type: 'zipcode', name: '94102', displayName: '94102 (San Francisco, CA)', state: 'CA' },
  { id: '60601', type: 'zipcode', name: '60601', displayName: '60601 (Chicago, IL)', state: 'IL' },
  { id: '85001', type: 'zipcode', name: '85001', displayName: '85001 (Phoenix, AZ)', state: 'AZ' },
  { id: '19101', type: 'zipcode', name: '19101', displayName: '19101 (Philadelphia, PA)', state: 'PA' },
  { id: '30301', type: 'zipcode', name: '30301', displayName: '30301 (Atlanta, GA)', state: 'GA' },
  { id: '78201', type: 'zipcode', name: '78201', displayName: '78201 (San Antonio, TX)', state: 'TX' },
];

const QUIZ_STEPS: QuizStep[] = [
  {
    id: 'primary-states',
    title: 'Primary Service States',
    description: 'Select the states where you want to provide your primary services. This helps us understand your main coverage area.',
    allowedTypes: ['state'],
    minSelections: 1,
    maxSelections: 5,
    completed: false,
    selectedLocations: []
  },
  {
    id: 'major-cities',
    title: 'Major Cities',
    description: 'Choose the major metropolitan areas where you want to focus your services. This helps target high-value markets.',
    allowedTypes: ['city'],
    minSelections: 2,
    maxSelections: 10,
    completed: false,
    selectedLocations: []
  },
  {
    id: 'specific-counties',
    title: 'Specific Counties',
    description: 'Select specific counties for more targeted coverage. This is optional but helps with precise service area definition.',
    allowedTypes: ['county'],
    minSelections: 0,
    maxSelections: 15,
    completed: false,
    selectedLocations: []
  },
  {
    id: 'zip-codes',
    title: 'High-Value ZIP Codes',
    description: 'Add specific ZIP codes for premium areas where you want to ensure coverage. Perfect for targeting affluent neighborhoods.',
    allowedTypes: ['zipcode'],
    minSelections: 0,
    maxSelections: 25,
    completed: false,
    selectedLocations: []
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

const STORAGE_KEY = 'quiz-location-chooser-progress';

export default function QuizLocationChooser({ 
  onComplete, 
  onStepSave,
  initialData,
  className = ''
}: QuizLocationChooserProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<QuizStep[]>(() => {
    // Initialize with saved data or initial data
    const savedData = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const dataToUse = savedData ? JSON.parse(savedData) : initialData;
    
    return QUIZ_STEPS.map(step => ({
      ...step,
      selectedLocations: dataToUse?.[step.id] || [],
      completed: dataToUse?.[step.id] ? dataToUse[step.id].length >= (step.minSelections || 0) : false
    }));
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Location['type'] | 'all'>('all');

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  // Save progress to localStorage
  const saveProgress = useCallback(() => {
    const progressData = steps.reduce((acc, step) => {
      acc[step.id] = step.selectedLocations;
      return acc;
    }, {} as { [key: string]: Location[] });
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData));
  }, [steps]);

  // Filter locations based on current step and search
  const filteredLocations = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    const allowedTypes = activeFilter === 'all' ? currentStep.allowedTypes : [activeFilter];
    
    return mockLocations
      .filter(location => allowedTypes.includes(location.type))
      .filter(location => 
        location.name.toLowerCase().includes(term) ||
        location.displayName.toLowerCase().includes(term) ||
        (location.state && location.state.toLowerCase().includes(term))
      )
      .filter(location => !currentStep.selectedLocations.some(selected => selected.id === location.id))
      .slice(0, 15);
  }, [searchTerm, currentStep, activeFilter]);

  // Quick suggestions based on step type
  const quickSuggestions = useMemo(() => {
    const allowedTypes = currentStep.allowedTypes;
    return mockLocations
      .filter(location => allowedTypes.includes(location.type))
      .filter(location => !currentStep.selectedLocations.some(selected => selected.id === location.id))
      .slice(0, 6);
  }, [currentStep]);

  const handleLocationSelect = (location: Location) => {
    if (currentStep.maxSelections && currentStep.selectedLocations.length >= currentStep.maxSelections) {
      return;
    }
    
    const newSelections = [...currentStep.selectedLocations, location];
    updateCurrentStep(newSelections);
    setSearchTerm('');
    setShowSuggestions(false);
  };

  const handleLocationRemove = (locationId: string) => {
    const newSelections = currentStep.selectedLocations.filter(loc => loc.id !== locationId);
    updateCurrentStep(newSelections);
  };

  const updateCurrentStep = (newSelections: Location[]) => {
    const updatedSteps = [...steps];
    updatedSteps[currentStepIndex] = {
      ...currentStep,
      selectedLocations: newSelections,
      completed: newSelections.length >= (currentStep.minSelections || 0)
    };
    setSteps(updatedSteps);
    
    // Save step progress
    onStepSave?.(currentStep.id, newSelections);
  };

  const handleNextStep = () => {
    saveProgress();
    if (isLastStep) {
      // Complete quiz
      const allSelections = steps.reduce((acc, step) => {
        acc[step.id] = step.selectedLocations;
        return acc;
      }, {} as { [stepId: string]: Location[] });
      onComplete(allSelections);
    } else {
      setCurrentStepIndex(prev => prev + 1);
      setSearchTerm('');
      setActiveFilter('all');
    }
  };

  const handlePreviousStep = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
      setSearchTerm('');
      setActiveFilter('all');
    }
  };

  const clearCurrentStep = () => {
    updateCurrentStep([]);
  };

  const canProceed = currentStep.selectedLocations.length >= (currentStep.minSelections || 0);
  const progressPercentage = ((currentStepIndex + (canProceed ? 1 : 0)) / steps.length) * 100;

  // Clear localStorage on component unmount if quiz completed
  useEffect(() => {
    return () => {
      saveProgress();
    };
  }, [saveProgress]);

  return (
    <div className={`max-w-4xl mx-auto space-y-6 ${className}`}>
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-gray-700">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <span className="text-gray-500">
            {Math.round(progressPercentage)}% Complete
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
          <button
            key={step.id}
            onClick={() => setCurrentStepIndex(index)}
            className={`flex-shrink-0 flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              index === currentStepIndex
                ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                : index < currentStepIndex
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-150'
            }`}
          >
            {step.completed && index !== currentStepIndex && (
              <Check className="h-4 w-4" />
            )}
            <span>{step.title}</span>
          </button>
        ))}
      </div>

      {/* Main Content Card */}
      <Card className="p-6">
        {/* Step Header */}
        <div className="space-y-3 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{currentStep.title}</h2>
          <p className="text-gray-600">{currentStep.description}</p>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            {currentStep.minSelections && (
              <span>Minimum: {currentStep.minSelections}</span>
            )}
            {currentStep.maxSelections && (
              <span>Maximum: {currentStep.maxSelections}</span>
            )}
            <span className="flex items-center space-x-1">
              <span>Allowed:</span>
              {currentStep.allowedTypes.map(type => {
                const IconComponent = getLocationIcon(type);
                return (
                  <IconComponent key={type} className="h-4 w-4" />
                );
              })}
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={`Search for ${currentStep.allowedTypes.join(', ')}...`}
              className="pl-10 pr-4 h-12 text-base"
            />
          </div>

          {/* Filter Buttons */}
          {currentStep.allowedTypes.length > 1 && (
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
              {currentStep.allowedTypes.map(type => {
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
                    <span>{type === 'zipcode' ? 'ZIP Codes' : `${type}s`}</span>
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        {/* Search Results */}
        {showSuggestions && searchTerm && (
          <div className="mb-6 border rounded-lg shadow-lg bg-white max-h-64 overflow-y-auto">
            {filteredLocations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No locations found for "{searchTerm}"
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

        {/* Quick Suggestions */}
        {!searchTerm && quickSuggestions.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Add Popular Options:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {quickSuggestions.map((location) => {
                const IconComponent = getLocationIcon(location.type);
                return (
                  <button
                    key={location.id}
                    onClick={() => handleLocationSelect(location)}
                    disabled={currentStep.maxSelections ? currentStep.selectedLocations.length >= currentStep.maxSelections : false}
                    className={`p-3 border rounded-lg text-left hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 ${getLocationColor(location.type)}`}
                  >
                    <IconComponent className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{location.displayName}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Locations */}
        {currentStep.selectedLocations.length > 0 && (
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-gray-900">
                Selected Locations ({currentStep.selectedLocations.length})
                {currentStep.maxSelections && (
                  <span className="text-gray-500"> / {currentStep.maxSelections}</span>
                )}
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={clearCurrentStep}
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-800"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Clear All</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentStep.selectedLocations.map((location) => {
                const IconComponent = getLocationIcon(location.type);
                return (
                  <div
                    key={location.id}
                    className={`p-3 rounded-lg border-2 transition-all ${getLocationColor(location.type)} flex items-center justify-between`}
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <IconComponent className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{location.displayName}</span>
                    </div>
                    <button
                      onClick={() => handleLocationRemove(location.id)}
                      className="ml-2 p-1 hover:bg-black/10 rounded-full transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step Status */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              {canProceed ? (
                <div className="flex items-center space-x-2 text-green-700">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Step Requirements Met!</span>
                </div>
              ) : (
                <div className="text-gray-600">
                  <span className="font-medium">
                    {currentStep.minSelections 
                      ? `Select at least ${currentStep.minSelections - currentStep.selectedLocations.length} more location${currentStep.minSelections - currentStep.selectedLocations.length !== 1 ? 's' : ''}`
                      : 'This step is optional'
                    }
                  </span>
                </div>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {currentStep.selectedLocations.length} selected
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
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
            disabled={!canProceed && Boolean(currentStep.minSelections && currentStep.minSelections > 0)}
            className="flex items-center space-x-2"
          >
            <span>{isLastStep ? 'Complete Quiz' : 'Next Step'}</span>
            {!isLastStep && <ChevronRight className="h-4 w-4" />}
            {isLastStep && <Check className="h-4 w-4" />}
          </Button>
        </div>
      </Card>

      {/* Overall Progress Summary */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-blue-900">Quiz Progress</h4>
            <p className="text-sm text-blue-700">
              {steps.filter(s => s.completed).length} of {steps.length} steps completed
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-700">
              Total selections: {steps.reduce((acc, step) => acc + step.selectedLocations.length, 0)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}