'use client';

/**
 * Affiliate Route Group Layout
 *
 * WHY: Wraps all affiliate routes with auth check and common layout.
 * WHEN: Applied to all pages under (affiliate) route group.
 * HOW: Checks for valid affiliate token, redirects to login if not found,
 *      fetches affiliate profile and passes to layout component.
 */

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AffiliateLayout } from '@/components/affiliate/AffiliateLayout';
import { ToastProvider } from '@/components/ui/Toast';

interface AffiliateUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

// Public routes that don't require authentication
// Use exact match for /affiliate, prefix match for signup
const exactPublicRoutes = ['/affiliate'];
const prefixPublicRoutes = ['/affiliate/signup'];

export default function AffiliateRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AffiliateUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const isPublicRoute = exactPublicRoutes.includes(pathname) ||
    prefixPublicRoutes.some(route => pathname.startsWith(route));

  useEffect(() => {
    const checkAuth = async () => {
      // Skip auth check for public routes
      if (isPublicRoute) {
        setLoading(false);
        return;
      }

      // Get token from localStorage or cookie
      const token = localStorage.getItem('affiliate_token') ||
        document.cookie.split('; ').find(row => row.startsWith('affiliate_token='))?.split('=')[1];

      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch('/api/affiliates/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Unauthorized');
        }

        const data = await response.json();
        if (data.success && data.data) {
          setUser({
            id: data.data.id,
            email: data.data.email,
            firstName: data.data.firstName,
            lastName: data.data.lastName
          });
        } else {
          throw new Error('Invalid response');
        }
      } catch (error) {
        // Clear invalid token and redirect
        localStorage.removeItem('affiliate_token');
        document.cookie = 'affiliate_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        router.push('/login');
        return;
      }

      setLoading(false);
    };

    checkAuth();
  }, [pathname, router, isPublicRoute]);

  // Show loading state
  if (loading && !isPublicRoute) {
    return (
      <ToastProvider>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      </ToastProvider>
    );
  }

  // Public routes (login, signup) - render without layout
  if (isPublicRoute) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  // Authenticated routes - render with affiliate layout
  return (
    <ToastProvider>
      <AffiliateLayout user={user || undefined}>
        {children}
      </AffiliateLayout>
    </ToastProvider>
  );
}
