/**
 * Create Test Affiliate Account
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import { Decimal } from '@prisma/client/runtime/library';

const TEST_AFFILIATE = {
  email: 'test-affiliate@mycontractornow.com',
  firstName: 'Test',
  lastName: 'Affiliate',
  phone: '+15551234567',
  companyName: 'Test Company LLC',
  status: 'ACTIVE' as const,
};

async function createTestAffiliate() {
  try {
    logger.info('Creating test affiliate...');

    const apiKey = crypto.randomBytes(32).toString('hex');
    const apiSecret = crypto.randomBytes(32).toString('hex');
    const plainPassword = 'test123';
    const passwordHash = await bcryptjs.hash(plainPassword, 10);

    const existing = await prisma.affiliate.findUnique({
      where: { email: TEST_AFFILIATE.email },
    });

    if (existing) {
      logger.info(`Test affiliate already exists: ${existing.id}`);
      console.log('\n✅ Test Affiliate Already Exists');
      console.log(`ID: ${existing.id}`);
      console.log(`Email: ${existing.email}`);
      return existing;
    }

    const affiliate = await prisma.affiliate.create({
      data: {
        email: TEST_AFFILIATE.email,
        firstName: TEST_AFFILIATE.firstName,
        lastName: TEST_AFFILIATE.lastName,
        phone: TEST_AFFILIATE.phone,
        companyName: TEST_AFFILIATE.companyName,
        status: TEST_AFFILIATE.status,
        apiKey: apiKey,
        apiSecret: apiSecret,
        passwordHash: passwordHash,
        emailVerified: true,
        commissionRate: new Decimal('0.15'),
      },
    });

    logger.info(`✅ Test affiliate created: ${affiliate.id}`);

    const campaign = await prisma.campaign.create({
      data: {
        affiliateId: affiliate.id,
        name: 'Test Windows Campaign',
        serviceType: 'windows',
        status: 'ACTIVE',
        maxDailyLeads: 100,
        hourStart: 8,
        hourEnd: 20,
      },
    });

    logger.info(`✅ Test campaign created: ${campaign.id}`);

    const trackingNumber = await prisma.trackingNumber.create({
      data: {
        campaignId: campaign.id,
        phoneNumber: '+18445551234',
        numberType: 'PLATFORM',
        status: 'ACTIVE',
        affiliateId: affiliate.id,
      },
    });

    logger.info(`✅ Test tracking number created: ${trackingNumber.id}`);

    console.log('\n✅ Test Affiliate Setup Complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('AFFILIATE:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID: ${affiliate.id}`);
    console.log(`Email: ${affiliate.email}\n`);
    
    console.log('CAMPAIGN:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID: ${campaign.id}`);
    console.log(`Name: ${campaign.name}\n`);
    
    console.log('TRACKING:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Phone: ${trackingNumber.phoneNumber}\n`);
    
    console.log('LOGIN:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${TEST_AFFILIATE.email}`);
    console.log(`Password: ${plainPassword}\n`);

    return affiliate;
  } catch (error) {
    logger.error('Failed to create test affiliate:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestAffiliate().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
