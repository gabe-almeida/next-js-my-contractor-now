import { NextResponse } from 'next/server';
import { withMiddleware, withValidation, EnhancedRequest } from '@/lib/middleware';
import { buyerSchema } from '@/lib/validation';
import { RedisCache } from '@/config/redis';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { BuyerResponseParser } from '@/lib/buyers/response-parser';

// Get specific buyer
async function handleGetBuyer(
  req: EnhancedRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = params;

  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      const response = errorResponse(
        'INVALID_ID',
        'Invalid buyer ID format',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 400 });
    }

    // Find buyer with relations
    const buyer = await prisma.buyer.findUnique({
      where: { id },
      include: {
        serviceConfigs: {
          include: {
            serviceType: {
              select: {
                id: true,
                name: true,
                displayName: true
              }
            }
          }
        },
        _count: {
          select: {
            serviceZipCodes: true,
            wonLeads: true,
            transactions: true
          }
        }
      }
    });

    if (!buyer) {
      const response = errorResponse(
        'BUYER_NOT_FOUND',
        'Buyer not found',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 404 });
    }

    // Parse auth config
    let authType = 'unknown';
    let credentialKeys: string[] = [];
    if (buyer.authConfig) {
      try {
        const authConfig = JSON.parse(buyer.authConfig);
        authType = authConfig.type || 'unknown';
        credentialKeys = authConfig.credentials ? Object.keys(authConfig.credentials) : [];
      } catch {
        authType = 'unknown';
      }
    }

    // Return safe buyer data with full details for admin
    const safeBuyer = {
      id: buyer.id,
      name: buyer.name,
      displayName: buyer.displayName,
      type: buyer.type,
      apiUrl: buyer.apiUrl,
      authType,
      credentialKeys, // Include credential keys (but not values) for admin interface
      active: buyer.active,
      pingTimeout: buyer.pingTimeout,
      postTimeout: buyer.postTimeout,
      contactName: buyer.contactName,
      contactEmail: buyer.contactEmail,
      contactPhone: buyer.contactPhone,
      businessEmail: buyer.businessEmail,
      businessPhone: buyer.businessPhone,
      complianceFieldMappings: buyer.complianceFieldMappings ? JSON.parse(buyer.complianceFieldMappings) : null,
      responseMappingConfig: buyer.responseMappingConfig ? JSON.parse(buyer.responseMappingConfig) : null,
      serviceConfigs: buyer.serviceConfigs.map(config => ({
        id: config.id,
        serviceTypeId: config.serviceTypeId,
        serviceName: config.serviceType.displayName,
        minBid: config.minBid,
        maxBid: config.maxBid,
        requiresTrustedForm: config.requiresTrustedForm,
        requiresJornaya: config.requiresJornaya,
        active: config.active
      })),
      stats: {
        zipCodeCount: buyer._count.serviceZipCodes,
        leadsWon: buyer._count.wonLeads,
        totalTransactions: buyer._count.transactions
      },
      createdAt: buyer.createdAt,
      updatedAt: buyer.updatedAt
    };

    const response = successResponse(safeBuyer, requestId);
    return NextResponse.json(response);

  } catch (error) {
    logger.error('Buyer fetch error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId,
      buyerId: id
    });

    const response = errorResponse(
      'FETCH_ERROR',
      'Failed to fetch buyer',
      undefined,
      undefined,
      requestId
    );

    return NextResponse.json(response, { status: 500 });
  }
}

// Update buyer
async function handleUpdateBuyer(
  req: EnhancedRequest,
  validatedData: {
    name?: string;
    displayName?: string;
    apiUrl?: string;
    authConfig?: {
      type: 'apikey' | 'bearer' | 'basic';
      credentials: Record<string, string>;
    };
    active?: boolean;
    type?: 'CONTRACTOR' | 'NETWORK';
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    businessEmail?: string;
    businessPhone?: string;
    pingTimeout?: number;
    postTimeout?: number;
    complianceFieldMappings?: any;
    responseMappingConfig?: any;
  },
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = params;

  try {
    // Find buyer
    const existingBuyer = await prisma.buyer.findUnique({
      where: { id }
    });

    if (!existingBuyer) {
      const response = errorResponse(
        'BUYER_NOT_FOUND',
        'Buyer not found',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 404 });
    }

    // Check if name change conflicts with existing buyer
    if (validatedData.name && validatedData.name !== existingBuyer.name) {
      const nameExists = await prisma.buyer.findFirst({
        where: {
          id: { not: id },
          name: validatedData.name
        }
      });

      if (nameExists) {
        const response = errorResponse(
          'BUYER_NAME_EXISTS',
          'Buyer with this name already exists',
          { name: validatedData.name },
          'name',
          requestId
        );
        return NextResponse.json(response, { status: 409 });
      }
    }

    // Validate API URL if provided
    if (validatedData.apiUrl) {
      try {
        const urlCheck = new URL(validatedData.apiUrl);
        if (!['http:', 'https:'].includes(urlCheck.protocol)) {
          const response = errorResponse(
            'INVALID_API_URL',
            'API URL must use HTTP or HTTPS protocol',
            { apiUrl: validatedData.apiUrl },
            'apiUrl',
            requestId
          );
          return NextResponse.json(response, { status: 400 });
        }
      } catch {
        const response = errorResponse(
          'INVALID_API_URL',
          'Invalid API URL format',
          { apiUrl: validatedData.apiUrl },
          'apiUrl',
          requestId
        );
        return NextResponse.json(response, { status: 400 });
      }
    }

    // Prepare update data
    const updateData: any = {
      ...(validatedData.name && { name: validatedData.name }),
      ...(validatedData.displayName !== undefined && { displayName: validatedData.displayName }),
      ...(validatedData.type && { type: validatedData.type }),
      ...(validatedData.apiUrl && { apiUrl: validatedData.apiUrl }),
      ...(validatedData.authConfig && { authConfig: JSON.stringify(validatedData.authConfig) }),
      ...(validatedData.active !== undefined && { active: validatedData.active }),
      ...(validatedData.contactName !== undefined && { contactName: validatedData.contactName }),
      ...(validatedData.contactEmail !== undefined && { contactEmail: validatedData.contactEmail }),
      ...(validatedData.contactPhone !== undefined && { contactPhone: validatedData.contactPhone }),
      ...(validatedData.businessEmail !== undefined && { businessEmail: validatedData.businessEmail }),
      ...(validatedData.businessPhone !== undefined && { businessPhone: validatedData.businessPhone }),
      ...(validatedData.pingTimeout && { pingTimeout: validatedData.pingTimeout }),
      ...(validatedData.postTimeout && { postTimeout: validatedData.postTimeout }),
      ...(validatedData.complianceFieldMappings !== undefined && {
        complianceFieldMappings: validatedData.complianceFieldMappings
          ? JSON.stringify(validatedData.complianceFieldMappings)
          : null
      }),
      ...(validatedData.responseMappingConfig !== undefined && {
        responseMappingConfig: validatedData.responseMappingConfig
          ? JSON.stringify(validatedData.responseMappingConfig)
          : null
      })
    };

    // Update buyer
    const updatedBuyer = await prisma.buyer.update({
      where: { id },
      data: updateData,
      include: {
        serviceConfigs: true,
        _count: {
          select: {
            serviceZipCodes: true,
            wonLeads: true
          }
        }
      }
    });

    // Clear related caches
    await Promise.all([
      RedisCache.deletePattern('admin:buyers:*'),
      RedisCache.delete(`buyer:${id}`)
    ]);

    // Invalidate response mapping cache if config was updated
    if (validatedData.responseMappingConfig !== undefined) {
      BuyerResponseParser.invalidateCache(id);
      logger.info('Response mapping cache invalidated for buyer', {
        buyerId: id,
        requestId
      });
    }

    logger.info('Buyer updated', {
      buyerId: id,
      buyerName: updatedBuyer.name,
      changes: Object.keys(validatedData),
      requestId
    });

    // Parse auth type
    let authType = 'unknown';
    let credentialKeys: string[] = [];
    if (updatedBuyer.authConfig) {
      try {
        const authConfig = JSON.parse(updatedBuyer.authConfig);
        authType = authConfig.type || 'unknown';
        credentialKeys = authConfig.credentials ? Object.keys(authConfig.credentials) : [];
      } catch {
        authType = 'unknown';
      }
    }

    // Return safe buyer data
    const safeBuyer = {
      id: updatedBuyer.id,
      name: updatedBuyer.name,
      displayName: updatedBuyer.displayName,
      type: updatedBuyer.type,
      apiUrl: updatedBuyer.apiUrl,
      authType,
      credentialKeys,
      active: updatedBuyer.active,
      pingTimeout: updatedBuyer.pingTimeout,
      postTimeout: updatedBuyer.postTimeout,
      contactName: updatedBuyer.contactName,
      contactEmail: updatedBuyer.contactEmail,
      contactPhone: updatedBuyer.contactPhone,
      businessEmail: updatedBuyer.businessEmail,
      businessPhone: updatedBuyer.businessPhone,
      complianceFieldMappings: updatedBuyer.complianceFieldMappings ? JSON.parse(updatedBuyer.complianceFieldMappings) : null,
      responseMappingConfig: updatedBuyer.responseMappingConfig ? JSON.parse(updatedBuyer.responseMappingConfig) : null,
      serviceConfigCount: updatedBuyer._count.serviceZipCodes,
      zipCodeCount: updatedBuyer._count.serviceZipCodes,
      leadsWon: updatedBuyer._count.wonLeads,
      createdAt: updatedBuyer.createdAt,
      updatedAt: updatedBuyer.updatedAt
    };

    const response = successResponse(safeBuyer, requestId);
    return NextResponse.json(response);

  } catch (error) {
    logger.error('Buyer update error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId,
      buyerId: id
    });

    const response = errorResponse(
      'UPDATE_ERROR',
      'Failed to update buyer',
      undefined,
      undefined,
      requestId
    );

    return NextResponse.json(response, { status: 500 });
  }
}

// Delete buyer
async function handleDeleteBuyer(
  req: EnhancedRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = params;

  try {
    // Find buyer with service configs count
    const buyer = await prisma.buyer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            serviceConfigs: true,
            serviceZipCodes: true
          }
        }
      }
    });

    if (!buyer) {
      const response = errorResponse(
        'BUYER_NOT_FOUND',
        'Buyer not found',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 404 });
    }

    // Check if buyer has active service configurations or ZIP codes
    if (buyer._count.serviceConfigs > 0 || buyer._count.serviceZipCodes > 0) {
      const response = errorResponse(
        'BUYER_HAS_CONFIGS',
        'Cannot delete buyer with active service configurations or ZIP codes',
        {
          id,
          serviceConfigCount: buyer._count.serviceConfigs,
          zipCodeCount: buyer._count.serviceZipCodes
        },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 409 });
    }

    // Delete buyer (cascade will handle related records per schema)
    await prisma.buyer.delete({
      where: { id }
    });

    // Clear related caches
    await Promise.all([
      RedisCache.deletePattern('admin:buyers:*'),
      RedisCache.delete(`buyer:${id}`)
    ]);

    logger.info('Buyer deleted', {
      buyerId: id,
      buyerName: buyer.name,
      requestId
    });

    const response = successResponse(
      {
        message: 'Buyer successfully deleted',
        buyerId: id
      },
      requestId
    );

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Buyer deletion error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId,
      buyerId: id
    });

    const response = errorResponse(
      'DELETE_ERROR',
      'Failed to delete buyer',
      undefined,
      undefined,
      requestId
    );

    return NextResponse.json(response, { status: 500 });
  }
}

// Export route handlers with admin authentication
export const GET = withMiddleware(
  handleGetBuyer,
  {
    rateLimiter: 'admin',
    enableLogging: true,
    requireAuth: true,
    enableCors: true
  }
);

export const PUT = withMiddleware(
  withValidation(
    (data) => buyerSchema.partial().safeParse(data),
    handleUpdateBuyer
  ),
  {
    rateLimiter: 'admin',
    enableLogging: true,
    requireAuth: true,
    validateContentType: true,
    enableCors: true
  }
);

export const DELETE = withMiddleware(
  handleDeleteBuyer,
  {
    rateLimiter: 'admin',
    enableLogging: true,
    requireAuth: true,
    enableCors: true
  }
);
