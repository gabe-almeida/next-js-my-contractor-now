# Development Plan: Contractor Lead Management Platform

## Overview
This development plan implements the contractor platform based on the mermaid diagrams, following SPARC methodology with modular, efficient, and organized phases.

## Development Phases

### 🏗️ Phase 1: Foundation & Database (Weeks 1-2)

#### Objectives
- Establish core project structure
- Set up database schema and models
- Create basic API foundation

#### Tasks

**1.1 Project Setup**
```bash
# Initialize Next.js 14 with TypeScript
npx create-next-app@latest contractor-platform --typescript --tailwind --eslint --app
cd contractor-platform

# Install core dependencies
npm install @prisma/client prisma
npm install @radix-ui/react-* class-variance-authority clsx
npm install zod react-hook-form @hookform/resolvers
npm install redis ioredis
npm install axios
```

**1.2 Database Schema Implementation**
```sql
-- Based on mermaid architecture diagram with TrustedForm and Jornaya support
CREATE DATABASE contractor_platform;

-- Service Types Table
CREATE TABLE service_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    form_schema JSONB NOT NULL, -- Dynamic form configuration
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Buyers Table
CREATE TABLE buyers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    api_url VARCHAR(255) NOT NULL,
    auth_config JSONB, -- Authentication configuration
    ping_timeout INTEGER DEFAULT 30, -- seconds
    post_timeout INTEGER DEFAULT 60, -- seconds
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Buyer Service Configurations Table
CREATE TABLE buyer_service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    service_type_id UUID NOT NULL REFERENCES service_types(id) ON DELETE CASCADE,
    ping_template JSONB NOT NULL, -- Template for PING requests
    post_template JSONB NOT NULL, -- Template for POST requests
    field_mappings JSONB NOT NULL, -- Field transformation rules
    requires_trustedform BOOLEAN DEFAULT false, -- TrustedForm requirement
    requires_jornaya BOOLEAN DEFAULT false, -- Jornaya LeadID requirement
    compliance_config JSONB, -- Compliance-specific configurations
    min_bid DECIMAL(10,2) DEFAULT 0.00,
    max_bid DECIMAL(10,2) DEFAULT 999.99,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(buyer_id, service_type_id)
);

-- Leads Table (Enhanced with TrustedForm and Jornaya fields)
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type_id UUID NOT NULL REFERENCES service_types(id),
    form_data JSONB NOT NULL, -- All form responses
    zip_code VARCHAR(10) NOT NULL,
    owns_home BOOLEAN NOT NULL,
    timeframe VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PROCESSING, SOLD, REJECTED
    winning_buyer_id UUID REFERENCES buyers(id),
    winning_bid DECIMAL(10,2),
    -- Compliance and tracking fields
    trusted_form_cert_url VARCHAR(500), -- TrustedForm certificate URL
    trusted_form_cert_id VARCHAR(100), -- TrustedForm certificate ID
    jornaya_lead_id VARCHAR(100), -- Jornaya Universal LeadID
    compliance_data JSONB, -- Additional compliance data (IP, user agent, etc.)
    lead_quality_score INTEGER, -- Quality score based on compliance data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_zip_code (zip_code),
    INDEX idx_created_at (created_at),
    INDEX idx_trusted_form_cert_id (trusted_form_cert_id),
    INDEX idx_jornaya_lead_id (jornaya_lead_id),
    INDEX idx_lead_quality_score (lead_quality_score)
);

-- Transactions Table (Enhanced with compliance tracking)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES buyers(id),
    action_type VARCHAR(20) NOT NULL, -- PING, POST
    payload JSONB NOT NULL, -- Request payload sent
    response JSONB, -- Response received
    status VARCHAR(20) NOT NULL, -- PENDING, SUCCESS, FAILED, TIMEOUT
    bid_amount DECIMAL(10,2), -- For PING responses
    response_time INTEGER, -- milliseconds
    error_message TEXT,
    compliance_included BOOLEAN DEFAULT false, -- Whether compliance data was included
    trusted_form_present BOOLEAN DEFAULT false, -- TrustedForm cert included
    jornaya_present BOOLEAN DEFAULT false, -- Jornaya LeadID included
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_lead_id (lead_id),
    INDEX idx_action_type (action_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_compliance_included (compliance_included)
);

-- Compliance Audit Log Table
CREATE TABLE compliance_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- TRUSTEDFORM_GENERATED, JORNAYA_CAPTURED, FORM_SUBMITTED
    event_data JSONB NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_lead_id (lead_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
);
```

**1.3 Prisma Schema Setup**
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model ServiceType {
  id          String   @id @default(uuid())
  name        String   @unique
  displayName String   @map("display_name")
  formSchema  Json     @map("form_schema")
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  leads               Lead[]
  buyerServiceConfigs BuyerServiceConfig[]

  @@map("service_types")
}

model Buyer {
  id          String   @id @default(uuid())
  name        String
  apiUrl      String   @map("api_url")
  authConfig  Json?    @map("auth_config")
  pingTimeout Int      @default(30) @map("ping_timeout")
  postTimeout Int      @default(60) @map("post_timeout")
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  serviceConfigs BuyerServiceConfig[]
  transactions   Transaction[]
  wonLeads       Lead[]

  @@map("buyers")
}

// Additional models following same pattern...
```

**1.4 Project Structure**
```
src/
├── app/                          # Next.js App Router
│   ├── (admin)/                 # Admin routes group
│   │   ├── admin/
│   │   │   ├── buyers/
│   │   │   ├── leads/
│   │   │   ├── service-types/
│   │   │   └── dashboard/
│   ├── (public)/                # Public routes group
│   │   ├── [serviceType]/       # Dynamic service forms
│   │   └── page.tsx            # Home page
│   ├── api/                     # API routes
│   │   ├── leads/
│   │   ├── service-types/
│   │   ├── admin/
│   │   └── webhooks/
│   ├── globals.css
│   └── layout.tsx
├── components/                   # Reusable components
│   ├── ui/                      # Base UI components
│   ├── forms/                   # Form components
│   ├── admin/                   # Admin-specific components
│   └── layout/                  # Layout components
├── lib/                         # Utility libraries
│   ├── db.ts                    # Database connection
│   ├── redis.ts                 # Redis connection
│   ├── validations/             # Zod schemas
│   ├── templates/               # Template engine
│   └── utils.ts                 # General utilities
├── workers/                     # Background workers
│   ├── lead-processor.ts
│   └── auction-engine.ts
└── types/                       # TypeScript types
    ├── database.ts
    ├── forms.ts
    └── api.ts
```

#### Deliverables
- ✅ Next.js project with TypeScript setup
- ✅ PostgreSQL database with complete schema
- ✅ Prisma ORM configuration and migrations
- ✅ Basic project structure and folder organization
- ✅ Environment configuration (.env.local)

---

### 🎨 Phase 2: Dynamic Form Engine & Compliance Integration (Weeks 3-4)

#### Objectives
- Build dynamic form system based on service types
- Integrate TrustedForm and Jornaya LeadID tracking
- Implement Radar.com API integration
- Create lead capture with compliance validation

#### Tasks

**2.1 TrustedForm & Jornaya Integration**
```typescript
// components/forms/ComplianceProviders.tsx
'use client';

import { TrustedFormProvider } from './TrustedFormProvider';
import { JornayaProvider } from './JornayaProvider';

export function ComplianceProviders({ children }: { children: React.ReactNode }) {
  return (
    <TrustedFormProvider>
      <JornayaProvider>
        {children}
      </JornayaProvider>
    </TrustedFormProvider>
  );
}

// Implementation includes:
// - TrustedForm certificate generation and capture
// - Jornaya Universal LeadID tracking
// - TCPA compliance checkboxes and disclosures
// - Hidden form fields for compliance data
// - Real-time compliance status monitoring
```

**2.2 Dynamic Form Engine with Compliance**
```typescript
// lib/forms/FormEngine.ts
interface FormField {
  name: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'radio';
  label: string;
  required: boolean;
  options?: string[];
  validation?: Record<string, any>;
}

interface FormSchema {
  title: string;
  description: string;
  fields: FormField[];
}

class FormEngine {
  static generateForm(schema: FormSchema): JSX.Element {
    // Dynamic form generation logic
  }
  
  static validateSubmission(data: any, schema: FormSchema): ValidationResult {
    // Form validation logic
  }
}

// Example service type form schemas
const WINDOWS_FORM_SCHEMA: FormSchema = {
  title: "Windows Replacement Quote",
  description: "Get quotes for your window replacement project",
  fields: [
    {
      name: "zipCode",
      type: "text",
      label: "ZIP Code",
      required: true,
      validation: { pattern: "^\\d{5}$" }
    },
    {
      name: "ownsHome",
      type: "radio",
      label: "Do you own your home?",
      required: true,
      options: ["Yes", "No"]
    },
    {
      name: "timeframe",
      type: "select",
      label: "When do you need this done?",
      required: true,
      options: ["Immediately", "Within 1 month", "1-3 months", "3-6 months"]
    },
    {
      name: "numberOfWindows",
      type: "select",
      label: "How many windows?",
      required: true,
      options: ["1-3", "4-6", "7-10", "11-15", "16+"]
    },
    {
      name: "windowsProjectScope",
      type: "select",
      label: "What type of work do you need?",
      required: true,
      options: ["Full replacement", "Installation only", "Repair", "Not sure"]
    }
  ]
};
```

**2.2 Radar.com Integration**
```typescript
// lib/external/radar.ts
export class RadarService {
  private static apiKey = process.env.RADAR_API_KEY!;
  
  static async validateZipCode(zipCode: string): Promise<AddressValidation> {
    const response = await fetch(`https://api.radar.io/v1/geocode/forward`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: zipCode })
    });
    
    const data = await response.json();
    return {
      isValid: data.addresses?.length > 0,
      city: data.addresses?.[0]?.city,
      state: data.addresses?.[0]?.state,
      coordinates: data.addresses?.[0]?.geometry
    };
  }
}
```

**2.3 Enhanced Lead Capture API with Compliance**
```typescript
// app/api/leads/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { RadarService } from '@/lib/external/radar';
import { addToQueue } from '@/lib/redis';

const leadSubmissionSchema = z.object({
  serviceTypeId: z.string().uuid(),
  formData: z.record(z.any()),
  zipCode: z.string().regex(/^\d{5}$/),
  ownsHome: z.boolean(),
  timeframe: z.string()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = leadSubmissionSchema.parse(body);
    
    // Validate ZIP code with Radar.com
    const zipValidation = await RadarService.validateZipCode(validatedData.zipCode);
    if (!zipValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid ZIP code' },
        { status: 400 }
      );
    }
    
    // Save lead to database
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: validatedData.serviceTypeId,
        formData: validatedData.formData,
        zipCode: validatedData.zipCode,
        ownsHome: validatedData.ownsHome,
        timeframe: validatedData.timeframe,
        status: 'PENDING'
      }
    });
    
    // Add to processing queue
    await addToQueue('lead-processing', {
      leadId: lead.id,
      priority: 'normal'
    });
    
    return NextResponse.json({
      success: true,
      leadId: lead.id,
      message: 'Lead submitted successfully'
    });
    
  } catch (error) {
    console.error('Lead submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit lead' },
      { status: 500 }
    );
  }
}
```

#### Deliverables
- ✅ TrustedForm integration with certificate capture
- ✅ Jornaya Universal LeadID tracking implementation
- ✅ Dynamic form engine with compliance data collection
- ✅ TCPA compliance checkboxes and disclosures
- ✅ Service type management API
- ✅ Radar.com ZIP code validation
- ✅ Enhanced lead capture API with compliance validation
- ✅ Form submission workflow with audit trail

---

### ⚙️ Phase 3: Background Processing & Template Engine (Weeks 5-6)

#### Objectives
- Set up Redis queue and background workers
- Build template engine for buyer data transformation
- Implement basic auction logic

#### Tasks

**3.1 Redis Queue Setup**
```typescript
// lib/redis.ts
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL!);

export async function addToQueue(queueName: string, data: any, priority = 'normal') {
  const job = {
    id: crypto.randomUUID(),
    data,
    priority,
    timestamp: Date.now(),
    attempts: 0,
    maxAttempts: 3
  };
  
  await redis.lpush(`queue:${queueName}`, JSON.stringify(job));
  return job.id;
}

export async function processQueue(queueName: string, processor: (job: any) => Promise<void>) {
  while (true) {
    try {
      const job = await redis.brpop(`queue:${queueName}`, 0);
      if (job) {
        const [, jobData] = job;
        const parsedJob = JSON.parse(jobData);
        await processor(parsedJob);
      }
    } catch (error) {
      console.error(`Queue processing error:`, error);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retry
    }
  }
}
```

**3.2 Template Engine**
```typescript
// lib/templates/TemplateEngine.ts
interface TemplateMapping {
  sourceField: string;
  targetField: string;
  transform?: 'uppercase' | 'lowercase' | 'number' | 'boolean' | string; // Custom transform function name
  defaultValue?: any;
  required?: boolean;
}

export class TemplateEngine {
  static transform(data: any, mappings: TemplateMapping[]): any {
    const result: any = {};
    
    for (const mapping of mappings) {
      let value = this.getNestedValue(data, mapping.sourceField);
      
      if (value === undefined || value === null) {
        if (mapping.defaultValue !== undefined) {
          value = mapping.defaultValue;
        } else if (mapping.required) {
          throw new Error(`Required field ${mapping.sourceField} is missing`);
        } else {
          continue;
        }
      }
      
      // Apply transformations
      if (mapping.transform) {
        value = this.applyTransform(value, mapping.transform);
      }
      
      this.setNestedValue(result, mapping.targetField, value);
    }
    
    return result;
  }
  
  private static applyTransform(value: any, transform: string): any {
    switch (transform) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      default:
        // Custom transform functions
        return this.customTransforms[transform]?.(value) ?? value;
    }
  }
  
  private static customTransforms = {
    // Windows-specific transforms
    windowsCount: (value: string): string => {
      const mapping: Record<string, string> = {
        '1-3': '1-3',
        '4-6': '4-6',
        '7-10': '6-9',
        '11-15': '10+',
        '16+': '10+'
      };
      return mapping[value] || value;
    },
    
    // Bathrooms-specific transforms
    bathroomCount: (value: string): number => {
      const match = value.match(/(\d+)/);
      return match ? parseInt(match[1]) : 1;
    }
  };
}

// Example buyer configurations
const MODERNIZE_WINDOWS_CONFIG = {
  pingTemplate: {
    mappings: [
      { sourceField: 'zipCode', targetField: 'zip_code' },
      { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean' }
    ]
  },
  postTemplate: {
    mappings: [
      { sourceField: 'zipCode', targetField: 'zip_code' },
      { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean' },
      { sourceField: 'numberOfWindows', targetField: 'window_count', transform: 'windowsCount' },
      { sourceField: 'windowsProjectScope', targetField: 'project_scope' }
    ]
  }
};
```

**3.3 Lead Processor Worker**
```typescript
// workers/lead-processor.ts
import { processQueue } from '@/lib/redis';
import { prisma } from '@/lib/db';
import { AuctionEngine } from '@/lib/auction/AuctionEngine';

async function processLead(job: any) {
  const { leadId } = job.data;
  
  try {
    // Update lead status to PROCESSING
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'PROCESSING' }
    });
    
    // Get lead with service type and active buyers
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        serviceType: {
          include: {
            buyerServiceConfigs: {
              where: { active: true },
              include: { buyer: true }
            }
          }
        }
      }
    });
    
    if (!lead || lead.serviceType.buyerServiceConfigs.length === 0) {
      throw new Error('No active buyers found for this service type');
    }
    
    // Run auction
    const auctionResult = await AuctionEngine.runAuction(lead);
    
    if (auctionResult.winner) {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          status: 'SOLD',
          winningBuyerId: auctionResult.winner.buyerId,
          winningBid: auctionResult.winner.bidAmount
        }
      });
    } else {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: 'REJECTED' }
      });
    }
    
    console.log(`Lead ${leadId} processed successfully`);
    
  } catch (error) {
    console.error(`Failed to process lead ${leadId}:`, error);
    
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'REJECTED' }
    });
  }
}

// Start the worker
processQueue('lead-processing', processLead);
```

#### Deliverables
- ✅ Redis queue system for async processing
- ✅ Background worker for lead processing
- ✅ Template engine with TrustedForm/Jornaya field mapping
- ✅ Compliance data transformation logic
- ✅ Lead quality scoring based on compliance data
- ✅ Basic lead status tracking
- ✅ Error handling and retry logic

---

### 🏆 Phase 4: Auction System & Buyer Integration (Weeks 7-8)

#### Objectives
- Implement parallel PING auction system
- Build buyer webhook endpoints
- Complete transaction logging

#### Tasks

**4.1 Auction Engine**
```typescript
// lib/auction/AuctionEngine.ts
import { TemplateEngine } from '@/lib/templates/TemplateEngine';

interface BidResponse {
  buyerId: string;
  bidAmount: number;
  success: boolean;
  responseTime: number;
  error?: string;
}

export class AuctionEngine {
  static async runAuction(lead: any): Promise<AuctionResult> {
    const buyers = lead.serviceType.buyerServiceConfigs;
    
    // Phase 1: Send PING requests to all buyers in parallel
    const pingPromises = buyers.map(config => this.sendPing(lead, config));
    const pingResults = await Promise.allSettled(pingPromises);
    
    // Collect successful bids
    const bids: BidResponse[] = [];
    for (let i = 0; i < pingResults.length; i++) {
      const result = pingResults[i];
      if (result.status === 'fulfilled' && result.value.success) {
        bids.push(result.value);
      }
      
      // Log transaction
      await this.logTransaction(lead.id, buyers[i].buyerId, 'PING', result);
    }
    
    if (bids.length === 0) {
      return { winner: null, bids: [] };
    }
    
    // Phase 2: Determine winner (highest bid)
    const winner = bids.reduce((highest, current) => 
      current.bidAmount > highest.bidAmount ? current : highest
    );
    
    // Phase 3: Send POST to winner
    const winnerConfig = buyers.find(b => b.buyerId === winner.buyerId)!;
    const postResult = await this.sendPost(lead, winnerConfig);
    
    await this.logTransaction(lead.id, winner.buyerId, 'POST', postResult);
    
    return {
      winner: postResult.success ? winner : null,
      bids,
      postResult
    };
  }
  
  private static async sendPing(lead: any, config: any): Promise<BidResponse> {
    const startTime = Date.now();
    
    try {
      // Transform data using buyer's PING template
      const payload = TemplateEngine.transform(
        { ...lead.formData, zipCode: lead.zipCode, ownsHome: lead.ownsHome },
        config.pingTemplate.mappings
      );
      
      const response = await fetch(`${config.buyer.apiUrl}/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': config.buyer.authConfig?.token || '',
          'X-Service-Type': lead.serviceType.name
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.buyer.pingTimeout * 1000)
      });
      
      const responseTime = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        buyerId: config.buyerId,
        bidAmount: data.bidAmount || 0,
        success: true,
        responseTime
      };
      
    } catch (error) {
      return {
        buyerId: config.buyerId,
        bidAmount: 0,
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private static async sendPost(lead: any, config: any): Promise<PostResult> {
    try {
      // Transform data using buyer's POST template
      const payload = TemplateEngine.transform(
        { ...lead.formData, zipCode: lead.zipCode, ownsHome: lead.ownsHome },
        config.postTemplate.mappings
      );
      
      const response = await fetch(`${config.buyer.apiUrl}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': config.buyer.authConfig?.token || '',
          'X-Lead-ID': lead.id
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.buyer.postTimeout * 1000)
      });
      
      const responseData = await response.json();
      
      return {
        success: response.ok,
        statusCode: response.status,
        response: responseData
      };
      
    } catch (error) {
      return {
        success: false,
        statusCode: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
```

**4.2 Buyer Webhook Endpoints**
```typescript
// app/api/webhooks/[buyer]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const pingRequestSchema = z.object({
  zipCode: z.string(),
  ownsHome: z.boolean(),
  serviceType: z.string()
});

const postRequestSchema = z.object({
  zipCode: z.string(),
  ownsHome: z.boolean(),
  serviceType: z.string(),
  // Additional fields based on service type
});

export async function POST(
  request: NextRequest,
  { params }: { params: { buyer: string } }
) {
  const buyerName = params.buyer;
  
  try {
    const body = await request.json();
    const endpoint = request.nextUrl.pathname.split('/').pop();
    
    if (endpoint === 'ping') {
      return handlePing(buyerName, body);
    } else if (endpoint === 'leads') {
      return handlePost(buyerName, body);
    }
    
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });
    
  } catch (error) {
    console.error(`Webhook error for ${buyerName}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handlePing(buyerName: string, data: any) {
  // Simulate buyer response logic
  const bidAmount = calculateBid(buyerName, data);
  
  if (bidAmount > 0) {
    return NextResponse.json({
      accepted: true,
      bidAmount,
      message: 'Lead accepted'
    });
  } else {
    return NextResponse.json({
      accepted: false,
      message: 'Lead rejected - outside service area'
    }, { status: 200 });
  }
}

async function handlePost(buyerName: string, data: any) {
  // Simulate successful lead delivery
  return NextResponse.json({
    success: true,
    leadId: crypto.randomUUID(),
    message: 'Lead delivered successfully'
  });
}

function calculateBid(buyerName: string, data: any): number {
  // Simulate dynamic bidding based on buyer and lead data
  const baseBids: Record<string, number> = {
    'modernize': 45,
    'homeadvisor': 35,
    'angi': 30
  };
  
  const base = baseBids[buyerName.toLowerCase()] || 25;
  const variation = Math.random() * 20 - 10; // ±10 variation
  
  return Math.max(0, base + variation);
}
```

#### Deliverables
- ✅ Parallel PING auction system with compliance data
- ✅ Buyer webhook endpoints for testing
- ✅ Configurable compliance inclusion (PING vs POST)
- ✅ Transaction logging with compliance audit trail
- ✅ Error handling and timeout management
- ✅ Bid calculation and winner selection
- ✅ TrustedForm/Jornaya payload integration

---

### 📊 Phase 5: Admin Dashboard & Production (Weeks 9-10)

#### Objectives
- Build comprehensive admin dashboard
- Add monitoring and analytics
- Prepare for production deployment

#### Tasks

**5.1 Admin Dashboard Components**
```typescript
// app/(admin)/admin/dashboard/page.tsx
export default function AdminDashboard() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard title="Total Leads" value="1,234" change="+12%" />
        <MetricCard title="Conversion Rate" value="78%" change="+5%" />
        <MetricCard title="Avg Bid Amount" value="$42.50" change="+8%" />
        <MetricCard title="Active Buyers" value="12" change="0%" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadVolumeChart />
        <TopPerformingBuyers />
      </div>
      
      <RecentLeadsTable />
    </div>
  );
}

// app/(admin)/admin/service-types/page.tsx
export default function ServiceTypesManagement() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Service Types</h1>
        <Button onClick={() => setShowCreateForm(true)}>
          Add Service Type
        </Button>
      </div>
      
      <ServiceTypesTable />
      <CreateServiceTypeModal />
    </div>
  );
}
```

**5.2 Monitoring & Analytics**
```typescript
// lib/analytics/LeadAnalytics.ts
export class LeadAnalytics {
  static async getDashboardMetrics(timeRange: string = '30d') {
    const [totalLeads, conversionRate, avgBid, activeBuyers] = await Promise.all([
      this.getTotalLeads(timeRange),
      this.getConversionRate(timeRange),
      this.getAverageBidAmount(timeRange),
      this.getActiveBuyersCount()
    ]);
    
    return {
      totalLeads,
      conversionRate,
      avgBid,
      activeBuyers
    };
  }
  
  static async getLeadVolumeData(timeRange: string = '30d') {
    const query = `
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM leads
      WHERE created_at >= NOW() - INTERVAL '${timeRange}'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;
    
    return await prisma.$queryRawUnsafe(query);
  }
  
  static async getBuyerPerformance(timeRange: string = '30d') {
    return await prisma.buyer.findMany({
      select: {
        id: true,
        name: true,
        transactions: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - this.parseTimeRange(timeRange))
            }
          },
          select: {
            actionType: true,
            status: true,
            bidAmount: true
          }
        }
      }
    });
  }
}

// lib/monitoring/HealthCheck.ts
export class HealthCheck {
  static async checkSystemHealth() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkExternalAPIs(),
      this.checkQueueHealth()
    ]);
    
    return {
      database: checks[0],
      redis: checks[1],
      externalAPIs: checks[2],
      queueHealth: checks[3],
      overall: checks.every(check => check.status === 'fulfilled')
    };
  }
  
  static async checkDatabase() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', responseTime: Date.now() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}
```

**5.3 Production Deployment Setup**
```dockerfile
# Dockerfile
FROM node:18-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/contractor_platform
      - REDIS_URL=redis://redis:6379
      - RADAR_API_KEY=${RADAR_API_KEY}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: contractor_platform
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  worker:
    build: .
    command: node workers/lead-processor.js
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/contractor_platform
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
  redis_data:
```

#### Deliverables
- ✅ Complete admin dashboard with compliance analytics
- ✅ TrustedForm and Jornaya coverage metrics
- ✅ Lead quality scoring and monitoring
- ✅ Buyer compliance requirement management
- ✅ System health monitoring
- ✅ Production deployment configuration
- ✅ Comprehensive testing suite with compliance tests
- ✅ Documentation and deployment guide

---

## Testing Strategy

### Unit Tests
```typescript
// tests/lib/TemplateEngine.test.ts
describe('TemplateEngine', () => {
  test('should transform basic field mappings', () => {
    const data = { name: 'john', age: 25 };
    const mappings = [
      { sourceField: 'name', targetField: 'fullName', transform: 'uppercase' },
      { sourceField: 'age', targetField: 'userAge', transform: 'number' }
    ];
    
    const result = TemplateEngine.transform(data, mappings);
    
    expect(result).toEqual({
      fullName: 'JOHN',
      userAge: 25
    });
  });
});

// tests/api/leads.test.ts
describe('/api/leads', () => {
  test('should create lead with valid data', async () => {
    const leadData = {
      serviceTypeId: 'uuid-here',
      formData: { numberOfWindows: '4-6' },
      zipCode: '12345',
      ownsHome: true,
      timeframe: 'Immediately'
    };
    
    const response = await POST(new Request('http://localhost/api/leads', {
      method: 'POST',
      body: JSON.stringify(leadData)
    }));
    
    expect(response.status).toBe(200);
  });
});
```

### Integration Tests
```typescript
// tests/integration/auction.test.ts
describe('Auction System Integration', () => {
  test('should run complete auction flow', async () => {
    // Setup test data
    const lead = await createTestLead();
    const buyers = await createTestBuyers();
    
    // Run auction
    const result = await AuctionEngine.runAuction(lead);
    
    // Verify results
    expect(result.winner).toBeDefined();
    expect(result.bids.length).toBeGreaterThan(0);
    
    // Verify database updates
    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead.status).toBe('SOLD');
  });
});
```

## Deployment Checklist

### Pre-Production
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Security audit completed
- [ ] Performance testing completed
- [ ] Database migrations tested
- [ ] Backup strategy implemented
- [ ] Monitoring setup verified

### Production Deployment
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database backups scheduled
- [ ] Redis persistence configured
- [ ] Worker processes monitored
- [ ] Health checks operational
- [ ] Logging aggregation setup

## Success Metrics

### Technical KPIs
- **Form Load Time**: < 2 seconds
- **Lead Processing Time**: < 30 seconds
- **API Response Time**: < 500ms p95
- **System Uptime**: > 99.9%
- **Queue Processing Rate**: > 100 leads/minute

### Business KPIs
- **Lead Conversion Rate**: > 75%
- **Average Bid Amount**: $30-50
- **Buyer Response Rate**: > 90%
- **Form Completion Rate**: > 80%

This development plan provides a structured, modular approach to building the contractor platform with clear deliverables, testing strategies, and success metrics for each phase.