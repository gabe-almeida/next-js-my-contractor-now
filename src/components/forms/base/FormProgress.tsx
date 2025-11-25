'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface FormProgressProps {
  progress: number; // 0-100
  showPercentage?: boolean;
  showSteps?: boolean;
  currentStep?: number;
  totalSteps?: number;
  stepLabels?: string[];
  variant?: 'line' | 'circle' | 'steps';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function FormProgress({
  progress,
  showPercentage = true,
  showSteps = false,
  currentStep,
  totalSteps,
  stepLabels = [],
  variant = 'line',
  size = 'md',
  className
}: FormProgressProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  if (variant === 'circle') {
    return (
      <CircularProgress
        progress={clampedProgress}
        showPercentage={showPercentage}
        size={size}
        className={className}
      />
    );
  }

  if (variant === 'steps') {
    return (
      <SteppedProgress
        currentStep={currentStep || Math.ceil((clampedProgress / 100) * (totalSteps || 1))}
        totalSteps={totalSteps || stepLabels.length || 1}
        stepLabels={stepLabels}
        size={size}
        className={className}
      />
    );
  }

  return (
    <LinearProgress
      progress={clampedProgress}
      showPercentage={showPercentage}
      size={size}
      className={className}
    />
  );
}

function LinearProgress({
  progress,
  showPercentage,
  size,
  className
}: {
  progress: number;
  showPercentage: boolean;
  size: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const textClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={cn('w-full', className)}>
      {showPercentage && (
        <div className={cn('flex justify-between items-center mb-2', textClasses[size])}>
          <span className="text-gray-700 font-medium">Progress</span>
          <span className="text-gray-600">{Math.round(progress)}%</span>
        </div>
      )}
      
      <div className={cn(
        'w-full bg-gray-200 rounded-full overflow-hidden',
        heightClasses[size]
      )}>
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out rounded-full',
            progress < 25 ? 'bg-red-500' :
            progress < 50 ? 'bg-yellow-500' :
            progress < 75 ? 'bg-blue-500' :
            progress < 100 ? 'bg-blue-600' :
            'bg-green-500'
          )}
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Form completion: ${Math.round(progress)}%`}
        />
      </div>
    </div>
  );
}

function CircularProgress({
  progress,
  showPercentage,
  size,
  className
}: {
  progress: number;
  showPercentage: boolean;
  size: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  const textClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg'
  };

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', sizeClasses[size], className)}>
      <svg
        className="transform -rotate-90"
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
      >
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-gray-200"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn(
            'transition-all duration-500 ease-out',
            progress < 25 ? 'text-red-500' :
            progress < 50 ? 'text-yellow-500' :
            progress < 75 ? 'text-blue-500' :
            progress < 100 ? 'text-blue-600' :
            'text-green-500'
          )}
        />
      </svg>
      
      {showPercentage && (
        <div className={cn(
          'absolute inset-0 flex items-center justify-center',
          textClasses[size],
          'font-semibold text-gray-700'
        )}>
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
}

function SteppedProgress({
  currentStep,
  totalSteps,
  stepLabels,
  size,
  className
}: {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  size: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const stepSizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base'
  };

  const textClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;

          return (
            <div key={stepNumber} className="flex flex-col items-center flex-1">
              {/* Step Circle */}
              <div className="relative flex items-center">
                {index > 0 && (
                  <div className={cn(
                    'absolute right-full w-full h-0.5 -mr-px',
                    isCompleted ? 'bg-green-500' : 'bg-gray-300'
                  )} />
                )}
                
                <div className={cn(
                  'flex items-center justify-center rounded-full border-2 font-medium transition-all duration-200',
                  stepSizeClasses[size],
                  isCompleted && 'bg-green-500 border-green-500 text-white',
                  isCurrent && 'bg-blue-500 border-blue-500 text-white',
                  isUpcoming && 'bg-white border-gray-300 text-gray-500'
                )}>
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>
              </div>

              {/* Step Label */}
              {stepLabels[index] && (
                <div className={cn(
                  'mt-2 text-center font-medium',
                  textClasses[size],
                  isCompleted && 'text-green-700',
                  isCurrent && 'text-blue-700',
                  isUpcoming && 'text-gray-500'
                )}>
                  {stepLabels[index]}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}