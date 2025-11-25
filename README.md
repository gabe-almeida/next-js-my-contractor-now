# Contractor Lead Management Platform

A sophisticated lead management platform built with Next.js 14 that captures contractor service requests through dynamic forms, processes them through an auction system, and distributes them to the highest bidding lead buyers.

## 🏗️ Architecture Overview

This platform implements a modern, scalable architecture with:

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes with serverless functions  
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Redis for async processing
- **Cache**: Redis for session and response caching
- **External APIs**: Radar.com for address validation
- **Compliance**: TrustedForm and Jornaya integration

## 🚀 Key Features

### Dynamic Service Forms
- Service-specific form generation (Windows, Bathrooms, Roofing)
- ZIP code validation with Radar.com
- TrustedForm certificate capture
- Jornaya Universal LeadID tracking
- TCPA compliance checkboxes

### Lead Processing Engine
- Async processing with Redis queues
- Template engine for buyer data transformation
- Parallel PING auction system
- Compliance data integration
- Complete audit trail

### Buyer Management
- Multi-buyer support (Modernize, HomeAdvisor, Angi, etc.)
- Configurable field mappings per buyer
- Webhook integration with retry logic
- Bid processing and selection

### Admin Dashboard
- Service type management
- Buyer configuration
- Lead monitoring and analytics
- Performance metrics

## 📋 Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/                     # API routes
│   │   ├── leads/              # Lead management endpoints
│   │   ├── service-types/      # Service type configuration
│   │   ├── admin/              # Admin operations
│   │   └── webhooks/           # Buyer webhook endpoints
│   ├── (admin)/                # Admin routes group
│   ├── (public)/               # Public routes group
│   ├── globals.css
│   └── layout.tsx
├── components/                  # Reusable components
│   ├── ui/                     # Base UI components
│   ├── forms/                  # Form components
│   ├── admin/                  # Admin-specific components
│   └── layout/                 # Layout components
├── lib/                        # Utility libraries
│   ├── db.ts                   # Database connection
│   ├── redis.ts                # Redis connection
│   ├── validations/            # Zod schemas
│   ├── templates/              # Template engine
│   ├── external/               # External API integrations
│   └── utils.ts                # General utilities
├── workers/                    # Background workers
│   └── lead-processor.ts       # Lead processing worker
└── types/                      # TypeScript types
    ├── database.ts
    ├── forms.ts
    └── api.ts
```

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL 13+
- Redis 6+
- Radar.com API key
- TrustedForm API key (optional)
- Jornaya Pixel ID (optional)

### Installation

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd contractor-platform
npm install
```

2. **Environment setup**
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

3. **Database setup**
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Optional: Run migrations instead
npm run db:migrate

# Optional: Seed database
npm run db:seed
```

4. **Start development servers**
```bash
# Start Next.js app
npm run dev

# Start lead processor worker (separate terminal)
npm run worker:dev
```

## 🔧 Configuration

### Database Schema

The platform uses a comprehensive PostgreSQL schema with the following key tables:

- `service_types` - Dynamic form schemas per service
- `buyers` - Lead buyer configuration  
- `buyer_service_configs` - Field mappings per buyer+service
- `leads` - All lead submissions with compliance data
- `transactions` - PING/POST logs with audit trail
- `compliance_audit_log` - Compliance event tracking

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/contractor_platform"

# Redis
REDIS_URL="redis://localhost:6379"

# External APIs
RADAR_API_KEY="your_radar_api_key"
TRUSTEDFORM_API_KEY="your_trustedform_api_key" 
JORNAYA_PIXEL_ID="your_jornaya_pixel_id"

# Security
NEXTAUTH_SECRET="your-nextauth-secret-here"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="secure_admin_password"
```

## 🎯 API Endpoints

### Public APIs
- `POST /api/leads` - Submit new lead
- `GET /api/service-types` - Get available services
- `GET /api/service-types/[id]/form` - Get form schema

### Admin APIs  
- `GET /api/admin/leads` - View leads
- `POST /api/admin/service-types` - Manage service types
- `POST /api/admin/buyers` - Manage buyers

### Webhook APIs
- `POST /api/webhooks/[buyer]` - Buyer webhook endpoints

## 🔄 Lead Processing Flow

1. **Form Submission**
   - User fills out service-specific form
   - ZIP code validated with Radar.com
   - TrustedForm certificate generated
   - Jornaya LeadID captured
   - Lead stored with compliance data

2. **Queue Processing**
   - Lead added to Redis processing queue
   - Background worker picks up lead
   - Status updated to PROCESSING

3. **Auction System**
   - Parallel PING sent to all active buyers
   - Bid responses collected and validated
   - Highest bidder determined

4. **Lead Delivery**
   - POST request sent to winning buyer
   - Transaction logged with full audit trail
   - Lead status updated to SOLD/REJECTED

## 🛡️ Compliance & Security

### TrustedForm Integration
- Automatic certificate generation
- Certificate validation
- Compliance scoring
- Audit trail maintenance

### Jornaya Integration  
- Universal LeadID tracking
- Pixel firing verification
- Cross-session persistence
- Compliance reporting

### Security Features
- Input validation with Zod
- SQL injection prevention
- Rate limiting
- Error handling & logging
- CORS configuration

## 📊 Monitoring & Analytics

### Performance Metrics
- Lead conversion rates
- Average bid amounts
- Buyer response times
- Processing durations

### Compliance Metrics
- TrustedForm coverage
- Jornaya tracking rates
- TCPA consent rates
- Quality score distribution

## 🚀 Deployment

### Development
```bash
npm run dev
npm run worker:dev
```

### Production
```bash
npm run build
npm start
npm run worker:leads
```

### Docker Support
```bash
docker-compose up -d
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run type-check

# Linting
npm run lint
```

## 📈 Performance Targets

- **Form Load Time**: < 2 seconds
- **Lead Processing**: < 30 seconds  
- **API Response Time**: < 500ms p95
- **System Uptime**: > 99.9%
- **Conversion Rate**: > 75%

## 🤝 Contributing

1. Follow TypeScript strict mode
2. Use Zod for validation
3. Write tests for new features
4. Update documentation
5. Follow SPARC methodology

## 📄 License

This project is proprietary software. All rights reserved.

---

**Built with SPARC methodology and Claude-Flow orchestration for systematic development.**