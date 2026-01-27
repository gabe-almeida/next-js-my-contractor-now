/**
 * Service Form Loading State
 *
 * WHY: Provides instant visual feedback while service form loads
 * WHEN: Shown during ISR regeneration or on-demand page generation
 * HOW: Next.js automatically shows this during Suspense boundaries
 */

export default function ServiceLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
        <p className="mt-4 text-gray-600">Loading your form...</p>
      </div>
    </div>
  );
}
