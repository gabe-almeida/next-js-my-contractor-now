'use client';

/**
 * Admin Root Layout
 *
 * WHY: Wrap all admin pages with authenticated layout
 * WHEN: Any /admin/* route is accessed
 * HOW: Uses useAuth hook for real auth, shows loading state
 */

import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminUser } from '@/types';
import { AdminUserRole } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Convert auth user to AdminUser format for layout
  const adminUser: AdminUser = user ? {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AdminUserRole,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } : {
    id: '',
    email: '',
    name: 'Guest',
    role: AdminUserRole.SUPPORT,
    active: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return (
    <AdminLayout user={adminUser}>
      {children}
    </AdminLayout>
  );
}