/**
 * Field Mapping API Routes
 *
 * WHY: API endpoints for managing field mapping configurations
 * WHEN: Admin UI loads/saves field mappings
 * HOW: Next.js App Router API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  loadFieldMappingConfig,
  saveFieldMappingConfig,
  listConfiguredBuyerServices,
} from '@/lib/field-mapping/configuration-service';
import { getSourceFieldsForService } from '@/lib/field-mapping/source-fields';
import { AVAILABLE_TRANSFORMS } from '@/lib/field-mapping/transforms';
import type {
  FieldMappingConfig,
  FieldMappingApiResponse,
} from '@/types/field-mapping';

/**
 * GET /api/admin/field-mappings
 *
 * Load field mapping configuration for a buyer + service type,
 * or list all configured buyer-service combinations.
 *
 * Query params:
 * - buyerId: (required for loading config) Buyer ID
 * - serviceTypeId: (required for loading config) Service type ID
 * - list: If "true", returns list of all configurations
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const listAll = searchParams.get('list') === 'true';
    const buyerId = searchParams.get('buyerId');
    const serviceTypeId = searchParams.get('serviceTypeId');

    // List all configurations
    if (listAll) {
      const configs = await listConfiguredBuyerServices();
      return NextResponse.json({
        success: true,
        configurations: configs,
      });
    }

    // Load specific configuration
    if (!buyerId || !serviceTypeId) {
      return NextResponse.json(
        { success: false, error: 'buyerId and serviceTypeId are required' },
        { status: 400 }
      );
    }

    // Get buyer and service type info
    const [buyer, serviceType, serviceConfig] = await Promise.all([
      prisma.buyer.findUnique({
        where: { id: buyerId },
        select: { id: true, name: true },
      }),
      prisma.serviceType.findUnique({
        where: { id: serviceTypeId },
        select: { id: true, displayName: true, formSchema: true },
      }),
      prisma.buyerServiceConfig.findUnique({
        where: { buyerId_serviceTypeId: { buyerId, serviceTypeId } },
        select: { active: true },
      }),
    ]);

    if (!buyer) {
      return NextResponse.json(
        { success: false, error: 'Buyer not found' },
        { status: 404 }
      );
    }

    if (!serviceType) {
      return NextResponse.json(
        { success: false, error: 'Service type not found' },
        { status: 404 }
      );
    }

    // Load field mapping config
    const config = await loadFieldMappingConfig(buyerId, serviceTypeId, true);

    // Get source fields for this service type
    const sourceFields = getSourceFieldsForService({
      name: serviceType.displayName,
      formSchema: serviceType.formSchema || '{}',
    });

    const response: FieldMappingApiResponse = {
      success: true,
      config,
      sourceFields,
      buyerId,
      serviceTypeId,
    };

    // Add additional metadata
    return NextResponse.json({
      ...response,
      buyer: {
        id: buyer.id,
        name: buyer.name,
      },
      serviceType: {
        id: serviceType.id,
        name: serviceType.displayName,
      },
      isActive: serviceConfig?.active ?? false,
      transforms: AVAILABLE_TRANSFORMS,
    });
  } catch (error) {
    console.error('Field mappings GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/field-mappings
 *
 * Save field mapping configuration for a buyer + service type.
 *
 * Body:
 * - buyerId: Buyer ID
 * - serviceTypeId: Service type ID
 * - config: FieldMappingConfig object
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { buyerId, serviceTypeId, config } = body as {
      buyerId: string;
      serviceTypeId: string;
      config: FieldMappingConfig;
    };

    if (!buyerId || !serviceTypeId || !config) {
      return NextResponse.json(
        {
          success: false,
          error: 'buyerId, serviceTypeId, and config are required',
        },
        { status: 400 }
      );
    }

    // Verify buyer service config exists
    const existingConfig = await prisma.buyerServiceConfig.findUnique({
      where: { buyerId_serviceTypeId: { buyerId, serviceTypeId } },
    });

    if (!existingConfig) {
      return NextResponse.json(
        {
          success: false,
          error: 'Buyer service configuration not found. Create it first.',
        },
        { status: 404 }
      );
    }

    // Save configuration
    const result = await saveFieldMappingConfig(buyerId, serviceTypeId, config);

    if (!result.isValid) {
      return NextResponse.json(
        {
          success: false,
          validationResult: result,
          error: 'Validation failed',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      validationResult: result,
      message: 'Field mappings saved successfully',
    });
  } catch (error) {
    console.error('Field mappings PUT error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/field-mappings
 *
 * Toggle buyer service config active status.
 *
 * Body:
 * - buyerId: Buyer ID
 * - serviceTypeId: Service type ID
 * - active: New active status
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { buyerId, serviceTypeId, active } = body as {
      buyerId: string;
      serviceTypeId: string;
      active: boolean;
    };

    if (!buyerId || !serviceTypeId || typeof active !== 'boolean') {
      return NextResponse.json(
        {
          success: false,
          error: 'buyerId, serviceTypeId, and active (boolean) are required',
        },
        { status: 400 }
      );
    }

    // Update active status
    await prisma.buyerServiceConfig.update({
      where: { buyerId_serviceTypeId: { buyerId, serviceTypeId } },
      data: { active },
    });

    return NextResponse.json({
      success: true,
      active,
      message: `Buyer ${active ? 'enabled' : 'disabled'} for this service type`,
    });
  } catch (error) {
    console.error('Field mappings PATCH error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
