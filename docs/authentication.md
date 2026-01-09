# Authentication & Authorization System

## Overview

My Contractor Now uses a role-based access control (RBAC) system with JWT tokens for secure, stateless authentication.

---

## User Types

| Type | Description | Access Level |
|------|-------------|--------------|
| **SUPER_ADMIN** | System owner (you) | Full access to everything |
| **ADMIN** | Staff members | Manage leads, services, buyers |
| **SUPPORT** | Customer support | View-only access |
| **AFFILIATE** | External partners | Affiliate dashboard only |
| **CONTRACTOR** | Service providers | Contractor portal (future) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                        │
├─────────────────────────────────────────────────────────────┤
│  localStorage: authToken    cookie: auth-token (httpOnly)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Middleware                         │
│  - Checks auth token on protected routes                    │
│  - Redirects unauthenticated users to /admin/login          │
│  - Validates JWT signature and expiry                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Routes                               │
│  - Validate Bearer token in Authorization header            │
│  - Check user permissions for the action                    │
│  - Return 401/403 for unauthorized requests                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database                                │
│  - AdminUser: passwordHash, role, active                    │
│  - Affiliate: passwordHash, status                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Permissions Matrix

### Admin Roles

| Permission | SUPER_ADMIN | ADMIN | SUPPORT |
|------------|:-----------:|:-----:|:-------:|
| `admin:read` | ✅ | ✅ | ✅ |
| `admin:write` | ✅ | ✅ | ❌ |
| `leads:read` | ✅ | ✅ | ✅ |
| `leads:write` | ✅ | ✅ | ❌ |
| `leads:delete` | ✅ | ❌ | ❌ |
| `services:read` | ✅ | ✅ | ✅ |
| `services:write` | ✅ | ✅ | ❌ |
| `buyers:read` | ✅ | ✅ | ✅ |
| `buyers:write` | ✅ | ✅ | ❌ |
| `users:read` | ✅ | ❌ | ❌ |
| `users:write` | ✅ | ❌ | ❌ |
| `analytics:read` | ✅ | ✅ | ✅ |
| `settings:write` | ✅ | ❌ | ❌ |

---

## Authentication Flow

### Login Flow

```
1. User submits email + password to POST /api/auth/admin/login
2. Server validates credentials against database (bcrypt compare)
3. If valid, server generates JWT with user info + permissions
4. JWT returned to client, stored in:
   - httpOnly cookie (for SSR/middleware)
   - localStorage (for client-side API calls)
5. Subsequent requests include token in Authorization header
```

### Token Structure

```typescript
// JWT Payload
{
  userId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT';
  permissions: string[];
  iat: number;  // Issued at
  exp: number;  // Expires (24h default)
}
```

### Logout Flow

```
1. Client calls POST /api/auth/logout
2. Server clears httpOnly cookie
3. Client clears localStorage
4. Client redirects to /admin/login
```

---

## Implementation Guide

### 1. Protecting API Routes

```typescript
// src/app/api/admin/example/route.ts
import { withAuth, requirePermission } from '@/lib/auth';

export const GET = withAuth(
  async (request, context) => {
    // context.user contains authenticated user
    const { user } = context;

    // Your logic here
    return NextResponse.json({ data: '...' });
  },
  { requiredPermissions: ['admin:read'] }
);
```

### 2. Protecting Pages (Server Components)

```typescript
// src/app/(admin)/admin/page.tsx
import { getServerSession } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/admin/login');
  }

  // Page content
}
```

### 3. Client-Side Auth Hook

```typescript
// In any client component
'use client';
import { useAuth } from '@/hooks/useAuth';

export function MyComponent() {
  const { user, isLoading, hasPermission, logout } = useAuth();

  if (isLoading) return <Loading />;
  if (!user) return <Redirect to="/admin/login" />;

  return (
    <div>
      <p>Welcome, {user.name}</p>
      {hasPermission('services:write') && (
        <Button>Edit Services</Button>
      )}
    </div>
  );
}
```

### 4. Permission Gates (UI)

```typescript
// Declarative permission checks
import { PermissionGate } from '@/components/auth/PermissionGate';

<PermissionGate permission="users:write" fallback={<AccessDenied />}>
  <UserManagementPanel />
</PermissionGate>

// Multiple permissions (any)
<PermissionGate permissions={['admin:write', 'leads:write']} requireAll={false}>
  <EditButton />
</PermissionGate>
```

---

## Security Best Practices

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- Hashed with bcrypt (12 salt rounds)

### Token Security
- JWT signed with HS256 algorithm
- Tokens expire after 24 hours
- httpOnly cookies prevent XSS attacks
- Secure flag set in production (HTTPS only)
- SameSite=Lax prevents CSRF

### Rate Limiting
- Login endpoint: 5 attempts per minute per IP
- Failed attempts logged for security audit
- Account lockout after 10 failed attempts

---

## Environment Variables

```bash
# Required for auth
JWT_SECRET=your-super-secret-key-min-32-chars
ADMIN_API_KEY=your-admin-api-key

# Optional
JWT_EXPIRES_IN=24h
SESSION_COOKIE_NAME=mcn-auth-token
```

---

## Database Schema

```prisma
model AdminUser {
  id           String           @id @default(cuid())
  email        String           @unique
  passwordHash String
  name         String
  role         AdminUserRole    @default(ADMIN)
  active       Boolean          @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  // Relations
  statusChanges LeadStatusHistory[]
}

enum AdminUserRole {
  SUPER_ADMIN
  ADMIN
  SUPPORT
}
```

---

## API Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/auth/admin/login` | POST | Admin login | No |
| `/api/auth/admin/logout` | POST | Admin logout | Yes |
| `/api/auth/admin/me` | GET | Get current user | Yes |
| `/api/auth/admin/refresh` | POST | Refresh token | Yes |
| `/api/admin/users` | GET | List admin users | SUPER_ADMIN |
| `/api/admin/users` | POST | Create admin user | SUPER_ADMIN |
| `/api/admin/users/[id]` | PUT | Update admin user | SUPER_ADMIN |
| `/api/admin/users/[id]` | DELETE | Delete admin user | SUPER_ADMIN |

---

## Troubleshooting

### "Token expired" errors
- Tokens expire after 24 hours
- Client should refresh token or redirect to login

### "Insufficient permissions" errors
- User's role doesn't have required permission
- Check permissions matrix above

### Login not working
- Ensure `JWT_SECRET` is set in environment
- Check database connection
- Verify password hash is stored correctly

---

## Future Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] OAuth/SSO integration (Google, Microsoft)
- [ ] Session management (view/revoke active sessions)
- [ ] Password reset via email
- [ ] Audit logging for all auth events
- [ ] Contractor portal authentication
