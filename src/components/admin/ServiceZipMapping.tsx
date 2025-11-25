'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { ServiceZipData, ZipCodeMapping } from './BuyerServiceZipManager';
import {
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  MapPin,
  Target,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle2,
  Settings,
  MoreVertical
} from 'lucide-react';

interface ServiceZipMappingProps {
  serviceData: ServiceZipData;
  buyerId: string;
  onUpdate: () => void;
  onDelete: () => void;
}

export function ServiceZipMapping({
  serviceData,
  buyerId,
  onUpdate,
  onDelete
}: ServiceZipMappingProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedZipCodes, setSelectedZipCodes] = useState<Set<string>>(new Set());
  const [showActions, setShowActions] = useState<string | null>(null);
  const [loading, setLoading] = useState<Set<string>>(new Set());

  const { serviceName, zipCodes } = serviceData;
  const activeZipCodes = zipCodes.filter(z => z.active);
  const totalZipCodes = zipCodes.length;

  // Handle individual zip code toggle
  const handleToggleZipCode = async (zipCodeId: string) => {
    try {
      setLoading(prev => new Set([...prev, zipCodeId]));

      const zipCode = zipCodes.find(z => z.id === zipCodeId);
      if (!zipCode) return;

      const response = await fetch(`/api/admin/buyers/${buyerId}/zip-codes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zipCodeIds: [zipCodeId],
          updates: {
            active: !zipCode.active
          }
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update zip code');
      }

      onUpdate();
    } catch (error) {
      console.error('Error toggling zip code:', error);
      alert('Failed to update zip code. Please try again.');
    } finally {
      setLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(zipCodeId);
        return newSet;
      });
    }
  };

  // Handle zip code deletion
  const handleDeleteZipCode = async (zipCodeId: string) => {
    const zipCode = zipCodes.find(z => z.id === zipCodeId);
    if (!zipCode) return;

    if (!window.confirm(`Are you sure you want to remove zip code ${zipCode.zipCode}? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(prev => new Set([...prev, zipCodeId]));

      const response = await fetch(
        `/api/admin/buyers/${buyerId}/zip-codes?ids=${zipCodeId}`,
        {
          method: 'DELETE',
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete zip code');
      }

      onDelete();
    } catch (error) {
      console.error('Error deleting zip code:', error);
      alert('Failed to delete zip code. Please try again.');
    } finally {
      setLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(zipCodeId);
        return newSet;
      });
    }
  };

  // Handle bulk operations
  const handleBulkToggle = async (active: boolean) => {
    if (selectedZipCodes.size === 0) return;

    try {
      const response = await fetch(`/api/admin/buyers/${buyerId}/zip-codes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zipCodeIds: Array.from(selectedZipCodes),
          updates: { active }
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update zip codes');
      }

      setSelectedZipCodes(new Set());
      onUpdate();
    } catch (error) {
      console.error('Error updating zip codes:', error);
      alert('Failed to update zip codes. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedZipCodes.size === 0) return;

    if (!window.confirm(`Are you sure you want to remove ${selectedZipCodes.size} zip code(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/buyers/${buyerId}/zip-codes?ids=${Array.from(selectedZipCodes).join(',')}`,
        {
          method: 'DELETE',
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete zip codes');
      }

      setSelectedZipCodes(new Set());
      onDelete();
    } catch (error) {
      console.error('Error deleting zip codes:', error);
      alert('Failed to delete zip codes. Please try again.');
    }
  };

  // Select/deselect all zip codes
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedZipCodes(new Set(zipCodes.map(z => z.id)));
    } else {
      setSelectedZipCodes(new Set());
    }
  };

  const isAllSelected = selectedZipCodes.size === zipCodes.length && zipCodes.length > 0;
  const isSomeSelected = selectedZipCodes.size > 0 && selectedZipCodes.size < zipCodes.length;

  // Priority color mapping
  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'bg-green-100 text-green-800';
    if (priority >= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 8) return 'High';
    if (priority >= 5) return 'Medium';
    return 'Low';
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 h-auto"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            <div>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-blue-600" />
                <span>{serviceName}</span>
                <Badge variant="outline">
                  {totalZipCodes} zip code{totalZipCodes !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Service Stats */}
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{activeZipCodes.length} active</span>
              </div>
              <div className="flex items-center space-x-1">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span>{totalZipCodes - activeZipCodes.length} inactive</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {/* Bulk Actions */}
          {selectedZipCodes.size > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">
                  {selectedZipCodes.size} zip code{selectedZipCodes.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkToggle(true)}
                    className="text-green-700 border-green-300 hover:bg-green-50"
                  >
                    Activate Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkToggle(false)}
                    className="text-orange-700 border-orange-300 hover:bg-orange-50"
                  >
                    Deactivate Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    className="text-red-700 border-red-300 hover:bg-red-50"
                  >
                    Delete Selected
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Zip Codes Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 w-8">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="text-left py-2 font-medium text-gray-700">Zip Code</th>
                  <th className="text-left py-2 font-medium text-gray-700">Status</th>
                  <th className="text-left py-2 font-medium text-gray-700">Priority</th>
                  <th className="text-left py-2 font-medium text-gray-700">Daily Limit</th>
                  <th className="text-left py-2 font-medium text-gray-700">Created</th>
                  <th className="text-right py-2 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {zipCodes.map((zipCode) => (
                  <tr
                    key={zipCode.id}
                    className={`hover:bg-gray-50 ${
                      selectedZipCodes.has(zipCode.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={selectedZipCodes.has(zipCode.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedZipCodes);
                          if (e.target.checked) {
                            newSelected.add(zipCode.id);
                          } else {
                            newSelected.delete(zipCode.id);
                          }
                          setSelectedZipCodes(newSelected);
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="font-mono font-medium">{zipCode.zipCode}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <Badge
                        variant={zipCode.active ? 'default' : 'secondary'}
                        className={zipCode.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}
                      >
                        {zipCode.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Badge
                        variant="outline"
                        className={getPriorityColor(zipCode.priority)}
                      >
                        {getPriorityLabel(zipCode.priority)} ({zipCode.priority})
                      </Badge>
                    </td>
                    <td className="py-3 text-gray-600">
                      {zipCode.maxLeadsPerDay ? (
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{zipCode.maxLeadsPerDay}/day</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Unlimited</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(zipCode.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleZipCode(zipCode.id)}
                          disabled={loading.has(zipCode.id)}
                          className="p-1 h-auto"
                        >
                          {loading.has(zipCode.id) ? (
                            <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                          ) : zipCode.active ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>

                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowActions(showActions === zipCode.id ? null : zipCode.id)}
                            className="p-1 h-auto"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>

                          {showActions === zipCode.id && (
                            <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                              <button
                                onClick={() => {
                                  // TODO: Implement edit functionality
                                  setShowActions(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                              >
                                <Edit className="h-3 w-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  handleDeleteZipCode(zipCode.id);
                                  setShowActions(null);
                                }}
                                disabled={loading.has(zipCode.id)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600 flex items-center space-x-2"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {zipCodes.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p>No zip codes configured for this service</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}