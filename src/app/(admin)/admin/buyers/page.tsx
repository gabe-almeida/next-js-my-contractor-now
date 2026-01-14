'use client';

/**
 * Buyers Admin Page
 *
 * WHY: Manage lead buyers and their service configurations
 * WHEN: Admin needs to create/edit/delete buyers or configure bid settings
 * HOW: Fetches from /api/admin/buyers, displays in modern table view
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BuyerForm } from '@/components/admin/BuyerForm';
import { Button } from '@/components/ui/Button';
import {
  AdminPageHeader,
  AdminDataTable,
  StatusBadge,
  type TableColumn,
  type RowAction,
} from '@/components/admin/ui';
import { Buyer, BuyerServiceConfig, ServiceType } from '@/types';
import { BuyerType } from '@/types/database';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  AlertCircle,
  Building2,
  Globe,
  MapPin,
  DollarSign,
  Settings,
} from 'lucide-react';

// Extended buyer type with additional API fields
interface ExtendedBuyer extends Buyer {
  contactName?: string;
  contactEmail?: string;
  serviceConfigCount?: number;
  zipCodeCount?: number;
}

export default function BuyersPage() {
  const router = useRouter();
  const [buyers, setBuyers] = useState<ExtendedBuyer[]>([]);
  const [buyerConfigs, setBuyerConfigs] = useState<BuyerServiceConfig[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch buyers and services from API
  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [buyersResponse, servicesResponse] = await Promise.all([
        fetch('/api/admin/buyers?includeInactive=true', {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
          },
        }),
        fetch('/api/admin/services', {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
          },
        }),
      ]);

      if (!buyersResponse.ok) {
        throw new Error('Failed to fetch buyers');
      }

      const buyersData = await buyersResponse.json();

      const fetchedBuyers: ExtendedBuyer[] = (buyersData.data?.buyers || []).map(
        (b: any) => ({
          id: b.id,
          name: b.name,
          displayName: b.displayName,
          type: b.type as BuyerType,
          apiUrl: b.apiUrl,
          authConfig: null,
          pingTimeout: 5000,
          postTimeout: 10000,
          active: b.active,
          createdAt: new Date(b.createdAt),
          updatedAt: new Date(b.updatedAt),
          contactName: b.contactName,
          contactEmail: b.contactEmail,
          serviceConfigCount: b.serviceConfigCount || 0,
          zipCodeCount: b.zipCodeCount || 0,
        })
      );

      setBuyers(fetchedBuyers);

      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json();
        const fetchedServices: ServiceType[] = (
          servicesData.data?.services || []
        ).map((s: any) => ({
          id: s.id,
          name: s.name,
          displayName: s.displayName,
          formSchema: s.formSchema || { title: '', fields: [], validationRules: [] },
          active: s.active,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        }));
        setServices(fetchedServices);
      }

      setBuyerConfigs([]);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setBuyers([]);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateBuyer = () => {
    setEditingBuyer(null);
    setShowForm(true);
  };

  const handleEditBuyer = async (buyer: ExtendedBuyer) => {
    try {
      const response = await fetch(`/api/admin/buyers/${buyer.id}`, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.serviceConfigs) {
          const configs: BuyerServiceConfig[] = result.data.serviceConfigs.map(
            (config: any) => ({
              id: config.id,
              buyerId: buyer.id,
              serviceTypeId: config.serviceTypeId,
              pingTemplate: null,
              postTemplate: null,
              fieldMappings: null,
              requiresTrustedForm: config.requiresTrustedForm,
              requiresJornaya: config.requiresJornaya,
              minBid: config.minBid,
              maxBid: config.maxBid,
              active: config.active,
              priority: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          );
          setBuyerConfigs(configs);
        }
      }
    } catch (err) {
      console.error('Error fetching buyer configs:', err);
    }

    setEditingBuyer(buyer);
    setShowForm(true);
  };

  const handleViewBuyer = (buyer: ExtendedBuyer) => {
    router.push(`/admin/buyers/${buyer.id}`);
  };

  const handleManageZipCodes = (buyer: ExtendedBuyer) => {
    router.push(`/admin/buyers/${buyer.id}/zip-codes`);
  };

  const handleDeleteBuyer = async (buyer: ExtendedBuyer) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${buyer.name}"? This will also remove all associated service configurations.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/buyers/${buyer.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || 'Failed to delete buyer');
      }

      setBuyers((prev) => prev.filter((b) => b.id !== buyer.id));
      setBuyerConfigs((prev) => prev.filter((c) => c.buyerId !== buyer.id));
    } catch (err) {
      console.error('Error deleting buyer:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete buyer');
    }
  };

  const handleToggleActive = async (buyer: ExtendedBuyer) => {
    const newActiveState = !buyer.active;

    // Optimistic update
    setBuyers((prev) =>
      prev.map((b) => (b.id === buyer.id ? { ...b, active: newActiveState } : b))
    );

    try {
      const response = await fetch(`/api/admin/buyers/${buyer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
        },
        body: JSON.stringify({ active: newActiveState }),
      });

      if (!response.ok) {
        throw new Error('Failed to update buyer status');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error?.message || 'Update failed');
      }
    } catch (err) {
      // Revert on error
      console.error('Error toggling buyer active status:', err);
      setBuyers((prev) =>
        prev.map((b) => (b.id === buyer.id ? { ...b, active: !newActiveState } : b))
      );
      setError(err instanceof Error ? err.message : 'Failed to update buyer');
    }
  };

  const handleSubmitForm = async (data: any) => {
    try {
      const apiData = {
        name: data.name,
        displayName: data.displayName,
        apiUrl: data.apiUrl,
        authConfig: {
          type: data.authConfig.type,
          credentials: {
            ...(data.authConfig.type === 'bearer' && {
              bearerToken: data.authConfig.token,
            }),
            ...(data.authConfig.type === 'basic' && {
              username: data.authConfig.username,
              password: data.authConfig.password,
            }),
            ...(data.authConfig.type === 'custom' && {
              customHeaders: data.authConfig.headers,
            }),
          },
        },
        active: data.active,
        pingTimeout: data.pingTimeout,
        postTimeout: data.postTimeout,
        complianceFieldMappings: data.complianceFieldMappings,
        responseMappingConfig: data.responseMappingConfig,
      };

      if (editingBuyer) {
        const response = await fetch(`/api/admin/buyers/${editingBuyer.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
          },
          body: JSON.stringify(apiData),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error?.message || 'Failed to update buyer');
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error?.message || 'Update failed');
        }

        setBuyers((prev) =>
          prev.map((b) =>
            b.id === editingBuyer.id
              ? {
                  ...b,
                  ...result.data,
                  createdAt: new Date(result.data.createdAt),
                  updatedAt: new Date(result.data.updatedAt),
                }
              : b
          )
        );
      } else {
        const response = await fetch('/api/admin/buyers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`,
          },
          body: JSON.stringify(apiData),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error?.message || 'Failed to create buyer');
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error?.message || 'Creation failed');
        }

        const newBuyer: ExtendedBuyer = {
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
          updatedAt: new Date(result.data.updatedAt),
          serviceConfigCount: 0,
          zipCodeCount: 0,
        };
        setBuyers((prev) => [newBuyer, ...prev]);

        if (result.data.webhookSecret) {
          alert(
            `Buyer created successfully!\n\nWebhook Secret (save this - it won't be shown again):\n${result.data.webhookSecret}`
          );
        }
      }

      setShowForm(false);
      setEditingBuyer(null);
    } catch (err) {
      console.error('Error saving buyer:', err);
      setError(err instanceof Error ? err.message : 'Failed to save buyer');
    }
  };

  const getBuyerConfigs = (buyerId: string) => {
    return buyerConfigs.filter((config) => config.buyerId === buyerId);
  };

  // Table columns
  const columns: TableColumn<ExtendedBuyer>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Buyer',
        sortable: true,
        render: (buyer) => (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{buyer.name}</div>
              <div className="text-xs text-gray-500">
                {buyer.displayName || buyer.name}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        sortable: true,
        render: (buyer) => (
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              buyer.type === 'CONTRACTOR'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {buyer.type}
          </span>
        ),
      },
      {
        key: 'active',
        header: 'Status',
        sortable: true,
        render: (buyer) => (
          <StatusBadge status={buyer.active ? 'ACTIVE' : 'INACTIVE'} />
        ),
      },
      {
        key: 'serviceConfigCount',
        header: 'Services',
        align: 'center',
        sortable: true,
        render: (buyer) => (
          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
            {buyer.serviceConfigCount || 0}
          </span>
        ),
      },
      {
        key: 'zipCodeCount',
        header: 'Zip Codes',
        align: 'center',
        sortable: true,
        render: (buyer) => (
          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-700">
            {buyer.zipCodeCount || 0}
          </span>
        ),
      },
      {
        key: 'apiUrl',
        header: 'API Endpoint',
        render: (buyer) => (
          <div className="flex items-center gap-2 max-w-[200px]">
            <Globe className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 truncate" title={buyer.apiUrl}>
              {buyer.apiUrl}
            </span>
          </div>
        ),
      },
      {
        key: 'createdAt',
        header: 'Created',
        sortable: true,
        render: (buyer) => (
          <span className="text-sm text-gray-500">
            {buyer.createdAt.toLocaleDateString()}
          </span>
        ),
      },
    ],
    []
  );

  // Row actions
  const rowActions: RowAction<ExtendedBuyer>[] = useMemo(
    () => [
      {
        key: 'view',
        icon: <Eye className="h-4 w-4" />,
        label: 'View Details',
        onClick: handleViewBuyer,
      },
      {
        key: 'edit',
        icon: <Edit className="h-4 w-4" />,
        label: 'Edit',
        onClick: handleEditBuyer,
      },
      {
        key: 'zipcodes',
        icon: <MapPin className="h-4 w-4" />,
        label: 'Manage Zip Codes',
        onClick: handleManageZipCodes,
      },
      {
        key: 'delete',
        icon: <Trash2 className="h-4 w-4" />,
        label: 'Delete',
        onClick: handleDeleteBuyer,
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
          title={editingBuyer ? 'Edit Buyer' : 'Create New Buyer'}
          description={
            editingBuyer
              ? 'Update buyer configuration and service mappings'
              : 'Add a new lead buyer with service configurations'
          }
        />
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
      {/* Page Header */}
      <AdminPageHeader
        title="Buyer Management"
        description="Configure lead buyers and their service mappings"
        lastUpdated={lastRefresh}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={fetchData}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleCreateBuyer} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Buyer
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

      {/* Buyers Table */}
      <AdminDataTable<ExtendedBuyer>
        data={buyers}
        loading={loading}
        keyField="id"
        columns={columns}
        title="Buyers"
        searchPlaceholder="Search buyers by name, contact..."
        searchFields={['name', 'displayName', 'contactName', 'contactEmail']}
        filters={[
          {
            key: 'type',
            label: 'All Types',
            options: [
              { value: 'AGGREGATOR', label: 'Aggregator' },
              { value: 'CONTRACTOR', label: 'Contractor' },
            ],
          },
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
        onRowClick={handleViewBuyer}
        rowActions={rowActions}
        onToggleActive={handleToggleActive}
        activeField="active"
        emptyMessage="No buyers configured yet."
        emptyAction={
          <Button onClick={handleCreateBuyer} variant="outline" className="mt-2">
            Create your first buyer
          </Button>
        }
      />
    </div>
  );
}
