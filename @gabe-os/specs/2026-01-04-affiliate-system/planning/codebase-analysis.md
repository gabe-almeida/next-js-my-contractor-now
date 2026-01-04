# Affiliate System - Codebase Analysis

**Created:** 2026-01-04
**Status:** Analysis Complete

---

## Project Context

| Aspect | Details |
|--------|---------|
| **Tech Stack** | Next.js 14 (App Router), TypeScript, Prisma ORM, PostgreSQL, TailwindCSS |
| **Auth System** | JWT-based with roles (ADMIN, MANAGER, VIEWER) in `/src/lib/auth.ts` |
| **Database** | Prisma schema at `/prisma/schema.prisma` |
| **API Pattern** | Route handlers with middleware wrapper in `/src/lib/middleware.ts` |
| **Caching** | Redis cache utility in `/src/lib/cache.ts` |

---

## Similar Existing Features to Reuse

### 1. Admin Authentication System
**Location:** `/src/lib/auth.ts`
**Reuse:** Extend for AFFILIATE role
```typescript
// Line 15-20: Existing roles
type Role = 'ADMIN' | 'MANAGER' | 'VIEWER';
// ADD: 'AFFILIATE' role

// Line 45-60: Permission mapping
// ADD: Affiliate-specific permissions
```

### 2. Attribution Tracking
**Location:** `/src/utils/attribution.ts`
**Reuse:** Already captures UTM params - add affiliate param
```typescript
// Line 25-40: extractAttributionData()
// ADD: affiliate_id: params.get('aff') || params.get('affiliate_id')
```

### 3. Admin Buyers Page Pattern
**Location:** `/src/app/(admin)/admin/buyers/page.tsx`
**Reuse:** Clone for affiliate management
- List view with filters
- Card-based display
- Modal for create/edit
- Status badges

### 4. Lead Accounting Service
**Location:** `/src/lib/services/lead-accounting-service.ts`
**Reuse:** Pattern for commission status changes
- Status transition validation
- History tracking
- Audit trail

### 5. Admin API Pattern
**Location:** `/src/app/api/admin/buyers/route.ts`
**Reuse:** Standard CRUD pattern with:
- Middleware wrapper
- Pagination
- Redis caching
- Error responses

---

## WHERE Code Should Live

### Database Schema
```
/prisma/schema.prisma
  └── ADD: Affiliate, AffiliateLink, AffiliateCommission, AffiliateWithdrawal models
```

### API Routes
```
/src/app/api/
  ├── affiliates/                    # NEW: Public affiliate APIs
  │   ├── signup/route.ts            # POST - Register new affiliate
  │   ├── login/route.ts             # POST - Authenticate affiliate
  │   ├── me/route.ts                # GET - Current affiliate profile
  │   ├── links/route.ts             # GET/POST - Manage tracking links
  │   ├── links/[id]/route.ts        # GET/PUT/DELETE - Single link
  │   ├── leads/route.ts             # GET - View referred leads
  │   ├── commissions/route.ts       # GET - View commissions
  │   └── withdrawals/route.ts       # GET/POST - Request payouts
  │
  └── admin/
      └── affiliates/                # NEW: Admin affiliate management
          ├── route.ts               # GET/POST - List/create affiliates
          ├── [id]/route.ts          # GET/PUT - Single affiliate
          ├── [id]/commissions/route.ts  # GET - Affiliate's commissions
          └── [id]/approve/route.ts  # POST - Approve affiliate
```

### Affiliate Portal (Frontend)
```
/src/app/
  └── (affiliate)/                   # NEW: Route group for affiliate portal
      ├── layout.tsx                 # Affiliate portal layout with nav
      ├── login/page.tsx             # Login page
      ├── signup/page.tsx            # Registration page
      └── affiliate/
          ├── dashboard/page.tsx     # Main dashboard with stats
          ├── links/page.tsx         # Manage tracking links
          ├── leads/page.tsx         # View referred leads
          ├── commissions/page.tsx   # Commission history
          ├── withdrawals/page.tsx   # Payout requests
          └── settings/page.tsx      # Profile settings
```

### Admin Pages
```
/src/app/(admin)/admin/
  └── affiliates/                    # NEW: Admin affiliate pages
      ├── page.tsx                   # List all affiliates
      └── [id]/page.tsx              # Affiliate detail view
```

### Services
```
/src/lib/services/
  ├── affiliate-service.ts           # NEW: Affiliate CRUD operations
  ├── affiliate-commission-service.ts # NEW: Commission calculation & status
  └── affiliate-link-service.ts      # NEW: Link generation & tracking
```

### Types
```
/src/types/
  └── database.ts                    # ADD: Affiliate-related types and enums
```

---

## WHY Code Goes There

| Location | Reason |
|----------|--------|
| `/src/app/(affiliate)/` | Route group pattern keeps affiliate portal isolated, same pattern as `(admin)` |
| `/src/app/api/affiliates/` | Public APIs separate from admin APIs, follows existing convention |
| `/src/lib/services/` | Service layer centralizes business logic, follows `lead-accounting-service.ts` pattern |
| `/prisma/schema.prisma` | Single source of truth for database schema |
| `/src/types/database.ts` | Centralized TypeScript types aligned with Prisma |

---

## Integration Points

### 1. Lead Form Attribution
**File:** `/src/utils/attribution.ts`
**Line:** ~25-40
**Change:** Add `affiliate_id` to `extractAttributionData()`

### 2. Lead Creation
**File:** `/src/app/api/leads/route.ts`
**Line:** ~128-149 (complianceData handling)
**Change:** Store affiliate_id from attribution

### 3. Lead Status Change (Commission Trigger)
**File:** `/src/lib/services/lead-accounting-service.ts`
**Line:** ~80-120 (changeLeadStatus function)
**Change:** Trigger commission creation when status = SOLD

### 4. Auth Middleware
**File:** `/src/lib/auth.ts`
**Line:** ~15-20 (Role type)
**Change:** Add AFFILIATE role and permissions

### 5. Admin Navigation
**File:** `/src/components/admin/AdminLayout.tsx`
**Change:** Add "Affiliates" menu item

---

## Patterns to Follow

### API Route Pattern (from `/src/app/api/admin/buyers/route.ts`)
```typescript
export const GET = withMiddleware(
  async (req: EnhancedRequest) => {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');

    // Cache check
    const cacheKey = `affiliates:list:${page}`;
    let result = await RedisCache.get(cacheKey);

    if (!result) {
      const [items, total] = await Promise.all([
        prisma.affiliate.findMany({ skip, take, where, orderBy }),
        prisma.affiliate.count({ where })
      ]);
      await RedisCache.set(cacheKey, result, 300);
    }

    return NextResponse.json(successResponse({ items, pagination }));
  },
  { rateLimiter: 'admin', requireAuth: true }
);
```

### Service Pattern (from `/src/lib/services/lead-accounting-service.ts`)
```typescript
/**
 * Affiliate Commission Service
 *
 * WHY: Centralizes commission calculation and status management
 * WHEN: Called when lead is sold or commission status changes
 * HOW: Validates transitions, calculates amounts, records history
 */
export async function createCommission(params: CreateCommissionParams): Promise<CommissionResult> {
  // Validate
  // Calculate
  // Create record
  // Return result
}
```

### Page Component Pattern (from `/src/app/(admin)/admin/buyers/page.tsx`)
```typescript
'use client';

export default function AffiliateDashboardPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  // Render with Card, Table components
}
```

---

## Code to Reuse

| Existing Code | Path | Use For |
|--------------|------|---------|
| Auth middleware | `/src/lib/auth.ts` | Affiliate authentication |
| API middleware | `/src/lib/middleware.ts` | Rate limiting, CORS |
| Response utils | `/src/lib/utils.ts` | `successResponse()`, `errorResponse()` |
| Redis cache | `/src/lib/cache.ts` | Cache affiliate stats |
| Card component | `/src/components/ui/Card.tsx` | Dashboard cards |
| Button component | `/src/components/ui/Button.tsx` | All buttons |
| Form validation | `/src/lib/validation.ts` | Email, password validation |
| Attribution utils | `/src/utils/attribution.ts` | Extend for affiliate param |

---

## Database Schema Design

```prisma
// ADD to prisma/schema.prisma

enum AffiliateStatus {
  PENDING
  ACTIVE
  SUSPENDED
}

enum CommissionStatus {
  PENDING
  APPROVED
  PAID
  REJECTED
}

enum WithdrawalStatus {
  REQUESTED
  PROCESSING
  COMPLETED
  FAILED
}

model Affiliate {
  id              String          @id @default(uuid())
  email           String          @unique
  passwordHash    String
  firstName       String
  lastName        String
  companyName     String?
  phone           String?
  commissionRate  Decimal         @default(0.10)
  status          AffiliateStatus @default(PENDING)
  emailVerified   Boolean         @default(false)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  links           AffiliateLink[]
  commissions     AffiliateCommission[]
  withdrawals     AffiliateWithdrawal[]
}

model AffiliateLink {
  id           String    @id @default(uuid())
  affiliateId  String
  affiliate    Affiliate @relation(fields: [affiliateId], references: [id])
  code         String    @unique
  targetPath   String    // e.g., "/windows", "/roofing"
  name         String?   // e.g., "Facebook Campaign Jan"
  clicks       Int       @default(0)
  conversions  Int       @default(0)
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())

  @@index([affiliateId])
  @@index([code])
}

model AffiliateCommission {
  id           String           @id @default(uuid())
  affiliateId  String
  affiliate    Affiliate        @relation(fields: [affiliateId], references: [id])
  leadId       String
  lead         Lead             @relation(fields: [leadId], references: [id])
  amount       Decimal
  rate         Decimal          // Rate at time of creation
  status       CommissionStatus @default(PENDING)
  approvedAt   DateTime?
  paidAt       DateTime?
  createdAt    DateTime         @default(now())

  @@index([affiliateId])
  @@index([leadId])
  @@index([status])
}

model AffiliateWithdrawal {
  id           String           @id @default(uuid())
  affiliateId  String
  affiliate    Affiliate        @relation(fields: [affiliateId], references: [id])
  amount       Decimal
  method       String           // "paypal", "bank_transfer"
  methodDetails Json?           // PayPal email, bank info (encrypted)
  status       WithdrawalStatus @default(REQUESTED)
  processedAt  DateTime?
  notes        String?
  createdAt    DateTime         @default(now())

  @@index([affiliateId])
  @@index([status])
}

// ADD relation to existing Lead model
model Lead {
  // ... existing fields ...
  affiliateCommissions AffiliateCommission[]
}
```

---

## Recommendations

1. **Phase the rollout:** Start with registration + links + dashboard, add payouts later
2. **Use existing patterns:** Clone admin buyers page structure for affiliate portal
3. **Extend attribution.ts:** Minimal change to capture affiliate param
4. **Hook into lead-accounting-service:** Trigger commission on SOLD status
5. **Separate auth tokens:** Affiliate JWT tokens should have different claims than admin
6. **Privacy first:** Never expose customer PII to affiliates
