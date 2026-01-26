'use client';

import React from 'react';
import { Check, X, Loader2 } from 'lucide-react';

/**
 * InlineSaveButtons - Save/Discard buttons for inline field editing
 *
 * WHY: Provide consistent save/discard UI for fields that sync immediately to database
 * WHEN: Used internally by smart field components when `inline` prop is provided
 * HOW: Renders checkmark (save) and X (discard) buttons with loading/success states
 *
 * This is an INTERNAL component used by PhoneInput, CurrencyInput, EmailInput, etc.
 * For external use, pass the `inline` prop to those components instead.
 */

export interface InlineConfig {
  /** Called when save button clicked - receives current value */
  onSave: () => void | Promise<void>;
  /** Called when discard button clicked - should reset to original value */
  onDiscard: () => void;
  /** Whether the field value has changed from original */
  hasChanges: boolean;
  /** Whether a save operation is in progress */
  saving?: boolean;
  /** Whether the last save was successful (shows green checkmark briefly) */
  saveSuccess?: boolean;
  /** Position of buttons relative to field */
  position?: 'right' | 'below';
}

interface InlineSaveButtonsProps {
  config: InlineConfig;
  /** Whether the field has a value (disables save if empty) */
  hasValue: boolean;
}

/**
 * Internal component for rendering save/discard buttons.
 * Used by smart field components when inline editing is enabled.
 */
export function InlineSaveButtons({ config, hasValue }: InlineSaveButtonsProps) {
  const {
    onSave,
    onDiscard,
    hasChanges,
    saving = false,
    saveSuccess = false,
    position = 'right',
  } = config;

  const handleSave = async () => {
    if (saving || !hasValue) return;
    if (typeof onSave === 'function') {
      await onSave();
    } else {
      console.error('InlineSaveButtons: onSave is not a function', { onSave });
    }
  };

  if (position === 'below') {
    return (
      <div className="flex justify-end gap-1 mt-2">
        {hasChanges && (
          <button
            type="button"
            onClick={() => {
              if (typeof onDiscard === 'function') {
                onDiscard();
              } else {
                console.error('InlineSaveButtons: onDiscard is not a function', { onDiscard });
              }
            }}
            disabled={saving}
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasValue}
          className={`px-2 py-1 text-xs rounded flex items-center gap-1 disabled:opacity-50 ${
            saveSuccess
              ? 'bg-green-100 text-green-700 border border-green-300'
              : 'bg-orange-500 text-white hover:bg-orange-600'
          }`}
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          {saveSuccess ? 'Saved!' : 'Save'}
        </button>
      </div>
    );
  }

  // Position: right (icon buttons)
  return (
    <div className="absolute right-0 top-7 flex gap-1">
      {/* Discard button (X) - only show when there are changes */}
      {hasChanges && (
        <button
          type="button"
          onClick={() => {
            if (typeof onDiscard === 'function') {
              onDiscard();
            } else {
              console.error('InlineSaveButtons: onDiscard is not a function', { onDiscard });
            }
          }}
          disabled={saving}
          className="p-2 rounded-md bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
          title="Discard changes"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      {/* Save button (checkmark) */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !hasValue}
        className={`p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          saveSuccess
            ? 'bg-green-100 text-green-600'
            : 'bg-gray-100 hover:bg-orange-100 text-gray-600 hover:text-orange-600'
        }`}
        title={saveSuccess ? 'Saved!' : 'Save'}
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Check className={`w-5 h-5 ${saveSuccess ? 'text-green-600' : ''}`} />
        )}
      </button>
    </div>
  );
}

export default InlineSaveButtons;
