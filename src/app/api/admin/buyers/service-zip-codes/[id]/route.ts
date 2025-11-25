import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/utils';
import { RedisCache } from '@/config/redis';

// GET /api/admin/buyers/service-zip-codes/[id] - Get single ZIP code
async function handleGetZipCode(req: EnhancedRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Try to get from cache
    const cacheKey = `admin:zip-code:${id}`;
    const cached = await RedisCache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Query database
    const zipCode = await prisma.buyerServiceZipCode.findUnique({
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

    if (!zipCode) {
      const response = errorResponse(
        'ZIP_CODE_NOT_FOUND',
        'ZIP code not found',
        undefined,
        undefined,
        req.context.requestId
      );
      return NextResponse.json(response, { status: 404 });
    }

    const response = successResponse({
      success: true,
      zipCode
    }, req.context.requestId);

    // Cache for 10 minutes
    await RedisCache.set(cacheKey, response, 600);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching ZIP code:', error);
    const response = errorResponse(
      'FETCH_ERROR',
      'Failed to fetch ZIP code',
      process.env.NODE_ENV !== 'production' ? { error: error.message } : undefined,
      undefined,
      req.context.requestId
    );
    return NextResponse.json(response, { status: 500 });
  }
}

// PUT /api/admin/buyers/service-zip-codes/[id] - Update ZIP code
async function handleUpdateZipCode(req: EnhancedRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();

    // Check if ZIP code exists
    const existing = await prisma.buyerServiceZipCode.findUnique({
      where: { id }
    });

    if (!existing) {
      const response = errorResponse(
        'ZIP_CODE_NOT_FOUND',
        'ZIP code not found',
        undefined,
        undefined,
        req.context.requestId
      );
      return NextResponse.json(response, { status: 404 });
    }

    // Validate zipCode format if changing
    if (body.zipCode && !/^\d{5}$/.test(body.zipCode)) {
      const response = errorResponse(
        'VALIDATION_ERROR',
        'ZIP code must be exactly 5 digits',
        undefined,
        'zipCode',
        req.context.requestId
      );
      return NextResponse.json(response, { status: 400 });
    }

    // Check for duplicate if changing buyer/service/zipCode combination
    if (body.buyerId || body.serviceTypeId || body.zipCode) {
      const newBuyerId = body.buyerId || existing.buyerId;
      const newServiceTypeId = body.serviceTypeId || existing.serviceTypeId;
      const newZipCode = body.zipCode || existing.zipCode;

      // Only check if something actually changed
      if (newBuyerId !== existing.buyerId ||
          newServiceTypeId !== existing.serviceTypeId ||
          newZipCode !== existing.zipCode) {
        const duplicate = await prisma.buyerServiceZipCode.findFirst({
          where: {
            buyerId: newBuyerId,
            serviceTypeId: newServiceTypeId,
            zipCode: newZipCode,
            NOT: { id }
          }
        });

        if (duplicate) {
          const response = errorResponse(
            'ZIP_CODE_EXISTS',
            'This ZIP code is already configured for this buyer and service type',
            undefined,
            undefined,
            req.context.requestId
          );
          return NextResponse.json(response, { status: 409 });
        }
      }
    }

    // Update ZIP code (only fields that are provided)
    const updateData: any = {};
    if (body.buyerId !== undefined) updateData.buyerId = body.buyerId;
    if (body.serviceTypeId !== undefined) updateData.serviceTypeId = body.serviceTypeId;
    if (body.zipCode !== undefined) updateData.zipCode = body.zipCode;
    if (body.active !== undefined) updateData.active = body.active;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.maxLeadsPerDay !== undefined) updateData.maxLeadsPerDay = body.maxLeadsPerDay;
    if (body.minBid !== undefined) updateData.minBid = body.minBid;
    if (body.maxBid !== undefined) updateData.maxBid = body.maxBid;

    const zipCode = await prisma.buyerServiceZipCode.update({
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
    await RedisCache.deletePattern('admin:zip-code*');

    const response = successResponse({
      success: true,
      zipCode
    }, req.context.requestId);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error updating ZIP code:', error);
    const response = errorResponse(
      'UPDATE_ERROR',
      'Failed to update ZIP code',
      process.env.NODE_ENV !== 'production' ? { error: error.message } : undefined,
      undefined,
      req.context.requestId
    );
    return NextResponse.json(response, { status: 500 });
  }
}

// DELETE /api/admin/buyers/service-zip-codes/[id] - Delete ZIP code
async function handleDeleteZipCode(req: EnhancedRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Check if ZIP code exists
    const existing = await prisma.buyerServiceZipCode.findUnique({
      where: { id }
    });

    if (!existing) {
      const response = errorResponse(
        'ZIP_CODE_NOT_FOUND',
        'ZIP code not found',
        undefined,
        undefined,
        req.context.requestId
      );
      return NextResponse.json(response, { status: 404 });
    }

    // Delete ZIP code
    await prisma.buyerServiceZipCode.delete({
      where: { id }
    });

    // Clear cache
    await RedisCache.deletePattern('admin:zip-code*');

    const response = successResponse({
      success: true,
      message: 'ZIP code deleted successfully'
    }, req.context.requestId);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error deleting ZIP code:', error);
    const response = errorResponse(
      'DELETE_ERROR',
      'Failed to delete ZIP code',
      process.env.NODE_ENV !== 'production' ? { error: error.message } : undefined,
      undefined,
      req.context.requestId
    );
    return NextResponse.json(response, { status: 500 });
  }
}

// Export wrapped handlers
export const GET = withMiddleware(handleGetZipCode, {
  requireAuth: true,
  enableLogging: true,
  enableCors: true
});

export const PUT = withMiddleware(handleUpdateZipCode, {
  requireAuth: true,
  enableLogging: true,
  enableCors: true,
  validateContentType: true
});

export const DELETE = withMiddleware(handleDeleteZipCode, {
  requireAuth: true,
  enableLogging: true,
  enableCors: true
});
