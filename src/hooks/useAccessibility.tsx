'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';

interface AccessibilityOptions {
  announceChanges?: boolean;
  trapFocus?: boolean;
  manageFocus?: boolean;
  highContrast?: boolean;
  reducedMotion?: boolean;
}

export const useAccessibility = (options: AccessibilityOptions = {}) => {
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [screenReaderOnly, setScreenReaderOnly] = useState(false);
  
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useRef<HTMLElement>(null);

  // Detect user preferences
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check for high contrast preference
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(highContrastQuery.matches);
    
    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
    };
    
    highContrastQuery.addEventListener('change', handleHighContrastChange);

    // Check for reduced motion preference
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(reducedMotionQuery.matches);
    
    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
    };
    
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

    // Detect screen reader
    const detectScreenReader = () => {
      const isScreenReader = window.speechSynthesis?.getVoices?.().length > 0 ||
                           'speechSynthesis' in window ||
                           navigator.userAgent.includes('NVDA') ||
                           navigator.userAgent.includes('JAWS') ||
                           navigator.userAgent.includes('VoiceOver');
      setScreenReaderOnly(isScreenReader);
    };
    
    detectScreenReader();
    
    // Sometimes voices load asynchronously
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = detectScreenReader;
    }

    return () => {
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
    };
  }, []);

  // Announce content changes to screen readers
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!options.announceChanges || !liveRegionRef.current) return;

    const liveRegion = liveRegionRef.current;
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.textContent = message;

    // Clear the message after announcement
    setTimeout(() => {
      if (liveRegion) {
        liveRegion.textContent = '';
      }
    }, 1000);
  }, [options.announceChanges]);

  // Focus management
  const focusElement = useCallback((selector: string | HTMLElement) => {
    if (!options.manageFocus) return;

    const element = typeof selector === 'string' 
      ? document.querySelector(selector) as HTMLElement
      : selector;

    if (element) {
      element.focus();
      element.scrollIntoView({ 
        behavior: isReducedMotion ? 'auto' : 'smooth',
        block: 'center'
      });
    }
  }, [options.manageFocus, isReducedMotion]);

  // Focus trap for modals/dialogs
  const trapFocus = useCallback((containerRef: React.RefObject<HTMLElement>) => {
    if (!options.trapFocus || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [options.trapFocus]);

  // Keyboard navigation helpers
  const handleKeyboardNavigation = useCallback((
    e: React.KeyboardEvent,
    options: {
      onEnter?: () => void;
      onSpace?: () => void;
      onEscape?: () => void;
      onArrowUp?: () => void;
      onArrowDown?: () => void;
      onArrowLeft?: () => void;
      onArrowRight?: () => void;
    }
  ) => {
    switch (e.key) {
      case 'Enter':
        options.onEnter?.();
        break;
      case ' ':
        e.preventDefault();
        options.onSpace?.();
        break;
      case 'Escape':
        options.onEscape?.();
        break;
      case 'ArrowUp':
        e.preventDefault();
        options.onArrowUp?.();
        break;
      case 'ArrowDown':
        e.preventDefault();
        options.onArrowDown?.();
        break;
      case 'ArrowLeft':
        options.onArrowLeft?.();
        break;
      case 'ArrowRight':
        options.onArrowRight?.();
        break;
    }
  }, []);

  // Skip link functionality
  const createSkipLink = useCallback((targetId: string, label: string) => {
    return {
      href: `#${targetId}`,
      'aria-label': label,
      className: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded',
      onFocus: () => announce(`Skip link: ${label}`)
    };
  }, [announce]);

  // Live region component
  const LiveRegion = useCallback(() => (
    <div
      ref={liveRegionRef}
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  ), []);

  return {
    // State
    isHighContrast,
    isReducedMotion,
    screenReaderOnly,
    
    // Functions
    announce,
    focusElement,
    trapFocus,
    handleKeyboardNavigation,
    createSkipLink,
    
    // Components
    LiveRegion,
    
    // Refs for integration
    liveRegionRef,
    focusTrapRef
  };
};

// Hook for accessible form enhancements
export const useAccessibleForm = () => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const errorAnnouncementRef = useRef<HTMLDivElement>(null);

  const announceFormError = useCallback((fieldName: string, error: string) => {
    setErrors(prev => ({ ...prev, [fieldName]: error }));
    
    if (errorAnnouncementRef.current) {
      errorAnnouncementRef.current.textContent = `Error in ${fieldName}: ${error}`;
    }
  }, []);

  const clearFormError = useCallback((fieldName: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  const getFieldProps = useCallback((fieldName: string, hasError: boolean) => ({
    'aria-invalid': hasError,
    'aria-describedby': hasError ? `${fieldName}-error` : undefined,
  }), []);

  const getErrorProps = useCallback((fieldName: string) => ({
    id: `${fieldName}-error`,
    role: 'alert',
    'aria-live': 'polite' as const,
  }), []);

  const ErrorAnnouncement = useCallback(() => (
    <div
      ref={errorAnnouncementRef}
      aria-live="assertive"
      aria-atomic="true"
      className="sr-only"
    />
  ), []);

  return {
    errors,
    announceFormError,
    clearFormError,
    getFieldProps,
    getErrorProps,
    ErrorAnnouncement
  };
};