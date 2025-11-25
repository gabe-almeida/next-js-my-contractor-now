'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Buyer, BuyerServiceConfig, ServiceType } from '@/types';
import { Plus, Trash2, TestTube } from 'lucide-react';
import { ComplianceFieldMappingEditor } from '@/components/admin/compliance/ComplianceFieldMappingEditor';
import { ComplianceFieldMappings } from '@/lib/templates/types';

const buyerSchema = z.object({
  name: z.string().min(1, 'Buyer name is required'),
  displayName: z.string().min(1, 'Display name is required'),
  apiUrl: z.string().url('Please enter a valid URL'),
  authConfig: z.object({
    type: z.enum(['bearer', 'basic', 'custom']),
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    headers: z.record(z.string()).optional(),
  }),
  active: z.boolean(),
  pingTimeout: z.number().min(1).max(30),
  postTimeout: z.number().min(1).max(60),
  complianceFieldMappings: z.object({
    trustedForm: z.object({
      certUrl: z.array(z.string()).optional(),
      certId: z.array(z.string()).optional(),
    }).optional(),
    jornaya: z.object({
      leadId: z.array(z.string()).optional(),
    }).optional(),
    tcpa: z.object({
      consent: z.array(z.string()).optional(),
      timestamp: z.array(z.string()).optional(),
    }).optional(),
    technical: z.object({
      ipAddress: z.array(z.string()).optional(),
      userAgent: z.array(z.string()).optional(),
      timestamp: z.array(z.string()).optional(),
    }).optional(),
    geo: z.object({
      latitude: z.array(z.string()).optional(),
      longitude: z.array(z.string()).optional(),
      city: z.array(z.string()).optional(),
      state: z.array(z.string()).optional(),
    }).optional(),
  }).optional(),
});

const serviceConfigSchema = z.object({
  serviceTypeId: z.string().min(1, 'Service type is required'),
  active: z.boolean(),
  minBid: z.number().min(0),
  maxBid: z.number().min(0),
  priority: z.number().min(1).max(10),
  pingTemplate: z.object({
    includeCompliance: z.boolean(),
    staticFields: z.record(z.any()).optional(),
  }),
  postTemplate: z.object({
    includeCompliance: z.boolean(),
    staticFields: z.record(z.any()).optional(),
  }),
});

type BuyerFormData = z.infer<typeof buyerSchema> & {
  serviceConfigs: z.infer<typeof serviceConfigSchema>[];
};

interface BuyerFormProps {
  buyer?: Buyer;
  buyerConfigs?: BuyerServiceConfig[];
  services: ServiceType[];
  onSubmit: (data: BuyerFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function BuyerForm({ 
  buyer, 
  buyerConfigs = [],
  services,
  onSubmit, 
  onCancel, 
  loading = false 
}: BuyerFormProps) {
  const [testingConnection, setTestingConnection] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<BuyerFormData>({
    resolver: zodResolver(z.object({
      ...buyerSchema.shape,
      serviceConfigs: z.array(serviceConfigSchema)
    })),
    defaultValues: {
      name: buyer?.name || '',
      displayName: buyer?.displayName || '',
      apiUrl: buyer?.apiUrl || '',
      authConfig: {
        type: buyer?.authConfig?.type || 'bearer',
        token: buyer?.authConfig?.token || '',
        username: buyer?.authConfig?.username || '',
        password: buyer?.authConfig?.password || '',
        headers: buyer?.authConfig?.headers || {},
      },
      active: buyer?.active ?? true,
      pingTimeout: buyer?.pingTimeout || 5,
      postTimeout: buyer?.postTimeout || 10,
      complianceFieldMappings: (buyer as any)?.complianceFieldMappings || {},
      serviceConfigs: buyerConfigs.map(config => ({
        serviceTypeId: config.serviceTypeId,
        active: config.active,
        minBid: config.minBid,
        maxBid: config.maxBid,
        priority: config.priority,
        pingTemplate: {
          includeCompliance: config.pingTemplate.includeCompliance,
          staticFields: config.pingTemplate.staticFields || {},
        },
        postTemplate: {
          includeCompliance: config.postTemplate.includeCompliance,
          staticFields: config.postTemplate.staticFields || {},
        },
      })) || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'serviceConfigs',
  });

  const authType = watch('authConfig.type');

  const addServiceConfig = () => {
    append({
      serviceTypeId: '',
      active: true,
      minBid: 10,
      maxBid: 100,
      priority: 5,
      pingTemplate: {
        includeCompliance: false,
        staticFields: {},
      },
      postTemplate: {
        includeCompliance: true,
        staticFields: {},
      },
    });
  };

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      // Mock API test - replace with actual endpoint test
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('Connection test successful!');
    } catch (error) {
      alert('Connection test failed!');
    } finally {
      setTestingConnection(false);
    }
  };

  const availableServices = services.filter(service => 
    !fields.some(field => field.serviceTypeId === service.id)
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Buyer Info */}
      <Card>
        <CardHeader>
          <CardTitle>Buyer Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Buyer Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., HomeAdvisor, Modernize"
                {...register('name')}
              />
              {errors.name && (
                <p className="form-error">{errors.name.message}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Name shown in admin interface"
                {...register('displayName')}
              />
              {errors.displayName && (
                <p className="form-error">{errors.displayName.message}</p>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">API URL</label>
            <div className="flex space-x-2">
              <input
                type="url"
                className="form-input flex-1"
                placeholder="https://api.buyer.com/leads"
                {...register('apiUrl')}
              />
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                loading={testingConnection}
                className="flex items-center space-x-2"
              >
                <TestTube className="h-4 w-4" />
                <span>Test</span>
              </Button>
            </div>
            {errors.apiUrl && (
              <p className="form-error">{errors.apiUrl.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Ping Timeout (seconds)</label>
              <input
                type="number"
                className="form-input"
                min="1"
                max="30"
                {...register('pingTimeout', { valueAsNumber: true })}
              />
              {errors.pingTimeout && (
                <p className="form-error">{errors.pingTimeout.message}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Post Timeout (seconds)</label>
              <input
                type="number"
                className="form-input"
                min="1"
                max="60"
                {...register('postTimeout', { valueAsNumber: true })}
              />
              {errors.postTimeout && (
                <p className="form-error">{errors.postTimeout.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="active"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              {...register('active')}
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700">
              Active (buyer receives leads)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="form-group">
            <label className="form-label">Authentication Type</label>
            <select
              className="form-input"
              {...register('authConfig.type')}
            >
              <option value="bearer">Bearer Token</option>
              <option value="basic">Basic Auth</option>
              <option value="custom">Custom Headers</option>
            </select>
          </div>

          {authType === 'bearer' && (
            <div className="form-group">
              <label className="form-label">Bearer Token</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter bearer token"
                {...register('authConfig.token')}
              />
            </div>
          )}

          {authType === 'basic' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="API username"
                  {...register('authConfig.username')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="API password"
                  {...register('authConfig.password')}
                />
              </div>
            </div>
          )}

          {authType === 'custom' && (
            <div className="form-group">
              <label className="form-label">Custom Headers (JSON)</label>
              <textarea
                className="form-input"
                rows={4}
                placeholder='{"X-API-Key": "your-key", "Authorization": "Custom value"}'
                {...register('authConfig.headers')}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Configurations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Service Configurations</CardTitle>
          <Button
            type="button"
            variant="outline"
            onClick={addServiceConfig}
            disabled={availableServices.length === 0}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Service</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="p-4 border border-gray-200 rounded-lg bg-gray-50"
              >
                <div className="flex items-start justify-between mb-4">
                  <h4 className="font-medium text-gray-900">
                    Service Configuration {index + 1}
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="form-label">Service Type</label>
                    <select
                      className="form-input"
                      {...register(`serviceConfigs.${index}.serviceTypeId`)}
                    >
                      <option value="">Select service</option>
                      {services.map(service => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                    {errors.serviceConfigs?.[index]?.serviceTypeId && (
                      <p className="form-error">
                        {errors.serviceConfigs[index]?.serviceTypeId?.message}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Min Bid ($)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      step="0.01"
                      {...register(`serviceConfigs.${index}.minBid`, {
                        valueAsNumber: true
                      })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Max Bid ($)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      step="0.01"
                      {...register(`serviceConfigs.${index}.maxBid`, {
                        valueAsNumber: true
                      })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Priority (1-10)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      max="10"
                      {...register(`serviceConfigs.${index}.priority`, {
                        valueAsNumber: true
                      })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        {...register(`serviceConfigs.${index}.active`)}
                      />
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                  </div>
                </div>

                {/* Template Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-2">
                    <h5 className="font-medium text-gray-700">PING Template</h5>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        {...register(`serviceConfigs.${index}.pingTemplate.includeCompliance`)}
                      />
                      <span className="text-sm text-gray-600">Include compliance data</span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-medium text-gray-700">POST Template</h5>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        {...register(`serviceConfigs.${index}.postTemplate.includeCompliance`)}
                      />
                      <span className="text-sm text-gray-600">Include compliance data</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}

            {fields.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No service configurations added yet. Click "Add Service" to get started.
              </div>
            )}

            {availableServices.length === 0 && fields.length < services.length && (
              <div className="text-center py-4 text-gray-500 text-sm">
                All available services have been configured for this buyer.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Compliance Field Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Field Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Configure custom field names for compliance data (TrustedForm, Jornaya, TCPA, etc.)
            sent to this buyer. Each field can have multiple names for compatibility.
          </p>
          <ComplianceFieldMappingEditor
            value={watch('complianceFieldMappings') || {}}
            onChange={(mappings: ComplianceFieldMappings) => setValue('complianceFieldMappings', mappings)}
            buyerName={watch('displayName') || watch('name') || 'this buyer'}
            disabled={loading}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={loading}
        >
          {buyer ? 'Update Buyer' : 'Create Buyer'}
        </Button>
      </div>
    </form>
  );
}