'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAccessibility } from '@/hooks/useAccessibility';

interface HeaderProps {
  showBackButton?: boolean;
  onBack?: () => void;
}

const Header = memo(function Header({ showBackButton, onBack }: HeaderProps) {
  const { createSkipLink, announce } = useAccessibility({
    announceChanges: true,
    manageFocus: true
  });

  const handleBackClick = () => {
    if (onBack) {
      announce('Navigating back');
      onBack();
    }
  };

  const handleLogoClick = () => {
    announce('Navigating to home page');
  };

  return (
    <>
      {/* Skip to main content link */}
      <a 
        {...createSkipLink('main-content', 'Skip to main content')}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50 transition-all focus:z-50"
      >
        Skip to main content
      </a>
      
      <header 
        className="bg-white shadow-sm" 
        role="banner"
        aria-label="Site header"
      >
        <div className="max-w-7xl mx-auto px-4 py-1">
          <div className="flex items-center justify-center relative">
            {showBackButton && onBack && (
              <button
                onClick={handleBackClick}
                className="absolute left-0 p-2 text-gray-600 hover:text-gray-800 focus:text-gray-800 transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Go back to previous page"
                type="button"
              >
                <svg 
                  className="w-6 h-6" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M15 19l-7-7 7-7" 
                  />
                </svg>
              </button>
            )}
            
            <Link 
              href="/" 
              className="flex items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={handleLogoClick}
              aria-label="My Contractor Now - Go to homepage"
            >
              <div className="relative w-64 h-16 flex-shrink-0">
                <Image
                  src="/assets/My-Contractor-Now-Logo-Orange-Black.png"
                  alt="My Contractor Now Logo"
                  fill
                  sizes="(max-width: 768px) 200px, 256px"
                  className="object-contain"
                  priority
                  loading="eager"
                />
              </div>
            </Link>
          </div>
        </div>
      </header>
    </>
  );
});

export default Header;