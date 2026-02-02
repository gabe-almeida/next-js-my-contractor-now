import { BuyerEligibilityService } from '../src/lib/services/buyer-eligibility-service';

async function test() {
  // Simulate the Jan 30 stuck lead
  const filter = {
    serviceTypeId: 'ce6407cd-c8e7-4d64-b01e-13e157c33854', // windows
    zipCode: '48317', // Stuck lead zip code
    maxParticipants: 10
  };

  console.log('=== Testing Stuck Lead Eligibility ===');
  console.log('Service Type ID:', filter.serviceTypeId);
  console.log('Zip Code:', filter.zipCode);
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
        console.log(`  Daily count: ${buyer.constraints.currentDailyCount}`);
        console.log(`  Max per day: ${buyer.serviceZone.maxLeadsPerDay || 'unlimited'}`);
      }
    } else {
      console.log('\n⚠️  NO ELIGIBLE BUYERS FOUND');
    }

    if (result.excluded.length > 0) {
      console.log('\n=== EXCLUDED BUYERS ===');
      for (const excluded of result.excluded) {
        console.log(`- ${excluded.buyerName} (${excluded.buyerId})`);
        console.log(`  Reason: ${excluded.reason}`);
        if (excluded.details) {
          console.log(`  Details:`, JSON.stringify(excluded.details, null, 2));
        }
      }

      // Count exclusion reasons
      console.log('\n=== EXCLUSION BREAKDOWN ===');
      const reasonCounts: Record<string, number> = {};
      for (const excluded of result.excluded) {
        reasonCounts[excluded.reason] = (reasonCounts[excluded.reason] || 0) + 1;
      }
      for (const [reason, count] of Object.entries(reasonCounts)) {
        console.log(`${reason}: ${count}`);
      }
    }
  } catch (error) {
    console.error('ERROR:', (error as Error).message);
    console.error((error as Error).stack);
  }

  process.exit(0);
}

test();
