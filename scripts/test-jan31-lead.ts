import { BuyerEligibilityService } from '../src/lib/services/buyer-eligibility-service';

async function test() {
  // Jan 31 lead with zero transactions
  const filter = {
    serviceTypeId: 'ce6407cd-c8e7-4d64-b01e-13e157c33854', // windows
    zipCode: '39047', // Jan 31 lead zip (Mississippi)
    maxParticipants: 10
  };

  console.log('=== Testing Jan 31 Lead (Zero Transactions) ===');
  console.log('Service Type: windows');
  console.log('Zip Code:', filter.zipCode);
  console.log('Lead ID: a7c6c094-4f7b-46c3-ab2d-b6de3116d566');
  console.log('Created: 2026-01-31 03:26:14');
  console.log('');

  try {
    const result = await BuyerEligibilityService.getEligibleBuyers(filter);

    console.log('=== RESULTS ===');
    console.log('Total Found:', result.totalFound);
    console.log('Eligible count:', result.eligibleCount);
    console.log('Excluded count:', result.excludedCount);

    if (result.eligible.length > 0) {
      console.log('\n=== ELIGIBLE BUYERS ===');
      for (const buyer of result.eligible) {
        console.log(`- ${buyer.buyerName} (${buyer.buyerId})`);
        console.log(`  Zone: ${buyer.serviceZone.zipCode}`);
        console.log(`  Score: ${buyer.eligibilityScore}`);
      }
    } else {
      console.log('\n⚠️  NO ELIGIBLE BUYERS FOUND');
    }

    if (result.excluded.length > 0) {
      console.log('\n=== EXCLUDED BUYERS ===');
      for (const excluded of result.excluded) {
        console.log(`- ${excluded.buyerName}`);
        console.log(`  Reason: ${excluded.reason}`);
        if (excluded.details) {
          console.log(`  Details:`, JSON.stringify(excluded.details, null, 2));
        }
      }
    }
  } catch (error) {
    console.error('ERROR:', (error as Error).message);
    console.error((error as Error).stack);
  }

  process.exit(0);
}

test();
