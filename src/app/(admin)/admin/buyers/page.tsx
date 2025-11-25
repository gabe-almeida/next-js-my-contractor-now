'use client';

import { useState, useEffect } from 'react';
import { BuyerForm } from '@/components/admin/BuyerForm';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Buyer, BuyerServiceConfig, ServiceType } from '@/types';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Search,
  Globe,
  Clock,
  DollarSign,
  MapPin
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BuyersPage() {
  const router = useRouter();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [buyerConfigs, setBuyerConfigs] = useState<BuyerServiceConfig[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock services data
      const mockServices: ServiceType[] = [
        {
          id: 'service-1',
          name: 'Windows',
          description: 'Window services',
          formSchema: { 
            fields: [],
            validationRules: []
          },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'service-2',
          name: 'Bathrooms',
          description: 'Bathroom services',
          formSchema: { 
            fields: [],
            validationRules: []
          },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'service-3',
          name: 'Roofing',
          description: 'Roofing services',
          formSchema: { 
            fields: [],
            validationRules: []
          },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // Mock buyers data
      const mockBuyers: Buyer[] = [
        {
          id: 'buyer-1',
          name: 'HomeAdvisor',
          apiUrl: 'https://api.homeadvisor.com/leads',
          authConfig: {
            type: 'bearer',
            credentials: {
              token: 'ha_token_123'
            }
          },
          active: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: 'buyer-2',
          name: 'Modernize',
          apiUrl: 'https://api.modernize.com/leads',
          authConfig: {
            type: 'basic',
            username: 'modernize_api',
            password: 'mod_pass_456'
          },
          active: true,
          createdAt: new Date('2024-01-05'),
          updatedAt: new Date('2024-01-20')
        },
        {
          id: 'buyer-3',
          name: 'Angi',
          apiUrl: 'https://api.angi.com/leads',
          authConfig: {
            type: 'custom',
            headers: {
              'X-API-Key': 'angi_key_789',
              'X-Partner-ID': 'partner_123'
            }
          },
          active: false,
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-18')
        }
      ];

      // Mock buyer configurations
      const mockBuyerConfigs: BuyerServiceConfig[] = [
        {
          id: 'config-1',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          active: true,
          pingTemplate: {
            mappings: [],
            includeCompliance: false
          },
          postTemplate: {
            mappings: [],
            includeCompliance: true
          },
          minBid: 25,
          maxBid: 75,
          priority: 8,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'config-2',
          buyerId: 'buyer-1',
          serviceTypeId: 'service-2',
          active: true,
          pingTemplate: {
            mappings: [],
            includeCompliance: true
          },
          postTemplate: {
            mappings: [],
            includeCompliance: true
          },
          minBid: 30,
          maxBid: 90,
          priority: 7,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'config-3',
          buyerId: 'buyer-2',
          serviceTypeId: 'service-1',
          active: true,
          pingTemplate: {
            mappings: [],
            includeCompliance: false
          },
          postTemplate: {
            mappings: [],
            includeCompliance: true
          },
          minBid: 20,
          maxBid: 60,
          priority: 6,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      setServices(mockServices);
      setBuyers(mockBuyers);
      setBuyerConfigs(mockBuyerConfigs);
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleCreateBuyer = () => {
    setEditingBuyer(null);
    setShowForm(true);
  };

  const handleEditBuyer = (buyer: Buyer) => {
    setEditingBuyer(buyer);
    setShowForm(true);
  };

  const handleDeleteBuyer = async (buyerId: string) => {
    if (window.confirm('Are you sure you want to delete this buyer? This will also remove all associated service configurations.')) {
      // Mock delete - replace with actual API call
      setBuyers(prev => prev.filter(b => b.id !== buyerId));
      setBuyerConfigs(prev => prev.filter(c => c.buyerId !== buyerId));
    }
  };

  const handleToggleActive = async (buyerId: string) => {
    // Mock toggle - replace with actual API call
    setBuyers(prev => prev.map(b => 
      b.id === buyerId ? { ...b, active: !b.active } : b
    ));
  };

  const handleSubmitForm = async (data: any) => {
    // Mock save - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (editingBuyer) {
      // Update existing buyer
      setBuyers(prev => prev.map(b => 
        b.id === editingBuyer.id 
          ? { ...b, ...data, updatedAt: new Date() }
          : b
      ));
      
      // Update service configs
      setBuyerConfigs(prev => {
        // Remove old configs for this buyer
        const withoutOld = prev.filter(c => c.buyerId !== editingBuyer.id);
        // Add new configs
        const newConfigs = data.serviceConfigs.map((config: any) => ({
          id: `config-${Date.now()}-${Math.random()}`,
          buyerId: editingBuyer.id,
          ...config,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
        return [...withoutOld, ...newConfigs];
      });
    } else {
      // Create new buyer
      const newBuyerId = `buyer-${Date.now()}`;
      const newBuyer: Buyer = {
        id: newBuyerId,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setBuyers(prev => [newBuyer, ...prev]);
      
      // Add service configs
      const newConfigs = data.serviceConfigs.map((config: any) => ({
        id: `config-${Date.now()}-${Math.random()}`,
        buyerId: newBuyerId,
        ...config,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      setBuyerConfigs(prev => [...prev, ...newConfigs]);
    }
    
    setShowForm(false);
    setEditingBuyer(null);
  };

  const getBuyerConfigs = (buyerId: string) => {
    return buyerConfigs.filter(config => config.buyerId === buyerId);
  };

  const filteredBuyers = buyers.filter(buyer =>
    buyer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    buyer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {editingBuyer ? 'Edit Buyer' : 'Create New Buyer'}
            </h1>
            <p className="text-gray-500">
              {editingBuyer ? 'Update buyer configuration and service mappings' : 'Add a new lead buyer with service configurations'}
            </p>
          </div>
        </div>

        <BuyerForm
          buyer={editingBuyer || undefined}
          buyerConfigs={editingBuyer ? getBuyerConfigs(editingBuyer.id) : []}
          services={services}
          onSubmit={handleSubmitForm}
          onCancel={() => setShowForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buyer Management</h1>
          <p className="text-gray-500">Configure lead buyers and their service mappings</p>
        </div>
        
        <Button
          onClick={handleCreateBuyer}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Buyer</span>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search buyers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Buyers Grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredBuyers.map((buyer) => {
            const configs = getBuyerConfigs(buyer.id);
            const activeConfigs = configs.filter(c => c.active);
            
            return (
              <Card key={buyer.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center space-x-2">
                        <span>{buyer.name}</span>
                        {buyer.active ? (
                          <span className="status-indicator status-success">Active</span>
                        ) : (
                          <span className="status-indicator status-pending">Inactive</span>
                        )}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {buyer.name}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    {/* API Info */}
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Globe className="h-4 w-4" />
                      <span className="truncate">{buyer.apiUrl}</span>
                    </div>
                    
                    {/* Timeouts */}
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>Status: {buyer.active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>Created: {buyer.createdAt.toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    {/* Service Configs */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">
                        Service Configurations: {configs.length} total, {activeConfigs.length} active
                      </div>
                      {configs.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {configs.map(config => {
                            const service = services.find(s => s.id === config.serviceTypeId);
                            return (
                              <div
                                key={config.id}
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                  config.active 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                <span>{service?.name || 'Unknown'}</span>
                                <div className="ml-1 flex items-center space-x-1">
                                  <DollarSign className="h-3 w-3" />
                                  <span>{config.minBid}-{config.maxBid}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    {/* Created Date */}
                    <div className="text-sm text-gray-600">
                      <strong>Created:</strong> {buyer.createdAt.toLocaleDateString()}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditBuyer(buyer)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBuyer(buyer.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(buyer.id)}
                          className="flex items-center"
                        >
                          {buyer.active ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/buyers/${buyer.id}/zip-codes`)}
                        className="w-full flex items-center justify-center space-x-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <MapPin className="h-4 w-4" />
                        <span>Manage Zip Codes</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filteredBuyers.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-gray-500">
            {searchQuery ? 'No buyers match your search.' : 'No buyers configured yet.'}
          </div>
          {!searchQuery && (
            <Button
              onClick={handleCreateBuyer}
              className="mt-4"
              variant="outline"
            >
              Create your first buyer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}