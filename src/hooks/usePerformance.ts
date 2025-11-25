'use client';

import { useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  interactionDelay: number;
  memoryUsage?: number;
}

interface PerformanceOptions {
  trackRender?: boolean;
  trackInteraction?: boolean;
  trackMemory?: boolean;
  onMetricsCollected?: (metrics: PerformanceMetrics) => void;
}

export const usePerformance = (
  componentName: string,
  options: PerformanceOptions = {}
) => {
  const renderStartTime = useRef<number>();
  const interactionStartTime = useRef<number>();
  const mounted = useRef(true);

  const {
    trackRender = true,
    trackInteraction = true,
    trackMemory = false,
    onMetricsCollected
  } = options;

  // Track render performance
  useEffect(() => {
    if (!trackRender) return;

    renderStartTime.current = performance.now();

    return () => {
      if (renderStartTime.current && mounted.current) {
        const renderTime = performance.now() - renderStartTime.current;
        
        // Report render time if it's significant (>16ms for 60fps)
        if (renderTime > 16) {
          console.warn(`[Performance] ${componentName} render took ${renderTime.toFixed(2)}ms`);
        }

        if (onMetricsCollected) {
          const metrics: PerformanceMetrics = {
            renderTime,
            interactionDelay: 0
          };

          if (trackMemory && 'memory' in performance) {
            metrics.memoryUsage = (performance as any).memory?.usedJSHeapSize;
          }

          onMetricsCollected(metrics);
        }
      }
    };
  }, [componentName, trackRender, trackMemory, onMetricsCollected]);

  // Track interaction performance
  const trackInteraction = useCallback((interactionName: string) => {
    if (!trackInteraction) return () => {};

    const startTime = performance.now();
    interactionStartTime.current = startTime;

    return () => {
      if (interactionStartTime.current) {
        const interactionDelay = performance.now() - interactionStartTime.current;
        
        // Report slow interactions (>100ms)
        if (interactionDelay > 100) {
          console.warn(
            `[Performance] ${componentName}.${interactionName} took ${interactionDelay.toFixed(2)}ms`
          );
        }

        if (onMetricsCollected) {
          onMetricsCollected({
            renderTime: 0,
            interactionDelay
          });
        }
      }
    };
  }, [componentName, trackInteraction, onMetricsCollected]);

  // Memory usage monitoring
  const getMemoryUsage = useCallback(() => {
    if (!trackMemory || !('memory' in performance)) {
      return null;
    }

    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit
    };
  }, [trackMemory]);

  // Cleanup
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return {
    trackInteraction,
    getMemoryUsage
  };
};

// Hook for measuring component re-renders
export const useRenderCount = (componentName: string) => {
  const renderCount = useRef(0);
  const prevProps = useRef<any>();

  useEffect(() => {
    renderCount.current += 1;
    
    if (renderCount.current > 10) {
      console.warn(
        `[Performance] ${componentName} has rendered ${renderCount.current} times. Consider optimization.`
      );
    }
  });

  const trackPropsChange = useCallback((props: any) => {
    if (prevProps.current) {
      const changedProps = Object.keys(props).filter(
        key => props[key] !== prevProps.current[key]
      );

      if (changedProps.length > 0) {
        console.log(
          `[Performance] ${componentName} re-rendered due to props:`,
          changedProps
        );
      }
    }
    
    prevProps.current = props;
  }, [componentName]);

  return {
    renderCount: renderCount.current,
    trackPropsChange
  };
};

// Hook for lazy loading with Intersection Observer
export const useLazyLoad = (
  threshold = 0.1,
  rootMargin = '50px'
) => {
  const elementRef = useRef<HTMLElement>(null);
  const isVisible = useRef(false);
  const onVisible = useRef<(() => void) | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || isVisible.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isVisible.current) {
            isVisible.current = true;
            onVisible.current?.();
            observer.unobserve(element);
          }
        });
      },
      {
        threshold,
        rootMargin
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin]);

  const setOnVisible = useCallback((callback: () => void) => {
    onVisible.current = callback;
  }, []);

  return {
    ref: elementRef,
    isVisible: isVisible.current,
    setOnVisible
  };
};

// Web Vitals tracking
export const useWebVitals = () => {
  useEffect(() => {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(console.log);
      getFID(console.log);
      getFCP(console.log);
      getLCP(console.log);
      getTTFB(console.log);
    }).catch(() => {
      // Graceful fallback if web-vitals is not available
      console.log('[Performance] Web Vitals tracking not available');
    });
  }, []);
};