import { NextResponse } from 'next/server';
import { withMiddleware, withValidation, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { ServiceZoneRepository, ServiceZoneInput } from '@/lib/repositories/service-zone-repository';
import { z } from 'zod';

// Validation schema for updates
const updateServiceZoneSchema = z.object({
  active: z.boolean().optional(),
  priority: z.number().int().min(1).max(1000).optional(),
  maxLeadsPerDay: z.number().int().min(0).optional(),
  minBid: z.number().min(0).optional(),
  maxBid: z.number().min(0).optional()
});

// Get single service zone by ID
async function handleGetServiceZone(
  req: EnhancedRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = params;
  
  try {
    // Validate ID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const response = errorResponse(
        'INVALID_ID',
        'Invalid service zone ID format',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 400 });
    }

    // Get service zones with the ID (using findMany with exact match)
    const serviceZones = await ServiceZoneRepository.findMany({ includeRelations: true });
    const serviceZone = serviceZones.find(sz => sz.id === id);
    
    if (!serviceZone) {
      const response = errorResponse(
        'SERVICE_ZONE_NOT_FOUND',
        'Service zone not found',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 404 });
    }
    
    const response = successResponse(serviceZone, requestId);
    return NextResponse.json(response);
    
  } catch (error) {
    logger.error('Service zone fetch error', {
      error: (error as Error).message,
      serviceZoneId: id,
      requestId
    });
    
    const response = errorResponse(
      'FETCH_ERROR',
      'Failed to fetch service zone',
      undefined,
      undefined,
      requestId
    );
    
    return NextResponse.json(response, { status: 500 });
  }
}

// Update service zone
async function handleUpdateServiceZone(
  req: EnhancedRequest,
  validatedData: Partial<ServiceZoneInput>,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = params;
  
  try {
    // Validate ID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const response = errorResponse(
        'INVALID_ID',
        'Invalid service zone ID format',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 400 });
    }
    
    // Update the service zone
    const updatedServiceZone = await ServiceZoneRepository.update(id, validatedData);
    
    logger.info('Service zone updated', {
      serviceZoneId: id,
      updates: validatedData,
      requestId
    });
    
    const response = successResponse({
      message: 'Service zone updated successfully',
      serviceZone: updatedServiceZone
    }, requestId);
    
    return NextResponse.json(response);
    
  } catch (error) {
    logger.error('Service zone update error', {
      error: (error as Error).message,
      serviceZoneId: id,
      updates: validatedData,
      requestId
    });
    
    // Check if it's a not found error
    if ((error as Error).message.includes('not found')) {
      const response = errorResponse(
        'SERVICE_ZONE_NOT_FOUND',
        'Service zone not found',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 404 });
    }
    
    const response = errorResponse(
      'UPDATE_ERROR',
      'Failed to update service zone',
      undefined,
      undefined,
      requestId
    );
    
    return NextResponse.json(response, { status: 500 });
  }
}

// Delete service zone
async function handleDeleteServiceZone(
  req: EnhancedRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = params;
  
  try {
    // Validate ID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      const response = errorResponse(
        'INVALID_ID',
        'Invalid service zone ID format',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 400 });
    }
    
    // Delete the service zone
    await ServiceZoneRepository.delete(id);
    
    logger.info('Service zone deleted', {
      serviceZoneId: id,
      requestId
    });
    
    const response = successResponse({
      message: 'Service zone deleted successfully'
    }, requestId);
    
    return NextResponse.json(response);
    
  } catch (error) {
    logger.error('Service zone deletion error', {
      error: (error as Error).message,
      serviceZoneId: id,
      requestId
    });
    
    // Check if it's a not found error
    if ((error as Error).message.includes('not found')) {
      const response = errorResponse(
        'SERVICE_ZONE_NOT_FOUND',
        'Service zone not found',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 404 });
    }
    
    const response = errorResponse(
      'DELETION_ERROR',
      'Failed to delete service zone',
      undefined,
      undefined,
      requestId
    );
    
    return NextResponse.json(response, { status: 500 });
  }
}

// Export route handlers with admin authentication
export const GET = withMiddleware(
  handleGetServiceZone,
  {
    rateLimiter: 'admin',
    enableLogging: true,
    requireAuth: true,
    enableCors: true
  }
);

export const PUT = withMiddleware(
  withValidation(
    (data) => updateServiceZoneSchema.safeParse(data),
    handleUpdateServiceZone
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
  handleDeleteServiceZone,
  {
    rateLimiter: 'admin',
    enableLogging: true,
    requireAuth: true,
    enableCors: true
  }
);