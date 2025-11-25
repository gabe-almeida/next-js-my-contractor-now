/**
 * Unit Tests for Buyer Service Zip Mapping Model
 * Tests core model functionality, validation, and business logic
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  mockBuyers,
  mockServiceTypes,
  mockBuyerServiceConfigs,
  mockServiceZipMappings,
  BuyerServiceZipMapping,
  mockDatabaseOperations
} from '@/tests/fixtures/buyerServiceZipMappingData';

// Mock Prisma client
const mockPrisma = {
  buyerServiceZipMapping: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  },
  buyer: {
    findUnique: jest.fn()
  },
  serviceType: {
    findUnique: jest.fn()
  }
};

// Mock validation functions
const validateZipCode = (zipCode: string): boolean => {
  return /^\d{5}(-\d{4})?$/.test(zipCode);
};

const validateZipCodeArray = (zipCodes: string[]): boolean => {
  return zipCodes.every(validateZipCode) && zipCodes.length > 0;
};

// Service Zip Mapping Model Class
class BuyerServiceZipMappingModel {
  constructor(private prisma: any) {}

  async create(data: {
    buyerId: string;
    serviceTypeId: string;
    zipCodes: string[];
    priority?: number;
  }): Promise<BuyerServiceZipMapping> {
    // Validation
    if (!data.buyerId || !data.serviceTypeId) {
      throw new Error('buyerId and serviceTypeId are required');
    }

    if (!validateZipCodeArray(data.zipCodes)) {
      throw new Error('Invalid zip codes provided');
    }

    // Check for duplicates
    const existing = await this.findByBuyerAndService(data.buyerId, data.serviceTypeId);
    if (existing) {
      throw new Error('Mapping already exists for this buyer and service type');
    }

    // Verify buyer and service exist
    const buyer = await this.prisma.buyer.findUnique({ where: { id: data.buyerId } });
    if (!buyer) {
      throw new Error('Buyer not found');
    }

    const service = await this.prisma.serviceType.findUnique({ where: { id: data.serviceTypeId } });
    if (!service) {
      throw new Error('Service type not found');
    }

    const mapping = {
      id: `mapping-${Date.now()}`,
      buyerId: data.buyerId,
      serviceTypeId: data.serviceTypeId,
      zipCodes: [...new Set(data.zipCodes)], // Remove duplicates
      active: true,
      priority: data.priority || 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.prisma.buyerServiceZipMapping.create({ data: mapping });
    return mapping;
  }

  async findByBuyerAndService(buyerId: string, serviceTypeId: string): Promise<BuyerServiceZipMapping | null> {
    return this.prisma.buyerServiceZipMapping.findUnique({
      where: {
        buyerId_serviceTypeId: {
          buyerId,
          serviceTypeId
        }
      }
    });
  }

  async findBuyersForServiceAndZip(serviceTypeId: string, zipCode: string): Promise<{
    buyerId: string;
    priority: number;
  }[]> {
    if (!validateZipCode(zipCode)) {
      throw new Error('Invalid zip code format');
    }

    const mappings = await this.prisma.buyerServiceZipMapping.findMany({
      where: {
        serviceTypeId,
        active: true,
        zipCodes: {
          has: zipCode
        }
      },
      select: {
        buyerId: true,
        priority: true
      },
      orderBy: {
        priority: 'asc'
      }
    });

    return mappings;
  }

  async updateZipCodes(mappingId: string, zipCodes: string[]): Promise<BuyerServiceZipMapping> {
    if (!validateZipCodeArray(zipCodes)) {
      throw new Error('Invalid zip codes provided');
    }

    const mapping = await this.prisma.buyerServiceZipMapping.update({
      where: { id: mappingId },
      data: {
        zipCodes: [...new Set(zipCodes)], // Remove duplicates
        updatedAt: new Date()
      }
    });

    return mapping;
  }

  async addZipCodes(mappingId: string, newZipCodes: string[]): Promise<BuyerServiceZipMapping> {
    if (!validateZipCodeArray(newZipCodes)) {
      throw new Error('Invalid zip codes provided');
    }

    const existing = await this.prisma.buyerServiceZipMapping.findUnique({
      where: { id: mappingId }
    });

    if (!existing) {
      throw new Error('Mapping not found');
    }

    const combinedZipCodes = [...new Set([...existing.zipCodes, ...newZipCodes])];
    
    return this.updateZipCodes(mappingId, combinedZipCodes);
  }

  async removeZipCodes(mappingId: string, zipCodesToRemove: string[]): Promise<BuyerServiceZipMapping> {
    const existing = await this.prisma.buyerServiceZipMapping.findUnique({
      where: { id: mappingId }
    });

    if (!existing) {
      throw new Error('Mapping not found');
    }

    const filteredZipCodes = existing.zipCodes.filter(zip => !zipCodesToRemove.includes(zip));
    
    if (filteredZipCodes.length === 0) {
      throw new Error('Cannot remove all zip codes from mapping');
    }

    return this.updateZipCodes(mappingId, filteredZipCodes);
  }

  async setBuyerPriority(mappingId: string, priority: number): Promise<BuyerServiceZipMapping> {
    if (priority < 1 || priority > 10) {
      throw new Error('Priority must be between 1 and 10');
    }

    const mapping = await this.prisma.buyerServiceZipMapping.update({
      where: { id: mappingId },
      data: {
        priority,
        updatedAt: new Date()
      }
    });

    return mapping;
  }

  async toggleActive(mappingId: string): Promise<BuyerServiceZipMapping> {
    const existing = await this.prisma.buyerServiceZipMapping.findUnique({
      where: { id: mappingId }
    });

    if (!existing) {
      throw new Error('Mapping not found');
    }

    const mapping = await this.prisma.buyerServiceZipMapping.update({
      where: { id: mappingId },
      data: {
        active: !existing.active,
        updatedAt: new Date()
      }
    });

    return mapping;
  }

  async getStats(buyerId?: string): Promise<{
    totalMappings: number;
    activeMappings: number;
    totalZipCodes: number;
    serviceCount: number;
  }> {
    const whereClause = buyerId ? { buyerId } : {};

    const [total, active, mappings] = await Promise.all([
      this.prisma.buyerServiceZipMapping.count({ where: whereClause }),
      this.prisma.buyerServiceZipMapping.count({ 
        where: { ...whereClause, active: true } 
      }),
      this.prisma.buyerServiceZipMapping.findMany({
        where: whereClause,
        select: {
          zipCodes: true,
          serviceTypeId: true
        }
      })
    ]);

    const allZipCodes = new Set<string>();
    const services = new Set<string>();

    mappings.forEach(mapping => {
      mapping.zipCodes.forEach(zip => allZipCodes.add(zip));
      services.add(mapping.serviceTypeId);
    });

    return {
      totalMappings: total,
      activeMappings: active,
      totalZipCodes: allZipCodes.size,
      serviceCount: services.size
    };
  }
}

describe('BuyerServiceZipMapping Model', () => {
  let model: BuyerServiceZipMappingModel;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new BuyerServiceZipMappingModel(mockPrisma);
  });

  describe('Validation', () => {
    it('should validate zip codes correctly', () => {
      expect(validateZipCode('90210')).toBe(true);
      expect(validateZipCode('90210-1234')).toBe(true);
      expect(validateZipCode('9021')).toBe(false);
      expect(validateZipCode('902101')).toBe(false);
      expect(validateZipCode('abcde')).toBe(false);
      expect(validateZipCode('90210-abc')).toBe(false);
    });

    it('should validate zip code arrays', () => {
      expect(validateZipCodeArray(['90210', '10001'])).toBe(true);
      expect(validateZipCodeArray(['90210-1234', '10001-5678'])).toBe(true);
      expect(validateZipCodeArray([])).toBe(false);
      expect(validateZipCodeArray(['90210', 'invalid'])).toBe(false);
    });
  });

  describe('create', () => {
    beforeEach(() => {
      mockPrisma.buyer.findUnique.mockResolvedValue(mockBuyers[0]);
      mockPrisma.serviceType.findUnique.mockResolvedValue(mockServiceTypes[0]);
      mockPrisma.buyerServiceZipMapping.findUnique.mockResolvedValue(null);
      mockPrisma.buyerServiceZipMapping.create.mockResolvedValue({});
    });

    it('should create a new mapping successfully', async () => {
      const data = {
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: ['90210', '10001']
      };

      const result = await model.create(data);

      expect(result).toMatchObject({
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: ['90210', '10001'],
        active: true,
        priority: 1
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should remove duplicate zip codes', async () => {
      const data = {
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: ['90210', '10001', '90210'] // Duplicate
      };

      const result = await model.create(data);
      expect(result.zipCodes).toEqual(['90210', '10001']);
    });

    it('should set default priority to 1', async () => {
      const data = {
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: ['90210']
      };

      const result = await model.create(data);
      expect(result.priority).toBe(1);
    });

    it('should use provided priority', async () => {
      const data = {
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: ['90210'],
        priority: 5
      };

      const result = await model.create(data);
      expect(result.priority).toBe(5);
    });

    it('should throw error for missing required fields', async () => {
      const data = {
        buyerId: '',
        serviceTypeId: 'service-1',
        zipCodes: ['90210']
      };

      await expect(model.create(data)).rejects.toThrow('buyerId and serviceTypeId are required');
    });

    it('should throw error for invalid zip codes', async () => {
      const data = {
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: ['invalid-zip']
      };

      await expect(model.create(data)).rejects.toThrow('Invalid zip codes provided');
    });

    it('should throw error for empty zip codes array', async () => {
      const data = {
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: []
      };

      await expect(model.create(data)).rejects.toThrow('Invalid zip codes provided');
    });

    it('should throw error for non-existent buyer', async () => {
      mockPrisma.buyer.findUnique.mockResolvedValue(null);

      const data = {
        buyerId: 'non-existent',
        serviceTypeId: 'service-1',
        zipCodes: ['90210']
      };

      await expect(model.create(data)).rejects.toThrow('Buyer not found');
    });

    it('should throw error for non-existent service type', async () => {
      mockPrisma.serviceType.findUnique.mockResolvedValue(null);

      const data = {
        buyerId: 'buyer-1',
        serviceTypeId: 'non-existent',
        zipCodes: ['90210']
      };

      await expect(model.create(data)).rejects.toThrow('Service type not found');
    });

    it('should throw error for duplicate mapping', async () => {
      mockPrisma.buyerServiceZipMapping.findUnique.mockResolvedValue(mockServiceZipMappings[0]);

      const data = {
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: ['90210']
      };

      await expect(model.create(data)).rejects.toThrow('Mapping already exists for this buyer and service type');
    });
  });

  describe('findBuyersForServiceAndZip', () => {
    beforeEach(() => {
      mockPrisma.buyerServiceZipMapping.findMany.mockResolvedValue([
        { buyerId: 'buyer-1', priority: 1 },
        { buyerId: 'buyer-2', priority: 2 },
        { buyerId: 'buyer-3', priority: 3 }
      ]);
    });

    it('should find buyers for service and zip code', async () => {
      const result = await model.findBuyersForServiceAndZip('service-1', '90210');

      expect(result).toEqual([
        { buyerId: 'buyer-1', priority: 1 },
        { buyerId: 'buyer-2', priority: 2 },
        { buyerId: 'buyer-3', priority: 3 }
      ]);

      expect(mockPrisma.buyerServiceZipMapping.findMany).toHaveBeenCalledWith({
        where: {
          serviceTypeId: 'service-1',
          active: true,
          zipCodes: {
            has: '90210'
          }
        },
        select: {
          buyerId: true,
          priority: true
        },
        orderBy: {
          priority: 'asc'
        }
      });
    });

    it('should throw error for invalid zip code', async () => {
      await expect(model.findBuyersForServiceAndZip('service-1', 'invalid'))
        .rejects.toThrow('Invalid zip code format');
    });

    it('should return empty array when no buyers found', async () => {
      mockPrisma.buyerServiceZipMapping.findMany.mockResolvedValue([]);

      const result = await model.findBuyersForServiceAndZip('service-1', '99999');
      expect(result).toEqual([]);
    });
  });

  describe('updateZipCodes', () => {
    beforeEach(() => {
      mockPrisma.buyerServiceZipMapping.update.mockResolvedValue({
        id: 'mapping-1',
        zipCodes: ['90210', '10001'],
        updatedAt: new Date()
      });
    });

    it('should update zip codes successfully', async () => {
      const result = await model.updateZipCodes('mapping-1', ['90210', '10001']);

      expect(result.zipCodes).toEqual(['90210', '10001']);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should remove duplicate zip codes during update', async () => {
      const result = await model.updateZipCodes('mapping-1', ['90210', '10001', '90210']);

      expect(mockPrisma.buyerServiceZipMapping.update).toHaveBeenCalledWith({
        where: { id: 'mapping-1' },
        data: {
          zipCodes: ['90210', '10001'],
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should throw error for invalid zip codes', async () => {
      await expect(model.updateZipCodes('mapping-1', ['invalid-zip']))
        .rejects.toThrow('Invalid zip codes provided');
    });
  });

  describe('addZipCodes', () => {
    beforeEach(() => {
      mockPrisma.buyerServiceZipMapping.findUnique.mockResolvedValue({
        id: 'mapping-1',
        zipCodes: ['90210']
      });
      mockPrisma.buyerServiceZipMapping.update.mockResolvedValue({
        id: 'mapping-1',
        zipCodes: ['90210', '10001']
      });
    });

    it('should add new zip codes to existing mapping', async () => {
      const result = await model.addZipCodes('mapping-1', ['10001']);

      expect(mockPrisma.buyerServiceZipMapping.update).toHaveBeenCalledWith({
        where: { id: 'mapping-1' },
        data: {
          zipCodes: ['90210', '10001'],
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should not add duplicate zip codes', async () => {
      const result = await model.addZipCodes('mapping-1', ['90210', '10001']);

      expect(mockPrisma.buyerServiceZipMapping.update).toHaveBeenCalledWith({
        where: { id: 'mapping-1' },
        data: {
          zipCodes: ['90210', '10001'], // No duplicates
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should throw error for non-existent mapping', async () => {
      mockPrisma.buyerServiceZipMapping.findUnique.mockResolvedValue(null);

      await expect(model.addZipCodes('non-existent', ['10001']))
        .rejects.toThrow('Mapping not found');
    });
  });

  describe('removeZipCodes', () => {
    beforeEach(() => {
      mockPrisma.buyerServiceZipMapping.findUnique.mockResolvedValue({
        id: 'mapping-1',
        zipCodes: ['90210', '10001', '60601']
      });
      mockPrisma.buyerServiceZipMapping.update.mockResolvedValue({
        id: 'mapping-1',
        zipCodes: ['90210', '60601']
      });
    });

    it('should remove specified zip codes', async () => {
      const result = await model.removeZipCodes('mapping-1', ['10001']);

      expect(mockPrisma.buyerServiceZipMapping.update).toHaveBeenCalledWith({
        where: { id: 'mapping-1' },
        data: {
          zipCodes: ['90210', '60601'],
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should throw error when trying to remove all zip codes', async () => {
      await expect(model.removeZipCodes('mapping-1', ['90210', '10001', '60601']))
        .rejects.toThrow('Cannot remove all zip codes from mapping');
    });

    it('should throw error for non-existent mapping', async () => {
      mockPrisma.buyerServiceZipMapping.findUnique.mockResolvedValue(null);

      await expect(model.removeZipCodes('non-existent', ['10001']))
        .rejects.toThrow('Mapping not found');
    });
  });

  describe('setBuyerPriority', () => {
    beforeEach(() => {
      mockPrisma.buyerServiceZipMapping.update.mockResolvedValue({
        id: 'mapping-1',
        priority: 5,
        updatedAt: new Date()
      });
    });

    it('should update priority successfully', async () => {
      const result = await model.setBuyerPriority('mapping-1', 5);

      expect(result.priority).toBe(5);
      expect(mockPrisma.buyerServiceZipMapping.update).toHaveBeenCalledWith({
        where: { id: 'mapping-1' },
        data: {
          priority: 5,
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should throw error for invalid priority (too low)', async () => {
      await expect(model.setBuyerPriority('mapping-1', 0))
        .rejects.toThrow('Priority must be between 1 and 10');
    });

    it('should throw error for invalid priority (too high)', async () => {
      await expect(model.setBuyerPriority('mapping-1', 11))
        .rejects.toThrow('Priority must be between 1 and 10');
    });
  });

  describe('toggleActive', () => {
    it('should toggle active status from true to false', async () => {
      mockPrisma.buyerServiceZipMapping.findUnique.mockResolvedValue({
        id: 'mapping-1',
        active: true
      });
      mockPrisma.buyerServiceZipMapping.update.mockResolvedValue({
        id: 'mapping-1',
        active: false,
        updatedAt: new Date()
      });

      const result = await model.toggleActive('mapping-1');

      expect(result.active).toBe(false);
      expect(mockPrisma.buyerServiceZipMapping.update).toHaveBeenCalledWith({
        where: { id: 'mapping-1' },
        data: {
          active: false,
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should toggle active status from false to true', async () => {
      mockPrisma.buyerServiceZipMapping.findUnique.mockResolvedValue({
        id: 'mapping-1',
        active: false
      });
      mockPrisma.buyerServiceZipMapping.update.mockResolvedValue({
        id: 'mapping-1',
        active: true,
        updatedAt: new Date()
      });

      const result = await model.toggleActive('mapping-1');

      expect(result.active).toBe(true);
    });

    it('should throw error for non-existent mapping', async () => {
      mockPrisma.buyerServiceZipMapping.findUnique.mockResolvedValue(null);

      await expect(model.toggleActive('non-existent'))
        .rejects.toThrow('Mapping not found');
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      mockPrisma.buyerServiceZipMapping.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8); // active

      mockPrisma.buyerServiceZipMapping.findMany.mockResolvedValue([
        { zipCodes: ['90210', '10001'], serviceTypeId: 'service-1' },
        { zipCodes: ['90210', '60601'], serviceTypeId: 'service-1' },
        { zipCodes: ['98101'], serviceTypeId: 'service-2' }
      ]);
    });

    it('should return stats for all mappings', async () => {
      const result = await model.getStats();

      expect(result).toEqual({
        totalMappings: 10,
        activeMappings: 8,
        totalZipCodes: 4, // Unique zip codes: 90210, 10001, 60601, 98101
        serviceCount: 2 // service-1, service-2
      });
    });

    it('should return stats for specific buyer', async () => {
      const result = await model.getStats('buyer-1');

      expect(mockPrisma.buyerServiceZipMapping.count).toHaveBeenCalledWith({
        where: { buyerId: 'buyer-1' }
      });
      expect(mockPrisma.buyerServiceZipMapping.count).toHaveBeenCalledWith({
        where: { buyerId: 'buyer-1', active: true }
      });
    });
  });
});