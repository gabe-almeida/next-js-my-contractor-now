'use client';

/**
 * Affiliate Links Management Page
 *
 * WHY: Central hub for managing affiliate tracking links.
 * WHEN: Affiliate navigates to Links section to create/manage links.
 * HOW: Fetches links from API, displays in table with CRUD operations.
 */

import { useState, useEffect, useCallback } from 'react';
import { LinkTable } from '@/components/affiliate/LinkTable';
import { LinkCreateModal } from '@/components/affiliate/LinkCreateModal';
import { Button } from '@/components/ui/Button';
import { Plus, RefreshCw } from 'lucide-react';

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

export default function AffiliateLinksPage() {
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editLink, setEditLink] = useState<AffiliateLink | null>(null);

  const fetchLinks = useCallback(async () => {
    const token = localStorage.getItem('affiliate_token');
    if (!token) return;

    try {
      const response = await fetch('/api/affiliates/links', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setLinks(data.data);
      }
    } catch (error) {
      console.error('Error fetching links:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleCreate = async (data: { name: string; targetUrl?: string; customCode?: string }) => {
    const token = localStorage.getItem('affiliate_token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch('/api/affiliates/links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to create link');
    }

    fetchLinks();
  };

  const handleEdit = async (data: { name: string; targetUrl?: string }) => {
    if (!editLink) return;

    const token = localStorage.getItem('affiliate_token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`/api/affiliates/links/${editLink.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to update link');
    }

    setEditLink(null);
    fetchLinks();
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this link? This cannot be undone.')) {
      return;
    }

    const token = localStorage.getItem('affiliate_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/affiliates/links/${linkId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success) {
        fetchLinks();
      }
    } catch (error) {
      console.error('Error deleting link:', error);
    }
  };

  const handleToggleActive = async (linkId: string, isActive: boolean) => {
    const token = localStorage.getItem('affiliate_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/affiliates/links/${linkId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive })
      });

      const result = await response.json();
      if (result.success) {
        fetchLinks();
      }
    } catch (error) {
      console.error('Error toggling link status:', error);
    }
  };

  const openEditModal = (link: AffiliateLink) => {
    setEditLink(link);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditLink(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tracking Links</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage your affiliate tracking links
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={fetchLinks}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Link
          </Button>
        </div>
      </div>

      {/* Links Table */}
      <div className="bg-white shadow rounded-lg">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading links...</p>
          </div>
        ) : (
          <LinkTable
            links={links}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
          />
        )}
      </div>

      {/* Create/Edit Modal */}
      <LinkCreateModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSubmit={editLink ? handleEdit : handleCreate}
        editLink={editLink}
      />
    </div>
  );
}
