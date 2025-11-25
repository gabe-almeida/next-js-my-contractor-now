'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ServiceType, FormField } from '@/types';
import { Plus, Trash2, GripVertical } from 'lucide-react';

const formFieldSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['text', 'number', 'select', 'checkbox', 'textarea', 'radio']),
  label: z.string().min(1, 'Label is required'),
  name: z.string().min(1, 'Name is required'),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    message: z.string().optional(),
  }).optional(),
});

const serviceSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  description: z.string().min(1, 'Description is required'),
  active: z.boolean(),
  formFields: z.array(formFieldSchema),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceFormProps {
  service?: ServiceType;
  onSubmit: (data: ServiceFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function ServiceForm({ 
  service, 
  onSubmit, 
  onCancel, 
  loading = false 
}: ServiceFormProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name || '',
      description: service?.description || '',
      active: service?.active ?? true,
      formFields: service?.formSchema || [
        {
          type: 'text',
          label: 'ZIP Code',
          name: 'zipCode',
          required: true,
          validation: {
            pattern: '^\\d{5}$',
            message: 'Please enter a valid 5-digit ZIP code'
          }
        }
      ],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'formFields',
  });

  const addField = () => {
    append({
      type: 'text',
      label: '',
      name: '',
      required: false,
    });
  };

  const fieldTypes = [
    { value: 'text', label: 'Text Input' },
    { value: 'number', label: 'Number Input' },
    { value: 'select', label: 'Dropdown' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'radio', label: 'Radio Buttons' },
  ];

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      move(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Service Info */}
      <Card>
        <CardHeader>
          <CardTitle>Service Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="form-group">
            <label className="form-label">Service Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Windows, Bathrooms, Roofing"
              {...register('name')}
            />
            {errors.name && (
              <p className="form-error">{errors.name.message}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Brief description of the service"
              {...register('description')}
            />
            {errors.description && (
              <p className="form-error">{errors.description.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="active"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              {...register('active')}
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700">
              Active (service is available for leads)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Form Fields */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Form Fields</CardTitle>
          <Button
            type="button"
            variant="outline"
            onClick={addField}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Field</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div className="flex items-start space-x-4">
                  <div className="cursor-move mt-2">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                  </div>
                  
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">Field Type</label>
                      <select
                        className="form-input"
                        {...register(`formFields.${index}.type`)}
                      >
                        {fieldTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Label</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Field label"
                        {...register(`formFields.${index}.label`)}
                      />
                      {errors.formFields?.[index]?.label && (
                        <p className="form-error">
                          {errors.formFields[index]?.label?.message}
                        </p>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Field Name</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="fieldName (camelCase)"
                        {...register(`formFields.${index}.name`)}
                      />
                      {errors.formFields?.[index]?.name && (
                        <p className="form-error">
                          {errors.formFields[index]?.name?.message}
                        </p>
                      )}
                    </div>

                    <div className="form-group">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`required-${index}`}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          {...register(`formFields.${index}.required`)}
                        />
                        <label htmlFor={`required-${index}`} className="text-sm text-gray-700">
                          Required field
                        </label>
                      </div>
                    </div>

                    {/* Options for select/radio */}
                    {(watch(`formFields.${index}.type`) === 'select' || 
                      watch(`formFields.${index}.type`) === 'radio') && (
                      <div className="form-group md:col-span-2">
                        <label className="form-label">Options (one per line)</label>
                        <textarea
                          className="form-input"
                          rows={3}
                          placeholder="Option 1&#10;Option 2&#10;Option 3"
                          {...register(`formFields.${index}.options`)}
                        />
                      </div>
                    )}

                    {/* Validation */}
                    <div className="form-group md:col-span-2">
                      <label className="form-label">Validation (optional)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {watch(`formFields.${index}.type`) === 'number' && (
                          <>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="Min value"
                              {...register(`formFields.${index}.validation.min`, {
                                valueAsNumber: true
                              })}
                            />
                            <input
                              type="number"
                              className="form-input"
                              placeholder="Max value"
                              {...register(`formFields.${index}.validation.max`, {
                                valueAsNumber: true
                              })}
                            />
                          </>
                        )}
                        {watch(`formFields.${index}.type`) === 'text' && (
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Regex pattern"
                            {...register(`formFields.${index}.validation.pattern`)}
                          />
                        )}
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Error message"
                          {...register(`formFields.${index}.validation.message`)}
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="text-red-500 hover:text-red-700 mt-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {fields.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No form fields added yet. Click "Add Field" to get started.
              </div>
            )}
          </div>
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
          {service ? 'Update Service' : 'Create Service'}
        </Button>
      </div>
    </form>
  );
}