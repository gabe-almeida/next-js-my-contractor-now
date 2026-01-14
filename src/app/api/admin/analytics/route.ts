import { NextResponse } from 'next/server';
import { withMiddleware, EnhancedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { captureApiError } from '@/lib/sentry';

/**
 * Admin Analytics API
 *
 * WHY: Provides comprehensive analytics for compliance, auctions, buyers, and revenue
 * WHEN: Called by admin analytics dashboard for business intelligence
 * HOW: Aggregates data from leads, transactions, and buyers with time-series analysis
 */

async function handleGetAnalytics(req: EnhancedRequest): Promise<NextResponse> {
  const { requestId } = req.context;
  const url = new URL(req.url);
  const period = url.searchParams.get('period') || '7d';

  try {
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

    // Fetch all data in parallel
    const [
      leads,
      transactions,
      buyers,
      pageViews
    ] = await Promise.all([
      // All leads in period
      prisma.lead.findMany({
        where: {
          createdAt: { gte: startDate }
        },
        select: {
          id: true,
          status: true,
          trustedFormCertUrl: true,
          jornayaLeadId: true,
          leadQualityScore: true,
          winningBid: true,
          createdAt: true,
          serviceType: {
            select: {
              name: true,
              displayName: true
            }
          }
        }
      }),
      // All transactions in period
      prisma.transaction.findMany({
        where: {
          createdAt: { gte: startDate }
        },
        select: {
          id: true,
          buyerId: true,
          actionType: true,
          status: true,
          bidAmount: true,
          responseTime: true,
          isWinner: true,
          createdAt: true,
          buyer: {
            select: {
              name: true,
              displayName: true
            }
          }
        }
      }),
      // Active buyers
      prisma.buyer.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          displayName: true
        }
      }),
      // Page views in period
      prisma.pageView.findMany({
        where: {
          createdAt: { gte: startDate }
        },
        select: {
          id: true,
          sessionId: true,
          pageType: true,
          pagePath: true,
          serviceSlug: true,
          createdAt: true
        }
      })
    ]);

    // Calculate compliance metrics
    const totalLeads = leads.length;
    const withTF = leads.filter(l => l.trustedFormCertUrl).length;
    const withJornaya = leads.filter(l => l.jornayaLeadId).length;
    const withBoth = leads.filter(l => l.trustedFormCertUrl && l.jornayaLeadId).length;
    const withQualityScore = leads.filter(l => l.leadQualityScore !== null);
    const avgQualityScore = withQualityScore.length > 0
      ? withQualityScore.reduce((sum, l) => sum + (l.leadQualityScore || 0), 0) / withQualityScore.length
      : 0;
    const highQualityLeads = leads.filter(l => (l.leadQualityScore || 0) >= 8).length;

    const complianceMetrics = {
      trustedFormCoverage: totalLeads > 0 ? (withTF / totalLeads) * 100 : 0,
      jornayaCoverage: totalLeads > 0 ? (withJornaya / totalLeads) * 100 : 0,
      fullComplianceRate: totalLeads > 0 ? (withBoth / totalLeads) * 100 : 0,
      avgQualityScore: Math.round(avgQualityScore * 10) / 10,
      complianceTrend: 0, // TODO: Calculate vs previous period
      qualityTrend: 0, // TODO: Calculate vs previous period
      totalLeadsAnalyzed: totalLeads,
      highQualityLeads
    };

    // Calculate auction metrics
    const pingTransactions = transactions.filter(t => t.actionType === 'PING');
    const successfulPings = pingTransactions.filter(t => t.status === 'SUCCESS' && t.bidAmount);
    const totalBidAmount = successfulPings.reduce((sum, t) => sum + Number(t.bidAmount || 0), 0);
    const avgBidAmount = successfulPings.length > 0 ? totalBidAmount / successfulPings.length : 0;
    const avgResponseTime = transactions.length > 0
      ? transactions.reduce((sum, t) => sum + (t.responseTime || 0), 0) / transactions.length
      : 0;

    // Calculate total revenue from successful transactions
    const successfulTransactions = transactions.filter(t => t.status === 'SUCCESS' && t.bidAmount);
    const totalRevenue = successfulTransactions.reduce((sum, t) => sum + Number(t.bidAmount || 0), 0);

    // Find top buyer by revenue
    const buyerRevenue = new Map<string, { name: string; displayName: string | null; revenue: number }>();
    successfulTransactions.forEach(t => {
      const buyer = t.buyer;
      if (buyer) {
        const existing = buyerRevenue.get(buyer.name) || { name: buyer.name, displayName: buyer.displayName, revenue: 0 };
        existing.revenue += Number(t.bidAmount || 0);
        buyerRevenue.set(buyer.name, existing);
      }
    });

    const topBuyerEntry = Array.from(buyerRevenue.values()).sort((a, b) => b.revenue - a.revenue)[0];

    const auctionMetrics = {
      avgBidAmount: Math.round(avgBidAmount * 100) / 100,
      bidParticipationRate: pingTransactions.length > 0 ? (successfulPings.length / pingTransactions.length) * 100 : 0,
      auctionSuccessRate: transactions.length > 0 ? (transactions.filter(t => t.status === 'SUCCESS').length / transactions.length) * 100 : 0,
      avgResponseTime: Math.round(avgResponseTime / 1000 * 10) / 10, // Convert to seconds
      topBuyer: topBuyerEntry?.displayName || topBuyerEntry?.name || 'N/A',
      totalRevenue: Math.round(totalRevenue * 100) / 100
    };

    // Build revenue timeline (daily aggregation)
    const revenueByDate = new Map<string, { revenue: number; leads: number; bids: number }>();
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      revenueByDate.set(dateStr, { revenue: 0, leads: 0, bids: 0 });
    }

    successfulTransactions.forEach(t => {
      const dateStr = new Date(t.createdAt).toISOString().split('T')[0];
      const existing = revenueByDate.get(dateStr);
      if (existing) {
        existing.revenue += Number(t.bidAmount || 0);
        existing.bids += 1;
      }
    });

    leads.forEach(l => {
      const dateStr = new Date(l.createdAt).toISOString().split('T')[0];
      const existing = revenueByDate.get(dateStr);
      if (existing) {
        existing.leads += 1;
      }
    });

    const revenueData = Array.from(revenueByDate.entries())
      .map(([date, data]) => ({
        date,
        revenue: Math.round(data.revenue * 100) / 100,
        leads: data.leads,
        avgBid: data.bids > 0 ? Math.round((data.revenue / data.bids) * 100) / 100 : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Build compliance timeline
    const complianceByDate = new Map<string, { trustedForm: number; jornaya: number; both: number; total: number }>();
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      complianceByDate.set(dateStr, { trustedForm: 0, jornaya: 0, both: 0, total: 0 });
    }

    leads.forEach(l => {
      const dateStr = new Date(l.createdAt).toISOString().split('T')[0];
      const existing = complianceByDate.get(dateStr);
      if (existing) {
        existing.total += 1;
        if (l.trustedFormCertUrl) existing.trustedForm += 1;
        if (l.jornayaLeadId) existing.jornaya += 1;
        if (l.trustedFormCertUrl && l.jornayaLeadId) existing.both += 1;
      }
    });

    const complianceData = Array.from(complianceByDate.entries())
      .map(([date, data]) => ({
        date,
        trustedForm: data.total > 0 ? Math.round((data.trustedForm / data.total) * 1000) / 10 : 0,
        jornaya: data.total > 0 ? Math.round((data.jornaya / data.total) * 1000) / 10 : 0,
        both: data.total > 0 ? Math.round((data.both / data.total) * 1000) / 10 : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate buyer performance
    const buyerStats = new Map<string, { name: string; displayName: string | null; avgBid: number; wins: number; total: number; volume: number }>();
    transactions.forEach(t => {
      if (!buyerStats.has(t.buyerId)) {
        buyerStats.set(t.buyerId, {
          name: t.buyer.name,
          displayName: t.buyer.displayName,
          avgBid: 0,
          wins: 0,
          total: 0,
          volume: 0
        });
      }
      const stats = buyerStats.get(t.buyerId)!;
      stats.total += 1;
      if (t.isWinner) stats.wins += 1;
      if (t.bidAmount) {
        stats.avgBid += Number(t.bidAmount);
        stats.volume += 1;
      }
    });

    const buyerPerformance = Array.from(buyerStats.values())
      .map(stats => ({
        buyer: stats.displayName || stats.name,
        avgBid: stats.volume > 0 ? Math.round((stats.avgBid / stats.volume) * 100) / 100 : 0,
        winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 1000) / 10 : 0,
        volume: stats.wins
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10); // Top 10 buyers

    // Calculate quality scores by service
    const serviceStats = new Map<string, { name: string; displayName: string; scores: number[]; count: number }>();
    leads.forEach(l => {
      if (l.leadQualityScore !== null) {
        const key = l.serviceType.name;
        if (!serviceStats.has(key)) {
          serviceStats.set(key, {
            name: l.serviceType.name,
            displayName: l.serviceType.displayName,
            scores: [],
            count: 0
          });
        }
        const stats = serviceStats.get(key)!;
        stats.scores.push(l.leadQualityScore);
        stats.count += 1;
      }
    });

    const qualityScores = Array.from(serviceStats.values())
      .map(stats => ({
        service: stats.displayName || stats.name,
        avgScore: stats.scores.length > 0
          ? Math.round((stats.scores.reduce((sum, s) => sum + s, 0) / stats.scores.length) * 10) / 10
          : 0,
        count: stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 services

    // Calculate page view & conversion funnel metrics
    const homePageViews = pageViews.filter(pv => pv.pageType === 'HOME');
    const servicePageViews = pageViews.filter(pv => pv.pageType === 'SERVICE');

    // Unique visitors (unique session IDs)
    const uniqueHomeSessions = new Set(homePageViews.map(pv => pv.sessionId));
    const uniqueServiceSessions = new Set(servicePageViews.map(pv => pv.sessionId));

    // Conversion rates
    const homeToServiceRate = uniqueHomeSessions.size > 0
      ? (uniqueServiceSessions.size / uniqueHomeSessions.size) * 100
      : 0;
    const serviceToLeadRate = uniqueServiceSessions.size > 0
      ? (totalLeads / uniqueServiceSessions.size) * 100
      : 0;
    const overallConversionRate = uniqueHomeSessions.size > 0
      ? (totalLeads / uniqueHomeSessions.size) * 100
      : 0;

    // Build page view timeline
    const pageViewsByDate = new Map<string, { homeViews: number; serviceViews: number; uniqueHome: Set<string>; uniqueService: Set<string> }>();
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      pageViewsByDate.set(dateStr, { homeViews: 0, serviceViews: 0, uniqueHome: new Set(), uniqueService: new Set() });
    }

    pageViews.forEach(pv => {
      const dateStr = new Date(pv.createdAt).toISOString().split('T')[0];
      const existing = pageViewsByDate.get(dateStr);
      if (existing) {
        if (pv.pageType === 'HOME') {
          existing.homeViews += 1;
          existing.uniqueHome.add(pv.sessionId);
        } else if (pv.pageType === 'SERVICE') {
          existing.serviceViews += 1;
          existing.uniqueService.add(pv.sessionId);
        }
      }
    });

    const pageViewData = Array.from(pageViewsByDate.entries())
      .map(([date, data]) => ({
        date,
        homeViews: data.homeViews,
        serviceViews: data.serviceViews,
        uniqueHomeVisitors: data.uniqueHome.size,
        uniqueServiceVisitors: data.uniqueService.size
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Service page breakdown
    const servicePageBreakdown = new Map<string, { views: number; uniqueVisitors: Set<string> }>();
    servicePageViews.forEach(pv => {
      const slug = pv.serviceSlug || 'unknown';
      if (!servicePageBreakdown.has(slug)) {
        servicePageBreakdown.set(slug, { views: 0, uniqueVisitors: new Set() });
      }
      const data = servicePageBreakdown.get(slug)!;
      data.views += 1;
      data.uniqueVisitors.add(pv.sessionId);
    });

    const servicePageStats = Array.from(servicePageBreakdown.entries())
      .map(([slug, data]) => ({
        service: slug,
        views: data.views,
        uniqueVisitors: data.uniqueVisitors.size
      }))
      .sort((a, b) => b.views - a.views);

    const conversionFunnel = {
      totalHomePageViews: homePageViews.length,
      uniqueHomeVisitors: uniqueHomeSessions.size,
      totalServicePageViews: servicePageViews.length,
      uniqueServiceVisitors: uniqueServiceSessions.size,
      totalLeads,
      homeToServiceRate: Math.round(homeToServiceRate * 100) / 100,
      serviceToLeadRate: Math.round(serviceToLeadRate * 100) / 100,
      overallConversionRate: Math.round(overallConversionRate * 100) / 100,
      pageViewData,
      servicePageStats
    };

    const response = successResponse(
      {
        period,
        complianceMetrics,
        auctionMetrics,
        revenueData,
        complianceData,
        buyerPerformance,
        qualityScores,
        conversionFunnel
      },
      requestId
    );

    return NextResponse.json(response);

  } catch (error) {
    captureApiError(error, { route: '/api/admin/analytics', action: 'GET' });
    logger.error('Analytics fetch error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId
    });

    const response = errorResponse(
      'ANALYTICS_ERROR',
      'Failed to fetch analytics',
      undefined,
      undefined,
      requestId
    );

    return NextResponse.json(response, { status: 500 });
  }
}

// Export GET handler with admin authentication
export const GET = withMiddleware(handleGetAnalytics, {
  rateLimiter: 'admin',
  enableLogging: true,
  requireAuth: true,
  enableCors: true
});
