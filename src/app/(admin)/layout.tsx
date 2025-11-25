'use client';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminUser } from '@/types';

// Mock user for demonstration - in real app, get from auth context
const mockUser: AdminUser = {
  id: '1',
  email: 'admin@contractor-platform.com',
  name: 'Admin User',
  role: 'admin',
  permissions: ['read', 'write', 'delete', 'manage_users'],
  lastLogin: new Date()
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminLayout user={mockUser}>
      {children}
    </AdminLayout>
  );
}