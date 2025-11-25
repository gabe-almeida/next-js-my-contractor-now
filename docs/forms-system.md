# Dynamic Form System Documentation

## Overview

A comprehensive, dynamic form engine built for the contractor platform with compliance integration, accessibility features, and mobile responsiveness.

## Core Features

### 🚀 Dynamic Form Engine
- **Configurable Forms**: JSON-driven form configurations
- **Conditional Logic**: Show/hide fields based on user input
- **Multiple Layouts**: Single column, double column, and grid layouts
- **Section Management**: Collapsible sections with progress tracking

### 🔒 Compliance Integration
- **TrustedForm**: Real-time certificate generation and tracking
- **Jornaya**: Lead tracking and attribution
- **Automatic Tokens**: Background compliance token management

### ♿ Accessibility Features
- **ARIA Support**: Proper labels, descriptions, and error announcements
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader**: Optimized for assistive technologies
- **Focus Management**: Logical focus order and visible indicators

### 📱 Mobile Responsive
- **Touch Optimized**: Large touch targets for mobile devices
- **Responsive Grid**: Adapts to different screen sizes
- **Mobile Forms**: Optimized input types for mobile keyboards

## Architecture

```
src/components/forms/
├── base/                 # Core form components
│   ├── FormField.tsx     # Main field wrapper component
│   ├── FormSubmitButton.tsx
│   ├── FormProgress.tsx
│   └── inputs/           # Individual input components
├── dynamic/              # Dynamic form engine
│   ├── DynamicForm.tsx   # Main form orchestrator
│   └── FormSection.tsx   # Section management
├── compliance/           # Compliance providers
│   ├── TrustedFormProvider.tsx
│   └── JornayaProvider.tsx
└── hooks/                # Form state management
    └── useFormState.ts
```

## Usage Examples

### Basic Dynamic Form

```tsx
import { DynamicForm } from '@/components/forms';
import { roofingFormConfig } from '@/config/forms/serviceConfigs';

function RoofingQuoteForm() {
  const handleSubmit = async (submission) => {
    console.log('Form submitted:', submission);
    // Process submission
  };

  return (
    <DynamicForm
      config={roofingFormConfig}
      onSubmit={handleSubmit}
      showProgress={true}
      debug={false}
    />
  );
}
```

### Custom Form Configuration

```tsx
const customFormConfig = {
  id: 'custom-form',
  title: 'Custom Service Form',
  sections: [
    {
      id: 'details',
      title: 'Project Details',
      fields: [
        {
          id: 'service-type',
          name: 'serviceType',
          type: 'select',
          label: 'Service Type',
          required: true,
          options: [
            { value: 'repair', label: 'Repair' },
            { value: 'install', label: 'Installation' }
          ]
        }
      ]
    }
  ],
  compliance: {
    trustedForm: { enabled: true },
    jornaya: { enabled: true }
  }
};
```

### Conditional Fields

```tsx
import { conditionalHelpers } from '@/utils/forms/conditionals';

const fieldWithConditional = {
  id: 'roof-material',
  name: 'roofMaterial',
  type: 'select',
  label: 'Roof Material',
  conditional: conditionalHelpers.showWhenEquals('serviceType', 'roofing'),
  options: [
    { value: 'shingles', label: 'Asphalt Shingles' },
    { value: 'metal', label: 'Metal Roofing' }
  ]
};
```

## Form Field Types

### Input Types
- `text` - Standard text input
- `email` - Email validation
- `tel` - Phone number with formatting
- `number` - Numeric input with validation
- `date` - Date picker
- `textarea` - Multi-line text
- `select` - Single selection dropdown
- `multiselect` - Multiple selection dropdown
- `radio` - Radio button groups
- `checkbox` - Checkbox groups

### Input Components
- **TextInput**: Auto-formatting for phone/ZIP
- **SelectInput**: Custom styled dropdowns
- **NumberInput**: Currency and percentage variants
- **DateInput**: Date range and specialized date inputs
- **MultiSelectInput**: Searchable multi-selection

## Validation System

### Zod Integration
```tsx
import { z } from 'zod';

// Built-in schemas
const phoneSchema = z.string().regex(/phone-pattern/, 'Invalid phone');
const emailSchema = z.string().email('Invalid email');

// Dynamic validation
const schema = buildValidationSchema(formFields);
```

### Field Validation
```tsx
const field = {
  id: 'phone',
  name: 'phone',
  type: 'tel',
  label: 'Phone Number',
  required: true,
  validation: {
    min: 10,
    max: 15,
    pattern: '^\\+?1?\\d{10,14}$',
    patternMessage: 'Please enter a valid phone number'
  }
};
```

## Compliance Providers

### TrustedForm
```tsx
<TrustedFormProvider
  config={{
    enabled: true,
    cert_id: 'your-cert-id',
    pingData: true,
    debug: true
  }}
  onStatusChange={(status) => console.log('TrustedForm:', status)}
>
  <YourForm />
</TrustedFormProvider>
```

### Jornaya
```tsx
<JornayaProvider
  config={{
    enabled: true,
    leadid_token: 'your-token',
    trackingUrl: 'your-tracking-url',
    debug: true
  }}
  onStatusChange={(status) => console.log('Jornaya:', status)}
>
  <YourForm />
</JornayaProvider>
```

## State Management

### useFormState Hook
```tsx
const {
  formState,
  updateField,
  updateFieldTouched,
  validateForm,
  resetForm,
  getFormData
} = useFormState(formConfig, initialData);
```

### Form State Structure
```tsx
interface FormState {
  values: Record<string, any>;
  errors: FormValidationError[];
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  compliance: {
    trustedForm: ComplianceStatus;
    jornaya: ComplianceStatus;
  };
}
```

## Styling & Themes

### Built-in Themes
- `default` - Standard form styling
- `modern` - Clean, minimal design
- `professional` - Corporate styling
- `minimal` - Reduced visual elements

### Layout Options
- `single` - Single column layout
- `double` - Two column layout
- `grid` - CSS Grid with responsive columns

### Custom Styling
```tsx
const formConfig = {
  styling: {
    theme: 'professional',
    layout: 'grid',
    spacing: 'normal',
    borderRadius: 'md'
  }
};
```

## Service Configurations

### Pre-built Configs
- **Roofing**: Comprehensive roofing project form
- **HVAC**: HVAC service and installation form
- **Generic**: Fallback for any contractor service

### Usage
```tsx
import { getFormConfig } from '@/config/forms/serviceConfigs';

const config = getFormConfig('roofing');
```

## Mobile Optimization

### Responsive Features
- Touch-friendly input sizes
- Mobile-optimized keyboards
- Swipe gestures for multi-step forms
- Adaptive grid layouts

### Mobile-Specific Components
```tsx
// Optimized for mobile touch
<NumberInput
  type="tel"
  inputMode="numeric"
  pattern="[0-9]*"
/>
```

## Accessibility Features

### ARIA Support
```tsx
<input
  aria-describedby="field-description"
  aria-invalid={hasError}
  aria-required={required}
  role="textbox"
/>
```

### Keyboard Navigation
- Tab order management
- Enter/Space activation
- Escape key handling
- Arrow key navigation for options

### Screen Reader Support
- Semantic form structure
- Live regions for errors
- Progressive disclosure
- Clear field relationships

## Performance

### Optimizations
- Component lazy loading
- Conditional field rendering
- Efficient re-renders with React.memo
- Form state management optimization

### Bundle Size
- Tree-shakeable components
- Minimal dependencies
- Optimized validation schemas
- Code splitting for compliance providers

## Testing

### Unit Tests
```tsx
import { render, fireEvent } from '@testing-library/react';
import { DynamicForm } from '@/components/forms';

test('form submission', async () => {
  const onSubmit = jest.fn();
  const { getByRole } = render(
    <DynamicForm config={testConfig} onSubmit={onSubmit} />
  );
  
  fireEvent.click(getByRole('button', { name: /submit/i }));
  expect(onSubmit).toHaveBeenCalled();
});
```

### Integration Tests
- End-to-end form flows
- Compliance provider testing
- Mobile device testing
- Accessibility testing

## Best Practices

### Form Configuration
1. **Clear Labels**: Use descriptive, user-friendly labels
2. **Logical Grouping**: Group related fields in sections
3. **Progressive Disclosure**: Use conditionals to reduce cognitive load
4. **Validation Messages**: Provide clear, actionable error messages

### Performance
1. **Lazy Loading**: Load compliance scripts only when needed
2. **Debounced Validation**: Avoid excessive validation calls
3. **Efficient Updates**: Use specific field updates vs full form re-renders
4. **Memory Management**: Clean up event listeners and timers

### Accessibility
1. **Semantic HTML**: Use proper form elements and structure
2. **Error Handling**: Clear error indication and recovery
3. **Focus Management**: Logical focus order and visibility
4. **Alternative Text**: Descriptive labels and instructions

## Troubleshooting

### Common Issues

#### Compliance Not Loading
```tsx
// Check for script blockers or network issues
const { getCertUrl } = useTrustedForm();
console.log('TrustedForm URL:', getCertUrl());
```

#### Validation Errors
```tsx
// Debug validation with field-level validation
const error = validateField(field, value);
console.log('Validation error:', error);
```

#### Mobile Display Issues
```tsx
// Check viewport meta tag
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

### Performance Issues
- Use React DevTools Profiler
- Monitor form state updates
- Check for unnecessary re-renders
- Optimize field validation frequency

## Future Enhancements

### Planned Features
- [ ] Multi-step form wizard
- [ ] Form analytics and tracking
- [ ] Advanced conditional logic
- [ ] Custom field types
- [ ] Form templates library
- [ ] Internationalization support
- [ ] Advanced validation rules
- [ ] Form builder interface

### API Improvements
- [ ] Better TypeScript inference
- [ ] Simplified configuration syntax
- [ ] Enhanced debugging tools
- [ ] Performance monitoring
- [ ] Error boundary integration