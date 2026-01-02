import { NextResponse } from 'next/server';
import { withMiddleware, withValidation, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { RedisCache } from '@/config/redis';
import { generateId, successResponse, errorResponse } from '@/lib/utils';
import { ServiceZoneRepository, ServiceZoneInput, BulkServiceZoneInput } from '@/lib/repositories/service-zone-repository';
import { BuyerEligibilityService } from '@/lib/services/buyer-eligibility-service';
import { z } from 'zod';

// Validation schemas
const serviceZoneSchema = z.object({
  buyerId: z.string().uuid('Invalid buyer ID format'),
  serviceTypeId: z.string().uuid('Invalid service type ID format'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  active: z.boolean().optional().default(true),
  priority: z.number().int().min(1).max(1000).optional().default(100),
  maxLeadsPerDay: z.number().int().min(0).optional(),
  minBid: z.number().min(0).optional(),
  maxBid: z.number().min(0).optional()
});

const bulkServiceZoneSchema = z.object({
  buyerId: z.string().uuid('Invalid buyer ID format'),
  serviceTypeId: z.string().uuid('Invalid service type ID format'),
  zipCodes: z.array(z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format')).min(1).max(1000),
  active: z.boolean().optional().default(true),
  priority: z.number().int().min(1).max(1000).optional().default(100),
  maxLeadsPerDay: z.number().int().min(0).optional(),
  minBid: z.number().min(0).optional(),
  maxBid: z.number().min(0).optional()
});

const serviceZoneFilterSchema = z.object({
  buyerId: z.string().uuid().optional(),
  serviceTypeId: z.string().uuid().optional(),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
  zipCodes: z.array(z.string().regex(/^\d{5}(-\d{4})?$/)).optional(),
  state: z.string().length(2).optional(),
  active: z.boolean().optional(),
  includeRelations: z.boolean().optional().default(true),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(1000).optional().default(50)
});

// Get service zones with filtering and pagination
async function handleGetServiceZones(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;
  const url = new URL(req.url);
  
  try {
    // Parse query parameters - use Record<string, unknown> to allow type conversions
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const queryParams: Record<string, unknown> = { ...rawParams };

    // Convert string parameters to appropriate types
    if (rawParams.active !== undefined) {
      queryParams.active = rawParams.active === 'true';
    }
    if (rawParams.includeRelations !== undefined) {
      queryParams.includeRelations = rawParams.includeRelations === 'true';
    }
    if (rawParams.page) {
      queryParams.page = parseInt(rawParams.page);
    }
    if (rawParams.limit) {
      queryParams.limit = parseInt(rawParams.limit);
    }
    if (rawParams.zipCodes) {
      queryParams.zipCodes = rawParams.zipCodes.split(',');
    }

    // Validate query parameters
    const validatedParams = serviceZoneFilterSchema.parse(queryParams);
    
    // Create cache key
    const cacheKey = `service-zones:list:${JSON.stringify(validatedParams)}`;
    let result = await RedisCache.get<any>(cacheKey);
    
    if (!result) {
      // Get service zones from repository
      const serviceZones = await ServiceZoneRepository.findMany({
        buyerId: validatedParams.buyerId,
        serviceTypeId: validatedParams.serviceTypeId,
        zipCode: validatedParams.zipCode,
        zipCodes: validatedParams.zipCodes,
        state: validatedParams.state,
        active: validatedParams.active,
        includeRelations: validatedParams.includeRelations
      });

      // Apply pagination
      const startIndex = (validatedParams.page - 1) * validatedParams.limit;
      const endIndex = startIndex + validatedParams.limit;
      const paginatedZones = serviceZones.slice(startIndex, endIndex);

      result = {
        data: paginatedZones,
        pagination: {
          page: validatedParams.page,
          limit: validatedParams.limit,
          total: serviceZones.length,
          pages: Math.ceil(serviceZones.length / validatedParams.limit)
        }
      };

      // Cache for 10 minutes
      await RedisCache.set(cacheKey, result, 600);
    }
    
    const response = successResponse(result, requestId);
    return NextResponse.json(response);
    
  } catch (error) {
    logger.error('Service zones fetch error', {
      error: (error as Error).message,
      requestId
    });
    
    const response = errorResponse(
      'FETCH_ERROR',
      'Failed to fetch service zones',
      undefined,
      undefined,
      requestId
    );
    
    return NextResponse.json(response, { status: 500 });
  }
}

// Create new service zone
async function handleCreateServiceZone(
  req: EnhancedRequest,
  validatedData: ServiceZoneInput | BulkServiceZoneInput
): Promise<NextResponse> {
  const { requestId } = req.context;
  
  try {
    let result;
    
    // Check if this is bulk creation
    if ('zipCodes' in validatedData) {
      // Bulk creation
      const bulkData = validatedData as BulkServiceZoneInput;
      const serviceZones = await ServiceZoneRepository.createBulk(bulkData);
      
      logger.info('Bulk service zones created', {
        buyerId: bulkData.buyerId,
        serviceTypeId: bulkData.serviceTypeId,
        zipCodeCount: bulkData.zipCodes.length,
        requestId
      });
      
      result = {
        message: `Created ${serviceZones.length} service zones`,
        serviceZones: serviceZones,
        count: serviceZones.length
      };
      
    } else {
      // Single creation
      const singleData = validatedData as ServiceZoneInput;
      const serviceZone = await ServiceZoneRepository.create(singleData);
      
      logger.info('Service zone created', {
        serviceZoneId: serviceZone.id,
        buyerId: singleData.buyerId,
        serviceTypeId: singleData.serviceTypeId,
        zipCode: singleData.zipCode,
        requestId
      });
      
      result = {
        message: 'Service zone created successfully',
        serviceZone
      };
    }
    
    const response = successResponse(result, requestId);
    return NextResponse.json(response, { status: 201 });
    
  } catch (error) {
    logger.error('Service zone creation error', {
      error: (error as Error).message,
      requestId,
      data: validatedData
    });
    
    const response = errorResponse(
      'CREATION_ERROR',
      'Failed to create service zone',
      undefined,
      undefined,
      requestId
    );
    
    return NextResponse.json(response, { status: 500 });
  }
}

// Delete multiple service zones
async function handleDeleteServiceZones(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;
  
  try {
    const body = await req.json();
    
    // Validate delete parameters
    const deleteParams = z.object({
      ids: z.array(z.string().uuid()).optional(),
      buyerId: z.string().uuid().optional(),
      serviceTypeId: z.string().uuid().optional(),
      zipCodes: z.array(z.string().regex(/^\d{5}(-\d{4})?$/)).optional()
    }).parse(body);
    
    let deletedCount = 0;
    
    if (deleteParams.ids && deleteParams.ids.length > 0) {
      // Delete by IDs
      for (const id of deleteParams.ids) {
        await ServiceZoneRepository.delete(id);
        deletedCount++;
      }
    } else {
      // Delete by filter
      deletedCount = await ServiceZoneRepository.deleteBulk({
        buyerId: deleteParams.buyerId,
        serviceTypeId: deleteParams.serviceTypeId,
        zipCodes: deleteParams.zipCodes
      });
    }
    
    logger.info('Service zones deleted', {
      deletedCount,
      deleteParams,
      requestId
    });
    
    const response = successResponse({
      message: `Deleted ${deletedCount} service zone(s)`,
      deletedCount
    }, requestId);
    
    return NextResponse.json(response);
    
  } catch (error) {
    logger.error('Service zones deletion error', {
      error: (error as Error).message,
      requestId
    });
    
    const response = errorResponse(
      'DELETION_ERROR',
      'Failed to delete service zones',
      undefined,
      undefined,
      requestId
    );
    
    return NextResponse.json(response, { status: 500 });
  }
}

// Export route handlers with admin authentication
export const GET = withMiddleware(
  handleGetServiceZones,
  {
    rateLimiter: 'admin',
    enableLogging: true,
    requireAuth: true,
    enableCors: true
  }
);

export const POST = withMiddleware(
  withValidation(
    (data) => {
      // Check if it's bulk creation (has zipCodes array) or single creation (has zipCode string)
      if ('zipCodes' in data && Array.isArray(data.zipCodes)) {
        return bulkServiceZoneSchema.safeParse(data);
      } else {
        return serviceZoneSchema.safeParse(data);
      }
    },
    handleCreateServiceZone
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
  handleDeleteServiceZones,
  {
    rateLimiter: 'admin',
    enableLogging: true,
    requireAuth: true,
    validateContentType: true,
    enableCors: true
  }
);