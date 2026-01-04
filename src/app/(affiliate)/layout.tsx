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

interface AffiliateUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

// Public routes that don't require authentication
const publicRoutes = ['/affiliate/login', '/affiliate/signup'];

export default function AffiliateRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AffiliateUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

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
        router.push('/affiliate/login');
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
        router.push('/affiliate/login');
        return;
      }

      setLoading(false);
    };

    checkAuth();
  }, [pathname, router, isPublicRoute]);

  // Show loading state
  if (loading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Public routes (login, signup) - render without layout
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Authenticated routes - render with affiliate layout
  return (
    <AffiliateLayout user={user || undefined}>
      {children}
    </AffiliateLayout>
  );
}
