'use client';

import { useMemo } from 'react';
import { MapPin, Building2, Map, Hash, Check, FileText, Download, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

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

interface QuizLocationSummaryProps {
  selections: { [stepId: string]: Location[] };
  onEdit?: () => void;
  onExport?: () => void;
  onClear?: () => void;
  onConfirm: (data: { [stepId: string]: Location[] }) => void;
  className?: string;
}

const STEP_LABELS: { [key: string]: string } = {
  'primary-states': 'Primary Service States',
  'major-cities': 'Major Cities',
  'specific-counties': 'Specific Counties',
  'zip-codes': 'High-Value ZIP Codes'
};

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

export default function QuizLocationSummary({
  selections,
  onEdit,
  onExport,
  onClear,
  onConfirm,
  className = ''
}: QuizLocationSummaryProps) {
  // Calculate summary statistics
  const summary = useMemo(() => {
    const allLocations = Object.values(selections).flat();
    return {
      total: allLocations.length,
      states: allLocations.filter(l => l.type === 'state').length,
      cities: allLocations.filter(l => l.type === 'city').length,
      counties: allLocations.filter(l => l.type === 'county').length,
      zipCodes: allLocations.filter(l => l.type === 'zipcode').length
    };
  }, [selections]);

  // Group locations by state for better organization
  const locationsByState = useMemo(() => {
    const allLocations = Object.values(selections).flat();
    const grouped: { [state: string]: Location[] } = {};
    
    allLocations.forEach(location => {
      const state = location.state || location.name;
      if (!grouped[state]) {
        grouped[state] = [];
      }
      grouped[state].push(location);
    });
    
    return grouped;
  }, [selections]);

  const handleExportData = () => {
    const exportData = {
      summary,
      selections,
      exportedAt: new Date().toISOString(),
      totalCoverage: `${summary.states} states, ${summary.cities} cities, ${summary.counties} counties, ${summary.zipCodes} ZIP codes`
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `service-locations-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    onExport?.();
  };

  return (
    <div className={`max-w-4xl mx-auto space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Service Area Configuration Complete!</h1>
          <p className="text-lg text-gray-600 mt-2">
            Review your selected service locations below and confirm to save your configuration.
          </p>
        </div>
      </div>

      {/* Summary Stats Card */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Coverage Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.states}</div>
              <div className="text-sm text-gray-600">States</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.cities}</div>
              <div className="text-sm text-gray-600">Cities</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{summary.counties}</div>
              <div className="text-sm text-gray-600">Counties</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{summary.zipCodes}</div>
              <div className="text-sm text-gray-600">ZIP Codes</div>
            </div>
          </div>
          <div className="text-lg font-medium text-gray-700">
            Total Locations: <span className="text-blue-600">{summary.total}</span>
          </div>
        </div>
      </Card>

      {/* Detailed Breakdown by Step */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Selection Details</h2>
        
        {Object.entries(selections).map(([stepId, locations]) => {
          if (locations.length === 0) return null;
          
          return (
            <Card key={stepId} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-800">
                    {STEP_LABELS[stepId] || stepId}
                  </h3>
                  <Badge variant="secondary" className="bg-gray-100">
                    {locations.length} location{locations.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {locations.map((location) => {
                    const IconComponent = getLocationIcon(location.type);
                    return (
                      <div
                        key={location.id}
                        className={`p-3 rounded-lg border-2 ${getLocationColor(location.type)} flex items-center space-x-2`}
                      >
                        <IconComponent className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{location.displayName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Geographic Organization */}
      {Object.keys(locationsByState).length > 1 && (
        <Card className="p-4">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Coverage by State</h3>
          <div className="space-y-3">
            {Object.entries(locationsByState)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([state, locations]) => (
                <div key={state} className="border-l-4 border-blue-200 pl-4">
                  <div className="font-medium text-gray-700 mb-2">{state}</div>
                  <div className="flex flex-wrap gap-2">
                    {locations.map((location) => {
                      const IconComponent = getLocationIcon(location.type);
                      return (
                        <Badge
                          key={location.id}
                          variant="secondary"
                          className={`${getLocationColor(location.type)} flex items-center space-x-1`}
                        >
                          <IconComponent className="h-3 w-3" />
                          <span>{location.name}</span>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-col sm:flex-row gap-2">
          {onEdit && (
            <Button
              variant="outline"
              onClick={onEdit}
              className="flex items-center space-x-2"
            >
              <Edit className="h-4 w-4" />
              <span>Edit Selections</span>
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={handleExportData}
            className="flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export Data</span>
          </Button>
          
          {onClear && (
            <Button
              variant="outline"
              onClick={onClear}
              className="flex items-center space-x-2 text-red-600 hover:text-red-700 hover:border-red-300"
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear All</span>
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            size="lg"
            onClick={() => onConfirm(selections)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
          >
            <Check className="h-5 w-5" />
            <span>Confirm & Continue</span>
          </Button>
        </div>
      </div>

      {/* Additional Info */}
      <Card className="p-4 bg-yellow-50 border-yellow-200">
        <div className="flex items-start space-x-3">
          <FileText className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <div className="font-medium mb-1">Important Notes:</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>Your selections will be used to configure your service area and lead routing.</li>
              <li>You can modify these locations later in your account settings.</li>
              <li>More specific locations (ZIP codes) take priority over broader areas (states).</li>
              <li>Ensure your selections align with your actual service capabilities.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}