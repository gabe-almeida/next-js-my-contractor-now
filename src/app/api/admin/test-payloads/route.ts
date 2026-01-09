import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  loadFieldMappingConfig,
  generatePayloadPreview,
} from '@/lib/field-mapping/configuration-service';
import { FieldMapping } from '@/types/field-mapping';

/**
 * Test endpoint to preview payload transformations for each buyer
 * WITHOUT actually sending PING/POST requests
 *
 * WHY: Admin needs to verify field mappings produce correct output
 * WHEN: Testing buyer configuration before going live
 * HOW: Uses the same generatePayloadPreview() as admin UI
 *
 * This ensures test preview matches admin UI preview matches actual auction output.
 */
export async function POST(request: NextRequest) {
  try {
    const { leadData, serviceTypeId } = await request.json();

    // Get service type with active buyers
    const serviceType = await prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
      include: {
        buyerServiceConfigs: {
          where: { active: true },
          include: {
            buyer: true,
          },
        },
      },
    });

    if (!serviceType) {
      return NextResponse.json({ error: 'Service type not found' }, { status: 404 });
    }

    const results: any[] = [];

    // Process each buyer configuration
    for (const config of serviceType.buyerServiceConfigs) {
      try {
        // Load field mapping config from database
        const fieldMappingConfig = await loadFieldMappingConfig(
          config.buyerId,
          config.serviceTypeId
        );

        if (!fieldMappingConfig) {
          results.push({
            buyerId: config.buyerId,
            buyerName: config.buyer.name,
            buyerApiUrl: config.buyer.apiUrl,
            active: config.active,
            error: 'No field mapping configuration found',
            ping: { payload: {}, mappingCount: 0 },
            post: { payload: {}, mappingCount: 0 },
          });
          continue;
        }

        // Generate preview using the SAME function as admin UI
        // This ensures test = preview = production
        const preview = generatePayloadPreview(fieldMappingConfig, leadData);

        results.push({
          buyerId: config.buyerId,
          buyerName: config.buyer.name,
          buyerApiUrl: config.buyer.apiUrl,
          active: config.active,
          requiresTrustedForm: config.requiresTrustedForm,
          requiresJornaya: config.requiresJornaya,
          ping: {
            payload: preview.pingPayload,
            errors: preview.errors,
            mappingCount: fieldMappingConfig.mappings.filter((m: FieldMapping) => m.includeInPing).length,
          },
          post: {
            payload: preview.postPayload,
            errors: preview.errors,
            mappingCount: fieldMappingConfig.mappings.filter((m: FieldMapping) => m.includeInPost).length,
          },
          sourceData: {
            original: leadData,
          },
        });
      } catch (error) {
        results.push({
          buyerId: config.buyerId,
          buyerName: config.buyer.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          ping: { error: 'Failed to process' },
          post: { error: 'Failed to process' },
        });
      }
    }

    return NextResponse.json({
      success: true,
      serviceType: serviceType.name,
      totalBuyers: serviceType.buyerServiceConfigs.length,
      results,
      testData: {
        leadData,
        serviceTypeId,
      },
    });
  } catch (error) {
    console.error('Payload test error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Get available service types for testing
 */
export async function GET() {
  try {
    const serviceTypes = await prisma.serviceType.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            buyerServiceConfigs: {
              where: { active: true },
            },
          },
        },
      },
    });

    // Sample lead data for each service type
    const sampleData: Record<string, Record<string, any>> = {
      windows: {
        projectScope: 'install',
        numberOfWindows: '4-6',
        zipCode: '12345',
        timeframe: 'within_3_months',
        ownsHome: true,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
      },
      roofing: {
        projectScope: 'full_replacement',
        roofType: 'asphalt_shingles',
        roofSize: 'medium',
        zipCode: '12345',
        timeframe: 'within_3_months',
        ownsHome: true,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '555-987-6543',
      },
      bathrooms: {
        projectScope: 'full_renovation',
        bathroomType: 'master_bath',
        projectSize: 'medium',
        zipCode: '12345',
        timeframe: 'within_3_months',
        ownsHome: true,
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob.johnson@example.com',
        phone: '555-456-7890',
      },
      hvac: {
        systemType: 'central_ac',
        serviceType: 'installation',
        zipCode: '12345',
        timeframe: 'within_3_months',
        ownsHome: true,
        firstName: 'Alice',
        lastName: 'Williams',
        email: 'alice.williams@example.com',
        phone: '555-789-0123',
      },
    };

    return NextResponse.json({
      success: true,
      serviceTypes: serviceTypes.map((st) => ({
        ...st,
        activeBuyers: st._count.buyerServiceConfigs,
        sampleData: sampleData[st.name.toLowerCase()] || {},
      })),
    });
  } catch (error) {
    console.error('Service types fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
