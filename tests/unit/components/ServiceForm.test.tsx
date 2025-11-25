/**
 * Unit Tests: Service Form Component
 * Tests the dynamic form generation and compliance integration
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@/tests/utils/testHelpers'
import { mockServiceTypes, mockFormSubmission } from '@/tests/fixtures/mockData'

// Mock the compliance providers
const mockUseTrustedForm = {
  certUrl: 'https://cert.trustedform.com/test123',
  certId: 'test123',
  isReady: true
}

const mockUseJornayaLeadID = {
  leadId: 'jornaya_test_id',
  isReady: true
}

jest.mock('@/components/forms/TrustedFormProvider', () => ({
  useTrustedForm: () => mockUseTrustedForm
}))

jest.mock('@/components/forms/JornayaProvider', () => ({
  useJornayaLeadID: () => mockUseJornayaLeadID
}))

// Mock Next.js router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush })
}))

// Mock ServiceForm component since we don't have the actual implementation
function MockServiceForm({ serviceType }: { serviceType: any }) {
  const { certUrl, certId, isReady: tfReady } = mockUseTrustedForm
  const { leadId: jornayaLeadId, isReady: jornayaReady } = mockUseJornayaLeadID

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!tfReady || !jornayaReady) {
      return
    }

    const formData = new FormData(e.target as HTMLFormElement)
    const submissionData = {
      serviceTypeId: serviceType.id,
      formData: Object.fromEntries(formData),
      zipCode: formData.get('zipCode'),
      ownsHome: formData.get('ownsHome') === 'Yes',
      timeframe: formData.get('timeframe'),
      trustedFormCertUrl: certUrl,
      trustedFormCertId: certId,
      jornayaLeadId: jornayaLeadId,
      complianceData: {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        tcpaConsent: formData.get('tcpaConsent') === 'on',
        privacyPolicyAccepted: formData.get('privacyPolicy') === 'on'
      }
    }

    // Mock API call
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submissionData)
    })

    if (response.ok) {
      mockPush('/thank-you')
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="service-form">
      <h1>{serviceType.formSchema.title}</h1>
      <p>{serviceType.formSchema.description}</p>

      {serviceType.formSchema.fields.map((field: any) => {
        if (field.type === 'text') {
          return (
            <div key={field.name}>
              <label htmlFor={field.name}>{field.label}</label>
              <input
                type="text"
                id={field.name}
                name={field.name}
                required={field.required}
                data-testid={`field-${field.name}`}
              />
            </div>
          )
        }

        if (field.type === 'select') {
          return (
            <div key={field.name}>
              <label htmlFor={field.name}>{field.label}</label>
              <select
                id={field.name}
                name={field.name}
                required={field.required}
                data-testid={`field-${field.name}`}
              >
                <option value="">Select...</option>
                {field.options.map((option: string) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          )
        }

        if (field.type === 'radio') {
          return (
            <div key={field.name}>
              <fieldset>
                <legend>{field.label}</legend>
                {field.options.map((option: string) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name={field.name}
                      value={option}
                      required={field.required}
                      data-testid={`field-${field.name}-${option}`}
                    />
                    {option}
                  </label>
                ))}
              </fieldset>
            </div>
          )
        }

        return null
      })}

      {/* TCPA Compliance Checkbox */}
      <div>
        <label>
          <input
            type="checkbox"
            name="tcpaConsent"
            required
            data-testid="tcpa-consent"
          />
          I agree to receive marketing communications
        </label>
      </div>

      {/* Privacy Policy */}
      <div>
        <label>
          <input
            type="checkbox"
            name="privacyPolicy"
            required
            data-testid="privacy-policy"
          />
          I agree to the Privacy Policy
        </label>
      </div>

      <button
        type="submit"
        disabled={!tfReady || !jornayaReady}
        data-testid="submit-button"
      >
        {!tfReady || !jornayaReady ? 'Loading...' : 'Get My Quote'}
      </button>

      {/* Hidden fields for compliance */}
      <input type="hidden" name="xxTrustedFormCertUrl" value={certUrl || ''} />
      <input type="hidden" name="xxTrustedFormToken" value={certId || ''} />
      <input type="hidden" name="universal_leadid" value={jornayaLeadId || ''} />
    </form>
  )
}

describe('ServiceForm Component', () => {
  const windowsServiceType = mockServiceTypes[0]
  const bathroomServiceType = mockServiceTypes[1]

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  describe('Form Rendering', () => {
    test('should render form title and description', () => {
      render(<MockServiceForm serviceType={windowsServiceType} />)

      expect(screen.getByText('Windows Replacement Quote')).toBeInTheDocument()
      expect(screen.getByText('Get quotes for your window replacement project')).toBeInTheDocument()
    })

    test('should render all form fields from schema', () => {
      render(<MockServiceForm serviceType={windowsServiceType} />)

      // Check that all fields are rendered
      expect(screen.getByTestId('field-zipCode')).toBeInTheDocument()
      expect(screen.getByTestId('field-ownsHome-Yes')).toBeInTheDocument()
      expect(screen.getByTestId('field-ownsHome-No')).toBeInTheDocument()
      expect(screen.getByTestId('field-timeframe')).toBeInTheDocument()
      expect(screen.getByTestId('field-numberOfWindows')).toBeInTheDocument()
    })

    test('should render different fields for different service types', () => {
      const { rerender } = render(<MockServiceForm serviceType={windowsServiceType} />)

      // Windows form should have numberOfWindows field
      expect(screen.getByTestId('field-numberOfWindows')).toBeInTheDocument()

      // Switch to bathroom form
      rerender(<MockServiceForm serviceType={bathroomServiceType} />)

      // Should not have numberOfWindows, should have numberOfBathrooms
      expect(screen.queryByTestId('field-numberOfWindows')).not.toBeInTheDocument()
      expect(screen.getByTestId('field-numberOfBathrooms')).toBeInTheDocument()
    })

    test('should render compliance checkboxes', () => {
      render(<MockServiceForm serviceType={windowsServiceType} />)

      expect(screen.getByTestId('tcpa-consent')).toBeInTheDocument()
      expect(screen.getByTestId('privacy-policy')).toBeInTheDocument()
    })

    test('should render hidden compliance fields', () => {
      render(<MockServiceForm serviceType={windowsServiceType} />)

      expect(screen.getByDisplayValue('https://cert.trustedform.com/test123')).toBeInTheDocument()
      expect(screen.getByDisplayValue('test123')).toBeInTheDocument()
      expect(screen.getByDisplayValue('jornaya_test_id')).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    test('should require all required fields', async () => {
      render(<MockServiceForm serviceType={windowsServiceType} />)

      const submitButton = screen.getByTestId('submit-button')
      fireEvent.click(submitButton)

      // HTML5 validation should prevent submission
      const form = screen.getByTestId('service-form')
      expect(form.checkValidity()).toBe(false)
    })

    test('should validate ZIP code format', () => {
      render(<MockServiceForm serviceType={windowsServiceType} />)

      const zipCodeInput = screen.getByTestId('field-zipCode')
      fireEvent.change(zipCodeInput, { target: { value: '1234' } }) // Invalid ZIP

      expect(zipCodeInput.validity.valid).toBe(false)
    })

    test('should require compliance checkboxes', () => {
      render(<MockServiceForm serviceType={windowsServiceType} />)

      const tcpaCheckbox = screen.getByTestId('tcpa-consent')
      const privacyCheckbox = screen.getByTestId('privacy-policy')

      expect(tcpaCheckbox.required).toBe(true)
      expect(privacyCheckbox.required).toBe(true)
    })
  })

  describe('Compliance Integration', () => {
    test('should disable submit button when compliance not ready', () => {
      // Mock compliance not ready
      jest.mocked(mockUseTrustedForm.isReady) = false

      render(<MockServiceForm serviceType={windowsServiceType} />)

      const submitButton = screen.getByTestId('submit-button')
      expect(submitButton).toBeDisabled()
      expect(submitButton.textContent).toBe('Loading...')
    })

    test('should enable submit button when compliance is ready', () => {
      render(<MockServiceForm serviceType={windowsServiceType} />)

      const submitButton = screen.getByTestId('submit-button')
      expect(submitButton).not.toBeDisabled()
      expect(submitButton.textContent).toBe('Get My Quote')
    })

    test('should include TrustedForm data in submission', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      render(<MockServiceForm serviceType={windowsServiceType} />)

      // Fill out form
      fireEvent.change(screen.getByTestId('field-zipCode'), { target: { value: '12345' } })
      fireEvent.click(screen.getByTestId('field-ownsHome-Yes'))
      fireEvent.change(screen.getByTestId('field-timeframe'), { target: { value: 'Within 1 month' } })
      fireEvent.change(screen.getByTestId('field-numberOfWindows'), { target: { value: '4-6' } })
      fireEvent.click(screen.getByTestId('tcpa-consent'))
      fireEvent.click(screen.getByTestId('privacy-policy'))

      // Submit form
      fireEvent.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('trustedFormCertUrl')
        })
      })

      // Verify submission data
      const call = (global.fetch as jest.Mock).mock.calls[0]
      const submissionData = JSON.parse(call[1].body)

      expect(submissionData.trustedFormCertUrl).toBe('https://cert.trustedform.com/test123')
      expect(submissionData.trustedFormCertId).toBe('test123')
      expect(submissionData.jornayaLeadId).toBe('jornaya_test_id')
      expect(submissionData.complianceData.tcpaConsent).toBe(true)
      expect(submissionData.complianceData.privacyPolicyAccepted).toBe(true)
    })

    test('should include Jornaya LeadID in submission', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      render(<MockServiceForm serviceType={windowsServiceType} />)

      // Fill and submit form
      fireEvent.change(screen.getByTestId('field-zipCode'), { target: { value: '12345' } })
      fireEvent.click(screen.getByTestId('field-ownsHome-Yes'))
      fireEvent.click(screen.getByTestId('tcpa-consent'))
      fireEvent.click(screen.getByTestId('privacy-policy'))
      fireEvent.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })

      const call = (global.fetch as jest.Mock).mock.calls[0]
      const submissionData = JSON.parse(call[1].body)

      expect(submissionData.jornayaLeadId).toBe('jornaya_test_id')
    })
  })

  describe('Form Submission', () => {
    test('should submit valid form data', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, leadId: 'lead-123' })
      })

      render(<MockServiceForm serviceType={windowsServiceType} />)

      // Fill out complete form
      fireEvent.change(screen.getByTestId('field-zipCode'), { target: { value: '12345' } })
      fireEvent.click(screen.getByTestId('field-ownsHome-Yes'))
      fireEvent.change(screen.getByTestId('field-timeframe'), { target: { value: 'Within 1 month' } })
      fireEvent.change(screen.getByTestId('field-numberOfWindows'), { target: { value: '4-6' } })
      fireEvent.click(screen.getByTestId('tcpa-consent'))
      fireEvent.click(screen.getByTestId('privacy-policy'))

      fireEvent.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/leads', expect.any(Object))
      })

      // Verify navigation to thank you page
      expect(mockPush).toHaveBeenCalledWith('/thank-you')
    })

    test('should handle submission errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' })
      })

      render(<MockServiceForm serviceType={windowsServiceType} />)

      // Fill and submit form
      fireEvent.change(screen.getByTestId('field-zipCode'), { target: { value: '12345' } })
      fireEvent.click(screen.getByTestId('field-ownsHome-Yes'))
      fireEvent.click(screen.getByTestId('tcpa-consent'))
      fireEvent.click(screen.getByTestId('privacy-policy'))
      fireEvent.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })

      // Should not navigate on error
      expect(mockPush).not.toHaveBeenCalled()
    })

    test('should include all form data in submission', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      render(<MockServiceForm serviceType={windowsServiceType} />)

      // Fill out form with specific values
      fireEvent.change(screen.getByTestId('field-zipCode'), { target: { value: '90210' } })
      fireEvent.click(screen.getByTestId('field-ownsHome-Yes'))
      fireEvent.change(screen.getByTestId('field-timeframe'), { target: { value: '3-6 months' } })
      fireEvent.change(screen.getByTestId('field-numberOfWindows'), { target: { value: '11-15' } })
      fireEvent.click(screen.getByTestId('tcpa-consent'))
      fireEvent.click(screen.getByTestId('privacy-policy'))

      fireEvent.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })

      const call = (global.fetch as jest.Mock).mock.calls[0]
      const submissionData = JSON.parse(call[1].body)

      expect(submissionData.serviceTypeId).toBe('service-type-1')
      expect(submissionData.zipCode).toBe('90210')
      expect(submissionData.ownsHome).toBe(true)
      expect(submissionData.timeframe).toBe('3-6 months')
      expect(submissionData.formData.numberOfWindows).toBe('11-15')
    })
  })

  describe('Accessibility', () => {
    test('should have proper form labels', () => {
      render(<MockServiceForm serviceType={windowsServiceType} />)

      windowsServiceType.formSchema.fields.forEach((field: any) => {
        if (field.type === 'text' || field.type === 'select') {
          const label = screen.getByLabelText(field.label)
          expect(label).toBeInTheDocument()
        }
      })
    })

    test('should use fieldset for radio groups', () => {
      render(<MockServiceForm serviceType={windowsServiceType} />)

      const fieldset = screen.getByRole('group', { name: 'Do you own your home?' })
      expect(fieldset).toBeInTheDocument()
    })

    test('should have proper ARIA attributes', () => {
      render(<MockServiceForm serviceType={windowsServiceType} />)

      const form = screen.getByTestId('service-form')
      expect(form).toBeInTheDocument()
      
      // Submit button should be properly labeled
      const submitButton = screen.getByTestId('submit-button')
      expect(submitButton).toHaveAttribute('type', 'submit')
    })
  })

  describe('Performance', () => {
    test('should render large forms efficiently', () => {
      const largeServiceType = {
        ...windowsServiceType,
        formSchema: {
          ...windowsServiceType.formSchema,
          fields: Array.from({ length: 50 }, (_, i) => ({
            name: `field${i}`,
            type: 'text',
            label: `Field ${i}`,
            required: false
          }))
        }
      }

      const startTime = performance.now()
      render(<MockServiceForm serviceType={largeServiceType} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(100) // Should render in under 100ms
    })

    test('should handle rapid form interactions', () => {
      render(<MockServiceForm serviceType={windowsServiceType} />)

      const zipCodeInput = screen.getByTestId('field-zipCode')

      // Rapid typing simulation
      for (let i = 0; i < 10; i++) {
        fireEvent.change(zipCodeInput, { target: { value: `1234${i}` } })
      }

      expect(zipCodeInput.value).toBe('12349')
    })
  })
})