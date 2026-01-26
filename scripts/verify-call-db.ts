/**
 * Verify Call Database Records Script
 *
 * WHY: Verify Twilio integration test results in the production database.
 * WHEN: Run after making test calls to verify data integrity.
 * HOW: Queries PostgreSQL database directly to check call records.
 *
 * Commands:
 *   tracking-numbers  - List all tracking numbers
 *   recent-calls      - Show recent calls from today
 *   call <sid>        - Show details for a specific call by Twilio SID
 *   call-id <id>      - Show details for a specific call by database ID
 *   cascade <call_id> - Show cascade attempts for a call
 *   validate          - Run billing validation checks
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

async function getClient(): Promise<Client> {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

/**
 * List all tracking numbers
 */
async function listTrackingNumbers(): Promise<void> {
  console.log('=== Tracking Numbers ===\n');

  const client = await getClient();
  try {
    const result = await client.query(`
      SELECT
        tn.id,
        tn.phone_number,
        tn.phone_number_display,
        tn.provisioning_status,
        tn.provisioning_type,
        tn.active,
        tn.total_calls,
        tn.total_qualified_calls,
        a.email as affiliate_email,
        c.name as campaign_name,
        tn.created_at
      FROM tracking_numbers tn
      LEFT JOIN affiliates a ON tn.affiliate_id = a.id
      LEFT JOIN campaigns c ON tn.campaign_id = c.id
      ORDER BY tn.created_at DESC
      LIMIT 20;
    `);

    if (result.rows.length === 0) {
      console.log('No tracking numbers found.');
      return;
    }

    for (const row of result.rows) {
      console.log(`ID: ${row.id}`);
      console.log(`  Phone: ${row.phone_number} (${row.phone_number_display || 'no display'})`);
      console.log(`  Status: ${row.provisioning_status}`);
      console.log(`  Type: ${row.provisioning_type}`);
      console.log(`  Active: ${row.active}`);
      console.log(`  Affiliate: ${row.affiliate_email || 'N/A'}`);
      console.log(`  Campaign: ${row.campaign_name || 'N/A'}`);
      console.log(`  Calls: ${row.total_calls} (${row.total_qualified_calls} qualified)`);
      console.log(`  Created: ${row.created_at}`);
      console.log('');
    }
  } finally {
    await client.end();
  }
}

/**
 * Show recent calls
 */
async function showRecentCalls(): Promise<void> {
  console.log('=== Recent Calls (Today) ===\n');

  const client = await getClient();
  try {
    const result = await client.query(`
      SELECT
        c.id,
        c.twilio_call_sid,
        c.status,
        c.is_billable,
        c.affiliate_payout,
        c.buyer_charge,
        c.cascade_position,
        c.cascade_attempts,
        c.total_duration_seconds,
        c.connected_duration_seconds,
        c.recording_status,
        c.billing_status,
        c.caller_phone,
        b.name as buyer_name,
        a.email as affiliate_email,
        c.created_at
      FROM calls c
      LEFT JOIN buyers b ON c.winning_buyer_id = b.id
      LEFT JOIN affiliates a ON c.affiliate_id = a.id
      WHERE c.created_at > NOW() - INTERVAL '1 day'
      ORDER BY c.created_at DESC
      LIMIT 20;
    `);

    if (result.rows.length === 0) {
      console.log('No calls found in the last 24 hours.');
      return;
    }

    for (const row of result.rows) {
      console.log(`Call SID: ${row.twilio_call_sid}`);
      console.log(`  DB ID: ${row.id}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Billable: ${row.is_billable}`);
      console.log(`  Payout: $${row.affiliate_payout || '0.00'}`);
      console.log(`  Buyer Charge: $${row.buyer_charge || '0.00'}`);
      console.log(`  Duration: ${row.total_duration_seconds}s (connected: ${row.connected_duration_seconds}s)`);
      console.log(`  Cascade: Position ${row.cascade_position}, Attempts ${row.cascade_attempts}`);
      console.log(`  Recording: ${row.recording_status}`);
      console.log(`  Billing: ${row.billing_status}`);
      console.log(`  Caller: ${row.caller_phone}`);
      console.log(`  Buyer: ${row.buyer_name || 'None'}`);
      console.log(`  Affiliate: ${row.affiliate_email || 'N/A'}`);
      console.log(`  Created: ${row.created_at}`);
      console.log('');
    }
  } finally {
    await client.end();
  }
}

/**
 * Show call details by Twilio SID
 */
async function showCallBySid(sid: string): Promise<void> {
  console.log(`=== Call Details for SID: ${sid} ===\n`);

  const client = await getClient();
  try {
    const result = await client.query(`
      SELECT
        c.*,
        b.name as buyer_name,
        a.email as affiliate_email,
        camp.name as campaign_name,
        tn.phone_number as tracking_number
      FROM calls c
      LEFT JOIN buyers b ON c.winning_buyer_id = b.id
      LEFT JOIN affiliates a ON c.affiliate_id = a.id
      LEFT JOIN campaigns camp ON c.campaign_id = camp.id
      LEFT JOIN tracking_numbers tn ON c.tracking_number_id = tn.id
      WHERE c.twilio_call_sid = $1;
    `, [sid]);

    if (result.rows.length === 0) {
      console.log('Call not found with that SID.');
      return;
    }

    const call = result.rows[0];
    console.log('=== Basic Info ===');
    console.log(`  ID: ${call.id}`);
    console.log(`  Twilio SID: ${call.twilio_call_sid}`);
    console.log(`  Status: ${call.status}`);
    console.log(`  Previous Status: ${call.previous_status || 'N/A'}`);

    console.log('\n=== Caller Info ===');
    console.log(`  Phone: ${call.caller_phone}`);
    console.log(`  Display: ${call.caller_phone_display || 'N/A'}`);
    console.log(`  Location: ${call.caller_city || 'N/A'}, ${call.caller_state || 'N/A'} ${call.caller_zip || 'N/A'}`);

    console.log('\n=== Routing ===');
    console.log(`  Tracking Number: ${call.tracking_number || 'N/A'}`);
    console.log(`  Campaign: ${call.campaign_name || 'N/A'}`);
    console.log(`  Affiliate: ${call.affiliate_email || 'N/A'}`);
    console.log(`  Winning Buyer: ${call.buyer_name || 'None'}`);
    console.log(`  Winning Bid: $${call.winning_bid || '0.00'}`);
    console.log(`  Transfer Number: ${call.transfer_phone_number || 'N/A'}`);

    console.log('\n=== IVR ===');
    console.log(`  Is Qualified: ${call.is_qualified}`);
    console.log(`  IVR Responses: ${JSON.stringify(call.ivr_responses) || 'None'}`);

    console.log('\n=== Cascade ===');
    console.log(`  Position: ${call.cascade_position}`);
    console.log(`  Attempts: ${call.cascade_attempts}`);
    console.log(`  Max Depth: ${call.max_cascade_depth}`);

    console.log('\n=== Timing ===');
    console.log(`  Created: ${call.created_at}`);
    console.log(`  Answered: ${call.answered_at || 'N/A'}`);
    console.log(`  IVR Completed: ${call.ivr_completed_at || 'N/A'}`);
    console.log(`  Connected: ${call.connected_at || 'N/A'}`);
    console.log(`  Buyer Answered: ${call.buyer_answered_at || 'N/A'}`);
    console.log(`  Ended: ${call.ended_at || 'N/A'}`);

    console.log('\n=== Duration ===');
    console.log(`  Total: ${call.total_duration_seconds || 0}s`);
    console.log(`  Connected: ${call.connected_duration_seconds || 0}s`);
    console.log(`  Buyer Ring: ${call.buyer_ring_duration_seconds || 0}s`);

    console.log('\n=== Auction ===');
    console.log(`  Started: ${call.auction_started_at || 'N/A'}`);
    console.log(`  Completed: ${call.auction_completed_at || 'N/A'}`);
    console.log(`  Duration: ${call.auction_duration_ms || 0}ms`);
    console.log(`  Eligible Buyers: ${call.eligible_buyers_count || 0}`);

    console.log('\n=== Financials ===');
    console.log(`  Is Billable: ${call.is_billable}`);
    console.log(`  Affiliate Payout: $${call.affiliate_payout || '0.00'}`);
    console.log(`  Buyer Charge: $${call.buyer_charge || '0.00'}`);
    console.log(`  Platform Margin: $${call.platform_margin || '0.00'}`);
    console.log(`  Billing Status: ${call.billing_status}`);
    console.log(`  Billing Finalized: ${call.billing_finalized_at || 'N/A'}`);

    console.log('\n=== Recording ===');
    console.log(`  Status: ${call.recording_status}`);
    console.log(`  SID: ${call.recording_sid || 'N/A'}`);
    console.log(`  URL: ${call.recording_url || 'N/A'}`);
    console.log(`  Duration: ${call.recording_duration_seconds || 0}s`);

    console.log('\n=== Outcome ===');
    console.log(`  Disposition: ${call.disposition || 'N/A'}`);
    console.log(`  Hangup Reason: ${call.hangup_reason || 'N/A'}`);
    console.log(`  Abandonment Phase: ${call.abandonment_phase || 'N/A'}`);
    console.log(`  Abandonment Reason: ${call.abandonment_reason || 'N/A'}`);

    console.log('\n=== Postback ===');
    console.log(`  Sent: ${call.postback_sent}`);
    console.log(`  Sent At: ${call.postback_sent_at || 'N/A'}`);

  } finally {
    await client.end();
  }
}

/**
 * Show call details by database ID
 */
async function showCallById(id: string): Promise<void> {
  console.log(`=== Call Details for ID: ${id} ===\n`);

  const client = await getClient();
  try {
    const result = await client.query(`
      SELECT twilio_call_sid FROM calls WHERE id = $1;
    `, [id]);

    if (result.rows.length === 0) {
      console.log('Call not found with that ID.');
      return;
    }

    await showCallBySid(result.rows[0].twilio_call_sid);
  } finally {
    await client.end();
  }
}

/**
 * Show cascade attempts for a call
 */
async function showCascadeAttempts(callId: string): Promise<void> {
  console.log(`=== Cascade Attempts for Call: ${callId} ===\n`);

  const client = await getClient();
  try {
    // First get the call to find the twilio_call_sid
    const callResult = await client.query(`
      SELECT id, twilio_call_sid, cascade_position, cascade_attempts, max_cascade_depth
      FROM calls
      WHERE id = $1 OR twilio_call_sid = $1;
    `, [callId]);

    if (callResult.rows.length === 0) {
      console.log('Call not found.');
      return;
    }

    const call = callResult.rows[0];
    console.log(`Call ID: ${call.id}`);
    console.log(`Twilio SID: ${call.twilio_call_sid}`);
    console.log(`Final Cascade Position: ${call.cascade_position}`);
    console.log(`Total Attempts: ${call.cascade_attempts}`);
    console.log(`Max Depth: ${call.max_cascade_depth}`);

    // Get call bids
    const bidsResult = await client.query(`
      SELECT
        cb.*,
        b.name as buyer_name,
        b.call_forwarding_number
      FROM call_bids cb
      JOIN buyers b ON cb.buyer_id = b.id
      WHERE cb.call_id = $1
      ORDER BY cb.created_at;
    `, [call.id]);

    console.log(`\n=== Bids (${bidsResult.rows.length} total) ===`);
    for (const bid of bidsResult.rows) {
      console.log(`\n  Buyer: ${bid.buyer_name}`);
      console.log(`    Bid Amount: $${bid.bid_amount}`);
      console.log(`    Status: ${bid.bid_status}`);
      console.log(`    Response Time: ${bid.response_time_ms || 'N/A'}ms`);
      console.log(`    Transfer Number: ${bid.transfer_number || bid.call_forwarding_number || 'N/A'}`);
      console.log(`    Created: ${bid.created_at}`);
    }

    // Get activity logs
    const logsResult = await client.query(`
      SELECT
        timestamp,
        event,
        message,
        level,
        details
      FROM call_activity_logs
      WHERE call_id = $1
      ORDER BY timestamp;
    `, [call.id]);

    console.log(`\n=== Activity Log (${logsResult.rows.length} entries) ===`);
    for (const log of logsResult.rows) {
      const time = new Date(log.timestamp).toISOString().split('T')[1].split('.')[0];
      console.log(`  [${time}] ${log.level.toUpperCase().padEnd(5)} ${log.event}: ${log.message}`);
      if (log.details) {
        console.log(`           Details: ${JSON.stringify(log.details)}`);
      }
    }

  } finally {
    await client.end();
  }
}

/**
 * Run billing validation checks
 */
async function runValidation(): Promise<void> {
  console.log('=== Billing Validation ===\n');

  const client = await getClient();
  try {
    // Check for billable calls without payout
    const billableNoPayout = await client.query(`
      SELECT id, twilio_call_sid, is_billable, affiliate_payout
      FROM calls
      WHERE is_billable = true
      AND (affiliate_payout IS NULL OR affiliate_payout = 0)
      AND created_at > NOW() - INTERVAL '1 day';
    `);

    console.log('=== Billable Calls Without Payout ===');
    if (billableNoPayout.rows.length === 0) {
      console.log('PASS: All billable calls have payouts');
    } else {
      console.log(`WARNING: ${billableNoPayout.rows.length} billable calls without payout:`);
      for (const row of billableNoPayout.rows) {
        console.log(`  - ${row.twilio_call_sid} (billable: ${row.is_billable}, payout: ${row.affiliate_payout})`);
      }
    }

    // Check for non-billable calls with payout
    const nonBillableWithPayout = await client.query(`
      SELECT id, twilio_call_sid, is_billable, affiliate_payout
      FROM calls
      WHERE is_billable = false
      AND affiliate_payout > 0
      AND created_at > NOW() - INTERVAL '1 day';
    `);

    console.log('\n=== Non-Billable Calls With Payout ===');
    if (nonBillableWithPayout.rows.length === 0) {
      console.log('PASS: No non-billable calls have payouts');
    } else {
      console.log(`ERROR: ${nonBillableWithPayout.rows.length} non-billable calls with payout:`);
      for (const row of nonBillableWithPayout.rows) {
        console.log(`  - ${row.twilio_call_sid} (billable: ${row.is_billable}, payout: ${row.affiliate_payout})`);
      }
    }

    // Check cascade depth limit
    const overCascade = await client.query(`
      SELECT id, twilio_call_sid, cascade_attempts, max_cascade_depth
      FROM calls
      WHERE cascade_attempts > max_cascade_depth
      AND created_at > NOW() - INTERVAL '1 day';
    `);

    console.log('\n=== Cascade Depth Violations ===');
    if (overCascade.rows.length === 0) {
      console.log('PASS: No cascade depth violations');
    } else {
      console.log(`ERROR: ${overCascade.rows.length} calls exceeded cascade depth:`);
      for (const row of overCascade.rows) {
        console.log(`  - ${row.twilio_call_sid} (attempts: ${row.cascade_attempts}, max: ${row.max_cascade_depth})`);
      }
    }

    // Summary stats
    const stats = await client.query(`
      SELECT
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE is_billable = true) as billable_calls,
        COUNT(*) FILTER (WHERE is_billable = false) as non_billable_calls,
        SUM(affiliate_payout) as total_payouts,
        SUM(buyer_charge) as total_buyer_charges,
        SUM(platform_margin) as total_margin
      FROM calls
      WHERE created_at > NOW() - INTERVAL '1 day';
    `);

    const s = stats.rows[0];
    console.log('\n=== Today\'s Summary ===');
    console.log(`  Total Calls: ${s.total_calls}`);
    console.log(`  Billable: ${s.billable_calls}`);
    console.log(`  Non-Billable: ${s.non_billable_calls}`);
    console.log(`  Total Payouts: $${s.total_payouts || '0.00'}`);
    console.log(`  Total Buyer Charges: $${s.total_buyer_charges || '0.00'}`);
    console.log(`  Total Margin: $${s.total_margin || '0.00'}`);

  } finally {
    await client.end();
  }
}

/**
 * Main entry point
 */
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  console.log('=========================================');
  console.log('  Database Verification Script');
  console.log('=========================================\n');

  if (!connectionString) {
    console.error('ERROR: DATABASE_URL must be set in .env');
    process.exit(1);
  }

  switch (command) {
    case 'tracking-numbers':
      await listTrackingNumbers();
      break;

    case 'recent-calls':
      await showRecentCalls();
      break;

    case 'call':
      if (!arg) {
        console.error('Usage: npx tsx scripts/verify-call-db.ts call <twilio_call_sid>');
        process.exit(1);
      }
      await showCallBySid(arg);
      break;

    case 'call-id':
      if (!arg) {
        console.error('Usage: npx tsx scripts/verify-call-db.ts call-id <database_id>');
        process.exit(1);
      }
      await showCallById(arg);
      break;

    case 'cascade':
      if (!arg) {
        console.error('Usage: npx tsx scripts/verify-call-db.ts cascade <call_id_or_sid>');
        process.exit(1);
      }
      await showCascadeAttempts(arg);
      break;

    case 'validate':
      await runValidation();
      break;

    default:
      console.log('Usage: npx tsx scripts/verify-call-db.ts <command> [args]');
      console.log('\nCommands:');
      console.log('  tracking-numbers    - List all tracking numbers');
      console.log('  recent-calls        - Show recent calls from today');
      console.log('  call <sid>          - Show details for a specific call by Twilio SID');
      console.log('  call-id <id>        - Show details for a specific call by database ID');
      console.log('  cascade <call_id>   - Show cascade attempts for a call');
      console.log('  validate            - Run billing validation checks');
      process.exit(1);
  }
}

main().catch(console.error);
