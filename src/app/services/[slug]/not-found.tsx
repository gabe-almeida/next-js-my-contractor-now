/**
 * Service Not Found Page
 *
 * WHY: Custom 404 page for invalid service slugs
 * WHEN: User navigates to /services/[invalid-slug]
 * HOW: Next.js automatically shows this when notFound() is called
 */

import Link from 'next/link';

export default function ServiceNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Service Not Found</h1>
        <p className="text-gray-600 mb-6">
          The service you&apos;re looking for is not available or has been deactivated.
        </p>
        <Link
          href="/"
          className="inline-block bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
