'use client';

import { useState, useEffect } from 'react';
import { ServiceForm } from '@/components/admin/ServiceForm';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ServiceType } from '@/types';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
  Search,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

/**
 * Services Admin Page
 *
 * WHY: Manage service types and their form schemas
 * WHEN: Admin needs to create/edit/delete services or configure form fields
 * HOW: Fetches from /api/service-types, saves via POST/PUT
 */

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch services from API
  const fetchServices = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/service-types?includeInactive=true');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch services');
      }

      // Parse formSchema JSON strings and convert dates
      const parsedServices = result.data.map((service: any) => ({
        ...service,
        formSchema: service.formSchema ? JSON.parse(service.formSchema) : { fields: [] },
        createdAt: new Date(service.createdAt),
        updatedAt: new Date(service.updatedAt),
      }));

      setServices(parsedServices);
    } catch (err) {
      console.error('Failed to fetch services:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleCreateService = () => {
    setEditingService(null);
    setShowForm(true);
  };

  const handleEditService = (service: ServiceType) => {
    setEditingService(service);
    setShowForm(true);
  };

  const handleDeleteService = async (serviceId: string) => {
    if (window.confirm('Are you sure you want to delete this service? This cannot be undone.')) {
      try {
        const response = await fetch(`/api/service-types/${serviceId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.message || 'Failed to delete service');
        }

        // Refresh list after delete
        await fetchServices();
      } catch (err) {
        console.error('Failed to delete service:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete service');
      }
    }
  };

  const handleToggleActive = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    try {
      const response = await fetch(`/api/service-types/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !service.active }),
      });

      if (!response.ok) {
        throw new Error('Failed to update service');
      }

      // Refresh list after toggle
      await fetchServices();
    } catch (err) {
      console.error('Failed to toggle service:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle service');
    }
  };

  const handleSubmitForm = async (data: any) => {
    try {
      // Build the formSchema object from form data
      const formSchema = {
        title: `${data.name} Form`,
        description: data.description,
        fields: data.formFields || [],
        validationRules: [],
      };

      const payload = {
        name: data.name,
        displayName: data.name, // Use name as displayName for now
        formSchema,
      };

      let response;
      if (editingService) {
        // Update existing service
        response = await fetch(`/api/service-types/${editingService.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new service
        response = await fetch('/api/service-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'Failed to save service');
      }

      // Refresh list and close form
      await fetchServices();
      setShowForm(false);
      setEditingService(null);
    } catch (err) {
      console.error('Failed to save service:', err);
      setError(err instanceof Error ? err.message : 'Failed to save service');
    }
  };

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {editingService ? 'Edit Service' : 'Create New Service'}
            </h1>
            <p className="text-gray-500">
              {editingService ? 'Update service configuration and form fields' : 'Add a new service type with custom form fields'}
            </p>
          </div>
        </div>

        <ServiceForm
          service={editingService || undefined}
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
          <h1 className="text-2xl font-bold text-gray-900">Service Management</h1>
          <p className="text-gray-500">Configure service types and form schemas</p>
        </div>
        
        <Button
          onClick={handleCreateService}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Service</span>
        </Button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-800"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Search and Refresh */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <Button
          variant="outline"
          onClick={fetchServices}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <Card key={service.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center space-x-2">
                      <span>{service.name}</span>
                      {service.active ? (
                        <span className="status-indicator status-success">Active</span>
                      ) : (
                        <span className="status-indicator status-pending">Inactive</span>
                      )}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {service.description}
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    <strong>Form Fields:</strong> {service.formSchema.fields.length}
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <strong>Created:</strong> {service.createdAt.toLocaleDateString()}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditService(service)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteService(service.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(service.id)}
                      className="flex items-center"
                    >
                      {service.active ? (
                        <ToggleRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredServices.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-gray-500">
            {searchQuery ? 'No services match your search.' : 'No services configured yet.'}
          </div>
          {!searchQuery && (
            <Button
              onClick={handleCreateService}
              className="mt-4"
              variant="outline"
            >
              Create your first service
            </Button>
          )}
        </div>
      )}
    </div>
  );
}