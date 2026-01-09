'use client';

/**
 * useAuth Hook - Client-side authentication state
 *
 * WHY: Manage auth state across the admin application
 * WHEN: Any component needs user info, permissions, or auth actions
 * HOW: Fetches from /api/auth/admin/me, caches in state, provides helpers
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  lastLoginAt?: string;
}

interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Fetch current user
  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('mcn-auth-token');
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/auth/admin/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Token invalid - clear storage
        localStorage.removeItem('mcn-auth-token');
        localStorage.removeItem('mcn-auth-user');
        setUser(null);
        setIsLoading(false);
        return;
      }

      const result = await response.json();
      if (result.success && result.user) {
        setUser(result.user);
        localStorage.setItem('mcn-auth-user', JSON.stringify(result.user));
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load - try to get user from localStorage first, then verify
  useEffect(() => {
    const cachedUser = localStorage.getItem('mcn-auth-user');
    if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch {
        // Invalid cached user
      }
    }
    fetchUser();
  }, [fetchUser]);

  // Logout
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/admin/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('mcn-auth-token');
      localStorage.removeItem('mcn-auth-user');
      setUser(null);
      router.push('/admin/login');
    }
  }, [router]);

  // Refresh user data
  const refresh = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  // Permission helpers
  const hasPermission = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]) =>
      permissions.some((p) => user?.permissions.includes(p)) ?? false,
    [user]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]) =>
      permissions.every((p) => user?.permissions.includes(p)) ?? false,
    [user]
  );

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    logout,
    refresh,
  };
}

export default useAuth;
