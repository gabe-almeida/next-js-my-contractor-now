'use client';

import { useState } from 'react';
import ServiceLocationQuizSimple from '@/components/contractor-signup/ServiceLocationQuizSimple';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RotateCcw, MapPin, Briefcase } from 'lucide-react';

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
  locations: Location[];
}

type QuizPhase = 'quiz' | 'completed';

export default function ServiceLocationQuizDemo() {
  const [currentPhase, setCurrentPhase] = useState<QuizPhase>('quiz');
  const [quizData, setQuizData] = useState<{
    selectedServices: ServiceType[];
    serviceLocationMappings: ServiceLocationMapping[];
  }>({ selectedServices: [], serviceLocationMappings: [] });

  const handleQuizComplete = (data: {
    selectedServices: ServiceType[];
    serviceLocationMappings: ServiceLocationMapping[];
  }) => {
    setQuizData(data);
    setCurrentPhase('completed');
    console.log('Service-Location configuration completed:', data);
    
    // Here you would typically send the data to your backend
    // Example API call:
    // await fetch('/api/contractors/service-location-config', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(data)
    // });
  };

  const handleStepSave = (stepId: string, data: any) => {
    console.log(`Step ${stepId} saved:`, data);
  };

  const handleReset = () => {
    setCurrentPhase('quiz');
    setQuizData({ selectedServices: [], serviceLocationMappings: [] });
    // Clear localStorage
    localStorage.removeItem('service-location-quiz-progress');
  };

  const totalServices = quizData.selectedServices.length;
  const totalLocations = quizData.serviceLocationMappings.reduce(
    (sum, mapping) => sum + Object.values(mapping.locations).flat().length,
    0
  );

  if (currentPhase === 'completed') {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <Card className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Briefcase className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Service Configuration Complete!</h1>
              <p className="text-gray-600 mt-2">
                Your service offerings and coverage areas have been successfully configured. You can now start receiving leads.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-blue-800">
                  <div className="font-medium">Services Configured:</div>
                  <div className="text-sm mt-1">{totalServices} services</div>
                  <div className="text-xs mt-2">
                    {quizData.selectedServices.map(s => s.displayName).join(', ')}
                  </div>
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-green-800">
                  <div className="font-medium">Total Locations:</div>
                  <div className="text-sm mt-1">{totalLocations} locations</div>
                  <div className="text-xs mt-2">
                    Across all selected services
                  </div>
                </div>
              </div>
            </div>
            
            {/* Service Details */}
            <div className="text-left space-y-3">
              <h3 className="font-medium text-gray-900 text-center">Service Breakdown:</h3>
              {quizData.serviceLocationMappings.map(mapping => {
                const service = quizData.selectedServices.find(s => s.id === mapping.serviceId);
                const locationCount = Object.values(mapping.locations).flat().length;
                return (
                  <div key={mapping.serviceId} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{service?.icon}</span>
                      <span className="font-medium">{service?.displayName}</span>
                    </div>
                    <span className="text-sm text-gray-600">{locationCount} locations</span>
                  </div>
                );
              })}
            </div>
            
            <Button onClick={handleReset} className="w-full">
              Try Again
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Service & Location Configurator</h1>
          <p className="text-lg text-gray-600 mt-2">
            Complete contractor onboarding: select services, then configure location coverage for each service type
          </p>
          <div className="flex justify-center mt-4 space-x-4">
            <div className="text-sm text-gray-500">
              Services: <span className="font-medium">{totalServices}</span>
            </div>
            <div className="text-sm text-gray-500">
              Locations: <span className="font-medium">{totalLocations}</span>
            </div>
          </div>
        </div>

        {/* Demo Controls */}
        <div className="mb-6 flex justify-center">
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex items-center space-x-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset Demo</span>
          </Button>
        </div>

        {/* Main Content */}
        {currentPhase === 'quiz' && (
          <ServiceLocationQuizSimple
            onComplete={handleQuizComplete}
            onStepSave={handleStepSave}
          />
        )}

        {/* Features List */}
        <div className="mt-12 max-w-4xl mx-auto">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Key Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Service type selection with categories</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Per-service location configuration</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Auto-save progress to localStorage</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Smart search with type filtering</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Visual differentiation by location type</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span>Service-to-service navigation</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <span>Comprehensive configuration review</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                  <span>Realistic contractor onboarding flow</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Development Notes */}
        <div className="mt-8 max-w-4xl mx-auto">
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">Development Notes</h2>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                <strong>Database Schema:</strong> Uses existing BuyerServiceZipCode table with ZIP-only storage for optimal performance.
              </p>
              <p>
                <strong>Service-First Approach:</strong> Contractors select services first, then configure locations for each service independently.
              </p>
              <p>
                <strong>Realistic Data Model:</strong> Each service type can have different location coverage, matching real-world contractor operations.
              </p>
              <p>
                <strong>Auto-Save Progress:</strong> All selections automatically saved to localStorage with session recovery.
              </p>
              <p>
                <strong>API Ready:</strong> Data structure designed for easy backend integration with contractor management systems.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}