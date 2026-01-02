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
  Search
} from 'lucide-react';

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock service data
      const mockServices: ServiceType[] = [
        {
          id: 'service-1',
          name: 'Windows',
          displayName: 'Window Services',
          active: true,
          formSchema: {
            title: 'Window Services Form',
            fields: [],
            validationRules: []
          },
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-20')
        },
        {
          id: 'service-2',
          name: 'Bathrooms',
          displayName: 'Bathroom Services',
          active: true,
          formSchema: {
            title: 'Bathroom Services Form',
            fields: [],
            validationRules: []
          },
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: 'service-3',
          name: 'Roofing',
          displayName: 'Roofing Services',
          active: false,
          formSchema: {
            title: 'Roofing Services Form',
            fields: [],
            validationRules: []
          },
          createdAt: new Date('2024-01-05'),
          updatedAt: new Date('2024-01-12')
        }
      ];
      
      setServices(mockServices);
      setLoading(false);
    };

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
    if (window.confirm('Are you sure you want to delete this service?')) {
      // Mock delete - replace with actual API call
      setServices(prev => prev.filter(s => s.id !== serviceId));
    }
  };

  const handleToggleActive = async (serviceId: string) => {
    // Mock toggle - replace with actual API call
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, active: !s.active } : s
    ));
  };

  const handleSubmitForm = async (data: any) => {
    // Mock save - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (editingService) {
      // Update existing service
      setServices(prev => prev.map(s => 
        s.id === editingService.id 
          ? { ...s, ...data, formSchema: data.formFields, updatedAt: new Date() }
          : s
      ));
    } else {
      // Create new service
      const newService: ServiceType = {
        id: `service-${Date.now()}`,
        ...data,
        formSchema: data.formFields,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setServices(prev => [newService, ...prev]);
    }
    
    setShowForm(false);
    setEditingService(null);
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search services..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
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