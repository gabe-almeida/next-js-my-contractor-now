/**
 * Complete End-to-End Test: ZIP Code Filtering Flow
 * Verifies the entire system from lead submission → API → Queue → Worker → Auction → ZIP Filtering
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { BuyerType } from '@/types/database';
import { addToQueue, getQueue } from '@/lib/redis';
import { processLead } from '@/workers/lead-processor';
import { registerTestBuyerConfig } from '../helpers/buyer-config-helper';

const prisma = new PrismaClient();

describe('Complete ZIP Filtering E2E Flow', () => {
  let testServiceType: any;
  let buyerCalifornia: any;
  let buyerNewYork: any;
  let buyerTexas: any;

  beforeAll(async () => {
    console.log('🚀 Setting up E2E test environment...');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up E2E test environment...');
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    console.log('🔄 Resetting database for test...');

    // Clean up test data
    await prisma.transaction.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.buyerServiceZipCode.deleteMany();
    await prisma.buyerServiceConfig.deleteMany();
    await prisma.buyer.deleteMany({ where: { name: { contains: 'E2E Test' } } });
    await prisma.serviceType.deleteMany({ where: { name: { contains: 'e2e-test' } } });
  });

  describe('Scenario 1: Complete Flow - Only CA Buyer Should Win', () => {
    it('should filter buyers by ZIP and service type from submission to auction', async () => {
      console.log('\n📋 TEST SCENARIO: Lead from ZIP 90210 (Beverly Hills, CA)');
      console.log('Expected: Only CA buyer participates in auction\n');

      // ============================================
      // STEP 1: Setup Database - Create Service Type
      // ============================================
      console.log('Step 1: Creating service type...');
      testServiceType = await prisma.serviceType.create({
        data: {
          name: 'e2e-test-windows',
          displayName: 'E2E Test Windows',
          formSchema: JSON.stringify({
            fields: [
              { name: 'projectType', type: 'select', options: ['installation', 'repair'] },
              { name: 'numberOfWindows', type: 'number', min: 1, max: 50 }
            ]
          }),
          active: true
        }
      });
      console.log(`✅ Created service type: ${testServiceType.id}`);

      // ============================================
      // STEP 2: Setup Database - Create Buyers
      // ============================================
      console.log('\nStep 2: Creating buyers in different states...');

      buyerCalifornia = await prisma.buyer.create({
        data: {
          name: 'E2E Test CA Buyer (Active)',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://test-ca-buyer.com/api',
          active: true,
          pingTimeout: 30,
          postTimeout: 60
        }
      });
      console.log(`✅ Created CA buyer: ${buyerCalifornia.id}`);
      registerTestBuyerConfig(
        buyerCalifornia.id,
        buyerCalifornia.name,
        testServiceType.id,
        testServiceType.displayName,
        buyerCalifornia.apiUrl
      );

      buyerNewYork = await prisma.buyer.create({
        data: {
          name: 'E2E Test NY Buyer (Active)',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://test-ny-buyer.com/api',
          active: true,
          pingTimeout: 30,
          postTimeout: 60
        }
      });
      console.log(`✅ Created NY buyer: ${buyerNewYork.id}`);
      registerTestBuyerConfig(
        buyerNewYork.id,
        buyerNewYork.name,
        testServiceType.id,
        testServiceType.displayName,
        buyerNewYork.apiUrl
      );

      buyerTexas = await prisma.buyer.create({
        data: {
          name: 'E2E Test TX Buyer (Active)',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://test-tx-buyer.com/api',
          active: true,
          pingTimeout: 30,
          postTimeout: 60
        }
      });
      console.log(`✅ Created TX buyer: ${buyerTexas.id}`);
      registerTestBuyerConfig(
        buyerTexas.id,
        buyerTexas.name,
        testServiceType.id,
        testServiceType.displayName,
        buyerTexas.apiUrl
      );

      // ============================================
      // STEP 3: Configure Buyer Services
      // ============================================
      console.log('\nStep 3: Configuring buyer service settings...');

      await prisma.buyerServiceConfig.createMany({
        data: [
          {
            buyerId: buyerCalifornia.id,
            serviceTypeId: testServiceType.id,
            pingTemplate: JSON.stringify({ template: 'ca-ping', mappings: [] }),
            postTemplate: JSON.stringify({ template: 'ca-post', mappings: [] }),
            fieldMappings: JSON.stringify({}),
            minBid: 100.00,
            maxBid: 500.00,
            active: true
          },
          {
            buyerId: buyerNewYork.id,
            serviceTypeId: testServiceType.id,
            pingTemplate: JSON.stringify({ template: 'ny-ping', mappings: [] }),
            postTemplate: JSON.stringify({ template: 'ny-post', mappings: [] }),
            fieldMappings: JSON.stringify({}),
            minBid: 150.00,
            maxBid: 600.00,
            active: true
          },
          {
            buyerId: buyerTexas.id,
            serviceTypeId: testServiceType.id,
            pingTemplate: JSON.stringify({ template: 'tx-ping', mappings: [] }),
            postTemplate: JSON.stringify({ template: 'tx-post', mappings: [] }),
            fieldMappings: JSON.stringify({}),
            minBid: 125.00,
            maxBid: 550.00,
            active: true
          }
        ]
      });
      console.log('✅ Configured all buyer service settings');

      // ============================================
      // STEP 4: Assign ZIP Codes to Buyers
      // ============================================
      console.log('\nStep 4: Assigning ZIP codes to buyers...');

      await prisma.buyerServiceZipCode.createMany({
        data: [
          // California buyer - serves CA ZIP codes only
          {
            buyerId: buyerCalifornia.id,
            serviceTypeId: testServiceType.id,
            zipCode: '90210',  // Beverly Hills, CA
            active: true,
            priority: 100,
            minBid: 100.00,
            maxBid: 500.00
          },
          {
            buyerId: buyerCalifornia.id,
            serviceTypeId: testServiceType.id,
            zipCode: '90211',  // Beverly Hills, CA
            active: true,
            priority: 100
          },
          {
            buyerId: buyerCalifornia.id,
            serviceTypeId: testServiceType.id,
            zipCode: '94102',  // San Francisco, CA
            active: true,
            priority: 95
          },

          // New York buyer - serves NY ZIP codes only
          {
            buyerId: buyerNewYork.id,
            serviceTypeId: testServiceType.id,
            zipCode: '10001',  // Manhattan, NY
            active: true,
            priority: 100,
            minBid: 150.00,
            maxBid: 600.00
          },
          {
            buyerId: buyerNewYork.id,
            serviceTypeId: testServiceType.id,
            zipCode: '10002',  // Manhattan, NY
            active: true,
            priority: 100
          },

          // Texas buyer - serves TX ZIP codes only
          {
            buyerId: buyerTexas.id,
            serviceTypeId: testServiceType.id,
            zipCode: '75001',  // Dallas, TX
            active: true,
            priority: 100,
            minBid: 125.00,
            maxBid: 550.00
          },
          {
            buyerId: buyerTexas.id,
            serviceTypeId: testServiceType.id,
            zipCode: '75002',  // Dallas, TX
            active: true,
            priority: 100
          }
        ]
      });
      console.log('✅ CA Buyer: ZIPs 90210, 90211, 94102');
      console.log('✅ NY Buyer: ZIPs 10001, 10002');
      console.log('✅ TX Buyer: ZIPs 75001, 75002');

      // ============================================
      // STEP 5: Simulate Frontend - Submit Lead via API
      // ============================================
      console.log('\n Step 5: Simulating frontend form submission...');
      console.log('📍 Lead ZIP Code: 90210 (Beverly Hills, CA)');

      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: testServiceType.id,
          formData: JSON.stringify({
            projectType: 'installation',
            numberOfWindows: 8,
            customerName: 'John Doe',
            customerPhone: '(555) 123-4567',
            customerEmail: 'john@example.com'
          }),
          zipCode: '90210',  // ⭐ CALIFORNIA ZIP CODE
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'PENDING',
          trustedFormCertUrl: 'https://cert.trustedform.com/test123',
          trustedFormCertId: 'test-cert-123',
          jornayaLeadId: 'test-jornaya-123',
          complianceData: JSON.stringify({
            tcpaConsent: true,
            tcpaTimestamp: new Date().toISOString(),
            ipAddress: '127.0.0.1',
            userAgent: 'E2E Test'
          }),
          leadQualityScore: 95
        }
      });
      console.log(`✅ Lead created: ${lead.id}`);
      console.log(`   Status: ${lead.status}`);
      console.log(`   ZIP: ${lead.zipCode}`);

      // ============================================
      // STEP 6: Add to Queue (simulating API endpoint)
      // ============================================
      console.log('\nStep 6: Adding lead to processing queue...');

      const jobId = await addToQueue('lead-processing', {
        leadId: lead.id,
        priority: 'high'
      });
      console.log(`✅ Job queued: ${jobId}`);

      // ============================================
      // STEP 7: Process Lead Through Worker
      // ============================================
      console.log('\nStep 7: Processing lead through worker...');
      console.log('⚙️  Worker will:');
      console.log('   1. Load lead from database');
      console.log('   2. Convert to LeadData format');
      console.log('   3. Call AuctionEngine.runAuction()');
      console.log('   4. Filter buyers by serviceType AND zipCode');
      console.log('   5. Only ping eligible buyers');

      // Mock fetch for PING/POST requests
      global.fetch = jest.fn((url: string, options?: any) => {
        console.log(`   📡 HTTP Request to: ${url}`);

        if (url.includes('test-ca-buyer.com')) {
          console.log('   ✅ CA Buyer PING - Responding with bid $350');
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              bidAmount: 350.00,
              accepted: true,
              message: 'We can help with your windows'
            })
          });
        }

        if (url.includes('test-ny-buyer.com') || url.includes('test-tx-buyer.com')) {
          console.log('   ❌ ERROR: NY or TX buyer was contacted (should not happen!)');
          throw new Error('NY/TX buyer should not be pinged for CA ZIP code!');
        }

        return Promise.reject(new Error('Unknown URL'));
      }) as jest.Mock;

      // Process the lead
      await processLead({ data: { leadId: lead.id } });

      console.log('✅ Worker processing complete');

      // ============================================
      // STEP 8: Verify Results
      // ============================================
      console.log('\nStep 8: Verifying auction results...');

      const updatedLead = await prisma.lead.findUnique({
        where: { id: lead.id },
        include: {
          winningBuyer: true
        }
      });

      console.log('\n📊 FINAL RESULTS:');
      console.log(`   Lead Status: ${updatedLead?.status}`);
      console.log(`   Winning Buyer: ${updatedLead?.winningBuyer?.name}`);
      console.log(`   Winning Bid: $${updatedLead?.winningBid}`);

      // Assertions
      expect(updatedLead?.status).toBe('SOLD');
      expect(updatedLead?.winningBuyerId).toBe(buyerCalifornia.id);
      expect(updatedLead?.winningBuyer?.name).toBe('E2E Test CA Buyer (Active)');
      expect(updatedLead?.winningBid).toBe(350.00);

      // Verify fetch was only called for CA buyer (PING + POST)
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('test-ca-buyer.com'),
        expect.any(Object)
      );

      console.log('\n✅ ALL ASSERTIONS PASSED!');
      console.log('   ✓ Only CA buyer was contacted');
      console.log('   ✓ NY and TX buyers were filtered out by ZIP');
      console.log('   ✓ Lead marked as SOLD');
      console.log('   ✓ Correct buyer won auction');
    });
  });

  describe('Scenario 2: No Matching Buyers - Lead Should Be Rejected', () => {
    it('should reject lead when no buyers service the ZIP code', async () => {
      console.log('\n📋 TEST SCENARIO: Lead from unsupported ZIP 99999');
      console.log('Expected: Lead rejected (no eligible buyers)\n');

      // Create service type
      const service = await prisma.serviceType.create({
        data: {
          name: 'e2e-test-roofing',
          displayName: 'E2E Test Roofing',
          formSchema: JSON.stringify({}),
          active: true
        }
      });

      // Create buyer that only services specific ZIPs
      const buyer = await prisma.buyer.create({
        data: {
          name: 'E2E Test Limited Coverage Buyer',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://test-limited.com/api',
          active: true,
          pingTimeout: 30,
          postTimeout: 60
        }
      });
      registerTestBuyerConfig(
        buyer.id,
        buyer.name,
        service.id,
        service.displayName,
        buyer.apiUrl
      );

      await prisma.buyerServiceConfig.create({
        data: {
          buyerId: buyer.id,
          serviceTypeId: service.id,
          pingTemplate: JSON.stringify({}),
          postTemplate: JSON.stringify({}),
          fieldMappings: JSON.stringify({}),
          minBid: 100.00,
          maxBid: 500.00,
          active: true
        }
      });

      // Buyer only services Colorado ZIPs
      await prisma.buyerServiceZipCode.createMany({
        data: [
          { buyerId: buyer.id, serviceTypeId: service.id, zipCode: '80001', active: true, priority: 100 },
          { buyerId: buyer.id, serviceTypeId: service.id, zipCode: '80002', active: true, priority: 100 },
          { buyerId: buyer.id, serviceTypeId: service.id, zipCode: '80003', active: true, priority: 100 }
        ]
      });

      console.log('✅ Buyer only serves ZIPs: 80001, 80002, 80003 (Colorado)');

      // Create lead in unsupported ZIP
      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: service.id,
          formData: JSON.stringify({}),
          zipCode: '99999',  // ⭐ UNSUPPORTED ZIP CODE
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'PENDING'
        }
      });

      console.log(`📍 Lead ZIP: ${lead.zipCode} (not serviced by any buyer)`);

      // Mock fetch - should NOT be called
      global.fetch = jest.fn();

      // Process lead
      await processLead({ data: { leadId: lead.id } });

      // Verify lead was rejected
      const updatedLead = await prisma.lead.findUnique({
        where: { id: lead.id }
      });

      console.log(`\n📊 Lead Status: ${updatedLead?.status}`);

      expect(updatedLead?.status).toBe('REJECTED');
      expect(updatedLead?.winningBuyerId).toBeNull();
      expect(updatedLead?.winningBid).toBeNull();

      // No buyers should have been contacted
      expect(global.fetch).not.toHaveBeenCalled();

      console.log('✅ Lead correctly rejected - no eligible buyers');
    });
  });

  describe('Scenario 3: Inactive Buyer Should Be Filtered Out', () => {
    it('should exclude inactive buyers even with matching ZIP', async () => {
      console.log('\n📋 TEST SCENARIO: Active and Inactive buyers with same ZIP');
      console.log('Expected: Only active buyer participates\n');

      const service = await prisma.serviceType.create({
        data: {
          name: 'e2e-test-hvac',
          displayName: 'E2E Test HVAC',
          formSchema: JSON.stringify({}),
          active: true
        }
      });

      // Create ACTIVE buyer
      const activeBuyer = await prisma.buyer.create({
        data: {
          name: 'E2E Test Active HVAC Buyer',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://test-active-hvac.com/api',
          active: true,  // ⭐ ACTIVE
          pingTimeout: 30,
          postTimeout: 60
        }
      });
      registerTestBuyerConfig(
        activeBuyer.id,
        activeBuyer.name,
        service.id,
        service.displayName,
        activeBuyer.apiUrl
      );

      // Create INACTIVE buyer
      const inactiveBuyer = await prisma.buyer.create({
        data: {
          name: 'E2E Test Inactive HVAC Buyer',
          type: BuyerType.CONTRACTOR,
          apiUrl: 'https://test-inactive-hvac.com/api',
          active: false,  // ⭐ INACTIVE
          pingTimeout: 30,
          postTimeout: 60
        }
      });
      registerTestBuyerConfig(
        inactiveBuyer.id,
        inactiveBuyer.name,
        service.id,
        service.displayName,
        inactiveBuyer.apiUrl
      );

      // Configure both buyers
      await prisma.buyerServiceConfig.createMany({
        data: [
          {
            buyerId: activeBuyer.id,
            serviceTypeId: service.id,
            pingTemplate: JSON.stringify({}),
            postTemplate: JSON.stringify({}),
            fieldMappings: JSON.stringify({}),
            minBid: 100.00,
            maxBid: 500.00,
            active: true
          },
          {
            buyerId: inactiveBuyer.id,
            serviceTypeId: service.id,
            pingTemplate: JSON.stringify({}),
            postTemplate: JSON.stringify({}),
            fieldMappings: JSON.stringify({}),
            minBid: 100.00,
            maxBid: 500.00,
            active: true
          }
        ]
      });

      // Both buyers have SAME ZIP code
      await prisma.buyerServiceZipCode.createMany({
        data: [
          {
            buyerId: activeBuyer.id,
            serviceTypeId: service.id,
            zipCode: '60601',
            active: true,
            priority: 100
          },
          {
            buyerId: inactiveBuyer.id,
            serviceTypeId: service.id,
            zipCode: '60601',  // Same ZIP!
            active: true,
            priority: 100
          }
        ]
      });

      console.log('✅ Active Buyer: ZIP 60601, Active=true');
      console.log('✅ Inactive Buyer: ZIP 60601, Active=FALSE');

      // Create lead
      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: service.id,
          formData: JSON.stringify({}),
          zipCode: '60601',
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'PENDING'
        }
      });

      // Mock fetch - only active buyer should be called
      global.fetch = jest.fn((url: string) => {
        console.log(`   📡 HTTP Request to: ${url}`);

        if (url.includes('test-active-hvac.com')) {
          console.log('   ✅ Active buyer contacted');
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ bidAmount: 200.00, accepted: true })
          });
        }

        if (url.includes('test-inactive-hvac.com')) {
          console.log('   ❌ ERROR: Inactive buyer was contacted!');
          throw new Error('Inactive buyer should be filtered out!');
        }

        return Promise.reject(new Error('Unknown URL'));
      }) as jest.Mock;

      // Process lead
      await processLead({ data: { leadId: lead.id } });

      // Verify
      const updatedLead = await prisma.lead.findUnique({
        where: { id: lead.id }
      });

      expect(updatedLead?.status).toBe('SOLD');
      expect(updatedLead?.winningBuyerId).toBe(activeBuyer.id);

      // Only active buyer should be contacted (PING + POST)
      expect(global.fetch).toHaveBeenCalledTimes(2);

      console.log('\n✅ Only active buyer participated in auction');
    });
  });

  describe('Scenario 4: Multiple Buyers Same ZIP - Highest Bid Wins', () => {
    it('should select highest bidder when multiple buyers service same ZIP', async () => {
      console.log('\n📋 TEST SCENARIO: 3 buyers all service ZIP 33101');
      console.log('Expected: Highest bidder wins\n');

      const service = await prisma.serviceType.create({
        data: {
          name: 'e2e-test-plumbing',
          displayName: 'E2E Test Plumbing',
          formSchema: JSON.stringify({}),
          active: true
        }
      });

      // Create 3 buyers
      const buyers = await Promise.all([
        prisma.buyer.create({
          data: {
            name: 'E2E Test Plumber A (Low Bid)',
            type: BuyerType.CONTRACTOR,
            apiUrl: 'https://test-plumber-a.com/api',
            active: true,
            pingTimeout: 30,
            postTimeout: 60
          }
        }),
        prisma.buyer.create({
          data: {
            name: 'E2E Test Plumber B (Medium Bid)',
            type: BuyerType.CONTRACTOR,
            apiUrl: 'https://test-plumber-b.com/api',
            active: true,
            pingTimeout: 30,
            postTimeout: 60
          }
        }),
        prisma.buyer.create({
          data: {
            name: 'E2E Test Plumber C (High Bid)',
            type: BuyerType.NETWORK,
            apiUrl: 'https://test-plumber-c.com/api',
            active: true,
            pingTimeout: 30,
            postTimeout: 60
          }
        })
      ]);

      // Register buyer configs
      buyers.forEach(buyer => {
        registerTestBuyerConfig(
          buyer.id,
          buyer.name,
          service.id,
          service.displayName,
          buyer.apiUrl
        );
      });

      // Configure all buyers
      await prisma.buyerServiceConfig.createMany({
        data: buyers.map(buyer => ({
          buyerId: buyer.id,
          serviceTypeId: service.id,
          pingTemplate: JSON.stringify({}),
          postTemplate: JSON.stringify({}),
          fieldMappings: JSON.stringify({}),
          minBid: 100.00,
          maxBid: 500.00,
          active: true
        }))
      });

      // All service same ZIP with different priorities
      await prisma.buyerServiceZipCode.createMany({
        data: buyers.map((buyer, i) => ({
          buyerId: buyer.id,
          serviceTypeId: service.id,
          zipCode: '33101',  // Miami, FL
          active: true,
          priority: 100 + (i * 5)
        }))
      });

      console.log('✅ All 3 buyers service ZIP 33101');

      const lead = await prisma.lead.create({
        data: {
          serviceTypeId: service.id,
          formData: JSON.stringify({}),
          zipCode: '33101',
          ownsHome: true,
          timeframe: 'ASAP',
          status: 'PENDING'
        }
      });

      // Mock fetch with different bid amounts
      global.fetch = jest.fn((url: string, options?: any) => {
        const body = JSON.parse(options?.body || '{}');
        console.log(`   📡 ${options?.method || 'GET'} ${url}`);

        if (url.includes('plumber-a.com/ping')) {
          console.log('   💰 Plumber A bids: $150');
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ bidAmount: 150.00, accepted: true })
          });
        }

        if (url.includes('plumber-b.com/ping')) {
          console.log('   💰 Plumber B bids: $225');
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ bidAmount: 225.00, accepted: true })
          });
        }

        if (url.includes('plumber-c.com/ping')) {
          console.log('   💰 Plumber C bids: $300 (HIGHEST)');
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ bidAmount: 300.00, accepted: true })
          });
        }

        if (url.includes('plumber-c.com/post')) {
          console.log('   ✅ Sending lead to Plumber C (winner)');
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ accepted: true, leadId: 'plumber-c-lead-123' })
          });
        }

        return Promise.reject(new Error('Unknown URL'));
      }) as jest.Mock;

      // Process lead
      await processLead({ data: { leadId: lead.id } });

      // Verify highest bidder won
      const updatedLead = await prisma.lead.findUnique({
        where: { id: lead.id }
      });

      expect(updatedLead?.status).toBe('SOLD');
      expect(updatedLead?.winningBuyerId).toBe(buyers[2].id); // Plumber C
      expect(updatedLead?.winningBid).toBe(300.00);

      // All 3 should be pinged + 1 POST to winner = 4 calls
      expect(global.fetch).toHaveBeenCalledTimes(4);

      console.log('\n✅ Highest bidder (Plumber C - $300) won the auction');
    });
  });
});
