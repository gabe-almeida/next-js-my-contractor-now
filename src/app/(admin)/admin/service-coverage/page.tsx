'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  MapPin,
  Target,
  Users,
  Building,
  Activity,
  Search,
  Filter,
  Download,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Edit
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

  // Mock data - in production this would come from API
  useEffect(() => {
    const fetchCoverageData = async () => {
      try {
        setLoading(true);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock service coverage data
        const mockServiceData: ServiceCoverageData[] = [
          {
            serviceTypeId: 'service-1',
            serviceName: 'Windows Installation',
            totalZipCodes: 1247,
            activeZipCodes: 1189,
            totalBuyers: 8,
            activeBuyers: 7,
            topZipCodes: [
              { zipCode: '90210', buyerCount: 5, avgPriority: 7.2 },
              { zipCode: '10001', buyerCount: 4, avgPriority: 6.8 },
              { zipCode: '60601', buyerCount: 6, avgPriority: 8.1 },
            ]
          },
          {
            serviceTypeId: 'service-2',
            serviceName: 'Bathroom Remodeling',
            totalZipCodes: 892,
            activeZipCodes: 834,
            totalBuyers: 6,
            activeBuyers: 5,
            topZipCodes: [
              { zipCode: '90210', buyerCount: 3, avgPriority: 6.5 },
              { zipCode: '77001', buyerCount: 4, avgPriority: 7.8 },
              { zipCode: '30301', buyerCount: 2, avgPriority: 5.9 },
            ]
          },
          {
            serviceTypeId: 'service-3',
            serviceName: 'Roofing Services',
            totalZipCodes: 2156,
            activeZipCodes: 2089,
            totalBuyers: 12,
            activeBuyers: 11,
            topZipCodes: [
              { zipCode: '33101', buyerCount: 8, avgPriority: 8.5 },
              { zipCode: '85001', buyerCount: 7, avgPriority: 7.9 },
              { zipCode: '98101', buyerCount: 6, avgPriority: 7.3 },
            ]
          }
        ];

        // Mock buyer coverage data
        const mockBuyerData: BuyerCoverageData[] = [
          {
            buyerId: 'buyer-1',
            buyerName: 'HomeAdvisor',
            totalZipCodes: 2847,
            activeZipCodes: 2698,
            serviceCount: 3,
            lastUpdated: new Date('2024-01-20')
          },
          {
            buyerId: 'buyer-2',
            buyerName: 'Modernize',
            totalZipCodes: 1923,
            activeZipCodes: 1845,
            serviceCount: 2,
            lastUpdated: new Date('2024-01-19')
          },
          {
            buyerId: 'buyer-3',
            buyerName: 'Angi',
            totalZipCodes: 1456,
            activeZipCodes: 1398,
            serviceCount: 2,
            lastUpdated: new Date('2024-01-18')
          }
        ];

        setServiceCoverageData(mockServiceData);
        setBuyerCoverageData(mockBuyerData);
        
      } catch (error) {
        console.error('Error fetching coverage data:', error);
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
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
          <h1 className="text-2xl font-bold text-gray-900">Service Coverage Dashboard</h1>
          <p className="text-gray-500">
            Overview of buyer service area coverage and zip code mappings
          </p>
        </div>
        
        <Button
          onClick={handleExport}
          variant="outline"
          className="flex items-center space-x-2"
        >
          <Download className="h-4 w-4" />
          <span>Export Report</span>
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Coverage</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalServiceZipPairs.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Service-zip combinations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Coverage</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalActiveServiceZipPairs.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {avgCoverageRate}% active rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Zip Codes</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalUniqueZipCodes.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Geographic areas served
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Buyers</CardTitle>
            <Building className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {buyerCoverageData.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Lead buyer partners
            </p>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle and Search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant={selectedView === 'services' ? 'default' : 'outline'}
            onClick={() => setSelectedView('services')}
            size="sm"
          >
            By Service
          </Button>
          <Button
            variant={selectedView === 'buyers' ? 'default' : 'outline'}
            onClick={() => setSelectedView('buyers')}
            size="sm"
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
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Service Coverage View */}
      {selectedView === 'services' && (
        <div className="space-y-4">
          {filteredServiceData.map((service) => (
            <Card key={service.serviceTypeId} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    <span>{service.serviceName}</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      {service.totalBuyers} buyers
                    </Badge>
                    <Badge 
                      variant={service.activeZipCodes / service.totalZipCodes > 0.9 ? 'default' : 'secondary'}
                      className={service.activeZipCodes / service.totalZipCodes > 0.9 ? 'bg-green-100 text-green-800' : ''}
                    >
                      {Math.round((service.activeZipCodes / service.totalZipCodes) * 100)}% active
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Coverage Stats */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">Coverage Statistics</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Zip Codes:</span>
                        <span className="font-medium">{service.totalZipCodes.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Active Coverage:</span>
                        <span className="font-medium text-green-600">{service.activeZipCodes.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Active Buyers:</span>
                        <span className="font-medium">{service.activeBuyers} of {service.totalBuyers}</span>
                      </div>
                    </div>
                  </div>

                  {/* Top Zip Codes */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">Most Competitive Zip Codes</h4>
                    <div className="space-y-2">
                      {service.topZipCodes.map((zipData, index) => (
                        <div key={zipData.zipCode} className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            <span className="font-mono">{zipData.zipCode}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-600">{zipData.buyerCount} buyers</span>
                            <Badge 
                              variant="outline" 
                              className={`${
                                zipData.avgPriority >= 7 ? 'bg-green-100 text-green-800' :
                                zipData.avgPriority >= 5 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}
                            >
                              {zipData.avgPriority.toFixed(1)} avg
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Buyer Coverage View */}
      {selectedView === 'buyers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredBuyerData.map((buyer) => (
            <Card key={buyer.buyerId} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Building className="h-5 w-5 text-purple-600" />
                    <span>{buyer.buyerName}</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/buyers/${buyer.buyerId}/zip-codes`)}
                      className="flex items-center space-x-1"
                    >
                      <Eye className="h-3 w-3" />
                      <span>View</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {buyer.totalZipCodes.toLocaleString()}
                      </div>
                      <div className="text-sm text-blue-700">Total Zip Codes</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {buyer.activeZipCodes.toLocaleString()}
                      </div>
                      <div className="text-sm text-green-700">Active Coverage</div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Services Configured:</span>
                      <Badge variant="outline">{buyer.serviceCount} services</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Coverage Rate:</span>
                      <span className="font-medium">
                        {Math.round((buyer.activeZipCodes / buyer.totalZipCodes) * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Updated:</span>
                      <span className="text-gray-500">
                        {buyer.lastUpdated.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty States */}
      {selectedView === 'services' && filteredServiceData.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No services found
            </h3>
            <p className="text-gray-500">
              {searchQuery ? 'No services match your search criteria.' : 'No service coverage data available.'}
            </p>
          </CardContent>
        </Card>
      )}

      {selectedView === 'buyers' && filteredBuyerData.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No buyers found
            </h3>
            <p className="text-gray-500">
              {searchQuery ? 'No buyers match your search criteria.' : 'No buyer coverage data available.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}