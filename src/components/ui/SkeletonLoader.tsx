'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface SkeletonLoaderProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
  animate?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className,
  variant = 'rectangular',
  width,
  height,
  lines = 1,
  animate = true
}) => {
  const baseClasses = cn(
    'bg-gray-200',
    animate && 'animate-pulse',
    className
  );

  if (variant === 'text') {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={cn(
              baseClasses,
              'h-4 rounded',
              i === lines - 1 && lines > 1 && 'w-3/4' // Last line shorter
            )}
            style={{
              width: typeof width === 'number' ? `${width}px` : width,
              height: typeof height === 'number' ? `${height}px` : height
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'circular') {
    return (
      <div
        className={cn(baseClasses, 'rounded-full')}
        style={{
          width: width || height || '40px',
          height: height || width || '40px'
        }}
      />
    );
  }

  if (variant === 'rounded') {
    return (
      <div
        className={cn(baseClasses, 'rounded-lg')}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height
        }}
      />
    );
  }

  return (
    <div
      className={baseClasses}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height
      }}
    />
  );
};

// Common skeleton patterns
export const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('p-6 space-y-4', className)}>
    <SkeletonLoader variant="rectangular" height="200px" />
    <div className="space-y-2">
      <SkeletonLoader variant="text" height="20px" />
      <SkeletonLoader variant="text" height="16px" lines={3} />
    </div>
    <div className="flex space-x-3">
      <SkeletonLoader variant="rectangular" width="80px" height="36px" />
      <SkeletonLoader variant="rectangular" width="100px" height="36px" />
    </div>
  </div>
);

export const TableSkeleton: React.FC<{ 
  rows?: number; 
  columns?: number; 
  className?: string;
}> = ({ rows = 5, columns = 4, className }) => (
  <div className={cn('space-y-4', className)}>
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: columns }, (_, i) => (
        <SkeletonLoader key={`header-${i}`} variant="text" height="20px" />
      ))}
    </div>
    {Array.from({ length: rows }, (_, rowIndex) => (
      <div 
        key={`row-${rowIndex}`}
        className="grid gap-4" 
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {Array.from({ length: columns }, (_, colIndex) => (
          <SkeletonLoader 
            key={`cell-${rowIndex}-${colIndex}`} 
            variant="text" 
            height="16px" 
          />
        ))}
      </div>
    ))}
  </div>
);

export const FormSkeleton: React.FC<{ 
  fields?: number; 
  className?: string;
}> = ({ fields = 4, className }) => (
  <div className={cn('space-y-6', className)}>
    {Array.from({ length: fields }, (_, i) => (
      <div key={`field-${i}`} className="space-y-2">
        <SkeletonLoader variant="text" height="16px" width="120px" />
        <SkeletonLoader variant="rectangular" height="40px" />
      </div>
    ))}
    <div className="flex justify-end space-x-3">
      <SkeletonLoader variant="rectangular" width="80px" height="40px" />
      <SkeletonLoader variant="rectangular" width="100px" height="40px" />
    </div>
  </div>
);