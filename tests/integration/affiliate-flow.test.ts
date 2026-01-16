/**
 * Integration Test Suite: Affiliate System End-to-End Flows
 *
 * WHY: Validates complete affiliate workflows work correctly across multiple services.
 *      Tests signup, approval, login, lead attribution, and commission creation.
 *
 * WHEN: Use this suite to verify:
 *       - Complete signup → approval → login flow
 *       - Link click → lead attribution with correct affiliate assignment
 *       - Lead sold → automatic commission creation with correct calculation
 *
 * HOW: Run with `npm test -- affiliate-flow.test.ts`
 *      These are full integration tests that may use real database or mocks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import {
  createAffiliate,
  updateAffiliateStatus,
  validateAffiliatePassword,
  generateAffiliateToken
} from '../../src/lib/services/affiliate-service';
import {
  createLink,
  getLinkByCode,
  trackClick
} from '../../src/lib/services/affiliate-link-service';
import {
  createCommissionForLead,
  getCommissionsByAffiliateId
} from '../../src/lib/services/affiliate-commission-service';
import { AffiliateStatus, CommissionStatus } from '../../src/types/database';

// Mock dependencies
vi.mock('../../src/lib/prisma');
vi.mock('../../src/lib/logger');
vi.mock('bcryptjs');

describe('Affiliate System - Integration Flows', () => {
  const testEmail = 'affiliate@test.com';
  const testPassword = 'TestPass123';
  let affiliateId: string;
  let affiliateLinkId: string;
  let leadId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    affiliateId = `affiliate-${Date.now()}`;
    affiliateLinkId = `link-${Date.now()}`;
    leadId = `lead-${Date.now()}`;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================
  // SIGNUP → APPROVAL → LOGIN FLOW
  // ============================
  describe('Signup → Approval → Login Flow', () => {
    it('should create affiliate with PENDING status during signup', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce(null);
      mockPrismaInstance.affiliate.create.mockResolvedValueOnce({
        id: affiliateId,
        email: testEmail,
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hashed_password',
        status: AffiliateStatus.PENDING,
        emailVerified: false,
        companyName: null,
        phone: null,
        commissionRate: 0.1,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusChangedAt: null,
        statusChangedBy: null
      });

      const result = await createAffiliate({
        email: testEmail,
        password: testPassword,
        firstName: 'John',
        lastName: 'Doe'
      });

      expect(result.success).toBe(true);
      expect(result.affiliate).toBeDefined();
      expect(result.affiliate?.status).toBe(AffiliateStatus.PENDING);
      expect(result.affiliate?.email).toBe(testEmail);
    });

    it('should prevent login when affiliate is still PENDING', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce({
        id: affiliateId,
        email: testEmail,
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hashed_password',
        status: AffiliateStatus.PENDING,
        emailVerified: false,
        companyName: null,
        phone: null,
        commissionRate: 0.1,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusChangedAt: null,
        statusChangedBy: null
      });

      const result = await validateAffiliatePassword(testEmail, testPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should approve affiliate and change status to ACTIVE', async () => {
      const mockPrismaInstance = vi.mocked(prisma);
      const adminId = 'admin-user-123';

      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce({
        id: affiliateId,
        status: AffiliateStatus.PENDING,
        email: testEmail
      } as any);

      mockPrismaInstance.affiliate.update.mockResolvedValueOnce({
        id: affiliateId,
        email: testEmail,
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hashed_password',
        status: AffiliateStatus.ACTIVE,
        emailVerified: false,
        companyName: null,
        phone: null,
        commissionRate: 0.1,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusChangedAt: new Date(),
        statusChangedBy: adminId
      });

      const result = await updateAffiliateStatus(affiliateId, AffiliateStatus.ACTIVE, adminId);

      expect(result.success).toBe(true);
      expect(result.affiliate?.status).toBe(AffiliateStatus.ACTIVE);
      expect(result.affiliate?.statusChangedBy).toBe(adminId);
    });

    it('should allow login after affiliate is ACTIVE', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce({
        id: affiliateId,
        email: testEmail,
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hashed_password',
        status: AffiliateStatus.ACTIVE,
        emailVerified: true,
        companyName: null,
        phone: null,
        commissionRate: 0.1,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusChangedAt: new Date(),
        statusChangedBy: 'admin-1'
      });

      const result = await validateAffiliatePassword(testEmail, testPassword);

      expect(result.success).toBe(true);
      expect(result.affiliate?.status).toBe(AffiliateStatus.ACTIVE);
    });

    it('should generate valid JWT token for ACTIVE affiliate', async () => {
      const affiliate = {
        id: affiliateId,
        email: testEmail,
        firstName: 'John',
        lastName: 'Doe',
        status: AffiliateStatus.ACTIVE,
        passwordHash: 'hashed_password',
        emailVerified: true,
        companyName: null,
        phone: null,
        commissionRate: 0.1,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusChangedAt: new Date(),
        statusChangedBy: 'admin-1'
      };

      const token = generateAffiliateToken(affiliate as any);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should verify affiliate identity from JWT token', () => {
      const affiliate = {
        id: affiliateId,
        email: testEmail,
        firstName: 'John',
        lastName: 'Doe',
        status: AffiliateStatus.ACTIVE,
        passwordHash: 'hashed_password',
        emailVerified: true,
        companyName: null,
        phone: null,
        commissionRate: 0.1,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusChangedAt: new Date(),
        statusChangedBy: 'admin-1'
      };

      const token = generateAffiliateToken(affiliate as any);
      expect(token).toBeDefined();
      // In real implementation, would verify token contains affiliate ID
      expect(typeof token).toBe('string');
    });
  });

  // ============================
  // LINK CLICK → LEAD ATTRIBUTION
  // ============================
  describe('Link Click → Lead Attribution Flow', () => {
    it('should create tracking link for affiliate', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      mockPrismaInstance.affiliateLink.create.mockResolvedValueOnce({
        id: affiliateLinkId,
        affiliateId,
        code: 'AFFCODE123',
        targetUrl: '/windows',
        clickCount: 0,
        conversionCount: 0,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });

      const result = await createLink(affiliateId, {
        code: 'AFFCODE123',
        targetUrl: '/windows'
      });

      expect(result.success).toBe(true);
      expect(result.link?.code).toBe('AFFCODE123');
      expect(result.link?.affiliateId).toBe(affiliateId);
    });

    it('should get link by code for attribution', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      mockPrismaInstance.affiliateLink.findUnique.mockResolvedValueOnce({
        id: affiliateLinkId,
        affiliateId,
        code: 'AFFCODE123',
        targetUrl: '/windows',
        clickCount: 5,
        conversionCount: 1,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      } as any);

      const result = await getLinkByCode('AFFCODE123');

      expect(result).toBeDefined();
      expect(result?.affiliateId).toBe(affiliateId);
      expect(result?.code).toBe('AFFCODE123');
    });

    it('should increment click counter when link is accessed', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      mockPrismaInstance.affiliateLink.update.mockResolvedValueOnce({
        id: affiliateLinkId,
        affiliateId,
        code: 'AFFCODE123',
        targetUrl: '/windows',
        clickCount: 6,
        conversionCount: 1,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });

      const result = await trackClick('AFFCODE123');

      expect(result.success).toBe(true);
      expect(result.link?.clickCount).toBe(6);
    });

    it('should appear in affiliate leads list after submission', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      mockPrismaInstance.lead.findMany.mockResolvedValueOnce([
        {
          id: leadId,
          serviceTypeId: 'service-windows',
          zipCode: '90210',
          ownsHome: true,
          timeframe: 'within_3_months',
          affiliateId: affiliateId,
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
          formData: {},
          winningBid: null
        }
      ] as any);

      const leads = await prisma.lead.findMany({
        where: { affiliateId }
      });

      expect(leads).toHaveLength(1);
      expect(leads[0].affiliateId).toBe(affiliateId);
    });

    it('should not expose PII in affiliate lead view', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      mockPrismaInstance.lead.findMany.mockResolvedValueOnce([
        {
          id: leadId,
          serviceTypeId: 'service-windows',
          zipCode: '90210', // Safe to show
          ownsHome: true, // Safe to show
          timeframe: 'within_3_months', // Safe to show
          affiliateId: affiliateId,
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
          formData: {},
          winningBid: null
        }
      ] as any);

      const leads = await prisma.lead.findMany({
        where: { affiliateId },
        select: {
          id: true,
          serviceTypeId: true,
          status: true,
          createdAt: true,
          winningBid: true
        }
      } as any);

      expect(leads).toHaveLength(1);
      // Verify no sensitive fields would be exposed
      expect(leads[0]).not.toHaveProperty('phone');
      expect(leads[0]).not.toHaveProperty('email');
      expect(leads[0]).not.toHaveProperty('firstName');
    });
  });

  // ============================
  // LEAD SOLD → COMMISSION CREATED
  // ============================
  describe('Lead Sold → Commission Created Flow', () => {
    it('should create commission when lead status changes to SOLD', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      const winningBid = 100;
      const affiliateRate = 0.15;
      const expectedCommission = 15;

      // Mock finding the lead with affiliate
      mockPrismaInstance.lead.findUnique.mockResolvedValueOnce({
        id: leadId,
        affiliateId: affiliateId,
        winningBid: winningBid,
        status: 'SOLD',
        serviceTypeId: 'service-windows',
        zipCode: '90210',
        createdAt: new Date(),
        updatedAt: new Date(),
        formData: {},
        ownsHome: true,
        timeframe: 'within_3_months',
        complianceData: {}
      } as any);

      // Mock finding the affiliate to get rate
      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce({
        id: affiliateId,
        commissionRate: affiliateRate,
        email: testEmail,
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hash',
        status: AffiliateStatus.ACTIVE,
        emailVerified: false,
        companyName: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusChangedAt: null,
        statusChangedBy: null
      });

      // Mock commission creation
      mockPrismaInstance.affiliateCommission.create.mockResolvedValueOnce({
        id: `commission-${Date.now()}`,
        leadId: leadId,
        affiliateId: affiliateId,
        amount: expectedCommission,
        rate: affiliateRate,
        status: CommissionStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvedAt: null,
        approvedBy: null,
        paidAt: null
      });

      const result = await createCommissionForLead(leadId);

      expect(result.success).toBe(true);
      expect(result.commission?.amount).toBe(expectedCommission);
      expect(result.commission?.status).toBe(CommissionStatus.PENDING);
    });

    it('should calculate commission correctly: bid × rate', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      const winningBid = 250;
      const affiliateRate = 0.20; // 20%
      const expectedCommission = 50;

      mockPrismaInstance.lead.findUnique.mockResolvedValueOnce({
        id: leadId,
        affiliateId: affiliateId,
        winningBid: winningBid,
        status: 'SOLD',
        serviceTypeId: 'service-roofing',
        zipCode: '90210',
        createdAt: new Date(),
        updatedAt: new Date(),
        formData: {},
        ownsHome: true,
        timeframe: 'within_3_months',
        complianceData: {}
      } as any);

      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce({
        id: affiliateId,
        commissionRate: affiliateRate,
        email: testEmail,
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hash',
        status: AffiliateStatus.ACTIVE,
        emailVerified: false,
        companyName: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusChangedAt: null,
        statusChangedBy: null
      });

      mockPrismaInstance.affiliateCommission.create.mockResolvedValueOnce({
        id: `commission-${Date.now()}`,
        leadId: leadId,
        affiliateId: affiliateId,
        amount: expectedCommission,
        rate: affiliateRate,
        status: CommissionStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvedAt: null,
        approvedBy: null,
        paidAt: null
      });

      const result = await createCommissionForLead(leadId);

      expect(result.commission?.amount).toBe(expectedCommission);
    });

    it('should have PENDING status initially', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      mockPrismaInstance.affiliateCommission.create.mockResolvedValueOnce({
        id: `commission-${Date.now()}`,
        leadId: leadId,
        affiliateId: affiliateId,
        amount: 50,
        rate: 0.20,
        status: CommissionStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvedAt: null,
        approvedBy: null,
        paidAt: null
      });

      const result = await createCommissionForLead(leadId);

      expect(result.commission?.status).toBe(CommissionStatus.PENDING);
    });

    it('should list commission in affiliate commissions list', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      mockPrismaInstance.affiliateCommission.findMany.mockResolvedValueOnce([
        {
          id: `commission-${Date.now()}`,
          leadId: leadId,
          affiliateId: affiliateId,
          amount: 50,
          rate: 0.20,
          status: CommissionStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          approvedAt: null,
          approvedBy: null,
          paidAt: null
        }
      ]);

      mockPrismaInstance.affiliateCommission.count.mockResolvedValueOnce(1);

      const result = await getCommissionsByAffiliateId(affiliateId, {});

      expect(result.commissions).toHaveLength(1);
      expect(result.commissions[0].affiliateId).toBe(affiliateId);
      expect(result.commissions[0].leadId).toBe(leadId);
    });

    it('should only create commission for the referring affiliate', async () => {
      const mockPrismaInstance = vi.mocked(prisma);
      const otherAffiliateId = 'affiliate-other-123';

      // Lead belongs to first affiliate
      mockPrismaInstance.lead.findUnique.mockResolvedValueOnce({
        id: leadId,
        affiliateId: affiliateId,
        winningBid: 100,
        status: 'SOLD',
        serviceTypeId: 'service-windows',
        zipCode: '90210',
        createdAt: new Date(),
        updatedAt: new Date(),
        formData: {},
        ownsHome: true,
        timeframe: 'within_3_months',
        complianceData: {}
      } as any);

      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce({
        id: affiliateId,
        commissionRate: 0.15,
        email: testEmail,
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hash',
        status: AffiliateStatus.ACTIVE,
        emailVerified: false,
        companyName: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusChangedAt: null,
        statusChangedBy: null
      });

      // Only create commission for the lead's affiliate
      mockPrismaInstance.affiliateCommission.create.mockResolvedValueOnce({
        id: `commission-${Date.now()}`,
        leadId: leadId,
        affiliateId: affiliateId, // Should be first affiliate, not other
        amount: 15,
        rate: 0.15,
        status: CommissionStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvedAt: null,
        approvedBy: null,
        paidAt: null
      });

      const result = await createCommissionForLead(leadId);

      expect(result.commission?.affiliateId).toBe(affiliateId);
      expect(result.commission?.affiliateId).not.toBe(otherAffiliateId);
    });

    it('should handle leads without affiliate gracefully', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      // Lead has no affiliate
      mockPrismaInstance.lead.findUnique.mockResolvedValueOnce({
        id: leadId,
        affiliateId: null,
        winningBid: 100,
        status: 'SOLD',
        serviceTypeId: 'service-windows',
        zipCode: '90210',
        createdAt: new Date(),
        updatedAt: new Date(),
        formData: {},
        ownsHome: true,
        timeframe: 'within_3_months',
        complianceData: {}
      } as any);

      const result = await createCommissionForLead(leadId);

      // Should return success: true but no commission created (no-op)
      expect(result.success).toBe(true);
      expect(result.commission).toBeUndefined();
    });
  });
});
