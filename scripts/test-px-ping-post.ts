import { prisma } from '../src/lib/db';
import { loadServiceConfig, generatePingPayload, generatePostPayload } from '../src/lib/field-mapping/database-buyer-loader';

async function testPX() {
  const leadId = '7c200727-8144-435e-9f7f-7890936600a3'; // Feb 2 lead
  const buyerId = 'px-network-001';
  const serviceTypeId = 'ce6407cd-c8e7-4d64-b01e-13e157c33854'; // windows

  console.log('=== Testing PX PING/POST with Real Lead ===\n');

  // Load lead from database
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { serviceType: true }
  });

  if (!lead) {
    console.error('Lead not found');
    process.exit(1);
  }

  console.log('Lead Info:');
  console.log('- ID:', lead.id);
  console.log('- Zip:', lead.zipCode);
  console.log('- Service:', lead.serviceType?.name);
  console.log('- TrustedForm:', lead.trustedFormCertUrl ? '✅' : '❌');
  console.log('- Jornaya:', lead.jornayaLeadId ? '✅' : '❌');
  console.log('');

  // Parse JSON fields
  const formData = JSON.parse(lead.formData as string);
  const complianceData = lead.complianceData ? JSON.parse(lead.complianceData as string) : {};

  // Build lead data object for transformation
  const leadData = {
    id: lead.id,
    serviceTypeId: lead.serviceTypeId,
    zipCode: lead.zipCode,
    ownsHome: lead.ownsHome,
    timeframe: lead.timeframe,
    formData,
    trustedFormCertUrl: lead.trustedFormCertUrl,
    trustedFormCertId: lead.trustedFormCertId,
    jornayaLeadId: lead.jornayaLeadId,
    ipAddress: complianceData.ipAddress,
    userAgent: complianceData.userAgent,
    complianceData: complianceData
  };

  // Load PX service config with field mappings
  console.log('Loading PX configuration...');
  const serviceConfig = await loadServiceConfig(buyerId, serviceTypeId);

  if (!serviceConfig) {
    console.error('❌ PX service config not found');
    process.exit(1);
  }

  console.log('✅ PX config loaded');
  console.log('- Buyer ID:', serviceConfig.buyerId);
  console.log('- Service:', serviceConfig.serviceTypeName);
  console.log('- Field Mappings:', serviceConfig.fieldMappingConfig ? '✅' : '❌');
  console.log('');

  // Transform lead data to PX PING format
  console.log('Transforming lead data to PX PING format...');
  const pingResult = generatePingPayload(leadData as any, serviceConfig);
  const pingPayload = pingResult.payload;

  if (pingResult.errors.length > 0) {
    console.log('⚠️  Transformation warnings:');
    pingResult.errors.forEach(err => console.log(`  - ${err.field}: ${err.error}`));
    console.log('');
  }

  console.log('\n=== PING PAYLOAD ===');
  console.log(JSON.stringify(pingPayload, null, 2));
  console.log('');

  // Send PING
  console.log('Sending PING to PX...');
  const pingUrl = 'https://leadapi.px.com/api/lead/ping';

  try {
    const pingResponse = await fetch(pingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(pingPayload)
    });

    const pingResult = await pingResponse.json();

    console.log('PING Response Status:', pingResponse.status);
    console.log('PING Response:');
    console.log(JSON.stringify(pingResult, null, 2));
    console.log('');

    // Check if PING was successful
    if (pingResult.Success) {
      console.log('✅ PING ACCEPTED!');
      console.log('- TransactionId:', pingResult.TransactionId);
      console.log('- Payout:', pingResult.Payout);
      console.log('');

      // Send POST
      console.log('Transforming lead data to PX POST format...');

      // Add TransactionId to lead data for POST
      const leadDataWithToken = {
        ...leadData,
        pingTransactionId: pingResult.TransactionId
      };

      const postResult = generatePostPayload(leadDataWithToken as any, serviceConfig);
      const postPayload = postResult.payload;

      if (postResult.errors.length > 0) {
        console.log('⚠️  Transformation warnings:');
        postResult.errors.forEach(err => console.log(`  - ${err.field}: ${err.error}`));
        console.log('');
      }

      console.log('\n=== POST PAYLOAD ===');
      console.log(JSON.stringify(postPayload, null, 2));
      console.log('');

      console.log('Sending POST to PX...');
      const postUrl = 'https://leadapi.px.com/api/lead/post';

      const postResponse = await fetch(postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(postPayload)
      });

      const postResponseData = await postResponse.json();

      console.log('POST Response Status:', postResponse.status);
      console.log('POST Response:');
      console.log(JSON.stringify(postResponseData, null, 2));
      console.log('');

      if (postResponseData.Success) {
        console.log('✅ POST ACCEPTED!');
        console.log('- TransactionId:', postResponseData.TransactionId);
        console.log('- Payout:', postResponseData.Payout);
      } else {
        console.log('❌ POST REJECTED');
        console.log('- Message:', postResponseData.Message);
        console.log('- Errors:', postResponseData.Errors);
      }
    } else {
      console.log('❌ PING REJECTED');
      console.log('- Message:', pingResult.Message);
      console.log('- Errors:', pingResult.Errors);
    }
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    console.error((error as Error).stack);
  }

  await prisma.$disconnect();
  process.exit(0);
}

testPX();
