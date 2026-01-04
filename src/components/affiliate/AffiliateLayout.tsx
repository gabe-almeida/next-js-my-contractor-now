'use client';

/**
 * Affiliate Portal Layout Component
 *
 * WHY: Provides consistent navigation and layout structure for the affiliate portal.
 * WHEN: Wraps all authenticated affiliate pages (dashboard, links, leads, etc.).
 * HOW: Uses sidebar navigation with mobile-responsive hamburger menu,
 *      displays affiliate info and provides logout functionality.
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Link as LinkIcon,
  FileText,
  DollarSign,
  Wallet,
  Settings,
  Menu,
  X,
  LogOut,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface AffiliateUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AffiliateLayoutProps {
  children: React.ReactNode;
  user?: AffiliateUser;
}

const navigationItems = [
  {
    name: 'Dashboard',
    href: '/affiliate/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Links',
    href: '/affiliate/links',
    icon: LinkIcon,
  },
  {
    name: 'Leads',
    href: '/affiliate/leads',
    icon: FileText,
  },
  {
    name: 'Commissions',
    href: '/affiliate/commissions',
    icon: DollarSign,
  },
  {
    name: 'Withdrawals',
    href: '/affiliate/withdrawals',
    icon: Wallet,
  },
  {
    name: 'Settings',
    href: '/affiliate/settings',
    icon: Settings,
  },
];

export function AffiliateLayout({ children, user }: AffiliateLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isActivePath = (href: string) => {
    if (href === '/affiliate/dashboard') {
      return pathname === href || pathname === '/affiliate';
    }
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    // Clear affiliate token and redirect to login
    document.cookie = 'affiliate_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    localStorage.removeItem('affiliate_token');
    router.push('/affiliate/login');
  };

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
          <h1 className="text-xl font-bold text-emerald-600">Affiliate Portal</h1>
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                    ${isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className={`
                    mr-3 h-5 w-5 flex-shrink-0
                    ${isActive ? 'text-emerald-600' : 'text-gray-400'}
                  `} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User info at bottom */}
        {user && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-emerald-500 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user.email}
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

              <h2 className="text-lg font-semibold text-gray-900">
                {navigationItems.find(item => isActivePath(item.href))?.name || 'Affiliate Portal'}
              </h2>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
