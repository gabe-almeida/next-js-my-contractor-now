import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createServiceTypeSchema, updateServiceTypeSchema } from '@/lib/validations/lead';
import { handleApiError } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const serviceTypes = await prisma.serviceType.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: serviceTypes,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Get service types error:', error);
    const { message, statusCode } = handleApiError(error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve service types',
      message,
      timestamp: new Date().toISOString(),
    }, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the request body
    const validationResult = createServiceTypeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.errors,
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const { name, displayName, formSchema } = validationResult.data;

    // Check if service type with this name already exists
    const existingServiceType = await prisma.serviceType.findUnique({
      where: { name },
    });

    if (existingServiceType) {
      return NextResponse.json({
        success: false,
        error: 'Service type already exists',
        message: `A service type with the name "${name}" already exists`,
        timestamp: new Date().toISOString(),
      }, { status: 409 });
    }

    // Create the service type
    const serviceType = await prisma.serviceType.create({
      data: {
        name,
        displayName,
        formSchema,
        active: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: serviceType,
      message: 'Service type created successfully',
      timestamp: new Date().toISOString(),
    }, { status: 201 });

  } catch (error) {
    console.error('Create service type error:', error);
    const { message, statusCode } = handleApiError(error);
    
    return NextResponse.json({
      success: false,
      error: 'Service type creation failed',
      message,
      timestamp: new Date().toISOString(),
    }, { status: statusCode });
  }
}