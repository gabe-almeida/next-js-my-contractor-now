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
 *
 * ENDPOINT: GET /api/services/[slug]/flow
 *
 * RESPONSE:
 *   - 200: { flow: QuestionFlow }
 *   - 404: { error: 'Service not found' }
 *   - 500: { error: 'Failed to build flow' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildQuestionFlow, buildFallbackFlow, validateQuestionFlow } from '@/lib/questions/flow-builder';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

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

    return NextResponse.json({
      flow,
      service: {
        id: serviceType.id,
        name: serviceType.name,
        displayName: serviceType.displayName,
      },
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
