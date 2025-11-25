# TrustedForm & Jornaya LeadID Integration Guide

## Overview
This document outlines the integration of TrustedForm and Jornaya Universal LeadID tracking for compliance and lead quality verification in the contractor platform.

## TrustedForm Integration

### Purpose
TrustedForm provides legal compliance by capturing a snapshot of the form at submission time, creating an audit trail that proves:
- User consent and form interaction
- Legal disclosures were presented
- Form completion authenticity

### Implementation Steps

#### 1. Database Schema Updates
```sql
-- Add TrustedForm and Jornaya fields to leads table
ALTER TABLE leads ADD COLUMN trusted_form_cert_url VARCHAR(500);
ALTER TABLE leads ADD COLUMN trusted_form_cert_id VARCHAR(100);
ALTER TABLE leads ADD COLUMN jornaya_lead_id VARCHAR(100);
ALTER TABLE leads ADD COLUMN compliance_data JSONB;

-- Add indexes for compliance tracking
CREATE INDEX idx_leads_trusted_form_cert_id ON leads(trusted_form_cert_id);
CREATE INDEX idx_leads_jornaya_lead_id ON leads(jornaya_lead_id);
```

#### 2. TrustedForm Script Integration
```typescript
// components/forms/TrustedFormProvider.tsx
'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

interface TrustedFormContextType {
  certUrl: string | null;
  certId: string | null;
  isReady: boolean;
}

const TrustedFormContext = createContext<TrustedFormContextType>({
  certUrl: null,
  certId: null,
  isReady: false
});

export function TrustedFormProvider({ children }: { children: React.ReactNode }) {
  const [certUrl, setCertUrl] = useState<string | null>(null);
  const [certId, setCertId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const handleTrustedFormReady = () => {
    if (window.TrustedForm) {
      const url = window.TrustedForm.createCertificateUrl();
      const id = window.TrustedForm.getCertificateId();
      
      setCertUrl(url);
      setCertId(id);
      setIsReady(true);
      
      console.log('TrustedForm Ready:', { url, id });
    }
  };

  return (
    <>
      <Script
        id="trustedform-script"
        src="//secure.trustedform.com/trustedform.js"
        strategy="afterInteractive"
        onLoad={handleTrustedFormReady}
      />
      <TrustedFormContext.Provider value={{ certUrl, certId, isReady }}>
        {children}
      </TrustedFormContext.Provider>
    </>
  );
}

export const useTrustedForm = () => useContext(TrustedFormContext);
```

#### 3. Form Component with TrustedForm
```typescript
// components/forms/ServiceForm.tsx
'use client';

import { useTrustedForm } from './TrustedFormProvider';
import { useJornayaLeadID } from './JornayaProvider';

export function ServiceForm({ serviceType }: { serviceType: ServiceType }) {
  const { certUrl, certId, isReady: tfReady } = useTrustedForm();
  const { leadId: jornayaLeadId, isReady: jornayaReady } = useJornayaLeadID();
  const [formData, setFormData] = useState({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!tfReady || !jornayaReady) {
      toast.error('Compliance tracking not ready. Please wait and try again.');
      return;
    }

    const submissionData = {
      serviceTypeId: serviceType.id,
      formData,
      zipCode: formData.zipCode,
      ownsHome: formData.ownsHome,
      timeframe: formData.timeframe,
      // Compliance data
      trustedFormCertUrl: certUrl,
      trustedFormCertId: certId,
      jornayaLeadId: jornayaLeadId,
      complianceData: {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        ipAddress: await getUserIP(), // Capture from client
        tcpaConsent: formData.tcpaConsent,
        privacyPolicyAccepted: formData.privacyPolicyAccepted
      }
    };

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData)
      });

      if (response.ok) {
        router.push('/thank-you');
      } else {
        throw new Error('Submission failed');
      }
    } catch (error) {
      toast.error('Failed to submit form. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form fields */}
      
      {/* TCPA Compliance Checkbox */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            required
            checked={formData.tcpaConsent || false}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              tcpaConsent: e.target.checked 
            }))}
            className="mt-1"
          />
          <div className="text-sm text-gray-700">
            <p>
              By clicking "Get My Quote", I agree to receive marketing phone calls and text messages 
              from contractors and this website at the number provided, including calls made using an 
              automatic telephone dialing system. I understand that consent is not a condition of purchase.
            </p>
            <p className="mt-2">
              Message and data rates may apply. Reply STOP to opt out.
            </p>
          </div>
        </label>
      </div>

      {/* Privacy Policy */}
      <div className="space-y-2">
        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            required
            checked={formData.privacyPolicyAccepted || false}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              privacyPolicyAccepted: e.target.checked 
            }))}
            className="mt-1"
          />
          <div className="text-sm text-gray-700">
            I have read and agree to the{' '}
            <a href="/privacy-policy" target="_blank" className="text-blue-600 underline">
              Privacy Policy
            </a>
            {' '}and{' '}
            <a href="/terms-of-service" target="_blank" className="text-blue-600 underline">
              Terms of Service
            </a>
          </div>
        </label>
      </div>

      <button
        type="submit"
        disabled={!tfReady || !jornayaReady}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {!tfReady || !jornayaReady ? 'Loading...' : 'Get My Quote'}
      </button>

      {/* Hidden fields for compliance */}
      <input type="hidden" name="xxTrustedFormCertUrl" value={certUrl || ''} />
      <input type="hidden" name="xxTrustedFormToken" value={certId || ''} />
      <input type="hidden" name="universal_leadid" value={jornayaLeadId || ''} />
    </form>
  );
}
```

## Jornaya Universal LeadID Integration

### Purpose
Jornaya LeadID provides lead tracking and verification across the entire lead lifecycle, enabling:
- Lead quality scoring
- Fraud detection
- Lead source attribution
- Compliance verification

### Implementation Steps

#### 1. Jornaya Script Integration
```typescript
// components/forms/JornayaProvider.tsx
'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import Script from 'next/script';

interface JornayaContextType {
  leadId: string | null;
  isReady: boolean;
}

const JornayaContext = createContext<JornayaContextType>({
  leadId: null,
  isReady: false
});

export function JornayaProvider({ children }: { children: React.ReactNode }) {
  const [leadId, setLeadId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Jornaya Universal LeadID script will set this globally
    const checkJornayaReady = () => {
      if (window.jornaya_universal_leadid) {
        setLeadId(window.jornaya_universal_leadid);
        setIsReady(true);
        console.log('Jornaya LeadID Ready:', window.jornaya_universal_leadid);
      } else {
        setTimeout(checkJornayaReady, 100);
      }
    };

    checkJornayaReady();
  }, []);

  return (
    <>
      {/* Jornaya Universal LeadID Script */}
      <Script
        id="jornaya-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(){
              var script = document.createElement('script');
              script.id = 'LeadidScript';
              script.type = 'text/javascript';
              script.async = true;
              script.src = '//static.leadid.com/js/leadid.js';
              var firstScript = document.getElementsByTagName('script')[0];
              firstScript.parentNode.insertBefore(script, firstScript);
            })();
          `
        }}
      />
      <JornayaContext.Provider value={{ leadId, isReady }}>
        {children}
      </JornayaContext.Provider>
    </>
  );
}

export const useJornayaLeadID = () => useContext(JornayaContext);
```

#### 2. Lead API Updates
```typescript
// app/api/leads/route.ts (Updated)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const leadSubmissionSchema = z.object({
  serviceTypeId: z.string().uuid(),
  formData: z.record(z.any()),
  zipCode: z.string().regex(/^\d{5}$/),
  ownsHome: z.boolean(),
  timeframe: z.string(),
  // Compliance fields
  trustedFormCertUrl: z.string().optional(),
  trustedFormCertId: z.string().optional(),
  jornayaLeadId: z.string().optional(),
  complianceData: z.object({
    userAgent: z.string(),
    timestamp: z.string(),
    ipAddress: z.string().optional(),
    tcpaConsent: z.boolean(),
    privacyPolicyAccepted: z.boolean()
  }).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = leadSubmissionSchema.parse(body);
    
    // Get client IP
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Save lead with compliance data
    const lead = await prisma.lead.create({
      data: {
        serviceTypeId: validatedData.serviceTypeId,
        formData: validatedData.formData,
        zipCode: validatedData.zipCode,
        ownsHome: validatedData.ownsHome,
        timeframe: validatedData.timeframe,
        status: 'PENDING',
        // Compliance fields
        trustedFormCertUrl: validatedData.trustedFormCertUrl,
        trustedFormCertId: validatedData.trustedFormCertId,
        jornayaLeadId: validatedData.jornayaLeadId,
        complianceData: {
          ...validatedData.complianceData,
          ipAddress: clientIP,
          submissionSource: 'web_form'
        }
      }
    });

    // Add to processing queue with compliance data
    await addToQueue('lead-processing', {
      leadId: lead.id,
      priority: 'normal',
      hasCompliance: !!(validatedData.trustedFormCertUrl && validatedData.jornayaLeadId)
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

## Buyer Payload Integration

### Template Engine Updates
```typescript
// lib/templates/TemplateEngine.ts (Enhanced)
export class TemplateEngine {
  static transform(data: any, mappings: TemplateMapping[], includeCompliance = false): any {
    const result = this.transformBasicFields(data, mappings);
    
    if (includeCompliance) {
      // Add compliance fields if buyer requires them
      this.addComplianceFields(result, data);
    }
    
    return result;
  }

  private static addComplianceFields(result: any, data: any): void {
    // TrustedForm fields
    if (data.trustedFormCertUrl) {
      result.xxTrustedFormCertUrl = data.trustedFormCertUrl;
    }
    if (data.trustedFormCertId) {
      result.xxTrustedFormToken = data.trustedFormCertId;
    }
    
    // Jornaya LeadID
    if (data.jornayaLeadId) {
      result.universal_leadid = data.jornayaLeadId;
      result.jornaya_leadid = data.jornayaLeadId; // Some buyers expect this format
    }
    
    // TCPA compliance
    if (data.complianceData?.tcpaConsent) {
      result.tcpa_consent = data.complianceData.tcpaConsent;
      result.opt_in_consent = data.complianceData.tcpaConsent;
    }
    
    // Additional compliance fields
    if (data.complianceData?.ipAddress) {
      result.ip_address = data.complianceData.ipAddress;
    }
    
    if (data.complianceData?.timestamp) {
      result.submission_timestamp = data.complianceData.timestamp;
    }
  }
}
```

### Buyer Configuration Examples
```typescript
// Example buyer configurations with compliance requirements

const MODERNIZE_WINDOWS_CONFIG = {
  pingTemplate: {
    mappings: [
      { sourceField: 'zipCode', targetField: 'zip_code' },
      { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean' }
    ],
    includeCompliance: false // Only basic data for PING
  },
  postTemplate: {
    mappings: [
      { sourceField: 'zipCode', targetField: 'zip_code' },
      { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean' },
      { sourceField: 'numberOfWindows', targetField: 'window_count', transform: 'windowsCount' },
      { sourceField: 'windowsProjectScope', targetField: 'project_scope' }
    ],
    includeCompliance: true // Full compliance data for POST
  }
};

const HOMEADVISOR_BATHROOM_CONFIG = {
  pingTemplate: {
    mappings: [
      { sourceField: 'zipCode', targetField: 'postal_code' },
      { sourceField: 'ownsHome', targetField: 'owns_property', transform: 'boolean' }
    ],
    includeCompliance: true // HomeAdvisor wants compliance data in PING
  },
  postTemplate: {
    mappings: [
      { sourceField: 'zipCode', targetField: 'postal_code' },
      { sourceField: 'ownsHome', targetField: 'owns_property', transform: 'boolean' },
      { sourceField: 'numberOfBathrooms', targetField: 'bathroom_count', transform: 'bathroomCount' },
      { sourceField: 'bathroomType', targetField: 'bathroom_type' }
    ],
    includeCompliance: true
  }
};
```

### Auction Engine Updates
```typescript
// lib/auction/AuctionEngine.ts (Enhanced)
export class AuctionEngine {
  private static async sendPing(lead: any, config: any): Promise<BidResponse> {
    const startTime = Date.now();
    
    try {
      // Transform data with compliance inclusion based on buyer config
      const payload = TemplateEngine.transform(
        {
          ...lead.formData,
          zipCode: lead.zipCode,
          ownsHome: lead.ownsHome,
          trustedFormCertUrl: lead.trustedFormCertUrl,
          trustedFormCertId: lead.trustedFormCertId,
          jornayaLeadId: lead.jornayaLeadId,
          complianceData: lead.complianceData
        },
        config.pingTemplate.mappings,
        config.pingTemplate.includeCompliance
      );

      const response = await fetch(`${config.buyer.apiUrl}/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': config.buyer.authConfig?.token || '',
          'X-Service-Type': lead.serviceType.name,
          'X-Lead-Source': 'contractor-platform'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.buyer.pingTimeout * 1000)
      });

      const responseTime = Date.now() - startTime;
      const data = await response.json();

      // Log compliance data inclusion
      await this.logTransaction(lead.id, config.buyerId, 'PING', {
        status: 'fulfilled',
        value: {
          success: response.ok,
          bidAmount: data.bidAmount || 0,
          responseTime,
          complianceIncluded: config.pingTemplate.includeCompliance,
          trustedFormPresent: !!lead.trustedFormCertId,
          jornayaPresent: !!lead.jornayaLeadId
        }
      });

      return {
        buyerId: config.buyerId,
        bidAmount: data.bidAmount || 0,
        success: response.ok,
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
      // Always include compliance data in POST requests
      const payload = TemplateEngine.transform(
        {
          ...lead.formData,
          zipCode: lead.zipCode,
          ownsHome: lead.ownsHome,
          trustedFormCertUrl: lead.trustedFormCertUrl,
          trustedFormCertId: lead.trustedFormCertId,
          jornayaLeadId: lead.jornayaLeadId,
          complianceData: lead.complianceData
        },
        config.postTemplate.mappings,
        true // Always include compliance for POST
      );

      const response = await fetch(`${config.buyer.apiUrl}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': config.buyer.authConfig?.token || '',
          'X-Lead-ID': lead.id,
          'X-Service-Type': lead.serviceType.name
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

## Admin Dashboard Compliance Monitoring

### Compliance Metrics Component
```typescript
// components/admin/ComplianceMetrics.tsx
export function ComplianceMetrics() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetch('/api/admin/compliance-metrics')
      .then(res => res.json())
      .then(setMetrics);
  }, []);

  if (!metrics) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <MetricCard
        title="TrustedForm Coverage"
        value={`${metrics.trustedFormCoverage}%`}
        description="Leads with TrustedForm certificates"
        trend={metrics.trustedFormTrend}
      />
      <MetricCard
        title="Jornaya LeadID Coverage"
        value={`${metrics.jornayaCoverage}%`}
        description="Leads with Jornaya tracking"
        trend={metrics.jornayaTrend}
      />
      <MetricCard
        title="Full Compliance Rate"
        value={`${metrics.fullComplianceRate}%`}
        description="Leads with both TrustedForm and LeadID"
        trend={metrics.complianceTrend}
      />
    </div>
  );
}
```

### Compliance API Endpoint
```typescript
// app/api/admin/compliance-metrics/route.ts
export async function GET() {
  const [total, withTrustedForm, withJornaya, withBoth] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { trustedFormCertId: { not: null } } }),
    prisma.lead.count({ where: { jornayaLeadId: { not: null } } }),
    prisma.lead.count({
      where: {
        AND: [
          { trustedFormCertId: { not: null } },
          { jornayaLeadId: { not: null } }
        ]
      }
    })
  ]);

  return NextResponse.json({
    trustedFormCoverage: Math.round((withTrustedForm / total) * 100),
    jornayaCoverage: Math.round((withJornaya / total) * 100),
    fullComplianceRate: Math.round((withBoth / total) * 100),
    totalLeads: total
  });
}
```

## Testing Compliance Integration

### Test TrustedForm Certificate Generation
```typescript
// tests/integration/trustedform.test.ts
describe('TrustedForm Integration', () => {
  test('should generate certificate on form submission', async () => {
    // Mock TrustedForm global
    global.TrustedForm = {
      createCertificateUrl: () => 'https://cert.trustedform.com/cert123',
      getCertificateId: () => 'cert123'
    };

    render(<ServiceForm serviceType={mockServiceType} />);
    
    // Fill form and submit
    fireEvent.change(screen.getByLabelText('ZIP Code'), { target: { value: '12345' } });
    fireEvent.click(screen.getByText('Get My Quote'));

    // Verify API call includes TrustedForm data
    expect(mockFetch).toHaveBeenCalledWith('/api/leads', expect.objectContaining({
      body: expect.stringContaining('trustedFormCertUrl')
    }));
  });
});
```

### Test Jornaya LeadID Capture
```typescript
// tests/integration/jornaya.test.ts
describe('Jornaya Integration', () => {
  test('should capture LeadID from global variable', async () => {
    // Mock Jornaya global
    global.jornaya_universal_leadid = 'jornaya123';

    render(<ServiceForm serviceType={mockServiceType} />);
    
    // Wait for Jornaya to be ready
    await waitFor(() => {
      expect(screen.getByDisplayValue('jornaya123')).toBeInTheDocument();
    });
  });
});
```

## Deployment Considerations

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_TRUSTEDFORM_ENABLED=true
NEXT_PUBLIC_JORNAYA_ENABLED=true
TRUSTEDFORM_API_KEY=your_trustedform_key
JORNAYA_API_KEY=your_jornaya_key
```

### CSP Headers for Compliance Scripts
```typescript
// next.config.js
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              script-src 'self' 'unsafe-inline' 'unsafe-eval' 
              https://secure.trustedform.com 
              https://static.leadid.com 
              https://api.radar.io;
            `.replace(/\s+/g, ' ').trim()
          }
        ]
      }
    ];
  }
};
```

This integration ensures full compliance tracking and provides buyers with the TrustedForm certificates and Jornaya LeadIDs they require for legal and quality verification purposes.