# Invoicing System - Cron Job Setup

## Overview

The invoicing system requires two cron jobs to run automatically:

1. **Invoice Overdue Check** - Marks invoices as overdue daily
2. **Monthly Affiliate Payables** - Generates affiliate payable invoices monthly

Both jobs are protected by a shared secret and should only be accessible via Render's cron scheduler.

---

## Environment Variables Required

Add these to your Render service environment variables:

```bash
# Required for cron job authentication
CRON_SECRET=<generate-a-strong-secret>

# AWS SES for email notifications (optional but recommended)
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
AWS_REGION=us-east-1
SES_FROM_EMAIL=invoices@mycontractornow.com
```

### Generate a secure CRON_SECRET

```bash
# Generate a 32-character random string
openssl rand -hex 32
```

---

## Render Service Configuration

**Service ID:** `srv-d0ua7j63jp1c73fnfgn0`

---

## Cron Jobs to Configure

### 1. Invoice Overdue Check

| Setting | Value |
|---------|-------|
| **Name** | `invoice-overdue-check` |
| **Schedule** | `0 6 * * *` (Daily at 6 AM UTC) |
| **Endpoint** | `https://your-domain.com/api/cron/invoice-overdue-check` |
| **Method** | `GET` |
| **Headers** | `x-cron-secret: <your-CRON_SECRET>` |
| **Timeout** | 30 seconds |

**What it does:**
- Finds all invoices with status `SENT` or `PARTIALLY_PAID`
- Checks if `dueDate` is before today
- Updates status to `OVERDUE`
- Records status change in invoice history

**Expected response:**
```json
{
  "success": true,
  "markedOverdue": 3,
  "timestamp": "2024-01-15T06:00:00.000Z",
  "durationMs": 245
}
```

### 2. Monthly Affiliate Payables

| Setting | Value |
|---------|-------|
| **Name** | `affiliate-payables-monthly` |
| **Schedule** | `0 0 1 * *` (1st of month at midnight UTC) |
| **Endpoint** | `https://your-domain.com/api/cron/affiliate-payables` |
| **Method** | `GET` |
| **Headers** | `x-cron-secret: <your-CRON_SECRET>` |
| **Timeout** | 120 seconds (longer due to processing) |

**What it does:**
- Gets the previous month's date range
- For each active affiliate:
  - Finds APPROVED commissions from that period
  - Excludes commissions already on invoices
  - Creates a PAYABLE invoice with line items
  - Sets due date to Net 30 from invoice creation

**Expected response:**
```json
{
  "success": true,
  "affiliatesProcessed": 15,
  "invoicesCreated": 12,
  "commissionsIncluded": 87,
  "period": {
    "start": "2024-01-01T00:00:00.000Z",
    "end": "2024-01-31T23:59:59.999Z"
  },
  "timestamp": "2024-02-01T00:00:00.000Z",
  "durationMs": 3456
}
```

---

## Setup via Render Dashboard

1. Go to your Render Dashboard
2. Navigate to your web service (`srv-d0ua7j63jp1c73fnfgn0`)
3. Click on "Cron Jobs" in the left sidebar
4. Click "New Cron Job" for each job
5. Configure with the settings above

### Example Render YAML Configuration

If you prefer infrastructure-as-code, add to `render.yaml`:

```yaml
services:
  - type: web
    name: my-contractor-now
    env: node
    # ... other settings ...

cron:
  - name: invoice-overdue-check
    schedule: "0 6 * * *"
    region: ohio  # or your preferred region
    plan: free
    branch: main
    buildCommand: ""
    startCommand: |
      curl -X GET \
        -H "x-cron-secret: ${CRON_SECRET}" \
        "https://your-domain.com/api/cron/invoice-overdue-check"

  - name: affiliate-payables-monthly
    schedule: "0 0 1 * *"
    region: ohio
    plan: free
    branch: main
    buildCommand: ""
    startCommand: |
      curl -X GET \
        -H "x-cron-secret: ${CRON_SECRET}" \
        "https://your-domain.com/api/cron/affiliate-payables"
```

---

## Testing Cron Jobs Manually

### Test Overdue Check

```bash
curl -X GET \
  -H "x-cron-secret: YOUR_CRON_SECRET_HERE" \
  "https://your-domain.com/api/cron/invoice-overdue-check"
```

### Test Affiliate Payables

```bash
curl -X GET \
  -H "x-cron-secret: YOUR_CRON_SECRET_HERE" \
  "https://your-domain.com/api/cron/affiliate-payables"
```

### Local Development Testing

```bash
# Set the secret in your .env.local
CRON_SECRET=test-secret-for-local-dev

# Test overdue check
curl -X GET \
  -H "x-cron-secret: test-secret-for-local-dev" \
  "http://localhost:3000/api/cron/invoice-overdue-check"

# Test affiliate payables
curl -X GET \
  -H "x-cron-secret: test-secret-for-local-dev" \
  "http://localhost:3000/api/cron/affiliate-payables"
```

---

## Monitoring & Logs

### View Cron Logs via Render CLI

```bash
# General service logs
render logs -r srv-d0ua7j63jp1c73fnfgn0 --output text --limit 100

# Filter for cron job logs
render logs -r srv-d0ua7j63jp1c73fnfgn0 --output text --limit 100 | grep "Cron"
```

### Log Messages to Watch For

**Success indicators:**
```
[CronOverdueCheck] Completed overdue invoice check { markedOverdue: X }
[CronAffiliatePayables] Completed affiliate payable generation { invoicesCreated: X }
```

**Error indicators:**
```
[CronOverdueCheck] Unauthorized cron request
[CronAffiliatePayables] Failed to generate affiliate payables
```

---

## Troubleshooting

### "Unauthorized" Response

1. Verify `CRON_SECRET` is set in Render environment variables
2. Verify the header value matches exactly (no extra spaces)
3. Check that `x-cron-secret` header name is lowercase

### No Invoices Marked Overdue

1. Verify there are invoices with status `SENT` or `PARTIALLY_PAID`
2. Check that those invoices have `dueDate` in the past
3. Review the current date (job runs at UTC)

### No Affiliate Payables Created

1. Verify there are active affiliates with `APPROVED` commissions
2. Check that commissions are from the PREVIOUS month
3. Ensure commissions aren't already on invoices
4. Verify there's at least one active AdminUser for invoice creation

### Job Timeout

1. Increase timeout in Render cron configuration
2. Check for database performance issues
3. Review if too many records are being processed

---

## Security Considerations

1. **Never commit CRON_SECRET** - Store only in Render environment variables
2. **Rotate secret periodically** - Update in Render env vars, then in cron jobs
3. **Monitor for unauthorized attempts** - Check logs for 401 responses
4. **Use HTTPS only** - Never call cron endpoints over HTTP

---

## Related Files

| File | Purpose |
|------|---------|
| `src/app/api/cron/invoice-overdue-check/route.ts` | Overdue check endpoint |
| `src/app/api/cron/affiliate-payables/route.ts` | Affiliate payables endpoint |
| `src/lib/services/invoice-status-service.ts` | `markOverdueInvoices()` function |
| `src/lib/services/invoice-service.ts` | Invoice creation logic |
| `src/lib/services/invoice-email-service.ts` | Email notifications |
