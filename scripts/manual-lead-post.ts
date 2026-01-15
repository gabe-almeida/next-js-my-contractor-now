/**
 * Manual Lead POST Script
 * Manually send PING and POST for a specific lead
 */

import { PrismaClient } from '@prisma/client';
import { loadBuyerConfig, loadServiceConfig, generatePingPayload, generatePostPayload } from '../src/lib/field-mapping/database-buyer-loader';

const prisma = new PrismaClient();

async function manualLeadPost() {
  const leadId = '52920e43-c751-422e-a6a1-6763fac8dfdf';

  console.log('\n=== MANUAL LEAD POST ===');
  console.log(`Lead ID: ${leadId}\n`);

  // Load lead from database
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      serviceType: true
    }
  });

  if (!lead) {
    console.error('Lead not found!');
    process.exit(1);
  }

  console.log('✅ Lead loaded');
  console.log(`  Service: ${lead.serviceType.displayName}`);
  console.log(`  ZIP: ${lead.zipCode}`);
  console.log(`  Created: ${lead.createdAt}\n`);

  // Find Modernize buyer
  const buyer = await prisma.buyer.findFirst({
    where: { name: 'Modernize' }
  });

  if (!buyer) {
    console.error('Modernize buyer not found!');
    process.exit(1);
  }

  console.log('✅ Buyer found: Modernize\n');

  // Load service config
  const serviceConfig = await loadServiceConfig(buyer.id, lead.serviceTypeId);

  if (!serviceConfig) {
    console.error('Service config not found!');
    process.exit(1);
  }

  console.log('✅ Service config loaded');
  console.log(`  Ping URL: ${serviceConfig.webhookConfig.pingUrl}`);
  console.log(`  Post URL: ${serviceConfig.webhookConfig.postUrl}\n`);

  // Prepare lead data object
  const leadData = {
    id: lead.id,
    zipCode: lead.zipCode,
    ownsHome: lead.ownsHome,
    timeframe: lead.timeframe,
    formData: lead.formData,
    trustedFormCertUrl: lead.trustedFormCertUrl,
    trustedFormCertId: lead.trustedFormCertId,
    jornayaLeadId: lead.jornayaLeadId,
    complianceData: lead.complianceData,
    ipAddress: lead.ipAddress,
    userAgent: lead.userAgent,
    createdAt: lead.createdAt
  };

  // === STEP 1: PING ===
  console.log('📡 Sending PING...');

  const { payload: pingPayload } = generatePingPayload(leadData, serviceConfig);

  console.log('PING Payload:');
  console.log(JSON.stringify(pingPayload, null, 2));

  const pingResponse = await fetch(serviceConfig.webhookConfig.pingUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer demo_modernize_token'
    },
    body: JSON.stringify(pingPayload),
    signal: AbortSignal.timeout(serviceConfig.webhookConfig.timeouts.ping * 1000)
  });

  const pingResult = await pingResponse.json();

  console.log('\n✅ PING Response:');
  console.log(JSON.stringify(pingResult, null, 2));

  if (!pingResponse.ok || !pingResult.pingToken) {
    console.error('\n❌ PING failed or no pingToken received');
    process.exit(1);
  }

  const pingToken = pingResult.pingToken;
  console.log(`\n🎫 Ping Token: ${pingToken}\n`);

  // === STEP 2: POST ===
  console.log('📤 Sending POST with pingToken...');

  // Add pingToken to lead data for POST
  const postLeadData = {
    ...leadData,
    pingToken
  };

  const { payload: postPayload } = generatePostPayload(postLeadData, serviceConfig);

  // Add pingToken to static fields if not already there
  if (!postPayload.pingToken) {
    postPayload.pingToken = pingToken;
  }

  console.log('POST Payload:');
  console.log(JSON.stringify(postPayload, null, 2));

  const postResponse = await fetch(serviceConfig.webhookConfig.postUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer demo_modernize_token'
    },
    body: JSON.stringify(postPayload),
    signal: AbortSignal.timeout(serviceConfig.webhookConfig.timeouts.post * 1000)
  });

  const postResult = await postResponse.json();

  console.log('\n✅ POST Response:');
  console.log(JSON.stringify(postResult, null, 2));

  if (!postResponse.ok) {
    console.error(`\n❌ POST failed with status ${postResponse.status}`);
  } else {
    console.log('\n🎉 POST successful!');
  }

  // Update transaction in database
  const failedTransaction = await prisma.transaction.findFirst({
    where: {
      leadId: leadId,
      actionType: 'POST',
      status: 'TIMEOUT'
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (failedTransaction) {
    await prisma.transaction.update({
      where: { id: failedTransaction.id },
      data: {
        status: postResponse.ok ? 'SUCCESS' : 'FAILED',
        response: JSON.stringify(postResult),
        responseTime: postResponse.ok ? 1000 : 50000,
        errorMessage: postResponse.ok ? null : `HTTP ${postResponse.status}`,
        payload: JSON.stringify(postPayload)
      }
    });
    console.log('\n✅ Transaction record updated in database');
  }

  await prisma.$disconnect();
}

manualLeadPost().catch((error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
