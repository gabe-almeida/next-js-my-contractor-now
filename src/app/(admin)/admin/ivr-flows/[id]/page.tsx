'use client';

/**
 * Edit IVR Flow Page
 *
 * WHY: Allow admins to edit existing IVR qualification flows.
 * WHEN: Admin needs to modify an IVR flow configuration.
 * HOW: Load existing flow, edit with IvrBuilder, save changes.
 */

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IvrBuilder } from '@/components/admin/IvrBuilder';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { IvrStep } from '@/types/ivr';

// ============================================
// TYPES
// ============================================

interface ServiceType {
  id: string;
  name: string;
  displayName: string;
}

interface IvrFlow {
  id: string;
  name: string;
  description?: string;
  serviceTypeId?: string;
  steps: IvrStep[];
  defaultTimeout: number;
  maxRetries: number;
  active: boolean;
  serviceType?: ServiceType;
  _count?: {
    campaigns: number;
    trackingNumbers: number;
  };
}

// ============================================
// COMPONENT
// ============================================

export default function EditIvrFlowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [flow, setFlow] = useState<IvrFlow | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [defaultTimeout, setDefaultTimeout] = useState(10);
  const [maxRetries, setMaxRetries] = useState(3);
  const [active, setActive] = useState(true);
  const [steps, setSteps] = useState<IvrStep[]>([]);

  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Fetch flow data
  useEffect(() => {
    async function fetchFlow() {
      try {
        const response = await fetch(`/api/admin/ivr-flows/${id}`);
        const data = await response.json();

        if (data.success && data.data) {
          const flowData = data.data;
          setFlow(flowData);
          setName(flowData.name);
          setDescription(flowData.description || '');
          setServiceTypeId(flowData.serviceTypeId || '');
          setDefaultTimeout(flowData.defaultTimeout);
          setMaxRetries(flowData.maxRetries);
          setActive(flowData.active);
          setSteps(Array.isArray(flowData.steps) ? flowData.steps : []);
        } else {
          setErrors([data.error || 'Failed to load IVR flow']);
        }
      } catch (err) {
        setErrors(['Failed to load IVR flow']);
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchFlow();
  }, [id]);

  // Fetch service types
  useEffect(() => {
    async function fetchServiceTypes() {
      try {
        const response = await fetch('/api/admin/services');
        const data = await response.json();
        if (data.services) {
          setServiceTypes(data.services);
        }
      } catch (err) {
        console.error('Failed to fetch service types:', err);
      }
    }
    fetchServiceTypes();
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    const validationErrors: string[] = [];

    if (!name.trim()) {
      validationErrors.push('Name is required');
    }

    if (steps.length === 0) {
      validationErrors.push('At least one step is required');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/ivr-flows/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          serviceTypeId: serviceTypeId || null,
          defaultTimeout,
          maxRetries,
          active,
          steps,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/admin/ivr-flows');
      } else {
        setErrors(data.validationErrors || [data.error || 'Failed to update flow']);
      }
    } catch (err) {
      setErrors(['Failed to update flow']);
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [id, name, description, serviceTypeId, defaultTimeout, maxRetries, active, steps, router]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    const usageCount = (flow?._count?.campaigns || 0) + (flow?._count?.trackingNumbers || 0);

    if (usageCount > 0) {
      alert(`Cannot delete flow that is in use by ${usageCount} campaign(s) or tracking number(s)`);
      return;
    }

    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/admin/ivr-flows/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/admin/ivr-flows');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete flow');
      }
    } catch (err) {
      alert('Failed to delete flow');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  }, [id, name, flow, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!flow && errors.length > 0) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-800">{errors[0]}</p>
          </div>
          <Link href="/admin/ivr-flows">
            <Button variant="outline" className="mt-4">
              Back to IVR Flows
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const usageCount = (flow?._count?.campaigns || 0) + (flow?._count?.trackingNumbers || 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/ivr-flows" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Edit IVR Flow</h1>
              <p className="text-sm text-gray-500">
                {usageCount > 0 ? `Used by ${usageCount} campaign(s)/number(s)` : 'Not currently in use'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleDelete}
              variant="outline"
              disabled={deleting || usageCount > 0}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <span className="animate-spin mr-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </span>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="grid grid-cols-3 gap-8">
          {/* Metadata Form */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Flow Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                               focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                               focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Type
                  </label>
                  <select
                    value={serviceTypeId}
                    onChange={(e) => setServiceTypeId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                               focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    <option value="">All Service Types</option>
                    {serviceTypes.map((st) => (
                      <option key={st.id} value={st.id}>{st.displayName}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Timeout (seconds)
                    </label>
                    <input
                      type="number"
                      value={defaultTimeout}
                      onChange={(e) => setDefaultTimeout(parseInt(e.target.value) || 10)}
                      min={5}
                      max={60}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Retries
                    </label>
                    <input
                      type="number"
                      value={maxRetries}
                      onChange={(e) => setMaxRetries(parseInt(e.target.value) || 3)}
                      min={1}
                      max={5}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="active"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="mr-2 rounded text-orange-500 focus:ring-orange-500"
                  />
                  <label htmlFor="active" className="text-sm text-gray-700">
                    Flow is active
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* IVR Builder */}
          <div className="col-span-2">
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 min-h-[600px]">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Flow Steps</h2>
              <IvrBuilder
                steps={steps}
                onChange={setSteps}
                errors={errors}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
