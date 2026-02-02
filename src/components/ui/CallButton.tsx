'use client';

/**
 * CallButton Component
 *
 * WHY: Provide consistent, accessible click-to-call UX with Dynamic Number
 *      Insertion (DNI) support. When visitors arrive via affiliate links,
 *      this button displays the affiliate's tracking number so they get
 *      credit for calls.
 *
 * WHEN: Any landing page, service page, or form needs a call option.
 *       Used on marketing pages, service detail pages, and alongside forms.
 *
 * HOW:
 *   1. Uses useDynamicNumber hook to get affiliate tracking number
 *   2. Falls back to provided fallback number if no affiliate number
 *   3. Renders accessible tel: link with proper ARIA attributes
 *   4. Shows loading skeleton while fetching
 */

import React, { memo, useCallback } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';
import { useDynamicNumber } from '@/hooks/useDynamicNumber';

// =====================================
// VARIANT STYLES
// =====================================

const callButtonVariants = cva(
  // Base styles - shared across all variants
  'inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary:
          'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500 shadow-md hover:shadow-lg',
        outline:
          'border-2 border-green-600 text-green-600 bg-transparent hover:bg-green-50 focus-visible:ring-green-500',
        minimal:
          'text-green-600 hover:text-green-700 hover:underline focus-visible:ring-green-500'
      },
      size: {
        sm: 'h-9 px-3 text-sm rounded-md gap-1.5',
        md: 'h-11 px-5 text-base rounded-lg gap-2',
        lg: 'h-14 px-7 text-lg rounded-xl gap-2.5'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6'
};

const skeletonSizes = {
  sm: 'h-9 w-32',
  md: 'h-11 w-40',
  lg: 'h-14 w-48'
};

// =====================================
// TYPE DEFINITIONS
// =====================================

export interface CallButtonProps extends VariantProps<typeof callButtonVariants> {
  /** Service type slug (e.g., "windows", "roofing") - required for DNI */
  service: string;
  /** Fallback phone number if no affiliate number (E.164 format) */
  fallbackNumber?: string;
  /** Display format for fallback number: (xxx) xxx-xxxx */
  fallbackDisplayNumber?: string;
  /** Show phone number text on button */
  showNumber?: boolean;
  /** Custom button text (replaces default "Call Now") */
  text?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback fired when button is clicked */
  onClick?: () => void;
  /** Disable the button */
  disabled?: boolean;
  /** Skip DNI fetch (just use fallback) */
  skipDni?: boolean;
  /** Show affiliate attribution (e.g., "via John's Marketing") */
  showAttribution?: boolean;
}

// =====================================
// PHONE ICON COMPONENT
// =====================================

const PhoneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z"
      clipRule="evenodd"
    />
  </svg>
);

// =====================================
// LOADING SKELETON
// =====================================

const CallButtonSkeleton: React.FC<{ size: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size,
  className
}) => (
  <div
    className={cn(
      'animate-pulse bg-gray-200 rounded-lg',
      skeletonSizes[size],
      className
    )}
    role="status"
    aria-label="Loading phone number"
  >
    <span className="sr-only">Loading phone number...</span>
  </div>
);

// =====================================
// COMPONENT IMPLEMENTATION
// =====================================

export const CallButton = memo<CallButtonProps>(function CallButton({
  service,
  fallbackNumber,
  fallbackDisplayNumber,
  showNumber = true,
  text,
  variant = 'primary',
  size = 'md',
  className,
  onClick,
  disabled = false,
  skipDni = false,
  showAttribution = false
}) {
  // Use DNI hook to get affiliate tracking number
  const {
    phoneNumber,
    displayNumber,
    isLoading,
    affiliateName,
    hasNumber
  } = useDynamicNumber({
    service,
    fallbackNumber,
    fallbackDisplayNumber,
    skip: skipDni
  });

  // Handle click - call provided onClick if present
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
    // Note: Analytics/tracking can be added here in the future
  }, [onClick]);

  // Show skeleton while loading
  if (isLoading) {
    return <CallButtonSkeleton size={size || 'md'} className={className} />;
  }

  // If no phone number available at all, don't render
  if (!phoneNumber) {
    return null;
  }

  // Determine button text
  const buttonText = text || 'Call Now';

  // Build aria-label for accessibility
  const ariaLabel = displayNumber
    ? `Call ${displayNumber}${affiliateName && showAttribution ? ` via ${affiliateName}` : ''}`
    : buttonText;

  return (
    <a
      href={`tel:${phoneNumber}`}
      className={cn(callButtonVariants({ variant, size }), className)}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      role="button"
      tabIndex={disabled ? -1 : 0}
      style={disabled ? { pointerEvents: 'none' } : undefined}
    >
      <PhoneIcon className={iconSizes[size || 'md']} />
      <span className="flex flex-col items-start leading-tight">
        <span>{buttonText}</span>
        {showNumber && displayNumber && (
          <span
            className={cn(
              'font-normal',
              size === 'sm' && 'text-xs',
              size === 'md' && 'text-sm',
              size === 'lg' && 'text-base'
            )}
          >
            {displayNumber}
          </span>
        )}
        {showAttribution && affiliateName && hasNumber && (
          <span
            className={cn(
              'font-normal opacity-75',
              size === 'sm' && 'text-xs',
              size === 'md' && 'text-xs',
              size === 'lg' && 'text-sm'
            )}
          >
            via {affiliateName}
          </span>
        )}
      </span>
    </a>
  );
});

// =====================================
// STATIC/NON-DNI VERSION
// =====================================

export interface StaticCallButtonProps extends VariantProps<typeof callButtonVariants> {
  /** Phone number in E.164 format */
  phoneNumber: string;
  /** Display format: (xxx) xxx-xxxx */
  displayNumber?: string;
  /** Show phone number text on button */
  showNumber?: boolean;
  /** Custom button text */
  text?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback fired when button is clicked */
  onClick?: () => void;
  /** Disable the button */
  disabled?: boolean;
}

/**
 * StaticCallButton - Call button without DNI (direct phone number)
 *
 * WHY: Some places need a call button with a known phone number
 *      without going through the DNI lookup process.
 *
 * WHEN: Admin pages, confirmation screens, or anywhere the number
 *       is already known and doesn't need affiliate attribution.
 */
export const StaticCallButton = memo<StaticCallButtonProps>(function StaticCallButton({
  phoneNumber,
  displayNumber,
  showNumber = true,
  text = 'Call Now',
  variant = 'primary',
  size = 'md',
  className,
  onClick,
  disabled = false
}) {
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  const ariaLabel = displayNumber ? `Call ${displayNumber}` : text;

  return (
    <a
      href={`tel:${phoneNumber}`}
      className={cn(callButtonVariants({ variant, size }), className)}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      role="button"
      tabIndex={disabled ? -1 : 0}
      style={disabled ? { pointerEvents: 'none' } : undefined}
    >
      <PhoneIcon className={iconSizes[size || 'md']} />
      <span className="flex flex-col items-start leading-tight">
        <span>{text}</span>
        {showNumber && displayNumber && (
          <span
            className={cn(
              'font-normal',
              size === 'sm' && 'text-xs',
              size === 'md' && 'text-sm',
              size === 'lg' && 'text-base'
            )}
          >
            {displayNumber}
          </span>
        )}
      </span>
    </a>
  );
});

export default CallButton;
