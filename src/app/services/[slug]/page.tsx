/**
 * Dynamic Service Lead Form Page (Server Component)
 *
 * WHY: Single page component that handles ANY service type dynamically.
 *      Eliminates need for copy-paste service pages (windows, roofing, bathrooms).
 *
 * WHEN: User navigates to /services/[service-name] for any active service.
 *
 * HOW:
 *   1. Pre-builds all active service pages at build time (generateStaticParams)
 *   2. Fetches QuestionFlow server-side (no client API waterfall)
 *   3. Passes flow to DynamicFormWrapper client component
 *
 * PERFORMANCE: Uses ISR (Incremental Static Regeneration)
 *   - Pages pre-built at deploy time for known services
 *   - New services built on first request
 *   - Revalidates every 5 minutes (matches homepage) OR instantly via on-demand revalidation
 *
 * ROUTE: /services/[slug] where slug is the service name (e.g., "windows", "roofing")
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { buildQuestionFlow, buildFallbackFlow, validateQuestionFlow } from '@/lib/questions/flow-builder';
import DynamicFormWrapper from '@/components/forms/DynamicFormWrapper';
import Footer from '@/components/layout/Footer';

// Skip build-time prerendering — Render build env can't reach Supabase.
// Pages are server-rendered on first request, then cached via ISR (5 min).
// This guarantees the correct DB-driven flow every time (no fallback).
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  // Return empty — all service pages built on first request, not at deploy time
  return [];
}

/**
 * Fetch service flow data server-side
 *
 * WHY: Eliminates client-side API waterfall
 * WHEN: At build time for static generation, on revalidation
 * HOW: Directly queries database and builds flow
 */
async function getServiceFlow(slug: string) {
  const serviceType = await prisma.serviceType.findFirst({
    where: {
      OR: [{ name: slug }, { name: slug.toLowerCase() }, { id: slug }],
      active: true,
    },
    select: {
      id: true,
      name: true,
      displayName: true,
      formSchema: true,
    },
  });

  if (!serviceType) {
    return null;
  }

  // Build the question flow from formSchema
  let flow;
  if (serviceType.formSchema) {
    flow = buildQuestionFlow({
      id: serviceType.id,
      name: serviceType.name,
      displayName: serviceType.displayName || undefined,
      formSchema: serviceType.formSchema,
    });
  } else {
    // Use fallback flow if no formSchema defined
    console.warn(`Service "${serviceType.name}" has no formSchema, using fallback flow`);
    flow = buildFallbackFlow(serviceType.name);
  }

  // Validate the generated flow
  const validation = validateQuestionFlow(flow);
  if (!validation.valid) {
    console.error(`Invalid flow generated for service "${serviceType.name}":`, validation.errors);
    // Return fallback flow instead of failing completely
    flow = buildFallbackFlow(serviceType.name);
  }

  return {
    flow,
    service: {
      id: serviceType.id,
      name: serviceType.name,
      displayName: serviceType.displayName,
    },
  };
}

/**
 * Service not found component
 */
function ServiceNotFound({ slug }: { slug: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Service Not Found</h1>
        <p className="text-gray-600 mb-6">The service &quot;{slug}&quot; is not available.</p>
        <a
          href="/"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getServiceFlow(slug);

  if (!data) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <DynamicFormWrapper flow={data.flow} serviceSlug={slug} />
      </div>
      <Footer />
    </div>
  );
}
