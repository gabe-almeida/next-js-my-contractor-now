'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { RadarAddress, RadarAutocompleteResult } from '@/types/address';
import { useRadar } from '@/hooks/useRadar';
import { parseAddress, validateAddressInput, FallbackAddress } from '@/lib/external/radar-fallback';

interface AddressAutocompleteProps {
  value?: string;
  placeholder?: string;
  onAddressSelect: (address: string, zipCode?: string) => void;
  onInputChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  error?: string;
}

export default function AddressAutocomplete({
  value = '',
  placeholder = 'Enter your address',
  onAddressSelect,
  onInputChange,
  disabled = false,
  className = '',
  error
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<RadarAutocompleteResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Use the Radar hook
  const { isReady, isLoading: radarLoading, error: radarError, fallbackMode, searchAddresses: radarSearch } = useRadar();

  // Handle API autocomplete search
  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    
    try {
      if (fallbackMode) {
        // Use fallback address parsing
        const parsed = parseAddress(query);
        if (parsed) {
          const fallbackResult: RadarAutocompleteResult = {
            address: {
              formattedAddress: parsed.formattedAddress,
              addressLabel: parsed.addressLabel,
              postalCode: parsed.postalCode,
              city: parsed.city,
              state: parsed.state,
              country: 'US'
            } as RadarAddress
          };
          setSuggestions([fallbackResult]);
        } else {
          setSuggestions([]);
        }
      } else {
        const results = await radarSearch(query);
        setSuggestions(results);
      }
    } catch (error) {
      console.error('Address search error:', error);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, [radarSearch, fallbackMode]);

  // Debounced input handler
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      // Search if we have input AND either Radar is ready OR we're in fallback mode
      if (inputValue.trim() && (isReady || fallbackMode)) {
        searchAddresses(inputValue.trim());
      } else if (!inputValue.trim()) {
        setSuggestions([]);
      }
      // Don't clear suggestions while Radar is still loading
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [inputValue, searchAddresses, fallbackMode, isReady]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setSelectedIndex(-1);
    onInputChange?.(newValue);
  };

  const handleAddressSelect = (address: RadarAutocompleteResult) => {
    const formattedAddress = address.address?.formattedAddress || address.address?.addressLabel || 'Selected Address';
    const zipCode = address.address?.postalCode;
    
    setInputValue(formattedAddress);
    setIsOpen(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    
    onAddressSelect(formattedAddress, zipCode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter' && inputValue.trim()) {
        // Handle Enter key when no suggestions (fallback or manual entry)
        e.preventDefault();
        const validation = validateAddressInput(inputValue);
        if (validation.isValid) {
          const parsed = parseAddress(inputValue);
          onAddressSelect(inputValue.trim(), parsed?.postalCode);
          setIsOpen(false);
        }
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleAddressSelect(suggestions[selectedIndex]);
        } else if (inputValue.trim()) {
          // Manual entry
          const validation = validateAddressInput(inputValue);
          if (validation.isValid) {
            const parsed = parseAddress(inputValue);
            onAddressSelect(inputValue.trim(), parsed?.postalCode);
            setIsOpen(false);
          }
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const clearInput = () => {
    setInputValue('');
    setIsOpen(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    onInputChange?.('');
    inputRef.current?.focus();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const inputClasses = `
    w-full px-4 py-3 pr-12 border-2 rounded-xl focus:ring-2 focus:ring-orange-500
    transition-colors ${error
      ? 'border-red-300 focus:border-red-500'
      : 'border-orange-400 focus:border-orange-500'
    } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
    ${className}
  `.trim();

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClasses}
          autoComplete="off"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
        />
        
        {/* Loading spinner or clear button */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
          {(isSearching || radarLoading) && (
            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          )}
          {inputValue && !isSearching && !radarLoading && (
            <button
              type="button"
              onClick={clearInput}
              className="text-orange-400 hover:text-orange-600 transition-colors"
              aria-label="Clear address"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          <MapPinIcon className="w-5 h-5 text-orange-500" />
        </div>
      </div>

      {/* Error message */}
      {(error || radarError) && (
        <p className="mt-1 text-sm text-red-600">{error || radarError}</p>
      )}

      {/* Fallback mode notice */}
      {fallbackMode && (
        <div className="mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          <div className="flex items-center space-x-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Address suggestions unavailable. You can still enter your address or ZIP code manually.</span>
          </div>
        </div>
      )}

      {/* Dropdown suggestions */}
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white border-2 border-orange-400 rounded-xl shadow-lg max-h-60 overflow-auto"
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.address?.formattedAddress || 'address'}-${index}`}
              type="button"
              onClick={() => handleAddressSelect(suggestion)}
              className={`w-full px-4 py-3 text-left hover:bg-orange-50 focus:bg-orange-50 focus:outline-none border-b border-orange-100 last:border-b-0 transition-colors ${
                index === selectedIndex ? 'bg-orange-50' : ''
              }`}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <div className="flex items-start space-x-3">
                <MapPinIcon className="w-4 h-4 text-orange-500 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-orange-700 truncate">
                    {(suggestion.address?.addressLabel || suggestion.address?.formattedAddress || 'Address').replace(/, US$/, '').replace(' US', '')}
                  </div>
                  {suggestion.address?.addressLabel && suggestion.address?.formattedAddress && (
                    <div className="text-xs text-orange-500 truncate">
                      {suggestion.address.formattedAddress.replace(/, US$/, '').replace(' US', '')}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      
    </div>
  );
}