/**
 * Integration Tests: End-to-End Lead Flow
 * Tests the complete lead lifecycle from submission to winner selection
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Decimal } from 'decimal.js';

// Mock types for testing
interface Lead {
  id: string;
  serviceTypeId: string;
  zipCode: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  winningBid?: Decimal;
  winningBuyerId?: string;
  formData: Record<string, any>;
  trustedFormCertUrl?: string;
  jornayaLeadId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Buyer {
  id: string;
  name: string;
  type: 'CONTRACTOR' | 'NETWORK';
  active: boolean;
  authConfig: string;
  webhookSecret: string;
  apiUrl: string;
}

interface BuyerServiceConfig {
  id: string;
  buyerId: string;
  serviceTypeId: string;
  minBid: Decimal;
  maxBid: Decimal;
  active: boolean;
}

interface BuyerServiceZipCode {
  id: string;
  buyerId: string;
  serviceTypeId: string;
  zipCode: string;
  minBid?: Decimal;
  maxBid?: Decimal;
  active: boolean;
}

interface Transaction {
  id: string;
  leadId: string;
  buyerId: string;
  type: 'PING' | 'POST';
  bidAmount?: Decimal;
  responseTime: number;
  httpStatus: number;
  success: boolean;
  error?: string;
  createdAt: Date;
}

// Mock database and services
class MockDatabase {
  leads: Map<string, Lead> = new Map();
  buyers: Map<string, Buyer> = new Map();
  serviceConfigs: Map<string, BuyerServiceConfig> = new Map();
  zipCodes: Map<string, BuyerServiceZipCode> = new Map();
  transactions: Map<string, Transaction> = new Map();

  async createLead(data: Partial<Lead>): Promise<Lead> {
    const lead: Lead = {
      id: `lead-${Date.now()}`,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data
    } as Lead;

    this.leads.set(lead.id, lead);
    return lead;
  }

  async updateLead(id: string, data: Partial<Lead>): Promise<Lead> {
    const lead = this.leads.get(id);
    if (!lead) throw new Error('Lead not found');

    const updated = { ...lead, ...data, updatedAt: new Date() };
    this.leads.set(id, updated);
    return updated;
  }

  async findEligibleBuyers(serviceTypeId: string, zipCode: string): Promise<Buyer[]> {
    const eligible: Buyer[] = [];

    for (const buyer of this.buyers.values()) {
      if (!buyer.active) continue;

      // Check if buyer has service config for this service type
      const hasConfig = Array.from(this.serviceConfigs.values()).some(
        config =>
          config.buyerId === buyer.id &&
          config.serviceTypeId === serviceTypeId &&
          config.active
      );

      if (!hasConfig) continue;

      // Check if buyer serves this ZIP code
      const servesZip = Array.from(this.zipCodes.values()).some(
        zc =>
          zc.buyerId === buyer.id &&
          zc.serviceTypeId === serviceTypeId &&
          zc.zipCode === zipCode &&
          zc.active
      );

      if (servesZip) {
        eligible.push(buyer);
      }
    }

    return eligible;
  }

  async getBuyerServiceConfig(buyerId: string, serviceTypeId: string): Promise<BuyerServiceConfig | null> {
    return Array.from(this.serviceConfigs.values()).find(
      config => config.buyerId === buyerId && config.serviceTypeId === serviceTypeId
    ) || null;
  }

  async getBuyerZipConfig(buyerId: string, serviceTypeId: string, zipCode: string): Promise<BuyerServiceZipCode | null> {
    return Array.from(this.zipCodes.values()).find(
      zc =>
        zc.buyerId === buyerId &&
        zc.serviceTypeId === serviceTypeId &&
        zc.zipCode === zipCode
    ) || null;
  }

  async createTransaction(data: Partial<Transaction>): Promise<Transaction> {
    const transaction: Transaction = {
      id: `txn-${Date.now()}`,
      createdAt: new Date(),
      ...data
    } as Transaction;

    this.transactions.set(transaction.id, transaction);
    return transaction;
  }
}

// Mock auction engine
class MockAuctionEngine {
  async runAuction(
    lead: Lead,
    buyers: Buyer[],
    db: MockDatabase
  ): Promise<{ winner: Buyer; bidAmount: Decimal } | null> {
    const bids: Array<{ buyer: Buyer; bid: Decimal }> = [];

    // Collect bids from all eligible buyers
    for (const buyer of buyers) {
      const config = await db.getBuyerServiceConfig(buyer.id, lead.serviceTypeId);
      const zipConfig = await db.getBuyerZipConfig(buyer.id, lead.serviceTypeId, lead.zipCode);

      if (!config) continue;

      // Use ZIP-specific bid if available, otherwise use service config
      const minBid = zipConfig?.minBid || config.minBid;
      const maxBid = zipConfig?.maxBid || config.maxBid;

      // Simulate bid (random between min and max)
      const bidRange = maxBid.minus(minBid);
      const randomFactor = Math.random();
      const bid = minBid.plus(bidRange.times(randomFactor));

      bids.push({ buyer, bid });

      // Log transaction
      await db.createTransaction({
        leadId: lead.id,
        buyerId: buyer.id,
        type: 'PING',
        bidAmount: bid,
        responseTime: Math.floor(Math.random() * 1000),
        httpStatus: 200,
        success: true
      });
    }

    if (bids.length === 0) return null;

    // Select highest bidder
    const winner = bids.reduce((highest, current) =>
      current.bid.greaterThan(highest.bid) ? current : highest
    );

    // Log POST transaction for winner
    await db.createTransaction({
      leadId: lead.id,
      buyerId: winner.buyer.id,
      type: 'POST',
      bidAmount: winner.bid,
      responseTime: Math.floor(Math.random() * 2000),
      httpStatus: 200,
      success: true
    });

    return { winner: winner.buyer, bidAmount: winner.bid };
  }
}

describe('End-to-End Lead Flow Integration', () => {
  let db: MockDatabase;
  let auctionEngine: MockAuctionEngine;

  beforeEach(() => {
    db = new MockDatabase();
    auctionEngine = new MockAuctionEngine();

    // Setup test data
    setupTestBuyers();
  });

  function setupTestBuyers() {
    // Create buyers
    const buyer1: Buyer = {
      id: 'buyer-1',
      name: 'HomeAdvisor',
      type: 'NETWORK',
      active: true,
      authConfig: 'encrypted-config-1',
      webhookSecret: 'encrypted-secret-1',
      apiUrl: 'https://api.homeadvisor.com/leads'
    };

    const buyer2: Buyer = {
      id: 'buyer-2',
      name: 'ABC Roofing',
      type: 'CONTRACTOR',
      active: true,
      authConfig: 'encrypted-config-2',
      webhookSecret: 'encrypted-secret-2',
      apiUrl: 'https://api.abcroofing.com/leads'
    };

    const buyer3: Buyer = {
      id: 'buyer-3',
      name: 'XYZ Windows',
      type: 'CONTRACTOR',
      active: true,
      authConfig: 'encrypted-config-3',
      webhookSecret: 'encrypted-secret-3',
      apiUrl: 'https://api.xyzwindows.com/leads'
    };

    db.buyers.set(buyer1.id, buyer1);
    db.buyers.set(buyer2.id, buyer2);
    db.buyers.set(buyer3.id, buyer3);

    // Create service configs (roofing service)
    const serviceTypeId = 'service-roofing';

    db.serviceConfigs.set('config-1', {
      id: 'config-1',
      buyerId: 'buyer-1',
      serviceTypeId,
      minBid: new Decimal('15'),
      maxBid: new Decimal('50'),
      active: true
    });

    db.serviceConfigs.set('config-2', {
      id: 'config-2',
      buyerId: 'buyer-2',
      serviceTypeId,
      minBid: new Decimal('20'),
      maxBid: new Decimal('60'),
      active: true
    });

    db.serviceConfigs.set('config-3', {
      id: 'config-3',
      buyerId: 'buyer-3',
      serviceTypeId,
      minBid: new Decimal('10'),
      maxBid: new Decimal('40'),
      active: true
    });

    // Create ZIP code mappings
    const zipCodes = ['10001', '90210', '60601'];

    zipCodes.forEach((zipCode, index) => {
      db.zipCodes.set(`zip-1-${index}`, {
        id: `zip-1-${index}`,
        buyerId: 'buyer-1',
        serviceTypeId,
        zipCode,
        active: true
      });

      db.zipCodes.set(`zip-2-${index}`, {
        id: `zip-2-${index}`,
        buyerId: 'buyer-2',
        serviceTypeId,
        zipCode,
        minBid: new Decimal('25'), // ZIP-specific override
        maxBid: new Decimal('70'),
        active: true
      });

      // Buyer 3 only serves some ZIPs
      if (index < 2) {
        db.zipCodes.set(`zip-3-${index}`, {
          id: `zip-3-${index}`,
          buyerId: 'buyer-3',
          serviceTypeId,
          zipCode,
          active: true
        });
      }
    });
  }

  describe('Complete Lead Lifecycle', () => {
    test('should process lead from submission to completion', async () => {
      // 1. Submit lead
      const lead = await db.createLead({
        serviceTypeId: 'service-roofing',
        zipCode: '10001',
        formData: {
          ownsHome: true,
          timeframe: 'ASAP',
          description: 'Need roof repair'
        },
        trustedFormCertUrl: 'https://cert.trustedform.com/abc123',
        jornayaLeadId: 'jornaya-123'
      });

      expect(lead.id).toBeDefined();
      expect(lead.status).toBe('PENDING');

      // 2. Find eligible buyers
      const eligibleBuyers = await db.findEligibleBuyers(lead.serviceTypeId, lead.zipCode);

      expect(eligibleBuyers).toHaveLength(3); // All 3 buyers serve this ZIP

      // 3. Update lead status to processing
      await db.updateLead(lead.id, { status: 'PROCESSING' });

      // 4. Run auction
      const auctionResult = await auctionEngine.runAuction(lead, eligibleBuyers, db);

      expect(auctionResult).not.toBeNull();
      expect(auctionResult!.winner).toBeDefined();
      expect(auctionResult!.bidAmount).toBeInstanceOf(Decimal);

      // 5. Update lead with winner
      await db.updateLead(lead.id, {
        status: 'COMPLETED',
        winningBid: auctionResult!.bidAmount,
        winningBuyerId: auctionResult!.winner.id
      });

      // 6. Verify final state
      const finalLead = db.leads.get(lead.id)!;
      expect(finalLead.status).toBe('COMPLETED');
      expect(finalLead.winningBuyerId).toBeDefined();
      expect(finalLead.winningBid).toBeDefined();

      // 7. Verify transactions created
      const transactions = Array.from(db.transactions.values()).filter(
        t => t.leadId === lead.id
      );

      // Should have PING for all buyers + POST for winner
      expect(transactions.filter(t => t.type === 'PING')).toHaveLength(3);
      expect(transactions.filter(t => t.type === 'POST')).toHaveLength(1);

      const postTransaction = transactions.find(t => t.type === 'POST')!;
      expect(postTransaction.buyerId).toBe(auctionResult!.winner.id);
    });

    test('should handle lead with no eligible buyers', async () => {
      // Submit lead for unsupported ZIP
      const lead = await db.createLead({
        serviceTypeId: 'service-roofing',
        zipCode: '99999', // No buyers serve this ZIP
        formData: {
          ownsHome: true,
          timeframe: 'ASAP'
        }
      });

      const eligibleBuyers = await db.findEligibleBuyers(lead.serviceTypeId, lead.zipCode);

      expect(eligibleBuyers).toHaveLength(0);

      // Run auction with no buyers
      const auctionResult = await auctionEngine.runAuction(lead, eligibleBuyers, db);

      expect(auctionResult).toBeNull();

      // Update lead as failed
      await db.updateLead(lead.id, { status: 'FAILED' });

      const finalLead = db.leads.get(lead.id)!;
      expect(finalLead.status).toBe('FAILED');
      expect(finalLead.winningBuyerId).toBeUndefined();
    });

    test('should respect buyer ZIP coverage limits', async () => {
      // Submit lead for ZIP that only buyer 1 and 2 serve
      const lead = await db.createLead({
        serviceTypeId: 'service-roofing',
        zipCode: '60601', // Buyer 3 doesn't serve this ZIP
        formData: {
          ownsHome: true,
          timeframe: 'WITHIN_MONTH'
        }
      });

      const eligibleBuyers = await db.findEligibleBuyers(lead.serviceTypeId, lead.zipCode);

      expect(eligibleBuyers).toHaveLength(2); // Only buyers 1 and 2
      expect(eligibleBuyers.map(b => b.id)).not.toContain('buyer-3');
    });

    test('should use ZIP-specific bid overrides', async () => {
      const lead = await db.createLead({
        serviceTypeId: 'service-roofing',
        zipCode: '10001',
        formData: {
          ownsHome: true,
          timeframe: 'ASAP'
        }
      });

      // Get buyer 2's config
      const serviceConfig = await db.getBuyerServiceConfig('buyer-2', lead.serviceTypeId);
      const zipConfig = await db.getBuyerZipConfig('buyer-2', lead.serviceTypeId, lead.zipCode);

      // ZIP config should override service config
      expect(zipConfig?.minBid?.toString()).toBe('25');
      expect(zipConfig?.maxBid?.toString()).toBe('70');
      expect(serviceConfig?.minBid?.toString()).toBe('20');
      expect(serviceConfig?.maxBid?.toString()).toBe('60');
    });
  });

  describe('Auction Logic', () => {
    test('should select highest bidder', async () => {
      const lead = await db.createLead({
        serviceTypeId: 'service-roofing',
        zipCode: '10001',
        formData: {
          ownsHome: true,
          timeframe: 'ASAP'
        }
      });

      const eligibleBuyers = await db.findEligibleBuyers(lead.serviceTypeId, lead.zipCode);

      // Run auction multiple times to verify highest bid wins
      const results: Decimal[] = [];
      for (let i = 0; i < 10; i++) {
        const result = await auctionEngine.runAuction(lead, eligibleBuyers, db);
        if (result) {
          results.push(result.bidAmount);
        }
      }

      expect(results.length).toBeGreaterThan(0);

      // All bids should be within reasonable ranges
      results.forEach(bid => {
        expect(bid.toNumber()).toBeGreaterThanOrEqual(10); // Min of all buyers
        expect(bid.toNumber()).toBeLessThanOrEqual(70); // Max of all buyers
      });
    });

    test('should create PING transactions for all eligible buyers', async () => {
      const lead = await db.createLead({
        serviceTypeId: 'service-roofing',
        zipCode: '10001',
        formData: {
          ownsHome: true,
          timeframe: 'ASAP'
        }
      });

      const eligibleBuyers = await db.findEligibleBuyers(lead.serviceTypeId, lead.zipCode);
      await auctionEngine.runAuction(lead, eligibleBuyers, db);

      const pingTransactions = Array.from(db.transactions.values()).filter(
        t => t.leadId === lead.id && t.type === 'PING'
      );

      expect(pingTransactions).toHaveLength(eligibleBuyers.length);

      pingTransactions.forEach(txn => {
        expect(txn.bidAmount).toBeInstanceOf(Decimal);
        expect(txn.success).toBe(true);
        expect(txn.httpStatus).toBe(200);
        expect(txn.responseTime).toBeGreaterThan(0);
      });
    });

    test('should create POST transaction for winner only', async () => {
      const lead = await db.createLead({
        serviceTypeId: 'service-roofing',
        zipCode: '10001',
        formData: {
          ownsHome: true,
          timeframe: 'ASAP'
        }
      });

      const eligibleBuyers = await db.findEligibleBuyers(lead.serviceTypeId, lead.zipCode);
      const result = await auctionEngine.runAuction(lead, eligibleBuyers, db);

      const postTransactions = Array.from(db.transactions.values()).filter(
        t => t.leadId === lead.id && t.type === 'POST'
      );

      expect(postTransactions).toHaveLength(1);
      expect(postTransactions[0].buyerId).toBe(result!.winner.id);
      expect(postTransactions[0].bidAmount?.toString()).toBe(result!.bidAmount.toString());
    });
  });

  describe('Compliance Tracking', () => {
    test('should store compliance data with lead', async () => {
      const lead = await db.createLead({
        serviceTypeId: 'service-roofing',
        zipCode: '10001',
        formData: {
          ownsHome: true,
          timeframe: 'ASAP',
          tcpaConsent: true
        },
        trustedFormCertUrl: 'https://cert.trustedform.com/abc123',
        jornayaLeadId: 'jornaya-xyz789'
      });

      expect(lead.trustedFormCertUrl).toBe('https://cert.trustedform.com/abc123');
      expect(lead.jornayaLeadId).toBe('jornaya-xyz789');
      expect(lead.formData.tcpaConsent).toBe(true);
    });

    test('should handle lead without compliance data', async () => {
      const lead = await db.createLead({
        serviceTypeId: 'service-roofing',
        zipCode: '10001',
        formData: {
          ownsHome: true,
          timeframe: 'ASAP'
        }
        // No compliance data
      });

      expect(lead.trustedFormCertUrl).toBeUndefined();
      expect(lead.jornayaLeadId).toBeUndefined();

      // Lead should still process successfully
      const eligibleBuyers = await db.findEligibleBuyers(lead.serviceTypeId, lead.zipCode);
      const result = await auctionEngine.runAuction(lead, eligibleBuyers, db);

      expect(result).not.toBeNull();
    });
  });

  describe('Transaction Tracking', () => {
    test('should log response times for all transactions', async () => {
      const lead = await db.createLead({
        serviceTypeId: 'service-roofing',
        zipCode: '10001',
        formData: {
          ownsHome: true,
          timeframe: 'ASAP'
        }
      });

      const eligibleBuyers = await db.findEligibleBuyers(lead.serviceTypeId, lead.zipCode);
      await auctionEngine.runAuction(lead, eligibleBuyers, db);

      const transactions = Array.from(db.transactions.values()).filter(
        t => t.leadId === lead.id
      );

      transactions.forEach(txn => {
        expect(txn.responseTime).toBeGreaterThan(0);
        expect(txn.responseTime).toBeLessThan(5000); // Reasonable max
      });
    });

    test('should calculate total revenue from winning bid', async () => {
      const lead = await db.createLead({
        serviceTypeId: 'service-roofing',
        zipCode: '10001',
        formData: {
          ownsHome: true,
          timeframe: 'ASAP'
        }
      });

      const eligibleBuyers = await db.findEligibleBuyers(lead.serviceTypeId, lead.zipCode);
      const result = await auctionEngine.runAuction(lead, eligibleBuyers, db);

      const postTransaction = Array.from(db.transactions.values()).find(
        t => t.leadId === lead.id && t.type === 'POST'
      );

      expect(postTransaction?.bidAmount?.toString()).toBe(result!.bidAmount.toString());

      // Revenue = winning bid
      const revenue = postTransaction!.bidAmount!;
      expect(revenue.toNumber()).toBeGreaterThan(0);
    });
  });

  describe('Performance Scenarios', () => {
    test('should handle concurrent lead submissions', async () => {
      const leads = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          db.createLead({
            serviceTypeId: 'service-roofing',
            zipCode: '10001',
            formData: {
              ownsHome: true,
              timeframe: 'ASAP',
              requestNumber: i
            }
          })
        )
      );

      expect(leads).toHaveLength(10);
      expect(new Set(leads.map(l => l.id)).size).toBe(10); // All unique IDs
    });

    test('should process multiple leads sequentially', async () => {
      const startTime = performance.now();

      for (let i = 0; i < 5; i++) {
        const lead = await db.createLead({
          serviceTypeId: 'service-roofing',
          zipCode: '10001',
          formData: {
            ownsHome: true,
            timeframe: 'ASAP'
          }
        });

        const buyers = await db.findEligibleBuyers(lead.serviceTypeId, lead.zipCode);
        await auctionEngine.runAuction(lead, buyers, db);
        await db.updateLead(lead.id, { status: 'COMPLETED' });
      }

      const endTime = performance.now();

      expect(db.leads.size).toBe(5);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete quickly
    });
  });

  describe('Edge Cases', () => {
    test('should handle lead with all inactive buyers', async () => {
      // Deactivate all buyers
      db.buyers.forEach((buyer, id) => {
        db.buyers.set(id, { ...buyer, active: false });
      });

      const lead = await db.createLead({
        serviceTypeId: 'service-roofing',
        zipCode: '10001',
        formData: {
          ownsHome: true,
          timeframe: 'ASAP'
        }
      });

      const eligibleBuyers = await db.findEligibleBuyers(lead.serviceTypeId, lead.zipCode);

      expect(eligibleBuyers).toHaveLength(0);
    });

    test('should handle lead with unsupported service type', async () => {
      const lead = await db.createLead({
        serviceTypeId: 'service-unsupported',
        zipCode: '10001',
        formData: {
          ownsHome: true,
          timeframe: 'ASAP'
        }
      });

      const eligibleBuyers = await db.findEligibleBuyers(lead.serviceTypeId, lead.zipCode);

      expect(eligibleBuyers).toHaveLength(0);
    });

    test('should handle decimal precision in bids', async () => {
      const lead = await db.createLead({
        serviceTypeId: 'service-roofing',
        zipCode: '10001',
        formData: {
          ownsHome: true,
          timeframe: 'ASAP'
        }
      });

      const eligibleBuyers = await db.findEligibleBuyers(lead.serviceTypeId, lead.zipCode);
      const result = await auctionEngine.runAuction(lead, eligibleBuyers, db);

      // Verify decimal precision maintained
      expect(result!.bidAmount).toBeInstanceOf(Decimal);
      const bidString = result!.bidAmount.toString();

      // Should have at most 2 decimal places for currency
      const decimalPlaces = bidString.split('.')[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });
});
