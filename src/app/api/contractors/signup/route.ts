import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BuyerType } from '@/types/database';
import { z } from 'zod';
import { expandServiceLocationsToZipCodes, ServiceLocationMapping } from '@/lib/services/location-expansion';

// Additional contact validation schema
const additionalContactSchema = z.object({
  name: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 characters'),
  role: z.string().min(1, 'Contact role is required')
});

// Location schema for flat array format from UI
const locationSchema = z.object({
  id: z.string(),
  type: z.enum(['city', 'state', 'county', 'zipcode']),
  name: z.string(),
  displayName: z.string(),
  state: z.string().optional()
});

// Service schema with UUID from database
const serviceSchema = z.object({
  id: z.string().uuid('Invalid service ID format'),
  name: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  icon: z.string().optional()
});

// Service location mapping schema
const serviceLocationMappingSchema = z.object({
  serviceId: z.string().uuid('Invalid service ID format'),
  locations: z.array(locationSchema)
});

// Validation schema for contractor signup
const contractorSignupSchema = z.object({
  contactName: z.string().min(2, 'Contact name must be at least 2 characters').max(100),
  contactEmail: z.string().email('Invalid email address'),
  contactPhone: z.string().min(10, 'Phone number must be at least 10 characters'),
  companyName: z.string().min(2, 'Company name must be at least 2 characters').max(200),
  businessEmail: z.string().email('Invalid business email address'),
  businessPhone: z.string().min(10, 'Business phone number must be at least 10 characters'),
  additionalContacts: z.array(additionalContactSchema).optional().default([]),
  selectedServices: z.array(serviceSchema).default([]),
  serviceLocationMappings: z.array(serviceLocationMappingSchema).default([]),
  type: z.nativeEnum(BuyerType).default(BuyerType.CONTRACTOR)
});

// Infer types from zod schemas
type LocationInput = z.infer<typeof locationSchema>;
type ServiceLocationMappingInput = z.infer<typeof serviceLocationMappingSchema>;

/**
 * Transform flat location array to grouped structure for expansion
 * WHY: UI sends flat array, but expandServiceLocationsToZipCodes expects grouped object
 * WHEN: Before calling the location expansion function
 * HOW: Group locations by their type field into separate arrays
 */
function transformLocationsToGrouped(
  mappings: ServiceLocationMappingInput[]
): ServiceLocationMapping[] {
  return mappings.map(mapping => ({
    serviceId: mapping.serviceId,
    locations: {
      states: mapping.locations.filter(loc => loc.type === 'state'),
      cities: mapping.locations.filter(loc => loc.type === 'city'),
      counties: mapping.locations.filter(loc => loc.type === 'county'),
      zipCodes: mapping.locations.filter(loc => loc.type === 'zipcode'),
    }
  }));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input data
    const validationResult = contractorSignupSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const {
      contactName,
      contactEmail,
      contactPhone,
      companyName,
      businessEmail,
      businessPhone,
      additionalContacts,
      selectedServices,
      serviceLocationMappings,
      type
    } = validationResult.data;

    // Check if buyer with same email already exists
    const existingBuyer = await prisma.buyer.findFirst({
      where: {
        OR: [
          { contactEmail: contactEmail },
          { businessEmail: businessEmail },
          { name: companyName }
        ]
      }
    });

    if (existingBuyer) {
      return NextResponse.json(
        { error: 'A contractor with this email or company name already exists' },
        { status: 409 }
      );
    }

    // Fix #3: Validate at least one service is selected
    if (selectedServices.length === 0) {
      return NextResponse.json(
        { error: 'At least one service must be selected' },
        { status: 400 }
      );
    }

    // Validate that selected service IDs exist in the database
    const serviceIds = selectedServices.map(s => s.id);
    const selectedServiceIdSet = new Set(serviceIds);

    // Fix #4: Validate at least one location mapping exists
    if (serviceLocationMappings.length === 0) {
      return NextResponse.json(
        { error: 'At least one service must have location coverage configured' },
        { status: 400 }
      );
    }

    // Validate that serviceLocationMappings reference only selected services
    const locationServiceIds = serviceLocationMappings.map(m => m.serviceId);
    const invalidLocationServiceIds = locationServiceIds.filter(
      id => !selectedServiceIdSet.has(id)
    );
    if (invalidLocationServiceIds.length > 0) {
      return NextResponse.json(
        { error: `Service location mappings reference unselected services: ${invalidLocationServiceIds.join(', ')}` },
        { status: 400 }
      );
    }

    // Fix #5: Validate ALL selected services have location mappings
    const servicesWithLocations = new Set(locationServiceIds);
    const servicesWithoutLocations = serviceIds.filter(
      id => !servicesWithLocations.has(id)
    );
    if (servicesWithoutLocations.length > 0) {
      // Get service names for better error message
      const missingServices = selectedServices
        .filter(s => servicesWithoutLocations.includes(s.id))
        .map(s => s.displayName || s.name);
      return NextResponse.json(
        { error: `All selected services must have location coverage. Missing locations for: ${missingServices.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate each mapping has at least one location
    const emptyLocationMappings = serviceLocationMappings.filter(
      m => m.locations.length === 0
    );
    if (emptyLocationMappings.length > 0) {
      return NextResponse.json(
        { error: 'Each service must have at least one location configured' },
        { status: 400 }
      );
    }

    // Fix #1: Transform flat location array to grouped structure
    const groupedMappings = transformLocationsToGrouped(serviceLocationMappings);

    // Expand service location mappings to ZIP codes
    const expandedMappings = groupedMappings.length > 0
      ? expandServiceLocationsToZipCodes(groupedMappings)
      : [];

    if (serviceIds.length > 0) {
      const existingServices = await prisma.serviceType.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true }
      });
      const existingServiceIds = new Set(existingServices.map(s => s.id));
      const invalidServices = serviceIds.filter((id: string) => !existingServiceIds.has(id));
      if (invalidServices.length > 0) {
        return NextResponse.json(
          { error: `Invalid service type IDs: ${invalidServices.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Create buyer, service configs, and service zones in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the new contractor buyer
      const newBuyer = await tx.buyer.create({
        data: {
          name: companyName,
          type: type,
          apiUrl: '', // Contractors don't need API URLs
          contactName,
          contactEmail,
          contactPhone,
          businessEmail,
          businessPhone,
          additionalContacts: additionalContacts && additionalContacts.length > 0
            ? JSON.stringify(additionalContacts)
            : null,
          authConfig: JSON.stringify({ setupComplete: true }),
          pingTimeout: 30,
          postTimeout: 60,
          active: false // Inactive until admin approval
        }
      });

      // 2. Create BuyerServiceConfig for each selected service
      if (selectedServices.length > 0) {
        for (const service of selectedServices) {
          await tx.buyerServiceConfig.create({
            data: {
              buyerId: newBuyer.id,
              serviceTypeId: service.id,
              pingTemplate: JSON.stringify({}),
              postTemplate: JSON.stringify({}),
              fieldMappings: JSON.stringify([]),
              requiresTrustedForm: false,
              requiresJornaya: false,
              minBid: 10.00,
              maxBid: 100.00,
              active: true,
            }
          });
        }
      }

      // 3. Create BuyerServiceZipCode records for service zones
      let zipCodesCreated = 0;
      if (expandedMappings.length > 0) {
        const zipCodeRecords = expandedMappings.flatMap(mapping =>
          mapping.zipCodes.map(zipCode => ({
            buyerId: newBuyer.id,
            serviceTypeId: mapping.serviceId,
            zipCode: zipCode,
            active: true, // Zone is active, but buyer is inactive
            priority: 100,
            maxLeadsPerDay: null,
            minBid: 10.00,
            maxBid: 100.00,
          }))
        );

        if (zipCodeRecords.length > 0) {
          await tx.buyerServiceZipCode.createMany({
            data: zipCodeRecords,
            skipDuplicates: true,
          });
          zipCodesCreated = zipCodeRecords.length;
        }
      }

      return {
        buyer: newBuyer,
        servicesConfigured: selectedServices.length,
        zipCodesCreated,
      };
    }, {
      maxWait: 10000, // 10 seconds max wait for transaction
      timeout: 30000, // 30 seconds timeout for large ZIP code sets
    });

    // Log the contractor signup for admin review
    console.log(`New contractor signup: ${companyName} (${contactEmail}, ${businessEmail}) - ${result.servicesConfigured} services, ${result.zipCodesCreated} ZIP codes`);

    // TODO: Send notification email to admin
    // TODO: Send welcome email to contractor

    return NextResponse.json({
      message: 'Contractor registration successful',
      buyerId: result.buyer.id,
      status: 'pending_review',
      servicesConfigured: result.servicesConfigured,
      zipCodesCreated: result.zipCodesCreated,
    }, { status: 201 });

  } catch (error) {
    console.error('Contractor signup error:', error);
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in auth configuration' },
        { status: 400 }
      );
    }

    // Handle database errors
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A contractor with this information already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve contractor signup statistics (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, approved, all
    
    // TODO: Add admin authentication check here
    
    const whereClause: any = {
      type: BuyerType.CONTRACTOR
    };

    if (status === 'pending') {
      whereClause.active = false;
    } else if (status === 'approved') {
      whereClause.active = true;
    }

    const contractors = await prisma.buyer.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        type: true,
        active: true,
        createdAt: true,
        authConfig: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Parse auth config to extract contact information
    const contractorsWithContactInfo = contractors.map(contractor => {
      let contactInfo = {};
      try {
        contactInfo = JSON.parse(contractor.authConfig || '{}');
      } catch (e) {
        // Handle invalid JSON gracefully
      }
      
      return {
        ...contractor,
        contactInfo
      };
    });

    return NextResponse.json({
      contractors: contractorsWithContactInfo,
      count: contractors.length,
      pendingCount: contractors.filter(c => !c.active).length,
      approvedCount: contractors.filter(c => c.active).length
    });

  } catch (error) {
    console.error('Error fetching contractor signups:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve contractor signups' },
      { status: 500 }
    );
  }
}