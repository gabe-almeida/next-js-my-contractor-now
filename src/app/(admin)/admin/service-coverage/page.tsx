'use client';

/**
 * Service Coverage Dashboard Page
 *
 * WHY: Provides visibility into buyer service area coverage and zip code mappings.
 * WHEN: Admin needs to analyze geographic coverage across services and buyers.
 * HOW: Fetches real data from API and displays in consistent UI components.
 */

import { useState, useEffect } from 'react';
import { AdminPageHeader, AdminSection, AdminStatGrid, StatusBadge } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import {
  MapPin,
  Target,
  Building,
  Search,
  Download,
  CheckCircle2,
  Eye
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ServiceCoverageData {
  serviceTypeId: string;
  serviceName: string;
  totalZipCodes: number;
  activeZipCodes: number;
  totalBuyers: number;
  activeBuyers: number;
  topZipCodes: Array<{
    zipCode: string;
    buyerCount: number;
    avgPriority: number;
  }>;
}

interface BuyerCoverageData {
  buyerId: string;
  buyerName: string;
  totalZipCodes: number;
  activeZipCodes: number;
  serviceCount: number;
  lastUpdated: Date;
}

export default function ServiceCoveragePage() {
  const router = useRouter();
  const [serviceCoverageData, setServiceCoverageData] = useState<ServiceCoverageData[]>([]);
  const [buyerCoverageData, setBuyerCoverageData] = useState<BuyerCoverageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'services' | 'buyers'>('services');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real coverage data from API
  useEffect(() => {
    const fetchCoverageData = async () => {
      try {
        setLoading(true);

        // Fetch service zones analytics from real API
        const [analyticsResponse, buyersResponse, servicesResponse] = await Promise.all([
          fetch('/api/admin/service-zones/analytics', {
            headers: {
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
            }
          }),
          fetch('/api/admin/buyers?includeInactive=true', {
            headers: {
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
            }
          }),
          fetch('/api/service-types?includeInactive=true', {
            headers: {
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
            }
          })
        ]);

        // Process service types with zone data
        const servicesData = servicesResponse.ok ? await servicesResponse.json() : { data: [] };
        const buyersData = buyersResponse.ok ? await buyersResponse.json() : { data: { buyers: [] } };
        const analyticsData = analyticsResponse.ok ? await analyticsResponse.json() : { data: null };

        // Build service coverage from service types
        const serviceList = servicesData.data || [];
        const serviceCoverage: ServiceCoverageData[] = serviceList.map((service: any) => ({
          serviceTypeId: service.id,
          serviceName: service.displayName || service.name,
          totalZipCodes: analyticsData.data?.summary?.totalZipCodes || 0,
          activeZipCodes: analyticsData.data?.summary?.activeZipCodes || 0,
          totalBuyers: (buyersData.data?.buyers || []).length,
          activeBuyers: (buyersData.data?.buyers || []).filter((b: any) => b.active).length,
          topZipCodes: (analyticsData.data?.performance?.topZipCodes || []).slice(0, 3).map((z: any) => ({
            zipCode: z.zipCode,
            buyerCount: 1,
            avgPriority: z.priority || 50
          }))
        }));

        // Build buyer coverage data
        const buyers = buyersData.data?.buyers || [];
        const buyerCoverage: BuyerCoverageData[] = buyers.map((buyer: any) => ({
          buyerId: buyer.id,
          buyerName: buyer.displayName || buyer.name,
          totalZipCodes: buyer.zipCodeCount || 0,
          activeZipCodes: buyer.zipCodeCount || 0,
          serviceCount: buyer.serviceConfigCount || 0,
          lastUpdated: new Date(buyer.updatedAt || Date.now())
        }));

        setServiceCoverageData(serviceCoverage);
        setBuyerCoverageData(buyerCoverage);

      } catch (error) {
        console.error('Error fetching coverage data:', error);
        setServiceCoverageData([]);
        setBuyerCoverageData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCoverageData();
  }, []);

  // Calculate overall statistics
  const totalUniqueZipCodes = new Set(
    serviceCoverageData.flatMap(service => 
      service.topZipCodes.map(zip => zip.zipCode)
    )
  ).size;

  const totalServiceZipPairs = serviceCoverageData.reduce(
    (sum, service) => sum + service.totalZipCodes, 0
  );

  const totalActiveServiceZipPairs = serviceCoverageData.reduce(
    (sum, service) => sum + service.activeZipCodes, 0
  );

  const avgCoverageRate = totalServiceZipPairs > 0 
    ? Math.round((totalActiveServiceZipPairs / totalServiceZipPairs) * 100)
    : 0;

  // Filter data based on search
  const filteredServiceData = serviceCoverageData.filter(service =>
    service.serviceName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBuyerData = buyerCoverageData.filter(buyer =>
    buyer.buyerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Export functionality
  const handleExport = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      serviceCoverage: serviceCoverageData,
      buyerCoverage: buyerCoverageData,
      statistics: {
        totalUniqueZipCodes,
        totalServiceZipPairs,
        totalActiveServiceZipPairs,
        avgCoverageRate
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `service-coverage-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Statistics for AdminStatGrid
  const stats = [
    {
      label: 'Total Coverage',
      value: totalServiceZipPairs.toLocaleString(),
      description: 'Service-zip combinations',
      icon: MapPin,
    },
    {
      label: 'Active Coverage',
      value: totalActiveServiceZipPairs.toLocaleString(),
      description: `${avgCoverageRate}% active rate`,
      icon: CheckCircle2,
      accentColor: 'emerald' as const,
    },
    {
      label: 'Unique Zip Codes',
      value: totalUniqueZipCodes.toLocaleString(),
      description: 'Geographic areas served',
      icon: Target,
      accentColor: 'orange' as const,
    },
    {
      label: 'Active Buyers',
      value: buyerCoverageData.length.toString(),
      description: 'Lead buyer partners',
      icon: Building,
      accentColor: 'blue' as const,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        title="Service Coverage Dashboard"
        description="Overview of buyer service area coverage and zip code mappings"
        actions={
          <Button
            onClick={handleExport}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        }
      />

      {/* Statistics Cards */}
      <AdminStatGrid stats={stats} />

      {/* View Toggle and Search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={selectedView === 'services' ? 'default' : 'outline'}
            onClick={() => setSelectedView('services')}
            size="sm"
            className={selectedView === 'services' ? 'bg-orange-500 hover:bg-orange-600' : ''}
          >
            By Service
          </Button>
          <Button
            variant={selectedView === 'buyers' ? 'default' : 'outline'}
            onClick={() => setSelectedView('buyers')}
            size="sm"
            className={selectedView === 'buyers' ? 'bg-orange-500 hover:bg-orange-600' : ''}
          >
            By Buyer
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${selectedView}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
          />
        </div>
      </div>

      {/* Service Coverage View */}
      {selectedView === 'services' && (
        <div className="space-y-4">
          {filteredServiceData.map((service) => {
            const coverageRate = service.totalZipCodes > 0
              ? Math.round((service.activeZipCodes / service.totalZipCodes) * 100)
              : 0;

            return (
              <div key={service.serviceTypeId} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-50 rounded-lg">
                        <Target className="h-5 w-5 text-orange-600" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900">{service.serviceName}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {service.totalBuyers} buyers
                      </span>
                      <StatusBadge status={coverageRate >= 90 ? 'ACTIVE' : coverageRate >= 50 ? 'PENDING' : 'INACTIVE'} />
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Coverage Stats */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700">Coverage Statistics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total Zip Codes:</span>
                          <span className="font-medium text-gray-900">{service.totalZipCodes.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Active Coverage:</span>
                          <span className="font-medium text-emerald-600">{service.activeZipCodes.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Active Buyers:</span>
                          <span className="font-medium text-gray-900">{service.activeBuyers} of {service.totalBuyers}</span>
                        </div>
                      </div>
                    </div>

                    {/* Top Zip Codes */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700">Most Competitive Zip Codes</h4>
                      <div className="space-y-2">
                        {service.topZipCodes.map((zipData) => (
                          <div key={zipData.zipCode} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-gray-400" />
                              <span className="font-mono text-gray-900">{zipData.zipCode}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-500">{zipData.buyerCount} buyers</span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                zipData.avgPriority >= 7 ? 'bg-emerald-50 text-emerald-700' :
                                zipData.avgPriority >= 5 ? 'bg-amber-50 text-amber-700' :
                                'bg-red-50 text-red-700'
                              }`}>
                                {Number(zipData.avgPriority || 0).toFixed(1)} avg
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Buyer Coverage View */}
      {selectedView === 'buyers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredBuyerData.map((buyer) => {
            const coverageRate = buyer.totalZipCodes > 0
              ? Math.round((buyer.activeZipCodes / buyer.totalZipCodes) * 100)
              : 0;

            return (
              <div key={buyer.buyerId} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-50 rounded-lg">
                        <Building className="h-5 w-5 text-orange-600" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900">{buyer.buyerName}</h3>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/buyers/${buyer.buyerId}/zip-codes`)}
                      className="gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </Button>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <div className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">
                          {buyer.totalZipCodes.toLocaleString()}
                        </div>
                        <div className="text-sm text-orange-700">Total Zip Codes</div>
                      </div>
                      <div className="text-center p-3 bg-emerald-50 rounded-lg">
                        <div className="text-2xl font-bold text-emerald-600">
                          {buyer.activeZipCodes.toLocaleString()}
                        </div>
                        <div className="text-sm text-emerald-700">Active Coverage</div>
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Services Configured:</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {buyer.serviceCount} services
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Coverage Rate:</span>
                        <span className="font-medium text-gray-900">{coverageRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Last Updated:</span>
                        <span className="text-gray-600">{buyer.lastUpdated.toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty States */}
      {selectedView === 'services' && filteredServiceData.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-12 text-center">
          <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No services found
          </h3>
          <p className="text-sm text-gray-500">
            {searchQuery ? 'No services match your search criteria.' : 'No service coverage data available.'}
          </p>
        </div>
      )}

      {selectedView === 'buyers' && filteredBuyerData.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-12 text-center">
          <Building className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No buyers found
          </h3>
          <p className="text-sm text-gray-500">
            {searchQuery ? 'No buyers match your search criteria.' : 'No buyer coverage data available.'}
          </p>
        </div>
      )}
    </div>
  );
}