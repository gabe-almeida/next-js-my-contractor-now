import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { RedisCache } from '@/config/redis';
import { logger } from '@/lib/logger';
import { successResponse, errorResponse } from '@/lib/utils';
import { Lead, LeadStatus } from '@/types';
import { LeadDisposition } from '@/types/database';
import { prisma } from '@/lib/prisma';

// Admin leads management endpoint
async function handleGetLeads(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;
  const url = new URL(req.url);

  // Parse query parameters
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100); // Max 100 per page
  const status = url.searchParams.get('status') as LeadStatus | null;
  const disposition = url.searchParams.get('disposition') as LeadDisposition | null;
  const serviceTypeId = url.searchParams.get('serviceTypeId');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const sortBy = url.searchParams.get('sortBy') || 'createdAt';
  const sortOrder = url.searchParams.get('sortOrder') || 'desc';

  try {
    // Build cache key based on filters
    const filters = {
      page,
      limit,
      status,
      disposition,
      serviceTypeId,
      startDate,
      endDate,
      sortBy,
      sortOrder
    };

    const cacheKey = `admin:leads:${Buffer.from(JSON.stringify(filters)).toString('base64')}`;

    // Try to get from cache first
    let result = await RedisCache.get(cacheKey);

    if (!result) {
      // Build where clause for Prisma
      const where: any = {};

      if (status) {
        where.status = status.toUpperCase();
      }

      if (disposition) {
        where.disposition = disposition.toUpperCase();
      }

      if (serviceTypeId) {
        where.serviceTypeId = serviceTypeId;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      // Build orderBy clause
      const orderBy: any = {};
      switch (sortBy) {
        case 'status':
          orderBy.status = sortOrder;
          break;
        case 'zipCode':
          orderBy.zipCode = sortOrder;
          break;
        case 'createdAt':
        default:
          orderBy.createdAt = sortOrder;
      }

      // Query database
      const [leads, totalCount] = await Promise.all([
        prisma.lead.findMany({
          where,
          include: {
            serviceType: {
              select: {
                id: true,
                name: true,
                displayName: true
              }
            },
            winningBuyer: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy,
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.lead.count({ where })
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      // Prepare response with metadata
      result = {
        leads: leads.map(lead => {
          // Parse form data JSON
          let parsedFormData: any = {};
          try {
            parsedFormData = JSON.parse(lead.formData);
          } catch (e) {
            logger.warn('Failed to parse lead formData', { leadId: lead.id });
          }

          return {
            id: lead.id,
            serviceTypeId: lead.serviceTypeId,
            serviceType: lead.serviceType,
            status: lead.status,
            disposition: lead.disposition,
            formData: {
              // Include only non-sensitive form data
              firstName: parsedFormData.firstName,
              lastName: parsedFormData.lastName,
              zipCode: lead.zipCode,
              email: parsedFormData.email ? maskEmail(parsedFormData.email) : undefined,
              phone: parsedFormData.phone ? maskPhone(parsedFormData.phone) : undefined,
              projectScope: parsedFormData.projectScope,
              timeframe: lead.timeframe,
              budget: parsedFormData.budget,
              ownsHome: lead.ownsHome
            },
            winningBuyer: lead.winningBuyer,
            winningBid: lead.winningBid,
            creditAmount: lead.creditAmount,
            creditIssuedAt: lead.creditIssuedAt,
            leadQualityScore: lead.leadQualityScore,
            createdAt: lead.createdAt,
            updatedAt: lead.updatedAt
          };
        }),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        filters: {
          status,
          disposition,
          serviceTypeId,
          startDate,
          endDate
        },
        sort: {
          sortBy,
          sortOrder
        }
      };

      // Cache for 5 minutes
      await RedisCache.set(cacheKey, result, 300);
    }

    const response = successResponse(result, requestId);
    return NextResponse.json(response);

  } catch (error) {
    logger.error('Admin leads fetch error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId,
      filters: { page, limit, status, serviceTypeId }
    });

    const response = errorResponse(
      'FETCH_ERROR',
      'Failed to fetch leads',
      undefined,
      undefined,
      requestId
    );

    return NextResponse.json(response, { status: 500 });
  }
}

// Helper functions to mask sensitive data
function maskEmail(email: string): string {
  const [username, domain] = email.split('@');
  if (username.length <= 2) return email;
  
  const maskedUsername = username[0] + '*'.repeat(username.length - 2) + username[username.length - 1];
  return `${maskedUsername}@${domain}`;
}

function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ***-${cleaned.slice(6)}`;
  }
  return phone;
}

// Lead analytics endpoint
async function handleGetLeadAnalytics(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;
  const url = new URL(req.url);
  const period = url.searchParams.get('period') || '7d'; // 24h, 7d, 30d

  try {
    const cacheKey = `admin:analytics:leads:${period}`;
    let analytics = await RedisCache.get(cacheKey);

    if (!analytics) {
      // Calculate date range
      const now = new Date();
      let days: number;

      switch (period) {
        case '24h':
          days = 1;
          break;
        case '7d':
          days = 7;
          break;
        case '30d':
          days = 30;
          break;
        default:
          days = 7;
      }

      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);

      // Query analytics from database
      const [totalLeads, statusCounts, serviceTypeCounts, transactions] = await Promise.all([
        // Total leads in period
        prisma.lead.count({
          where: {
            createdAt: {
              gte: startDate
            }
          }
        }),
        // Count by status
        prisma.lead.groupBy({
          by: ['status'],
          where: {
            createdAt: {
              gte: startDate
            }
          },
          _count: true
        }),
        // Count by service type
        prisma.lead.groupBy({
          by: ['serviceTypeId'],
          where: {
            createdAt: {
              gte: startDate
            }
          },
          _count: true,
          _avg: {
            winningBid: true
          }
        }),
        // Revenue from transactions
        prisma.transaction.groupBy({
          by: ['status'],
          where: {
            createdAt: {
              gte: startDate
            },
            status: 'SUCCESS'
          },
          _sum: {
            bidAmount: true
          }
        })
      ]);

      // Calculate summary
      const totalRevenue = transactions.reduce((sum, t) => sum + Number(t._sum.bidAmount ?? 0), 0);
      const soldLeads = statusCounts.find(s => s.status === 'SOLD')?._count || 0;
      const conversionRate = totalLeads > 0 ? (soldLeads / totalLeads) : 0;
      const averageValue = soldLeads > 0 ? totalRevenue / soldLeads : 0;

      // Build byStatus object
      const byStatus: any = {
        pending: 0,
        processing: 0,
        auctioned: 0,
        sold: 0,
        rejected: 0,
        expired: 0
      };
      statusCounts.forEach(s => {
        const statusKey = s.status.toLowerCase();
        byStatus[statusKey] = s._count;
      });

      // Get service type names
      const serviceTypes = await prisma.serviceType.findMany({
        where: {
          id: {
            in: serviceTypeCounts.map(s => s.serviceTypeId)
          }
        }
      });

      const byServiceType: any = {};
      serviceTypeCounts.forEach(s => {
        const serviceType = serviceTypes.find(st => st.id === s.serviceTypeId);
        if (serviceType) {
          byServiceType[serviceType.name] = s._count;
        }
      });

      // Build timeline data (aggregated by day)
      const timeline = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const [dayLeads, dayRevenue] = await Promise.all([
          prisma.lead.count({
            where: {
              createdAt: {
                gte: date,
                lt: nextDate
              }
            }
          }),
          prisma.transaction.aggregate({
            where: {
              createdAt: {
                gte: date,
                lt: nextDate
              },
              status: 'SUCCESS'
            },
            _sum: {
              bidAmount: true
            }
          })
        ]);

        timeline.push({
          date: date.toISOString().split('T')[0],
          leads: dayLeads,
          revenue: dayRevenue._sum.bidAmount || 0
        });
      }

      analytics = {
        summary: {
          totalLeads,
          averageValue: Math.round(averageValue * 100) / 100,
          conversionRate: (conversionRate * 100).toFixed(2) + '%',
          totalRevenue: Math.round(totalRevenue * 100) / 100
        },
        byStatus,
        byServiceType,
        timeline,
        period
      };

      // Cache analytics for 1 hour
      await RedisCache.set(cacheKey, analytics, 3600);
    }

    const response = successResponse(analytics, requestId);
    return NextResponse.json(response);

  } catch (error) {
    logger.error('Lead analytics error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId,
      period
    });

    const response = errorResponse(
      'ANALYTICS_ERROR',
      'Failed to fetch lead analytics',
      undefined,
      undefined,
      requestId
    );

    return NextResponse.json(response, { status: 500 });
  }
}

// Export GET handler with admin authentication
export const GET = withMiddleware(
  async (req: EnhancedRequest) => {
    const url = new URL(req.url);
    const analytics = url.searchParams.get('analytics') === 'true';
    
    if (analytics) {
      return handleGetLeadAnalytics(req);
    } else {
      return handleGetLeads(req);
    }
  },
  {
    rateLimiter: 'admin',
    enableLogging: true,
    requireAuth: true,
    enableCors: true
  }
);