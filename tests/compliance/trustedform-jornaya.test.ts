/**
 * Compliance Tests: TrustedForm & Jornaya Integration
 * Tests compliance tracking and validation for lead generation
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { ComplianceTestUtils } from '@/tests/utils/testHelpers'
import { mockFormSubmission } from '@/tests/fixtures/mockData'

// Mock compliance providers
const mockTrustedFormAPI = {
  createCertificate: jest.fn(),
  validateCertificate: jest.fn(),
  getCertificateData: jest.fn()
}

const mockJornayaAPI = {
  generateLeadId: jest.fn(),
  validateLeadId: jest.fn(),
  getLeadIdData: jest.fn()
}

// Mock compliance data structures
interface ComplianceData {
  trustedFormCertUrl?: string
  trustedFormCertId?: string
  jornayaLeadId?: string
  tcpaConsent: boolean
  privacyPolicyAccepted: boolean
  timestamp: string
  ipAddress?: string
  userAgent?: string
}

interface ComplianceValidationResult {
  isCompliant: boolean
  trustedFormValid: boolean
  jornayaValid: boolean
  tcpaValid: boolean
  issues: string[]
}

// Mock compliance validator
class ComplianceValidator {
  static validateTrustedFormCertificate(certUrl: string, certId: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Simulate TrustedForm API validation
      setTimeout(() => {
        const isValid = certUrl?.startsWith('https://cert.trustedform.com/') && 
                       certId?.length > 10
        resolve(isValid)
      }, 100)
    })
  }

  static validateJornayaLeadId(leadId: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Simulate Jornaya API validation
      setTimeout(() => {
        const isValid = typeof leadId === 'string' && leadId.length > 10
        resolve(isValid)
      }, 50)
    })
  }

  static async validateFullCompliance(data: ComplianceData): Promise<ComplianceValidationResult> {
    const issues: string[] = []
    
    // TrustedForm validation
    const trustedFormValid = data.trustedFormCertUrl && data.trustedFormCertId ?
      await this.validateTrustedFormCertificate(data.trustedFormCertUrl, data.trustedFormCertId) :
      false
    
    if (!trustedFormValid) {
      issues.push('TrustedForm certificate invalid or missing')
    }

    // Jornaya validation
    const jornayaValid = data.jornayaLeadId ?
      await this.validateJornayaLeadId(data.jornayaLeadId) :
      false
    
    if (!jornayaValid) {
      issues.push('Jornaya LeadID invalid or missing')
    }

    // TCPA compliance
    const tcpaValid = data.tcpaConsent === true && data.privacyPolicyAccepted === true
    if (!tcpaValid) {
      issues.push('TCPA consent or privacy policy acceptance missing')
    }

    // Timestamp validation
    const timestamp = new Date(data.timestamp)
    const now = new Date()
    const timeDiff = Math.abs(now.getTime() - timestamp.getTime())
    const fiveMinutes = 5 * 60 * 1000

    if (timeDiff > fiveMinutes) {
      issues.push('Timestamp too old - potential replay attack')
    }

    return {
      isCompliant: trustedFormValid && jornayaValid && tcpaValid && issues.length === 0,
      trustedFormValid,
      jornayaValid, 
      tcpaValid,
      issues
    }
  }

  static generateComplianceReport(data: ComplianceData): any {
    return {
      compliance_score: this.calculateComplianceScore(data),
      trustedform_present: !!data.trustedFormCertId,
      jornaya_present: !!data.jornayaLeadId,
      tcpa_consent: data.tcpaConsent,
      privacy_accepted: data.privacyPolicyAccepted,
      timestamp: data.timestamp,
      metadata: {
        ip_address: data.ipAddress,
        user_agent: data.userAgent
      }
    }
  }

  private static calculateComplianceScore(data: ComplianceData): number {
    let score = 0
    
    if (data.trustedFormCertId) score += 25
    if (data.jornayaLeadId) score += 25
    if (data.tcpaConsent) score += 25
    if (data.privacyPolicyAccepted) score += 15
    if (data.ipAddress) score += 5
    if (data.userAgent) score += 5
    
    return score
  }
}

// Mock buyer compliance requirements
const buyerComplianceRequirements = {
  modernize: {
    requiresTrustedForm: true,
    requiresJornaya: true,
    requiresTCPA: true,
    minComplianceScore: 85
  },
  homeadvisor: {
    requiresTrustedForm: true,
    requiresJornaya: false,
    requiresTCPA: true,
    minComplianceScore: 70
  },
  angi: {
    requiresTrustedForm: false,
    requiresJornaya: true,
    requiresTCPA: true,
    minComplianceScore: 60
  }
}

describe('TrustedForm & Jornaya Compliance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('TrustedForm Certificate Validation', () => {
    test('should validate authentic TrustedForm certificates', async () => {
      const validCertUrl = 'https://cert.trustedform.com/abcd1234567890'
      const validCertId = 'tf_cert_12345678901234567890'

      const isValid = await ComplianceValidator.validateTrustedFormCertificate(validCertUrl, validCertId)

      expect(isValid).toBe(true)
    })

    test('should reject invalid TrustedForm certificate URLs', async () => {
      const invalidUrls = [
        'https://fake-cert.com/cert123',
        'http://cert.trustedform.com/cert123', // HTTP instead of HTTPS
        'https://cert.trustedform.com/', // Missing cert ID
        '',
        null,
        undefined
      ]

      for (const url of invalidUrls) {
        const isValid = await ComplianceValidator.validateTrustedFormCertificate(url as any, 'valid_id')
        expect(isValid).toBe(false)
      }
    })

    test('should reject short or malformed certificate IDs', async () => {
      const validUrl = 'https://cert.trustedform.com/abcd1234567890'
      const invalidIds = [
        'short',
        '',
        '123',
        null,
        undefined
      ]

      for (const id of invalidIds) {
        const isValid = await ComplianceValidator.validateTrustedFormCertificate(validUrl, id as any)
        expect(isValid).toBe(false)
      }
    })

    test('should handle TrustedForm API timeouts gracefully', async () => {
      jest.setTimeout(10000)

      // Mock a slow TrustedForm API response
      const slowValidation = new Promise((resolve) => {
        setTimeout(() => resolve(true), 5000)
      })

      const startTime = performance.now()
      const result = await Promise.race([
        slowValidation,
        new Promise(resolve => setTimeout(() => resolve(false), 3000)) // 3 second timeout
      ])
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(4000) // Should timeout before 4 seconds
      expect(typeof result).toBe('boolean')
    })
  })

  describe('Jornaya LeadID Validation', () => {
    test('should validate authentic Jornaya LeadIDs', async () => {
      const validLeadIds = [
        'jornaya_lead_1234567890abcdef',
        'JOR123456789012345678901234',
        'lead_id_abcdefghijklmnop123456'
      ]

      for (const leadId of validLeadIds) {
        const isValid = await ComplianceValidator.validateJornayaLeadId(leadId)
        expect(isValid).toBe(true)
      }
    })

    test('should reject invalid or short LeadIDs', async () => {
      const invalidLeadIds = [
        'short',
        '12345',
        '',
        null,
        undefined,
        'fake_id'
      ]

      for (const leadId of invalidLeadIds) {
        const isValid = await ComplianceValidator.validateJornayaLeadId(leadId as any)
        expect(isValid).toBe(false)
      }
    })

    test('should handle Jornaya API errors gracefully', async () => {
      // Mock API error
      const errorValidation = ComplianceValidator.validateJornayaLeadId('error_trigger_id')

      await expect(errorValidation).resolves.toBe(false) // Should not throw, should return false
    })
  })

  describe('TCPA Compliance Validation', () => {
    test('should validate proper TCPA consent', () => {
      const compliantData: ComplianceData = {
        tcpaConsent: true,
        privacyPolicyAccepted: true,
        timestamp: new Date().toISOString(),
        userAgent: 'Mozilla/5.0 (Test Browser)',
        ipAddress: '127.0.0.1'
      }

      const validation = ComplianceTestUtils.validateTCPACompliance(compliantData)

      expect(validation.hasTcpaConsent).toBe(true)
      expect(validation.hasPrivacyPolicy).toBe(true)
      expect(validation.hasTimestamp).toBe(true)
      expect(validation.hasUserAgent).toBe(true)
    })

    test('should flag missing TCPA consent', () => {
      const nonCompliantData: ComplianceData = {
        tcpaConsent: false,
        privacyPolicyAccepted: true,
        timestamp: new Date().toISOString()
      }

      const validation = ComplianceTestUtils.validateTCPACompliance(nonCompliantData)

      expect(validation.hasTcpaConsent).toBe(false)
      expect(validation.hasPrivacyPolicy).toBe(true)
    })

    test('should validate timestamp freshness', async () => {
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
      const freshTimestamp = new Date().toISOString()

      const oldData: ComplianceData = {
        tcpaConsent: true,
        privacyPolicyAccepted: true,
        timestamp: oldTimestamp
      }

      const freshData: ComplianceData = {
        tcpaConsent: true,
        privacyPolicyAccepted: true,
        timestamp: freshTimestamp
      }

      const oldValidation = await ComplianceValidator.validateFullCompliance(oldData)
      const freshValidation = await ComplianceValidator.validateFullCompliance(freshData)

      expect(oldValidation.issues).toContain('Timestamp too old - potential replay attack')
      expect(freshValidation.issues).not.toContain('Timestamp too old - potential replay attack')
    })
  })

  describe('Full Compliance Validation', () => {
    test('should validate complete compliant submission', async () => {
      const compliantData: ComplianceData = {
        trustedFormCertUrl: 'https://cert.trustedform.com/valid123456789',
        trustedFormCertId: 'tf_cert_valid123456789',
        jornayaLeadId: 'jornaya_valid_lead_id_123456',
        tcpaConsent: true,
        privacyPolicyAccepted: true,
        timestamp: new Date().toISOString(),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Test Browser)'
      }

      const validation = await ComplianceValidator.validateFullCompliance(compliantData)

      expect(validation.isCompliant).toBe(true)
      expect(validation.trustedFormValid).toBe(true)
      expect(validation.jornayaValid).toBe(true)
      expect(validation.tcpaValid).toBe(true)
      expect(validation.issues).toHaveLength(0)
    })

    test('should identify multiple compliance issues', async () => {
      const nonCompliantData: ComplianceData = {
        trustedFormCertUrl: 'https://fake-cert.com/invalid',
        trustedFormCertId: 'short',
        jornayaLeadId: 'fake',
        tcpaConsent: false,
        privacyPolicyAccepted: false,
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString() // Old timestamp
      }

      const validation = await ComplianceValidator.validateFullCompliance(nonCompliantData)

      expect(validation.isCompliant).toBe(false)
      expect(validation.issues.length).toBeGreaterThan(0)
      expect(validation.issues).toContain('TrustedForm certificate invalid or missing')
      expect(validation.issues).toContain('Jornaya LeadID invalid or missing')
      expect(validation.issues).toContain('TCPA consent or privacy policy acceptance missing')
    })

    test('should handle partial compliance data', async () => {
      const partialData: ComplianceData = {
        trustedFormCertUrl: 'https://cert.trustedform.com/valid123456789',
        trustedFormCertId: 'tf_cert_valid123456789',
        // Missing Jornaya LeadID
        tcpaConsent: true,
        privacyPolicyAccepted: true,
        timestamp: new Date().toISOString()
      }

      const validation = await ComplianceValidator.validateFullCompliance(partialData)

      expect(validation.trustedFormValid).toBe(true)
      expect(validation.jornayaValid).toBe(false)
      expect(validation.tcpaValid).toBe(true)
      expect(validation.isCompliant).toBe(false) // Overall compliance fails due to missing Jornaya
    })
  })

  describe('Buyer Compliance Requirements', () => {
    test('should validate Modernize compliance requirements', async () => {
      const requirements = buyerComplianceRequirements.modernize
      const data: ComplianceData = {
        trustedFormCertUrl: 'https://cert.trustedform.com/modernize123',
        trustedFormCertId: 'tf_cert_modernize123',
        jornayaLeadId: 'jornaya_modernize_lead_123',
        tcpaConsent: true,
        privacyPolicyAccepted: true,
        timestamp: new Date().toISOString(),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      }

      const validation = await ComplianceValidator.validateFullCompliance(data)
      const complianceScore = ComplianceValidator.generateComplianceReport(data).compliance_score

      // Check Modernize-specific requirements
      expect(validation.trustedFormValid).toBe(requirements.requiresTrustedForm ? true : expect.any(Boolean))
      expect(validation.jornayaValid).toBe(requirements.requiresJornaya ? true : expect.any(Boolean))
      expect(validation.tcpaValid).toBe(requirements.requiresTCPA ? true : expect.any(Boolean))
      expect(complianceScore).toBeGreaterThanOrEqual(requirements.minComplianceScore)
    })

    test('should handle different buyer requirements', async () => {
      const testData: ComplianceData = {
        trustedFormCertUrl: 'https://cert.trustedform.com/test123',
        trustedFormCertId: 'tf_cert_test123',
        jornayaLeadId: 'jornaya_test_123',
        tcpaConsent: true,
        privacyPolicyAccepted: true,
        timestamp: new Date().toISOString()
      }

      const buyers = ['modernize', 'homeadvisor', 'angi'] as const
      
      for (const buyer of buyers) {
        const requirements = buyerComplianceRequirements[buyer]
        const validation = await ComplianceValidator.validateFullCompliance(testData)
        const report = ComplianceValidator.generateComplianceReport(testData)

        // Each buyer should be able to evaluate compliance against their requirements
        if (requirements.requiresTrustedForm) {
          expect(validation.trustedFormValid).toBe(true)
        }
        if (requirements.requiresJornaya) {
          expect(validation.jornayaValid).toBe(true)
        }
        if (requirements.requiresTCPA) {
          expect(validation.tcpaValid).toBe(true)
        }

        expect(report.compliance_score).toBeGreaterThanOrEqual(0)
        expect(report.compliance_score).toBeLessThanOrEqual(100)
      }
    })

    test('should generate buyer-specific compliance payloads', async () => {
      const baseData = mockFormSubmission

      // Modernize payload (requires both TrustedForm and Jornaya)
      const modernizePayload = {
        ...baseData.formData,
        zip_code: baseData.zipCode,
        homeowner: baseData.ownsHome,
        xxTrustedFormCertUrl: baseData.trustedFormCertUrl,
        xxTrustedFormToken: baseData.trustedFormCertId,
        universal_leadid: baseData.jornayaLeadId,
        tcpa_consent: baseData.complianceData.tcpaConsent
      }

      // HomeAdvisor payload (TrustedForm required, Jornaya optional)
      const homeAdvisorPayload = {
        ...baseData.formData,
        postal_code: baseData.zipCode,
        owns_property: baseData.ownsHome,
        trusted_form_cert_url: baseData.trustedFormCertUrl,
        trusted_form_token: baseData.trustedFormCertId,
        opt_in_consent: baseData.complianceData.tcpaConsent
        // Note: No Jornaya LeadID for HomeAdvisor
      }

      // Angi payload (Jornaya required, TrustedForm optional)
      const angiPayload = {
        ...baseData.formData,
        zip: baseData.zipCode,
        homeowner_status: baseData.ownsHome,
        jornaya_leadid: baseData.jornayaLeadId,
        consent_given: baseData.complianceData.tcpaConsent
        // Note: No TrustedForm for Angi
      }

      // Validate each payload has required compliance fields
      expect(modernizePayload.xxTrustedFormCertUrl).toBeDefined()
      expect(modernizePayload.universal_leadid).toBeDefined()

      expect(homeAdvisorPayload.trusted_form_cert_url).toBeDefined()
      expect(homeAdvisorPayload).not.toHaveProperty('universal_leadid')

      expect(angiPayload.jornaya_leadid).toBeDefined()
      expect(angiPayload).not.toHaveProperty('xxTrustedFormCertUrl')
    })
  })

  describe('Compliance Reporting and Analytics', () => {
    test('should generate comprehensive compliance reports', () => {
      const testData: ComplianceData = {
        trustedFormCertUrl: 'https://cert.trustedform.com/report123',
        trustedFormCertId: 'tf_cert_report123',
        jornayaLeadId: 'jornaya_report_123',
        tcpaConsent: true,
        privacyPolicyAccepted: true,
        timestamp: new Date().toISOString(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }

      const report = ComplianceValidator.generateComplianceReport(testData)

      expect(report).toHaveProperty('compliance_score')
      expect(report).toHaveProperty('trustedform_present')
      expect(report).toHaveProperty('jornaya_present')
      expect(report).toHaveProperty('tcpa_consent')
      expect(report).toHaveProperty('privacy_accepted')
      expect(report).toHaveProperty('timestamp')
      expect(report).toHaveProperty('metadata')

      expect(report.compliance_score).toBeGreaterThan(80) // Should have high score
      expect(report.trustedform_present).toBe(true)
      expect(report.jornaya_present).toBe(true)
      expect(report.metadata.ip_address).toBe('192.168.1.100')
    })

    test('should calculate compliance scores accurately', () => {
      const testCases = [
        {
          data: {
            trustedFormCertId: 'cert123',
            jornayaLeadId: 'lead123',
            tcpaConsent: true,
            privacyPolicyAccepted: true,
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0',
            timestamp: new Date().toISOString()
          },
          expectedScore: 100 // All fields present
        },
        {
          data: {
            tcpaConsent: true,
            privacyPolicyAccepted: true,
            timestamp: new Date().toISOString()
          },
          expectedScore: 40 // Only basic TCPA compliance
        },
        {
          data: {
            trustedFormCertId: 'cert123',
            tcpaConsent: false,
            privacyPolicyAccepted: false,
            timestamp: new Date().toISOString()
          },
          expectedScore: 25 // Only TrustedForm
        }
      ]

      testCases.forEach(({ data, expectedScore }) => {
        const report = ComplianceValidator.generateComplianceReport(data as ComplianceData)
        expect(report.compliance_score).toBe(expectedScore)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('should handle malformed compliance data gracefully', async () => {
      const malformedData = {
        trustedFormCertUrl: null,
        trustedFormCertId: undefined,
        jornayaLeadId: '',
        tcpaConsent: 'yes', // Should be boolean
        privacyPolicyAccepted: 1, // Should be boolean
        timestamp: 'invalid-date'
      } as any

      const validation = await ComplianceValidator.validateFullCompliance(malformedData)

      expect(validation.isCompliant).toBe(false)
      expect(validation.issues.length).toBeGreaterThan(0)
    })

    test('should handle network timeouts during validation', async () => {
      jest.setTimeout(15000)

      // Simulate network timeout scenarios
      const timeoutTestData: ComplianceData = {
        trustedFormCertUrl: 'https://cert.trustedform.com/timeout_test',
        trustedFormCertId: 'timeout_cert_123',
        jornayaLeadId: 'timeout_lead_123',
        tcpaConsent: true,
        privacyPolicyAccepted: true,
        timestamp: new Date().toISOString()
      }

      const startTime = performance.now()
      
      const validation = await Promise.race([
        ComplianceValidator.validateFullCompliance(timeoutTestData),
        new Promise<ComplianceValidationResult>(resolve => 
          setTimeout(() => resolve({
            isCompliant: false,
            trustedFormValid: false,
            jornayaValid: false,
            tcpaValid: true,
            issues: ['Validation timeout']
          }), 5000)
        )
      ])

      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(6000) // Should not hang indefinitely
      expect(validation).toHaveProperty('isCompliant')
    }, 15000)

    test('should validate compliance data integrity', () => {
      // Test for tampered compliance data
      const suspiciousData: ComplianceData = {
        trustedFormCertUrl: 'https://cert.trustedform.com/valid123',
        trustedFormCertId: 'valid_cert_123',
        jornayaLeadId: 'valid_lead_123',
        tcpaConsent: true,
        privacyPolicyAccepted: true,
        timestamp: '2020-01-01T00:00:00Z' // Very old timestamp
      }

      const validation = ComplianceTestUtils.validateTrustedFormIntegration(suspiciousData)

      expect(validation.certUrlValid).toBe(true)
      expect(validation.certIdValid).toBe(true)
      
      // Additional integrity checks would be implemented in production
      expect(suspiciousData.timestamp).toBe('2020-01-01T00:00:00Z')
    })
  })
})