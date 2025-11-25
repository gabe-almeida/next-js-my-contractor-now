'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface DropdownItem {
  id: string;
  name: string;
}

interface PortalDropdownProps {
  items: DropdownItem[];
  selectedValue: string;
  placeholder: string;
  onSelect: (id: string, name: string) => void;
  className?: string;
}

export default function PortalDropdown({ 
  items, 
  selectedValue, 
  placeholder, 
  onSelect, 
  className = '' 
}: PortalDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ensure component is mounted (for SSR compatibility)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update button position when dropdown opens and on scroll
  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setButtonRect(rect);
      }
    };

    if (isOpen) {
      updatePosition();
      
      // Add scroll listener to update position when page scrolls
      const handleScroll = () => {
        updatePosition();
      };
      
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleItemSelect = (id: string, name: string) => {
    onSelect(id, name);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Dropdown Button */}
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className={`w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-4 text-left flex items-center justify-between text-gray-600 hover:bg-gray-100 transition-colors ${className}`}
      >
        <span className={selectedValue ? 'text-gray-800' : 'text-gray-500'}>
          {selectedValue || placeholder}
        </span>
        <ChevronDownIcon 
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Portal Dropdown Menu */}
      {isMounted && isOpen && buttonRect && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-white border border-gray-300 rounded-lg shadow-xl max-h-64 overflow-y-auto"
          style={{
            top: buttonRect.bottom + 4,
            left: buttonRect.left,
            width: buttonRect.width,
            zIndex: 999999, // Extremely high z-index since it's at document root
          }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemSelect(item.id, item.name)}
              className="w-full px-4 py-3 text-left hover:bg-orange-50 hover:text-orange-600 transition-colors text-gray-700 border-b border-gray-100 last:border-b-0"
            >
              {item.name}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}