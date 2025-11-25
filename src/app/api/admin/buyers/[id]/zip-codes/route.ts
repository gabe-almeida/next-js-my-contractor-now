import { NextResponse, NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Validation schemas
const addZipCodeSchema = z.object({
  serviceTypeId: z.string().uuid('Invalid service type ID'),
  zipCodes: z.array(z.string().regex(/^\d{5}$/, 'Invalid zip code format')).min(1, 'At least one zip code is required'),
  priority: z.number().int().min(1).max(100).default(100),
  maxLeadsPerDay: z.number().int().min(1).nullable().optional(),
  minBid: z.number().min(0).nullable().optional(),
  maxBid: z.number().min(0).nullable().optional(),
})

const updateZipCodeSchema = z.object({
  active: z.boolean().optional(),
  priority: z.number().int().min(1).max(100).optional(),
  maxLeadsPerDay: z.number().int().min(1).nullable().optional(),
  minBid: z.number().min(0).nullable().optional(),
  maxBid: z.number().min(0).nullable().optional(),
})

const bulkUpdateSchema = z.object({
  zipCodeIds: z.array(z.string().uuid()),
  updates: updateZipCodeSchema,
})

// Helper function to handle Prisma errors
function handlePrismaError(error: any) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return NextResponse.json(
          {
            success: false,
            error: 'Duplicate entry',
            message: 'This ZIP code already exists for this buyer and service type'
          },
          { status: 409 }
        )
      case 'P2025':
        return NextResponse.json(
          {
            success: false,
            error: 'Not found',
            message: 'The requested record was not found'
          },
          { status: 404 }
        )
      case 'P2003':
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid reference',
            message: 'Invalid buyer or service type ID'
          },
          { status: 400 }
        )
      default:
        console.error('Prisma error:', error)
        return NextResponse.json(
          {
            success: false,
            error: 'Database error',
            message: 'A database error occurred'
          },
          { status: 500 }
        )
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error('Database connection error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Database connection failed',
        message: 'Could not connect to the database. Please try again later.'
      },
      { status: 503 }
    )
  }

  // Generic error
  console.error('Unexpected error:', error)
  return NextResponse.json(
    {
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    },
    { status: 500 }
  )
}

// GET /api/admin/buyers/[id]/zip-codes - Get zip codes for a buyer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const buyerId = params.id
    const url = new URL(request.url)
    const serviceTypeId = url.searchParams.get('serviceTypeId')
    const includeInactive = url.searchParams.get('includeInactive') === 'true'

    // Validate buyer ID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buyerId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid buyer ID format' },
        { status: 400 }
      )
    }

    // Verify buyer exists
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId }
    })

    if (!buyer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Buyer not found',
          message: 'No buyer found with the provided ID'
        },
        { status: 404 }
      )
    }

    // Build query filters
    const whereClause: Prisma.BuyerServiceZipCodeWhereInput = {
      buyerId,
      ...(serviceTypeId && { serviceTypeId }),
      ...(includeInactive ? {} : { active: true })
    }

    // Fetch ZIP codes with relations
    const zipCodes = await prisma.buyerServiceZipCode.findMany({
      where: whereClause,
      include: {
        serviceType: {
          select: {
            id: true,
            name: true,
            displayName: true
          }
        }
      },
      orderBy: [
        { serviceTypeId: 'asc' },
        { priority: 'desc' },
        { zipCode: 'asc' }
      ]
    })

    // Group by service type
    const groupedData = zipCodes.reduce((acc, zip) => {
      const serviceId = zip.serviceTypeId

      if (!acc[serviceId]) {
        acc[serviceId] = {
          serviceTypeId: serviceId,
          serviceName: zip.serviceType.displayName,
          zipCodes: []
        }
      }

      acc[serviceId].zipCodes.push({
        id: zip.id,
        zipCode: zip.zipCode,
        active: zip.active,
        priority: zip.priority,
        maxLeadsPerDay: zip.maxLeadsPerDay,
        minBid: zip.minBid,
        maxBid: zip.maxBid,
        createdAt: zip.createdAt,
        updatedAt: zip.updatedAt,
      })

      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      success: true,
      data: Object.values(groupedData),
      meta: {
        totalZipCodes: zipCodes.length,
        activeZipCodes: zipCodes.filter(z => z.active).length,
        serviceTypes: Object.keys(groupedData).length
      }
    })

  } catch (error) {
    return handlePrismaError(error)
  }
}

// POST /api/admin/buyers/[id]/zip-codes - Add zip codes for a buyer service
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const buyerId = params.id
    const body = await request.json()

    // Validate input
    const validation = addZipCodeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const { serviceTypeId, zipCodes, priority, maxLeadsPerDay, minBid, maxBid } = validation.data

    // Verify buyer exists
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId }
    })

    if (!buyer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Buyer not found',
          message: 'No buyer found with the provided ID'
        },
        { status: 404 }
      )
    }

    // Verify service type exists
    const serviceType = await prisma.serviceType.findUnique({
      where: { id: serviceTypeId }
    })

    if (!serviceType) {
      return NextResponse.json(
        {
          success: false,
          error: 'Service type not found',
          message: 'No service type found with the provided ID'
        },
        { status: 404 }
      )
    }

    // Check for existing duplicates
    const existingZipCodes = await prisma.buyerServiceZipCode.findMany({
      where: {
        buyerId,
        serviceTypeId,
        zipCode: { in: zipCodes }
      },
      select: { zipCode: true }
    })

    if (existingZipCodes.length > 0) {
      const duplicates = existingZipCodes.map(z => z.zipCode)
      return NextResponse.json(
        {
          success: false,
          error: 'Duplicate zip codes found',
          message: `The following ZIP codes already exist for this buyer and service: ${duplicates.join(', ')}`,
          duplicates
        },
        { status: 409 }
      )
    }

    // Create new ZIP code mappings
    const newZipCodes = await prisma.buyerServiceZipCode.createMany({
      data: zipCodes.map(zipCode => ({
        buyerId,
        serviceTypeId,
        zipCode,
        active: true,
        priority: priority ?? 100,
        maxLeadsPerDay: maxLeadsPerDay ?? null,
        minBid: minBid ?? null,
        maxBid: maxBid ?? null,
      }))
    })

    // Fetch the created records to return them
    const createdRecords = await prisma.buyerServiceZipCode.findMany({
      where: {
        buyerId,
        serviceTypeId,
        zipCode: { in: zipCodes }
      },
      orderBy: { createdAt: 'desc' },
      take: zipCodes.length
    })

    return NextResponse.json({
      success: true,
      data: createdRecords.map(zip => ({
        id: zip.id,
        zipCode: zip.zipCode,
        active: zip.active,
        priority: zip.priority,
        maxLeadsPerDay: zip.maxLeadsPerDay,
        minBid: zip.minBid,
        maxBid: zip.maxBid,
        createdAt: zip.createdAt,
      })),
      message: `Successfully added ${newZipCodes.count} zip code(s)`
    }, { status: 201 })

  } catch (error) {
    return handlePrismaError(error)
  }
}

// PUT /api/admin/buyers/[id]/zip-codes - Bulk update zip codes
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const buyerId = params.id
    const body = await request.json()

    // Validate input
    const validation = bulkUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const { zipCodeIds, updates } = validation.data

    // Update ZIP codes (security: ensure they belong to this buyer)
    const result = await prisma.buyerServiceZipCode.updateMany({
      where: {
        id: { in: zipCodeIds },
        buyerId // Security check: only update this buyer's ZIP codes
      },
      data: updates
    })

    if (result.count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No records updated',
          message: 'No matching ZIP codes found for this buyer'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${result.count} zip code(s)`,
      updatedCount: result.count
    })

  } catch (error) {
    return handlePrismaError(error)
  }
}

// DELETE /api/admin/buyers/[id]/zip-codes - Remove zip codes
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const buyerId = params.id
    const url = new URL(request.url)
    const zipCodeIds = url.searchParams.get('ids')?.split(',') || []

    if (zipCodeIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No zip code IDs provided',
          message: 'Please provide at least one ZIP code ID to delete'
        },
        { status: 400 }
      )
    }

    // Delete ZIP codes (security: ensure they belong to this buyer)
    const result = await prisma.buyerServiceZipCode.deleteMany({
      where: {
        id: { in: zipCodeIds },
        buyerId // Security check: only delete this buyer's ZIP codes
      }
    })

    if (result.count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No records deleted',
          message: 'No matching ZIP codes found for this buyer'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${result.count} zip code(s)`,
      deletedCount: result.count
    })

  } catch (error) {
    return handlePrismaError(error)
  }
}
