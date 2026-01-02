'use client';

import React, { Suspense, lazy, ComponentType } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { LoadingSpinner } from './LoadingSpinner';
import { SkeletonLoader } from './SkeletonLoader';

interface LazyComponentProps {
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  skeleton?: 'card' | 'form' | 'table' | React.ReactNode;
  className?: string;
}

// Higher-order component for lazy loading
export const withLazyLoading = <P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  options: LazyComponentProps = {}
) => {
  const LazyComponent = lazy(importFunc);
  
  const WrappedComponent = (props: P & LazyComponentProps) => {
    const { 
      fallback, 
      errorFallback, 
      skeleton, 
      className,
      ...componentProps 
    } = props;

    let loadingFallback = fallback;
    
    if (!loadingFallback) {
      if (skeleton === 'card') {
        loadingFallback = (
          <div className={className}>
            <SkeletonLoader variant="rectangular" height="200px" className="mb-4" />
            <SkeletonLoader variant="text" lines={3} />
          </div>
        );
      } else if (skeleton === 'form') {
        loadingFallback = (
          <div className={className}>
            <SkeletonLoader variant="text" height="24px" className="mb-6" />
            <div className="space-y-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i}>
                  <SkeletonLoader variant="text" height="16px" width="120px" className="mb-2" />
                  <SkeletonLoader variant="rectangular" height="40px" />
                </div>
              ))}
            </div>
          </div>
        );
      } else if (skeleton === 'table') {
        loadingFallback = (
          <div className={className}>
            <SkeletonLoader variant="text" height="20px" className="mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="grid grid-cols-4 gap-4">
                  <SkeletonLoader variant="text" height="16px" />
                  <SkeletonLoader variant="text" height="16px" />
                  <SkeletonLoader variant="text" height="16px" />
                  <SkeletonLoader variant="text" height="16px" />
                </div>
              ))}
            </div>
          </div>
        );
      } else if (React.isValidElement(skeleton)) {
        loadingFallback = skeleton;
      } else {
        loadingFallback = (
          <div className={`flex items-center justify-center p-8 ${className || ''}`}>
            <LoadingSpinner size="lg" label="Loading component..." />
          </div>
        );
      }
    }

    return (
      <ErrorBoundary fallback={errorFallback}>
        <Suspense fallback={loadingFallback}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <LazyComponent {...(componentProps as any)} />
        </Suspense>
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = 'LazyComponent';
  
  return WrappedComponent;
};

// Pre-configured lazy components - commented out due to TypeScript complexity
// These can be instantiated at usage site with withLazyLoading
// export const LazyModal = withLazyLoading(...);
// export const LazyChart = withLazyLoading(...);
// export const LazyTable = withLazyLoading(...);
// export const LazyForm = withLazyLoading(...);

// Intersection Observer based lazy loading for better performance
export const LazyOnScroll: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  threshold?: number;
  className?: string;
}> = ({ 
  children, 
  fallback, 
  rootMargin = '100px',
  threshold = 0.1,
  className 
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const elementRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const element = elementRef.current;
    if (!element || hasLoaded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setHasLoaded(true);
            observer.unobserve(element);
          }
        });
      },
      {
        rootMargin,
        threshold
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [rootMargin, threshold, hasLoaded]);

  return (
    <div ref={elementRef} className={className}>
      {isVisible ? (
        children
      ) : (
        fallback || (
          <div className="flex items-center justify-center p-8">
            <LoadingSpinner size="md" />
          </div>
        )
      )}
    </div>
  );
};