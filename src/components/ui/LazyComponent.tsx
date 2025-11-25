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
          <LazyComponent {...(componentProps as P)} />
        </Suspense>
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = `LazyComponent(${LazyComponent.displayName || 'Component'})`;
  
  return WrappedComponent;
};

// Pre-configured lazy components for common patterns
export const LazyModal = withLazyLoading(
  () => import('../admin/AdminLayout').then(module => ({ default: module.default })),
  {
    skeleton: (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <SkeletonLoader variant="text" height="24px" className="mb-4" />
          <SkeletonLoader variant="text" lines={3} className="mb-6" />
          <div className="flex justify-end space-x-2">
            <SkeletonLoader variant="rectangular" width="80px" height="36px" />
            <SkeletonLoader variant="rectangular" width="100px" height="36px" />
          </div>
        </div>
      </div>
    )
  }
);

export const LazyChart = withLazyLoading(
  () => import('../charts/LineChart').then(module => ({ default: module.default })),
  {
    skeleton: (
      <div className="p-6">
        <SkeletonLoader variant="text" height="20px" width="200px" className="mb-4" />
        <SkeletonLoader variant="rectangular" height="300px" />
      </div>
    )
  }
);

export const LazyTable = withLazyLoading(
  () => import('../admin/LeadTable').then(module => ({ default: module.default })),
  { skeleton: 'table' }
);

export const LazyForm = withLazyLoading(
  () => import('../forms/dynamic/DynamicForm').then(module => ({ default: module.DynamicForm })),
  { skeleton: 'form' }
);

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