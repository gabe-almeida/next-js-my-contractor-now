import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BuyerType } from '@/types/database';
import { z } from 'zod';

// Additional contact validation schema
const additionalContactSchema = z.object({
  name: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 characters'),
  role: z.string().min(1, 'Contact role is required')
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
  selectedServices: z.array(z.any()).optional().default([]),
  serviceLocationMappings: z.array(z.any()).optional().default([]),
  type: z.nativeEnum(BuyerType).default(BuyerType.CONTRACTOR)
});

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

    // Create the new contractor buyer
    const newBuyer = await prisma.buyer.create({
      data: {
        name: companyName, // Use company name as the buyer name
        type: type,
        apiUrl: `https://pending-setup.com/contractor/${companyName.toLowerCase().replace(/\s+/g, '-')}`,
        contactName,
        contactEmail,
        contactPhone,
        businessEmail,
        businessPhone,
        additionalContacts: additionalContacts && additionalContacts.length > 0 ? JSON.stringify(additionalContacts) : null,
        authConfig: JSON.stringify({
          selectedServices,
          serviceLocationMappings,
          setupComplete: false
        }),
        pingTimeout: 30,
        postTimeout: 60,
        active: false // Set to inactive until admin approval
      }
    });

    // Log the contractor signup for admin review
    console.log(`New contractor signup: ${companyName} (${contactEmail}, ${businessEmail})`);

    // TODO: Send notification email to admin
    // TODO: Send welcome email to contractor

    return NextResponse.json({
      message: 'Contractor registration successful',
      buyerId: newBuyer.id,
      status: 'pending_review'
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