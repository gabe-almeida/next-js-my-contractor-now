'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ShoppingCart,
  FileText,
  BarChart3,
  Settings,
  Menu,
  X,
  Bell,
  LogOut,
  User,
  TestTube,
  DollarSign,
  Receipt,
  Wallet,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AdminUser } from '@/types';

interface AdminLayoutProps {
  children: React.ReactNode;
  user?: AdminUser;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

type NavigationItem = NavItem | NavSection;

function isNavSection(item: NavigationItem): item is NavSection {
  return 'items' in item;
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    name: 'Leads',
    href: '/admin/leads',
    icon: FileText,
  },
  {
    name: 'Services',
    href: '/admin/services',
    icon: Settings,
  },
  {
    name: 'Buyers',
    href: '/admin/buyers',
    icon: Users,
  },
  {
    name: 'Affiliates',
    href: '/admin/affiliates',
    icon: UserPlus,
  },
  {
    name: 'Finance',
    icon: DollarSign,
    items: [
      {
        name: 'Invoices',
        href: '/admin/invoices',
        icon: Receipt,
      },
      {
        name: 'Payouts',
        href: '/admin/payouts',
        icon: Wallet,
      },
    ],
  },
  {
    name: 'Payload Testing',
    href: '/admin/payload-testing',
    icon: TestTube,
  },
  {
    name: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
  },
  {
    name: 'Transactions',
    href: '/admin/transactions',
    icon: ShoppingCart,
  },
];

export function AdminLayout({ children, user }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['Finance']);
  const pathname = usePathname();

  const isActivePath = (href: string) => {
    if (href === '/admin') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const isSectionActive = (section: NavSection) => {
    return section.items.some(item => isActivePath(item.href));
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionName)
        ? prev.filter(s => s !== sectionName)
        : [...prev, sectionName]
    );
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
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        <nav className="mt-6 px-3 pb-24">
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;

              // Handle expandable section (like Finance)
              if (isNavSection(item)) {
                const isExpanded = expandedSections.includes(item.name);
                const sectionActive = isSectionActive(item);

                return (
                  <div key={item.name}>
                    <button
                      onClick={() => toggleSection(item.name)}
                      className={`
                        w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors group
                        ${sectionActive
                          ? 'bg-orange-50 text-orange-700'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}
                      `}
                    >
                      <div className="flex items-center">
                        <Icon className={`
                          mr-3 h-5 w-5 flex-shrink-0
                          ${sectionActive ? 'text-orange-600' : 'text-gray-400 group-hover:text-gray-600'}
                        `} />
                        <span>{item.name}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="mt-1 ml-8 space-y-1">
                        {item.items.map((subItem) => {
                          const SubIcon = subItem.icon;
                          const isSubActive = isActivePath(subItem.href);

                          return (
                            <Link
                              key={subItem.name}
                              href={subItem.href}
                              className={`
                                flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors group
                                ${isSubActive
                                  ? 'bg-orange-50 text-orange-700 border-l-4 border-orange-500'
                                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                              `}
                              onClick={() => setSidebarOpen(false)}
                            >
                              <SubIcon className={`
                                mr-3 h-4 w-4 flex-shrink-0
                                ${isSubActive ? 'text-orange-600' : 'text-gray-400 group-hover:text-gray-600'}
                              `} />
                              <span>{subItem.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Regular navigation item
              const isActive = isActivePath(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors group
                    ${isActive
                      ? 'bg-orange-50 text-orange-700 border-l-4 border-orange-500'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className={`
                    mr-3 h-5 w-5 flex-shrink-0
                    ${isActive ? 'text-orange-600' : 'text-gray-400 group-hover:text-gray-600'}
                  `} />
                  <span>{item.name}</span>
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
                <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user.role}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-gray-500"
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
          <div className="flex items-center justify-end h-16 px-4 sm:px-6">
            <button
              className="lg:hidden absolute left-4"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6 text-gray-400" />
            </button>

            <div className="flex items-center space-x-4">
              {/* Notifications placeholder */}
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5 text-gray-400" />
              </Button>

              {/* Real-time indicator */}
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-500">Live</span>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="px-6 pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}