'use client';

import { useMemo } from 'react';
import { MapPin, Building2, Map, Hash, Check, FileText, Download, Edit, Trash2, Zap, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { 
  expandServiceLocationsToZipCodes,
  getExpansionSummary,
  type ExpandedServiceMapping,
  type ServiceLocationMapping
} from '@/lib/services/location-expansion';

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

interface ServiceLocationSummaryExpandedProps {
  selectedServices: ServiceType[];
  serviceLocationMappings: ServiceLocationMapping[];
  onEdit?: () => void;
  onExport?: () => void;
  onClear?: () => void;
  onConfirm: (data: { 
    selectedServices: ServiceType[];
    expandedMappings: ExpandedServiceMapping[];
    originalMappings: ServiceLocationMapping[];
  }) => void;
  className?: string;
}

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

export default function ServiceLocationSummaryExpanded({
  selectedServices,
  serviceLocationMappings,
  onEdit,
  onExport,
  onClear,
  onConfirm,
  className = ''
}: ServiceLocationSummaryExpandedProps) {
  // Expand all location mappings to ZIP codes
  const expandedMappings = useMemo(() => {
    return expandServiceLocationsToZipCodes(serviceLocationMappings);
  }, [serviceLocationMappings]);

  // Get summary statistics
  const summary = useMemo(() => {
    return getExpansionSummary(expandedMappings);
  }, [expandedMappings]);

  const handleExportData = () => {
    const exportData = {
      selectedServices,
      originalSelections: serviceLocationMappings,
      expandedMappings,
      summary,
      exportedAt: new Date().toISOString(),
      totalZipCodes: summary.totalUniqueZipCodes
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `contractor-service-areas-${new Date().toISOString().split('T')[0]}.json`;
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
            Review your service coverage areas. All locations have been converted to ZIP codes for precise targeting.
          </p>
        </div>
      </div>

      {/* Expansion Summary Card */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Zap className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">ZIP Code Expansion Summary</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.totalServices}</div>
              <div className="text-sm text-gray-600">Services</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.totalUniqueZipCodes}</div>
              <div className="text-sm text-gray-600">Total ZIP Codes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{summary.averageZipsPerService}</div>
              <div className="text-sm text-gray-600">Avg per Service</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {summary.expansionBreakdown.fromStates + summary.expansionBreakdown.fromCities + summary.expansionBreakdown.fromCounties}
              </div>
              <div className="text-sm text-gray-600">From Areas</div>
            </div>
          </div>

          {/* Expansion Breakdown */}
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm font-medium text-gray-700 mb-2">Expansion Breakdown:</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center space-x-2">
                <Map className="h-4 w-4 text-blue-500" />
                <span>States: {summary.expansionBreakdown.fromStates}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-green-500" />
                <span>Cities: {summary.expansionBreakdown.fromCities}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-purple-500" />
                <span>Counties: {summary.expansionBreakdown.fromCounties}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Hash className="h-4 w-4 text-orange-500" />
                <span>Direct ZIPs: {summary.expansionBreakdown.directZipCodes}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Service Breakdown */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Service Coverage Details</h2>
        
        {expandedMappings.map(expandedMapping => {
          const service = selectedServices.find(s => s.id === expandedMapping.serviceId);
          const originalMapping = serviceLocationMappings.find(m => m.serviceId === expandedMapping.serviceId);
          
          if (!service || !originalMapping) return null;
          
          return (
            <Card key={expandedMapping.serviceId} className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{service.icon}</span>
                    <div>
                      <h3 className="text-lg font-medium text-gray-800">{service.displayName}</h3>
                      <p className="text-sm text-gray-600">
                        {expandedMapping.summary.totalZipCodes} ZIP codes configured
                      </p>
                    </div>
                  </div>
                  
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {expandedMapping.zipCodes.length} ZIPs
                  </Badge>
                </div>

                {/* Original Selections */}
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-700">Original Selections:</div>
                  
                  {Object.entries(originalMapping.locations).map(([locationType, locations]) => {
                    if (locations.length === 0) return null;
                    
                    const displayType = locationType === 'zipCodes' ? 'ZIP Codes' : 
                      locationType.charAt(0).toUpperCase() + locationType.slice(1);
                    
                    return (
                      <div key={locationType} className="space-y-2">
                        <div className="text-xs font-medium text-gray-600">{displayType} ({locations.length})</div>
                        <div className="flex flex-wrap gap-2">
                          {locations.map((location) => {
                            const IconComponent = getLocationIcon(location.type);
                            // Calculate ZIP count for this specific location
                            const locationZipCount = location.type === 'zipcode' ? 1 : 
                              location.type === 'state' ? Math.floor(expandedMapping.summary.fromStates / originalMapping.locations.states.length) :
                              location.type === 'city' ? Math.floor(expandedMapping.summary.fromCities / originalMapping.locations.cities.length) :
                              Math.floor(expandedMapping.summary.fromCounties / originalMapping.locations.counties.length);
                            
                            return (
                              <div
                                key={location.id}
                                className={`flex items-center space-x-1 px-3 py-1 rounded-lg border ${getLocationColor(location.type)}`}
                              >
                                <IconComponent className="h-3 w-3" />
                                <span className="text-xs font-medium">{location.displayName}</span>
                                {location.type !== 'zipcode' && (
                                  <Badge variant="secondary" className="text-xs ml-1">
                                    →{locationZipCount}
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ZIP Code Preview */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-700">Generated ZIP Codes:</div>
                    <div className="text-xs text-gray-500">
                      Showing first 10 of {expandedMapping.zipCodes.length}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {expandedMapping.zipCodes.slice(0, 10).map(zipCode => (
                      <Badge key={zipCode} variant="outline" className="text-xs">
                        {zipCode}
                      </Badge>
                    ))}
                    {expandedMapping.zipCodes.length > 10 && (
                      <Badge variant="outline" className="text-xs">
                        +{expandedMapping.zipCodes.length - 10} more
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

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
            onClick={() => onConfirm({
              selectedServices,
              expandedMappings,
              originalMappings: serviceLocationMappings
            })}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700"
          >
            <Check className="h-5 w-5" />
            <span>Save ZIP Code Configuration</span>
          </Button>
        </div>
      </div>

      {/* Technical Info */}
      <Card className="p-4 bg-yellow-50 border-yellow-200">
        <div className="flex items-start space-x-3">
          <Eye className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <div className="font-medium mb-1">How Location Expansion Works:</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>Your visual selections (states, cities, counties) are automatically converted to specific ZIP codes</li>
              <li>This ensures precise lead targeting while maintaining the convenience of broad area selection</li>
              <li>The database stores only ZIP codes, making queries fast and efficient</li>
              <li>You can modify these areas anytime, and the ZIP codes will be automatically updated</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}