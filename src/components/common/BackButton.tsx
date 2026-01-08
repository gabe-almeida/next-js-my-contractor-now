'use client';

import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface BackButtonProps {
  className?: string;
  label?: string;
}

/**
 * WHY: Provides navigation back to the previous page (uses browser history)
 * WHEN: Used on TCPA-linked pages to return users to their form without losing data
 * HOW: Uses window.history.back() to preserve form state
 */
export default function BackButton({ className = '', label = 'Back' }: BackButtonProps) {
  const handleBack = () => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  return (
    <button
      onClick={handleBack}
      className={`inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium transition-colors ${className}`}
    >
      <ArrowLeftIcon className="w-5 h-5" />
      {label}
    </button>
  );
}
