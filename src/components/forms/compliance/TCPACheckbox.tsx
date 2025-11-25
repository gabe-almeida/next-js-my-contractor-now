'use client';

import { useState } from 'react';
import { TCPAConfig } from '@/config/tcpa';

interface TCPACheckboxProps {
  config: TCPAConfig;
  isContactValid: boolean;
  value: boolean;
  onChange: (accepted: boolean) => void;
  className?: string;
}

export default function TCPACheckbox({
  config,
  isContactValid,
  value,
  onChange,
  className = ''
}: TCPACheckboxProps) {
  const [isFocused, setIsFocused] = useState(false);

  // Only show checkbox if contact info is valid (when configured to do so)
  if (config.showOnlyWhenContactValid && !isContactValid) {
    return null;
  }

  return (
    <div className={`tcpa-checkbox ${className}`}>
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <label className="flex items-start space-x-3 cursor-pointer">
          <div className="flex-shrink-0 mt-1">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => onChange(e.target.checked)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className={`
                w-4 h-4 text-orange-600 border-2 rounded focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
                ${isFocused ? 'border-orange-500' : 'border-gray-300'}
                ${value ? 'bg-orange-600 border-orange-600' : 'bg-white'}
              `}
              required={config.isRequired}
            />
          </div>
          <div className="flex-1">
            <div 
              className="text-sm text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: config.text }}
            />
          </div>
        </label>
      </div>
      
    </div>
  );
}