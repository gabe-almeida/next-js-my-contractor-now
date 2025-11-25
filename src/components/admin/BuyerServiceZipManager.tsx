'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ServiceZipMapping } from './ServiceZipMapping';
import { ZipCodeManagement } from './ZipCodeManagement';
import { 
  Plus, 
  Settings, 
  Download, 
  Upload, 
  Search,
  Filter,
  MapPin,
  Target,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';

export interface ZipCodeMapping {
  id: string;
  zipCode: string;
  active: boolean;
  priority: number;
  maxLeadsPerDay: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceZipData {
  serviceTypeId: string;
  serviceName?: string;
  zipCodes: ZipCodeMapping[];
}

export interface BuyerServiceZipManagerProps {
  buyerId: string;
  buyerName: string;
  services: Array<{
    id: string;
    name: string;
    displayName: string;
  }>;
  onUpdate?: () => void;
  loading?: boolean;
}

export function BuyerServiceZipManager({ 
  buyerId, 
  buyerName, 
  services,
  onUpdate,
  loading = false
}: BuyerServiceZipManagerProps) {
  const [serviceZipData, setServiceZipData] = useState<ServiceZipData[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch zip code data
  const fetchZipCodes = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/buyers/${buyerId}/zip-codes`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch zip codes');
      }

      if (data.success) {
        // Enhance with service names
        const enhancedData = data.data.map((serviceData: ServiceZipData) => ({
          ...serviceData,
          serviceName: services.find(s => s.id === serviceData.serviceTypeId)?.displayName || 'Unknown Service'
        }));

        setServiceZipData(enhancedData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching zip codes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (buyerId && services.length > 0) {
      fetchZipCodes();
    }
  }, [buyerId, services]);

  // Handle zip code operations
  const handleZipCodeAdded = async () => {
    await fetchZipCodes();
    onUpdate?.();
  };

  const handleZipCodeUpdated = async () => {
    await fetchZipCodes();
    onUpdate?.();
  };

  const handleZipCodeDeleted = async () => {
    await fetchZipCodes();
    onUpdate?.();
  };

  // Export zip codes
  const handleExport = () => {
    const exportData = serviceZipData.flatMap(serviceData => 
      serviceData.zipCodes.map(zip => ({
        serviceName: serviceData.serviceName,
        serviceTypeId: serviceData.serviceTypeId,
        zipCode: zip.zipCode,
        active: zip.active,
        priority: zip.priority,
        maxLeadsPerDay: zip.maxLeadsPerDay,
        createdAt: zip.createdAt,
      }))
    );

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${buyerName}-zip-codes-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filter zip codes based on search and active status
  const filteredServiceData = serviceZipData.map(serviceData => ({
    ...serviceData,
    zipCodes: serviceData.zipCodes.filter(zip => {
      const matchesSearch = searchQuery === '' || 
        zip.zipCode.includes(searchQuery) ||
        serviceData.serviceName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = filterActive === null || zip.active === filterActive;
      
      return matchesSearch && matchesFilter;
    })
  })).filter(serviceData => serviceData.zipCodes.length > 0);

  // Calculate statistics
  const totalZipCodes = serviceZipData.reduce((sum, service) => sum + service.zipCodes.length, 0);
  const activeZipCodes = serviceZipData.reduce((sum, service) => 
    sum + service.zipCodes.filter(z => z.active).length, 0
  );
  const servicesWithZipCodes = serviceZipData.filter(s => s.zipCodes.length > 0).length;

  if (loading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Zip Code Management
          </h2>
          <p className="text-gray-500">
            Manage service area coverage for {buyerName}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={totalZipCodes === 0}
            className="flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>

          <Button
            onClick={() => setShowManagementModal(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Zip Codes</span>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Zip Codes</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalZipCodes}</div>
            <p className="text-xs text-muted-foreground">
              Across all services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Coverage</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeZipCodes}</div>
            <p className="text-xs text-muted-foreground">
              {totalZipCodes > 0 ? Math.round((activeZipCodes / totalZipCodes) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Services Covered</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{servicesWithZipCodes}</div>
            <p className="text-xs text-muted-foreground">
              Of {services.length} total services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Areas</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalZipCodes - activeZipCodes}
            </div>
            <p className="text-xs text-muted-foreground">
              Paused coverage areas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search zip codes or services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={filterActive === null ? 'all' : filterActive ? 'active' : 'inactive'}
            onChange={(e) => {
              const value = e.target.value;
              setFilterActive(
                value === 'all' ? null : value === 'active'
              );
            }}
            className="border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error loading zip codes</span>
            </div>
            <p className="text-red-700 mt-2">{error}</p>
            <Button
              variant="outline"
              onClick={fetchZipCodes}
              className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Service Zip Mappings */}
      {!error && (
        <div className="space-y-6">
          {filteredServiceData.length > 0 ? (
            filteredServiceData.map((serviceData) => (
              <ServiceZipMapping
                key={serviceData.serviceTypeId}
                serviceData={serviceData}
                onUpdate={handleZipCodeUpdated}
                onDelete={handleZipCodeDeleted}
                buyerId={buyerId}
              />
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchQuery || filterActive !== null ? 'No zip codes match your filters' : 'No zip codes configured'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery || filterActive !== null 
                    ? 'Try adjusting your search or filter criteria' 
                    : 'Start by adding zip codes to define this buyer\'s service areas'
                  }
                </p>
                {!searchQuery && filterActive === null && (
                  <Button
                    onClick={() => setShowManagementModal(true)}
                    className="flex items-center space-x-2 mx-auto"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Your First Zip Codes</span>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Zip Code Management Modal */}
      {showManagementModal && (
        <ZipCodeManagement
          buyerId={buyerId}
          buyerName={buyerName}
          services={services}
          onClose={() => setShowManagementModal(false)}
          onSuccess={handleZipCodeAdded}
        />
      )}
    </div>
  );
}