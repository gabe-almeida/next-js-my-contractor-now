import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/utils';
import { RedisCache } from '@/config/redis';

// GET /api/admin/buyers/service-zip-codes - List all ZIP codes with filters
async function handleGetZipCodes(req: EnhancedRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const buyerId = searchParams.get('buyerId');
    const serviceTypeId = searchParams.get('serviceTypeId');
    const zipCode = searchParams.get('zipCode');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Try to get from cache
    const cacheKey = `admin:zip-codes:${buyerId || 'all'}:${serviceTypeId || 'all'}:${zipCode || 'all'}:${page}:${limit}`;
    const cached = await RedisCache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Build where clause
    const where: any = {};
    if (buyerId) where.buyerId = buyerId;
    if (serviceTypeId) where.serviceTypeId = serviceTypeId;
    if (zipCode) where.zipCode = { contains: zipCode };

    // Query database
    const [zipCodes, totalCount] = await Promise.all([
      prisma.buyerServiceZipCode.findMany({
        where,
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
        },
        orderBy: { zipCode: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.buyerServiceZipCode.count({ where })
    ]);

    const response = successResponse({
      success: true,
      zipCodes,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    }, req.context.requestId);

    // Cache for 5 minutes
    await RedisCache.set(cacheKey, response, 300);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching ZIP codes:', error);
    const response = errorResponse(
      'FETCH_ERROR',
      'Failed to fetch ZIP codes',
      process.env.NODE_ENV !== 'production' ? { error: error.message } : undefined,
      undefined,
      req.context.requestId
    );
    return NextResponse.json(response, { status: 500 });
  }
}

// POST /api/admin/buyers/service-zip-codes - Create new ZIP code
async function handleCreateZipCode(req: EnhancedRequest) {
  try {
    const body = await req.json();
    const {
      buyerId,
      serviceTypeId,
      zipCode,
      active,
      priority,
      maxLeadsPerDay,
      minBid,
      maxBid
    } = body;

    // Validation
    if (!buyerId || !serviceTypeId || !zipCode) {
      const response = errorResponse(
        'VALIDATION_ERROR',
        'buyerId, serviceTypeId, and zipCode are required',
        undefined,
        !buyerId ? 'buyerId' : !serviceTypeId ? 'serviceTypeId' : 'zipCode',
        req.context.requestId
      );
      return NextResponse.json(response, { status: 400 });
    }

    // Validate ZIP code format (5 digits)
    if (!/^\d{5}$/.test(zipCode)) {
      const response = errorResponse(
        'VALIDATION_ERROR',
        'ZIP code must be exactly 5 digits',
        undefined,
        'zipCode',
        req.context.requestId
      );
      return NextResponse.json(response, { status: 400 });
    }

    // Validate buyer exists
    const buyer = await prisma.buyer.findUnique({ where: { id: buyerId } });
    if (!buyer) {
      const response = errorResponse(
        'BUYER_NOT_FOUND',
        'Buyer not found',
        undefined,
        'buyerId',
        req.context.requestId
      );
      return NextResponse.json(response, { status: 404 });
    }

    // Validate service type exists
    const serviceType = await prisma.serviceType.findUnique({ where: { id: serviceTypeId } });
    if (!serviceType) {
      const response = errorResponse(
        'SERVICE_TYPE_NOT_FOUND',
        'Service type not found',
        undefined,
        'serviceTypeId',
        req.context.requestId
      );
      return NextResponse.json(response, { status: 404 });
    }

    // Check for duplicate buyer+service+zipCode combination
    const existing = await prisma.buyerServiceZipCode.findFirst({
      where: {
        buyerId,
        serviceTypeId,
        zipCode
      }
    });

    if (existing) {
      const response = errorResponse(
        'ZIP_CODE_EXISTS',
        'This ZIP code is already configured for this buyer and service type',
        undefined,
        undefined,
        req.context.requestId
      );
      return NextResponse.json(response, { status: 409 });
    }

    // Create ZIP code
    const zipCodeRecord = await prisma.buyerServiceZipCode.create({
      data: {
        buyerId,
        serviceTypeId,
        zipCode,
        active: active ?? true,
        priority: priority ?? 100,
        maxLeadsPerDay: maxLeadsPerDay || null,
        minBid: minBid || null,
        maxBid: maxBid || null
      },
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
    await RedisCache.deletePattern('admin:zip-codes:*');

    const response = successResponse({
      success: true,
      zipCode: zipCodeRecord
    }, req.context.requestId);

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error('Error creating ZIP code:', error);
    const response = errorResponse(
      'CREATE_ERROR',
      'Failed to create ZIP code',
      process.env.NODE_ENV !== 'production' ? { error: error.message } : undefined,
      undefined,
      req.context.requestId
    );
    return NextResponse.json(response, { status: 500 });
  }
}

// Export wrapped handlers
export const GET = withMiddleware(handleGetZipCodes, {
  requireAuth: true,
  enableLogging: true,
  enableCors: true
});

export const POST = withMiddleware(handleCreateZipCode, {
  requireAuth: true,
  enableLogging: true,
  enableCors: true,
  validateContentType: true
});
