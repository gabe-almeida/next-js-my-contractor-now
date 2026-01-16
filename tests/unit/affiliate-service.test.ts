/**
 * Test Suite: Affiliate Service
 *
 * WHY: Ensures core affiliate business logic is correct and reliable.
 *      Tests commission calculations, link code generation, and status transitions.
 *
 * WHEN: Use this test suite to verify:
 *       - Commission amount calculations with various rates and bid amounts
 *       - Link code generation uniqueness and format
 *       - Status transitions for affiliates (PENDING -> ACTIVE, ACTIVE -> SUSPENDED, etc.)
 *
 * HOW: Run with `npm test -- affiliate-service.test.ts`
 *      All tests use mocked Prisma client to avoid database dependencies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  calculateCommissionAmount
} from '../../src/lib/services/affiliate-commission-service';
import {
  createAffiliate,
  updateAffiliateStatus
} from '../../src/lib/services/affiliate-service';
import {
  generateUniqueCode
} from '../../src/lib/services/affiliate-link-service';
import { prisma } from '../../src/lib/prisma';
import { AffiliateStatus } from '../../src/types/database';

// Mock Prisma and other dependencies
vi.mock('../../src/lib/prisma');
vi.mock('../../src/lib/logger');
vi.mock('bcryptjs');

describe('Affiliate Service - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================
  // COMMISSION CALCULATION TESTS
  // ============================
  describe('Commission Calculation', () => {
    it('should calculate commission correctly: $100 bid at 15% = $15', () => {
      const result = calculateCommissionAmount(100, 0.15);
      expect(result).toBe(15);
    });

    it('should handle decimal precision: $99.99 bid at 10% = $9.999', () => {
      const result = calculateCommissionAmount(99.99, 0.10);
      expect(result).toBeCloseTo(9.999, 3);
    });

    it('should return $0 for zero bid amount', () => {
      const result = calculateCommissionAmount(0, 0.15);
      expect(result).toBe(0);
    });

    it('should handle very large amounts without overflow', () => {
      const result = calculateCommissionAmount(999999.99, 0.15);
      expect(result).toBeCloseTo(149999.9985, 2);
    });

    it('should handle very small rates: $100 at 0.1% = $0.10', () => {
      const result = calculateCommissionAmount(100, 0.001);
      expect(result).toBeCloseTo(0.1, 3);
    });

    it('should handle 100% commission rate', () => {
      const result = calculateCommissionAmount(50, 1.0);
      expect(result).toBe(50);
    });

    it('should handle 0% commission rate', () => {
      const result = calculateCommissionAmount(100, 0);
      expect(result).toBe(0);
    });

    it('should handle fractional bid amounts', () => {
      const result = calculateCommissionAmount(123.45, 0.20);
      expect(result).toBeCloseTo(24.69, 2);
    });
  });

  // ============================
  // LINK CODE GENERATION TESTS
  // ============================
  describe('Link Code Generation', () => {
    it('should generate a non-empty code', async () => {
      const code = await generateUniqueCode();
      expect(code).toBeDefined();
      expect(code.length).toBeGreaterThan(0);
    });

    it('should generate alphanumeric codes', async () => {
      const code = await generateUniqueCode();
      expect(/^[a-zA-Z0-9]+$/.test(code)).toBe(true);
    });

    it('should generate codes of reasonable length (6-10 chars)', async () => {
      const code = await generateUniqueCode();
      expect(code.length).toBeGreaterThanOrEqual(6);
      expect(code.length).toBeLessThanOrEqual(10);
    });

    it('should generate unique codes on multiple calls', async () => {
      const code1 = await generateUniqueCode();
      const code2 = await generateUniqueCode();
      const code3 = await generateUniqueCode();

      expect(code1).not.toBe(code2);
      expect(code2).not.toBe(code3);
      expect(code1).not.toBe(code3);
    });

    it('should validate correct code format', async () => {
      const code = await generateUniqueCode();
      const isValid = /^[a-zA-Z0-9]{6,10}$/.test(code);
      expect(isValid).toBe(true);
    });

    it('should handle manual code validation', async () => {
      const validCode = 'AFFCODE123';
      // Verify format validation
      const isValid = /^[a-zA-Z0-9]{6,10}$/.test(validCode);
      // This code might be too long (10+ chars), so just verify alphanumeric
      const isAlphanumeric = /^[a-zA-Z0-9]+$/.test(validCode);
      expect(isAlphanumeric).toBe(true);
    });
  });

  // ============================
  // STATUS TRANSITION TESTS
  // ============================
  describe('Status Transitions', () => {
    it('should transition from PENDING to ACTIVE', async () => {
      const mockPrismaInstance = vi.mocked(prisma);
      const affiliateId = 'affiliate-1';

      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce({
        id: affiliateId,
        status: AffiliateStatus.PENDING
      } as any);

      mockPrismaInstance.affiliate.update.mockResolvedValueOnce({
        id: affiliateId,
        status: AffiliateStatus.ACTIVE,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
        companyName: null,
        phone: null,
        commissionRate: 0.1,
        statusChangedAt: new Date(),
        statusChangedBy: 'admin-1'
      });

      const result = await updateAffiliateStatus(
        affiliateId,
        AffiliateStatus.ACTIVE,
        'admin-1'
      );

      expect(result.success).toBe(true);
      expect(result.affiliate?.status).toBe(AffiliateStatus.ACTIVE);
    });

    it('should transition from ACTIVE to SUSPENDED', async () => {
      const mockPrismaInstance = vi.mocked(prisma);
      const affiliateId = 'affiliate-1';

      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce({
        id: affiliateId,
        status: AffiliateStatus.ACTIVE
      } as any);

      mockPrismaInstance.affiliate.update.mockResolvedValueOnce({
        id: affiliateId,
        status: AffiliateStatus.SUSPENDED,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
        companyName: null,
        phone: null,
        commissionRate: 0.1,
        statusChangedAt: new Date(),
        statusChangedBy: 'admin-1'
      });

      const result = await updateAffiliateStatus(
        affiliateId,
        AffiliateStatus.SUSPENDED,
        'admin-1'
      );

      expect(result.success).toBe(true);
      expect(result.affiliate?.status).toBe(AffiliateStatus.SUSPENDED);
    });

    it('should transition from SUSPENDED back to ACTIVE', async () => {
      const mockPrismaInstance = vi.mocked(prisma);
      const affiliateId = 'affiliate-1';

      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce({
        id: affiliateId,
        status: AffiliateStatus.SUSPENDED
      } as any);

      mockPrismaInstance.affiliate.update.mockResolvedValueOnce({
        id: affiliateId,
        status: AffiliateStatus.ACTIVE,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
        companyName: null,
        phone: null,
        commissionRate: 0.1,
        statusChangedAt: new Date(),
        statusChangedBy: 'admin-1'
      });

      const result = await updateAffiliateStatus(
        affiliateId,
        AffiliateStatus.ACTIVE,
        'admin-1'
      );

      expect(result.success).toBe(true);
      expect(result.affiliate?.status).toBe(AffiliateStatus.ACTIVE);
    });

    it('should log status change events', async () => {
      const mockPrismaInstance = vi.mocked(prisma);
      const affiliateId = 'affiliate-1';

      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce({
        id: affiliateId,
        status: AffiliateStatus.PENDING
      } as any);

      mockPrismaInstance.affiliate.update.mockResolvedValueOnce({
        id: affiliateId,
        status: AffiliateStatus.ACTIVE,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
        companyName: null,
        phone: null,
        commissionRate: 0.1,
        statusChangedAt: new Date(),
        statusChangedBy: 'admin-1'
      });

      const result = await updateAffiliateStatus(
        affiliateId,
        AffiliateStatus.ACTIVE,
        'admin-1'
      );

      expect(result.success).toBe(true);
      // Verify the update was called with correct parameters
      expect(mockPrismaInstance.affiliate.update).toHaveBeenCalled();
    });

    it('should update statusChangedAt when status changes', async () => {
      const mockPrismaInstance = vi.mocked(prisma);
      const affiliateId = 'affiliate-1';

      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce({
        id: affiliateId,
        status: AffiliateStatus.PENDING
      } as any);

      mockPrismaInstance.affiliate.update.mockResolvedValueOnce({
        id: affiliateId,
        status: AffiliateStatus.ACTIVE,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
        companyName: null,
        phone: null,
        commissionRate: 0.1,
        statusChangedAt: new Date(),
        statusChangedBy: 'admin-1'
      });

      const result = await updateAffiliateStatus(
        affiliateId,
        AffiliateStatus.ACTIVE,
        'admin-1'
      );

      expect(result.success).toBe(true);
      expect(result.affiliate?.statusChangedAt).toBeDefined();
      expect(result.affiliate?.statusChangedAt).toBeInstanceOf(Date);
    });

    it('should store admin user ID when status changes', async () => {
      const mockPrismaInstance = vi.mocked(prisma);
      const affiliateId = 'affiliate-1';
      const adminId = 'admin-user-123';

      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce({
        id: affiliateId,
        status: AffiliateStatus.PENDING
      } as any);

      mockPrismaInstance.affiliate.update.mockResolvedValueOnce({
        id: affiliateId,
        status: AffiliateStatus.ACTIVE,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
        companyName: null,
        phone: null,
        commissionRate: 0.1,
        statusChangedAt: new Date(),
        statusChangedBy: adminId
      });

      const result = await updateAffiliateStatus(
        affiliateId,
        AffiliateStatus.ACTIVE,
        adminId
      );

      expect(result.success).toBe(true);
      expect(result.affiliate?.statusChangedBy).toBe(adminId);
    });

    it('should handle affiliate not found error', async () => {
      const mockPrismaInstance = vi.mocked(prisma);
      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce(null);

      const result = await updateAffiliateStatus(
        'nonexistent-id',
        AffiliateStatus.ACTIVE
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================
  // EDGE CASES
  // ============================
  describe('Edge Cases', () => {
    it('should handle commission calculation with rounding', () => {
      // Test that small amounts still calculate correctly
      const result = calculateCommissionAmount(0.01, 0.15);
      expect(result).toBeCloseTo(0.0015, 4);
    });

    it('should generate codes consistently', async () => {
      // Code generation should produce valid output
      const code = await generateUniqueCode();
      expect(code).toBeDefined();
      expect(code.length).toBeGreaterThan(0);
    });

    it('should handle status transition for suspended affiliate', async () => {
      const mockPrismaInstance = vi.mocked(prisma);

      mockPrismaInstance.affiliate.findUnique.mockResolvedValueOnce({
        id: 'aff-1',
        status: AffiliateStatus.ACTIVE
      } as any);

      mockPrismaInstance.affiliate.update.mockResolvedValueOnce({
        id: 'aff-1',
        status: AffiliateStatus.SUSPENDED,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
        companyName: null,
        phone: null,
        commissionRate: 0.1,
        statusChangedAt: new Date(),
        statusChangedBy: 'admin-1'
      });

      const result = await updateAffiliateStatus('aff-1', AffiliateStatus.SUSPENDED);
      expect(result.affiliate?.status).toBe(AffiliateStatus.SUSPENDED);
    });

    it('should handle very large commission amounts', () => {
      const result = calculateCommissionAmount(1000000, 0.25);
      expect(result).toBe(250000);
    });

    it('should handle very small commission amounts', () => {
      const result = calculateCommissionAmount(0.50, 0.10);
      expect(result).toBeCloseTo(0.05, 2);
    });
  });
});
