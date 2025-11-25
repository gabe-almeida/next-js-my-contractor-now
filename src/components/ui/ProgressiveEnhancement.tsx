'use client';

import React, { useState, useEffect, memo, Suspense } from 'react';
import { useBrowserSupport } from '@/utils/browserSupport';
import { LoadingSpinner } from './LoadingSpinner';

interface ProgressiveEnhancementProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  feature?: string;
  requiresJS?: boolean;
  gracefulDegradation?: boolean;
}

// Progressive enhancement wrapper
export const ProgressiveEnhancement = memo<ProgressiveEnhancementProps>(({
  children,
  fallback,
  feature,
  requiresJS = false,
  gracefulDegradation = true
}) => {
  const { supports } = useBrowserSupport();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Server-side rendering fallback
  if (!isClient && requiresJS) {
    return gracefulDegradation ? (fallback || <BasicFallback />) : null;
  }

  // Feature detection
  if (feature && !supports(feature)) {
    return gracefulDegradation ? (fallback || <BasicFallback />) : null;
  }

  return <>{children}</>;
});

ProgressiveEnhancement.displayName = 'ProgressiveEnhancement';

// Basic fallback component
const BasicFallback = memo(() => (
  <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
    <p className="text-sm text-gray-600">
      Enhanced features are not available in your browser. Basic functionality is still accessible.
    </p>
  </div>
));

BasicFallback.displayName = 'BasicFallback';

// Enhanced form with progressive features
export const ProgressiveForm = memo<{
  children: React.ReactNode;
  onSubmit: (data: FormData) => Promise<void>;
  className?: string;
}>(({ children, onSubmit, className }) => {
  const { supports } = useBrowserSupport();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!supports('fetch')) {
      // Fallback to native form submission
      e.currentTarget.submit();
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
      // Fallback to native submission on error
      e.currentTarget.submit();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className={className}
      noValidate={isClient && supports('formData')}
    >
      {children}
      
      {isClient && supports('fetch') && isSubmitting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <LoadingSpinner size="sm" />
            <span className="text-sm">Submitting...</span>
          </div>
        </div>
      )}
    </form>
  );
});

ProgressiveForm.displayName = 'ProgressiveForm';

// Enhanced image with modern format support
export const ProgressiveImage = memo<{
  src: string;
  webpSrc?: string;
  avifSrc?: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  lazy?: boolean;
}>(({ src, webpSrc, avifSrc, alt, width, height, className, lazy = true }) => {
  const { supports } = useBrowserSupport();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Determine the best image format to use
  const imageSrc = React.useMemo(() => {
    if (avifSrc && supports('avif')) return avifSrc;
    if (webpSrc && supports('webp')) return webpSrc;
    return src;
  }, [src, webpSrc, avifSrc, supports]);

  const handleLoad = () => setLoaded(true);
  const handleError = () => {
    setError(true);
    setLoaded(true);
  };

  return (
    <div className={`relative ${className || ''}`}>
      {/* Fallback for browsers without picture element */}
      {!supports('webp') || error ? (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={className}
          loading={lazy ? 'lazy' : 'eager'}
          onLoad={handleLoad}
          onError={handleError}
        />
      ) : (
        <picture>
          {avifSrc && <source srcSet={avifSrc} type="image/avif" />}
          {webpSrc && <source srcSet={webpSrc} type="image/webp" />}
          <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            className={className}
            loading={lazy ? 'lazy' : 'eager'}
            onLoad={handleLoad}
            onError={handleError}
          />
        </picture>
      )}

      {/* Loading state */}
      {!loaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 bg-gray-300 rounded" />
        </div>
      )}
    </div>
  );
});

ProgressiveImage.displayName = 'ProgressiveImage';

// Enhanced button with offline support
export const ProgressiveButton = memo<{
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}>(({ children, onClick, href, className, type = 'button', disabled }) => {
  const { supports } = useBrowserSupport();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (!supports('serviceWorkers')) return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [supports]);

  const isDisabled = disabled || (isOffline && href);

  if (href && !isDisabled) {
    return (
      <a 
        href={href} 
        className={className}
        onClick={(e) => {
          if (onClick && supports('fetch')) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {children}
        {isOffline && (
          <span className="ml-2 text-xs text-yellow-600">
            (Offline)
          </span>
        )}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={className}
    >
      {children}
      {isOffline && (
        <span className="ml-2 text-xs text-yellow-600">
          (Offline)
        </span>
      )}
    </button>
  );
});

ProgressiveButton.displayName = 'ProgressiveButton';

// Enhanced input with validation
export const ProgressiveInput = memo<{
  type: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  pattern?: string;
  'aria-describedby'?: string;
}>(({ type, name, placeholder, required, className, pattern, ...props }) => {
  const { supports } = useBrowserSupport();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <input
      type={type}
      name={name}
      placeholder={placeholder}
      required={required}
      className={className}
      pattern={pattern}
      // Only use client-side validation if supported
      noValidate={isClient && supports('formData')}
      {...props}
    />
  );
});

ProgressiveInput.displayName = 'ProgressiveInput';

// HOC for progressive enhancement
export const withProgressiveEnhancement = <P extends object>(
  Component: React.ComponentType<P>,
  options: {
    feature?: string;
    fallback?: React.ComponentType<P>;
    requiresJS?: boolean;
  } = {}
) => {
  const WrappedComponent = (props: P) => {
    const { supports } = useBrowserSupport();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
      setIsClient(true);
    }, []);

    // Check if we should render the enhanced component
    const shouldEnhance = isClient && 
                         (!options.feature || supports(options.feature)) &&
                         (!options.requiresJS || true);

    if (!shouldEnhance && options.fallback) {
      return <options.fallback {...props} />;
    }

    if (!shouldEnhance) {
      return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            This feature requires a modern browser.
          </p>
        </div>
      );
    }

    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Component {...props} />
      </Suspense>
    );
  };

  WrappedComponent.displayName = `withProgressiveEnhancement(${Component.displayName || Component.name})`;

  return WrappedComponent;
};