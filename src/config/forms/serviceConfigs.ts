import { FormConfig } from '@/types/forms';
import { conditionalHelpers } from '@/utils/forms/conditionals';

// Service type keys for form configs
type ServiceTypeKey = 'windows' | 'roofing' | 'bathrooms';

// Roofing service form configuration
export const roofingFormConfig: FormConfig = {
  id: 'roofing-lead-form',
  title: 'Get Your Free Roofing Quote',
  description: 'Connect with top-rated roofing contractors in your area',
  sections: [
    {
      id: 'project-details',
      title: 'Project Details',
      description: 'Tell us about your roofing project',
      fields: [
        {
          id: 'roofing-type',
          name: 'roofingType',
          type: 'select',
          label: 'Type of Roofing Work',
          required: true,
          options: [
            { value: 'repair', label: 'Roof Repair' },
            { value: 'replacement', label: 'Roof Replacement' },
            { value: 'installation', label: 'New Roof Installation' },
            { value: 'inspection', label: 'Roof Inspection' },
            { value: 'maintenance', label: 'Roof Maintenance' }
          ],
          gridColumn: 'col-span-2'
        },
        {
          id: 'roof-material',
          name: 'roofMaterial',
          type: 'select',
          label: 'Preferred Roofing Material',
          options: [
            { value: 'asphalt-shingles', label: 'Asphalt Shingles' },
            { value: 'metal', label: 'Metal Roofing' },
            { value: 'tile', label: 'Tile Roofing' },
            { value: 'slate', label: 'Slate' },
            { value: 'wood', label: 'Wood Shingles' },
            { value: 'unsure', label: 'Not Sure' }
          ]
        },
        {
          id: 'home-age',
          name: 'homeAge',
          type: 'select',
          label: 'Age of Home',
          options: [
            { value: '0-5', label: '0-5 years' },
            { value: '6-15', label: '6-15 years' },
            { value: '16-30', label: '16-30 years' },
            { value: '31-50', label: '31-50 years' },
            { value: '50+', label: 'Over 50 years' }
          ]
        },
        {
          id: 'roof-size',
          name: 'roofSize',
          type: 'select',
          label: 'Approximate Roof Size',
          options: [
            { value: 'small', label: 'Small (under 1,500 sq ft)' },
            { value: 'medium', label: 'Medium (1,500-3,000 sq ft)' },
            { value: 'large', label: 'Large (over 3,000 sq ft)' },
            { value: 'unsure', label: 'Not Sure' }
          ]
        },
        {
          id: 'urgency',
          name: 'urgency',
          type: 'radio',
          label: 'How urgent is this project?',
          required: true,
          options: [
            { value: 'emergency', label: 'Emergency (immediate)' },
            { value: 'urgent', label: 'Urgent (within 1-2 weeks)' },
            { value: 'soon', label: 'Soon (within 1-2 months)' },
            { value: 'planning', label: 'Planning ahead (3+ months)' }
          ],
          gridColumn: 'col-span-2'
        },
        {
          id: 'issues',
          name: 'issues',
          type: 'checkbox',
          label: 'Current Issues (if any)',
          options: [
            { value: 'leaks', label: 'Leaks or water damage' },
            { value: 'missing-shingles', label: 'Missing or damaged shingles' },
            { value: 'sagging', label: 'Sagging roof areas' },
            { value: 'ice-damage', label: 'Ice or storm damage' },
            { value: 'old-age', label: 'Roof is old and needs replacement' },
            { value: 'energy-efficiency', label: 'Poor energy efficiency' }
          ],
          gridColumn: 'col-span-2'
        }
      ]
    },
    {
      id: 'contact-info',
      title: 'Contact Information',
      description: 'How can contractors reach you?',
      fields: [
        {
          id: 'first-name',
          name: 'firstName',
          type: 'text',
          label: 'First Name',
          required: true,
          validation: { min: 2, max: 50 }
        },
        {
          id: 'last-name',
          name: 'lastName',
          type: 'text',
          label: 'Last Name',
          required: true,
          validation: { min: 2, max: 50 }
        },
        {
          id: 'email',
          name: 'email',
          type: 'email',
          label: 'Email Address',
          required: true,
          gridColumn: 'col-span-2'
        },
        {
          id: 'phone',
          name: 'phone',
          type: 'tel',
          label: 'Phone Number',
          required: true
        },
        {
          id: 'best-time',
          name: 'bestTime',
          type: 'select',
          label: 'Best Time to Call',
          options: [
            { value: 'morning', label: 'Morning (8AM-12PM)' },
            { value: 'afternoon', label: 'Afternoon (12PM-5PM)' },
            { value: 'evening', label: 'Evening (5PM-8PM)' },
            { value: 'anytime', label: 'Anytime' }
          ]
        }
      ]
    },
    {
      id: 'property-info',
      title: 'Property Information',
      description: 'Help us find qualified contractors in your area',
      fields: [
        {
          id: 'address',
          name: 'address',
          type: 'text',
          label: 'Street Address',
          required: true,
          placeholder: '123 Main Street',
          gridColumn: 'col-span-2'
        },
        {
          id: 'city',
          name: 'city',
          type: 'text',
          label: 'City',
          required: true
        },
        {
          id: 'state',
          name: 'state',
          type: 'select',
          label: 'State',
          required: true,
          options: [
            { value: 'AL', label: 'Alabama' },
            { value: 'AK', label: 'Alaska' },
            { value: 'AZ', label: 'Arizona' },
            { value: 'AR', label: 'Arkansas' },
            { value: 'CA', label: 'California' },
            { value: 'CO', label: 'Colorado' },
            { value: 'CT', label: 'Connecticut' },
            { value: 'DE', label: 'Delaware' },
            { value: 'FL', label: 'Florida' },
            { value: 'GA', label: 'Georgia' },
            // Add all states...
          ]
        },
        {
          id: 'zip',
          name: 'zip',
          type: 'text',
          label: 'ZIP Code',
          required: true,
          validation: { pattern: '^\\d{5}(-\\d{4})?$', patternMessage: 'Please enter a valid ZIP code' }
        },
        {
          id: 'budget',
          name: 'budget',
          type: 'select',
          label: 'Project Budget',
          options: [
            { value: 'under-5k', label: 'Under $5,000' },
            { value: '5k-15k', label: '$5,000 - $15,000' },
            { value: '15k-30k', label: '$15,000 - $30,000' },
            { value: '30k-50k', label: '$30,000 - $50,000' },
            { value: 'over-50k', label: 'Over $50,000' },
            { value: 'unsure', label: 'Not Sure' }
          ],
          gridColumn: 'col-span-2'
        }
      ]
    }
  ],
  compliance: {
    trustedForm: { enabled: true, pingData: true },
    jornaya: { enabled: true }
  },
  styling: {
    theme: 'professional',
    layout: 'grid',
    spacing: 'normal'
  }
};


// Generic contractor form (fallback)
export const genericContractorConfig: FormConfig = {
  id: 'generic-contractor-form',
  title: 'Get Your Free Quote',
  description: 'Connect with qualified contractors in your area',
  sections: [
    {
      id: 'project-details',
      title: 'Project Details',
      fields: [
        {
          id: 'service-type',
          name: 'serviceType',
          type: 'select',
          label: 'Type of Service',
          required: true,
          options: [
            { value: 'roofing', label: 'Roofing' },
            { value: 'hvac', label: 'HVAC' },
            { value: 'plumbing', label: 'Plumbing' },
            { value: 'electrical', label: 'Electrical' },
            { value: 'landscaping', label: 'Landscaping' },
            { value: 'painting', label: 'Painting' },
            { value: 'flooring', label: 'Flooring' },
            { value: 'kitchen-remodel', label: 'Kitchen Remodel' },
            { value: 'bathroom-remodel', label: 'Bathroom Remodel' },
            { value: 'general-contractor', label: 'General Contracting' }
          ]
        },
        {
          id: 'project-description',
          name: 'projectDescription',
          type: 'textarea',
          label: 'Project Description',
          placeholder: 'Please describe your project in detail...',
          validation: { min: 10, max: 1000 },
          gridColumn: 'col-span-2'
        }
      ]
    },
    {
      id: 'contact-info',
      title: 'Contact Information',
      fields: [
        {
          id: 'first-name',
          name: 'firstName',
          type: 'text',
          label: 'First Name',
          required: true
        },
        {
          id: 'last-name',
          name: 'lastName',
          type: 'text',
          label: 'Last Name',
          required: true
        },
        {
          id: 'email',
          name: 'email',
          type: 'email',
          label: 'Email Address',
          required: true
        },
        {
          id: 'phone',
          name: 'phone',
          type: 'tel',
          label: 'Phone Number',
          required: true
        },
        {
          id: 'zip',
          name: 'zip',
          type: 'text',
          label: 'ZIP Code',
          required: true,
          validation: { pattern: '^\\d{5}(-\\d{4})?$' }
        }
      ]
    }
  ],
  compliance: {
    trustedForm: { enabled: true },
    jornaya: { enabled: true }
  }
};

// Windows service form configuration
export const windowsFormConfig: FormConfig = {
  id: 'windows-lead-form',
  title: 'Get Your Free Windows Quote',
  description: 'Connect with top-rated window contractors in your area',
  sections: [
    {
      id: 'project-details',
      title: 'Window Project Details',
      description: 'Tell us about your window project',
      fields: [
        {
          id: 'project-scope',
          name: 'projectScope',
          type: 'select',
          label: 'What type of window work do you need?',
          required: true,
          options: [
            { value: 'replacement', label: 'Window Replacement' },
            { value: 'installation', label: 'New Window Installation' },
            { value: 'repair', label: 'Window Repair' },
            { value: 'upgrade', label: 'Energy Efficiency Upgrade' }
          ],
          gridColumn: 'col-span-2'
        },
        {
          id: 'number-of-windows',
          name: 'numberOfWindows',
          type: 'select',
          label: 'How many windows?',
          options: [
            { value: '1-3', label: '1-3 windows' },
            { value: '4-6', label: '4-6 windows' },
            { value: '7-10', label: '7-10 windows' },
            { value: '11+', label: '11+ windows' }
          ]
        },
        {
          id: 'window-type',
          name: 'windowType',
          type: 'select',
          label: 'Window Type',
          options: [
            { value: 'double-hung', label: 'Double-Hung' },
            { value: 'casement', label: 'Casement' },
            { value: 'sliding', label: 'Sliding' },
            { value: 'bay-bow', label: 'Bay/Bow' },
            { value: 'picture', label: 'Picture' },
            { value: 'not-sure', label: 'Not Sure' }
          ]
        }
      ]
    },
    {
      id: 'contact-info',
      title: 'Contact Information',
      fields: [
        {
          id: 'first-name',
          name: 'firstName',
          type: 'text',
          label: 'First Name',
          required: true
        },
        {
          id: 'last-name',
          name: 'lastName',
          type: 'text',
          label: 'Last Name',
          required: true
        },
        {
          id: 'email',
          name: 'email',
          type: 'email',
          label: 'Email Address',
          required: true,
          gridColumn: 'col-span-2'
        },
        {
          id: 'phone',
          name: 'phone',
          type: 'tel',
          label: 'Phone Number',
          required: true
        },
        {
          id: 'zip',
          name: 'zip',
          type: 'text',
          label: 'ZIP Code',
          required: true,
          validation: { pattern: '^\\d{5}(-\\d{4})?$' }
        }
      ]
    }
  ],
  compliance: {
    trustedForm: { enabled: true },
    jornaya: { enabled: true }
  }
};

// Bathrooms service form configuration
export const bathroomsFormConfig: FormConfig = {
  id: 'bathrooms-lead-form',
  title: 'Get Your Free Bathroom Quote',
  description: 'Connect with qualified bathroom contractors',
  sections: [
    {
      id: 'project-details',
      title: 'Bathroom Project Details',
      description: 'Tell us about your bathroom project',
      fields: [
        {
          id: 'project-scope',
          name: 'projectScope',
          type: 'select',
          label: 'What type of bathroom work do you need?',
          required: true,
          options: [
            { value: 'full_renovation', label: 'Full bathroom renovation' },
            { value: 'partial_remodel', label: 'Partial remodel/updates' },
            { value: 'new_bathroom', label: 'New bathroom addition' },
            { value: 'repair', label: 'Repair/maintenance work' }
          ],
          gridColumn: 'col-span-2'
        },
        {
          id: 'bathroom-type',
          name: 'bathroomType',
          type: 'select',
          label: 'Which bathroom?',
          options: [
            { value: 'master_bath', label: 'Master Bathroom' },
            { value: 'guest_bath', label: 'Guest Bathroom' },
            { value: 'powder_room', label: 'Powder Room' },
            { value: 'full_bath', label: 'Full Bathroom' }
          ]
        },
        {
          id: 'project-size',
          name: 'projectSize',
          type: 'select',
          label: 'Project Size',
          options: [
            { value: 'small', label: 'Small (under 50 sq ft)' },
            { value: 'medium', label: 'Medium (50-100 sq ft)' },
            { value: 'large', label: 'Large (over 100 sq ft)' }
          ]
        }
      ]
    },
    {
      id: 'contact-info',
      title: 'Contact Information',
      fields: [
        {
          id: 'first-name',
          name: 'firstName',
          type: 'text',
          label: 'First Name',
          required: true
        },
        {
          id: 'last-name',
          name: 'lastName',
          type: 'text',
          label: 'Last Name',
          required: true
        },
        {
          id: 'email',
          name: 'email',
          type: 'email',
          label: 'Email Address',
          required: true,
          gridColumn: 'col-span-2'
        },
        {
          id: 'phone',
          name: 'phone',
          type: 'tel',
          label: 'Phone Number',
          required: true
        },
        {
          id: 'zip',
          name: 'zip',
          type: 'text',
          label: 'ZIP Code',
          required: true,
          validation: { pattern: '^\\d{5}(-\\d{4})?$' }
        }
      ]
    }
  ],
  compliance: {
    trustedForm: { enabled: true },
    jornaya: { enabled: true }
  }
};

// Service configuration mapping
export const serviceConfigs: Record<ServiceTypeKey, FormConfig> = {
  windows: windowsFormConfig,
  roofing: roofingFormConfig,
  bathrooms: bathroomsFormConfig
};

// Helper function to get form config by service type
export function getFormConfig(serviceType: ServiceTypeKey | string): FormConfig {
  return serviceConfigs[serviceType as ServiceTypeKey] || genericContractorConfig;
}