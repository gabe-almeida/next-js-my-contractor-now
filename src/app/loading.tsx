/**
 * Home Page Loading State
 *
 * WHY: Provides instant visual feedback while home page data loads
 * WHEN: Shown during ISR regeneration or initial server render
 * HOW: Next.js automatically shows this during Suspense boundaries
 */

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header Skeleton */}
      <div className="h-16 bg-white border-b border-gray-200 animate-pulse" />

      {/* Hero Section Skeleton */}
      <div className="bg-gradient-to-r from-orange-400 to-orange-500 min-h-[600px] flex items-center justify-center">
        <div className="max-w-4xl mx-auto px-4 text-center">
          {/* Mascot Placeholder */}
          <div className="mb-8 flex justify-center">
            <div className="w-40 h-40 bg-orange-300/50 rounded-full animate-pulse" />
          </div>

          {/* Heading Placeholder */}
          <div className="h-12 bg-white/20 rounded-lg w-3/4 mx-auto mb-4 animate-pulse" />
          <div className="h-6 bg-white/20 rounded-lg w-1/2 mx-auto mb-12 animate-pulse" />

          {/* Form Card Skeleton */}
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg mx-auto">
            <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-6 animate-pulse" />
            <div className="h-14 bg-gray-100 rounded-lg border-2 border-gray-200 animate-pulse" />
            <div className="h-4 bg-gray-100 rounded w-2/3 mx-auto mt-4 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
