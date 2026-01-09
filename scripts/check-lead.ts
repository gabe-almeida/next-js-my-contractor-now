import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const leadId = 'ce45c865-56ea-44d5-a863-d220020feccc';

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      serviceType: true,
      statusHistory: {
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      winningBuyer: true,
      transactions: true
    }
  });

  // Check transactions (PING/POST results)
  const transactions = await prisma.transaction.findMany({
    where: { leadId },
    include: { buyer: true },
    orderBy: { createdAt: 'asc' }
  });

  if (!lead) {
    console.log('Lead not found!');
    return;
  }

  console.log('=== LEAD DETAILS ===');
  console.log('ID:', lead.id);
  console.log('Status:', lead.status);
  console.log('Disposition:', lead.disposition);
  console.log('Service:', lead.serviceType.name);
  console.log('ZIP:', lead.zipCode);
  console.log('Created:', lead.createdAt);

  console.log('\n=== FORM DATA ===');
  const formData = typeof lead.formData === 'string' ? JSON.parse(lead.formData) : lead.formData;
  console.log('firstName:', formData.firstName);
  console.log('lastName:', formData.lastName);
  console.log('email:', formData.email);
  console.log('phone:', formData.phone);
  console.log('address:', JSON.stringify(formData.address, null, 2));

  console.log('\n=== COMPLIANCE DATA ===');
  const compliance = typeof lead.complianceData === 'string' ? JSON.parse(lead.complianceData) : lead.complianceData;
  console.log('tcpaConsent:', JSON.stringify(compliance?.tcpaConsent, null, 2));
  console.log('trustedFormCertUrl:', lead.trustedFormCertUrl);

  console.log('\n=== TRANSACTIONS (PING/POST) ===');
  if (transactions.length === 0) {
    console.log('No transactions found!');
  } else {
    for (const tx of transactions) {
      console.log('---');
      console.log('Type:', tx.actionType);
      console.log('Buyer:', tx.buyer.name);
      console.log('Status:', tx.status);
      console.log('Bid Amount:', tx.bidAmount?.toString());
      console.log('Response Time:', tx.responseTime, 'ms');
      console.log('Is Winner:', tx.isWinner);
      console.log('Payload:', tx.payload?.substring(0, 200) + '...');
      console.log('Response:', tx.response?.substring(0, 300));
      if (tx.errorMessage) console.log('Error:', tx.errorMessage);
    }
  }

  if (lead.winningBuyer) {
    console.log('\n=== WINNING BUYER ===');
    console.log('Buyer:', lead.winningBuyer.name);
  }

  console.log('\n=== STATUS HISTORY ===');
  for (const sh of lead.statusHistory) {
    console.log(`[${sh.createdAt.toISOString()}] ${sh.previousStatus} -> ${sh.newStatus}: ${sh.reason || 'N/A'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
