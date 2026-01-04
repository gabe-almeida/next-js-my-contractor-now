// UI Components - Centralized exports for better tree-shaking and imports

// Core UI Components
export { Button, buttonVariants } from './Button';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './Card';
export { Badge } from './Badge';
export { default as PortalDropdown } from './PortalDropdown';

// Loading and State Components
export { LoadingSpinner, LoadingOverlay } from './LoadingSpinner';
export { SkeletonLoader, CardSkeleton, TableSkeleton, FormSkeleton } from './SkeletonLoader';

// Layout and Responsive Components
export { 
  ResponsiveContainer, 
  ResponsiveGrid, 
  ResponsiveStack, 
  useBreakpoint 
} from './ResponsiveContainer';

// Error Handling
export { ErrorBoundary, withErrorBoundary, useErrorHandler } from './ErrorBoundary';

// Notifications
export { ToastProvider, useToast, useToastNotifications } from './Toast';

// Progressive Enhancement
export { 
  ProgressiveEnhancement,
  ProgressiveForm,
  ProgressiveImage,
  ProgressiveButton,
  ProgressiveInput,
  withProgressiveEnhancement
} from './ProgressiveEnhancement';

// Lazy Loading
export {
  withLazyLoading,
  LazyOnScroll
} from './LazyComponent';

// Accessibility
export { 
  AccessibleInput,
  AccessibleEmailInput,
  AccessiblePhoneInput,
  AccessiblePasswordInput
} from './AccessibleInput';

// Types
export type { ButtonProps } from './Button';
export type { Toast } from './Toast';