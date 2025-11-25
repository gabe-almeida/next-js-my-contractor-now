import { TrustedFormCertificate } from '@/types/api';
import { AppError } from '@/lib/utils';

export class TrustedFormService {
  private static readonly apiKey = process.env.TRUSTEDFORM_API_KEY;
  private static readonly domain = process.env.TRUSTEDFORM_DOMAIN;
  private static readonly baseUrl = 'https://cert.trustedform.com';

  static generateScript(): string {
    if (!this.domain) {
      throw new AppError('TrustedForm domain not configured', 500);
    }

    return `
      <script type="text/javascript">
        (function() {
          var tf = document.createElement('script');
          tf.type = 'text/javascript'; 
          tf.async = true;
          tf.src = ('https:' == document.location.protocol ? 'https' : 'http') + 
            '://api.trustedform.com/trustedform.js?field=xxTrustedFormCertUrl&ping_field=xxTrustedFormPingUrl&l='+
            new Date().getTime()+Math.random();
          var s = document.getElementsByTagName('script')[0]; 
          s.parentNode.insertBefore(tf, s);
        })();
      </script>
    `;
  }

  static async validateCertificate(certUrl: string): Promise<TrustedFormCertificate | null> {
    if (!this.apiKey) {
      throw new AppError('TrustedForm API key not configured', 500);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/certificate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cert_url: certUrl,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Certificate not found
        }
        throw new AppError(
          `TrustedForm API error: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      return {
        certUrl: data.cert_url,
        certId: data.cert_id,
        formUrl: data.form_url,
        timestamp: data.created_at,
        ipAddress: data.ip,
        userAgent: data.user_agent,
        pageTitle: data.page_title,
        referrer: data.referrer,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      console.error('TrustedForm validation error:', error);
      throw new AppError('Failed to validate TrustedForm certificate', 500);
    }
  }

  static async getCertificateDetails(certId: string) {
    if (!this.apiKey) {
      throw new AppError('TrustedForm API key not configured', 500);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/certificate/${certId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new AppError(
          `TrustedForm API error: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      return {
        certId: data.cert_id,
        certUrl: data.cert_url,
        formUrl: data.form_url,
        timestamp: data.created_at,
        ipAddress: data.ip,
        userAgent: data.user_agent,
        pageTitle: data.page_title,
        referrer: data.referrer,
        formData: data.form_data,
        vendor: data.vendor,
        maskedCert: data.masked_cert,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      console.error('TrustedForm certificate details error:', error);
      throw new AppError('Failed to get certificate details', 500);
    }
  }

  static generateHiddenFields(certUrl?: string, pingUrl?: string): string {
    return `
      <input type="hidden" name="xxTrustedFormCertUrl" value="${certUrl || ''}" />
      <input type="hidden" name="xxTrustedFormPingUrl" value="${pingUrl || ''}" />
      <input type="hidden" name="xxTrustedFormToken" value="${Date.now()}" />
    `;
  }

  static extractCertificateFromUrl(url: string): string | null {
    const match = url.match(/https:\/\/cert\.trustedform\.com\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  static isValidCertificateUrl(url: string): boolean {
    return /^https:\/\/cert\.trustedform\.com\/[a-f0-9-]+$/.test(url);
  }

  static async downloadCertificate(certUrl: string): Promise<Buffer | null> {
    try {
      const response = await fetch(certUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        console.error(`Failed to download certificate: ${response.status}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Certificate download error:', error);
      return null;
    }
  }

  static generateComplianceReport(certificate: TrustedFormCertificate) {
    return {
      isCompliant: !!certificate.certUrl,
      certId: certificate.certId,
      timestamp: certificate.timestamp,
      ipAddress: certificate.ipAddress,
      userAgent: certificate.userAgent,
      formUrl: certificate.formUrl,
      pageTitle: certificate.pageTitle,
      referrer: certificate.referrer,
      complianceScore: this.calculateComplianceScore(certificate),
    };
  }

  private static calculateComplianceScore(certificate: TrustedFormCertificate): number {
    let score = 0;
    
    // Base score for having certificate
    if (certificate.certUrl) score += 40;
    
    // IP address present
    if (certificate.ipAddress) score += 15;
    
    // User agent present
    if (certificate.userAgent) score += 15;
    
    // Form URL matches expected domain
    if (certificate.formUrl && this.domain && certificate.formUrl.includes(this.domain)) {
      score += 20;
    }
    
    // Recent timestamp (within last hour)
    if (certificate.timestamp) {
      const certTime = new Date(certificate.timestamp).getTime();
      const now = Date.now();
      const hourInMs = 60 * 60 * 1000;
      
      if (now - certTime < hourInMs) {
        score += 10;
      }
    }
    
    return Math.min(score, 100);
  }
}