/**
 * Manual Auction Test Script
 * Tests the auction engine for a specific lead
 */

import { PrismaClient } from '@prisma/client';
import { AuctionEngine } from '../src/lib/auction/engine';
import { LeadData } from '../src/lib/templates/types';

const prisma = new PrismaClient();

async function main() {
  const leadId = process.argv[2] || 'fbd42cda-cf29-41b3-8893-164b2b4c756e';

  console.log('=== AUCTION TEST ===');
  console.log('Lead ID:', leadId);

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { serviceType: true }
  });

  if (!lead) {
    console.log('Lead not found!');
    return;
  }

  const formData = typeof lead.formData === 'string' ? JSON.parse(lead.formData) : lead.formData;

  console.log('Service:', lead.serviceType.name);
  console.log('ZIP:', lead.zipCode);
  console.log('Name:', formData?.firstName, formData?.lastName);

  const leadData: LeadData = {
    id: lead.id,
    serviceTypeId: lead.serviceTypeId,
    serviceType: lead.serviceType as any,
    zipCode: lead.zipCode,
    formData: formData,
    ownsHome: lead.ownsHome,
    timeframe: lead.timeframe,
    status: lead.status as any,
    trustedFormCertUrl: lead.trustedFormCertUrl || undefined,
    trustedFormCertId: lead.trustedFormCertId || undefined,
    jornayaLeadId: lead.jornayaLeadId || undefined,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };

  console.log('\nRunning auction...\n');

  try {
    const result = await AuctionEngine.runAuction(leadData);
    console.log('=== AUCTION RESULT ===');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('=== AUCTION FAILED ===');
    console.error(error);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
