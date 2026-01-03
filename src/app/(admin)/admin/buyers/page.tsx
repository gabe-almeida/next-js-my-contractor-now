'use client';

import { useState, useEffect } from 'react';
import { BuyerForm } from '@/components/admin/BuyerForm';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Buyer, BuyerServiceConfig, ServiceType } from '@/types';
import { BuyerType } from '@/types/database';
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

  // Fetch buyers and services from API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        // Fetch buyers and services in parallel
        const [buyersResponse, servicesResponse] = await Promise.all([
          fetch('/api/admin/buyers?includeInactive=true'),
          fetch('/api/admin/services')
        ]);

        if (!buyersResponse.ok) {
          throw new Error('Failed to fetch buyers');
        }

        const buyersData = await buyersResponse.json();

        // Transform API response to match Buyer type
        const fetchedBuyers: Buyer[] = (buyersData.data?.buyers || []).map((b: any) => ({
          id: b.id,
          name: b.name,
          displayName: b.displayName,
          type: b.type as BuyerType,
          apiUrl: b.apiUrl,
          authConfig: null, // Auth config is not returned for security
          pingTimeout: 5000,
          postTimeout: 10000,
          active: b.active,
          createdAt: new Date(b.createdAt),
          updatedAt: new Date(b.updatedAt),
          // Include additional fields from API
          contactName: b.contactName,
          contactEmail: b.contactEmail,
          serviceConfigCount: b.serviceConfigCount || 0,
          zipCodeCount: b.zipCodeCount || 0
        }));

        setBuyers(fetchedBuyers);

        // Fetch services if response is ok
        if (servicesResponse.ok) {
          const servicesData = await servicesResponse.json();
          const fetchedServices: ServiceType[] = (servicesData.data?.services || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            displayName: s.displayName,
            formSchema: s.formSchema || { title: '', fields: [], validationRules: [] },
            active: s.active,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt)
          }));
          setServices(fetchedServices);
        }

        // Note: buyerConfigs will be fetched when editing a specific buyer
        setBuyerConfigs([]);

      } catch (error) {
        console.error('Error fetching data:', error);
        // Keep empty arrays on error
        setBuyers([]);
        setServices([]);
      } finally {
        setLoading(false);
      }
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
    if (!window.confirm('Are you sure you want to delete this buyer? This will also remove all associated service configurations.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/buyers/${buyerId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || 'Failed to delete buyer');
      }

      // Remove from local state on success
      setBuyers(prev => prev.filter(b => b.id !== buyerId));
      setBuyerConfigs(prev => prev.filter(c => c.buyerId !== buyerId));
    } catch (error) {
      console.error('Error deleting buyer:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete buyer. Please try again.');
    }
  };

  const handleToggleActive = async (buyerId: string) => {
    const buyer = buyers.find(b => b.id === buyerId);
    if (!buyer) return;

    const newActiveState = !buyer.active;

    // Optimistically update UI
    setBuyers(prev => prev.map(b =>
      b.id === buyerId ? { ...b, active: newActiveState } : b
    ));

    try {
      const response = await fetch(`/api/admin/buyers/${buyerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActiveState })
      });

      if (!response.ok) {
        throw new Error('Failed to update buyer status');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error?.message || 'Update failed');
      }
    } catch (error) {
      // Revert on error
      console.error('Error toggling buyer active status:', error);
      setBuyers(prev => prev.map(b =>
        b.id === buyerId ? { ...b, active: !newActiveState } : b
      ));
      alert('Failed to update buyer status. Please try again.');
    }
  };

  const handleSubmitForm = async (data: any) => {
    try {
      // Transform form data to match API expectations
      const apiData = {
        name: data.name,
        displayName: data.displayName,
        apiUrl: data.apiUrl,
        authConfig: {
          type: data.authConfig.type,
          credentials: {
            ...(data.authConfig.type === 'bearer' && { bearerToken: data.authConfig.token }),
            ...(data.authConfig.type === 'basic' && {
              username: data.authConfig.username,
              password: data.authConfig.password
            }),
            ...(data.authConfig.type === 'custom' && { customHeaders: data.authConfig.headers })
          }
        },
        active: data.active,
        pingTimeout: data.pingTimeout,
        postTimeout: data.postTimeout,
        complianceFieldMappings: data.complianceFieldMappings,
        responseMappingConfig: data.responseMappingConfig
      };

      if (editingBuyer) {
        // Update existing buyer
        const response = await fetch(`/api/admin/buyers/${editingBuyer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiData)
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error?.message || 'Failed to update buyer');
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error?.message || 'Update failed');
        }

        // Update local state with response data
        setBuyers(prev => prev.map(b =>
          b.id === editingBuyer.id
            ? {
                ...b,
                ...result.data,
                createdAt: new Date(result.data.createdAt),
                updatedAt: new Date(result.data.updatedAt)
              }
            : b
        ));
      } else {
        // Create new buyer
        const response = await fetch('/api/admin/buyers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiData)
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error?.message || 'Failed to create buyer');
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error?.message || 'Creation failed');
        }

        // Add new buyer to local state
        const newBuyer: Buyer = {
          id: result.data.id,
          name: result.data.name,
          displayName: result.data.displayName,
          type: result.data.type as BuyerType,
          apiUrl: result.data.apiUrl,
          authConfig: null,
          pingTimeout: result.data.pingTimeout || 5000,
          postTimeout: result.data.postTimeout || 10000,
          active: result.data.active,
          createdAt: new Date(result.data.createdAt),
          updatedAt: new Date(result.data.updatedAt)
        };
        setBuyers(prev => [newBuyer, ...prev]);

        // Show webhook secret if returned (only on creation)
        if (result.data.webhookSecret) {
          alert(`Buyer created successfully!\n\nWebhook Secret (save this - it won't be shown again):\n${result.data.webhookSecret}`);
        }
      }

      setShowForm(false);
      setEditingBuyer(null);
    } catch (error) {
      console.error('Error saving buyer:', error);
      alert(error instanceof Error ? error.message : 'Failed to save buyer. Please try again.');
    }
  };

  const getBuyerConfigs = (buyerId: string) => {
    return buyerConfigs.filter(config => config.buyerId === buyerId);
  };

  const filteredBuyers = buyers.filter(buyer => {
    const query = searchQuery.toLowerCase();
    return (
      buyer.name.toLowerCase().includes(query) ||
      (buyer.displayName?.toLowerCase().includes(query)) ||
      ((buyer as any).contactName?.toLowerCase().includes(query)) ||
      ((buyer as any).contactEmail?.toLowerCase().includes(query))
    );
  });

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
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          buyer.type === 'CONTRACTOR'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {buyer.type}
                        </span>
                        {buyer.active ? (
                          <span className="status-indicator status-success">Active</span>
                        ) : (
                          <span className="status-indicator status-pending">Inactive</span>
                        )}
                      </CardTitle>
                      {/* Show contact info for contractors */}
                      {(buyer as any).contactName && (
                        <p className="text-sm text-gray-600 mt-1">
                          Contact: {(buyer as any).contactName}
                          {(buyer as any).contactEmail && ` • ${(buyer as any).contactEmail}`}
                        </p>
                      )}
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
                    <div className="text-sm text-gray-500">
                      Created: {buyer.createdAt.toLocaleDateString()}
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