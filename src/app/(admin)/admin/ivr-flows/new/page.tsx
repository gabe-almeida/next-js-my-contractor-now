'use client';

/**
 * Create New IVR Flow Page
 *
 * WHY: Allow admins to create new IVR qualification flows.
 * WHEN: Admin wants to set up a new call qualification flow.
 * HOW: Form for metadata + IvrBuilder for step configuration.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IvrBuilder } from '@/components/admin/IvrBuilder';
import type { IvrStep } from '@/types/ivr';

// ============================================
// TYPES
// ============================================

interface ServiceType {
  id: string;
  name: string;
  displayName: string;
}

// ============================================
// COMPONENT
// ============================================

export default function NewIvrFlowPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [defaultTimeout, setDefaultTimeout] = useState(10);
  const [maxRetries, setMaxRetries] = useState(3);
  const [steps, setSteps] = useState<IvrStep[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

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
    // Validate
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
      const response = await fetch('/api/admin/ivr-flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          serviceTypeId: serviceTypeId || undefined,
          defaultTimeout,
          maxRetries,
          steps,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/admin/ivr-flows');
      } else {
        setErrors(data.validationErrors || [data.error || 'Failed to create flow']);
      }
    } catch (err) {
      setErrors(['Failed to create flow']);
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [name, description, serviceTypeId, defaultTimeout, maxRetries, steps, router]);

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
              <h1 className="text-xl font-semibold text-gray-900">Create IVR Flow</h1>
              <p className="text-sm text-gray-500">Set up a new call qualification flow</p>
            </div>
          </div>
          <Button onClick={handleSave}  disabled={saving}>
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
                Save Flow
              </>
            )}
          </Button>
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
                    placeholder="e.g., Windows Qualification"
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
                    placeholder="Optional description..."
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
