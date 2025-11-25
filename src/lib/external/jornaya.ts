import { JornayaLeadData } from '@/types/api';
import { AppError } from '@/lib/utils';

export class JornayaService {
  private static readonly pixelId = process.env.JORNAYA_PIXEL_ID;
  private static readonly baseUrl = 'https://leadid.jornaya.com';

  static generatePixelScript(): string {
    if (!this.pixelId) {
      throw new AppError('Jornaya pixel ID not configured', 500);
    }

    return `
      <script type="text/javascript">
        (function(l,e,a,d,i,n,g){l[i]=l[i]||function(){(l[i].q=l[i].q||[]).push(arguments)},
        l[i].l=1*new Date();n=e.createElement(a),g=e.getElementsByTagName(a)[0];
        n.async=1;n.src=d;g.parentNode.insertBefore(n,g)})
        (window,document,'script','https://leadid.jornaya.com/js/jlid.js','jornaya');
        
        jornaya('init', '${this.pixelId}');
        jornaya('setPixelId', '${this.pixelId}');
        
        // Store lead ID when generated
        jornaya('onReady', function(leadId) {
          if (leadId) {
            window.jornayaLeadId = leadId;
            // Store in session storage
            sessionStorage.setItem('jornaya_lead_id', leadId);
            // Trigger custom event
            window.dispatchEvent(new CustomEvent('jornayaLeadIdGenerated', { 
              detail: { leadId: leadId }
            }));
          }
        });
      </script>
    `;
  }

  static generateEventScript(): string {
    return `
      <script type="text/javascript">
        // Function to capture Jornaya Lead ID from session storage
        window.getJornayaLeadId = function() {
          return window.jornayaLeadId || sessionStorage.getItem('jornaya_lead_id') || null;
        };
        
        // Function to set lead ID in hidden field
        window.setJornayaLeadIdField = function(fieldName) {
          const leadId = window.getJornayaLeadId();
          const field = document.querySelector('input[name="' + fieldName + '"]');
          if (field && leadId) {
            field.value = leadId;
          }
        };
        
        // Auto-populate on form submission
        document.addEventListener('submit', function(e) {
          const leadIdField = e.target.querySelector('input[name="jornaya_lead_id"]');
          if (leadIdField) {
            const leadId = window.getJornayaLeadId();
            if (leadId) {
              leadIdField.value = leadId;
            }
          }
        });
      </script>
    `;
  }

  static async validateLeadId(leadId: string): Promise<JornayaLeadData | null> {
    try {
      // Jornaya doesn't provide a public API for validation
      // This is a basic format validation
      if (!this.isValidLeadIdFormat(leadId)) {
        return null;
      }

      return {
        leadId,
        pixelFired: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Jornaya Lead ID validation error:', error);
      return null;
    }
  }

  static isValidLeadIdFormat(leadId: string): boolean {
    // Jornaya Lead IDs are typically UUIDs or similar format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const jornayaFormatRegex = /^[A-Za-z0-9_-]{20,}$/; // Alternative format
    
    return uuidRegex.test(leadId) || jornayaFormatRegex.test(leadId);
  }

  static generateHiddenField(leadId?: string): string {
    return `<input type="hidden" name="jornaya_lead_id" value="${leadId || ''}" />`;
  }

  static async captureLeadData(
    leadId: string,
    formData: Record<string, any>,
    metadata: {
      ipAddress?: string;
      userAgent?: string;
      pageUrl?: string;
      referrer?: string;
    } = {}
  ): Promise<JornayaLeadData> {
    return {
      leadId,
      pixelFired: true,
      timestamp: new Date().toISOString(),
      ipAddress: metadata.ipAddress,
      additionalData: {
        userAgent: metadata.userAgent,
        pageUrl: metadata.pageUrl,
        referrer: metadata.referrer,
        formFields: Object.keys(formData).length,
        captureMethod: 'form_submission',
      },
    };
  }

  static generateComplianceReport(leadData: JornayaLeadData) {
    return {
      isCompliant: !!leadData.leadId && leadData.pixelFired,
      leadId: leadData.leadId,
      pixelFired: leadData.pixelFired,
      timestamp: leadData.timestamp,
      ipAddress: leadData.ipAddress,
      complianceScore: this.calculateComplianceScore(leadData),
      additionalData: leadData.additionalData,
    };
  }

  private static calculateComplianceScore(leadData: JornayaLeadData): number {
    let score = 0;
    
    // Base score for having lead ID
    if (leadData.leadId && this.isValidLeadIdFormat(leadData.leadId)) {
      score += 50;
    }
    
    // Pixel fired successfully
    if (leadData.pixelFired) score += 30;
    
    // IP address present
    if (leadData.ipAddress) score += 10;
    
    // Recent timestamp (within last hour)
    if (leadData.timestamp) {
      const leadTime = new Date(leadData.timestamp).getTime();
      const now = Date.now();
      const hourInMs = 60 * 60 * 1000;
      
      if (now - leadTime < hourInMs) {
        score += 10;
      }
    }
    
    return Math.min(score, 100);
  }

  static createLeadIdCookie(leadId: string, domain?: string): void {
    const cookieName = 'jornaya_lead_id';
    const maxAge = 30 * 24 * 60 * 60; // 30 days
    
    let cookieValue = `${cookieName}=${leadId}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
    
    if (domain) {
      cookieValue += `; Domain=${domain}`;
    }
    
    // Set secure flag for HTTPS
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      cookieValue += '; Secure';
    }
    
    document.cookie = cookieValue;
  }

  static getLeadIdFromCookie(): string | null {
    if (typeof document === 'undefined') return null;
    
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'jornaya_lead_id') {
        return value;
      }
    }
    return null;
  }

  static trackFormInteraction(
    leadId: string,
    eventType: 'focus' | 'blur' | 'change' | 'submit',
    fieldName?: string
  ): void {
    if (!this.pixelId || typeof window === 'undefined') return;
    
    try {
      // Custom tracking for form interactions
      if (typeof window.jornaya === 'function') {
        window.jornaya('trackEvent', {
          leadId,
          eventType,
          fieldName,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn('Jornaya tracking error:', error);
    }
  }
}