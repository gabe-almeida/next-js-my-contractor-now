# TCPA Compliance System Implementation Guide

## Overview

This comprehensive TCPA (Telephone Consumer Protection Act) compliance system provides:
- Real-time phone and email validation
- Configurable TCPA consent text per lead buyer
- Smart validation with visual feedback
- Complete consent tracking for legal compliance
- Modular, reusable components

## File Structure

```
src/
├── utils/validation/
│   ├── tcpa.ts                 # Phone/email validation utilities
│   └── index.ts               # Validation exports and common patterns
├── config/
│   └── tcpa.ts                # TCPA configurations per buyer
├── components/forms/compliance/
│   └── TCPACheckbox.tsx       # TCPA consent checkbox component
├── hooks/
│   └── useFormValidation.ts   # Form validation hook
├── types/
│   └── tcpa.ts               # TCPA type definitions
└── components/
    └── DynamicForm.tsx       # Updated with TCPA compliance
```

## Key Features

### 1. Phone Number Validation
- Supports multiple formats: `1234567890`, `+11234567890`, `11234567890`, `(123) 456-7890`
- Real-time formatting as user types
- Progressive validation feedback
- Automatic formatting to `(XXX) XXX-XXXX`

### 2. Email Validation
- Comprehensive regex validation
- Real-time feedback
- Visual success indicators

### 3. TCPA Checkbox System
- Only appears when both phone and email are valid
- Configurable text per lead buyer
- Required consent tracking
- Visual focus states and accessibility

### 4. Buyer-Specific Configuration
Supports different TCPA text for different lead buyers:
- `default`: My Contractor Now standard text
- `homeadvisor`: HomeAdvisor partnership text
- `angi`: Angi partnership text
- Easily extensible for new buyers

### 5. Consent Tracking
Complete TCPA consent records include:
- Acceptance status
- Timestamp
- IP address (server-side)
- User agent
- Buyer configuration used

## Usage Examples

### Basic Usage in Form

```tsx
import { useFormValidation } from '@/hooks/useFormValidation';
import { getTCPAConfig } from '@/config/tcpa';
import TCPACheckbox from '@/components/forms/compliance/TCPACheckbox';

function ContactForm({ buyerId = 'default' }) {
  const tcpaConfig = getTCPAConfig(buyerId);
  const { formData, validation, updateField, isSubmitEnabled } = useFormValidation(true);

  return (
    <form>
      {/* Phone input with real-time validation */}
      <input
        value={formData.phone}
        onChange={(e) => updateField('phone', formatPhoneField(e.target.value))}
        className={validation.phone.isValid ? 'border-green-500' : 'border-red-500'}
      />
      
      {/* TCPA Checkbox */}
      <TCPACheckbox
        config={tcpaConfig}
        isContactValid={validation.isContactInfoValid}
        value={formData.tcpaConsent}
        onChange={(accepted) => updateField('tcpaConsent', accepted)}
      />
      
      <button disabled={!isSubmitEnabled}>Submit</button>
    </form>
  );
}
```

### Validation Functions

```tsx
import { validatePhoneNumber, validateEmail, formatPhoneInput } from '@/utils/validation';

// Phone validation
const phoneResult = validatePhoneNumber('1234567890');
// { isValid: true, formatted: '(123) 456-7890' }

// Email validation
const emailResult = validateEmail('user@example.com');
// { isValid: true }

// Real-time formatting
const formatted = formatPhoneInput('1234567890');
// Returns: '(123) 456-7890'
```

### Adding New Lead Buyer

```tsx
// In src/config/tcpa.ts
export const TCPA_CONFIGURATIONS: Record<string, TCPAConfig> = {
  // ... existing configs
  'newbuyer': {
    buyerId: 'newbuyer',
    text: 'Custom TCPA text for new buyer...',
    isRequired: true,
    showOnlyWhenContactValid: true
  }
};
```

## Validation Rules

### Phone Numbers
- **10 digits**: `1234567890` → Valid
- **11 digits starting with 1**: `11234567890` → Valid
- **With formatting**: `(123) 456-7890` → Valid
- **+1 prefix**: `+11234567890` → Valid

### Email Addresses
- Standard email validation with comprehensive regex
- Supports all common email formats
- Real-time validation feedback

### Form Validation
- First/Last name: Minimum 2 characters
- TCPA consent: Required when configured
- Progressive validation: Fields validated as user types
- Submit only enabled when all validations pass

## API Integration

The system automatically includes TCPA consent in API payloads:

```json
{
  "firstName": "John",
  "lastName": "Doe", 
  "email": "john@example.com",
  "phone": "(555) 123-4567",
  "tcpaConsent": {
    "isAccepted": true,
    "timestamp": "2025-01-15T10:30:00Z",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "buyerConfig": "default"
  }
}
```

## Visual Feedback

The system provides rich visual feedback:
- **Red borders**: Invalid inputs with error messages
- **Green borders**: Valid inputs with checkmark
- **Progressive validation**: Real-time feedback as user types
- **TCPA visibility**: Checkbox only appears when contact info is valid
- **Submit state**: Button disabled until form is complete

## Accessibility

- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader compatible
- Clear error messaging
- Focus management

## Security Features

- Server-side IP collection for consent records
- Input sanitization and validation
- Secure consent tracking
- No client-side storage of sensitive data

## Configuration Options

### TCPA Config Options
- `buyerId`: Unique identifier for lead buyer
- `text`: Custom TCPA consent text
- `isRequired`: Whether consent is mandatory
- `showOnlyWhenContactValid`: Display logic for checkbox

### Validation Hook Options
- `requireTCPA`: Enable/disable TCPA validation
- Real-time field validation
- Form-level validation state
- Submit enablement logic

This implementation provides a complete, legally compliant TCPA consent system that's modular, reusable, and easily configurable for different lead buyers while maintaining excellent user experience.