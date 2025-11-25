'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'spinner' | 'dots' | 'bars' | 'pulse';
  className?: string;
  label?: string;
  color?: 'blue' | 'gray' | 'white';
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6', 
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
};

const colorClasses = {
  blue: 'text-blue-600',
  gray: 'text-gray-600',
  white: 'text-white'
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'spinner',
  className,
  label,
  color = 'blue'
}) => {
  const baseClasses = cn(
    'animate-spin',
    sizeClasses[size],
    colorClasses[color],
    className
  );

  if (variant === 'spinner') {
    return (
      <div className="flex items-center justify-center" role="status" aria-label={label || 'Loading'}>
        <svg
          className={baseClasses}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        {label && <span className="sr-only">{label}</span>}
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className="flex space-x-1" role="status" aria-label={label || 'Loading'}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'rounded-full animate-pulse',
              size === 'sm' && 'w-1 h-1',
              size === 'md' && 'w-2 h-2',
              size === 'lg' && 'w-3 h-3',
              size === 'xl' && 'w-4 h-4',
              colorClasses[color].replace('text-', 'bg-'),
              className
            )}
            style={{
              animationDelay: `${i * 0.2}s`
            }}
          />
        ))}
        {label && <span className="sr-only">{label}</span>}
      </div>
    );
  }

  if (variant === 'bars') {
    return (
      <div className="flex space-x-1" role="status" aria-label={label || 'Loading'}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'animate-pulse',
              size === 'sm' && 'w-1 h-3',
              size === 'md' && 'w-1 h-4',
              size === 'lg' && 'w-2 h-5',
              size === 'xl' && 'w-2 h-6',
              colorClasses[color].replace('text-', 'bg-'),
              className
            )}
            style={{
              animationDelay: `${i * 0.1}s`,
              animationDuration: '0.8s'
            }}
          />
        ))}
        {label && <span className="sr-only">{label}</span>}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div role="status" aria-label={label || 'Loading'}>
        <div
          className={cn(
            'animate-pulse rounded-full',
            sizeClasses[size],
            colorClasses[color].replace('text-', 'bg-'),
            className
          )}
        />
        {label && <span className="sr-only">{label}</span>}
      </div>
    );
  }

  return null;
};

export const LoadingOverlay: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  spinnerProps?: LoadingSpinnerProps;
}> = ({ isLoading, children, className, spinnerProps }) => {
  if (!isLoading) return <>{children}</>;

  return (
    <div className={cn('relative', className)}>
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        <LoadingSpinner {...spinnerProps} />
      </div>
    </div>
  );
};