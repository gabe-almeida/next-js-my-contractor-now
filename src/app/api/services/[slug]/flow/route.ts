/**
 * Service Flow API Endpoint
 *
 * WHY: Provides QuestionFlow configuration for dynamic service pages.
 *      Eliminates need for hardcoded question flows per service.
 *
 * WHEN: Dynamic service page loads and needs to render the form.
 *
 * HOW: Looks up ServiceType by slug, builds QuestionFlow from formSchema,
 *      validates and returns the flow for DynamicForm component.
 *      Uses Redis caching for performance (cache invalidated on service update).
 *
 * ENDPOINT: GET /api/services/[slug]/flow
 *
 * RESPONSE:
 *   - 200: { flow: QuestionFlow }
 *   - 404: { error: 'Service not found' }
 *   - 500: { error: 'Failed to build flow' }
 *
 * CACHING:
 *   - Cached for 1 hour in Redis
 *   - Cache key: service-flow:{slug}
 *   - Invalidated by /api/service-types/[id] PUT
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildQuestionFlow, buildFallbackFlow, validateQuestionFlow } from '@/lib/questions/flow-builder';
import { RedisCache } from '@/config/redis';

const CACHE_TTL_SECONDS = 3600; // 1 hour

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cacheKey = `service-flow:${slug.toLowerCase()}`;

    // Check cache first
    const cached = await RedisCache.get<{
      flow: any;
      service: { id: string; name: string; displayName: string | null };
    }>(cacheKey);

    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Look up service by slug (name) or ID
    const serviceType = await prisma.serviceType.findFirst({
      where: {
        OR: [
          { name: slug },
          { id: slug },
        ],
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
      return NextResponse.json(
        {
          error: 'Service not found',
          message: `No active service type found for slug: ${slug}`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
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

    const responseData = {
      flow,
      service: {
        id: serviceType.id,
        name: serviceType.name,
        displayName: serviceType.displayName,
      },
    };

    // Cache the result
    await RedisCache.set(cacheKey, responseData, CACHE_TTL_SECONDS);

    return NextResponse.json({
      ...responseData,
      cached: false,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Flow API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to build flow',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
