'use client';

/**
 * AdminTabNav - Tab navigation for detail pages
 *
 * WHY: Provides consistent tab styling with orange accent for active state.
 * WHEN: Used on detail pages with multiple tabs (details, activity, coverage, etc.)
 * HOW: Renders horizontal tab bar with icon support and active state styling.
 */

import { memo, ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface AdminTabNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const AdminTabNav = memo(function AdminTabNav({
  tabs,
  activeTab,
  onTabChange,
}: AdminTabNavProps) {
  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
});
