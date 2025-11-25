# Technical Stack

## Application Framework
- **Framework:** Next.js 14.2.0
- **Runtime:** Node.js 18+
- **Language:** TypeScript 5.2.2

## Frontend
- **JavaScript Framework:** React 18.2.0
- **CSS Framework:** Tailwind CSS 3.3.0
- **UI Component Library:** Radix UI (@radix-ui/react-*)
- **Forms:** React Hook Form 7.47.0 with Zod validation
- **Icons:** Heroicons 2.2.0, Lucide React 0.292.0
- **Fonts Provider:** System fonts with Tailwind typography
- **Maps:** MapLibre GL 5.6.2, React Simple Maps 3.0.0, Radar SDK JS 4.5.5
- **Charts:** Recharts 3.1.2

## Backend
- **API Architecture:** Next.js API Routes (serverless)
- **Database:** SQLite (via Prisma, configured for PostgreSQL compatibility)
- **ORM:** Prisma 5.6.0
- **Queue System:** Redis with ioredis 5.3.2
- **Rate Limiting:** rate-limiter-flexible 7.2.0
- **Authentication:** JWT with jsonwebtoken 9.0.2
- **Validation:** Zod 3.22.4
- **Logging:** Winston 3.17.0

## External Services
- **Address Validation:** Radar.com API
- **Compliance Tracking:** TrustedForm API
- **Lead Tracking:** Jornaya Universal LeadID
- **HTTP Client:** Axios 1.6.0

## Development Tools
- **Package Manager:** npm
- **Testing:** Jest 29.7.0 with jsdom environment
- **Linting:** ESLint 8.51.0 with Next.js config
- **Git Hooks:** Husky 8.0.3 with lint-staged 15.0.0
- **Build Tools:** Next.js built-in, PostCSS 8.4.31
- **Dev Tools:** tsx 4.0.0 for TypeScript execution

## Deployment
- **Application Hosting:** TBD (Vercel recommended for Next.js)
- **Database Hosting:** TBD (PostgreSQL compatible)
- **Redis Hosting:** TBD (Redis Cloud, AWS ElastiCache, etc.)
- **Asset Hosting:** Next.js static assets
- **Deployment Solution:** TBD
- **Code Repository:** Git (local)

## Import Strategy
- **Module System:** Node.js ES modules
- **Path Aliases:** Configured in tsconfig.json

## Architecture Patterns
- **Frontend:** Server Components + Client Components (Next.js 14 App Router)
- **Backend:** API Routes with middleware
- **Data Layer:** Prisma ORM with schema-first approach
- **Queue Processing:** Background workers with Redis
- **Caching:** Redis for session and response caching
- **State Management:** React Hook Form for forms, URL state for navigation
