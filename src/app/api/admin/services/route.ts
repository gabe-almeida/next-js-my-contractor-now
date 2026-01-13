import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { captureApiError } from '@/lib/sentry';

/**
 * Admin Services API
 *
 * WHY: Provides service type management for admin panel
 * WHEN: Called by admin buyers page and service configuration forms
 * HOW: Fetches all service types from database with optional filtering
 */

async function handleGetServices(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get('activeOnly') === 'true';

  try {
    const services = await prisma.serviceType.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        formSchema: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            buyerServiceConfigs: true,
            leads: true
          }
        }
      }
    });

    // Parse formSchema JSON strings
    const servicesWithParsedSchema = services.map(service => ({
      ...service,
      formSchema: JSON.parse(service.formSchema),
      configCount: service._count.buyerServiceConfigs,
      leadCount: service._count.leads
    }));

    const response = successResponse(
      { services: servicesWithParsedSchema },
      requestId
    );

    return NextResponse.json(response);

  } catch (error) {
    captureApiError(error, { route: '/api/admin/services', action: 'GET' });
    logger.error('Services fetch error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId
    });

    const response = errorResponse(
      'SERVICES_ERROR',
      'Failed to fetch services',
      undefined,
      undefined,
      requestId
    );

    return NextResponse.json(response, { status: 500 });
  }
}

// Export GET handler with admin authentication
export const GET = withMiddleware(handleGetServices, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true
});
