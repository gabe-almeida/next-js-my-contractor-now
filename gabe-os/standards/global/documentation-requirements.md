# Documentation Requirements

## Critical Requirements

### 1. Heavy Inline Documentation (NON-NEGOTIABLE)

**EVERY function, class, and complex logic block MUST have comprehensive documentation.**

This is NOT optional. The code-quality-auditor will reject code lacking proper documentation.

### 2. Required Documentation Format: WHY / WHEN / HOW

**Every function and method MUST include:**

```typescript
/**
 * WHY: [Why does this exist? What problem does it solve? What's the business reason?]
 * WHEN: [When should this be called? Under what conditions? What triggers it?]
 * HOW: [How does it work? What's the approach/algorithm? What are the steps?]
 *
 * @param {Type} paramName - Description of parameter
 * @returns {Type} Description of return value
 * @throws {ErrorType} When and why this error is thrown
 *
 * @example
 * // Usage example showing typical use case
 * const result = functionName(param1, param2);
 *
 * @see relatedFunction - Link to related functionality
 */
```

### 3. Detailed Examples

#### Example 1: Service Function

```typescript
/**
 * WHY: Users need to authenticate to access protected resources. This validates
 *      credentials and generates a JWT token for subsequent authenticated requests.
 *
 * WHEN: Called by the POST /auth/login endpoint when a user submits login form.
 *       Should ONLY be called after rate limiting checks pass.
 *
 * HOW:
 *   1. Validates email format
 *   2. Finds user in database by email
 *   3. Compares provided password with stored bcrypt hash
 *   4. If match, generates JWT with user ID and role
 *   5. Returns token with 24-hour expiration
 *
 * @param {string} email - User's email address (must be valid format)
 * @param {string} password - Plain text password (will be hashed for comparison)
 * @returns {Promise<AuthToken>} JWT token with expiration time
 * @throws {UnauthorizedError} If email not found or password doesn't match
 * @throws {ValidationError} If email format invalid or password empty
 *
 * @example
 * try {
 *   const token = await authenticateUser('user@example.com', 'password123');
 *   console.log(token.jwt); // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * } catch (error) {
 *   if (error instanceof UnauthorizedError) {
 *     // Handle invalid credentials
 *   }
 * }
 *
 * @see generateJWT - Token generation implementation
 * @see validatePassword - Password comparison logic
 */
async function authenticateUser(
  email: string,
  password: string
): Promise<AuthToken> {
  // Implementation here
}
```

#### Example 2: React Component

```typescript
/**
 * WHY: Users need a reusable button component that handles loading states,
 *      disabled states, and consistent styling across the application.
 *
 * WHEN: Use this anywhere you need a button with loading/disabled states.
 *       Examples: form submissions, async actions, user interactions.
 *
 * HOW:
 *   1. Renders a button element with TailwindCSS styling
 *   2. Shows spinner icon when loading prop is true
 *   3. Disables click events when disabled or loading
 *   4. Applies variant-specific styles (primary, secondary, danger)
 *   5. Forwards all other props to underlying button element
 *
 * @param {ReactNode} children - Button text or content
 * @param {boolean} loading - Shows spinner and disables button
 * @param {boolean} disabled - Disables button (grays out)
 * @param {'primary'|'secondary'|'danger'} variant - Visual style variant
 * @param {Function} onClick - Click handler (called only when not loading/disabled)
 * @returns {JSX.Element} Styled button component
 *
 * @example
 * // Form submit button with loading state
 * <Button
 *   loading={isSubmitting}
 *   onClick={handleSubmit}
 *   variant="primary"
 * >
 *   Save Changes
 * </Button>
 *
 * @example
 * // Disabled delete button
 * <Button
 *   disabled={!canDelete}
 *   onClick={handleDelete}
 *   variant="danger"
 * >
 *   Delete Account
 * </Button>
 */
export function Button({
  children,
  loading = false,
  disabled = false,
  variant = 'primary',
  onClick,
  ...props
}: ButtonProps) {
  // Implementation here
}
```

#### Example 3: Utility Function

```typescript
/**
 * WHY: Throughout the app, we need to format currency consistently with
 *      proper locale support and decimal handling for financial accuracy.
 *
 * WHEN: Use this whenever displaying money/prices to users. Examples:
 *       - Product prices
 *       - Order totals
 *       - Invoice amounts
 *       - Account balances
 *
 * HOW:
 *   1. Converts number to fixed 2 decimal places
 *   2. Uses Intl.NumberFormat for locale-aware formatting
 *   3. Adds currency symbol based on provided currency code
 *   4. Handles negative numbers with proper formatting
 *   5. Handles edge cases (null, undefined, NaN) by returning $0.00
 *
 * @param {number} amount - Amount in dollars (can be negative)
 * @param {string} currency - ISO currency code (default: 'USD')
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted currency string (e.g., "$1,234.56")
 *
 * @example
 * formatCurrency(1234.567);           // "$1,234.57"
 * formatCurrency(-50);                // "-$50.00"
 * formatCurrency(1000, 'EUR', 'de-DE'); // "1.000,00 €"
 * formatCurrency(null);               // "$0.00"
 *
 * @see formatPercentage - Related formatting utility
 */
function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  // Implementation here
}
```

#### Example 4: Complex Algorithm

```typescript
/**
 * WHY: We need to efficiently find the optimal delivery route that minimizes
 *      distance while respecting time windows and vehicle capacity constraints.
 *      This directly impacts delivery costs and customer satisfaction.
 *
 * WHEN: Called by the route optimization service when:
 *       - New orders are placed
 *       - Delivery schedule needs recalculation (every 15 minutes)
 *       - Driver becomes available
 *       - Emergency route recalculation needed
 *
 * HOW: Implements a modified Christofides algorithm with time window constraints:
 *   1. Build distance matrix between all delivery points
 *   2. Find minimum spanning tree (Prim's algorithm)
 *   3. Find minimum weight matching on odd-degree vertices
 *   4. Combine to form Eulerian graph
 *   5. Convert to Hamiltonian circuit
 *   6. Apply 2-opt optimization for local improvements
 *   7. Validate time windows for each stop
 *   8. Adjust route if time windows violated
 *   9. Verify vehicle capacity not exceeded
 *
 *   Time Complexity: O(n³) where n is number of delivery points
 *   Space Complexity: O(n²) for distance matrix
 *
 * @param {DeliveryPoint[]} points - Array of delivery locations with time windows
 * @param {Vehicle} vehicle - Vehicle with capacity and start location
 * @param {RouteOptions} options - Configuration (optimize_for: 'distance' | 'time')
 * @returns {Promise<OptimizedRoute>} Route with ordered stops and estimated times
 * @throws {InfeasibleRouteError} If no valid route exists (capacity/time constraints)
 *
 * @example
 * const route = await calculateOptimalRoute(
 *   [
 *     { lat: 40.7128, lng: -74.0060, timeWindow: [9, 12], packages: 5 },
 *     { lat: 40.7589, lng: -73.9851, timeWindow: [10, 14], packages: 3 }
 *   ],
 *   { capacity: 50, startLat: 40.7128, startLng: -74.0060 },
 *   { optimize_for: 'distance' }
 * );
 *
 * @see calculateDistanceMatrix - Distance calculation implementation
 * @see validateTimeWindows - Time window validation logic
 */
async function calculateOptimalRoute(
  points: DeliveryPoint[],
  vehicle: Vehicle,
  options: RouteOptions
): Promise<OptimizedRoute> {
  // Step 1: Build distance matrix
  const distanceMatrix = await calculateDistanceMatrix(points);

  // Step 2: Find minimum spanning tree
  const mst = findMinimumSpanningTree(distanceMatrix);

  // ... (more implementation)
}
```

### 4. Class Documentation

**Every class MUST have:**

```typescript
/**
 * WHY: [What problem does this class solve? What's its role in the system?]
 *
 * RESPONSIBILITIES:
 *   - [Primary responsibility 1]
 *   - [Primary responsibility 2]
 *   - [Primary responsibility 3]
 *
 * USAGE PATTERNS:
 *   - [When to use this class]
 *   - [What not to use it for]
 *
 * DEPENDENCIES:
 *   - [What this class depends on]
 *   - [What depends on this class]
 *
 * @example
 * // Typical instantiation and usage
 * const service = new ServiceName(dependencies);
 * const result = await service.doSomething();
 */
class ServiceName {
  // Implementation
}
```

**Example:**

```typescript
/**
 * WHY: Centralizes all email sending functionality to ensure consistent
 *      formatting, reliable delivery, and easy switching between providers.
 *
 * RESPONSIBILITIES:
 *   - Send transactional emails (welcome, password reset, notifications)
 *   - Template rendering with user data
 *   - Retry logic for failed sends
 *   - Logging and error tracking
 *
 * USAGE PATTERNS:
 *   - Use for ALL transactional emails in the application
 *   - Do NOT use for bulk marketing emails (use MarketingEmailService)
 *   - Do NOT use for SMS/push notifications (use NotificationService)
 *
 * DEPENDENCIES:
 *   - IEmailProvider: Abstraction over SendGrid/Mailgun/etc
 *   - TemplateEngine: For rendering email HTML
 *   - Logger: For tracking sends and failures
 *
 * USED BY:
 *   - UserService (welcome emails)
 *   - AuthService (password reset emails)
 *   - OrderService (order confirmation emails)
 *
 * @example
 * // Send welcome email
 * const emailService = new EmailService(sendGridProvider, templateEngine);
 * await emailService.sendWelcomeEmail(newUser);
 *
 * @see IEmailProvider - Email provider interface
 * @see MarketingEmailService - For bulk emails
 */
class EmailService {
  // Implementation
}
```

### 5. Inline Comments for Complex Logic

**Within functions, add comments for:**
- Non-obvious business logic
- Performance optimizations
- Edge cases handled
- Workarounds for known issues

```typescript
async function processPayment(order: Order) {
  // WHY: Stripe requires amounts in cents, not dollars
  const amountInCents = Math.round(order.total * 100);

  // WHY: We check inventory again here because items could have sold out
  // between cart creation and checkout (race condition prevention)
  const inventoryAvailable = await checkInventoryAvailability(order.items);
  if (!inventoryAvailable) {
    throw new OutOfStockError();
  }

  // EDGE CASE: Stripe has a $0.50 minimum. For orders below this, we add
  // the difference to avoid payment processor errors.
  const minimumAmount = 50; // $0.50 in cents
  const chargeAmount = Math.max(amountInCents, minimumAmount);

  // PERFORMANCE: We process payment before updating inventory to avoid
  // holding a database transaction open during external API call
  const paymentResult = await stripe.charges.create({
    amount: chargeAmount,
    currency: 'usd',
    source: order.paymentToken
  });

  // Now update inventory within transaction to ensure atomicity
  await updateInventory(order.items);
}
```

### 5.1. Standard Comment Prefixes

Use prefixes only when helpful for scanning. Most comments don't need a prefix.

#### // WHY: Explains Non-Obvious Implementation Choice

Use when implementation differs from the obvious approach.

**Example:**
```typescript
// WHY: Stripe API requires amounts in cents, not dollars
const amountInCents = Math.round(order.total * 100);

// WHY: Process payment BEFORE creating order record
// (External API is slow ~2s, don't hold database transaction open)
const charge = await stripe.charge(payment);
await db.orders.create({ charge });
```

#### // EDGE CASE: Documents Boundary Conditions

Use when handling special cases or edge conditions.

**Example:**
```typescript
// EDGE CASE: Division by zero protection for empty carts
const averageItemPrice = items.length > 0
  ? totalPrice / items.length
  : 0;

// EDGE CASE: Re-check inventory after payment (prevents overselling)
// Items could sell out between cart creation and payment completion
const available = await inventory.check(order.items);
```

**All other comments** (performance, race conditions, trade-offs, etc.) are just types of `// WHY:` - use the prefix if it helps scanning, otherwise just write clear comments.

**Bad (over-prefixed):**
```typescript
// PERFORMANCE: Using map for O(1) lookup
const userMap = new Map(users.map(u => [u.id, u]));
```

**Good (natural):**
```typescript
// Using Map for O(1) lookup (array.find would be O(n) for each iteration)
const userMap = new Map(users.map(u => [u.id, u]));
```

### 5.2. When Inline Comments Are Required

**Always comment these patterns:**

1. **Magic Numbers** (except 0, 1, -1)
   ```typescript
   ❌ setTimeout(() => sync(), 5000);
   ✅ const SYNC_INTERVAL_MS = 5000; // 5s interval per product requirements
   ```

2. **Non-Standard Approaches** (when code differs from obvious solution)
   ```typescript
   // Using polling instead of webhooks (webhook endpoint had reliability issues)
   setInterval(syncData, 300000);
   ```

3. **Order-Dependent Operations** (when sequence matters)
   ```typescript
   // Save token BEFORE sending email (prevents race condition where
   // user clicks link before token exists in database)
   await db.saveToken(token);
   await sendEmail(token);
   ```

4. **Async Operations with Shared State** (concurrency concerns)
   ```typescript
   // Lock account during transfer to prevent concurrent operations
   const account = await db.accounts.findById(id, { lock: true });
   ```

5. **Performance Optimizations** (when trading clarity for speed)
   ```typescript
   // Cache results to avoid N+1 query (1000 items = 1000 queries without cache)
   const cached = await cache.get(key);
   ```

6. **Defensive Programming** (checks that seem unnecessary)
   ```typescript
   // Never charge negative amounts (shouldn't happen but defensive)
   const amount = Math.max(0, calculatedAmount);
   ```

**Don't comment these patterns:**
- Simple CRUD operations
- Self-documenting code with clear variable names
- Standard loops and conditionals
- Obvious patterns (getters/setters)

**The test:** If an experienced developer would immediately understand WHY the code is written this way, skip the comment.

### 5.3. No Unexplained Magic Numbers

Extract numeric constants and explain their purpose:

❌ **BAD:**
```typescript
if (user.age > 18) { }
setTimeout(() => refresh(), 5000);
if (password.length < 8) { }
```

✅ **GOOD:**
```typescript
// Legal minimum age for account creation
const LEGAL_MINIMUM_AGE = 18;
if (user.age > LEGAL_MINIMUM_AGE) { }

// Refresh interval prevents server overload (balance: freshness vs load)
const REFRESH_INTERVAL_MS = 5000;
setTimeout(() => refresh(), REFRESH_INTERVAL_MS);

// Minimum password length per security policy
const MIN_PASSWORD_LENGTH = 8;
if (password.length < MIN_PASSWORD_LENGTH) { }
```

**Exceptions:** 0, 1, -1, and 2 are usually obvious

### 5.4. Before/After Examples

#### Example 1: Service Method

❌ **Before:**
```typescript
async function processOrder(cart: Cart): Promise<Order> {
  const reservation = await inventory.reserve(cart.items);
  const charge = await stripe.charge(cart.total);
  const order = await db.orders.create({ cart, charge });
  await inventory.release(reservation);
  return order;
}
```

✅ **After:**
```typescript
async function processOrder(cart: Cart): Promise<Order> {
  // Reserve inventory BEFORE payment (prevents charging for out-of-stock items)
  const reservation = await inventory.reserve(cart.items);

  // Process payment before database transaction (Stripe API is slow ~2s,
  // don't hold DB transaction open during external call)
  const charge = await stripe.charge(cart.total);

  // Create order and release reservation atomically (if server crashes
  // between these operations, inventory would be leaked)
  await db.transaction(async (trx) => {
    const order = await trx.orders.create({ cart, charge });
    await inventory.release(reservation);
    return order;
  });
}
```

#### Example 2: React Component

❌ **Before:**
```typescript
function UserProfile({ userId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const previousUserId = useRef<string>();

  useEffect(() => {
    if (userId !== previousUserId.current) {
      setUser(null);
      previousUserId.current = userId;
    }
    fetchUser(userId).then(setUser);
  }, [userId]);
}
```

✅ **After:**
```typescript
function UserProfile({ userId }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const previousUserId = useRef<string>();

  useEffect(() => {
    // Reset user to null when userId changes (prevents briefly showing
    // old user data while new user loads - stale data flash)
    if (userId !== previousUserId.current) {
      setUser(null);
      previousUserId.current = userId;
    }

    fetchUser(userId).then(setUser);
  }, [userId]);
}
```

#### Example 3: Algorithm/Utility

❌ **Before:**
```typescript
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
```

✅ **After:**
```typescript
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function(...args: Parameters<T>) {
    const later = () => {
      // Set timeout to null BEFORE calling func (allows immediate re-execution
      // if func triggers another debounced call)
      timeout = null;
      func(...args);
    };

    // EDGE CASE: Clear existing timeout if called again
    // This is the debounce behavior - restarts the wait period
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(later, wait);
  };
}
```

## 6. Inline Comments vs WHY/WHEN/HOW

**These are complementary, not redundant:**

**Function Header (WHY/WHEN/HOW):**
- What does this function do?
- When should I call it?
- What's the overall approach?

**Inline Comments:**
- Why is this specific line written this way?
- Why this order of operations?
- What edge case does this handle?

**Example showing both:**

```typescript
/**
 * WHY: Users need to reset forgotten passwords securely
 * WHEN: Called via POST /auth/forgot-password after email verification
 * HOW: Generates secure token, stores hash, sends email, logs event
 */
async function sendPasswordResetEmail(email: string): Promise<void> {
  // WHY: Must use crypto.randomBytes (cryptographically secure)
  // Math.random() is predictable and insecure for tokens
  const token = crypto.randomBytes(32).toString('hex');

  // Store HASH not token (if database is breached, attacker
  // can't use stored values to reset passwords)
  const hashedToken = await bcrypt.hash(token);

  // Save token BEFORE sending email (prevents race condition where
  // user clicks link before token exists in database)
  await db.savePasswordResetToken(email, hashedToken);
  await emailService.sendPasswordReset(email, token);
}
```

**Key:** Function header explains the "big picture", inline comments explain specific implementation decisions.

### 7. Documentation for Context Switching

**Add comments that help developers understand the "why" behind decisions:**

```typescript
// NOTE: We use polling instead of webhooks here because our webhook
// endpoint had reliability issues with the third-party service
// (timeouts after 30s). Polling every 5 minutes is acceptable for
// this non-critical sync operation.
setInterval(async () => {
  await syncDataFromThirdParty();
}, 5 * 60 * 1000);

// TODO: Revisit this when third-party adds websocket support (Q3 2025)
```

### 8. File Header Documentation

**Every file should start with:**

```typescript
/**
 * FILE: UserAuthenticationService.ts
 *
 * PURPOSE: Handles all user authentication logic including login, logout,
 *          password reset, and session management.
 *
 * DEPENDENCIES:
 *   - bcrypt: Password hashing
 *   - jsonwebtoken: JWT token generation
 *   - UserRepository: Database operations
 *
 * USED BY:
 *   - AuthController: HTTP endpoints
 *   - WebSocketAuthMiddleware: Socket authentication
 *
 * RELATED FILES:
 *   - UserAuthorizationService.ts: Permission checking
 *   - SessionManager.ts: Session storage
 *
 * @module auth/services
 */

// Imports...
// Implementation...
```


---

## Reusability Documentation (REQUIRED)

For all shared utilities, helpers, middleware, and services:

### REUSE Section

Document how this code promotes reusability:

```typescript
/**
 * REUSE: How this code can be reused
 * 
 * This function is designed to be maximally reusable:
 * - Parameterized inputs (no hardcoded values)
 * - Generic interface (works with multiple types)
 * - Composable (can be combined with other utilities)
 * 
 * Used by:
 * - src/routes/auth.ts:45
 * - src/services/user.ts:123
 * - src/middleware/validation.ts:67
 * 
 * Instead of creating new validation functions, use this
 * with appropriate parameters.
 */
```

### DRY Compliance

Document that you checked for duplication:

```typescript
/**
 * DRY CHECK: ✅ Verified no duplication
 * 
 * Searched for similar functionality:
 * - grep -r "validateEmail" src/ (no matches)
 * - Checked src/utils/ for validators (none similar)
 * - Confirmed this is new functionality
 */
```

## Enforcement

**Code quality auditor will automatically reject:**
- ❌ Functions without WHY/WHEN/HOW documentation
- ❌ Classes without purpose/responsibilities documentation
- ❌ Complex algorithms without step-by-step explanations
- ❌ Magic numbers without explanation
- ❌ Non-obvious logic without inline comments

**Quick Checklist Before Committing:**
- [ ] Every function has WHY/WHEN/HOW
- [ ] Every class has purpose and responsibilities
- [ ] Complex logic has step-by-step comments
- [ ] Edge cases are documented
- [ ] Performance decisions are explained
- [ ] All @example blocks show realistic usage
