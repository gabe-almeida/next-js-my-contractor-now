'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { BuyerType } from '@/types/database';
import ServiceLocationQuizSimple from '@/components/contractor-signup/ServiceLocationQuizSimple';

interface ServiceType {
  id: string;
  name: string;
  displayName: string;
  category: 'construction' | 'repair' | 'maintenance' | 'installation';
  description: string;
  icon: string;
}

interface Location {
  id: string;
  type: 'city' | 'state' | 'county' | 'zipcode';
  name: string;
  displayName: string;
  state?: string;
}

interface ServiceLocationMapping {
  serviceId: string;
  locations: Location[];
}

interface AdditionalContact {
  name: string;
  email: string;
  phone: string;
  role: string;
}

interface ContractorSignupForm {
  // Personal Contact
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  
  // Company Information
  companyName: string;
  businessEmail: string;
  businessPhone: string;
  
  // Additional Contacts
  additionalContacts: AdditionalContact[];
  
  // Service Configuration
  selectedServices: ServiceType[];
  serviceLocationMappings: ServiceLocationMapping[];
}

export default function ContractorsSignupPage() {
  const [currentStep, setCurrentStep] = useState<'basic' | 'services' | 'complete'>('basic');
  const [formData, setFormData] = useState<ContractorSignupForm>({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    companyName: '',
    businessEmail: '',
    businessPhone: '',
    additionalContacts: [],
    selectedServices: [],
    serviceLocationMappings: []
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBasicInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required fields
    if (formData.contactName && formData.contactEmail && formData.contactPhone && formData.companyName && formData.businessEmail && formData.businessPhone) {
      setCurrentStep('services');
    }
  };

  const addAdditionalContact = () => {
    setFormData(prev => ({
      ...prev,
      additionalContacts: [...prev.additionalContacts, { name: '', email: '', phone: '', role: '' }]
    }));
  };

  const updateAdditionalContact = (index: number, field: keyof AdditionalContact, value: string) => {
    setFormData(prev => ({
      ...prev,
      additionalContacts: prev.additionalContacts.map((contact, i) => 
        i === index ? { ...contact, [field]: value } : contact
      )
    }));
  };

  const removeAdditionalContact = (index: number) => {
    setFormData(prev => ({
      ...prev,
      additionalContacts: prev.additionalContacts.filter((_, i) => i !== index)
    }));
  };

  const handleServiceLocationComplete = (data: {
    selectedServices: ServiceType[];
    serviceLocationMappings: ServiceLocationMapping[];
  }) => {
    setFormData(prev => ({
      ...prev,
      selectedServices: data.selectedServices,
      serviceLocationMappings: data.serviceLocationMappings
    }));
    setCurrentStep('complete');
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/contractors/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          type: BuyerType.CONTRACTOR // Automatically set as CONTRACTOR type
        }),
      });

      if (response.ok) {
        setSubmitStatus('success');
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStepSave = (stepId: string, data: any) => {
    console.log(`Step ${stepId} saved:`, data);
  };

  // Step indicator
  const stepNumber = currentStep === 'basic' ? 1 : currentStep === 'services' ? 2 : 3;
  const totalSteps = 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className={currentStep === 'services' ? 'max-w-6xl mx-auto' : 'max-w-2xl mx-auto'}>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Join Our Contractor Network
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Become a Lead Buyer and start receiving high-quality leads for your contracting business.
          </p>
          
          {/* Step Progress Indicator */}
          <div className="flex justify-center mt-6">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step <= stepNumber
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-12 h-0.5 ${
                      step < stepNumber ? 'bg-blue-600' : 'bg-gray-200'
                    }`}></div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="text-sm text-gray-500 mt-2">
            Step {stepNumber} of {totalSteps}: {
              currentStep === 'basic' ? 'Basic Information' :
              currentStep === 'services' ? 'Service Areas' :
              'Complete Registration'
            }
          </div>
        </div>

        {/* Step 1: Basic Information */}
        {currentStep === 'basic' && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Tell us about yourself and your contracting business
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBasicInfoSubmit} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactName">Full Name *</Label>
                    <Input
                      id="contactName"
                      name="contactName"
                      type="text"
                      required
                      value={formData.contactName}
                      onChange={handleInputChange}
                      placeholder="John Smith"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="contactEmail">Personal Email *</Label>
                    <Input
                      id="contactEmail"
                      name="contactEmail"
                      type="email"
                      required
                      value={formData.contactEmail}
                      onChange={handleInputChange}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="contactPhone">Personal Phone *</Label>
                  <Input
                    id="contactPhone"
                    name="contactPhone"
                    type="tel"
                    required
                    value={formData.contactPhone}
                    onChange={handleInputChange}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              {/* Business Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Business Information</h3>
                
                <div>
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    name="companyName"
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={handleInputChange}
                    placeholder="ABC Contracting LLC"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="businessEmail">Business Email *</Label>
                    <Input
                      id="businessEmail"
                      name="businessEmail"
                      type="email"
                      required
                      value={formData.businessEmail}
                      onChange={handleInputChange}
                      placeholder="info@abccontracting.com"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="businessPhone">Business Phone *</Label>
                    <Input
                      id="businessPhone"
                      name="businessPhone"
                      type="tel"
                      required
                      value={formData.businessPhone}
                      onChange={handleInputChange}
                      placeholder="(555) 987-6543"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Contacts */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Additional Contacts</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addAdditionalContact}>
                    Add Contact
                  </Button>
                </div>
                <p className="text-sm text-gray-600">
                  Add additional team members who should receive leads or be contacted about your account.
                </p>
                
                {formData.additionalContacts.map((contact, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-gray-900">Contact {index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAdditionalContact(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`contact-name-${index}`}>Name</Label>
                        <Input
                          id={`contact-name-${index}`}
                          type="text"
                          value={contact.name}
                          onChange={(e) => updateAdditionalContact(index, 'name', e.target.value)}
                          placeholder="Contact Name"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`contact-role-${index}`}>Role</Label>
                        <Input
                          id={`contact-role-${index}`}
                          type="text"
                          value={contact.role}
                          onChange={(e) => updateAdditionalContact(index, 'role', e.target.value)}
                          placeholder="Project Manager, Owner, etc."
                        />
                      </div>
                      <div>
                        <Label htmlFor={`contact-email-${index}`}>Email</Label>
                        <Input
                          id={`contact-email-${index}`}
                          type="email"
                          value={contact.email}
                          onChange={(e) => updateAdditionalContact(index, 'email', e.target.value)}
                          placeholder="contact@company.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`contact-phone-${index}`}>Phone</Label>
                        <Input
                          id={`contact-phone-${index}`}
                          type="tel"
                          value={contact.phone}
                          onChange={(e) => updateAdditionalContact(index, 'phone', e.target.value)}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Status Messages */}
              {submitStatus === 'success' && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md">
                  <p className="font-medium">Registration Successful!</p>
                  <p className="text-sm">Thank you for joining our contractor network. We'll review your application and contact you within 1-2 business days.</p>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
                  <p className="font-medium">Registration Failed</p>
                  <p className="text-sm">There was an error processing your registration. Please try again or contact support.</p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
              >
                Continue to Service Areas
              </Button>
              
              <p className="text-xs text-gray-500 text-center">
                Next: Configure your service offerings and coverage areas
              </p>
            </form>
          </CardContent>
        </Card>
        )}

        {/* Step 2: Service Location Quiz */}
        {currentStep === 'services' && (
          <ServiceLocationQuizSimple
            onComplete={handleServiceLocationComplete}
            onStepSave={handleStepSave}
          />
        )}

        {/* Step 3: Complete Registration */}
        {currentStep === 'complete' && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Complete Registration</CardTitle>
              <CardDescription>
                Review your information and complete your contractor registration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Registration Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Contact:</span> {formData.contactName}
                  </div>
                  <div>
                    <span className="font-medium">Personal Email:</span> {formData.contactEmail}
                  </div>
                  <div>
                    <span className="font-medium">Company:</span> {formData.companyName}
                  </div>
                  <div>
                    <span className="font-medium">Business Email:</span> {formData.businessEmail}
                  </div>
                  <div>
                    <span className="font-medium">Services:</span> {formData.selectedServices.length} selected
                  </div>
                  <div>
                    <span className="font-medium">Coverage Areas:</span> {formData.serviceLocationMappings.reduce((sum, mapping) => sum + mapping.locations.length, 0)} locations
                  </div>
                </div>
              </div>

              {/* Status Messages */}
              {submitStatus === 'success' && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md">
                  <p className="font-medium">Registration Successful!</p>
                  <p className="text-sm">Thank you for joining our contractor network. We'll review your application and contact you within 1-2 business days.</p>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
                  <p className="font-medium">Registration Failed</p>
                  <p className="text-sm">There was an error processing your registration. Please try again or contact support.</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('services')}
                  className="flex-1"
                >
                  Back to Service Areas
                </Button>
                <Button
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="flex-1"
                  size="lg"
                >
                  {isSubmitting ? 'Submitting...' : 'Complete Registration'}
                </Button>
              </div>
              
              <p className="text-xs text-gray-500 text-center">
                By registering, you agree to our terms of service and privacy policy.
                Our team will review your application and contact you to complete the setup process.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}