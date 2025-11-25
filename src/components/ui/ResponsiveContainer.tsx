'use client';

import React, { memo, useState, useEffect } from 'react';
import { cn } from '@/utils/cn';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  center?: boolean;
  breakpoint?: 'mobile' | 'tablet' | 'desktop';
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full'
};

const paddingClasses = {
  none: 'px-0',
  sm: 'px-4',
  md: 'px-6',
  lg: 'px-8'
};

export const ResponsiveContainer = memo<ResponsiveContainerProps>(({
  children,
  className,
  maxWidth = '7xl',
  padding = 'md',
  center = true,
  breakpoint
}) => {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setCurrentBreakpoint('mobile');
      } else if (width < 1024) {
        setCurrentBreakpoint('tablet');
      } else {
        setCurrentBreakpoint('desktop');
      }
    };

    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);
    
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  const containerClasses = cn(
    'w-full',
    maxWidthClasses[maxWidth],
    paddingClasses[padding],
    center && 'mx-auto',
    className
  );

  // If breakpoint is specified and doesn't match current, render children directly
  if (breakpoint && breakpoint !== currentBreakpoint) {
    return <>{children}</>;
  }

  return (
    <div className={containerClasses}>
      {children}
    </div>
  );
});

ResponsiveContainer.displayName = 'ResponsiveContainer';

// Mobile-first responsive grid
export const ResponsiveGrid = memo<{
  children: React.ReactNode;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}>(({
  children,
  cols = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'md',
  className
}) => {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  };

  const gridClasses = cn(
    'grid',
    `grid-cols-${cols.mobile}`,
    `md:grid-cols-${cols.tablet}`,
    `lg:grid-cols-${cols.desktop}`,
    gapClasses[gap],
    className
  );

  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
});

ResponsiveGrid.displayName = 'ResponsiveGrid';

// Responsive stack component
export const ResponsiveStack = memo<{
  children: React.ReactNode;
  direction?: {
    mobile?: 'row' | 'column';
    tablet?: 'row' | 'column';
    desktop?: 'row' | 'column';
  };
  spacing?: 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  className?: string;
}>(({
  children,
  direction = { mobile: 'column', tablet: 'row', desktop: 'row' },
  spacing = 'md',
  align = 'stretch',
  justify = 'start',
  className
}) => {
  const spacingClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  };

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  };

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around'
  };

  const stackClasses = cn(
    'flex',
    direction.mobile === 'row' ? 'flex-row' : 'flex-col',
    direction.tablet && `md:${direction.tablet === 'row' ? 'flex-row' : 'flex-col'}`,
    direction.desktop && `lg:${direction.desktop === 'row' ? 'flex-row' : 'flex-col'}`,
    spacingClasses[spacing],
    alignClasses[align],
    justifyClasses[justify],
    className
  );

  return (
    <div className={stackClasses}>
      {children}
    </div>
  );
});

ResponsiveStack.displayName = 'ResponsiveStack';

// Hook for responsive breakpoint detection
export const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const updateBreakpoint = () => {
      const newWidth = window.innerWidth;
      setWidth(newWidth);
      
      if (newWidth < 768) {
        setBreakpoint('mobile');
      } else if (newWidth < 1024) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return {
    breakpoint,
    width,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isMobileOrTablet: breakpoint === 'mobile' || breakpoint === 'tablet'
  };
};