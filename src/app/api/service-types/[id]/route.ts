/**
 * Service Type API - Individual Resource
 *
 * WHY: CRUD operations for individual service types
 * WHEN: Admin UI needs to read/update/delete a specific service
 * HOW: Uses Prisma to interact with database
 *
 * ENDPOINTS:
 *   GET    /api/service-types/[id] - Get single service type
 *   PUT    /api/service-types/[id] - Update service type
 *   DELETE /api/service-types/[id] - Delete service type
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleApiError } from '@/lib/utils';
import { RedisCache } from '@/config/redis';
import { captureApiError } from '@/lib/sentry';
import { revalidateServicePages, revalidateOnServiceDelete } from '@/lib/revalidation';
import { syncPostHogFunnel, deletePostHogFunnel } from '@/lib/services/posthog-funnel-service';

/**
 * Invalidate service flow cache when service is updated
 * Clears both name-based and id-based cache keys
 */
async function invalidateServiceFlowCache(serviceName: string, serviceId: string) {
  await Promise.all([
    RedisCache.delete(`service-flow:${serviceName.toLowerCase()}`),
    RedisCache.delete(`service-flow:${serviceId}`),
  ]);
}

/**
 * GET /api/service-types/[id]
 * Fetch a single service type by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const serviceType = await prisma.serviceType.findUnique({
      where: { id },
    });

    if (!serviceType) {
      return NextResponse.json({
        success: false,
        error: 'Service type not found',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: serviceType,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    captureApiError(error, { route: '/api/service-types/[id]', action: 'GET' });
    console.error('Get service type error:', error);
    const { message, statusCode } = handleApiError(error);

    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve service type',
      message,
      timestamp: new Date().toISOString(),
    }, { status: statusCode });
  }
}

/**
 * PUT /api/service-types/[id]
 * Update a service type (name, displayName, formSchema, active)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if service type exists
    const existing = await prisma.serviceType.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: 'Service type not found',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    // Build update data - only include fields that were provided
    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.displayName !== undefined) {
      updateData.displayName = body.displayName;
    }

    if (body.active !== undefined) {
      updateData.active = body.active;
    }

    if (body.formSchema !== undefined) {
      // formSchema should be stored as JSON string
      updateData.formSchema = typeof body.formSchema === 'string'
        ? body.formSchema
        : JSON.stringify(body.formSchema);
    }

    // Perform the update
    const serviceType = await prisma.serviceType.update({
      where: { id },
      data: updateData,
    });

    // Invalidate Redis cache so new flow is served
    await invalidateServiceFlowCache(serviceType.name, serviceType.id);

    // Revalidate static pages so changes appear immediately
    revalidateServicePages(serviceType.name);

    // Sync PostHog funnel with updated name/slug (fire-and-forget)
    syncPostHogFunnel(serviceType.name, serviceType.displayName || serviceType.name).catch(() => {});

    return NextResponse.json({
      success: true,
      data: serviceType,
      message: 'Service type updated successfully',
      cacheInvalidated: true,
      pagesRevalidated: true,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    captureApiError(error, { route: '/api/service-types/[id]', action: 'PUT' });
    console.error('Update service type error:', error);
    const { message, statusCode } = handleApiError(error);

    return NextResponse.json({
      success: false,
      error: 'Failed to update service type',
      message,
      timestamp: new Date().toISOString(),
    }, { status: statusCode });
  }
}

/**
 * DELETE /api/service-types/[id]
 * Delete a service type (soft delete by setting active = false, or hard delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if service type exists
    const existing = await prisma.serviceType.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: 'Service type not found',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    // Check if any leads reference this service type
    const leadCount = await prisma.lead.count({
      where: { serviceTypeId: id },
    });

    if (leadCount > 0) {
      // Soft delete - just deactivate if there are associated leads
      await prisma.serviceType.update({
        where: { id },
        data: { active: false },
      });

      // Revalidate pages so deactivated service disappears from dropdown
      revalidateOnServiceDelete(existing.name);

      // Remove PostHog funnel for deactivated service (fire-and-forget)
      deletePostHogFunnel(existing.name).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Service type deactivated (${leadCount} leads reference this service)`,
        softDelete: true,
        pagesRevalidated: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Hard delete - no associated leads
    await prisma.serviceType.delete({
      where: { id },
    });

    // Revalidate pages so deleted service disappears
    revalidateOnServiceDelete(existing.name);

    // Remove PostHog funnel for deleted service (fire-and-forget)
    deletePostHogFunnel(existing.name).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Service type deleted successfully',
      pagesRevalidated: true,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    captureApiError(error, { route: '/api/service-types/[id]', action: 'DELETE' });
    console.error('Delete service type error:', error);
    const { message, statusCode } = handleApiError(error);

    return NextResponse.json({
      success: false,
      error: 'Failed to delete service type',
      message,
      timestamp: new Date().toISOString(),
    }, { status: statusCode });
  }
}
