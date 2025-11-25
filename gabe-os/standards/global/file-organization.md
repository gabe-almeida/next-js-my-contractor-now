# File Organization Standards

## Directory Structure

### Feature-Based Organization (Preferred)

```
src/
├── features/                    # Feature modules (domain-driven)
│   ├── auth/
│   │   ├── controllers/         # HTTP request handlers
│   │   │   ├── AuthController.ts        (max 300 lines)
│   │   │   └── PasswordController.ts    (max 300 lines)
│   │   ├── services/            # Business logic
│   │   │   ├── AuthService.ts           (max 300 lines)
│   │   │   ├── TokenService.ts          (max 250 lines)
│   │   │   └── PasswordResetService.ts  (max 250 lines)
│   │   ├── repositories/        # Data access layer
│   │   │   └── UserRepository.ts        (max 300 lines)
│   │   ├── models/              # Domain models/entities
│   │   │   ├── User.ts                  (max 200 lines)
│   │   │   └── Session.ts               (max 150 lines)
│   │   ├── validators/          # Input validation
│   │   │   ├── LoginValidator.ts        (max 150 lines)
│   │   │   └── RegisterValidator.ts     (max 150 lines)
│   │   ├── types/               # TypeScript interfaces/types
│   │   │   ├── AuthTypes.ts             (max 100 lines)
│   │   │   └── UserTypes.ts             (max 100 lines)
│   │   ├── utils/               # Feature-specific utilities
│   │   │   ├── passwordStrength.ts      (max 200 lines)
│   │   │   └── tokenGenerator.ts        (max 150 lines)
│   │   ├── tests/               # Feature tests
│   │   │   ├── AuthService.test.ts
│   │   │   └── TokenService.test.ts
│   │   └── index.ts             # Public API exports
│   │
│   ├── users/                   # User management feature
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── ...
│   │
│   ├── posts/                   # Posts feature
│   │   └── ...
│   │
│   └── comments/                # Comments feature
│       └── ...
│
├── shared/                      # Shared across multiple features
│   ├── services/
│   │   ├── EmailService.ts              (max 300 lines)
│   │   ├── StorageService.ts            (max 250 lines)
│   │   └── CacheService.ts              (max 250 lines)
│   ├── utils/
│   │   ├── dateUtils.ts                 (max 200 lines)
│   │   ├── stringUtils.ts               (max 200 lines)
│   │   └── validationUtils.ts           (max 200 lines)
│   ├── types/
│   │   ├── common.ts                    (max 150 lines)
│   │   └── api.ts                       (max 150 lines)
│   ├── constants/
│   │   ├── errorCodes.ts                (max 100 lines)
│   │   ├── httpStatus.ts                (max 100 lines)
│   │   └── regex.ts                     (max 100 lines)
│   ├── middleware/
│   │   ├── authMiddleware.ts            (max 200 lines)
│   │   ├── errorHandler.ts              (max 250 lines)
│   │   └── rateLimiter.ts               (max 200 lines)
│   └── hooks/                   # React hooks (if applicable)
│       ├── useAuth.ts                   (max 150 lines)
│       └── useDebounce.ts               (max 100 lines)
│
├── core/                        # Core infrastructure (rarely changes)
│   ├── database/
│   │   ├── connection.ts                (max 200 lines)
│   │   ├── migrations/
│   │   └── seeders/
│   ├── config/
│   │   ├── app.ts                       (max 150 lines)
│   │   ├── database.ts                  (max 100 lines)
│   │   └── redis.ts                     (max 100 lines)
│   ├── errors/
│   │   ├── AppError.ts                  (max 150 lines)
│   │   ├── ValidationError.ts           (max 100 lines)
│   │   └── NotFoundError.ts             (max 100 lines)
│   └── interfaces/              # Core abstractions
│       ├── IRepository.ts               (max 100 lines)
│       ├── IService.ts                  (max 100 lines)
│       └── IController.ts               (max 100 lines)
│
└── tests/                       # Integration & E2E tests
    ├── integration/
    │   ├── auth.test.ts
    │   └── users.test.ts
    └── e2e/
        ├── login-flow.test.ts
        └── signup-flow.test.ts
```

### Frontend Organization (React/Next.js)

```
src/
├── features/
│   ├── auth/
│   │   ├── components/          # Feature-specific components
│   │   │   ├── LoginForm.tsx            (max 250 lines)
│   │   │   ├── RegisterForm.tsx         (max 250 lines)
│   │   │   └── PasswordResetForm.tsx    (max 200 lines)
│   │   ├── hooks/               # Feature-specific hooks
│   │   │   ├── useLogin.ts              (max 150 lines)
│   │   │   └── useAuth.ts               (max 150 lines)
│   │   ├── services/            # API calls
│   │   │   └── authApi.ts               (max 200 lines)
│   │   ├── store/               # State management
│   │   │   ├── authSlice.ts             (max 250 lines)
│   │   │   └── authSelectors.ts         (max 100 lines)
│   │   ├── types/
│   │   │   └── auth.types.ts            (max 100 lines)
│   │   └── utils/
│   │       └── authValidation.ts        (max 150 lines)
│   │
│   ├── posts/
│   │   └── ...
│   │
│   └── users/
│       └── ...
│
├── components/                  # Shared UI components
│   ├── ui/                      # Base UI components
│   │   ├── Button.tsx                   (max 150 lines)
│   │   ├── Input.tsx                    (max 150 lines)
│   │   ├── Modal.tsx                    (max 200 lines)
│   │   └── Card.tsx                     (max 150 lines)
│   ├── forms/                   # Form components
│   │   ├── FormField.tsx                (max 150 lines)
│   │   └── FormError.tsx                (max 100 lines)
│   └── layouts/                 # Layout components
│       ├── AppLayout.tsx                (max 250 lines)
│       ├── Header.tsx                   (max 200 lines)
│       └── Sidebar.tsx                  (max 200 lines)
│
├── hooks/                       # Shared hooks
│   ├── useApi.ts                        (max 150 lines)
│   ├── useDebounce.ts                   (max 100 lines)
│   └── useLocalStorage.ts               (max 150 lines)
│
├── lib/                         # Third-party integrations
│   ├── stripe.ts                        (max 200 lines)
│   ├── analytics.ts                     (max 150 lines)
│   └── supabase.ts                      (max 150 lines)
│
├── services/                    # API clients
│   ├── apiClient.ts                     (max 200 lines)
│   └── httpClient.ts                    (max 150 lines)
│
├── store/                       # Global state
│   ├── index.ts                         (max 150 lines)
│   └── rootReducer.ts                   (max 100 lines)
│
├── styles/                      # Global styles
│   ├── globals.css
│   └── theme.ts                         (max 200 lines)
│
├── types/                       # Global types
│   ├── api.types.ts                     (max 150 lines)
│   └── common.types.ts                  (max 150 lines)
│
└── utils/                       # Global utilities
    ├── format.ts                        (max 200 lines)
    ├── validation.ts                    (max 200 lines)
    └── constants.ts                     (max 150 lines)
```

## File Naming Conventions

### Backend (Node.js/TypeScript)

```
Controllers:     UserController.ts, AuthController.ts
Services:        UserService.ts, EmailService.ts
Repositories:    UserRepository.ts, PostRepository.ts
Models:          User.ts, Post.ts, Comment.ts
Validators:      UserValidator.ts, PostValidator.ts
Utils:           dateUtils.ts, stringUtils.ts (camelCase for utilities)
Types:           user.types.ts, api.types.ts (lowercase with .types suffix)
Constants:       httpStatus.ts, errorCodes.ts (camelCase)
Tests:           UserService.test.ts, AuthController.test.ts
```

### Frontend (React/TypeScript)

```
Components:      Button.tsx, LoginForm.tsx (PascalCase)
Hooks:           useAuth.ts, useDebounce.ts (camelCase with 'use' prefix)
Utils:           format.ts, validation.ts (camelCase)
Types:           auth.types.ts, user.types.ts (lowercase with .types suffix)
Styles:          Button.module.css, LoginForm.module.css
Tests:           Button.test.tsx, LoginForm.test.tsx
```

## Import Organization

**Order imports in this sequence:**

```typescript
// 1. External dependencies (third-party packages)
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

// 2. Internal absolute imports (from src/)
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';

// 3. Relative imports from same feature
import { LoginForm } from './components/LoginForm';
import { validateEmail } from './utils/validation';

// 4. Types
import type { User } from '@/types/user.types';
import type { LoginFormData } from './types/auth.types';

// 5. Styles
import styles from './Login.module.css';
```

## File Structure Within Files

### Service/Class Files

```typescript
/**
 * FILE: UserService.ts
 * PURPOSE: Handles user business logic
 */

// ========================================
// IMPORTS
// ========================================
import { injectable } from 'inversify';
import { UserRepository } from '../repositories/UserRepository';
import type { User, CreateUserDTO } from '../types/user.types';

// ========================================
// CONSTANTS
// ========================================
const MAX_USERNAME_LENGTH = 50;
const MIN_PASSWORD_LENGTH = 8;

// ========================================
// TYPES
// ========================================
interface UserServiceOptions {
  sendWelcomeEmail?: boolean;
}

// ========================================
// CLASS IMPLEMENTATION
// ========================================
@injectable()
export class UserService {
  // ----------------------------------
  // Properties
  // ----------------------------------
  private userRepository: UserRepository;
  private emailService: EmailService;

  // ----------------------------------
  // Constructor
  // ----------------------------------
  constructor(
    userRepository: UserRepository,
    emailService: EmailService
  ) {
    this.userRepository = userRepository;
    this.emailService = emailService;
  }

  // ----------------------------------
  // Public Methods
  // ----------------------------------

  /**
   * WHY: Creates new user accounts with validation and welcome email
   * WHEN: Called during user registration flow
   * HOW: Validates input, hashes password, saves to DB, sends email
   */
  async createUser(data: CreateUserDTO): Promise<User> {
    // Implementation
  }

  /**
   * WHY: Retrieves user by ID for profile viewing
   * WHEN: Called when viewing user profiles or dashboard
   * HOW: Queries repository and maps to public user object
   */
  async getUserById(id: string): Promise<User> {
    // Implementation
  }

  // ----------------------------------
  // Private Methods
  // ----------------------------------

  /**
   * WHY: Centralizes validation logic for reuse
   * WHEN: Called before creating or updating users
   * HOW: Checks email format, username length, password strength
   */
  private validateUserData(data: CreateUserDTO): void {
    // Implementation
  }
}

// ========================================
// HELPER FUNCTIONS (if needed)
// ========================================

/**
 * WHY: Extract reusable logic that doesn't need class state
 * WHEN: Called by service methods
 * HOW: Pure function for specific task
 */
function formatUsername(username: string): string {
  return username.trim().toLowerCase();
}
```

### React Component Files

```tsx
/**
 * FILE: LoginForm.tsx
 * PURPOSE: User authentication form with validation
 */

// ========================================
// IMPORTS
// ========================================
import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { LoginFormData } from '../types/auth.types';
import styles from './LoginForm.module.css';

// ========================================
// TYPES
// ========================================
interface LoginFormProps {
  onSuccess?: () => void;
  redirectUrl?: string;
}

// ========================================
// COMPONENT
// ========================================

/**
 * WHY: Provides reusable login form with validation and error handling
 * WHEN: Use on login pages, modals, or anywhere authentication is needed
 * HOW: Manages form state, validates input, calls auth service, handles errors
 */
export function LoginForm({ onSuccess, redirectUrl }: LoginFormProps) {
  // ----------------------------------
  // State
  // ----------------------------------
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ----------------------------------
  // Hooks
  // ----------------------------------
  const { login, isLoading } = useAuth();

  // ----------------------------------
  // Handlers
  // ----------------------------------

  /**
   * WHY: Validates and submits login credentials
   * WHEN: Called on form submission
   * HOW: Validates input, calls auth service, handles success/error
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Implementation
  };

  /**
   * WHY: Updates form state as user types
   * WHEN: Called on input change
   * HOW: Merges new value with existing form data
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Implementation
  };

  // ----------------------------------
  // Render
  // ----------------------------------
  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* JSX */}
    </form>
  );
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * WHY: Validates form data before submission
 * WHEN: Called before login attempt
 * HOW: Checks email format and password requirements
 */
function validateLoginForm(data: LoginFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  // Implementation
  return errors;
}
```

## When to Split Files

### Split When:

1. **File exceeds 400 lines** - Plan extraction before hitting 500 limit
2. **Multiple responsibilities** - Each file should have ONE purpose
3. **Reusable logic found** - Extract utilities, hooks, services
4. **Hard to test** - If testing requires mocking too much, split it
5. **Hard to navigate** - If you're scrolling a lot, split it

### How to Split:

**Example: Large UserService (600 lines)**

```typescript
// ❌ BEFORE: UserService.ts (600 lines)
class UserService {
  // User CRUD (200 lines)
  createUser() {}
  updateUser() {}
  deleteUser() {}

  // Password management (200 lines)
  changePassword() {}
  resetPassword() {}
  validatePassword() {}

  // Profile management (200 lines)
  updateProfile() {}
  uploadAvatar() {}
  updateSettings() {}
}

// ✅ AFTER: Split into focused services
// UserService.ts (200 lines)
class UserService {
  createUser() {}
  updateUser() {}
  deleteUser() {}
}

// UserPasswordService.ts (200 lines)
class UserPasswordService {
  changePassword() {}
  resetPassword() {}
  validatePassword() {}
}

// UserProfileService.ts (200 lines)
class UserProfileService {
  updateProfile() {}
  uploadAvatar() {}
  updateSettings() {}
}
```

## Enforcement

**Code quality auditor will check:**
- ✅ Files are in correct directories
- ✅ Naming conventions followed
- ✅ Import order is correct
- ✅ File structure follows template
- ✅ No files exceed line limits
- ✅ Related files are co-located

**Quick Checklist:**
- [ ] File is in the correct feature/shared/core directory
- [ ] File name follows naming convention
- [ ] Imports are organized in correct order
- [ ] File has proper header documentation
- [ ] Sections are clearly marked with comments
- [ ] File doesn't exceed line limit
