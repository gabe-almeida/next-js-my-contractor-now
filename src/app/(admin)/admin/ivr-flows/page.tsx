'use client';

/**
 * Admin IVR Flows List Page
 *
 * WHY: Manage IVR qualification flows for pay-per-call campaigns.
 * WHEN: Admin needs to view, create, or manage IVR flows.
 * HOW: Data table with search, filter, and CRUD actions.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Phone,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Eye,
  GitBranch,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AdminDataTable, type TableColumn, type RowAction } from '@/components/admin/ui/AdminDataTable';
import { StatusBadge } from '@/components/admin/ui/AdminBadge';

// ============================================
// TYPES
// ============================================

interface IvrFlow {
  id: string;
  name: string;
  description?: string;
  serviceTypeId?: string;
  stepCount: number;
  defaultTimeout: number;
  maxRetries: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  serviceType?: {
    id: string;
    displayName: string;
  };
  usageCount: number;
}

// ============================================
// COMPONENT
// ============================================

export default function IvrFlowsPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<IvrFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch flows
  const fetchFlows = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ivr-flows');
      const data = await response.json();

      if (data.success) {
        setFlows(data.data);
      } else {
        setError(data.error || 'Failed to load IVR flows');
      }
    } catch (err) {
      setError('Failed to load IVR flows');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // Toggle active status
  const handleToggleActive = useCallback(async (flow: IvrFlow) => {
    try {
      const response = await fetch(`/api/admin/ivr-flows/${flow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !flow.active }),
      });

      if (response.ok) {
        fetchFlows();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update flow');
      }
    } catch (err) {
      alert('Failed to update flow');
      console.error(err);
    }
  }, [fetchFlows]);

  // Delete flow
  const handleDelete = useCallback(async (flow: IvrFlow) => {
    if (flow.usageCount > 0) {
      alert(`Cannot delete flow that is in use by ${flow.usageCount} campaign(s) or tracking number(s)`);
      return;
    }

    if (!confirm(`Are you sure you want to delete "${flow.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/ivr-flows/${flow.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchFlows();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete flow');
      }
    } catch (err) {
      alert('Failed to delete flow');
      console.error(err);
    }
  }, [fetchFlows]);

  // Table columns
  const columns: TableColumn<IvrFlow>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (flow) => (
        <div>
          <p className="font-medium text-gray-900">{flow.name}</p>
          {flow.description && (
            <p className="text-sm text-gray-500 truncate max-w-xs">{flow.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'serviceType',
      header: 'Service Type',
      render: (flow) => (
        <span className="text-sm text-gray-600">
          {flow.serviceType?.displayName || 'All Services'}
        </span>
      ),
    },
    {
      key: 'stepCount',
      header: 'Steps',
      align: 'center',
      render: (flow) => (
        <div className="flex items-center justify-center gap-1">
          <GitBranch className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">{flow.stepCount}</span>
        </div>
      ),
    },
    {
      key: 'usageCount',
      header: 'Usage',
      align: 'center',
      render: (flow) => (
        <div className="flex items-center justify-center gap-1">
          <Phone className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">{flow.usageCount}</span>
        </div>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      align: 'center',
      render: (flow) => (
        <StatusBadge status={flow.active ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      render: (flow) => (
        <span className="text-sm text-gray-500">
          {new Date(flow.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  // Row actions
  const rowActions: RowAction<IvrFlow>[] = [
    {
      key: 'edit',
      icon: <Edit className="h-4 w-4" />,
      label: 'Edit',
      onClick: (flow) => router.push(`/admin/ivr-flows/${flow.id}`),
    },
    {
      key: 'toggle',
      icon: <ToggleRight className="h-4 w-4" />,
      label: 'Toggle Active',
      onClick: handleToggleActive,
    },
    {
      key: 'delete',
      icon: <Trash2 className="h-4 w-4" />,
      label: 'Delete',
      variant: 'danger',
      onClick: handleDelete,
      show: (flow) => flow.usageCount === 0,
    },
  ];

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <Button
            onClick={fetchFlows}
            variant="outline"
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">IVR Flows</h1>
          <p className="text-gray-500 mt-1">
            Manage call qualification flows for pay-per-call campaigns
          </p>
        </div>
        <Link href="/admin/ivr-flows/new">
          <Button >
            <Plus className="h-4 w-4 mr-2" />
            Create Flow
          </Button>
        </Link>
      </div>

      {/* Data Table */}
      <AdminDataTable
        data={flows}
        loading={loading}
        keyField="id"
        columns={columns}
        searchPlaceholder="Search flows..."
        searchFields={['name', 'description']}
        rowActions={rowActions}
        onToggleActive={handleToggleActive}
        activeField="active"
        emptyMessage="No IVR flows found"
        emptyAction={
          <Link href="/admin/ivr-flows/new">
            <Button  size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create your first flow
            </Button>
          </Link>
        }
      />
    </div>
  );
}
