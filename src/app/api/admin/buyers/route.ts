import { NextResponse } from 'next/server';
import { withMiddleware, withValidation, EnhancedRequest } from '@/lib/middleware';
import { buyerSchema } from '@/lib/validation';
import { RedisCache } from '@/config/redis';
import { logger } from '@/lib/logger';
import { generateId, successResponse, errorResponse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { generateWebhookSecret } from '@/lib/security/webhook-signatures';
import { encrypt, decrypt, isEncrypted } from '@/lib/security/encryption';

// Get all buyers
async function handleGetBuyers(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;
  const url = new URL(req.url);
  const includeInactive = url.searchParams.get('includeInactive') === 'true';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const search = url.searchParams.get('search') || '';
  const type = url.searchParams.get('type') || ''; // CONTRACTOR or NETWORK

  try {
    // Try to get from cache first
    const cacheKey = `admin:buyers:${includeInactive}:${page}:${limit}:${search}:${type}`;
    let cachedData = await RedisCache.get<any>(cacheKey);

    if (!cachedData) {
      // Build where clause
      const where: any = {
        ...(includeInactive ? {} : { active: true }),
        ...(search && {
          name: {
            contains: search
          }
        }),
        ...(type && { type })
      };

      // Fetch buyers with counts
      const [buyers, total] = await Promise.all([
        prisma.buyer.findMany({
          where,
          include: {
            _count: {
              select: {
                serviceConfigs: true,
                serviceZipCodes: true,
                wonLeads: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.buyer.count({ where })
      ]);

      cachedData = { buyers, total, page, limit };

      // Cache for 5 minutes
      await RedisCache.set(cacheKey, cachedData, 300);
    }

    const { buyers, total } = cachedData;

    // Remove sensitive auth information from response
    // Decrypt authConfig only to extract authType (don't expose full credentials)
    const safeBuyers = buyers.map((buyer: any) => {
      let authType = 'unknown';
      if (buyer.authConfig) {
        try {
          // Decrypt if encrypted
          const configStr = isEncrypted(buyer.authConfig)
            ? decrypt(buyer.authConfig)
            : buyer.authConfig;

          const authConfig = JSON.parse(configStr);
          authType = authConfig.type || 'unknown';
        } catch (error) {
          // If decryption fails, fall back to stored authType field
          authType = buyer.authType || 'unknown';
        }
      }

      return {
        id: buyer.id,
        name: buyer.name,
        displayName: buyer.displayName,
        type: buyer.type,
        apiUrl: buyer.apiUrl,
        authType,
        active: buyer.active,
        contactName: buyer.contactName,
        contactEmail: buyer.contactEmail,
        contactPhone: buyer.contactPhone,
        complianceFieldMappings: buyer.complianceFieldMappings ? JSON.parse(buyer.complianceFieldMappings) : null,
        responseMappingConfig: buyer.responseMappingConfig ? JSON.parse(buyer.responseMappingConfig) : null,
        serviceConfigCount: buyer._count.serviceConfigs,
        zipCodeCount: buyer._count.serviceZipCodes,
        leadsWon: buyer._count.wonLeads,
        createdAt: buyer.createdAt,
        updatedAt: buyer.updatedAt
      };
    });

    const response = successResponse(
      {
        buyers: safeBuyers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      },
      requestId
    );

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Buyers fetch error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId
    });

    const response = errorResponse(
      'FETCH_ERROR',
      'Failed to fetch buyers',
      undefined,
      undefined,
      requestId
    );

    return NextResponse.json(response, { status: 500 });
  }
}

// Create new buyer
async function handleCreateBuyer(
  req: EnhancedRequest,
  validatedData: {
    name: string;
    displayName?: string;
    apiUrl: string;
    authConfig: {
      type: 'apikey' | 'bearer' | 'basic';
      credentials: Record<string, string>;
    };
    active?: boolean;
    type?: 'CONTRACTOR' | 'NETWORK';
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    businessEmail?: string;
    businessPhone?: string;
    pingTimeout?: number;
    postTimeout?: number;
    complianceFieldMappings?: any;
    responseMappingConfig?: any;
  }
): Promise<NextResponse> {
  const { requestId } = req.context;

  try {
    // Check if buyer name already exists
    const existingBuyer = await prisma.buyer.findFirst({
      where: {
        name: validatedData.name
      }
    });

    if (existingBuyer) {
      const response = errorResponse(
        'BUYER_NAME_EXISTS',
        'Buyer with this name already exists',
        { name: validatedData.name },
        'name',
        requestId
      );
      return NextResponse.json(response, { status: 409 });
    }

    // Validate API URL accessibility (basic check)
    try {
      const urlCheck = new URL(validatedData.apiUrl);
      if (!['http:', 'https:'].includes(urlCheck.protocol)) {
        const response = errorResponse(
          'INVALID_API_URL',
          'API URL must use HTTP or HTTPS protocol',
          { apiUrl: validatedData.apiUrl },
          'apiUrl',
          requestId
        );
        return NextResponse.json(response, { status: 400 });
      }
    } catch {
      const response = errorResponse(
        'INVALID_API_URL',
        'Invalid API URL format',
        { apiUrl: validatedData.apiUrl },
        'apiUrl',
        requestId
      );
      return NextResponse.json(response, { status: 400 });
    }

    // Generate webhook secret for secure webhook authentication
    const webhookSecret = generateWebhookSecret();

    // Encrypt sensitive credentials before storing
    const encryptedAuthConfig = encrypt(JSON.stringify(validatedData.authConfig));
    const encryptedWebhookSecret = encrypt(webhookSecret);

    // Create new buyer
    const newBuyer = await prisma.buyer.create({
      data: {
        name: validatedData.name,
        displayName: validatedData.displayName,
        type: validatedData.type || 'CONTRACTOR',
        apiUrl: validatedData.apiUrl,
        authConfig: encryptedAuthConfig, // Encrypted credentials
        webhookSecret: encryptedWebhookSecret, // Encrypted webhook secret
        authType: validatedData.authConfig.type, // Store auth type for quick reference
        active: validatedData.active !== false,
        contactName: validatedData.contactName,
        contactEmail: validatedData.contactEmail,
        contactPhone: validatedData.contactPhone,
        businessEmail: validatedData.businessEmail,
        businessPhone: validatedData.businessPhone,
        pingTimeout: validatedData.pingTimeout || 30,
        postTimeout: validatedData.postTimeout || 60,
        complianceFieldMappings: validatedData.complianceFieldMappings
          ? JSON.stringify(validatedData.complianceFieldMappings)
          : null,
        responseMappingConfig: validatedData.responseMappingConfig
          ? JSON.stringify(validatedData.responseMappingConfig)
          : null
      },
      include: {
        _count: {
          select: {
            serviceConfigs: true,
            serviceZipCodes: true,
            wonLeads: true
          }
        }
      }
    });

    // Clear caches
    await RedisCache.deletePattern('admin:buyers:*');

    logger.info('Buyer created', {
      buyerId: newBuyer.id,
      buyerName: newBuyer.name,
      requestId
    });

    // Return safe buyer data (without sensitive auth info)
    // IMPORTANT: webhookSecret is included ONLY on creation so admin can provide it to buyer
    // Return the plaintext webhook secret (not encrypted) so buyer can use it
    const safeBuyer = {
      id: newBuyer.id,
      name: newBuyer.name,
      displayName: newBuyer.displayName,
      type: newBuyer.type,
      apiUrl: newBuyer.apiUrl,
      authType: validatedData.authConfig.type,
      webhookSecret: webhookSecret, // Plaintext secret (only included on creation)
      active: newBuyer.active,
      contactName: newBuyer.contactName,
      contactEmail: newBuyer.contactEmail,
      complianceFieldMappings: newBuyer.complianceFieldMappings ? JSON.parse(newBuyer.complianceFieldMappings) : null,
      responseMappingConfig: newBuyer.responseMappingConfig ? JSON.parse(newBuyer.responseMappingConfig) : null,
      serviceConfigCount: newBuyer._count.serviceConfigs,
      zipCodeCount: newBuyer._count.serviceZipCodes,
      leadsWon: newBuyer._count.wonLeads,
      createdAt: newBuyer.createdAt,
      updatedAt: newBuyer.updatedAt
    };

    const response = successResponse(safeBuyer, requestId);
    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    logger.error('Buyer creation error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId,
      buyerName: validatedData.name
    });

    const response = errorResponse(
      'CREATION_ERROR',
      'Failed to create buyer',
      undefined,
      undefined,
      requestId
    );

    return NextResponse.json(response, { status: 500 });
  }
}

// Export route handlers with admin authentication
export const GET = withMiddleware(
  handleGetBuyers,
  {
    rateLimiter: 'admin',
    enableLogging: true,
    requireAuth: true,
    enableCors: true
  }
);

export const POST = withMiddleware(
  withValidation(
    (data) => buyerSchema.safeParse(data),
    handleCreateBuyer
  ),
  {
    rateLimiter: 'admin',
    enableLogging: true,
    requireAuth: true,
    validateContentType: true,
    enableCors: true
  }
);
