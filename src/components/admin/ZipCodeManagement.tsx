'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  X,
  Plus,
  Upload,
  Download,
  Check,
  AlertCircle,
  MapPin,
  Target,
  Users,
  Trash2,
  Settings
} from 'lucide-react';

const zipCodeFormSchema = z.object({
  serviceTypeId: z.string().min(1, 'Please select a service type'),
  zipCodes: z.string()
    .min(1, 'Please enter at least one zip code')
    .transform((val) => 
      val.split(/[,\s\n]+/)
        .map(zip => zip.trim())
        .filter(zip => zip.length > 0)
    )
    .refine(
      (zipCodes) => zipCodes.every(zip => /^\d{5}$/.test(zip)),
      'All zip codes must be exactly 5 digits'
    )
    .refine(
      (zipCodes) => new Set(zipCodes).size === zipCodes.length,
      'Duplicate zip codes are not allowed'
    ),
  priority: z.number().int().min(1).max(10).default(5),
  maxLeadsPerDay: z.number().int().min(1).optional(),
});

// Input type (raw form values before zod transform)
type ZipCodeFormInput = z.input<typeof zipCodeFormSchema>;
// Output type (validated data after zod transform)
type ZipCodeFormData = z.output<typeof zipCodeFormSchema>;

interface ZipCodeManagementProps {
  buyerId: string;
  buyerName: string;
  services: Array<{
    id: string;
    name: string;
    displayName: string;
  }>;
  onClose: () => void;
  onSuccess: () => void;
}

export function ZipCodeManagement({
  buyerId,
  buyerName,
  services,
  onClose,
  onSuccess
}: ZipCodeManagementProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateZipCodes, setDuplicateZipCodes] = useState<string[]>([]);
  const [previewZipCodes, setPreviewZipCodes] = useState<string[]>([]);
  const [importMode, setImportMode] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset
  } = useForm<ZipCodeFormInput>({
    resolver: zodResolver(zipCodeFormSchema),
    defaultValues: {
      zipCodes: '',
      serviceTypeId: '',
      priority: 5,
      maxLeadsPerDay: undefined
    }
  });

  // watch returns the raw input value (string), not the transformed value
  const watchedZipCodes = watch('zipCodes') as unknown as string | undefined;
  const watchedServiceId = watch('serviceTypeId');

  // Parse and preview zip codes
  React.useEffect(() => {
    if (watchedZipCodes && watchedZipCodes.trim()) {
      const parsed = watchedZipCodes
        .split(/[,\s\n]+/)
        .map(zip => zip.trim())
        .filter(zip => zip.length > 0);
      setPreviewZipCodes(parsed);
    } else {
      setPreviewZipCodes([]);
    }
  }, [watchedZipCodes]);

  // Handle form submission - data.zipCodes is transformed from string to string[] by zod
  const onSubmit = async (data: { serviceTypeId: string; zipCodes: string[]; priority: number; maxLeadsPerDay?: number }) => {
    try {
      setLoading(true);
      setError(null);
      setDuplicateZipCodes([]);

      const response = await fetch(`/api/admin/buyers/${buyerId}/zip-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceTypeId: data.serviceTypeId,
          zipCodes: data.zipCodes,
          priority: data.priority,
          maxLeadsPerDay: data.maxLeadsPerDay,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.duplicates && result.duplicates.length > 0) {
          setDuplicateZipCodes(result.duplicates);
          setError(`${result.duplicates.length} zip code(s) already exist for this service`);
        } else {
          throw new Error(result.message || 'Failed to add zip codes');
        }
        return;
      }

      // Success
      onSuccess();
      onClose();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        let zipCodes: string[] = [];

        if (file.name.endsWith('.json')) {
          // Parse JSON
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            zipCodes = parsed.map(item => 
              typeof item === 'string' ? item : item.zipCode || ''
            ).filter(zip => zip);
          } else if (parsed.zipCodes && Array.isArray(parsed.zipCodes)) {
            zipCodes = parsed.zipCodes;
          }
        } else {
          // Parse CSV/TXT
          zipCodes = content
            .split(/[,\s\n]+/)
            .map(zip => zip.trim())
            .filter(zip => /^\d{5}$/.test(zip));
        }

        setValue('zipCodes', zipCodes.join('\n'));
        setImportMode(false);
      } catch (error) {
        setError('Failed to parse file. Please check the format.');
      }
    };

    reader.readAsText(file);
  };

  // Export template
  const exportTemplate = () => {
    const template = {
      instructions: 'Add your zip codes to the zipCodes array below',
      example: {
        serviceTypeId: 'service-id-here',
        zipCodes: ['90210', '90211', '10001'],
        priority: 5,
        maxLeadsPerDay: 10
      },
      zipCodes: []
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zip-codes-template.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Remove duplicate zip codes from preview
  const handleRemoveDuplicates = () => {
    if (duplicateZipCodes.length === 0) return;

    const currentZipCodes = previewZipCodes.filter(zip => 
      !duplicateZipCodes.includes(zip)
    );
    setValue('zipCodes', currentZipCodes.join('\n'));
    setDuplicateZipCodes([]);
    setError(null);
  };

  const selectedService = services.find(s => s.id === watchedServiceId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Add Zip Codes
            </h2>
            <p className="text-gray-500 text-sm">
              Configure service areas for {buyerName}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1 h-auto"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit(onSubmit as any)} className="p-6 space-y-6">
            {/* Service Selection */}
            <div className="form-group">
              <label className="form-label">Service Type *</label>
              <select
                {...register('serviceTypeId')}
                className="form-input"
                disabled={loading}
              >
                <option value="">Select a service type</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.displayName}
                  </option>
                ))}
              </select>
              {errors.serviceTypeId && (
                <p className="form-error">{errors.serviceTypeId.message}</p>
              )}
            </div>

            {/* Import Options */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>Import Options</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setImportMode(!importMode)}
                    className="flex items-center space-x-2"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Upload File</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={exportTemplate}
                    className="flex items-center space-x-2"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download Template</span>
                  </Button>
                </div>

                {importMode && (
                  <div className="mt-3">
                    <input
                      type="file"
                      accept=".json,.csv,.txt"
                      onChange={handleFileUpload}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-medium
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Supports JSON, CSV, and TXT files with zip codes
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Zip Codes Input */}
            <div className="form-group">
              <label className="form-label">
                Zip Codes *
                <span className="text-sm font-normal text-gray-500 ml-2">
                  (Enter one per line, or separate with commas/spaces)
                </span>
              </label>
              <textarea
                {...register('zipCodes')}
                className="form-input"
                rows={8}
                placeholder="90210&#10;90211&#10;10001&#10;&#10;Or: 90210, 90211, 10001"
                disabled={loading}
              />
              {errors.zipCodes && (
                <p className="form-error">{errors.zipCodes.message}</p>
              )}
            </div>

            {/* Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Priority (1-10)</label>
                <input
                  type="number"
                  {...register('priority', { valueAsNumber: true })}
                  className="form-input"
                  min="1"
                  max="10"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Higher priority = more likely to receive leads
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Max Leads Per Day
                  <span className="text-gray-500 font-normal ml-1">(Optional)</span>
                </label>
                <input
                  type="number"
                  {...register('maxLeadsPerDay', { valueAsNumber: true })}
                  className="form-input"
                  min="1"
                  placeholder="Unlimited"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Preview */}
            {previewZipCodes.length > 0 && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4" />
                      <span>Preview ({previewZipCodes.length} zip codes)</span>
                    </div>
                    {selectedService && (
                      <Badge variant="outline" className="bg-white">
                        {selectedService.displayName}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {previewZipCodes.map((zipCode, index) => (
                      <Badge
                        key={index}
                        variant={duplicateZipCodes.includes(zipCode) ? 'destructive' : 'default'}
                        className={
                          duplicateZipCodes.includes(zipCode) 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-blue-100 text-blue-800'
                        }
                      >
                        {zipCode}
                        {duplicateZipCodes.includes(zipCode) && (
                          <AlertCircle className="h-3 w-3 ml-1" />
                        )}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900">Error</p>
                    <p className="text-red-700 text-sm">{error}</p>
                    {duplicateZipCodes.length > 0 && (
                      <div className="mt-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleRemoveDuplicates}
                          className="border-red-300 text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove Duplicates
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={previewZipCodes.length === 0 || !watchedServiceId}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add {previewZipCodes.length} Zip Codes</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}