'use client';

/**
 * Hours of Operation Editor Component
 *
 * WHY: Provides an intuitive grid interface for configuring business hours.
 *      Used for buyer call settings and campaign scheduling.
 *
 * WHEN: Rendered within call settings forms and campaign configuration.
 *
 * HOW: Displays 7-day grid with start/end time dropdowns and active toggles.
 *      Times are in 30-minute increments from 00:00 to 23:30.
 */

import { memo, useCallback } from 'react';

// =====================================
// TYPE DEFINITIONS
// =====================================

export interface DayHours {
  active: boolean;
  start: string; // "HH:MM" 24-hour format
  end: string;   // "HH:MM" 24-hour format
}

export interface HoursOfOperation {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

interface HoursOfOperationEditorProps {
  hours: HoursOfOperation;
  onChange: (hours: HoursOfOperation) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

// =====================================
// CONSTANTS
// =====================================

const DAYS: Array<{ key: keyof HoursOfOperation; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

/**
 * Generate time options in 30-minute increments
 *
 * WHY: Business hours typically align to 30-minute intervals.
 * HOW: Generate from 00:00 to 23:30, format as HH:MM.
 */
function generateTimeOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];

  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const hourDisplay = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const period = hour < 12 ? 'AM' : 'PM';
      const label = `${hourDisplay}:${minute.toString().padStart(2, '0')} ${period}`;
      options.push({ value, label });
    }
  }

  return options;
}

const TIME_OPTIONS = generateTimeOptions();

// =====================================
// COMPONENT
// =====================================

export const HoursOfOperationEditor = memo(function HoursOfOperationEditor({
  hours,
  onChange,
  errors = {},
  disabled = false
}: HoursOfOperationEditorProps) {
  const handleDayChange = useCallback(
    (day: keyof HoursOfOperation, field: keyof DayHours, value: string | boolean) => {
      const updated = {
        ...hours,
        [day]: {
          ...hours[day],
          [field]: value
        }
      };
      onChange(updated);
    },
    [hours, onChange]
  );

  const handleCopyToAll = useCallback(
    (sourceDay: keyof HoursOfOperation) => {
      const source = hours[sourceDay];
      const updated: HoursOfOperation = {
        monday: { ...source },
        tuesday: { ...source },
        wednesday: { ...source },
        thursday: { ...source },
        friday: { ...source },
        saturday: { ...source },
        sunday: { ...source }
      };
      onChange(updated);
    },
    [hours, onChange]
  );

  const handleCopyToWeekdays = useCallback(
    (sourceDay: keyof HoursOfOperation) => {
      const source = hours[sourceDay];
      const updated: HoursOfOperation = {
        ...hours,
        monday: { ...source },
        tuesday: { ...source },
        wednesday: { ...source },
        thursday: { ...source },
        friday: { ...source }
      };
      onChange(updated);
    },
    [hours, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide px-2">
        <div className="col-span-2">Day</div>
        <div className="col-span-1 text-center">Active</div>
        <div className="col-span-3">Start Time</div>
        <div className="col-span-3">End Time</div>
        <div className="col-span-3">Actions</div>
      </div>

      {/* Day Rows */}
      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const dayHours = hours[key];
          const error = errors[key];

          return (
            <div
              key={key}
              className={`
                grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-3 rounded-lg
                ${dayHours.active ? 'bg-white border border-gray-200' : 'bg-gray-50 border border-gray-100'}
                ${error ? 'ring-2 ring-red-200' : ''}
              `}
            >
              {/* Day Name */}
              <div className="sm:col-span-2">
                <span className={`font-medium ${dayHours.active ? 'text-gray-900' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>

              {/* Active Toggle */}
              <div className="sm:col-span-1 flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={dayHours.active}
                  onChange={(e) => handleDayChange(key, 'active', e.target.checked)}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 disabled:opacity-50"
                  aria-label={`${label} active`}
                />
              </div>

              {/* Start Time */}
              <div className="sm:col-span-3">
                <label className="sr-only">Start time for {label}</label>
                <select
                  value={dayHours.start}
                  onChange={(e) => handleDayChange(key, 'start', e.target.value)}
                  disabled={disabled || !dayHours.active}
                  className={`
                    w-full px-3 py-2 text-sm rounded-md border
                    focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                    disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
                    ${dayHours.active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'}
                  `}
                >
                  {TIME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* End Time */}
              <div className="sm:col-span-3">
                <label className="sr-only">End time for {label}</label>
                <select
                  value={dayHours.end}
                  onChange={(e) => handleDayChange(key, 'end', e.target.value)}
                  disabled={disabled || !dayHours.active}
                  className={`
                    w-full px-3 py-2 text-sm rounded-md border
                    focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                    disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
                    ${dayHours.active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'}
                  `}
                >
                  {TIME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="sm:col-span-3 flex gap-1">
                <button
                  type="button"
                  onClick={() => handleCopyToAll(key)}
                  disabled={disabled}
                  className="text-xs text-gray-500 hover:text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-orange-50"
                  title="Copy to all days"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyToWeekdays(key)}
                  disabled={disabled}
                  className="text-xs text-gray-500 hover:text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-orange-50"
                  title="Copy to weekdays (Mon-Fri)"
                >
                  Weekdays
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="sm:col-span-12 text-xs text-red-600 mt-1">
                  {error}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help Text */}
      <p className="text-xs text-gray-500 mt-2">
        Calls outside these hours will not be routed to this buyer.
        Times are based on the selected timezone.
      </p>
    </div>
  );
});
