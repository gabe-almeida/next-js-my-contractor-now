'use client';

import { ButtonHTMLAttributes, forwardRef, memo } from 'react';
import { clsx } from 'clsx';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoadingSpinner } from './LoadingSpinner';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background relative overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white hover:bg-blue-700',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        outline: 'border border-gray-300 bg-transparent hover:bg-gray-50',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
        ghost: 'hover:bg-gray-100 hover:text-gray-900',
        link: 'underline-offset-4 hover:underline text-blue-600',
      },
      size: {
        default: 'h-10 py-2 px-4',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  'aria-describedby'?: string;
}

const Button = memo(forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    loading, 
    loadingText,
    icon,
    iconPosition = 'left',
    fullWidth,
    children, 
    disabled,
    type = 'button',
    ...props 
  }, ref) => {
    const isDisabled = disabled || loading;
    
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={clsx(
          buttonVariants({ variant, size }),
          fullWidth && 'w-full',
          className
        )}
        aria-disabled={isDisabled}
        {...props}
      >
        <span className="flex items-center justify-center gap-2">
          {loading ? (
            <>
              <LoadingSpinner 
                size="sm" 
                color={variant === 'outline' ? 'blue' : 'white'} 
                aria-hidden="true"
              />
              <span>{loadingText || children}</span>
            </>
          ) : (
            <>
              {icon && iconPosition === 'left' && (
                <span className="-ml-1" aria-hidden="true">{icon}</span>
              )}
              <span>{children}</span>
              {icon && iconPosition === 'right' && (
                <span className="-mr-1" aria-hidden="true">{icon}</span>
              )}
            </>
          )}
        </span>
      </button>
    );
  }
));

Button.displayName = 'Button';

export { Button, buttonVariants };