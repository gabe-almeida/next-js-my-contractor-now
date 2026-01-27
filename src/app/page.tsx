/**
 * Homepage - Main entry point for lead generation (Server Component)
 *
 * WHY: Users select their project type to start the quote flow
 * WHEN: User visits the homepage
 * HOW: Fetches active services server-side, renders static content with
 *      interactive HomeHero client component
 *
 * PERFORMANCE: This page uses ISR (Incremental Static Regeneration).
 * - Pre-rendered at build time with fresh data
 * - Revalidates every 5 minutes OR instantly via on-demand revalidation
 * - No client-side API calls for service list
 */

import { prisma } from '@/lib/db';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HomeHero from '@/components/home/HomeHero';

// Revalidate every 5 minutes (fallback if on-demand revalidation doesn't fire)
export const revalidate = 300;

/**
 * Fetch active service types from database
 * Server-side only - runs at build time and on revalidation
 */
async function getServiceTypes() {
  try {
    const services = await prisma.serviceType.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: {
        name: true,
        displayName: true,
      },
    });

    return services.map((s) => ({
      id: s.name.toLowerCase(),
      name: s.displayName || s.name,
    }));
  } catch (error) {
    console.error('Failed to fetch services:', error);
    // Fallback to default services if DB fails
    return [
      { id: 'windows', name: 'Windows' },
      { id: 'roofing', name: 'Roofing' },
      { id: 'bathrooms', name: 'Bathrooms' },
    ];
  }
}

export default async function HomePage() {
  const serviceTypes = await getServiceTypes();

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Interactive Hero Section (Client Component) */}
      <HomeHero serviceTypes={serviceTypes} />

      {/* How It Works Section - Pure Server HTML */}
      <div className="py-16 bg-gray-50 relative z-10">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            How It Works
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Tell us about your project
              </h3>
              <p className="text-gray-600">
                Answer a few questions about your home improvement project
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Get matched with pros
              </h3>
              <p className="text-gray-600">
                We'll connect you with qualified contractors in your area
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Compare quotes
              </h3>
              <p className="text-gray-600">
                Review proposals and choose the best contractor for your project
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
