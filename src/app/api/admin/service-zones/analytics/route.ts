import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { logger } from '@/lib/logger';
import { RedisCache } from '@/config/redis';
import { successResponse, errorResponse } from '@/lib/utils';
import { ServiceZoneRepository } from '@/lib/repositories/service-zone-repository';
import { BuyerEligibilityService } from '@/lib/services/buyer-eligibility-service';
import { z } from 'zod';

// Validation schema for analytics queries
const analyticsQuerySchema = z.object({
  buyerId: z.string().uuid().optional(),
  serviceTypeId: z.string().uuid().optional(),
  state: z.string().length(2).optional(),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
  timeframe: z.enum(['24h', '7d', '30d', '90d']).optional().default('30d')
});

// Get service zone analytics
async function handleGetServiceZoneAnalytics(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;
  const url = new URL(req.url);
  
  try {
    // Parse and validate query parameters
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validatedParams = analyticsQuerySchema.parse(queryParams);
    
    // Create cache key
    const cacheKey = `service-zones:analytics:${JSON.stringify(validatedParams)}`;
    let analyticsData = await RedisCache.get<any>(cacheKey);
    
    if (!analyticsData) {
      // Get coverage statistics
      const coverageStats = await ServiceZoneRepository.getServiceCoverageStats(
        validatedParams.buyerId,
        validatedParams.serviceTypeId
      );

      // Get service zones for detailed analysis
      const serviceZones = await ServiceZoneRepository.findMany({
        buyerId: validatedParams.buyerId,
        serviceTypeId: validatedParams.serviceTypeId,
        state: validatedParams.state,
        includeRelations: true
      });

      // Calculate geographic distribution
      const stateDistribution: Record<string, number> = {};
      const zipCodeMetadata = await Promise.all(
        serviceZones.slice(0, 100).map(async (zone) => {
          const metadata = await ServiceZoneRepository.getZipCodeMetadata(zone.zipCode);
          if (metadata?.state) {
            stateDistribution[metadata.state] = (stateDistribution[metadata.state] || 0) + 1;
          }
          return { zipCode: zone.zipCode, metadata };
        })
      );

      // Calculate priority distribution
      const priorityDistribution = serviceZones.reduce((acc, zone) => {
        const range = getPriorityRange(zone.priority);
        acc[range] = (acc[range] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate bid range distribution
      const bidRangeDistribution = serviceZones.reduce((acc, zone) => {
        if (zone.maxBid) {
          const range = getBidRange(zone.maxBid);
          acc[range] = (acc[range] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Get top performing zip codes (mock data for now)
      const topZipCodes = serviceZones
        .filter(zone => zone.active)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 10)
        .map(zone => ({
          zipCode: zone.zipCode,
          priority: zone.priority,
          maxBid: zone.maxBid,
          maxLeadsPerDay: zone.maxLeadsPerDay,
          buyerName: zone.buyer?.name || 'Unknown',
          serviceTypeName: zone.serviceType?.displayName || 'Unknown'
        }));

      // Calculate coverage gaps (mock analysis)
      const coverageGaps = await analyzeCoverageGaps(validatedParams);

      // Compile analytics data
      analyticsData = {
        summary: {
          ...coverageStats,
          totalZipCodes: serviceZones.length,
          uniqueStates: Object.keys(stateDistribution).length,
          averagePriorityScore: coverageStats.averagePriority
        },
        distributions: {
          states: stateDistribution,
          priorities: priorityDistribution,
          bidRanges: bidRangeDistribution
        },
        performance: {
          topZipCodes,
          coverageGaps
        },
        trends: {
          // Mock trend data - in real implementation, this would come from historical data
          dailyLeadVolume: generateMockTrendData(validatedParams.timeframe),
          participationRates: generateMockParticipationData(validatedParams.timeframe)
        }
      };

      // Cache for 1 hour
      await RedisCache.set(cacheKey, analyticsData, 3600);
    }
    
    const response = successResponse(analyticsData, requestId);
    return NextResponse.json(response);
    
  } catch (error) {
    logger.error('Service zone analytics error', {
      error: (error as Error).message,
      requestId
    });
    
    const response = errorResponse(
      'ANALYTICS_ERROR',
      'Failed to fetch service zone analytics',
      undefined,
      undefined,
      requestId
    );
    
    return NextResponse.json(response, { status: 500 });
  }

}

// Helper functions
function getPriorityRange(priority: number): string {
  if (priority <= 25) return '1-25';
  if (priority <= 50) return '26-50';
  if (priority <= 75) return '51-75';
  return '76-100';
}

function getBidRange(bid: number): string {
  if (bid <= 25) return '$0-25';
  if (bid <= 50) return '$26-50';
  if (bid <= 100) return '$51-100';
  if (bid <= 200) return '$101-200';
  return '$200+';
}

async function analyzeCoverageGaps(params: any): Promise<any[]> {
  // Mock coverage gap analysis
  // In real implementation, this would analyze market demand vs coverage
  return [
    {
      state: 'CA',
      zipCode: '90210',
      demandScore: 85,
      coverageScore: 20,
      gap: 65,
      potentialRevenue: 15000
    },
    {
      state: 'TX',
      zipCode: '75201',
      demandScore: 78,
      coverageScore: 30,
      gap: 48,
      potentialRevenue: 12000
    }
  ];
}

function generateMockTrendData(timeframe: string): any[] {
  const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
  const data = [];
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      leads: Math.floor(Math.random() * 100) + 50,
      revenue: Math.floor(Math.random() * 5000) + 2000
    });
  }
  
  return data;
}

function generateMockParticipationData(timeframe: string): any[] {
  return [
    { buyerName: 'HomeAdvisor', participationRate: 0.85, avgBid: 45.50 },
    { buyerName: 'Modernize', participationRate: 0.78, avgBid: 52.30 },
    { buyerName: 'Angi', participationRate: 0.65, avgBid: 38.75 }
  ];
}

// Get service availability for a specific location
async function handleGetServiceAvailability(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;
  const url = new URL(req.url);
  
  try {
    const zipCode = url.searchParams.get('zipCode');
    const serviceTypeId = url.searchParams.get('serviceTypeId');
    
    if (!zipCode) {
      const response = errorResponse(
        'MISSING_ZIP_CODE',
        'ZIP code is required',
        undefined,
        'zipCode',
        requestId
      );
      return NextResponse.json(response, { status: 400 });
    }
    
    // Validate ZIP code format
    if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
      const response = errorResponse(
        'INVALID_ZIP_CODE',
        'Invalid ZIP code format',
        { zipCode },
        'zipCode',
        requestId
      );
      return NextResponse.json(response, { status: 400 });
    }
    
    // Get service availability
    const availability = await BuyerEligibilityService.getServiceAvailability(
      zipCode,
      serviceTypeId || undefined
    );
    
    // Get ZIP code metadata
    const zipCodeMetadata = await ServiceZoneRepository.getZipCodeMetadata(zipCode);
    
    const result = {
      zipCode,
      serviceTypeId,
      metadata: zipCodeMetadata,
      availability
    };
    
    const response = successResponse(result, requestId);
    return NextResponse.json(response);
    
  } catch (error) {
    logger.error('Service availability error', {
      error: (error as Error).message,
      requestId
    });
    
    const response = errorResponse(
      'AVAILABILITY_ERROR',
      'Failed to fetch service availability',
      undefined,
      undefined,
      requestId
    );
    
    return NextResponse.json(response, { status: 500 });
  }
}

// Export route handlers with admin authentication
export const GET = withMiddleware(
  (req: EnhancedRequest) => {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    
    // Route to specific handler based on type parameter
    if (type === 'availability') {
      return handleGetServiceAvailability(req);
    } else {
      return handleGetServiceZoneAnalytics(req);
    }
  },
  {
    rateLimiter: 'admin',
    enableLogging: true,
    requireAuth: true,
    enableCors: true
  }
);