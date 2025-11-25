import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { expandServiceLocationsToZipCodes, type ExpandedServiceMapping } from '@/lib/services/location-expansion';

const prisma = new PrismaClient();

// Validation schemas
const ServiceTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  category: z.enum(['construction', 'repair', 'maintenance', 'installation']),
  description: z.string(),
  icon: z.string()
});

const LocationSchema = z.object({
  id: z.string(),
  type: z.enum(['city', 'state', 'county', 'zipcode']),
  name: z.string(),
  displayName: z.string(),
  state: z.string().optional(),
  county: z.string().optional(),
  coordinates: z.tuple([z.number(), z.number()]).optional()
});

const ServiceLocationMappingSchema = z.object({
  serviceId: z.string(),
  locations: z.object({
    states: z.array(LocationSchema),
    cities: z.array(LocationSchema),
    counties: z.array(LocationSchema),
    zipCodes: z.array(LocationSchema)
  })
});

const SaveServiceLocationRequestSchema = z.object({
  contractorId: z.string(),
  selectedServices: z.array(ServiceTypeSchema),
  serviceLocationMappings: z.array(ServiceLocationMappingSchema),
  expandedMappings: z.array(z.object({
    serviceId: z.string(),
    zipCodes: z.array(z.string()),
    summary: z.object({
      totalZipCodes: z.number(),
      fromStates: z.number(),
      fromCities: z.number(),
      fromCounties: z.number(),
      directZipCodes: z.number()
    })
  })).optional()
});

const GetServiceLocationRequestSchema = z.object({
  contractorId: z.string(),
  serviceTypeId: z.string().optional()
});

/**
 * POST /api/contractors/service-locations
 * Save contractor service location configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = SaveServiceLocationRequestSchema.parse(body);

    const { contractorId, selectedServices, serviceLocationMappings } = validatedData;

    // Expand locations to ZIP codes if not provided
    let expandedMappings = validatedData.expandedMappings;
    if (!expandedMappings) {
      expandedMappings = expandServiceLocationsToZipCodes(serviceLocationMappings);
    }

    // Start transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify contractor exists (in a real app, you'd check the Contractor/User table)
      // For now, we'll use the Buyer table as contractors
      const contractor = await tx.buyer.findUnique({
        where: { id: contractorId }
      });

      if (!contractor) {
        throw new Error('Contractor not found');
      }

      // 2. Clear existing service configurations for this contractor
      await tx.buyerServiceConfig.deleteMany({
        where: { buyerId: contractorId }
      });

      await tx.buyerServiceZipCode.deleteMany({
        where: { buyerId: contractorId }
      });

      // 3. Create service configurations
      const serviceConfigPromises = selectedServices.map(service =>
        tx.buyerServiceConfig.create({
          data: {
            buyerId: contractorId,
            serviceTypeId: service.id,
            pingTemplate: JSON.stringify({
              serviceType: service.name,
              displayName: service.displayName,
              category: service.category
            }),
            postTemplate: JSON.stringify({
              serviceType: service.name,
              displayName: service.displayName,
              category: service.category
            }),
            fieldMappings: JSON.stringify({
              serviceType: service.name,
              category: service.category
            }),
            requiresTrustedForm: true,
            requiresJornaya: true,
            minBid: 10.00,
            maxBid: 100.00
          }
        })
      );

      await Promise.all(serviceConfigPromises);

      // 4. Create ZIP code mappings for each service
      const zipCodeMappingPromises = expandedMappings.flatMap(expandedMapping => 
        expandedMapping.zipCodes.map(zipCode =>
          tx.buyerServiceZipCode.create({
            data: {
              buyerId: contractorId,
              serviceTypeId: expandedMapping.serviceId,
              zipCode: zipCode,
              active: true,
              priority: 100,
              maxLeadsPerDay: null,
              minBid: 10.00,
              maxBid: 100.00
            }
          })
        )
      );

      await Promise.all(zipCodeMappingPromises);

      // 5. Return summary
      return {
        contractorId,
        servicesConfigured: selectedServices.length,
        totalZipCodes: expandedMappings.reduce((sum, mapping) => sum + mapping.zipCodes.length, 0),
        serviceBreakdown: expandedMappings.map(mapping => ({
          serviceId: mapping.serviceId,
          serviceName: selectedServices.find(s => s.id === mapping.serviceId)?.displayName,
          zipCount: mapping.zipCodes.length,
          summary: mapping.summary
        }))
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Service locations configured successfully',
      data: result
    }, { status: 201 });

  } catch (error) {
    console.error('Error saving service locations:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * GET /api/contractors/service-locations
 * Retrieve contractor service location configuration
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractorId = searchParams.get('contractorId');
    const serviceTypeId = searchParams.get('serviceTypeId');

    if (!contractorId) {
      return NextResponse.json({
        success: false,
        message: 'contractorId is required'
      }, { status: 400 });
    }

    // Build the where clause
    const whereClause: any = { buyerId: contractorId };
    if (serviceTypeId) {
      whereClause.serviceTypeId = serviceTypeId;
    }

    // Get service configurations
    const serviceConfigs = await prisma.buyerServiceConfig.findMany({
      where: { buyerId: contractorId },
      include: {
        serviceType: true
      }
    });

    // Get ZIP code mappings
    const zipCodeMappings = await prisma.buyerServiceZipCode.findMany({
      where: whereClause,
      include: {
        serviceType: true
      },
      orderBy: [
        { serviceTypeId: 'asc' },
        { zipCode: 'asc' }
      ]
    });

    // Group ZIP codes by service type
    const serviceLocationMap = zipCodeMappings.reduce((acc, mapping) => {
      const serviceId = mapping.serviceTypeId;
      if (!acc[serviceId]) {
        acc[serviceId] = {
          serviceId,
          serviceName: mapping.serviceType.name,
          serviceDisplayName: mapping.serviceType.displayName,
          zipCodes: [],
          totalZipCodes: 0,
          active: true
        };
      }
      
      if (mapping.active) {
        acc[serviceId].zipCodes.push({
          zipCode: mapping.zipCode,
          priority: mapping.priority,
          maxLeadsPerDay: mapping.maxLeadsPerDay,
          minBid: mapping.minBid,
          maxBid: mapping.maxBid,
          active: mapping.active
        });
        acc[serviceId].totalZipCodes++;
      }
      
      return acc;
    }, {} as Record<string, any>);

    const result = {
      contractorId,
      servicesConfigured: serviceConfigs.length,
      totalActiveZipCodes: zipCodeMappings.filter(m => m.active).length,
      services: Object.values(serviceLocationMap),
      serviceConfigs: serviceConfigs.map(config => ({
        serviceId: config.serviceTypeId,
        serviceName: config.serviceType.name,
        serviceDisplayName: config.serviceType.displayName,
        minBid: config.minBid,
        maxBid: config.maxBid,
        requiresTrustedForm: config.requiresTrustedForm,
        requiresJornaya: config.requiresJornaya,
        active: config.active
      }))
    };

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error retrieving service locations:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * PUT /api/contractors/service-locations
 * Update contractor service location configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = SaveServiceLocationRequestSchema.parse(body);

    // For updates, we'll delete existing and recreate (simpler than complex diff logic)
    // In production, you might want more sophisticated update logic
    return await POST(request);

  } catch (error) {
    console.error('Error updating service locations:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/contractors/service-locations
 * Clear contractor service location configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractorId = searchParams.get('contractorId');
    const serviceTypeId = searchParams.get('serviceTypeId');

    if (!contractorId) {
      return NextResponse.json({
        success: false,
        message: 'contractorId is required'
      }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Build where clauses
      const serviceConfigWhere: any = { buyerId: contractorId };
      const zipCodeWhere: any = { buyerId: contractorId };

      if (serviceTypeId) {
        serviceConfigWhere.serviceTypeId = serviceTypeId;
        zipCodeWhere.serviceTypeId = serviceTypeId;
      }

      // Delete ZIP code mappings
      const deletedZipCodes = await tx.buyerServiceZipCode.deleteMany({
        where: zipCodeWhere
      });

      // Delete service configurations
      const deletedConfigs = await tx.buyerServiceConfig.deleteMany({
        where: serviceConfigWhere
      });

      return {
        deletedServiceConfigs: deletedConfigs.count,
        deletedZipCodeMappings: deletedZipCodes.count
      };
    });

    return NextResponse.json({
      success: true,
      message: serviceTypeId 
        ? 'Service configuration removed successfully'
        : 'All service configurations cleared successfully',
      data: result
    });

  } catch (error) {
    console.error('Error deleting service locations:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}