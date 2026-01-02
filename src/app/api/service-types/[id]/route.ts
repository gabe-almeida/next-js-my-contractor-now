import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { RedisCache } from '@/config/redis';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { ServiceType, FormFieldOption } from '@/types';

// Helper to convert string array to FormFieldOption array
const toOptions = (strings: string[]): FormFieldOption[] =>
  strings.map(s => ({ value: s.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label: s }));

// Mock data - same as parent route for consistency
const defaultServiceTypes: ServiceType[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Windows',
    displayName: 'Window Services',
    description: 'Window replacement, repair, and installation services',
    formSchema: {
      title: 'Window Services Intake Form',
      fields: [
        {
          id: 'numberOfWindows',
          name: 'numberOfWindows',
          type: 'number',
          label: 'How many windows need work?',
          placeholder: 'Enter number of windows',
          required: true,
          validation: { min: 1, max: 50 }
        },
        {
          id: 'windowTypes',
          name: 'windowTypes',
          type: 'checkbox',
          label: 'What types of windows?',
          required: true,
          options: toOptions(['Single-hung', 'Double-hung', 'Casement', 'Sliding', 'Bay', 'Bow'])
        },
        {
          id: 'projectScope',
          name: 'projectScope',
          type: 'radio',
          label: 'What type of project is this?',
          required: true,
          options: toOptions(['Replacement', 'New Installation', 'Repair'])
        },
        {
          id: 'currentWindowAge',
          name: 'currentWindowAge',
          type: 'select',
          label: 'How old are your current windows?',
          required: false,
          options: toOptions(['0-5 years', '5-10 years', '10-20 years', '20+ years'])
        },
        {
          id: 'budget',
          name: 'budget',
          type: 'select',
          label: 'What is your estimated budget?',
          required: false,
          options: toOptions(['Under $5,000', '$5,000-$15,000', '$15,000-$30,000', '$30,000+'])
        }
      ],
      validationRules: [
        {
          field: 'numberOfWindows',
          rule: 'required|integer|min:1|max:50',
          message: 'Number of windows must be between 1 and 50'
        },
        {
          field: 'windowTypes',
          rule: 'required|array|min:1',
          message: 'At least one window type must be selected'
        }
      ]
    },
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Bathrooms',
    displayName: 'Bathroom Services',
    description: 'Bathroom remodeling, renovation, and fixture installation',
    formSchema: {
      title: 'Bathroom Services Intake Form',
      fields: [
        {
          id: 'numberOfBathrooms',
          name: 'numberOfBathrooms',
          type: 'number',
          label: 'How many bathrooms need work?',
          placeholder: 'Enter number of bathrooms',
          required: true,
          validation: { min: 1, max: 10 }
        },
        {
          id: 'bathroomType',
          name: 'bathroomType',
          type: 'select',
          label: 'What type of bathroom?',
          required: true,
          options: toOptions(['Full bathroom', 'Half bathroom', 'Master bathroom', 'Guest bathroom'])
        },
        {
          id: 'projectScope',
          name: 'projectScope',
          type: 'radio',
          label: 'What type of project is this?',
          required: true,
          options: toOptions(['Full remodel', 'Partial remodel', 'Fixtures only', 'Vanity only'])
        },
        {
          id: 'fixturesNeeded',
          name: 'fixturesNeeded',
          type: 'checkbox',
          label: 'Which fixtures need work?',
          required: true,
          options: toOptions(['Toilet', 'Sink', 'Shower', 'Bathtub', 'Vanity', 'Tiles', 'Lighting'])
        },
        {
          id: 'currentCondition',
          name: 'currentCondition',
          type: 'select',
          label: 'Current condition of the bathroom?',
          required: false,
          options: toOptions(['Excellent', 'Good', 'Fair', 'Poor'])
        },
        {
          id: 'budget',
          name: 'budget',
          type: 'select',
          label: 'What is your estimated budget?',
          required: false,
          options: toOptions(['Under $10,000', '$10,000-$25,000', '$25,000-$50,000', '$50,000+'])
        }
      ],
      validationRules: [
        {
          field: 'numberOfBathrooms',
          rule: 'required|integer|min:1|max:10',
          message: 'Number of bathrooms must be between 1 and 10'
        },
        {
          field: 'fixturesNeeded',
          rule: 'required|array|min:1',
          message: 'At least one fixture must be selected'
        }
      ]
    },
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'Roofing',
    displayName: 'Roofing Services',
    description: 'Roof replacement, repair, and installation services',
    formSchema: {
      title: 'Roofing Services Intake Form',
      fields: [
        {
          id: 'squareFootage',
          name: 'squareFootage',
          type: 'number',
          label: 'What is the square footage of your roof?',
          placeholder: 'Enter square footage',
          required: true,
          validation: { min: 500, max: 10000 }
        },
        {
          id: 'roofType',
          name: 'roofType',
          type: 'select',
          label: 'What type of roof do you have?',
          required: true,
          options: toOptions(['Asphalt Shingles', 'Metal', 'Tile', 'Slate', 'Wood', 'Flat'])
        },
        {
          id: 'projectType',
          name: 'projectType',
          type: 'radio',
          label: 'What type of project is this?',
          required: true,
          options: toOptions(['Replacement', 'Repair', 'New Installation'])
        },
        {
          id: 'hasLeaks',
          name: 'hasLeaks',
          type: 'radio',
          label: 'Does your roof currently have leaks?',
          required: true,
          options: toOptions(['Yes', 'No', 'Not sure'])
        },
        {
          id: 'hasMissingShingles',
          name: 'hasMissingShingles',
          type: 'radio',
          label: 'Are there missing or damaged shingles?',
          required: true,
          options: toOptions(['Yes', 'No', 'Not sure'])
        },
        {
          id: 'ageOfRoof',
          name: 'ageOfRoof',
          type: 'select',
          label: 'How old is your current roof?',
          required: true,
          options: toOptions(['0-5 years', '5-10 years', '10-20 years', '20+ years'])
        },
        {
          id: 'urgency',
          name: 'urgency',
          type: 'select',
          label: 'How urgent is this project?',
          required: false,
          options: toOptions(['Emergency', 'Urgent', 'Planned'])
        },
        {
          id: 'budget',
          name: 'budget',
          type: 'select',
          label: 'What is your estimated budget?',
          required: false,
          options: toOptions(['Under $15,000', '$15,000-$30,000', '$30,000-$60,000', '$60,000+'])
        }
      ],
      validationRules: [
        {
          field: 'squareFootage',
          rule: 'required|integer|min:500|max:10000',
          message: 'Square footage must be between 500 and 10,000'
        },
        {
          field: 'roofType',
          rule: 'required',
          message: 'Roof type is required'
        }
      ]
    },
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Get specific service type with full form schema
async function handleGetServiceType(
  req: EnhancedRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { requestId } = req.context;
  const { id } = params;
  
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      const response = errorResponse(
        'INVALID_ID',
        'Invalid service type ID format',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 400 });
    }
    
    // Try to get from cache first
    const cacheKey = `service-type:${id}`;
    let serviceType = await RedisCache.get<ServiceType>(cacheKey);
    
    if (!serviceType) {
      // Find in default data
      serviceType = defaultServiceTypes.find(st => st.id === id) ?? null;
      
      if (!serviceType) {
        const response = errorResponse(
          'SERVICE_TYPE_NOT_FOUND',
          'Service type not found',
          { id },
          'id',
          requestId
        );
        return NextResponse.json(response, { status: 404 });
      }
      
      // Cache for 1 hour
      await RedisCache.set(cacheKey, serviceType, 3600);
    }
    
    // Check if service type is active
    if (!serviceType.active) {
      const response = errorResponse(
        'SERVICE_TYPE_INACTIVE',
        'Service type is not currently available',
        { id },
        'id',
        requestId
      );
      return NextResponse.json(response, { status: 403 });
    }
    
    // Add required base fields to form schema
    const baseFields = [
      {
        id: 'zipCode',
        name: 'zipCode',
        type: 'text' as const,
        label: 'What is your ZIP code?',
        placeholder: 'Enter your ZIP code',
        required: true,
        validation: { pattern: '^\\d{5}(-\\d{4})?$', minLength: 5, maxLength: 10 }
      },
      {
        id: 'homeOwnership',
        name: 'homeOwnership',
        type: 'radio' as const,
        label: 'Do you own or rent your home?',
        required: true,
        options: toOptions(['Own', 'Rent'])
      },
      {
        id: 'timeframe',
        name: 'timeframe',
        type: 'select' as const,
        label: 'When do you want to start this project?',
        required: true,
        options: toOptions(['Immediately', 'Within 1-3 months', 'Within 3-6 months', '6+ months'])
      },
      {
        id: 'firstName',
        name: 'firstName',
        type: 'text' as const,
        label: 'First Name',
        placeholder: 'Enter your first name',
        required: true,
        validation: { minLength: 2, maxLength: 50 }
      },
      {
        id: 'lastName',
        name: 'lastName',
        type: 'text' as const,
        label: 'Last Name',
        placeholder: 'Enter your last name',
        required: true,
        validation: { minLength: 2, maxLength: 50 }
      },
      {
        id: 'email',
        name: 'email',
        type: 'email' as const,
        label: 'Email Address',
        placeholder: 'Enter your email address',
        required: true,
        validation: { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', maxLength: 255 }
      },
      {
        id: 'phone',
        name: 'phone',
        type: 'phone' as const,
        label: 'Phone Number',
        placeholder: 'Enter your phone number',
        required: true,
        validation: { minLength: 10, maxLength: 15 }
      }
    ];
    
    // Combine base fields with service-specific fields
    const completeFormSchema = {
      ...serviceType.formSchema,
      fields: [...baseFields, ...serviceType.formSchema.fields]
    };
    
    const response = successResponse({
      ...serviceType,
      formSchema: completeFormSchema
    }, requestId);
    
    return NextResponse.json(response);
    
  } catch (error) {
    logger.error('Service type fetch error', {
      error: (error as Error).message,
      requestId,
      serviceTypeId: id
    });
    
    const response = errorResponse(
      'FETCH_ERROR',
      'Failed to fetch service type',
      undefined,
      undefined,
      requestId
    );
    
    return NextResponse.json(response, { status: 500 });
  }
}

// Export GET handler with middleware
export const GET = withMiddleware(
  handleGetServiceType,
  {
    rateLimiter: 'serviceTypes',
    enableLogging: true,
    enableCors: true
  }
);