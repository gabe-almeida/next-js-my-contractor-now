# Modularity Standards

## Critical Requirements

### 1. File Size Hard Limit: 500 Lines Maximum

**NON-NEGOTIABLE RULE:**
- ❌ **NEVER** exceed 500 lines per file (including comments, blank lines)
- ⚠️ **WARNING** threshold: 400 lines - start planning to split
- ✅ **TARGET**: 200-300 lines per file for optimal maintainability

**When approaching 400 lines:**
1. STOP adding to the file
2. Identify logical boundaries for splitting
3. Extract into separate modules/services/utilities
4. Ensure each new file has single responsibility

**Examples of How to Split:**

```typescript
// ❌ BAD: UserController.ts (800 lines)
class UserController {
  // Authentication methods (200 lines)
  login() {}
  logout() {}
  register() {}
  resetPassword() {}

  // Profile methods (200 lines)
  getProfile() {}
  updateProfile() {}
  uploadAvatar() {}

  // Settings methods (200 lines)
  getSettings() {}
  updateSettings() {}
  updatePrivacy() {}

  // Admin methods (200 lines)
  listUsers() {}
  banUser() {}
  deleteUser() {}
}

// ✅ GOOD: Split into focused controllers
// UserAuthController.ts (180 lines)
class UserAuthController {
  login() {}
  logout() {}
  register() {}
  resetPassword() {}
}

// UserProfileController.ts (160 lines)
class UserProfileController {
  getProfile() {}
  updateProfile() {}
  uploadAvatar() {}
}

// UserSettingsController.ts (140 lines)
class UserSettingsController {
  getSettings() {}
  updateSettings() {}
  updatePrivacy() {}
}

// UserAdminController.ts (120 lines)
class UserAdminController {
  listUsers() {}
  banUser() {}
  deleteUser() {}
}
```

### 2. Single Responsibility Principle (SRP)

**Each file, class, and function should do ONE thing well.**

**File Level:**
- Each file should represent ONE concept/responsibility
- File name should clearly indicate its single purpose
- If you can't name it without "and" or "or", split it

**Class Level:**
- Each class should have ONE reason to change
- Maximum 7-10 public methods per class
- Private methods don't count toward method limit

**Function Level:**
- Each function should do ONE task
- Maximum 20-30 lines per function
- Maximum 3-4 parameters per function
- If function needs many params, group into object

**Examples:**

```typescript
// ❌ BAD: Multiple responsibilities
class UserService {
  createUser() {}           // User management
  sendEmail() {}            // Email service
  logActivity() {}          // Logging service
  validatePassword() {}     // Validation service
  generateToken() {}        // Auth service
}

// ✅ GOOD: Single responsibility per service
class UserService {
  createUser() {}
  updateUser() {}
  deleteUser() {}
}

class EmailService {
  sendWelcomeEmail() {}
  sendPasswordResetEmail() {}
}

class ActivityLogger {
  logUserCreated() {}
  logUserUpdated() {}
}

class PasswordValidator {
  validate() {}
  checkStrength() {}
}

class TokenService {
  generate() {}
  verify() {}
}
```

### 3. Module Organization

**Directory Structure:**

```
src/
├── features/           # Feature-based organization
│   ├── auth/
│   │   ├── controllers/      (max 300 lines each)
│   │   ├── services/         (max 300 lines each)
│   │   ├── models/           (max 200 lines each)
│   │   ├── validators/       (max 150 lines each)
│   │   ├── types/            (max 100 lines each)
│   │   └── utils/            (max 200 lines each)
│   ├── users/
│   └── posts/
├── shared/             # Shared across features
│   ├── services/
│   ├── utils/
│   ├── types/
│   └── constants/
└── core/               # Core infrastructure
    ├── database/
    ├── config/
    └── middleware/
```

**File Naming:**
- Use descriptive, specific names
- Include the file's responsibility in the name
- Examples:
  - `UserAuthenticationService.ts` (not `UserService.ts`)
  - `PasswordValidationUtils.ts` (not `utils.ts`)
  - `EmailNotificationService.ts` (not `email.ts`)

### 4. Cohesion and Coupling

**High Cohesion (GOOD):**
- Functions in a module work on related data
- All code in file serves the module's single purpose
- Changes to one part don't require changes elsewhere in file

**Low Coupling (GOOD):**
- Modules depend on interfaces, not implementations
- Changes in one module don't cascade to others
- Easy to swap implementations

**Example:**

```typescript
// ✅ GOOD: High cohesion, low coupling
// EmailService.ts
interface IEmailProvider {
  send(to: string, subject: string, body: string): Promise<void>;
}

class EmailService {
  constructor(private provider: IEmailProvider) {}

  async sendWelcomeEmail(user: User) {
    await this.provider.send(
      user.email,
      'Welcome!',
      this.buildWelcomeBody(user)
    );
  }

  private buildWelcomeBody(user: User): string {
    // All email-related logic together
  }
}

// SendGridProvider.ts (can be swapped with MailgunProvider)
class SendGridProvider implements IEmailProvider {
  async send(to: string, subject: string, body: string) {
    // SendGrid implementation
  }
}
```

### 5. Code Reusability

**Before writing ANY code:**
1. Search for existing similar functionality
2. Check for reusable utilities in `shared/`
3. Look for established patterns in the codebase
4. Extract common logic if found in 2+ places

**When to Extract:**
- Logic is duplicated in 2+ places
- Function is > 20 lines and could be reused
- Pattern could benefit other features

**Where to Extract:**
```
If used by ONE feature:     feature/utils/
If used by 2+ features:     shared/utils/
If used by ALL features:    core/utils/
```

### 6. Testing Modularity

**Each module should be testable in isolation:**

```typescript
// ✅ GOOD: Easy to test
class UserValidator {
  validateEmail(email: string): boolean {
    // Pure function, easy to test
  }
}

// Test
test('validates email', () => {
  const validator = new UserValidator();
  expect(validator.validateEmail('test@example.com')).toBe(true);
});

// ❌ BAD: Hard to test
class UserController {
  createUser(req, res) {
    // Tightly coupled to HTTP framework
    // Mixes validation, business logic, database
    // Requires mocking entire HTTP stack
  }
}
```

## Enforcement

**Code quality auditor will automatically reject:**
- ❌ Files > 500 lines
- ❌ Classes with > 10 public methods
- ❌ Functions > 30 lines
- ❌ Functions with > 4 parameters
- ❌ Multiple responsibilities in one file
- ❌ Code duplication (DRY violations)

**Quick Checklist Before Committing:**
- [ ] All files < 500 lines (< 400 preferred)
- [ ] Each file has single responsibility
- [ ] No code duplication
- [ ] Clear module organization
- [ ] Dependencies are loose (interface-based)
- [ ] Each module is independently testable
