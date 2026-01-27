'use client';

/**
 * Affiliates Redirect Page
 *
 * WHY: Users may type /affiliates (plural) instead of /affiliate
 * WHEN: User visits /affiliates
 * HOW: Immediately redirects to /affiliate
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AffiliatesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/affiliate');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-orange-400 to-orange-500">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        <p className="mt-2 text-sm text-white">Redirecting...</p>
      </div>
    </div>
  );
}
