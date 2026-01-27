/**
 * Admin Buyer Service Config API Route
 *
 * WHY: Allow admins to view and update contractor service coverage
 * WHEN: Admin views buyer detail page, wants to see/edit configured services
 * HOW: Query/Update BuyerServiceConfig and aggregate BuyerServiceZipCode counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { captureApiError } from '@/lib/sentry';
import { logger } from '@/lib/logger';
import { RedisCache } from '@/config/redis';
import { invalidateServiceConfigCache } from '@/lib/field-mapping/database-buyer-loader';

/**
 * GET /api/admin/buyers/[id]/service-config
 * Returns service configuration and ZIP code coverage for a buyer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const buyerId = params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(buyerId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid buyer ID format' },
        { status: 400 }
      );
    }

    // Verify buyer exists
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId },
      select: { id: true, name: true, type: true, active: true }
    });

    if (!buyer) {
      return NextResponse.json(
        { success: false, error: 'Buyer not found' },
        { status: 404 }
      );
    }

    // Get service configs with service type details
    // Note: BuyerServiceConfig doesn't have priority - order by createdAt instead
    const serviceConfigs = await prisma.buyerServiceConfig.findMany({
      where: { buyerId },
      include: {
        serviceType: {
          select: {
            id: true,
            name: true,
            displayName: true,
            active: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get ZIP code counts grouped by service type
    const zipCodeCounts = await prisma.buyerServiceZipCode.groupBy({
      by: ['serviceTypeId'],
      where: { buyerId },
      _count: { zipCode: true }
    });

    // Get active ZIP code counts
    const activeZipCodeCounts = await prisma.buyerServiceZipCode.groupBy({
      by: ['serviceTypeId'],
      where: { buyerId, active: true },
      _count: { zipCode: true }
    });

    // Create a map for easy lookup
    const zipCountMap = new Map(
      zipCodeCounts.map(c => [c.serviceTypeId, c._count.zipCode])
    );
    const activeZipCountMap = new Map(
      activeZipCodeCounts.map(c => [c.serviceTypeId, c._count.zipCode])
    );

    // Map configs with coverage data
    const servicesWithCoverage = serviceConfigs.map(config => ({
      serviceTypeId: config.serviceTypeId,
      serviceName: config.serviceType.name,
      serviceDisplayName: config.serviceType.displayName,
      serviceActive: config.serviceType.active,
      configActive: config.active,
      nationwide: config.nationwide, // Participates in all leads regardless of ZIP
      minBid: Number(config.minBid),
      maxBid: Number(config.maxBid),
      requiresTrustedForm: config.requiresTrustedForm,
      requiresJornaya: config.requiresJornaya,
      totalZipCodes: zipCountMap.get(config.serviceTypeId) || 0,
      activeZipCodes: activeZipCountMap.get(config.serviceTypeId) || 0,
      createdAt: config.createdAt,
    }));

    // Calculate totals
    const totalZipCodes = zipCodeCounts.reduce((sum, c) => sum + c._count.zipCode, 0);
    const totalActiveZipCodes = activeZipCodeCounts.reduce((sum, c) => sum + c._count.zipCode, 0);

    return NextResponse.json({
      success: true,
      data: {
        buyerId,
        buyerName: buyer.name,
        buyerType: buyer.type,
        buyerActive: buyer.active,
        services: servicesWithCoverage,
        summary: {
          totalServices: serviceConfigs.length,
          activeServices: serviceConfigs.filter(c => c.active).length,
          totalZipCodes,
          activeZipCodes: totalActiveZipCodes,
          hasNoZipCodes: totalZipCodes === 0,
        }
      }
    });

  } catch (error) {
    captureApiError(error, { route: '/api/admin/buyers/[id]/service-config', action: 'GET' });
    console.error('Error fetching buyer service config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service configuration' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/buyers/[id]/service-config
 * Update service configuration settings (nationwide toggle, active status, etc.)
 *
 * Body: { serviceTypeId: string, nationwide?: boolean, active?: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const buyerId = params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(buyerId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid buyer ID format' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { serviceTypeId, nationwide, active } = body;

    if (!serviceTypeId) {
      return NextResponse.json(
        { success: false, error: 'serviceTypeId is required' },
        { status: 400 }
      );
    }

    // Find existing config
    const existingConfig = await prisma.buyerServiceConfig.findUnique({
      where: {
        buyerId_serviceTypeId: { buyerId, serviceTypeId }
      },
      include: {
        buyer: { select: { name: true } },
        serviceType: { select: { name: true, displayName: true } }
      }
    });

    if (!existingConfig) {
      return NextResponse.json(
        { success: false, error: 'Service configuration not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: { nationwide?: boolean; active?: boolean } = {};

    if (typeof nationwide === 'boolean') {
      updateData.nationwide = nationwide;
    }

    if (typeof active === 'boolean') {
      updateData.active = active;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update the config
    const updatedConfig = await prisma.buyerServiceConfig.update({
      where: {
        buyerId_serviceTypeId: { buyerId, serviceTypeId }
      },
      data: updateData
    });

    // Invalidate in-memory service config cache immediately
    invalidateServiceConfigCache(buyerId, serviceTypeId);

    logger.info('Service config updated', {
      buyerId,
      buyerName: existingConfig.buyer.name,
      serviceTypeId,
      serviceName: existingConfig.serviceType.name,
      changes: updateData
    });

    // Invalidate eligibility caches when config changes
    // This ensures the new nationwide/active settings take effect immediately
    try {
      await RedisCache.deletePattern(`eligibility:service:${serviceTypeId}*`);
      await RedisCache.deletePattern(`daily-count:${buyerId}:*`);
      logger.debug('Eligibility cache invalidated', { buyerId, serviceTypeId });
    } catch (cacheError) {
      // Log but don't fail the request if cache clear fails
      logger.warn('Failed to invalidate eligibility cache', {
        error: (cacheError as Error).message
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        serviceTypeId: updatedConfig.serviceTypeId,
        nationwide: updatedConfig.nationwide,
        active: updatedConfig.active,
        message: `Service config updated for ${existingConfig.serviceType.displayName}`
      }
    });

  } catch (error) {
    captureApiError(error, { route: '/api/admin/buyers/[id]/service-config', action: 'PATCH' });
    console.error('Error updating buyer service config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update service configuration' },
      { status: 500 }
    );
  }
}
