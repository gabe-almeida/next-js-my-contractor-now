# Call Recording & Compliance

> **Section:** 09 | **Phase:** 1 (MVP)
> **Parent:** [spec.md](../spec.md)

---

## Overview

Recording strategy, storage, access control, and compliance requirements.

## Recording Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CALL RECORDING                                         │
└─────────────────────────────────────────────────────────────────────────────────┘

WHAT WE RECORD:
───────────────
• Full call from answer to hangup
• Both sides (dual-channel) for quality
• IVR interactions + live conversation

TWILIO CONFIGURATION:
─────────────────────
<Dial
  record="record-from-ringing-dual"
  recordingStatusCallback="/api/calls/recording"
  recordingStatusCallbackEvent="completed"
>

STORAGE FLOW:
─────────────
1. Call ends → Twilio sends recording webhook
2. We download from Twilio's temporary URL
3. Upload to our S3 bucket (encrypted at rest)
4. Update call.recording_url with our permanent URL
5. Delete from Twilio after 24h (cost saving)

ACCESS CONTROL:
───────────────
• Affiliates: Can listen to their own calls only
• Buyers: Can listen to calls they won
• Admins: Can listen to all calls
• Recordings stored permanently (never auto-deleted)

COMPLIANCE:
───────────
• IVR says "This call may be recorded for quality assurance"
• Complies with two-party consent states (both parties hear message)
• Recording stored with encryption (AES-256)
• GDPR: Recordings deletable on request
```

## Complete Twilio Recording Webhook Parameters

> **WHY this matters for debugging**: Recording webhooks contain rich metadata about the recording process. Understanding ALL available parameters helps diagnose "where did my recording go?" issues.

```typescript
/**
 * WHY: Recording webhooks tell us when recordings are ready (or failed).
 *      Every field helps debug recording issues - missing files, failed processing, etc.
 * WHEN: Twilio POSTs to our recordingStatusCallback URL after recording completes
 * HOW: Parse all fields, store critical ones, log everything for debugging
 */
interface TwilioRecordingWebhook {
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE IDENTIFIERS - Always present, always log these
  // ═══════════════════════════════════════════════════════════════════════════

  /** Parent call SID - links recording to the call */
  CallSid: string;

  /** Twilio account SID - verify this matches our account */
  AccountSid: string;

  /**
   * Unique recording identifier
   * WHY: Use this for idempotency, downloading, and deletion
   */
  RecordingSid: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // RECORDING DETAILS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * URL to download recording
   * NOTE: Add .mp3 or .wav extension to specify format
   * WHY: This is the file we download and store in S3
   * IMPORTANT: URL requires authentication (account SID:auth token)
   */
  RecordingUrl: string;

  /**
   * Recording status:
   * - 'in-progress': Recording is still being created (call ongoing)
   * - 'completed': Recording finished successfully, ready for download
   * - 'failed': Recording could not be created (check ErrorCode)
   * - 'absent': No recording produced (see note below)
   */
  RecordingStatus: 'in-progress' | 'completed' | 'failed' | 'absent';

  /**
   * Duration of the recording in seconds
   * WHY: Used for display and to verify recording captured full call
   * NOTE: May differ slightly from call duration due to processing
   */
  RecordingDuration: string;

  /**
   * Number of audio channels:
   * - '1': Mono (both parties mixed together)
   * - '2': Dual-channel (caller on left, callee on right)
   * WHY: Dual-channel is better for dispute resolution (hear each side)
   */
  RecordingChannels: '1' | '2';

  /**
   * Source of the recording:
   * - 'DialVerb': Recording started by <Dial> with record attribute
   * - 'Conference': Recording from <Conference>
   * - 'OutboundAPI': Recording from outbound API call
   * - 'Trunking': Recording from SIP trunk
   * - 'RecordVerb': Recording from <Record> TwiML verb
   * - 'StartCallRecordingAPI': Recording started via REST API
   * WHY: Helps understand how recording was initiated
   */
  RecordingSource: 'DialVerb' | 'Conference' | 'OutboundAPI' | 'Trunking' | 'RecordVerb' | 'StartCallRecordingAPI';

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMESTAMPS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * When recording started (ISO 8601 format)
   * WHY: Useful for syncing with call timeline
   */
  RecordingStartTime?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR INFO (when status is 'failed')
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Twilio error code if recording failed
   * WHY: Helps diagnose why recording couldn't be created
   * Common codes: 32001 (general failure), 32002 (storage failed)
   */
  ErrorCode?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK INFO (for dual-channel recordings)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Which tracks are included:
   * - 'inbound': Only the inbound leg (caller)
   * - 'outbound': Only the outbound leg (callee/buyer)
   * - 'both': Both legs (standard dual-channel)
   * WHY: Helps verify we're recording both sides of conversation
   */
  RecordingTrack?: 'inbound' | 'outbound' | 'both';

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL CONTEXT (may appear in some recordings)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Conference SID if recording is from a conference */
  ConferenceSid?: string;

  /** Room SID if recording is from a Video room */
  RoomSid?: string;
}
```

### Understanding `absent` Recording Status

> **IMPORTANT**: The `absent` status is NOT an error - it means no recording was produced. This can happen in several legitimate scenarios:

```
WHY 'absent' occurs:
───────────────────────
1. Call too short - Call ended before recording could start (< 2 seconds)
2. Recording disabled mid-call - Admin/TwiML stopped recording
3. No audio detected - Silent call (possible fraud or technical issue)
4. Recording paused - Recording was paused and never resumed
5. Privacy/compliance - Recording blocked by carrier or regulation

HOW to handle 'absent':
───────────────────────
- DO NOT treat as error - it's a valid, expected status
- Log for analytics - track absent rate for fraud detection
- Update call record - recordingStatus = 'ABSENT'
- Don't retry - recording cannot be recovered if absent
- Proceed with billing - absence of recording doesn't affect call validity
```

---

## Recording Webhook Handler (With Race Condition Prevention)

```typescript
// src/app/api/calls/recording/route.ts

// See TwilioRecordingWebhook interface above for all available fields

/**
 * WHY: Twilio recording webhook may arrive before/after call completion webhook
 * WHEN: Called when Twilio sends recording status callback
 * HOW: Uses idempotency key and handles ordering gracefully
 */
export async function POST(request: Request) {
  const body = await parseFormData(request);

  // CRITICAL: Validate webhook signature first
  if (!verifyTwilioSignature(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Idempotency check - prevent duplicate processing
  const idempotencyKey = `recording:${body.RecordingSid}:${body.RecordingStatus}`;
  const alreadyProcessed = await isWebhookProcessed('recording', body.RecordingSid, body.RecordingStatus);

  if (alreadyProcessed) {
    logger.info('Recording webhook already processed', { recordingSid: body.RecordingSid });
    return new Response('Already processed');
  }

  // Handle in-progress status (recording still going)
  if (body.RecordingStatus === 'in-progress') {
    logger.info('Recording in progress', { recordingSid: body.RecordingSid });
    return new Response('Acknowledged');
  }

  // Handle failed recordings
  if (body.RecordingStatus === 'failed') {
    await handleFailedRecording(body.CallSid, body.RecordingSid);
    return new Response('Failure recorded');
  }

  // 1. Find the call by Twilio SID
  const call = await prisma.call.findUnique({
    where: { twilioCallSid: body.CallSid }
  });

  if (!call) {
    // Recording webhook arrived before call record exists - queue for retry
    await queueRecordingForRetry(body, 'CALL_NOT_FOUND');
    return new Response('Queued for retry');
  }

  // 2. Download from Twilio with retry logic
  let recordingBuffer: Buffer;
  try {
    recordingBuffer = await downloadRecordingWithRetry(body.RecordingUrl, {
      maxRetries: 3,
      retryDelayMs: 2000
    });
  } catch (error) {
    logger.error('Failed to download recording after retries', { error, recordingSid: body.RecordingSid });
    await prisma.call.update({
      where: { id: call.id },
      data: {
        recordingStatus: 'DOWNLOAD_FAILED',
        recordingError: error.message
      }
    });
    return new Response('Download failed');
  }

  // 3. Upload to S3 with retry logic
  let s3Url: string;
  try {
    s3Url = await uploadToS3WithRetry(recordingBuffer, call.id, {
      maxRetries: 3,
      retryDelayMs: 2000
    });
  } catch (error) {
    logger.error('Failed to upload recording to S3', { error, callId: call.id });
    await prisma.call.update({
      where: { id: call.id },
      data: {
        recordingStatus: 'UPLOAD_FAILED',
        recordingError: error.message,
        twilioRecordingUrl: body.RecordingUrl // Keep Twilio URL for manual recovery
      }
    });
    return new Response('Upload failed');
  }

  // 4. Update call record atomically
  await prisma.call.update({
    where: { id: call.id },
    data: {
      recordingUrl: s3Url,
      recordingDurationSeconds: parseInt(body.RecordingDuration),
      recordingStatus: 'AVAILABLE',
      twilioRecordingSid: body.RecordingSid
    }
  });

  // 5. Schedule Twilio recording deletion (cost saving)
  await scheduleRecordingDeletion(body.RecordingSid, 24 * 60 * 60);

  return new Response('OK');
}

/**
 * WHY: Handle download failures with exponential backoff
 * WHEN: Twilio recording may not be immediately available
 * HOW: Retry with increasing delays
 */
async function downloadRecordingWithRetry(
  url: string,
  options: { maxRetries: number; retryDelayMs: number }
): Promise<Buffer> {
  let lastError: Error;

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      const response = await fetch(url + '.mp3', {
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`
        }
      });

      if (response.status === 404) {
        // Recording not yet available - wait and retry
        await sleep(options.retryDelayMs * attempt);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      await sleep(options.retryDelayMs * attempt);
    }
  }

  throw lastError;
}
```

---

## Recording Status States

```typescript
type RecordingStatus =
  | 'PENDING'         // Call in progress, recording not started
  | 'RECORDING'       // Recording in progress
  | 'PROCESSING'      // Twilio processing recording
  | 'DOWNLOAD_FAILED' // Failed to download from Twilio
  | 'UPLOAD_FAILED'   // Failed to upload to S3
  | 'AVAILABLE'       // Ready for playback
  | 'DELETED';        // Manually deleted (GDPR request or admin action)
```

---

## Race Condition: Recording vs Completion Webhooks

**Problem**: Recording webhook may arrive before or after call status webhook.

```typescript
/**
 * WHY: Recording webhook may arrive while call is still being finalized
 * WHEN: Call ends but recording processing takes longer
 * HOW: Check recording status before finalizing call billing
 */
export async function finalizeCallBilling(callId: string): Promise<void> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: {
      recordingStatus: true,
      status: true,
      durationSeconds: true
    }
  });

  // If recording is still processing, wait or use webhook
  if (call.recordingStatus === 'PENDING' || call.recordingStatus === 'RECORDING') {
    // Option 1: Wait briefly for recording (only for short calls)
    if (call.durationSeconds < 30) {
      await sleep(5000);
      return finalizeCallBilling(callId); // Retry once
    }

    // Option 2: Mark as pending billing, finalize when recording arrives
    await prisma.call.update({
      where: { id: callId },
      data: { billingStatus: 'PENDING_RECORDING' }
    });
    return;
  }

  // Recording available or failed - proceed with billing
  await calculateAndApplyBilling(callId);
}
```

## Recording Player Component

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CALL RECORDING                                                          [X]    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Campaign: Windows Repair                                                        │
│  Date: January 15, 2025 at 3:42 PM                                              │
│  Caller: (555) 123-4567                                                         │
│  Duration: 4:32                                                                  │
│  Status: ✅ Qualified - $35.00                                                  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                            │  │
│  │   ▶️  ━━━━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━  2:15 / 4:32            │  │
│  │       [⏪ 15s]              [⏸️ Pause]              [15s ⏩]               │  │
│  │                                                                            │  │
│  │   🔊 Volume: ━━━━━━━━━●━━━━━━━                                             │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  CALL DETAILS:                                                                   │
│  ├── Answered by: ABC Plumbing (Contractor)                                     │
│  ├── Winning bid: $58.00                                                        │
│  ├── Your payout: $35.00                                                        │
│  └── IVR responses: Owns home, Repair needed                                    │
│                                                                                  │
│  [Download Recording]                                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Access Control Logic

```typescript
// src/lib/services/recording-service.ts

export async function canAccessRecording(
  userId: string,
  userRole: string,
  callId: string
): Promise<boolean> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      trackingNumber: {
        include: { affiliate: true }
      }
    }
  });

  // Admins can access all
  if (userRole === 'ADMIN') return true;

  // Affiliates can access their own calls
  if (userRole === 'AFFILIATE') {
    return call.trackingNumber.affiliate.userId === userId;
  }

  // Buyers can access calls they won
  if (userRole === 'BUYER') {
    return call.winningBuyerId === userId;
  }

  return false;
}
```

## Two-Party Consent States

Calls to these states MUST include recording disclosure:

- California, Connecticut, Delaware, Florida, Illinois
- Maryland, Massachusetts, Michigan, Montana, Nevada
- New Hampshire, Oregon, Pennsylvania, Vermont, Washington

Our IVR always includes: "This call may be recorded for quality assurance."

---

## User Stories

### US-REC-1: Affiliate Wants to Review Call Quality
**WHY**: Affiliates need to verify lead quality and train their marketing
**WHEN**: Affiliate opens call details for a completed call
**HOW**:
- Recording player loads if recording is available
- Loading state while recording is processing
- Clear error message if recording failed
- No recording shown for calls < 5 seconds (incomplete)

**Acceptance Criteria**:
- [ ] Recording plays smoothly with standard controls (play, pause, seek)
- [ ] Skip forward/back 15 seconds buttons work
- [ ] Volume control works
- [ ] Loading spinner shown while audio buffers
- [ ] Error message if recording unavailable with reason

---

### US-REC-2: Recording Not Yet Available
**WHY**: Twilio processing takes time, user shouldn't see broken UI
**WHEN**: User views call immediately after it ends
**HOW**:
- Show "Recording processing..." message with spinner
- Auto-refresh or WebSocket update when available
- Estimated time: "Usually ready in 1-2 minutes"

**Acceptance Criteria**:
- [ ] Processing state clearly communicated
- [ ] No error shown for pending recordings
- [ ] Auto-updates when recording becomes available
- [ ] User can continue browsing other calls

---

### US-REC-3: Buyer Needs Call Recording for Dispute
**WHY**: Buyers may dispute lead quality, recording is evidence
**WHEN**: Buyer opens dispute form for a call they purchased
**HOW**:
- Recording accessible in dispute flow
- Download button available for dispute cases
- Recording preserved until dispute resolved (permanent storage)

**Acceptance Criteria**:
- [ ] Recording accessible during dispute
- [ ] Download creates audit log entry
- [ ] Recording stored permanently (never auto-deleted)
- [ ] Admin can extend retention for legal hold

---

### US-REC-4: GDPR Deletion Request
**WHY**: Callers have right to request data deletion
**WHEN**: GDPR deletion request received for caller phone number
**HOW**:
- Find all calls from that phone number
- Delete recordings from S3
- Clear personal data from call records
- Keep anonymized transaction records for accounting

**Acceptance Criteria**:
- [ ] All recordings deleted for phone number
- [ ] Personal data (name, phone) anonymized
- [ ] Transaction amounts preserved (anonymized)
- [ ] Deletion logged for compliance audit
- [ ] Cannot be undone after 30-day grace period

---

## Recording Player Error States

```typescript
interface RecordingPlayerProps {
  callId: string;
  recordingUrl: string | null;
  recordingStatus: RecordingStatus;
}

function RecordingPlayer({ callId, recordingUrl, recordingStatus }: RecordingPlayerProps) {
  switch (recordingStatus) {
    case 'PENDING':
    case 'RECORDING':
    case 'PROCESSING':
      return <RecordingProcessing estimatedTime="1-2 minutes" />;

    case 'DOWNLOAD_FAILED':
      return (
        <RecordingError
          title="Recording Download Failed"
          message="We couldn't retrieve this recording from our provider."
          canRetry={true}
          onRetry={() => retryRecordingDownload(callId)}
        />
      );

    case 'UPLOAD_FAILED':
      return (
        <RecordingError
          title="Recording Storage Failed"
          message="The recording couldn't be saved. It may still be available temporarily."
          canRetry={true}
          onRetry={() => retryRecordingUpload(callId)}
        />
      );

    case 'AVAILABLE':
      return <AudioPlayer src={recordingUrl} />;

    case 'DELETED':
      return (
        <RecordingError
          title="Recording Deleted"
          message="This recording was deleted per user request (GDPR) or admin action."
          canRetry={false}
        />
      );

    default:
      return (
        <RecordingError
          title="Recording Unavailable"
          message="Unable to load this recording."
          canRetry={false}
        />
      );
  }
}
```

---

## Implementation Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-REC-1 | Create `/api/calls/recording/route.ts` | ⬜ |
| P1-REC-2 | Implement recording download from Twilio | ⬜ |
| P1-REC-3 | Implement S3 upload with encryption | ⬜ |
| P1-REC-4 | Update call record with recording URL | ⬜ |
| P1-REC-5 | Schedule Twilio recording deletion | ⬜ |
| P1-REC-6 | Create RecordingPlayer component | ⬜ |
| P1-REC-7 | Implement recording access control | ⬜ |
| P1-REC-8 | Add recording disclosure to IVR | ⬜ |
| P1-REC-9 | Add `recordingStatus` column to calls table | ⬜ |
| P1-REC-10 | Create RecordingProcessing component | ⬜ |
| P1-REC-11 | Create RecordingError component with retry | ⬜ |
| P3-REC-1 | Add GDPR deletion endpoint | ⬜ |
| P3-REC-2 | Add legal hold for dispute cases | ⬜ |

### Race Condition Prevention Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-REC-RC-1 | Add idempotency check for recording webhooks | ⬜ |
| P1-REC-RC-2 | Handle recording webhook before call record exists | ⬜ |
| P1-REC-RC-3 | Implement download with retry and exponential backoff | ⬜ |
| P1-REC-RC-4 | Implement S3 upload with retry logic | ⬜ |
| P1-REC-RC-5 | Add `PENDING_RECORDING` billing status | ⬜ |
| P1-REC-RC-6 | Handle recording vs completion webhook ordering | ⬜ |

### Error Handling Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-REC-ERR-1 | Store Twilio URL as fallback on upload failure | ⬜ |
| P1-REC-ERR-2 | Create manual recording recovery admin action | ⬜ |
| P1-REC-ERR-3 | Add recording failure alerts to monitoring | ⬜ |
| P1-REC-ERR-4 | Create failed recording queue with retry mechanism | ⬜ |

### UI/UX Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-REC-UX-1 | Show recording processing state in call details | ⬜ |
| P1-REC-UX-2 | Auto-refresh when recording becomes available | ⬜ |
| P1-REC-UX-3 | Add download button with access logging | ⬜ |
| P1-REC-UX-4 | Show skip forward/back 15s buttons | ⬜ |
| P1-REC-UX-5 | Add playback speed control (0.5x, 1x, 1.5x, 2x) | ⬜ |

### Logging Tasks

> **See Also**: [Section 12: Logging & Observability](./12-logging-observability.md) for full logging architecture

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-REC-LOG-1 | Log recording webhook received with RecordingSid | ⬜ |
| P1-REC-LOG-2 | Log download start/success/failure with duration | ⬜ |
| P1-REC-LOG-3 | Log S3 upload start/success/failure with file size | ⬜ |
| P1-REC-LOG-4 | Log recording status transitions (affiliate-visible when AVAILABLE) | ⬜ |
| P1-REC-LOG-5 | Log recording access attempts with user role | ⬜ |
| P1-REC-LOG-6 | Log recording download requests (audit trail) | ⬜ |
| P1-REC-LOG-7 | Log GDPR deletion requests and completions | ⬜ |
| P1-REC-LOG-8 | Log Twilio recording deletion (cost-saving step) | ⬜ |
| P1-REC-LOG-10 | Log recording retry attempts for failed downloads/uploads | ⬜ |

**Recording Events to Log:**

| Event | Level | Affiliate-Visible | Description |
|-------|-------|-------------------|-------------|
| `recording.webhook_received` | debug | ❌ | Twilio callback received |
| `recording.download_started` | debug | ❌ | Downloading from Twilio |
| `recording.download_success` | info | ❌ | Download completed |
| `recording.download_failed` | error | ❌ | Download failed after retries |
| `recording.upload_success` | info | ❌ | Uploaded to S3 |
| `recording.upload_failed` | error | ❌ | S3 upload failed |
| `recording.available` | info | ✅ | Recording ready for playback |
| `recording.accessed` | info | ❌ | User played recording |
| `recording.downloaded` | info | ❌ | User downloaded recording |
| `recording.deleted` | info | ❌ | Recording deleted (GDPR/admin) |

---

### Testing Tasks

| Task ID | Description | Status |
|---------|-------------|--------|
| P1-REC-T1 | Test recording webhook idempotency | ⬜ |
| P1-REC-T2 | Test download retry with Twilio 404 | ⬜ |
| P1-REC-T3 | Test S3 upload failure recovery | ⬜ |
| P1-REC-T4 | Test recording status transitions | ⬜ |
| P1-REC-T5 | Test access control for affiliate/buyer/admin | ⬜ |
| P1-REC-T6 | Test GDPR deletion workflow | ⬜ |

---

## Race Condition Summary

| Scenario | Prevention | Implementation |
|----------|------------|----------------|
| Duplicate recording webhooks | Idempotency key | `isWebhookProcessed()` check |
| Recording before call exists | Queue for retry | `queueRecordingForRetry()` |
| Twilio 404 (not ready) | Retry with backoff | `downloadRecordingWithRetry()` |
| S3 upload failure | Keep Twilio URL | `twilioRecordingUrl` fallback column |
| Billing before recording | Status tracking | `PENDING_RECORDING` billing status |
| Recording during dispute | Legal hold | Permanent storage (no auto-delete) |

---

## Sentry Integration

> **Error Tracking**: All recording failures and access control violations are tracked in Sentry

### Recording Transaction Tracking

```typescript
import * as Sentry from '@sentry/nextjs';

/**
 * WHY: Track recording processing as a transaction for performance monitoring
 * WHEN: Recording webhook received from Twilio
 * HOW: Wrap entire recording flow in Sentry transaction with spans
 */
async function processRecordingWebhook(body: RecordingWebhook): Promise<void> {
  const transaction = Sentry.startTransaction({
    name: 'recording.process',
    op: 'recording',
    data: {
      recordingSid: body.RecordingSid,
      callSid: body.CallSid,
      status: body.RecordingStatus
    }
  });

  Sentry.setContext('recording', {
    recordingSid: body.RecordingSid,
    callSid: body.CallSid,
    duration: body.RecordingDuration
  });

  try {
    // Download span
    const downloadSpan = transaction.startChild({
      op: 'http.download',
      description: 'Download recording from Twilio'
    });

    const buffer = await downloadRecordingWithRetry(body.RecordingUrl, { maxRetries: 3, retryDelayMs: 2000 });
    downloadSpan.setData('size_bytes', buffer.length);
    downloadSpan.finish();

    // Upload span
    const uploadSpan = transaction.startChild({
      op: 's3.upload',
      description: 'Upload recording to S3'
    });

    const s3Url = await uploadToS3WithRetry(buffer, callId, { maxRetries: 3, retryDelayMs: 2000 });
    uploadSpan.finish();

    Sentry.addBreadcrumb({
      category: 'recording.success',
      message: 'Recording processed successfully',
      level: 'info',
      data: { recordingSid: body.RecordingSid, s3Url }
    });

    transaction.setStatus('ok');
  } catch (error) {
    transaction.setStatus('internal_error');
    throw error;
  } finally {
    transaction.finish();
  }
}
```

### Sentry Events Table

| Event | Level | Trigger | Context |
|-------|-------|---------|---------|
| `recording.download_failed` | error | Download fails after all retries | recordingSid, callSid, attempts, lastError |
| `recording.upload_failed` | error | S3 upload fails after all retries | recordingSid, callId, fileSize, lastError |
| `recording.access_denied` | warning | Unauthorized access attempt | userId, userRole, callId, requestedAction |
| `recording.gdpr_deletion` | info | Recording deleted per GDPR request | callId, callerPhone (masked), requestedBy |
| `recording.webhook_duplicate` | info | Duplicate webhook detected | recordingSid, status, idempotencyKey |
| `recording.call_not_found` | warning | Recording webhook before call record exists | recordingSid, callSid, queuedForRetry |
| `recording.retry_exhausted` | error | Max retries reached for download/upload | operation, attempts, finalError |

### Error Capture Patterns

```typescript
// Download failure with full context
catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: 'recording',
      operation: 'download',
      provider: 'twilio'
    },
    extra: {
      recordingSid: body.RecordingSid,
      callSid: body.CallSid,
      url: body.RecordingUrl,
      attempts: retryCount,
      lastHttpStatus: response?.status
    }
  });
}

// S3 upload failure
catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: 'recording',
      operation: 'upload',
      storage: 's3'
    },
    extra: {
      callId,
      recordingSid: body.RecordingSid,
      fileSizeBytes: buffer.length,
      bucket: S3_BUCKET_NAME
    }
  });
}

// Access control violation
if (!await canAccessRecording(userId, userRole, callId)) {
  Sentry.captureMessage('Recording access denied', {
    level: 'warning',
    tags: { component: 'recording', operation: 'access' },
    extra: { userId, userRole, callId, action: 'playback' }
  });
}
```

### Breadcrumb Trail

```typescript
// Recording lifecycle breadcrumbs
Sentry.addBreadcrumb({
  category: 'recording.webhook',
  message: 'Recording webhook received',
  level: 'info',
  data: { recordingSid, status: body.RecordingStatus }
});

Sentry.addBreadcrumb({
  category: 'recording.download',
  message: 'Download started',
  level: 'debug',
  data: { url: body.RecordingUrl, attempt: 1 }
});

Sentry.addBreadcrumb({
  category: 'recording.upload',
  message: 'S3 upload complete',
  level: 'info',
  data: { callId, sizeBytes: buffer.length }
});

Sentry.addBreadcrumb({
  category: 'recording.access',
  message: 'Recording accessed',
  level: 'info',
  data: { userId, userRole, action: 'download' }
});
```

### Alert Configuration

| Alert | Condition | Severity |
|-------|-----------|----------|
| Recording Download Failures | > 5 failures in 10 minutes | P2 (High) |
| S3 Upload Failures | > 3 failures in 10 minutes | P1 (Critical) |
| Access Violations | > 10 unauthorized attempts in 1 hour | P3 (Medium) |
| GDPR Deletions | Any deletion | P4 (Info - audit log) |

---

---

## Recording-Specific Error Codes Reference

> **WHY this matters**: When recordings fail, these codes tell you exactly what went wrong.

| Code | Name | Description | Recommended Action |
|------|------|-------------|-------------------|
| 32001 | Recording failed | General recording failure - could not create | Log and continue, check Twilio status page |
| 32002 | Recording storage failed | Recording created but storage callback failed | Check storage callback URL accessibility |
| 32003 | Recording too short | Call duration below minimum threshold | Expected for quick hangups, no action needed |
| 32004 | Recording configuration error | Invalid recording settings in TwiML | Review TwiML builder, check attribute values |
| 32005 | Recording permission denied | Account doesn't have recording permissions | Check Twilio account settings |
| 32006 | Recording format unsupported | Requested format not available | Use .mp3 or .wav only |
| 32007 | Recording encryption failed | Could not encrypt recording | Check encryption settings, contact Twilio |

---

## Recording Download Error Handling

> **WHY this matters**: Downloads from Twilio can fail for various reasons. Understanding these helps build resilient download logic.

```typescript
/**
 * HTTP Status codes when downloading from RecordingUrl:
 *
 * 200 - Success: Recording downloaded
 * 401 - Unauthorized: Missing or invalid auth (AccountSid:AuthToken)
 * 403 - Forbidden: Account doesn't own this recording
 * 404 - Not Found: Recording not yet available OR has been deleted
 *       NOTE: May take 1-30 seconds after webhook for file to be downloadable
 * 410 - Gone: Recording was deleted (retention policy or manual)
 * 429 - Too Many Requests: Rate limited, slow down
 * 500 - Server Error: Twilio issue, retry with backoff
 * 503 - Service Unavailable: Twilio overloaded, retry later
 */

interface RecordingDownloadResult {
  success: boolean;
  data?: Buffer;
  error?: {
    httpStatus: number;
    message: string;
    retryable: boolean;
    retryAfterMs?: number;
  };
}

// Retry strategy based on error type
const DOWNLOAD_RETRY_STRATEGY: Record<number, { retryable: boolean; delayMs: number }> = {
  401: { retryable: false, delayMs: 0 },     // Auth error - fix config, don't retry
  403: { retryable: false, delayMs: 0 },     // Permission error - won't change
  404: { retryable: true, delayMs: 2000 },   // Not ready yet - wait and retry
  410: { retryable: false, delayMs: 0 },     // Deleted - can't recover
  429: { retryable: true, delayMs: 5000 },   // Rate limited - back off
  500: { retryable: true, delayMs: 3000 },   // Server error - retry
  503: { retryable: true, delayMs: 5000 },   // Overloaded - wait longer
};
```

---

## Recording Debugging Checklist

When a recording is missing or failed, check these in order:

### 1. Check Recording Webhook Received
```sql
SELECT * FROM webhook_events
WHERE event_type = 'recording'
AND external_id = 'RS...' -- RecordingSid
ORDER BY created_at DESC;
```

### 2. Check Recording Status in Call Record
```sql
SELECT id, twilio_call_sid, recording_status, recording_url,
       twilio_recording_sid, recording_error
FROM calls
WHERE twilio_call_sid = 'CA...'
```

### 3. Check Twilio Console
- Go to Monitor > Calls > [CallSid]
- Look at "Recordings" tab
- Check status and any error messages

### 4. Common Causes of Missing Recordings

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| No webhook received | URL not configured or unreachable | Verify recordingStatusCallback URL |
| Status is 'absent' | Call too short or no audio | Expected behavior, no action |
| Status is 'failed' | Twilio processing error | Check ErrorCode, contact Twilio if persistent |
| Download 404 | Webhook arrived before file ready | Retry after 2-5 seconds |
| Download 410 | Recording deleted | Check retention settings, verify timing |
| Recording in Twilio but not S3 | Upload failed | Check S3 permissions and bucket config |

### 5. Recording Availability Timeline

```
Call ends
    │
    ├── 0-5 seconds: Webhook with 'in-progress' or 'completed' may arrive
    │
    ├── 5-30 seconds: Recording file becomes downloadable
    │   └── NOTE: 404 during this window is NORMAL
    │
    ├── After 30 seconds: File should definitely be available
    │   └── If still 404, check RecordingSid is correct
    │
    └── After 24 hours (configurable): Recording auto-deleted from Twilio
        └── Must download before this!
```

---

*Section Version: 1.2 - Added complete recording webhook parameters, error codes, and debugging guide*
