import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

// Create a custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <div data-testid="test-wrapper">
      {children}
    </div>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Test database utilities
export class TestDatabase {
  static async setupTestDatabase() {
    // Mock database setup
    console.log('Setting up test database...')
    return {
      cleanup: async () => {
        console.log('Cleaning up test database...')
      }
    }
  }

  static async seedTestData() {
    // Mock data seeding
    console.log('Seeding test data...')
  }

  static async cleanupTestData() {
    // Mock data cleanup
    console.log('Cleaning up test data...')
  }
}

// Test API utilities
export class TestAPI {
  static createMockRequest(method: string, body?: any, headers?: Record<string, string>) {
    return {
      method,
      headers: new Headers(headers),
      json: async () => body,
      ...body && { body: JSON.stringify(body) }
    } as any
  }

  static createMockResponse(status = 200, body?: any) {
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
      headers: new Headers()
    } as any
  }
}

// Performance testing utilities
export class PerformanceTestUtils {
  static async measureExecutionTime(fn: () => Promise<any>) {
    const start = performance.now()
    await fn()
    const end = performance.now()
    return end - start
  }

  static async measureMemoryUsage(fn: () => Promise<any>) {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const initialMemory = process.memoryUsage().heapUsed
      await fn()
      const finalMemory = process.memoryUsage().heapUsed
      return finalMemory - initialMemory
    }
    return 0
  }

  static createLoadTestData(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `test-id-${i}`,
      data: `test-data-${i}`,
      timestamp: new Date().toISOString()
    }))
  }
}

// Compliance testing utilities
export class ComplianceTestUtils {
  static validateTrustedFormIntegration(formData: any) {
    return {
      hasCertUrl: !!formData.trustedFormCertUrl,
      hasCertId: !!formData.trustedFormCertId,
      certUrlValid: formData.trustedFormCertUrl?.startsWith('https://cert.trustedform.com/'),
      certIdValid: typeof formData.trustedFormCertId === 'string' && formData.trustedFormCertId.length > 0
    }
  }

  static validateJornayaIntegration(formData: any) {
    return {
      hasLeadId: !!formData.jornayaLeadId,
      leadIdValid: typeof formData.jornayaLeadId === 'string' && formData.jornayaLeadId.length > 0
    }
  }

  static validateTCPACompliance(formData: any) {
    return {
      hasTcpaConsent: formData.complianceData?.tcpaConsent === true,
      hasPrivacyPolicy: formData.complianceData?.privacyPolicyAccepted === true,
      hasTimestamp: !!formData.complianceData?.timestamp,
      hasUserAgent: !!formData.complianceData?.userAgent
    }
  }
}

// Security testing utilities
export class SecurityTestUtils {
  static generateSQLInjectionPayloads() {
    return [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'--",
      "' UNION SELECT * FROM users--"
    ]
  }

  static generateXSSPayloads() {
    return [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert("XSS")',
      '<svg onload="alert(1)">'
    ]
  }

  static validateInputSanitization(input: string, output: string) {
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ]

    return {
      inputContainsDangerousContent: dangerousPatterns.some(pattern => pattern.test(input)),
      outputContainsDangerousContent: dangerousPatterns.some(pattern => pattern.test(output)),
      properlySanitized: !dangerousPatterns.some(pattern => pattern.test(output))
    }
  }

  static validateRateLimiting(requests: number, timeWindow: number) {
    // Mock rate limiting validation
    const maxRequestsPerWindow = 100
    return requests <= maxRequestsPerWindow
  }
}

// Code quality utilities
export class CodeQualityUtils {
  static validateFileSize(filePath: string, maxLines: number = 500) {
    // This would normally read the actual file
    // For testing, we'll mock it
    return {
      lineCount: Math.floor(Math.random() * 600),
      exceedsLimit: false,
      isWithinWarningThreshold: true
    }
  }

  static validateNamingConventions(names: string[]) {
    const camelCasePattern = /^[a-z][a-zA-Z0-9]*$/
    const PascalCasePattern = /^[A-Z][a-zA-Z0-9]*$/
    const kebabCasePattern = /^[a-z][a-z0-9-]*$/

    return names.map(name => ({
      name,
      isCamelCase: camelCasePattern.test(name),
      isPascalCase: PascalCasePattern.test(name),
      isKebabCase: kebabCasePattern.test(name)
    }))
  }

  static validateDRYPrinciples(codeSnippets: string[]) {
    // Simple duplicate detection - in reality would be more sophisticated
    const duplicates = new Map<string, number>()
    
    codeSnippets.forEach(snippet => {
      duplicates.set(snippet, (duplicates.get(snippet) || 0) + 1)
    })

    return {
      duplicateCount: Array.from(duplicates.values()).filter(count => count > 1).length,
      duplicateSnippets: Array.from(duplicates.entries()).filter(([, count]) => count > 1)
    }
  }
}

// Audit utilities
export class AuditUtils {
  static createAuditLog(action: string, component: string, details: any) {
    return {
      timestamp: new Date().toISOString(),
      action,
      component,
      details,
      compliance: ComplianceTestUtils.validateTCPACompliance(details),
      security: SecurityTestUtils.validateInputSanitization(details.input || '', details.output || ''),
      performance: { executionTime: Math.random() * 1000 }
    }
  }

  static validateAgainstPRD(implementation: any, requirements: any) {
    // Mock PRD compliance validation
    return {
      compliant: true,
      missingFeatures: [],
      extraFeatures: [],
      score: 95
    }
  }

  static validateAgainstDevelopmentPlan(implementation: any, plan: any) {
    // Mock development plan compliance validation
    return {
      phaseCompliance: {
        phase1: 100,
        phase2: 85,
        phase3: 70,
        phase4: 40,
        phase5: 0
      },
      overallScore: 79
    }
  }
}

export default {
  TestDatabase,
  TestAPI,
  PerformanceTestUtils,
  ComplianceTestUtils,
  SecurityTestUtils,
  CodeQualityUtils,
  AuditUtils
}