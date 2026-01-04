/**
 * Admin Buyer Service Config API Route
 *
 * WHY: Allow admins to view contractor service coverage before activation
 * WHEN: Admin views buyer detail page, wants to see configured services
 * HOW: Query BuyerServiceConfig and aggregate BuyerServiceZipCode counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    console.error('Error fetching buyer service config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service configuration' },
      { status: 500 }
    );
  }
}
