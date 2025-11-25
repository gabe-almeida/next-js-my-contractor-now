/**
 * API Integration Tests for Buyer Service Zip Mapping Admin Endpoints
 * Tests CRUD operations and admin functionality for service-zip mappings
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import {
  mockBuyers,
  mockServiceTypes,
  mockBuyerServiceConfigs,
  mockServiceZipMappings,
  performanceTestMappings,
  BuyerServiceZipMapping
} from '@/tests/fixtures/buyerServiceZipMappingData';

// Mock Next.js API route handlers
const mockApiResponse = {
  json: jest.fn(),
  status: jest.fn().mockReturnThis(),
  ok: jest.fn()
};

// Mock database client for API tests
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
    findMany: jest.fn(),
    findUnique: jest.fn()
  },
  serviceType: {
    findMany: jest.fn(),
    findUnique: jest.fn()
  },
  buyerServiceConfig: {
    findMany: jest.fn()
  }
};

// Mock API route handlers
class BuyerServiceZipMappingAPI {
  constructor(private db: any) {}

  // GET /api/admin/buyer-service-zip-mappings
  async GET(request: NextRequest): Promise<Response> {
    try {
      const { searchParams } = new URL(request.url);
      const buyerId = searchParams.get('buyerId');
      const serviceTypeId = searchParams.get('serviceTypeId');
      const zipCode = searchParams.get('zipCode');
      const active = searchParams.get('active');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');

      const where: any = {};
      if (buyerId) where.buyerId = buyerId;
      if (serviceTypeId) where.serviceTypeId = serviceTypeId;
      if (active !== null) where.active = active === 'true';
      if (zipCode) {
        where.zipCodes = { has: zipCode };
      }

      const [mappings, total] = await Promise.all([
        this.db.buyerServiceZipMapping.findMany({
          where,
          include: {
            buyer: true,
            serviceType: true
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [
            { priority: 'asc' },
            { createdAt: 'desc' }
          ]
        }),
        this.db.buyerServiceZipMapping.count({ where })
      ]);

      return Response.json({
        mappings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      return Response.json(
        { error: 'Failed to fetch mappings' },
        { status: 500 }
      );
    }
  }

  // POST /api/admin/buyer-service-zip-mappings
  async POST(request: NextRequest): Promise<Response> {
    try {
      const body = await request.json();
      const { buyerId, serviceTypeId, zipCodes, priority = 1 } = body;

      // Validation
      if (!buyerId || !serviceTypeId || !Array.isArray(zipCodes) || zipCodes.length === 0) {
        return Response.json(
          { error: 'buyerId, serviceTypeId, and zipCodes are required' },
          { status: 400 }
        );
      }

      // Validate ZIP codes
      const invalidZips = zipCodes.filter((zip: string) => !/^\d{5}(-\d{4})?$/.test(zip));
      if (invalidZips.length > 0) {
        return Response.json(
          { error: `Invalid ZIP codes: ${invalidZips.join(', ')}` },
          { status: 400 }
        );
      }

      // Check if buyer and service type exist
      const [buyer, serviceType] = await Promise.all([
        this.db.buyer.findUnique({ where: { id: buyerId } }),
        this.db.serviceType.findUnique({ where: { id: serviceTypeId } })
      ]);

      if (!buyer) {
        return Response.json(
          { error: 'Buyer not found' },
          { status: 404 }
        );
      }

      if (!serviceType) {
        return Response.json(
          { error: 'Service type not found' },
          { status: 404 }
        );
      }

      // Check for existing mapping
      const existingMapping = await this.db.buyerServiceZipMapping.findUnique({
        where: {
          buyerId_serviceTypeId: {
            buyerId,
            serviceTypeId
          }
        }
      });

      if (existingMapping) {
        return Response.json(
          { error: 'Mapping already exists for this buyer and service type' },
          { status: 409 }
        );
      }

      // Create mapping
      const mapping = await this.db.buyerServiceZipMapping.create({
        data: {
          buyerId,
          serviceTypeId,
          zipCodes: [...new Set(zipCodes)], // Remove duplicates
          priority,
          active: true
        },
        include: {
          buyer: true,
          serviceType: true
        }
      });

      return Response.json(mapping, { status: 201 });

    } catch (error) {
      return Response.json(
        { error: 'Failed to create mapping' },
        { status: 500 }
      );
    }
  }

  // PUT /api/admin/buyer-service-zip-mappings/[id]
  async PUT(request: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
    try {
      const { id } = params;
      const body = await request.json();
      const { zipCodes, priority, active } = body;

      const updateData: any = {};
      
      if (zipCodes !== undefined) {
        if (!Array.isArray(zipCodes) || zipCodes.length === 0) {
          return Response.json(
            { error: 'zipCodes must be a non-empty array' },
            { status: 400 }
          );
        }

        const invalidZips = zipCodes.filter((zip: string) => !/^\d{5}(-\d{4})?$/.test(zip));
        if (invalidZips.length > 0) {
          return Response.json(
            { error: `Invalid ZIP codes: ${invalidZips.join(', ')}` },
            { status: 400 }
          );
        }

        updateData.zipCodes = [...new Set(zipCodes)];
      }

      if (priority !== undefined) {
        if (typeof priority !== 'number' || priority < 1 || priority > 10) {
          return Response.json(
            { error: 'Priority must be a number between 1 and 10' },
            { status: 400 }
          );
        }
        updateData.priority = priority;
      }

      if (active !== undefined) {
        if (typeof active !== 'boolean') {
          return Response.json(
            { error: 'Active must be a boolean' },
            { status: 400 }
          );
        }
        updateData.active = active;
      }

      updateData.updatedAt = new Date();

      const mapping = await this.db.buyerServiceZipMapping.update({
        where: { id },
        data: updateData,
        include: {
          buyer: true,
          serviceType: true
        }
      });

      return Response.json(mapping);

    } catch (error) {
      if (error instanceof Error && error.message.includes('Record to update not found')) {
        return Response.json(
          { error: 'Mapping not found' },
          { status: 404 }
        );
      }

      return Response.json(
        { error: 'Failed to update mapping' },
        { status: 500 }
      );
    }
  }

  // DELETE /api/admin/buyer-service-zip-mappings/[id]
  async DELETE(request: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
    try {
      const { id } = params;

      await this.db.buyerServiceZipMapping.delete({
        where: { id }
      });

      return Response.json({ success: true });

    } catch (error) {
      if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
        return Response.json(
          { error: 'Mapping not found' },
          { status: 404 }
        );
      }

      return Response.json(
        { error: 'Failed to delete mapping' },
        { status: 500 }
      );
    }
  }

  // GET /api/admin/buyer-service-zip-mappings/coverage-analysis
  async getCoverageAnalysis(request: NextRequest): Promise<Response> {
    try {
      const { searchParams } = new URL(request.url);
      const serviceTypeId = searchParams.get('serviceTypeId');

      const where: any = { active: true };
      if (serviceTypeId) where.serviceTypeId = serviceTypeId;

      const mappings = await this.db.buyerServiceZipMapping.findMany({
        where,
        include: {
          buyer: true,
          serviceType: true
        }
      });

      // Analyze coverage
      const analysis = this.analyzeCoverage(mappings);

      return Response.json(analysis);

    } catch (error) {
      return Response.json(
        { error: 'Failed to analyze coverage' },
        { status: 500 }
      );
    }
  }

  // GET /api/admin/buyer-service-zip-mappings/conflicts
  async getConflicts(request: NextRequest): Promise<Response> {
    try {
      const mappings = await this.db.buyerServiceZipMapping.findMany({
        where: { active: true },
        include: {
          buyer: true,
          serviceType: true
        }
      });

      const conflicts = this.findConflicts(mappings);

      return Response.json({ conflicts });

    } catch (error) {
      return Response.json(
        { error: 'Failed to find conflicts' },
        { status: 500 }
      );
    }
  }

  // POST /api/admin/buyer-service-zip-mappings/bulk-operations
  async bulkOperations(request: NextRequest): Promise<Response> {
    try {
      const body = await request.json();
      const { operation, mappingIds, updateData } = body;

      if (!operation || !Array.isArray(mappingIds)) {
        return Response.json(
          { error: 'Operation and mappingIds are required' },
          { status: 400 }
        );
      }

      let result;
      switch (operation) {
        case 'activate':
          result = await this.db.buyerServiceZipMapping.updateMany({
            where: { id: { in: mappingIds } },
            data: { active: true, updatedAt: new Date() }
          });
          break;

        case 'deactivate':
          result = await this.db.buyerServiceZipMapping.updateMany({
            where: { id: { in: mappingIds } },
            data: { active: false, updatedAt: new Date() }
          });
          break;

        case 'update-priority':
          if (!updateData?.priority) {
            return Response.json(
              { error: 'Priority is required for update-priority operation' },
              { status: 400 }
            );
          }
          result = await this.db.buyerServiceZipMapping.updateMany({
            where: { id: { in: mappingIds } },
            data: { priority: updateData.priority, updatedAt: new Date() }
          });
          break;

        case 'delete':
          result = await this.db.buyerServiceZipMapping.deleteMany({
            where: { id: { in: mappingIds } }
          });
          break;

        default:
          return Response.json(
            { error: 'Invalid operation' },
            { status: 400 }
          );
      }

      return Response.json({
        success: true,
        affected: result.count || mappingIds.length
      });

    } catch (error) {
      return Response.json(
        { error: 'Bulk operation failed' },
        { status: 500 }
      );
    }
  }

  private analyzeCoverage(mappings: any[]): any {
    const coverageMap = new Map<string, Set<string>>();
    const serviceCoverage = new Map<string, { zipCodes: Set<string>, buyers: Set<string> }>();
    const buyerCoverage = new Map<string, { zipCodes: Set<string>, services: Set<string> }>();

    mappings.forEach(mapping => {
      // Overall coverage by ZIP code
      mapping.zipCodes.forEach((zip: string) => {
        if (!coverageMap.has(zip)) {
          coverageMap.set(zip, new Set());
        }
        coverageMap.get(zip)!.add(mapping.buyerId);
      });

      // Coverage by service type
      if (!serviceCoverage.has(mapping.serviceTypeId)) {
        serviceCoverage.set(mapping.serviceTypeId, {
          zipCodes: new Set(),
          buyers: new Set()
        });
      }
      const serviceData = serviceCoverage.get(mapping.serviceTypeId)!;
      mapping.zipCodes.forEach((zip: string) => serviceData.zipCodes.add(zip));
      serviceData.buyers.add(mapping.buyerId);

      // Coverage by buyer
      if (!buyerCoverage.has(mapping.buyerId)) {
        buyerCoverage.set(mapping.buyerId, {
          zipCodes: new Set(),
          services: new Set()
        });
      }
      const buyerData = buyerCoverage.get(mapping.buyerId)!;
      mapping.zipCodes.forEach((zip: string) => buyerData.zipCodes.add(zip));
      buyerData.services.add(mapping.serviceTypeId);
    });

    // Calculate statistics
    const totalZipCodes = coverageMap.size;
    const averageBuyersPerZip = Array.from(coverageMap.values())
      .reduce((sum, buyers) => sum + buyers.size, 0) / totalZipCodes;

    const zipCodesByBuyerCount = new Map<number, number>();
    coverageMap.forEach(buyers => {
      const count = buyers.size;
      zipCodesByBuyerCount.set(count, (zipCodesByBuyerCount.get(count) || 0) + 1);
    });

    return {
      overview: {
        totalZipCodes,
        totalMappings: mappings.length,
        averageBuyersPerZip: Math.round(averageBuyersPerZip * 100) / 100
      },
      byService: Array.from(serviceCoverage.entries()).map(([serviceId, data]) => ({
        serviceTypeId: serviceId,
        zipCodeCount: data.zipCodes.size,
        buyerCount: data.buyers.size
      })),
      byBuyer: Array.from(buyerCoverage.entries()).map(([buyerId, data]) => ({
        buyerId,
        zipCodeCount: data.zipCodes.size,
        serviceCount: data.services.size
      })),
      distribution: Array.from(zipCodesByBuyerCount.entries()).map(([buyerCount, zipCount]) => ({
        buyersPerZip: buyerCount,
        zipCodesWithThisCount: zipCount
      }))
    };
  }

  private findConflicts(mappings: any[]): any[] {
    const conflicts: any[] = [];
    const zipServiceToBuyers = new Map<string, any[]>();

    // Group by ZIP code and service type
    mappings.forEach(mapping => {
      mapping.zipCodes.forEach((zip: string) => {
        const key = `${zip}:${mapping.serviceTypeId}`;
        if (!zipServiceToBuyers.has(key)) {
          zipServiceToBuyers.set(key, []);
        }
        zipServiceToBuyers.get(key)!.push(mapping);
      });
    });

    // Find conflicts (same priority or validation issues)
    zipServiceToBuyers.forEach((mappingsForZipService, key) => {
      if (mappingsForZipService.length > 1) {
        const [zipCode, serviceTypeId] = key.split(':');
        
        // Priority conflicts
        const priorityGroups = new Map<number, any[]>();
        mappingsForZipService.forEach(mapping => {
          const priority = mapping.priority;
          if (!priorityGroups.has(priority)) {
            priorityGroups.set(priority, []);
          }
          priorityGroups.get(priority)!.push(mapping);
        });

        priorityGroups.forEach((samePrivacyMappings, priority) => {
          if (samePrivacyMappings.length > 1) {
            conflicts.push({
              type: 'priority_conflict',
              zipCode,
              serviceTypeId,
              priority,
              conflictingMappings: samePrivacyMappings.map(m => ({
                id: m.id,
                buyerId: m.buyerId,
                buyerName: m.buyer.name
              }))
            });
          }
        });

        // Coverage overlap analysis
        conflicts.push({
          type: 'coverage_overlap',
          zipCode,
          serviceTypeId,
          buyerCount: mappingsForZipService.length,
          buyers: mappingsForZipService.map(m => ({
            id: m.buyerId,
            name: m.buyer.name,
            priority: m.priority
          })).sort((a, b) => a.priority - b.priority)
        });
      }
    });

    return conflicts;
  }
}

describe('Buyer Service Zip Mapping API', () => {
  let api: BuyerServiceZipMappingAPI;

  beforeAll(async () => {
    // Setup mock database responses
    mockPrisma.buyerServiceZipMapping.findMany.mockResolvedValue(mockServiceZipMappings);
    mockPrisma.buyerServiceZipMapping.count.mockResolvedValue(mockServiceZipMappings.length);
    mockPrisma.buyer.findUnique.mockImplementation(({ where }) => 
      mockBuyers.find(buyer => buyer.id === where.id) || null
    );
    mockPrisma.serviceType.findUnique.mockImplementation(({ where }) =>
      mockServiceTypes.find(service => service.id === where.id) || null
    );

    api = new BuyerServiceZipMappingAPI(mockPrisma);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/buyer-service-zip-mappings', () => {
    it('should fetch all mappings with default pagination', async () => {
      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings');
      const response = await api.GET(request);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.mappings).toBeDefined();
      expect(data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: mockServiceZipMappings.length,
        pages: Math.ceil(mockServiceZipMappings.length / 20)
      });
    });

    it('should filter by buyer ID', async () => {
      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings?buyerId=buyer-1');
      
      mockPrisma.buyerServiceZipMapping.findMany.mockResolvedValue(
        mockServiceZipMappings.filter(m => m.buyerId === 'buyer-1')
      );
      mockPrisma.buyerServiceZipMapping.count.mockResolvedValue(2);

      const response = await api.GET(request);
      const data = await response.json();

      expect(mockPrisma.buyerServiceZipMapping.findMany).toHaveBeenCalledWith({
        where: { buyerId: 'buyer-1' },
        include: { buyer: true, serviceType: true },
        skip: 0,
        take: 20,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
      });
      
      expect(data.mappings.length).toBe(2);
    });

    it('should filter by service type', async () => {
      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings?serviceTypeId=service-1');
      
      const filteredMappings = mockServiceZipMappings.filter(m => m.serviceTypeId === 'service-1');
      mockPrisma.buyerServiceZipMapping.findMany.mockResolvedValue(filteredMappings);
      mockPrisma.buyerServiceZipMapping.count.mockResolvedValue(filteredMappings.length);

      const response = await api.GET(request);
      const data = await response.json();

      expect(mockPrisma.buyerServiceZipMapping.findMany).toHaveBeenCalledWith({
        where: { serviceTypeId: 'service-1' },
        include: { buyer: true, serviceType: true },
        skip: 0,
        take: 20,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
      });
    });

    it('should filter by ZIP code', async () => {
      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings?zipCode=90210');

      const response = await api.GET(request);

      expect(mockPrisma.buyerServiceZipMapping.findMany).toHaveBeenCalledWith({
        where: { zipCodes: { has: '90210' } },
        include: { buyer: true, serviceType: true },
        skip: 0,
        take: 20,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
      });
    });

    it('should filter by active status', async () => {
      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings?active=false');

      const response = await api.GET(request);

      expect(mockPrisma.buyerServiceZipMapping.findMany).toHaveBeenCalledWith({
        where: { active: false },
        include: { buyer: true, serviceType: true },
        skip: 0,
        take: 20,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
      });
    });

    it('should handle pagination correctly', async () => {
      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings?page=2&limit=5');

      const response = await api.GET(request);

      expect(mockPrisma.buyerServiceZipMapping.findMany).toHaveBeenCalledWith({
        where: {},
        include: { buyer: true, serviceType: true },
        skip: 5, // (page 2 - 1) * 5
        take: 5,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
      });
    });

    it('should handle database errors', async () => {
      mockPrisma.buyerServiceZipMapping.findMany.mockRejectedValue(new Error('DB Error'));

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings');
      const response = await api.GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch mappings');
    });
  });

  describe('POST /api/admin/buyer-service-zip-mappings', () => {
    beforeEach(() => {
      mockPrisma.buyerServiceZipMapping.findUnique.mockResolvedValue(null); // No existing mapping
      mockPrisma.buyerServiceZipMapping.create.mockImplementation(({ data }) => 
        Promise.resolve({ id: 'new-mapping', ...data })
      );
    });

    it('should create a new mapping successfully', async () => {
      const requestBody = {
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: ['90210', '10001'],
        priority: 2
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.buyerId).toBe('buyer-1');
      expect(data.serviceTypeId).toBe('service-1');
      expect(data.zipCodes).toEqual(['90210', '10001']);
      expect(data.priority).toBe(2);

      expect(mockPrisma.buyerServiceZipMapping.create).toHaveBeenCalledWith({
        data: {
          buyerId: 'buyer-1',
          serviceTypeId: 'service-1',
          zipCodes: ['90210', '10001'],
          priority: 2,
          active: true
        },
        include: {
          buyer: true,
          serviceType: true
        }
      });
    });

    it('should remove duplicate ZIP codes', async () => {
      const requestBody = {
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: ['90210', '10001', '90210'] // Duplicate
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.POST(request);

      expect(mockPrisma.buyerServiceZipMapping.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          zipCodes: ['90210', '10001'] // Duplicates removed
        }),
        include: {
          buyer: true,
          serviceType: true
        }
      });
    });

    it('should use default priority if not provided', async () => {
      const requestBody = {
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: ['90210']
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.POST(request);

      expect(mockPrisma.buyerServiceZipMapping.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 1
        }),
        include: {
          buyer: true,
          serviceType: true
        }
      });
    });

    it('should validate required fields', async () => {
      const requestBody = {
        buyerId: 'buyer-1',
        // Missing serviceTypeId and zipCodes
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('buyerId, serviceTypeId, and zipCodes are required');
    });

    it('should validate ZIP code format', async () => {
      const requestBody = {
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: ['90210', 'invalid-zip', '1234'] // Invalid formats
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid ZIP codes');
      expect(data.error).toContain('invalid-zip');
      expect(data.error).toContain('1234');
    });

    it('should check if buyer exists', async () => {
      mockPrisma.buyer.findUnique.mockResolvedValue(null); // Buyer not found

      const requestBody = {
        buyerId: 'non-existent',
        serviceTypeId: 'service-1',
        zipCodes: ['90210']
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Buyer not found');
    });

    it('should check if service type exists', async () => {
      mockPrisma.serviceType.findUnique.mockResolvedValue(null); // Service not found

      const requestBody = {
        buyerId: 'buyer-1',
        serviceTypeId: 'non-existent',
        zipCodes: ['90210']
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Service type not found');
    });

    it('should prevent duplicate mappings', async () => {
      mockPrisma.buyerServiceZipMapping.findUnique.mockResolvedValue(mockServiceZipMappings[0]); // Existing mapping

      const requestBody = {
        buyerId: 'buyer-1',
        serviceTypeId: 'service-1',
        zipCodes: ['90210']
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Mapping already exists for this buyer and service type');
    });
  });

  describe('PUT /api/admin/buyer-service-zip-mappings/[id]', () => {
    beforeEach(() => {
      mockPrisma.buyerServiceZipMapping.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'mapping-1', ...data })
      );
    });

    it('should update ZIP codes successfully', async () => {
      const requestBody = {
        zipCodes: ['90210', '10001', '60601']
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/mapping-1', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      const response = await api.PUT(request, { params: { id: 'mapping-1' } });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(mockPrisma.buyerServiceZipMapping.update).toHaveBeenCalledWith({
        where: { id: 'mapping-1' },
        data: {
          zipCodes: ['90210', '10001', '60601'],
          updatedAt: expect.any(Date)
        },
        include: {
          buyer: true,
          serviceType: true
        }
      });
    });

    it('should update priority successfully', async () => {
      const requestBody = {
        priority: 5
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/mapping-1', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      const response = await api.PUT(request, { params: { id: 'mapping-1' } });

      expect(mockPrisma.buyerServiceZipMapping.update).toHaveBeenCalledWith({
        where: { id: 'mapping-1' },
        data: {
          priority: 5,
          updatedAt: expect.any(Date)
        },
        include: {
          buyer: true,
          serviceType: true
        }
      });
    });

    it('should update active status successfully', async () => {
      const requestBody = {
        active: false
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/mapping-1', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      const response = await api.PUT(request, { params: { id: 'mapping-1' } });

      expect(mockPrisma.buyerServiceZipMapping.update).toHaveBeenCalledWith({
        where: { id: 'mapping-1' },
        data: {
          active: false,
          updatedAt: expect.any(Date)
        },
        include: {
          buyer: true,
          serviceType: true
        }
      });
    });

    it('should validate ZIP codes during update', async () => {
      const requestBody = {
        zipCodes: ['invalid-zip']
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/mapping-1', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      const response = await api.PUT(request, { params: { id: 'mapping-1' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid ZIP codes');
    });

    it('should validate priority range', async () => {
      const requestBody = {
        priority: 15 // Invalid - too high
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/mapping-1', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      const response = await api.PUT(request, { params: { id: 'mapping-1' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Priority must be a number between 1 and 10');
    });

    it('should handle non-existent mapping', async () => {
      const error = new Error('Record to update not found');
      mockPrisma.buyerServiceZipMapping.update.mockRejectedValue(error);

      const requestBody = {
        priority: 3
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/non-existent', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      const response = await api.PUT(request, { params: { id: 'non-existent' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Mapping not found');
    });
  });

  describe('DELETE /api/admin/buyer-service-zip-mappings/[id]', () => {
    it('should delete mapping successfully', async () => {
      mockPrisma.buyerServiceZipMapping.delete.mockResolvedValue({});

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/mapping-1', {
        method: 'DELETE'
      });

      const response = await api.DELETE(request, { params: { id: 'mapping-1' } });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(mockPrisma.buyerServiceZipMapping.delete).toHaveBeenCalledWith({
        where: { id: 'mapping-1' }
      });
    });

    it('should handle non-existent mapping', async () => {
      const error = new Error('Record to delete does not exist');
      mockPrisma.buyerServiceZipMapping.delete.mockRejectedValue(error);

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/non-existent', {
        method: 'DELETE'
      });

      const response = await api.DELETE(request, { params: { id: 'non-existent' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Mapping not found');
    });
  });

  describe('Coverage Analysis Endpoint', () => {
    it('should analyze coverage across all services', async () => {
      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/coverage-analysis');
      const response = await api.getCoverageAnalysis(request);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.overview).toBeDefined();
      expect(data.byService).toBeDefined();
      expect(data.byBuyer).toBeDefined();
      expect(data.distribution).toBeDefined();

      expect(typeof data.overview.totalZipCodes).toBe('number');
      expect(typeof data.overview.totalMappings).toBe('number');
      expect(typeof data.overview.averageBuyersPerZip).toBe('number');
    });

    it('should analyze coverage for specific service type', async () => {
      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/coverage-analysis?serviceTypeId=service-1');
      const response = await api.getCoverageAnalysis(request);

      expect(mockPrisma.buyerServiceZipMapping.findMany).toHaveBeenCalledWith({
        where: { active: true, serviceTypeId: 'service-1' },
        include: {
          buyer: true,
          serviceType: true
        }
      });
    });
  });

  describe('Conflicts Detection Endpoint', () => {
    it('should detect priority conflicts', async () => {
      const conflictMappings = [
        { ...mockServiceZipMappings[0], priority: 1 },
        { ...mockServiceZipMappings[1], priority: 1 } // Same priority
      ];
      mockPrisma.buyerServiceZipMapping.findMany.mockResolvedValue(conflictMappings);

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/conflicts');
      const response = await api.getConflicts(request);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.conflicts).toBeDefined();
      expect(Array.isArray(data.conflicts)).toBe(true);
    });

    it('should detect coverage overlaps', async () => {
      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/conflicts');
      const response = await api.getConflicts(request);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.conflicts.some((conflict: any) => conflict.type === 'coverage_overlap')).toBe(true);
    });
  });

  describe('Bulk Operations Endpoint', () => {
    beforeEach(() => {
      mockPrisma.buyerServiceZipMapping.updateMany.mockResolvedValue({ count: 3 });
      mockPrisma.buyerServiceZipMapping.deleteMany.mockResolvedValue({ count: 2 });
    });

    it('should perform bulk activation', async () => {
      const requestBody = {
        operation: 'activate',
        mappingIds: ['mapping-1', 'mapping-2', 'mapping-3']
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/bulk-operations', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.bulkOperations(request);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.affected).toBe(3);

      expect(mockPrisma.buyerServiceZipMapping.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['mapping-1', 'mapping-2', 'mapping-3'] } },
        data: { active: true, updatedAt: expect.any(Date) }
      });
    });

    it('should perform bulk deactivation', async () => {
      const requestBody = {
        operation: 'deactivate',
        mappingIds: ['mapping-1', 'mapping-2']
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/bulk-operations', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.bulkOperations(request);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(mockPrisma.buyerServiceZipMapping.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['mapping-1', 'mapping-2'] } },
        data: { active: false, updatedAt: expect.any(Date) }
      });
    });

    it('should perform bulk priority update', async () => {
      const requestBody = {
        operation: 'update-priority',
        mappingIds: ['mapping-1', 'mapping-2'],
        updateData: { priority: 5 }
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/bulk-operations', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.bulkOperations(request);

      expect(mockPrisma.buyerServiceZipMapping.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['mapping-1', 'mapping-2'] } },
        data: { priority: 5, updatedAt: expect.any(Date) }
      });
    });

    it('should perform bulk deletion', async () => {
      const requestBody = {
        operation: 'delete',
        mappingIds: ['mapping-1', 'mapping-2']
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/bulk-operations', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.bulkOperations(request);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(mockPrisma.buyerServiceZipMapping.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['mapping-1', 'mapping-2'] } }
      });
    });

    it('should validate bulk operation parameters', async () => {
      const requestBody = {
        operation: 'invalid-operation',
        mappingIds: ['mapping-1']
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/bulk-operations', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.bulkOperations(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid operation');
    });

    it('should require priority for priority update operation', async () => {
      const requestBody = {
        operation: 'update-priority',
        mappingIds: ['mapping-1'],
        updateData: {} // Missing priority
      };

      const request = new NextRequest('http://localhost/api/admin/buyer-service-zip-mappings/bulk-operations', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await api.bulkOperations(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Priority is required for update-priority operation');
    });
  });
});