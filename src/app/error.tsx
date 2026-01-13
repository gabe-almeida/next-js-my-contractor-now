"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Route-level error boundary for the app
 *
 * WHY: Catches React rendering errors at the route level (more granular than global-error.tsx)
 * WHEN: Any uncaught error in a page or layout component
 * HOW: Automatically used by Next.js App Router for error handling
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
      <div className="max-w-md">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-6">
          We encountered an unexpected error. Our team has been notified and is looking into it.
        </p>
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
