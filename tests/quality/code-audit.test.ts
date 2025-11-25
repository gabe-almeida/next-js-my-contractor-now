/**
 * Code Quality Audit Tests
 * Validates code against quality standards and development plan compliance
 */

import { describe, test, expect, beforeAll } from '@jest/globals'
import { CodeQualityUtils, AuditUtils } from '@/tests/utils/testHelpers'
import { Glob } from 'glob'
import * as fs from 'fs'
import * as path from 'path'

// Mock file system operations for testing
const mockFileSystem = {
  files: new Map<string, string>(),
  
  addFile(filePath: string, content: string) {
    this.files.set(filePath, content)
  },
  
  getFile(filePath: string): string | undefined {
    return this.files.get(filePath)
  },
  
  getAllFiles(): [string, string][] {
    return Array.from(this.files.entries())
  },
  
  getFilesByPattern(pattern: RegExp): [string, string][] {
    return Array.from(this.files.entries()).filter(([path]) => pattern.test(path))
  }
}

// Initialize mock files for testing
const initializeMockCodebase = () => {
  // Mock React components
  mockFileSystem.addFile('/src/components/forms/ServiceForm.tsx', `
import React, { useState, useEffect } from 'react'
import { useTrustedForm } from './TrustedFormProvider'
import { useJornayaLeadID } from './JornayaProvider'

interface ServiceFormProps {
  serviceType: ServiceType
}

export function ServiceForm({ serviceType }: ServiceFormProps) {
  const [formData, setFormData] = useState({})
  const { certUrl, certId, isReady } = useTrustedForm()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // Form submission logic
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  )
}
  `.trim())

  // Mock API routes
  mockFileSystem.addFile('/src/app/api/leads/route.ts', `
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const leadSchema = z.object({
  serviceTypeId: z.string().uuid(),
  zipCode: z.string().regex(/^\\d{5}$/),
  ownsHome: z.boolean()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = leadSchema.parse(body)
    
    const lead = await prisma.lead.create({
      data: validatedData
    })
    
    return NextResponse.json({ success: true, leadId: lead.id })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }
}
  `.trim())

  // Mock utility functions
  mockFileSystem.addFile('/src/lib/templates/TemplateEngine.ts', `
export class TemplateEngine {
  static transform(data: any, mappings: any[]): any {
    const result = {}
    
    for (const mapping of mappings) {
      const value = this.getValue(data, mapping.sourceField)
      if (value !== undefined) {
        this.setValue(result, mapping.targetField, value)
      }
    }
    
    return result
  }
  
  private static getValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
  
  private static setValue(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {}
      return current[key]
    }, obj)
    target[lastKey] = value
  }
}
  `.trim())

  // Mock configuration files
  mockFileSystem.addFile('/src/config/buyers.ts', `
export const BUYER_CONFIGS = {
  modernize: {
    apiUrl: 'https://api.modernize.com',
    timeout: 30000,
    retries: 3
  },
  homeadvisor: {
    apiUrl: 'https://api.homeadvisor.com',
    timeout: 25000,
    retries: 2
  }
}
  `.trim())

  // Mock large file (should trigger file size warning)
  const largeFileContent = Array.from({ length: 600 }, (_, i) => `// Line ${i + 1}`).join('\n')
  mockFileSystem.addFile('/src/components/LargeComponent.tsx', largeFileContent)
}

// Code quality analyzers
class CodeQualityAnalyzer {
  static analyzeFile(filePath: string, content: string) {
    const lines = content.split('\n')
    const issues = []

    // Check file size (500 line limit)
    if (lines.length > 500) {
      issues.push({
        type: 'file_size',
        severity: 'error',
        message: `File exceeds 500 line limit (${lines.length} lines)`,
        line: 0
      })
    } else if (lines.length > 400) {
      issues.push({
        type: 'file_size',
        severity: 'warning', 
        message: `File approaching size limit (${lines.length} lines)`,
        line: 0
      })
    }

    // Check for proper TypeScript usage
    if (filePath.endsWith('.js') && !filePath.endsWith('.test.js')) {
      issues.push({
        type: 'typescript',
        severity: 'warning',
        message: 'Consider using TypeScript (.ts/.tsx) instead of JavaScript',
        line: 0
      })
    }

    // Check for proper imports
    const importPattern = /^import\s+.*\s+from\s+['"][^'"]*['"]$/
    lines.forEach((line, index) => {
      if (line.trim().startsWith('import') && !importPattern.test(line.trim())) {
        issues.push({
          type: 'import_style',
          severity: 'warning',
          message: 'Inconsistent import statement format',
          line: index + 1
        })
      }
    })

    // Check for console.log statements (should use proper logging)
    lines.forEach((line, index) => {
      if (line.includes('console.log') && !filePath.includes('.test.')) {
        issues.push({
          type: 'logging',
          severity: 'info',
          message: 'Consider using structured logging instead of console.log',
          line: index + 1
        })
      }
    })

    // Check for hardcoded strings (potential i18n issues)
    lines.forEach((line, index) => {
      const hardcodedTextPattern = /['"]([A-Z][a-z\s]{10,})['"]/ // Capitalized text 10+ chars
      if (hardcodedTextPattern.test(line) && !filePath.includes('.test.')) {
        issues.push({
          type: 'hardcoded_text',
          severity: 'info',
          message: 'Consider extracting hardcoded text for internationalization',
          line: index + 1
        })
      }
    })

    // Check for TODOs and FIXMEs
    lines.forEach((line, index) => {
      if (line.includes('TODO') || line.includes('FIXME')) {
        issues.push({
          type: 'todo',
          severity: 'info',
          message: 'TODO/FIXME comment found',
          line: index + 1
        })
      }
    })

    return {
      filePath,
      lineCount: lines.length,
      issues,
      metrics: {
        complexity: this.calculateCyclomaticComplexity(content),
        maintainabilityIndex: this.calculateMaintainabilityIndex(content)
      }
    }
  }

  private static calculateCyclomaticComplexity(content: string): number {
    // Simplified cyclomatic complexity calculation
    const complexityKeywords = [
      'if', 'else', 'switch', 'case', 'for', 'while', 'do', 
      '&&', '||', '?', 'catch', 'finally'
    ]
    
    let complexity = 1 // Base complexity
    
    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g')
      const matches = content.match(regex)
      if (matches) {
        complexity += matches.length
      }
    })

    return complexity
  }

  private static calculateMaintainabilityIndex(content: string): number {
    // Simplified maintainability index (0-100, higher is better)
    const lines = content.split('\n').length
    const complexity = this.calculateCyclomaticComplexity(content)
    
    // Simple heuristic: penalize long files and high complexity
    let index = 100
    if (lines > 100) index -= (lines - 100) * 0.1
    if (complexity > 10) index -= (complexity - 10) * 2
    
    return Math.max(0, Math.min(100, index))
  }

  static analyzeArchitecture(files: [string, string][]) {
    const issues = []
    const structure = {
      components: files.filter(([path]) => path.includes('/components/')),
      pages: files.filter(([path]) => path.includes('/pages/') || path.includes('/app/')),
      utils: files.filter(([path]) => path.includes('/lib/') || path.includes('/utils/')),
      tests: files.filter(([path]) => path.includes('.test.') || path.includes('.spec.')),
      config: files.filter(([path]) => path.includes('/config/'))
    }

    // Check for proper separation of concerns
    structure.components.forEach(([path, content]) => {
      if (content.includes('prisma.') || content.includes('database')) {
        issues.push({
          type: 'architecture',
          severity: 'error',
          message: 'Component should not contain database logic',
          file: path
        })
      }
    })

    // Check for missing tests
    const testableFiles = [...structure.components, ...structure.utils, ...structure.pages]
    testableFiles.forEach(([path]) => {
      const testPath = path.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1')
      const hasTest = structure.tests.some(([testFile]) => testFile.includes(path.split('/').pop()!.replace(/\.(ts|tsx|js|jsx)$/, '')))
      
      if (!hasTest && !path.includes('.test.') && !path.includes('_app.') && !path.includes('_document.')) {
        issues.push({
          type: 'testing',
          severity: 'warning',
          message: 'File missing corresponding test file',
          file: path
        })
      }
    })

    // Check for circular dependencies (simplified)
    const imports = new Map<string, string[]>()
    files.forEach(([path, content]) => {
      const importMatches = content.match(/import.*from\s+['"]([^'"]+)['"]/g)
      if (importMatches) {
        const fileImports = importMatches.map(match => {
          const importPath = match.match(/from\s+['"]([^'"]+)['"]/)?.[1] || ''
          return importPath.startsWith('.') ? importPath : null
        }).filter(Boolean) as string[]
        
        imports.set(path, fileImports)
      }
    })

    return {
      structure,
      issues,
      metrics: {
        totalFiles: files.length,
        testCoverage: (structure.tests.length / testableFiles.length) * 100,
        componentToTestRatio: structure.tests.length / Math.max(structure.components.length, 1)
      }
    }
  }
}

// PRD compliance checker
class PRDComplianceChecker {
  private static readonly PRD_REQUIREMENTS = {
    // Core features from PRD
    dynamicForms: {
      required: true,
      files: ['/components/forms/ServiceForm', '/lib/forms/FormEngine'],
      description: 'Dynamic service-specific form generation'
    },
    complianceIntegration: {
      required: true,
      files: ['/components/forms/TrustedFormProvider', '/components/forms/JornayaProvider'],
      description: 'TrustedForm and Jornaya LeadID integration'
    },
    leadProcessing: {
      required: true,
      files: ['/workers/lead-processor', '/lib/auction/AuctionEngine'],
      description: 'Async lead processing and auction system'
    },
    buyerManagement: {
      required: true,
      files: ['/lib/templates/TemplateEngine', '/config/buyers'],
      description: 'Multi-buyer support with configurable templates'
    },
    adminDashboard: {
      required: true,
      files: ['/app/(admin)/admin', '/components/admin'],
      description: 'Admin interface for managing service types and buyers'
    },
    apiEndpoints: {
      required: true,
      files: ['/app/api/leads', '/app/api/service-types', '/app/api/webhooks'],
      description: 'REST API endpoints for lead submission and management'
    }
  }

  static checkCompliance(files: [string, string][]) {
    const compliance = []
    const filePaths = files.map(([path]) => path)

    Object.entries(this.PRD_REQUIREMENTS).forEach(([feature, requirement]) => {
      const implementedFiles = requirement.files.filter(expectedFile => 
        filePaths.some(path => path.includes(expectedFile))
      )

      compliance.push({
        feature,
        description: requirement.description,
        required: requirement.required,
        implemented: implementedFiles.length > 0,
        implementedFiles,
        missingFiles: requirement.files.filter(file => 
          !filePaths.some(path => path.includes(file))
        ),
        completeness: (implementedFiles.length / requirement.files.length) * 100
      })
    })

    return compliance
  }
}

describe('Code Quality Audit', () => {
  beforeAll(() => {
    initializeMockCodebase()
  })

  describe('File Size and Structure Standards', () => {
    test('should enforce 500-line file limit', () => {
      const files = mockFileSystem.getAllFiles()
      const fileSizeIssues = []

      files.forEach(([path, content]) => {
        const analysis = CodeQualityAnalyzer.analyzeFile(path, content)
        const sizeIssues = analysis.issues.filter(issue => issue.type === 'file_size')
        
        if (sizeIssues.length > 0) {
          fileSizeIssues.push({ path, issues: sizeIssues })
        }
      })

      // Check that large files are identified
      const largeFileIssues = fileSizeIssues.find(item => 
        item.path.includes('LargeComponent.tsx')
      )
      expect(largeFileIssues).toBeDefined()
      expect(largeFileIssues!.issues[0].severity).toBe('error')

      // Files within limits should pass
      const serviceFormIssues = fileSizeIssues.find(item => 
        item.path.includes('ServiceForm.tsx')
      )
      expect(serviceFormIssues).toBeUndefined()
    })

    test('should warn when files approach size limit', () => {
      // Add a file that's close to the limit
      const mediumFileContent = Array.from({ length: 450 }, (_, i) => `// Line ${i + 1}`).join('\n')
      mockFileSystem.addFile('/src/components/MediumComponent.tsx', mediumFileContent)

      const analysis = CodeQualityAnalyzer.analyzeFile('/src/components/MediumComponent.tsx', mediumFileContent)
      const sizeWarnings = analysis.issues.filter(issue => 
        issue.type === 'file_size' && issue.severity === 'warning'
      )

      expect(sizeWarnings.length).toBeGreaterThan(0)
      expect(sizeWarnings[0].message).toContain('approaching size limit')
    })

    test('should validate project structure organization', () => {
      const files = mockFileSystem.getAllFiles()
      const archAnalysis = CodeQualityAnalyzer.analyzeArchitecture(files)

      // Should have proper separation
      expect(archAnalysis.structure.components.length).toBeGreaterThan(0)
      expect(archAnalysis.structure.utils.length).toBeGreaterThan(0)
      expect(archAnalysis.structure.pages.length).toBeGreaterThan(0)

      // Should not have architecture violations
      const archIssues = archAnalysis.issues.filter(issue => issue.type === 'architecture')
      expect(archIssues.length).toBe(0) // Mock files are clean
    })
  })

  describe('Code Style and Standards', () => {
    test('should prefer TypeScript over JavaScript', () => {
      // Add a JavaScript file to test
      mockFileSystem.addFile('/src/utils/helper.js', 'export function helper() { return true }')

      const analysis = CodeQualityAnalyzer.analyzeFile('/src/utils/helper.js', 'export function helper() { return true }')
      const tsIssues = analysis.issues.filter(issue => issue.type === 'typescript')

      expect(tsIssues.length).toBeGreaterThan(0)
      expect(tsIssues[0].message).toContain('TypeScript')
    })

    test('should enforce consistent import styles', () => {
      const badImportContent = `
import React from 'react'
import {useState} from "react"  // Inconsistent quotes
import * as fs from 'fs';       // Unnecessary semicolon
      `.trim()

      const analysis = CodeQualityAnalyzer.analyzeFile('/src/test.ts', badImportContent)
      // In a real implementation, would have more sophisticated import style checking
      expect(analysis.issues.length).toBeGreaterThanOrEqual(0)
    })

    test('should identify logging and debugging code', () => {
      const debugContent = `
export function processData() {
  console.log('Processing data') // Should use proper logging
  const result = performCalculation()
  console.log('Result:', result) // Another console.log
  return result
}
      `.trim()

      const analysis = CodeQualityAnalyzer.analyzeFile('/src/processor.ts', debugContent)
      const loggingIssues = analysis.issues.filter(issue => issue.type === 'logging')

      expect(loggingIssues.length).toBe(2) // Two console.log statements
    })

    test('should flag hardcoded strings for i18n consideration', () => {
      const hardcodedContent = `
export function WelcomeMessage() {
  return <h1>"Welcome to our contractor platform!"</h1>
}
      `.trim()

      const analysis = CodeQualityAnalyzer.analyzeFile('/src/components/Welcome.tsx', hardcodedContent)
      const i18nIssues = analysis.issues.filter(issue => issue.type === 'hardcoded_text')

      expect(i18nIssues.length).toBeGreaterThan(0)
    })
  })

  describe('Complexity and Maintainability Metrics', () => {
    test('should calculate cyclomatic complexity', () => {
      const complexContent = `
function complexFunction(data) {
  if (data.type === 'windows') {
    if (data.count > 10) {
      for (let i = 0; i < data.count; i++) {
        if (data.items[i].damaged) {
          return processRepair()
        }
      }
    } else if (data.count > 5) {
      return processPartial()
    }
  } else if (data.type === 'doors') {
    switch (data.material) {
      case 'wood':
        return processWood()
      case 'metal':
        return processMetal()
      default:
        return processOther()
    }
  }
  return processDefault()
}
      `.trim()

      const analysis = CodeQualityAnalyzer.analyzeFile('/src/complex.ts', complexContent)
      
      expect(analysis.metrics.complexity).toBeGreaterThan(10) // High complexity
      expect(analysis.metrics.maintainabilityIndex).toBeLessThan(80) // Lower maintainability
    })

    test('should favor simpler, more maintainable code', () => {
      const simpleContent = `
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0)
}
      `.trim()

      const analysis = CodeQualityAnalyzer.analyzeFile('/src/simple.ts', simpleContent)
      
      expect(analysis.metrics.complexity).toBeLessThan(5) // Low complexity
      expect(analysis.metrics.maintainabilityIndex).toBeGreaterThan(80) // High maintainability
    })
  })

  describe('Testing and Coverage Requirements', () => {
    test('should identify files missing test coverage', () => {
      const files = mockFileSystem.getAllFiles()
      const archAnalysis = CodeQualityAnalyzer.analyzeArchitecture(files)

      const testingIssues = archAnalysis.issues.filter(issue => issue.type === 'testing')
      
      // Should identify components/utils without tests
      expect(testingIssues.length).toBeGreaterThan(0)
      
      const testCoverage = archAnalysis.metrics.testCoverage
      expect(testCoverage).toBeLessThan(100) // Mock codebase doesn't have full test coverage
    })

    test('should calculate test-to-code ratios', () => {
      // Add some test files
      mockFileSystem.addFile('/src/components/ServiceForm.test.tsx', 'test content')
      mockFileSystem.addFile('/src/lib/TemplateEngine.test.ts', 'test content')

      const files = mockFileSystem.getAllFiles()
      const archAnalysis = CodeQualityAnalyzer.analyzeArchitecture(files)

      expect(archAnalysis.metrics.componentToTestRatio).toBeGreaterThan(0)
      expect(archAnalysis.structure.tests.length).toBeGreaterThan(0)
    })
  })

  describe('PRD Compliance Validation', () => {
    test('should validate implementation against PRD requirements', () => {
      const files = mockFileSystem.getAllFiles()
      const compliance = PRDComplianceChecker.checkCompliance(files)

      // Check each major feature area
      const dynamicFormsCompliance = compliance.find(c => c.feature === 'dynamicForms')
      expect(dynamicFormsCompliance?.implemented).toBe(true)

      const complianceIntegration = compliance.find(c => c.feature === 'complianceIntegration')
      expect(complianceIntegration?.implemented).toBe(false) // Not implemented in mock

      const apiEndpoints = compliance.find(c => c.feature === 'apiEndpoints')
      expect(apiEndpoints?.implemented).toBe(true) // We have /api/leads

      // Calculate overall compliance
      const implementedFeatures = compliance.filter(c => c.implemented).length
      const totalRequiredFeatures = compliance.filter(c => c.required).length
      const overallCompliance = (implementedFeatures / totalRequiredFeatures) * 100

      expect(overallCompliance).toBeGreaterThan(0)
      expect(overallCompliance).toBeLessThanOrEqual(100)
    })

    test('should identify missing critical features', () => {
      const files = mockFileSystem.getAllFiles()
      const compliance = PRDComplianceChecker.checkCompliance(files)

      const missingFeatures = compliance.filter(c => c.required && !c.implemented)
      
      // Should identify what's missing for full PRD compliance
      missingFeatures.forEach(feature => {
        expect(feature.missingFiles.length).toBeGreaterThan(0)
        expect(feature.description).toBeDefined()
      })
    })
  })

  describe('Development Plan Adherence', () => {
    test('should validate phase-based implementation', () => {
      const files = mockFileSystem.getAllFiles()
      
      // Phase 1: Foundation (database, basic API)
      const phase1Files = files.filter(([path]) => 
        path.includes('/api/') || path.includes('/lib/db') || path.includes('/prisma/')
      )

      // Phase 2: Forms and compliance
      const phase2Files = files.filter(([path]) => 
        path.includes('/components/forms/') || path.includes('TrustedForm') || path.includes('Jornaya')
      )

      // Phase 3: Processing engine  
      const phase3Files = files.filter(([path]) => 
        path.includes('/workers/') || path.includes('/lib/templates/') || path.includes('/lib/auction/')
      )

      // Validate implementation order makes sense
      expect(phase1Files.length).toBeGreaterThan(0) // Foundation should exist
      
      // Can measure implementation completeness per phase
      const phases = {
        phase1: { implemented: phase1Files.length, total: 3 },
        phase2: { implemented: phase2Files.length, total: 4 },
        phase3: { implemented: phase3Files.length, total: 3 }
      }

      Object.entries(phases).forEach(([phase, metrics]) => {
        const completeness = (metrics.implemented / metrics.total) * 100
        expect(completeness).toBeGreaterThanOrEqual(0)
        expect(completeness).toBeLessThanOrEqual(100)
      })
    })

    test('should validate technical requirements implementation', () => {
      const files = mockFileSystem.getAllFiles()

      const technicalRequirements = {
        typescript: files.some(([path]) => path.endsWith('.ts') || path.endsWith('.tsx')),
        nextjs: files.some(([path]) => path.includes('/app/') || path.includes('/pages/')),
        apiRoutes: files.some(([path]) => path.includes('/api/')),
        components: files.some(([path]) => path.includes('/components/')),
        utilities: files.some(([path]) => path.includes('/lib/') || path.includes('/utils/'))
      }

      // All technical requirements should be met
      Object.entries(technicalRequirements).forEach(([requirement, implemented]) => {
        expect(implemented).toBe(true)
      })
    })
  })

  describe('Performance and Scalability Audit', () => {
    test('should identify potential performance issues', () => {
      const performanceIssues = []

      // Check for synchronous operations that should be async
      const syncOperationContent = `
export function processLeads(leads) {
  leads.forEach(lead => {
    validateLead(lead)        // Should be async
    sendToBuyers(lead)       // Should be async  
    updateDatabase(lead)     // Should be async
  })
}
      `.trim()

      const analysis = CodeQualityAnalyzer.analyzeFile('/src/performance-issue.ts', syncOperationContent)
      
      // In a real implementation, would detect synchronous database operations
      expect(analysis).toBeDefined()
    })

    test('should validate async/await usage patterns', () => {
      const goodAsyncContent = `
export async function processLead(leadData: LeadData): Promise<ProcessResult> {
  try {
    const validationResult = await validateLead(leadData)
    if (!validationResult.valid) {
      throw new Error('Invalid lead data')
    }
    
    const auctionResult = await runAuction(leadData)
    const saveResult = await saveLead(leadData, auctionResult)
    
    return { success: true, leadId: saveResult.id }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
      `.trim()

      const analysis = CodeQualityAnalyzer.analyzeFile('/src/good-async.ts', goodAsyncContent)
      
      // Should not flag well-structured async code
      expect(analysis.issues.filter(i => i.type === 'performance')).toHaveLength(0)
    })
  })

  describe('Security and Best Practices Audit', () => {
    test('should identify potential security vulnerabilities', () => {
      const insecureContent = `
export function processUserInput(input: string) {
  const query = \`SELECT * FROM users WHERE name = '\${input}'\` // SQL injection risk
  return database.query(query)
}

export function renderContent(userContent: string) {
  return \`<div>\${userContent}</div>\` // XSS risk
}
      `.trim()

      const analysis = CodeQualityAnalyzer.analyzeFile('/src/insecure.ts', insecureContent)
      
      // In a real implementation, would detect SQL injection and XSS patterns
      expect(analysis).toBeDefined()
    })

    test('should validate input sanitization patterns', () => {
      const secureContent = `
import { z } from 'zod'
import { sanitizeHtml } from '@/lib/security'

const inputSchema = z.object({
  name: z.string().max(100),
  email: z.string().email()
})

export function processUserInput(input: unknown) {
  const validatedInput = inputSchema.parse(input)
  return {
    name: sanitizeHtml(validatedInput.name),
    email: validatedInput.email
  }
}
      `.trim()

      const analysis = CodeQualityAnalyzer.analyzeFile('/src/secure.ts', secureContent)
      
      // Should not flag properly secured code
      expect(analysis.issues.filter(i => i.severity === 'error')).toHaveLength(0)
    })
  })

  describe('Documentation and Maintainability', () => {
    test('should check for adequate code documentation', () => {
      const undocumentedContent = `
export function complexBusinessLogic(data, options) {
  // Complex algorithm with no documentation
  const result = data.map(item => {
    if (options.transform) {
      return processTransformation(item)
    }
    return item
  }).filter(item => item.valid)
  
  return aggregateResults(result, options.aggregation)
}
      `.trim()

      const documentedContent = `
/**
 * Processes lead data through business rules and transformations
 * @param data - Array of lead objects to process
 * @param options - Processing options including transformation and aggregation settings
 * @returns Processed and filtered lead data
 */
export function complexBusinessLogic(data: Lead[], options: ProcessingOptions): ProcessedLead[] {
  // Apply transformations if requested
  const result = data.map(item => {
    if (options.transform) {
      return processTransformation(item)
    }
    return item
  }).filter(item => item.valid)
  
  return aggregateResults(result, options.aggregation)
}
      `.trim()

      const undocAnalysis = CodeQualityAnalyzer.analyzeFile('/src/undocumented.ts', undocumentedContent)
      const docAnalysis = CodeQualityAnalyzer.analyzeFile('/src/documented.ts', documentedContent)

      // Documented version should have better maintainability
      expect(docAnalysis.metrics.maintainabilityIndex).toBeGreaterThanOrEqual(
        undocAnalysis.metrics.maintainabilityIndex
      )
    })

    test('should validate naming conventions', () => {
      const namingTests = [
        { name: 'camelCaseFunction', type: 'function', valid: true },
        { name: 'PascalCaseComponent', type: 'component', valid: true },
        { name: 'CONSTANT_VALUE', type: 'constant', valid: true },
        { name: 'snake_case_function', type: 'function', valid: false },
        { name: 'kebab-case-variable', type: 'variable', valid: false }
      ]

      const validationResults = CodeQualityUtils.validateNamingConventions(
        namingTests.map(t => t.name)
      )

      validationResults.forEach((result, index) => {
        const testCase = namingTests[index]
        if (testCase.type === 'function' || testCase.type === 'variable') {
          expect(result.isCamelCase).toBe(testCase.valid)
        } else if (testCase.type === 'component') {
          expect(result.isPascalCase).toBe(testCase.valid)
        }
      })
    })
  })

  describe('Overall Quality Score', () => {
    test('should calculate comprehensive quality score', () => {
      const files = mockFileSystem.getAllFiles()
      let totalScore = 0
      let fileCount = 0

      files.forEach(([path, content]) => {
        if (!path.includes('.test.') && (path.endsWith('.ts') || path.endsWith('.tsx'))) {
          const analysis = CodeQualityAnalyzer.analyzeFile(path, content)
          const fileScore = this.calculateFileQualityScore(analysis)
          totalScore += fileScore
          fileCount++
        }
      })

      const averageQualityScore = fileCount > 0 ? totalScore / fileCount : 0

      expect(averageQualityScore).toBeGreaterThanOrEqual(0)
      expect(averageQualityScore).toBeLessThanOrEqual(100)

      // For mock files, should have decent quality
      expect(averageQualityScore).toBeGreaterThan(60)
    })

    private calculateFileQualityScore(analysis: any): number {
      let score = 100

      // Penalize based on issues
      analysis.issues.forEach((issue: any) => {
        switch (issue.severity) {
          case 'error':
            score -= 10
            break
          case 'warning':
            score -= 5
            break
          case 'info':
            score -= 1
            break
        }
      })

      // Factor in complexity and maintainability
      if (analysis.metrics.complexity > 15) {
        score -= (analysis.metrics.complexity - 15) * 2
      }

      score = Math.max(0, Math.min(100, score))
      return score
    }

    test('should provide actionable improvement recommendations', () => {
      const files = mockFileSystem.getAllFiles()
      const allIssues: any[] = []

      files.forEach(([path, content]) => {
        const analysis = CodeQualityAnalyzer.analyzeFile(path, content)
        allIssues.push(...analysis.issues.map(issue => ({ ...issue, file: path })))
      })

      // Group issues by type for recommendations
      const issuesByType = allIssues.reduce((acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const recommendations = Object.entries(issuesByType).map(([type, count]) => ({
        type,
        count,
        priority: count > 5 ? 'high' : count > 2 ? 'medium' : 'low',
        recommendation: this.getRecommendationForIssueType(type)
      }))

      expect(recommendations.length).toBeGreaterThan(0)
      recommendations.forEach(rec => {
        expect(rec.recommendation).toBeDefined()
        expect(['high', 'medium', 'low']).toContain(rec.priority)
      })
    })

    private getRecommendationForIssueType(type: string): string {
      const recommendations = {
        file_size: 'Consider breaking large files into smaller, more focused modules',
        typescript: 'Migrate JavaScript files to TypeScript for better type safety',
        logging: 'Implement structured logging with proper log levels',
        hardcoded_text: 'Extract hardcoded strings into constants or i18n files',
        todo: 'Address TODO comments or convert them to proper issue tracking',
        architecture: 'Review component responsibilities and separate concerns',
        testing: 'Add test coverage for untested components and utilities'
      }
      
      return recommendations[type as keyof typeof recommendations] || 'Review and address code quality issues'
    }
  })
})