'use client';

/**
 * Contractor Dashboard Page
 *
 * WHY: Main landing page for authenticated contractors showing leads overview.
 * WHEN: After contractor logs in, this is their home page.
 * HOW: Fetches contractor info and recent leads, displays summary stats.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  LayoutDashboard,
  FileText,
  Settings,
  LogOut,
  User,
  Menu,
  X
} from 'lucide-react';

interface ContractorData {
  id: string;
  name: string;
  displayName: string | null;
  contactEmail: string | null;
  contactName: string | null;
}

export default function ContractorDashboardPage() {
  const [contractor, setContractor] = useState<ContractorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('contractor_token');
      if (!token) {
        router.push('/contractor/login');
        return;
      }

      try {
        const response = await fetch('/api/contractors/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch contractor data');
        }

        const data = await response.json();
        if (data.success) {
          setContractor(data.data);
        } else {
          throw new Error(data.error);
        }
      } catch (error) {
        console.error('Error fetching contractor data:', error);
        // Token might be invalid, redirect to login
        localStorage.removeItem('contractor_token');
        router.push('/contractor/login');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLogout = () => {
    document.cookie = 'contractor_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    localStorage.removeItem('contractor_token');
    router.push('/contractor/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">Contractor Portal</h1>
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          <div className="space-y-1">
            <a
              href="/contractor/dashboard"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-md bg-blue-50 text-blue-700"
            >
              <LayoutDashboard className="mr-3 h-5 w-5 text-blue-600" />
              Dashboard
            </a>
            <a
              href="/contractor/leads"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              <FileText className="mr-3 h-5 w-5 text-gray-400" />
              My Leads
            </a>
            <a
              href="/contractor/settings"
              className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              <Settings className="mr-3 h-5 w-5 text-gray-400" />
              Settings
            </a>
          </div>
        </nav>

        {/* User info at bottom */}
        {contractor && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {contractor.displayName || contractor.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {contractor.contactEmail}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-gray-500"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <div className="flex items-center">
              <button
                className="lg:hidden mr-3"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6 text-gray-400" />
              </button>
              <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Welcome message */}
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Welcome, {contractor?.contactName || contractor?.displayName || contractor?.name}!
              </h3>
              <p className="mt-2 text-gray-600">
                View and manage your leads from the My Leads section.
              </p>
            </div>

            {/* Quick stats placeholder */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h4 className="text-sm font-medium text-gray-500">Total Leads</h4>
                <p className="mt-2 text-3xl font-semibold text-gray-900">--</p>
                <p className="text-sm text-gray-500">Coming soon</p>
              </div>
              <div className="bg-white shadow rounded-lg p-6">
                <h4 className="text-sm font-medium text-gray-500">This Month</h4>
                <p className="mt-2 text-3xl font-semibold text-gray-900">--</p>
                <p className="text-sm text-gray-500">Coming soon</p>
              </div>
              <div className="bg-white shadow rounded-lg p-6">
                <h4 className="text-sm font-medium text-gray-500">Pending</h4>
                <p className="mt-2 text-3xl font-semibold text-gray-900">--</p>
                <p className="text-sm text-gray-500">Coming soon</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
