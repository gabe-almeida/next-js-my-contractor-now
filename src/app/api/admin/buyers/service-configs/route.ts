import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/utils';
import { RedisCache } from '@/config/redis';

// GET /api/admin/buyers/service-configs - List all service configs with filters
async function handleGetServiceConfigs(req: EnhancedRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const buyerId = searchParams.get('buyerId');
    const serviceTypeId = searchParams.get('serviceTypeId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Try to get from cache
    const cacheKey = `admin:service-configs:${buyerId || 'all'}:${serviceTypeId || 'all'}:${page}:${limit}`;
    const cached = await RedisCache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Build where clause
    const where: any = {};
    if (buyerId) where.buyerId = buyerId;
    if (serviceTypeId) where.serviceTypeId = serviceTypeId;

    // Query database
    const [configs, totalCount] = await Promise.all([
      prisma.buyerServiceConfig.findMany({
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.buyerServiceConfig.count({ where })
    ]);

    const response = successResponse({
      success: true,
      configs,
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
    console.error('Error fetching service configs:', error);
    const response = errorResponse(
      'FETCH_ERROR',
      'Failed to fetch service configurations',
      process.env.NODE_ENV !== 'production' ? { error: error.message } : undefined,
      undefined,
      req.context.requestId
    );
    return NextResponse.json(response, { status: 500 });
  }
}

// POST /api/admin/buyers/service-configs - Create new service config
async function handleCreateServiceConfig(req: EnhancedRequest) {
  try {
    const body = await req.json();
    const {
      buyerId,
      serviceTypeId,
      pingTemplate,
      postTemplate,
      fieldMappings,
      requiresTrustedForm,
      requiresJornaya,
      complianceConfig,
      minBid,
      maxBid,
      active
    } = body;

    // Validation
    if (!buyerId || !serviceTypeId) {
      const response = errorResponse(
        'VALIDATION_ERROR',
        'buyerId and serviceTypeId are required',
        undefined,
        !buyerId ? 'buyerId' : 'serviceTypeId',
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

    // Validate minBid < maxBid
    if (minBid !== undefined && maxBid !== undefined && minBid >= maxBid) {
      const response = errorResponse(
        'VALIDATION_ERROR',
        'minBid must be less than maxBid',
        undefined,
        'minBid',
        req.context.requestId
      );
      return NextResponse.json(response, { status: 400 });
    }

    // Check for duplicate buyer+service combination
    const existing = await prisma.buyerServiceConfig.findFirst({
      where: {
        buyerId,
        serviceTypeId
      }
    });

    if (existing) {
      const response = errorResponse(
        'CONFIG_EXISTS',
        'Service configuration already exists for this buyer and service type',
        undefined,
        undefined,
        req.context.requestId
      );
      return NextResponse.json(response, { status: 409 });
    }

    // Create config
    const config = await prisma.buyerServiceConfig.create({
      data: {
        buyerId,
        serviceTypeId,
        pingTemplate: pingTemplate || '{}',
        postTemplate: postTemplate || '{}',
        fieldMappings: fieldMappings || '{}',
        requiresTrustedForm: requiresTrustedForm ?? false,
        requiresJornaya: requiresJornaya ?? false,
        complianceConfig: complianceConfig || null,
        minBid: minBid ?? 0.00,
        maxBid: maxBid ?? 999.99,
        active: active ?? true
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
    await RedisCache.deletePattern('admin:service-configs:*');

    const response = successResponse({
      success: true,
      config
    }, req.context.requestId);

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error('Error creating service config:', error);
    const response = errorResponse(
      'CREATE_ERROR',
      'Failed to create service configuration',
      process.env.NODE_ENV !== 'production' ? { error: error.message } : undefined,
      undefined,
      req.context.requestId
    );
    return NextResponse.json(response, { status: 500 });
  }
}

// Export wrapped handlers
export const GET = withMiddleware(handleGetServiceConfigs, {
  requireAuth: true,
  enableLogging: true,
  enableCors: true
});

export const POST = withMiddleware(handleCreateServiceConfig, {
  requireAuth: true,
  enableLogging: true,
  enableCors: true,
  validateContentType: true
});
