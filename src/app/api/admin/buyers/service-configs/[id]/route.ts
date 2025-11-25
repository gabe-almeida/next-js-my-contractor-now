import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/utils';
import { RedisCache } from '@/config/redis';

// GET /api/admin/buyers/service-configs/[id] - Get single service config
async function handleGetServiceConfig(req: EnhancedRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Try to get from cache
    const cacheKey = `admin:service-config:${id}`;
    const cached = await RedisCache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Query database
    const config = await prisma.buyerServiceConfig.findUnique({
      where: { id },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        serviceType: {
          select: {
            id: true,
            name: true,
            displayName: true
          }
        }
      }
    });

    if (!config) {
      const response = errorResponse(
        'CONFIG_NOT_FOUND',
        'Service configuration not found',
        undefined,
        undefined,
        req.context.requestId
      );
      return NextResponse.json(response, { status: 404 });
    }

    const response = successResponse({
      success: true,
      config
    }, req.context.requestId);

    // Cache for 10 minutes
    await RedisCache.set(cacheKey, response, 600);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching service config:', error);
    const response = errorResponse(
      'FETCH_ERROR',
      'Failed to fetch service configuration',
      process.env.NODE_ENV !== 'production' ? { error: error.message } : undefined,
      undefined,
      req.context.requestId
    );
    return NextResponse.json(response, { status: 500 });
  }
}

// PUT /api/admin/buyers/service-configs/[id] - Update service config
async function handleUpdateServiceConfig(req: EnhancedRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();

    // Check if config exists
    const existing = await prisma.buyerServiceConfig.findUnique({
      where: { id }
    });

    if (!existing) {
      const response = errorResponse(
        'CONFIG_NOT_FOUND',
        'Service configuration not found',
        undefined,
        undefined,
        req.context.requestId
      );
      return NextResponse.json(response, { status: 404 });
    }

    // Validate minBid < maxBid if either is being updated
    const newMinBid = body.minBid !== undefined ? body.minBid : existing.minBid;
    const newMaxBid = body.maxBid !== undefined ? body.maxBid : existing.maxBid;

    if (newMinBid >= newMaxBid) {
      const response = errorResponse(
        'VALIDATION_ERROR',
        'minBid must be less than maxBid',
        undefined,
        'minBid',
        req.context.requestId
      );
      return NextResponse.json(response, { status: 400 });
    }

    // Update config (only fields that are provided)
    const updateData: any = {};
    if (body.pingTemplate !== undefined) updateData.pingTemplate = body.pingTemplate;
    if (body.postTemplate !== undefined) updateData.postTemplate = body.postTemplate;
    if (body.fieldMappings !== undefined) updateData.fieldMappings = body.fieldMappings;
    if (body.requiresTrustedForm !== undefined) updateData.requiresTrustedForm = body.requiresTrustedForm;
    if (body.requiresJornaya !== undefined) updateData.requiresJornaya = body.requiresJornaya;
    if (body.complianceConfig !== undefined) updateData.complianceConfig = body.complianceConfig;
    if (body.minBid !== undefined) updateData.minBid = body.minBid;
    if (body.maxBid !== undefined) updateData.maxBid = body.maxBid;
    if (body.active !== undefined) updateData.active = body.active;

    const config = await prisma.buyerServiceConfig.update({
      where: { id },
      data: updateData,
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        serviceType: {
          select: {
            id: true,
            name: true,
            displayName: true
          }
        }
      }
    });

    // Clear cache
    await RedisCache.deletePattern('admin:service-config*');

    const response = successResponse({
      success: true,
      config
    }, req.context.requestId);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error updating service config:', error);
    const response = errorResponse(
      'UPDATE_ERROR',
      'Failed to update service configuration',
      process.env.NODE_ENV !== 'production' ? { error: error.message } : undefined,
      undefined,
      req.context.requestId
    );
    return NextResponse.json(response, { status: 500 });
  }
}

// DELETE /api/admin/buyers/service-configs/[id] - Delete service config
async function handleDeleteServiceConfig(req: EnhancedRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Check if config exists
    const existing = await prisma.buyerServiceConfig.findUnique({
      where: { id }
    });

    if (!existing) {
      const response = errorResponse(
        'CONFIG_NOT_FOUND',
        'Service configuration not found',
        undefined,
        undefined,
        req.context.requestId
      );
      return NextResponse.json(response, { status: 404 });
    }

    // Check for associated ZIP codes (cascade protection)
    const zipCodeCount = await prisma.buyerServiceZipCode.count({
      where: {
        buyerId: existing.buyerId,
        serviceTypeId: existing.serviceTypeId
      }
    });

    if (zipCodeCount > 0) {
      const response = errorResponse(
        'CONFIG_HAS_ZIP_CODES',
        `Cannot delete service configuration with ${zipCodeCount} associated ZIP codes. Delete ZIP codes first.`,
        { zipCodeCount },
        undefined,
        req.context.requestId
      );
      return NextResponse.json(response, { status: 409 });
    }

    // Delete config
    await prisma.buyerServiceConfig.delete({
      where: { id }
    });

    // Clear cache
    await RedisCache.deletePattern('admin:service-config*');

    const response = successResponse({
      success: true,
      message: 'Service configuration deleted successfully'
    }, req.context.requestId);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error deleting service config:', error);
    const response = errorResponse(
      'DELETE_ERROR',
      'Failed to delete service configuration',
      process.env.NODE_ENV !== 'production' ? { error: error.message } : undefined,
      undefined,
      req.context.requestId
    );
    return NextResponse.json(response, { status: 500 });
  }
}

// Export wrapped handlers
export const GET = withMiddleware(handleGetServiceConfig, {
  requireAuth: true,
  enableLogging: true,
  enableCors: true
});

export const PUT = withMiddleware(handleUpdateServiceConfig, {
  requireAuth: true,
  enableLogging: true,
  enableCors: true,
  validateContentType: true
});

export const DELETE = withMiddleware(handleDeleteServiceConfig, {
  requireAuth: true,
  enableLogging: true,
  enableCors: true
});
