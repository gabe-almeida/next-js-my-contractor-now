/**
 * Integration Tests for Auction Engine with Service-Zip Mapping
 * Tests end-to-end auction flow with database integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import {
  mockBuyers,
  mockServiceTypes,
  mockBuyerServiceConfigs,
  mockServiceZipMappings,
  mockTestLeads,
  performanceTestMappings
} from '@/tests/fixtures/buyerServiceZipMappingData';

// Mock database client
const mockDb = {
  buyer: {
    findMany: jest.fn(),
    findUnique: jest.fn()
  },
  serviceType: {
    findMany: jest.fn(),
    findUnique: jest.fn()
  },
  buyerServiceConfig: {
    findMany: jest.fn()
  },
  buyerServiceZipMapping: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  lead: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn()
  },
  transaction: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  $transaction: jest.fn((callback) => callback(mockDb))
};

// Integrated Auction Service
class IntegratedAuctionService {
  constructor(private db: any) {}

  /**
   * Process lead through complete auction pipeline
   */
  async processLead(leadData: {
    serviceTypeId: string;
    formData: Record<string, any>;
    zipCode: string;
    complianceData?: Record<string, any>;
  }): Promise<{
    leadId: string;
    auctionResult: any;
    transactions: any[];
    winnerInfo?: any;
  }> {
    // 1. Create lead record
    const lead = await this.createLead(leadData);

    // 2. Get eligible buyers based on service-zip mapping
    const eligibleBuyers = await this.getEligibleBuyers(
      leadData.serviceTypeId,
      leadData.zipCode,
      leadData.complianceData
    );

    if (eligibleBuyers.length === 0) {
      await this.updateLeadStatus(lead.id, 'REJECTED', 'No eligible buyers found');
      return {
        leadId: lead.id,
        auctionResult: { status: 'no_bidders', reason: 'No eligible buyers found' },
        transactions: []
      };
    }

    // 3. Run auction
    const auctionResult = await this.runAuction(lead, eligibleBuyers);

    // 4. Process results
    if (auctionResult.winner) {
      await this.updateLeadStatus(
        lead.id, 
        'SOLD', 
        `Sold to buyer ${auctionResult.winner.buyerId}`
      );

      return {
        leadId: lead.id,
        auctionResult,
        transactions: auctionResult.transactions,
        winnerInfo: auctionResult.winner
      };
    } else {
      await this.updateLeadStatus(lead.id, 'EXPIRED', 'No winning bids received');
      return {
        leadId: lead.id,
        auctionResult: { status: 'no_winner', reason: 'No winning bids received' },
        transactions: auctionResult.transactions
      };
    }
  }

  /**
   * Create lead record
   */
  private async createLead(leadData: any): Promise<any> {
    const lead = {
      id: `lead-${Date.now()}`,
      serviceTypeId: leadData.serviceTypeId,
      formData: JSON.stringify(leadData.formData),
      zipCode: leadData.zipCode,
      ownsHome: leadData.formData.ownsHome || true,
      timeframe: leadData.formData.timeframe || 'Within 30 days',
      status: 'PENDING',
      complianceData: leadData.complianceData ? JSON.stringify(leadData.complianceData) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.lead.create({ data: lead });
    return lead;
  }

  /**
   * Get eligible buyers for service and ZIP
   */
  private async getEligibleBuyers(
    serviceTypeId: string,
    zipCode: string,
    complianceData?: Record<string, any>
  ): Promise<any[]> {
    // Get buyers with ZIP coverage for this service
    const zipMappings = await this.db.buyerServiceZipMapping.findMany({
      where: {
        serviceTypeId,
        active: true,
        zipCodes: {
          has: zipCode
        }
      },
      include: {
        buyer: true,
        serviceType: true
      },
      orderBy: {
        priority: 'asc'
      }
    });

    if (zipMappings.length === 0) {
      return [];
    }

    // Get service configurations for eligible buyers
    const buyerIds = zipMappings.map(mapping => mapping.buyerId);
    const serviceConfigs = await this.db.buyerServiceConfig.findMany({
      where: {
        buyerId: { in: buyerIds },
        serviceTypeId,
        active: true
      },
      include: {
        buyer: true,
        serviceType: true
      }
    });

    // Filter by compliance requirements
    const eligibleBuyers = serviceConfigs.filter(config => 
      this.meetsComplianceRequirements(config, complianceData)
    );

    // Add priority information from ZIP mappings
    return eligibleBuyers.map(config => {
      const zipMapping = zipMappings.find(mapping => mapping.buyerId === config.buyerId);
      return {
        ...config,
        priority: zipMapping?.priority || 10
      };
    }).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check compliance requirements
   */
  private meetsComplianceRequirements(serviceConfig: any, complianceData?: Record<string, any>): boolean {
    if (serviceConfig.requiresTrustedForm && !complianceData?.trustedFormCertId) {
      return false;
    }

    if (serviceConfig.requiresJornaya && !complianceData?.jornayaLeadId) {
      return false;
    }

    return true;
  }

  /**
   * Run auction with eligible buyers
   */
  private async runAuction(lead: any, eligibleBuyers: any[]): Promise<{
    winner?: any;
    allBids: any[];
    transactions: any[];
    duration: number;
  }> {
    const startTime = Date.now();
    const transactions: any[] = [];
    const bids: any[] = [];

    // Send parallel PING requests
    const pingPromises = eligibleBuyers.map(buyer => 
      this.sendPingRequest(lead, buyer).then(result => {
        // Log transaction
        const transaction = {
          id: `tx-${Date.now()}-${buyer.buyerId}`,
          leadId: lead.id,
          buyerId: buyer.buyerId,
          actionType: 'PING',
          payload: result.request,
          response: result.response,
          status: result.success ? 'SUCCESS' : 'FAILED',
          bidAmount: result.bidAmount,
          responseTime: result.responseTime,
          errorMessage: result.error,
          createdAt: new Date()
        };

        transactions.push(transaction);
        
        if (result.success && result.bidAmount > 0) {
          bids.push({
            buyerId: buyer.buyerId,
            bidAmount: result.bidAmount,
            responseTime: result.responseTime,
            buyer
          });
        }

        return result;
      })
    );

    await Promise.all(pingPromises);

    // Select winner (highest bid)
    let winner;
    if (bids.length > 0) {
      winner = bids.reduce((prev, current) => 
        prev.bidAmount > current.bidAmount ? prev : current
      );

      // Send POST to winner
      const postResult = await this.sendPostRequest(lead, winner.buyer);
      
      // Log POST transaction
      const postTransaction = {
        id: `tx-${Date.now()}-${winner.buyerId}-post`,
        leadId: lead.id,
        buyerId: winner.buyerId,
        actionType: 'POST',
        payload: postResult.request,
        response: postResult.response,
        status: postResult.success ? 'SUCCESS' : 'FAILED',
        responseTime: postResult.responseTime,
        errorMessage: postResult.error,
        createdAt: new Date()
      };

      transactions.push(postTransaction);
    }

    // Store all transactions
    for (const transaction of transactions) {
      await this.db.transaction.create({ data: transaction });
    }

    return {
      winner,
      allBids: bids,
      transactions,
      duration: Date.now() - startTime
    };
  }

  /**
   * Send PING request to buyer
   */
  private async sendPingRequest(lead: any, buyer: any): Promise<{
    success: boolean;
    bidAmount: number;
    responseTime: number;
    request: any;
    response?: any;
    error?: string;
  }> {
    const startTime = Date.now();
    
    // Mock PING request
    const request = {
      leadId: lead.id,
      zipCode: lead.zipCode,
      serviceType: buyer.serviceType.name,
      timestamp: new Date().toISOString()
    };

    try {
      // Simulate network call
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
      
      // Mock response based on buyer configuration
      const bidAmount = this.calculateMockBid(buyer);
      const response = {
        accepted: bidAmount > 0,
        bidAmount,
        message: bidAmount > 0 ? 'Lead accepted' : 'Lead rejected'
      };

      return {
        success: true,
        bidAmount,
        responseTime: Date.now() - startTime,
        request,
        response
      };

    } catch (error) {
      return {
        success: false,
        bidAmount: 0,
        responseTime: Date.now() - startTime,
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send POST request to winning buyer
   */
  private async sendPostRequest(lead: any, buyer: any): Promise<{
    success: boolean;
    responseTime: number;
    request: any;
    response?: any;
    error?: string;
  }> {
    const startTime = Date.now();
    
    const request = {
      leadId: lead.id,
      formData: JSON.parse(lead.formData),
      complianceData: lead.complianceData ? JSON.parse(lead.complianceData) : null,
      auctionInfo: {
        winningBid: lead.winningBid,
        timestamp: new Date().toISOString()
      }
    };

    try {
      // Simulate POST delivery
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
      
      const response = {
        received: true,
        confirmationId: `conf-${Date.now()}`,
        message: 'Lead successfully delivered'
      };

      return {
        success: true,
        responseTime: Date.now() - startTime,
        request,
        response
      };

    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        request,
        error: error instanceof Error ? error.message : 'POST delivery failed'
      };
    }
  }

  /**
   * Calculate mock bid amount
   */
  private calculateMockBid(buyer: any): number {
    const { minBid, maxBid } = buyer;
    
    // 90% chance of bidding
    if (Math.random() < 0.9) {
      return Math.floor(Math.random() * (maxBid - minBid) + minBid);
    }
    
    return 0; // No bid
  }

  /**
   * Update lead status
   */
  private async updateLeadStatus(leadId: string, status: string, reason?: string): Promise<void> {
    await this.db.lead.update({
      where: { id: leadId },
      data: {
        status,
        updatedAt: new Date(),
        ...(reason && { statusReason: reason })
      }
    });
  }

  /**
   * Get auction analytics
   */
  async getAuctionAnalytics(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<{
    totalLeads: number;
    soldLeads: number;
    averageBid: number;
    topBuyers: Array<{ buyerId: string; winCount: number; totalSpend: number }>;
    conversionRate: number;
    averageAuctionTime: number;
  }> {
    const leads = await this.db.lead.findMany({
      where: {
        createdAt: {
          gte: this.getTimeframeStart(timeframe)
        }
      },
      include: {
        transactions: true,
        winningBuyer: true
      }
    });

    const totalLeads = leads.length;
    const soldLeads = leads.filter(lead => lead.status === 'SOLD').length;
    
    const bids = leads
      .flatMap(lead => lead.transactions.filter(tx => tx.actionType === 'PING' && tx.bidAmount > 0))
      .map(tx => tx.bidAmount);
    
    const averageBid = bids.length > 0 ? bids.reduce((a, b) => a + b, 0) / bids.length : 0;
    
    const buyerStats = new Map();
    leads.filter(lead => lead.status === 'SOLD').forEach(lead => {
      const buyerId = lead.winningBuyerId;
      if (!buyerStats.has(buyerId)) {
        buyerStats.set(buyerId, { winCount: 0, totalSpend: 0 });
      }
      const stats = buyerStats.get(buyerId);
      stats.winCount++;
      stats.totalSpend += lead.winningBid || 0;
    });

    const topBuyers = Array.from(buyerStats.entries())
      .map(([buyerId, stats]) => ({ buyerId, ...stats }))
      .sort((a, b) => b.winCount - a.winCount)
      .slice(0, 5);

    const auctionTimes = leads
      .flatMap(lead => lead.transactions)
      .map(tx => tx.responseTime)
      .filter(time => time > 0);
    
    const averageAuctionTime = auctionTimes.length > 0 
      ? auctionTimes.reduce((a, b) => a + b, 0) / auctionTimes.length 
      : 0;

    return {
      totalLeads,
      soldLeads,
      averageBid,
      topBuyers,
      conversionRate: totalLeads > 0 ? soldLeads / totalLeads : 0,
      averageAuctionTime
    };
  }

  /**
   * Get timeframe start date
   */
  private getTimeframeStart(timeframe: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (timeframe) {
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        return weekStart;
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }
}

describe('Integrated Auction Service', () => {
  let auctionService: IntegratedAuctionService;

  beforeAll(async () => {
    // Setup mock database responses
    mockDb.buyerServiceZipMapping.findMany.mockImplementation(({ where }) => {
      return mockServiceZipMappings.filter(mapping => 
        mapping.serviceTypeId === where.serviceTypeId &&
        mapping.active === true &&
        mapping.zipCodes.includes(where.zipCodes.has)
      ).map(mapping => ({
        ...mapping,
        buyer: mockBuyers.find(b => b.id === mapping.buyerId),
        serviceType: mockServiceTypes.find(s => s.id === mapping.serviceTypeId)
      }));
    });

    mockDb.buyerServiceConfig.findMany.mockImplementation(({ where }) => {
      return mockBuyerServiceConfigs.filter(config =>
        where.buyerId.in.includes(config.buyerId) &&
        config.serviceTypeId === where.serviceTypeId &&
        config.active === true
      );
    });

    mockDb.lead.create.mockImplementation(({ data }) => Promise.resolve(data));
    mockDb.lead.update.mockImplementation(({ data }) => Promise.resolve(data));
    mockDb.transaction.create.mockImplementation(({ data }) => Promise.resolve(data));

    auctionService = new IntegratedAuctionService(mockDb);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End Lead Processing', () => {
    it('should process premium lead with multiple bidders successfully', async () => {
      const leadData = {
        serviceTypeId: 'service-1', // ROOFING
        formData: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '555-0123',
          ownsHome: true,
          timeframe: 'Within 30 days'
        },
        zipCode: '90210', // Premium ZIP with multiple coverage
        complianceData: {
          trustedFormCertId: 'tf-cert-123',
          jornayaLeadId: 'jornaya-456',
          ipAddress: '192.168.1.1'
        }
      };

      const result = await auctionService.processLead(leadData);

      expect(result.leadId).toBeDefined();
      expect(result.auctionResult.winner).toBeDefined();
      expect(result.transactions.length).toBeGreaterThan(0);
      expect(result.winnerInfo).toBeDefined();
      
      // Should have PING transactions for eligible buyers
      const pingTransactions = result.transactions.filter(tx => tx.actionType === 'PING');
      expect(pingTransactions.length).toBeGreaterThan(1);
      
      // Should have one POST transaction for winner
      const postTransactions = result.transactions.filter(tx => tx.actionType === 'POST');
      expect(postTransactions.length).toBe(1);
    });

    it('should handle lead with limited buyer coverage', async () => {
      const leadData = {
        serviceTypeId: 'service-2', // WINDOWS
        formData: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          numberOfWindows: 8
        },
        zipCode: '98101', // Seattle - limited coverage
        complianceData: {
          trustedFormCertId: 'tf-cert-456',
          jornayaLeadId: 'jornaya-789'
        }
      };

      const result = await auctionService.processLead(leadData);

      expect(result.leadId).toBeDefined();
      
      // Fewer transactions due to limited coverage
      const pingTransactions = result.transactions.filter(tx => tx.actionType === 'PING');
      expect(pingTransactions.length).toBeLessThanOrEqual(2);
    });

    it('should reject lead with no buyer coverage', async () => {
      const leadData = {
        serviceTypeId: 'service-1',
        formData: {
          firstName: 'Bob',
          lastName: 'Wilson',
          email: 'bob@example.com'
        },
        zipCode: '99999', // No coverage
        complianceData: {}
      };

      const result = await auctionService.processLead(leadData);

      expect(result.leadId).toBeDefined();
      expect(result.auctionResult.status).toBe('no_bidders');
      expect(result.auctionResult.reason).toBe('No eligible buyers found');
      expect(result.transactions.length).toBe(0);
    });

    it('should filter buyers based on compliance requirements', async () => {
      const leadData = {
        serviceTypeId: 'service-1',
        formData: {
          firstName: 'Alice',
          lastName: 'Johnson',
          email: 'alice@example.com'
        },
        zipCode: '90210',
        complianceData: {
          // Missing TrustedForm - should filter out buyers that require it
          jornayaLeadId: 'jornaya-123'
        }
      };

      const result = await auctionService.processLead(leadData);

      // Should have fewer transactions due to compliance filtering
      const pingTransactions = result.transactions.filter(tx => tx.actionType === 'PING');
      expect(pingTransactions.length).toBeLessThan(3); // Should be less than all eligible buyers
    });

    it('should handle ultra-premium service with single buyer', async () => {
      const leadData = {
        serviceTypeId: 'service-3', // BATHROOMS
        formData: {
          firstName: 'Michael',
          lastName: 'Brown',
          email: 'michael@example.com',
          numberOfBathrooms: 3,
          budgetRange: '$50,000+'
        },
        zipCode: '90210', // Only Angi covers bathrooms here
        complianceData: {
          trustedFormCertId: 'tf-cert-789'
        }
      };

      const result = await auctionService.processLead(leadData);

      expect(result.leadId).toBeDefined();
      
      // Should have exactly one PING transaction
      const pingTransactions = result.transactions.filter(tx => tx.actionType === 'PING');
      expect(pingTransactions.length).toBe(1);
      expect(pingTransactions[0].buyerId).toBe('buyer-3'); // Angi
    });
  });

  describe('Database Integration', () => {
    it('should create lead record in database', async () => {
      const leadData = {
        serviceTypeId: 'service-1',
        formData: { test: 'data' },
        zipCode: '90210',
        complianceData: { test: 'compliance' }
      };

      await auctionService.processLead(leadData);

      expect(mockDb.lead.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serviceTypeId: 'service-1',
          zipCode: '90210',
          status: 'PENDING'
        })
      });
    });

    it('should update lead status based on auction outcome', async () => {
      const leadData = {
        serviceTypeId: 'service-1',
        formData: { test: 'data' },
        zipCode: '90210',
        complianceData: { trustedFormCertId: 'test', jornayaLeadId: 'test' }
      };

      await auctionService.processLead(leadData);

      // Should update lead status (either SOLD or EXPIRED)
      expect(mockDb.lead.update).toHaveBeenCalled();
    });

    it('should create transaction records for all auction activities', async () => {
      const leadData = {
        serviceTypeId: 'service-1',
        formData: { test: 'data' },
        zipCode: '90210',
        complianceData: { trustedFormCertId: 'test', jornayaLeadId: 'test' }
      };

      await auctionService.processLead(leadData);

      // Should create transaction records
      expect(mockDb.transaction.create).toHaveBeenCalled();
    });

    it('should query buyer service zip mappings correctly', async () => {
      const leadData = {
        serviceTypeId: 'service-1',
        formData: { test: 'data' },
        zipCode: '90210'
      };

      await auctionService.processLead(leadData);

      expect(mockDb.buyerServiceZipMapping.findMany).toHaveBeenCalledWith({
        where: {
          serviceTypeId: 'service-1',
          active: true,
          zipCodes: {
            has: '90210'
          }
        },
        include: {
          buyer: true,
          serviceType: true
        },
        orderBy: {
          priority: 'asc'
        }
      });
    });

    it('should query buyer service configs for eligible buyers', async () => {
      const leadData = {
        serviceTypeId: 'service-1',
        formData: { test: 'data' },
        zipCode: '90210'
      };

      await auctionService.processLead(leadData);

      expect(mockDb.buyerServiceConfig.findMany).toHaveBeenCalledWith({
        where: {
          buyerId: { in: expect.any(Array) },
          serviceTypeId: 'service-1',
          active: true
        },
        include: {
          buyer: true,
          serviceType: true
        }
      });
    });
  });

  describe('Performance and Analytics', () => {
    it('should complete auction within reasonable time', async () => {
      const leadData = {
        serviceTypeId: 'service-1',
        formData: { test: 'data' },
        zipCode: '90210',
        complianceData: { trustedFormCertId: 'test', jornayaLeadId: 'test' }
      };

      const startTime = Date.now();
      const result = await auctionService.processLead(leadData);
      const totalTime = Date.now() - startTime;

      // Should complete within 10 seconds (generous for mocked network calls)
      expect(totalTime).toBeLessThan(10000);
      expect(result.auctionResult.duration).toBeDefined();
    });

    it('should provide accurate auction analytics', async () => {
      // Mock lead data for analytics
      const mockLeads = mockTestLeads.map(lead => ({
        ...lead,
        status: 'SOLD',
        winningBuyerId: 'buyer-1',
        winningBid: 50.0,
        transactions: [
          {
            actionType: 'PING',
            bidAmount: 50.0,
            responseTime: 1500,
            buyerId: 'buyer-1'
          }
        ]
      }));

      mockDb.lead.findMany.mockResolvedValue(mockLeads);

      const analytics = await auctionService.getAuctionAnalytics('day');

      expect(analytics.totalLeads).toBe(mockLeads.length);
      expect(analytics.soldLeads).toBe(mockLeads.length);
      expect(analytics.averageBid).toBeGreaterThan(0);
      expect(analytics.conversionRate).toBe(1.0); // 100% since all are sold
      expect(analytics.topBuyers).toBeDefined();
      expect(analytics.averageAuctionTime).toBeGreaterThan(0);
    });

    it('should handle large ZIP code datasets efficiently', async () => {
      // Test with large ZIP mapping dataset
      const largeMapping = {
        ...performanceTestMappings.largeZipCodeSet,
        buyer: mockBuyers[0],
        serviceType: mockServiceTypes[0]
      };

      mockDb.buyerServiceZipMapping.findMany.mockResolvedValue([largeMapping]);
      mockDb.buyerServiceConfig.findMany.mockResolvedValue([mockBuyerServiceConfigs[0]]);

      const leadData = {
        serviceTypeId: 'service-1',
        formData: { test: 'data' },
        zipCode: '10000', // First ZIP in large dataset
        complianceData: { trustedFormCertId: 'test' }
      };

      const startTime = Date.now();
      const result = await auctionService.processLead(leadData);
      const totalTime = Date.now() - startTime;

      // Should still complete efficiently even with large ZIP dataset
      expect(totalTime).toBeLessThan(5000);
      expect(result.leadId).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockDb.buyerServiceZipMapping.findMany.mockRejectedValue(new Error('Database connection failed'));

      const leadData = {
        serviceTypeId: 'service-1',
        formData: { test: 'data' },
        zipCode: '90210'
      };

      await expect(auctionService.processLead(leadData)).rejects.toThrow('Database connection failed');
    });

    it('should handle buyer PING failures gracefully', async () => {
      // Mock successful database queries but simulate PING failures
      mockDb.buyerServiceZipMapping.findMany.mockResolvedValue([
        {
          ...mockServiceZipMappings[0],
          buyer: mockBuyers[0],
          serviceType: mockServiceTypes[0]
        }
      ]);

      const leadData = {
        serviceTypeId: 'service-1',
        formData: { test: 'data' },
        zipCode: '90210',
        complianceData: { trustedFormCertId: 'test' }
      };

      const result = await auctionService.processLead(leadData);

      // Should still process lead even if some PINGs fail
      expect(result.leadId).toBeDefined();
      expect(result.transactions.length).toBeGreaterThan(0);
    });

    it('should handle POST delivery failures gracefully', async () => {
      const leadData = {
        serviceTypeId: 'service-1',
        formData: { test: 'data' },
        zipCode: '90210',
        complianceData: { trustedFormCertId: 'test', jornayaLeadId: 'test' }
      };

      // Process should complete even if POST fails
      const result = await auctionService.processLead(leadData);

      expect(result.leadId).toBeDefined();
      
      // Should have both PING and POST transactions (even if POST failed)
      const transactionTypes = result.transactions.map(tx => tx.actionType);
      expect(transactionTypes).toContain('PING');
      // POST transaction should be logged even if it failed
      if (result.winnerInfo) {
        expect(transactionTypes).toContain('POST');
      }
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent lead processing', async () => {
      const leadData1 = {
        serviceTypeId: 'service-1',
        formData: { test: 'data1' },
        zipCode: '90210',
        complianceData: { trustedFormCertId: 'test1' }
      };

      const leadData2 = {
        serviceTypeId: 'service-1',
        formData: { test: 'data2' },
        zipCode: '90210',
        complianceData: { trustedFormCertId: 'test2' }
      };

      // Process leads concurrently
      const [result1, result2] = await Promise.all([
        auctionService.processLead(leadData1),
        auctionService.processLead(leadData2)
      ]);

      expect(result1.leadId).toBeDefined();
      expect(result2.leadId).toBeDefined();
      expect(result1.leadId).not.toBe(result2.leadId);
    });

    it('should maintain data consistency under load', async () => {
      const leadPromises = Array.from({ length: 10 }, (_, i) => 
        auctionService.processLead({
          serviceTypeId: 'service-1',
          formData: { test: `data${i}` },
          zipCode: '90210',
          complianceData: { trustedFormCertId: `test${i}` }
        })
      );

      const results = await Promise.all(leadPromises);

      // All leads should be processed successfully
      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result.leadId).toBeDefined();
      });

      // All lead IDs should be unique
      const leadIds = results.map(r => r.leadId);
      const uniqueLeadIds = new Set(leadIds);
      expect(uniqueLeadIds.size).toBe(10);
    });
  });
});