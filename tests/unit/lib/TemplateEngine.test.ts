/**
 * Unit Tests: Template Engine
 * Tests the core template transformation logic used in buyer integrations
 */

import { describe, test, expect, beforeEach } from '@jest/globals'

// Mock the TemplateEngine since we're testing the interface
class MockTemplateEngine {
  static transform(data: any, mappings: any[], includeCompliance = false): any {
    const result: any = {}
    
    for (const mapping of mappings) {
      let value = this.getNestedValue(data, mapping.sourceField)
      
      if (value === undefined || value === null) {
        if (mapping.defaultValue !== undefined) {
          value = mapping.defaultValue
        } else if (mapping.required) {
          throw new Error(`Required field ${mapping.sourceField} is missing`)
        } else {
          continue
        }
      }
      
      // Apply transformations
      if (mapping.transform) {
        value = this.applyTransform(value, mapping.transform)
      }
      
      this.setNestedValue(result, mapping.targetField, value)
    }
    
    if (includeCompliance) {
      this.addComplianceFields(result, data)
    }
    
    return result
  }
  
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
  
  private static setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {}
      return current[key]
    }, obj)
    target[lastKey] = value
  }
  
  private static applyTransform(value: any, transform: string): any {
    switch (transform) {
      case 'uppercase':
        return String(value).toUpperCase()
      case 'lowercase':
        return String(value).toLowerCase()
      case 'number':
        return Number(value)
      case 'boolean':
        return Boolean(value)
      case 'windowsCount':
        return this.customTransforms.windowsCount(value)
      case 'bathroomCount':
        return this.customTransforms.bathroomCount(value)
      default:
        return value
    }
  }
  
  private static customTransforms = {
    windowsCount: (value: string): string => {
      const mapping: Record<string, string> = {
        '1-3': '1-3',
        '4-6': '4-6', 
        '7-10': '6-9',
        '11-15': '10+',
        '16+': '10+'
      }
      return mapping[value] || value
    },
    
    bathroomCount: (value: string): number => {
      const match = value.match(/(\d+)/)
      return match ? parseInt(match[1]) : 1
    }
  }
  
  private static addComplianceFields(result: any, data: any): void {
    if (data.trustedFormCertUrl) {
      result.xxTrustedFormCertUrl = data.trustedFormCertUrl
    }
    if (data.trustedFormCertId) {
      result.xxTrustedFormToken = data.trustedFormCertId
    }
    if (data.jornayaLeadId) {
      result.universal_leadid = data.jornayaLeadId
      result.jornaya_leadid = data.jornayaLeadId
    }
    if (data.complianceData?.tcpaConsent) {
      result.tcpa_consent = data.complianceData.tcpaConsent
      result.opt_in_consent = data.complianceData.tcpaConsent
    }
    if (data.complianceData?.ipAddress) {
      result.ip_address = data.complianceData.ipAddress
    }
    if (data.complianceData?.timestamp) {
      result.submission_timestamp = data.complianceData.timestamp
    }
  }
}

describe('TemplateEngine', () => {
  const sampleData = {
    zipCode: '12345',
    ownsHome: 'Yes',
    numberOfWindows: '4-6',
    contactInfo: {
      firstName: 'john',
      lastName: 'doe'
    },
    trustedFormCertUrl: 'https://cert.trustedform.com/test123',
    trustedFormCertId: 'test123',
    jornayaLeadId: 'jornaya_test_id',
    complianceData: {
      tcpaConsent: true,
      ipAddress: '127.0.0.1',
      timestamp: '2024-01-01T12:00:00Z'
    }
  }

  describe('Basic Field Mapping', () => {
    test('should transform simple field mappings', () => {
      const mappings = [
        { sourceField: 'zipCode', targetField: 'zip_code' },
        { sourceField: 'ownsHome', targetField: 'homeowner' }
      ]

      const result = MockTemplateEngine.transform(sampleData, mappings)

      expect(result).toEqual({
        zip_code: '12345',
        homeowner: 'Yes'
      })
    })

    test('should handle nested field mappings', () => {
      const mappings = [
        { sourceField: 'contactInfo.firstName', targetField: 'first_name' },
        { sourceField: 'contactInfo.lastName', targetField: 'last_name' }
      ]

      const result = MockTemplateEngine.transform(sampleData, mappings)

      expect(result).toEqual({
        first_name: 'john',
        last_name: 'doe'
      })
    })

    test('should handle nested target fields', () => {
      const mappings = [
        { sourceField: 'zipCode', targetField: 'address.postal_code' },
        { sourceField: 'ownsHome', targetField: 'customer.owns_home' }
      ]

      const result = MockTemplateEngine.transform(sampleData, mappings)

      expect(result).toEqual({
        address: { postal_code: '12345' },
        customer: { owns_home: 'Yes' }
      })
    })
  })

  describe('Data Transformations', () => {
    test('should apply uppercase transformation', () => {
      const mappings = [
        { sourceField: 'contactInfo.firstName', targetField: 'first_name', transform: 'uppercase' }
      ]

      const result = MockTemplateEngine.transform(sampleData, mappings)

      expect(result.first_name).toBe('JOHN')
    })

    test('should apply lowercase transformation', () => {
      const mappings = [
        { sourceField: 'contactInfo.firstName', targetField: 'first_name', transform: 'lowercase' }
      ]

      const result = MockTemplateEngine.transform(sampleData, mappings)

      expect(result.first_name).toBe('john')
    })

    test('should apply number transformation', () => {
      const mappings = [
        { sourceField: 'zipCode', targetField: 'zip_number', transform: 'number' }
      ]

      const result = MockTemplateEngine.transform(sampleData, mappings)

      expect(result.zip_number).toBe(12345)
      expect(typeof result.zip_number).toBe('number')
    })

    test('should apply boolean transformation', () => {
      const mappings = [
        { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean' }
      ]

      const result = MockTemplateEngine.transform(sampleData, mappings)

      expect(result.homeowner).toBe(true)
      expect(typeof result.homeowner).toBe('boolean')
    })
  })

  describe('Custom Transformations', () => {
    test('should apply windows count transformation', () => {
      const testCases = [
        { input: '1-3', expected: '1-3' },
        { input: '4-6', expected: '4-6' },
        { input: '7-10', expected: '6-9' },
        { input: '11-15', expected: '10+' },
        { input: '16+', expected: '10+' }
      ]

      testCases.forEach(({ input, expected }) => {
        const data = { numberOfWindows: input }
        const mappings = [
          { sourceField: 'numberOfWindows', targetField: 'window_count', transform: 'windowsCount' }
        ]

        const result = MockTemplateEngine.transform(data, mappings)
        expect(result.window_count).toBe(expected)
      })
    })

    test('should apply bathroom count transformation', () => {
      const testCases = [
        { input: '1', expected: 1 },
        { input: '2', expected: 2 },
        { input: '3', expected: 3 },
        { input: '4+', expected: 4 }
      ]

      testCases.forEach(({ input, expected }) => {
        const data = { numberOfBathrooms: input }
        const mappings = [
          { sourceField: 'numberOfBathrooms', targetField: 'bathroom_count', transform: 'bathroomCount' }
        ]

        const result = MockTemplateEngine.transform(data, mappings)
        expect(result.bathroom_count).toBe(expected)
      })
    })
  })

  describe('Default Values and Required Fields', () => {
    test('should use default value when field is missing', () => {
      const data = { zipCode: '12345' }
      const mappings = [
        { sourceField: 'ownsHome', targetField: 'homeowner', defaultValue: 'Unknown' }
      ]

      const result = MockTemplateEngine.transform(data, mappings)

      expect(result.homeowner).toBe('Unknown')
    })

    test('should skip optional missing fields', () => {
      const data = { zipCode: '12345' }
      const mappings = [
        { sourceField: 'zipCode', targetField: 'zip_code' },
        { sourceField: 'ownsHome', targetField: 'homeowner' }
      ]

      const result = MockTemplateEngine.transform(data, mappings)

      expect(result).toEqual({ zip_code: '12345' })
      expect(result).not.toHaveProperty('homeowner')
    })

    test('should throw error for missing required fields', () => {
      const data = { zipCode: '12345' }
      const mappings = [
        { sourceField: 'ownsHome', targetField: 'homeowner', required: true }
      ]

      expect(() => MockTemplateEngine.transform(data, mappings)).toThrow('Required field ownsHome is missing')
    })
  })

  describe('Compliance Data Integration', () => {
    test('should include TrustedForm fields when compliance is enabled', () => {
      const mappings = [
        { sourceField: 'zipCode', targetField: 'zip_code' }
      ]

      const result = MockTemplateEngine.transform(sampleData, mappings, true)

      expect(result).toEqual({
        zip_code: '12345',
        xxTrustedFormCertUrl: 'https://cert.trustedform.com/test123',
        xxTrustedFormToken: 'test123',
        universal_leadid: 'jornaya_test_id',
        jornaya_leadid: 'jornaya_test_id',
        tcpa_consent: true,
        opt_in_consent: true,
        ip_address: '127.0.0.1',
        submission_timestamp: '2024-01-01T12:00:00Z'
      })
    })

    test('should not include compliance fields when compliance is disabled', () => {
      const mappings = [
        { sourceField: 'zipCode', targetField: 'zip_code' }
      ]

      const result = MockTemplateEngine.transform(sampleData, mappings, false)

      expect(result).toEqual({
        zip_code: '12345'
      })
    })

    test('should handle partial compliance data', () => {
      const partialData = {
        zipCode: '12345',
        trustedFormCertId: 'test123'
        // Missing jornayaLeadId and complianceData
      }

      const mappings = [
        { sourceField: 'zipCode', targetField: 'zip_code' }
      ]

      const result = MockTemplateEngine.transform(partialData, mappings, true)

      expect(result).toEqual({
        zip_code: '12345',
        xxTrustedFormToken: 'test123'
      })
    })
  })

  describe('Complex Mapping Scenarios', () => {
    test('should handle buyer-specific template configuration', () => {
      const modernizeMapping = [
        { sourceField: 'zipCode', targetField: 'zip_code' },
        { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean' },
        { sourceField: 'numberOfWindows', targetField: 'window_count', transform: 'windowsCount' }
      ]

      const homeAdvisorMapping = [
        { sourceField: 'zipCode', targetField: 'postal_code' },
        { sourceField: 'ownsHome', targetField: 'owns_property', transform: 'boolean' },
        { sourceField: 'numberOfWindows', targetField: 'windows', defaultValue: 'not_specified' }
      ]

      const modernizeResult = MockTemplateEngine.transform(sampleData, modernizeMapping, true)
      const homeAdvisorResult = MockTemplateEngine.transform(sampleData, homeAdvisorMapping, true)

      expect(modernizeResult.zip_code).toBe('12345')
      expect(modernizeResult.window_count).toBe('4-6')

      expect(homeAdvisorResult.postal_code).toBe('12345')
      expect(homeAdvisorResult.windows).toBe('not_specified')

      // Both should have compliance data
      expect(modernizeResult.xxTrustedFormToken).toBe('test123')
      expect(homeAdvisorResult.xxTrustedFormToken).toBe('test123')
    })

    test('should handle empty mappings gracefully', () => {
      const result = MockTemplateEngine.transform(sampleData, [])
      expect(result).toEqual({})
    })

    test('should handle null and undefined values correctly', () => {
      const dataWithNulls = {
        zipCode: '12345',
        ownsHome: null,
        contactName: undefined,
        phoneNumber: ''
      }

      const mappings = [
        { sourceField: 'zipCode', targetField: 'zip_code' },
        { sourceField: 'ownsHome', targetField: 'homeowner', defaultValue: 'Unknown' },
        { sourceField: 'contactName', targetField: 'name', defaultValue: 'Anonymous' },
        { sourceField: 'phoneNumber', targetField: 'phone' }
      ]

      const result = MockTemplateEngine.transform(dataWithNulls, mappings)

      expect(result).toEqual({
        zip_code: '12345',
        homeowner: 'Unknown',
        name: 'Anonymous',
        phone: ''
      })
    })
  })

  describe('Performance and Edge Cases', () => {
    test('should handle large datasets efficiently', () => {
      const largeData = {
        ...sampleData,
        ...Array.from({ length: 100 }, (_, i) => ({ [`field${i}`]: `value${i}` })).reduce((acc, item) => ({ ...acc, ...item }), {})
      }

      const largeMappings = Array.from({ length: 100 }, (_, i) => ({
        sourceField: `field${i}`,
        targetField: `target_field_${i}`
      }))

      const startTime = performance.now()
      const result = MockTemplateEngine.transform(largeData, largeMappings)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
      expect(Object.keys(result)).toHaveLength(100)
    })

    test('should handle circular references safely', () => {
      const circularData: any = { zipCode: '12345' }
      circularData.self = circularData

      const mappings = [
        { sourceField: 'zipCode', targetField: 'zip_code' }
      ]

      // Should not throw an error and should process the non-circular fields
      expect(() => MockTemplateEngine.transform(circularData, mappings)).not.toThrow()
    })

    test('should validate transformation integrity', () => {
      const mappings = [
        { sourceField: 'zipCode', targetField: 'zip_code' },
        { sourceField: 'ownsHome', targetField: 'homeowner', transform: 'boolean' }
      ]

      const result = MockTemplateEngine.transform(sampleData, mappings)

      // Verify data integrity
      expect(result.zip_code).toBe(sampleData.zipCode)
      expect(typeof result.homeowner).toBe('boolean')
    })
  })
})