'use client';

/**
 * Affiliate Links Table Component
 *
 * WHY: Displays affiliate tracking links in a sortable, actionable table.
 * WHEN: Shown on the links management page for affiliates.
 * HOW: Renders link data with copy buttons, edit/delete actions, and stats.
 */

import { useState } from 'react';
import { Copy, Check, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface AffiliateLink {
  id: string;
  name: string;
  code: string;
  targetUrl: string | null;
  clicks: number;
  conversions: number;
  isActive: boolean;
  createdAt: string;
}

interface LinkTableProps {
  links: AffiliateLink[];
  onEdit: (link: AffiliateLink) => void;
  onDelete: (linkId: string) => void;
  onToggleActive: (linkId: string, isActive: boolean) => void;
}

export function LinkTable({ links, onEdit, onDelete, onToggleActive }: LinkTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (link: AffiliateLink) => {
    const url = link.targetUrl
      ? `${link.targetUrl}${link.targetUrl.includes('?') ? '&' : '?'}ref=${link.code}`
      : `${window.location.origin}?ref=${link.code}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (links.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ExternalLink className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No links yet</h3>
        <p className="text-gray-500">Create your first tracking link to start earning commissions.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Code
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Clicks
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Conversions
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {links.map((link) => (
            <tr key={link.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{link.name}</div>
                {link.targetUrl && (
                  <div className="text-xs text-gray-500 truncate max-w-xs">
                    {link.targetUrl}
                  </div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">{link.code}</code>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {link.clicks.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {link.conversions.toLocaleString()}
                {link.clicks > 0 && (
                  <span className="text-xs text-gray-400 ml-1">
                    ({((link.conversions / link.clicks) * 100).toFixed(1)}%)
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <button
                  onClick={() => onToggleActive(link.id, !link.isActive)}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                    link.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {link.isActive ? 'Active' : 'Inactive'}
                </button>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(link.createdAt)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(link)}
                    title="Copy link"
                  >
                    {copiedId === link.id ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(link)}
                    title="Edit link"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(link.id)}
                    title="Delete link"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
