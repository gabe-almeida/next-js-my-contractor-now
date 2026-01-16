'use client';

/**
 * Date Range Picker Component
 *
 * WHY: Provides consistent date filtering across analytics dashboards.
 *      Supports both preset ranges and custom date selection.
 *
 * WHEN: Use on any analytics page that needs date filtering.
 *
 * HOW: Import and pass onChange handler. Component manages its own state
 *      but calls onChange with the selected date range.
 */

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// =====================================
// TYPE DEFINITIONS
// =====================================

export interface DateRange {
  startDate: Date;
  endDate: Date;
  preset?: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  showCustomRange?: boolean;
}

type PresetKey = 'today' | '7d' | '30d' | '90d' | 'ytd';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'ytd', label: 'Year to date' },
];

// =====================================
// UTILITY FUNCTIONS
// =====================================

/**
 * Get date range from preset key
 */
export function getDateRangeFromPreset(preset: PresetKey): DateRange {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let startDate: Date;

  switch (preset) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    case '7d':
      startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '30d':
      startDate = new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '90d':
      startDate = new Date(endDate.getTime() - 89 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'ytd':
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      break;
    default:
      startDate = new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate, preset };
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date for input[type="date"]
 */
function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// =====================================
// COMPONENT
// =====================================

export function DateRangePicker({
  value,
  onChange,
  showCustomRange = true,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(formatDateForInput(value.startDate));
  const [customEnd, setCustomEnd] = useState(formatDateForInput(value.endDate));
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle preset selection
  const handlePresetSelect = (preset: PresetKey) => {
    const range = getDateRangeFromPreset(preset);
    onChange(range);
    setShowCustom(false);
    setIsOpen(false);
  };

  // Handle custom range apply
  const handleCustomApply = () => {
    const startDate = new Date(customStart);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(customEnd);
    endDate.setHours(23, 59, 59, 999);

    if (startDate <= endDate) {
      onChange({ startDate, endDate, preset: 'custom' });
      setIsOpen(false);
    }
  };

  // Get display label
  const getDisplayLabel = (): string => {
    if (value.preset && value.preset !== 'custom') {
      const preset = PRESETS.find((p) => p.key === value.preset);
      if (preset) return preset.label;
    }
    return `${formatDate(value.startDate)} - ${formatDate(value.endDate)}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
      >
        <Calendar className="h-4 w-4 text-gray-500" />
        <span>{getDisplayLabel()}</span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* Preset Options */}
          <div className="p-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => handlePresetSelect(preset.key)}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                  value.preset === preset.key
                    ? 'bg-orange-50 text-orange-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Range Section */}
          {showCustomRange && (
            <>
              <div className="border-t border-gray-100" />
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => setShowCustom(!showCustom)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    showCustom || value.preset === 'custom'
                      ? 'bg-orange-50 text-orange-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Custom range
                </button>

                {showCustom && (
                  <div className="mt-2 space-y-3 px-3 py-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Start date
                      </label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        End date
                      </label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <Button
                      onClick={handleCustomApply}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm"
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================
// QUICK FILTER BUTTONS
// =====================================

interface QuickDateFiltersProps {
  value: string;
  onChange: (preset: PresetKey) => void;
}

/**
 * Quick Date Filter Buttons
 *
 * WHY: Provides inline date filtering without dropdown.
 * WHEN: When space permits and quick switching is desired.
 * HOW: Horizontal button group for common presets.
 */
export function QuickDateFilters({ value, onChange }: QuickDateFiltersProps) {
  const quickPresets: { key: PresetKey; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
  ];

  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
      {quickPresets.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => onChange(preset.key)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === preset.key
              ? 'bg-orange-500 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
