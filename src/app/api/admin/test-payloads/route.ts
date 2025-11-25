import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { TemplateEngine } from '@/lib/templates/TemplateEngine';

/**
 * Test endpoint to preview payload transformations for each buyer
 * WITHOUT actually sending PING/POST requests
 */
export async function POST(request: NextRequest) {
  try {
    const { leadData, serviceTypeId } = await request.json();

    // Get service type with active buyers and their configurations
    const serviceType = await prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
      include: {
        buyerServiceConfigs: {
          where: { active: true },
          include: { 
            buyer: true
          },
        },
      },
    });

    if (!serviceType) {
      return NextResponse.json({ error: 'Service type not found' }, { status: 404 });
    }

    const results: any[] = [];

    // Process each buyer configuration
    for (const config of serviceType.buyerServiceConfigs) {
      try {
        // Prepare complete lead data (same as in AuctionEngine)
        const completeLeadData = {
          ...leadData,
          zipCode: leadData.address || '00000',
          ownsHome: leadData.isHomeowner === 'yes',
          timeframe: leadData.timeline,
        };

        // Add mock compliance data for testing
        const complianceData = {
          trustedFormCert: config.requiresTrustedForm ? 'mock-tf-cert-url' : undefined,
          trustedFormCertId: config.requiresTrustedForm ? 'mock-tf-cert-id' : undefined,
          jornayaLeadId: config.requiresJornaya ? 'mock-jornaya-lead-id' : undefined,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          tcpaConsent: true,
          tcpaTimestamp: new Date().toISOString(),
        };

        const fullData = { ...completeLeadData, ...complianceData };

        // Test PING transformation
        let pingResult = null;
        let pingErrors: string[] = [];
        let pingWarnings: string[] = [];
        let pingTemplate = null;

        try {
          pingTemplate = config.pingTemplate ? JSON.parse(config.pingTemplate) : null;
          if (pingTemplate && pingTemplate.mappings) {
            const pingPreview = TemplateEngine.preview(fullData, pingTemplate.mappings);
            pingResult = pingPreview.result;
            pingErrors = pingPreview.errors;
            pingWarnings = pingPreview.warnings;
          }
        } catch (error) {
          pingErrors.push('Invalid ping template JSON: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }

        // Test POST transformation
        let postResult = null;
        let postErrors: string[] = [];
        let postWarnings: string[] = [];
        let postTemplate = null;

        try {
          postTemplate = config.postTemplate ? JSON.parse(config.postTemplate) : null;
          if (postTemplate && postTemplate.mappings) {
            const postPreview = TemplateEngine.preview(fullData, postTemplate.mappings);
            postResult = postPreview.result;
            postErrors = postPreview.errors;
            postWarnings = postPreview.warnings;
          }
        } catch (error) {
          postErrors.push('Invalid post template JSON: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }

        results.push({
          buyerId: config.buyerId,
          buyerName: config.buyer.name,
          buyerApiUrl: config.buyer.apiUrl,
          active: config.active,
          requiresTrustedForm: config.requiresTrustedForm,
          requiresJornaya: config.requiresJornaya,
          ping: {
            templateId: pingTemplate?.id || null,
            hasTemplate: !!pingTemplate,
            payload: pingResult,
            errors: pingErrors,
            warnings: pingWarnings,
            mappingCount: pingTemplate?.mappings?.length || 0,
          },
          post: {
            templateId: postTemplate?.id || null,
            hasTemplate: !!postTemplate,
            payload: postResult,
            errors: postErrors,
            warnings: postWarnings,
            mappingCount: postTemplate?.mappings?.length || 0,
          },
          sourceData: {
            original: leadData,
            enriched: completeLeadData,
            withCompliance: fullData,
          }
        });

      } catch (error) {
        results.push({
          buyerId: config.buyerId,
          buyerName: config.buyer.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          ping: { error: 'Failed to process' },
          post: { error: 'Failed to process' },
        });
      }
    }

    return NextResponse.json({
      success: true,
      serviceType: serviceType.name,
      totalBuyers: serviceType.buyerServiceConfigs.length,
      results,
      testData: {
        leadData,
        serviceTypeId,
      }
    });

  } catch (error) {
    console.error('Payload test error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Get available service types for testing
 */
export async function GET() {
  try {
    const serviceTypes = await prisma.serviceType.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            buyerServiceConfigs: {
              where: { active: true }
            }
          }
        }
      }
    });

    // Sample lead data for each service type
    const sampleData = {
      windows: {
        projectScope: 'install',
        numberOfWindows: '4-6',
        address: '12345',
        timeline: 'within_3_months',
        isHomeowner: 'yes',
        nameInfo: { firstName: 'John', lastName: 'Doe' },
        contactInfo: { email: 'john.doe@example.com', phone: '555-123-4567' }
      },
      roofing: {
        projectScope: 'full_replacement',
        roofType: 'asphalt_shingles',
        roofSize: 'medium',
        address: '12345',
        timeline: 'within_3_months',
        isHomeowner: 'yes',
        nameInfo: { firstName: 'Jane', lastName: 'Smith' },
        contactInfo: { email: 'jane.smith@example.com', phone: '555-987-6543' }
      },
      bathrooms: {
        projectScope: 'full_renovation',
        bathroomType: 'master_bath',
        projectSize: 'medium',
        address: '12345',
        timeline: 'within_3_months',
        isHomeowner: 'yes',
        nameInfo: { firstName: 'Bob', lastName: 'Johnson' },
        contactInfo: { email: 'bob.johnson@example.com', phone: '555-456-7890' }
      }
    };

    return NextResponse.json({
      success: true,
      serviceTypes: serviceTypes.map(st => ({
        ...st,
        activeBuyers: st._count.buyerServiceConfigs,
        sampleData: sampleData[st.name.toLowerCase() as keyof typeof sampleData] || {}
      }))
    });

  } catch (error) {
    console.error('Service types fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}