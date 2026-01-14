'use client';

/**
 * Services Admin Page
 *
 * WHY: Manage service types and their form schemas
 * WHEN: Admin needs to create/edit/delete services or configure form fields
 * HOW: Fetches from /api/service-types, displays in modern table view
 */

import { useState, useEffect, useMemo } from 'react';
import { ServiceForm } from '@/components/admin/ServiceForm';
import { Button } from '@/components/ui/Button';
import {
  AdminPageHeader,
  AdminDataTable,
  StatusBadge,
  type TableColumn,
  type RowAction,
} from '@/components/admin/ui';
import { ServiceType } from '@/types';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  AlertCircle,
  Settings,
  Layers,
} from 'lucide-react';

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch services from API
  const fetchServices = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/service-types?includeInactive=true', {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });
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
      setLastRefresh(new Date());
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

  const handleDeleteService = async (service: ServiceType) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${service.name}"? This cannot be undone.`
      )
    ) {
      try {
        const response = await fetch(`/api/service-types/${service.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
          },
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.message || 'Failed to delete service');
        }

        await fetchServices();
      } catch (err) {
        console.error('Failed to delete service:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete service');
      }
    }
  };

  const handleToggleActive = async (service: ServiceType) => {
    try {
      const response = await fetch(`/api/service-types/${service.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
        body: JSON.stringify({ active: !service.active }),
      });

      if (!response.ok) {
        throw new Error('Failed to update service');
      }

      await fetchServices();
    } catch (err) {
      console.error('Failed to toggle service:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle service');
    }
  };

  const handleSubmitForm = async (data: any) => {
    try {
      const formSchema = {
        title: `${data.name} Form`,
        description: data.description,
        fields: data.formFields || [],
        validationRules: [],
      };

      const payload = {
        name: data.name,
        displayName: data.name,
        formSchema,
      };

      let response;
      if (editingService) {
        response = await fetch(`/api/service-types/${editingService.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/service-types', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'Failed to save service');
      }

      await fetchServices();
      setShowForm(false);
      setEditingService(null);
    } catch (err) {
      console.error('Failed to save service:', err);
      setError(err instanceof Error ? err.message : 'Failed to save service');
    }
  };

  // Table columns
  const columns: TableColumn<ServiceType>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Service Name',
        sortable: true,
        render: (service) => (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Layers className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{service.name}</div>
              <div className="text-xs text-gray-500">{service.displayName || service.name}</div>
            </div>
          </div>
        ),
      },
      {
        key: 'active',
        header: 'Status',
        sortable: true,
        render: (service) => (
          <StatusBadge status={service.active ? 'ACTIVE' : 'INACTIVE'} />
        ),
      },
      {
        key: 'formFields',
        header: 'Form Fields',
        align: 'center',
        render: (service) => (
          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
            {service.formSchema?.fields?.length || 0}
          </span>
        ),
      },
      {
        key: 'createdAt',
        header: 'Created',
        sortable: true,
        render: (service) => (
          <div>
            <div className="text-sm text-gray-900">
              {service.createdAt.toLocaleDateString()}
            </div>
            <div className="text-xs text-gray-400">
              {service.createdAt.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        ),
      },
      {
        key: 'updatedAt',
        header: 'Updated',
        sortable: true,
        render: (service) => (
          <span className="text-sm text-gray-500">
            {service.updatedAt.toLocaleDateString()}
          </span>
        ),
      },
    ],
    []
  );

  // Row actions
  const rowActions: RowAction<ServiceType>[] = useMemo(
    () => [
      {
        key: 'edit',
        icon: <Edit className="h-4 w-4" />,
        label: 'Edit',
        onClick: handleEditService,
      },
      {
        key: 'delete',
        icon: <Trash2 className="h-4 w-4" />,
        label: 'Delete',
        onClick: handleDeleteService,
        variant: 'danger',
      },
    ],
    []
  );

  // Show form if creating/editing
  if (showForm) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title={editingService ? 'Edit Service' : 'Create New Service'}
          description={
            editingService
              ? 'Update service configuration and form fields'
              : 'Add a new service type with custom form fields'
          }
        />
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
      {/* Page Header */}
      <AdminPageHeader
        title="Service Management"
        description="Configure service types and form schemas"
        lastUpdated={lastRefresh}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={fetchServices}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleCreateService} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Service
            </Button>
          </div>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-4">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setError(null)}
            className="shrink-0 text-red-700 border-red-200 hover:bg-red-100"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Services Table */}
      <AdminDataTable<ServiceType>
        data={services}
        loading={loading}
        keyField="id"
        columns={columns}
        title="Services"
        searchPlaceholder="Search services..."
        searchFields={['name', 'displayName']}
        filters={[
          {
            key: 'active',
            label: 'All Status',
            options: [
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ],
          },
        ]}
        defaultSortField="name"
        defaultSortDirection="asc"
        rowActions={rowActions}
        onToggleActive={handleToggleActive}
        activeField="active"
        emptyMessage="No services configured yet."
        emptyAction={
          <Button onClick={handleCreateService} variant="outline" className="mt-2">
            Create your first service
          </Button>
        }
      />
    </div>
  );
}
