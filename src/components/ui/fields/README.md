# Smart Fields System

**Single source of truth for all form inputs across the application.**

## Why Smart Fields?

Instead of duplicating input styling and validation logic across pages, all form fields import from this centralized location. Changes here automatically apply everywhere.

## Available Components

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| `TextInput` | Single-line text | Password support, name-only mode, auto-capitalize |
| `EmailInput` | Email addresses | Auto-validation, space removal, lowercase normalization |
| `PhoneInput` | Phone numbers | Auto-formatting `(555) 123-4567`, validation |
| `TextAreaInput` | Multi-line text | Character count, auto-resize ready |
| `CurrencyInput` | Money display | Formatted currency values |
| `Select` | Dropdowns | Portal-based, keyboard navigation |

## Quick Start

```tsx
import { TextInput, EmailInput, PhoneInput } from '@/components/ui/fields';

// Basic usage
<TextInput
  value={name}
  onChange={setName}
  label="Full Name"
  required
/>

<EmailInput
  value={email}
  onChange={setEmail}
  label="Email"
  required
/>

<PhoneInput
  value={phone}
  onChange={setPhone}
  label="Phone"
/>
```

## Variant System

All components support a `variant` prop for theming:

| Variant | Use Case | Colors |
|---------|----------|--------|
| `orange` (default) | Public-facing pages | Orange borders/focus |
| `emerald` | Affiliate portal | Green borders/focus |

```tsx
// Public page (default orange)
<TextInput value={name} onChange={setName} label="Name" />

// Affiliate portal (emerald)
<TextInput value={name} onChange={setName} label="Name" variant="emerald" />
```

## Component Details

### TextInput

General purpose text input with smart features.

```tsx
<TextInput
  value={value}
  onChange={setValue}
  label="Label"
  type="text"           // 'text' | 'password' | 'url' | 'search'
  required              // Shows asterisk, doesn't enforce (use form validation)
  disabled
  placeholder="..."
  icon={<Icon />}       // Left-side icon
  variant="orange"      // 'orange' | 'emerald'

  // Name field helpers
  nameOnly              // Only allows letters, spaces, hyphens, apostrophes
  capitalizeWords       // Auto-capitalizes first letter of each word
  capitalizeFirst       // Auto-capitalizes first letter only

  // Validation
  showValidation        // Shows green border when valid
  validate={(v) => bool} // Custom validation function
  error="Error message" // External error display
  helperText="Help"     // Hint text below input
/>
```

**Name field example:**
```tsx
<TextInput
  value={firstName}
  onChange={setFirstName}
  label="First Name"
  nameOnly              // Blocks numbers and special chars
  capitalizeWords       // "john" → "John"
  required
/>
```

**Password field example:**
```tsx
<TextInput
  type="password"
  value={password}
  onChange={setPassword}
  label="Password"
  icon={<Lock className="h-5 w-5 text-gray-400" />}
/>
```

### EmailInput

Email input with built-in validation.

```tsx
<EmailInput
  value={email}
  onChange={setEmail}
  label="Email"
  required
  icon={<Mail />}
  placeholder="you@example.com"
  variant="emerald"
  showValidation        // Green border when valid
  normalizeOnBlur       // Lowercase on blur (default: true)
  error="Custom error"  // Overrides built-in validation
  helperText="We'll never share your email"
/>
```

**Built-in behaviors:**
- Removes ALL spaces while typing (emails can't have spaces)
- Validates format on blur with helpful error messages
- Normalizes to lowercase on blur
- Shows specific errors: "Email must contain @", "Domain must include a period", etc.

**Validation checks:**
- Contains `@` symbol
- Has text before and after `@`
- Domain includes a period (`.`)
- TLD is at least 2 characters
- Passes RFC-compliant regex

### PhoneInput

US phone number input with automatic formatting.

```tsx
<PhoneInput
  value={phone}
  onChange={setPhone}
  label="Phone Number"
  required
  icon={<Phone />}
  variant="emerald"
  showValidation        // Green border when valid (10 digits)
/>
```

**Built-in behaviors:**
- Auto-formats as you type: `5551234567` → `(555) 123-4567`
- Only allows digits
- Validates 10-digit US phone numbers
- Returns clean digits to `onChange` (no formatting)

### TextAreaInput

Multi-line text input.

```tsx
<TextAreaInput
  value={notes}
  onChange={setNotes}
  label="Notes"
  rows={4}              // Default: 4
  maxLength={500}
  showCharCount         // Shows "123/500" counter
  placeholder="Enter notes..."
  variant="emerald"
/>
```

### Select

Custom dropdown with consistent styling.

```tsx
<Select
  value={status}
  onChange={setStatus}
  label="Status"
  required
  options={[
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'pending', label: 'Pending', disabled: true },
  ]}
  placeholder="Select status..."
  variant="emerald"
/>
```

**Features:**
- Portal-based dropdown (proper z-index handling)
- Keyboard navigation (Arrow keys, Enter, Escape)
- Disabled option support

### CurrencyInput

For displaying/editing currency values.

```tsx
<CurrencyInput
  value={amount}
  onChange={setAmount}
  label="Amount"
  variant="emerald"
/>
```

## Inline Save/Discard Buttons

All components support inline editing mode for detail pages:

```tsx
<TextInput
  value={firstName}
  onChange={setFirstName}
  label="First Name"
  inline={{
    onSave: async () => {
      await saveToDatabase({ firstName });
    },
    onDiscard: () => setFirstName(originalFirstName),
    hasChanges: firstName !== originalFirstName,
    saving: isSaving,           // Shows spinner
    saveSuccess: saved,         // Shows checkmark briefly
    position: 'right',          // 'right' | 'below'
  }}
/>
```

## Adding Icons

All components support a left-side icon:

```tsx
import { User, Mail, Phone, Lock, Globe } from 'lucide-react';

<TextInput
  icon={<User className="h-5 w-5 text-gray-400" />}
  // ...
/>

<EmailInput
  icon={<Mail className="h-5 w-5 text-gray-400" />}
  // ...
/>
```

## Files in This Directory

```
src/components/ui/fields/
├── index.ts              # Barrel export (import from here)
├── TextInput.tsx         # Text, password, URL inputs
├── EmailInput.tsx        # Email with validation
├── PhoneInput.tsx        # Phone with formatting
├── TextAreaInput.tsx     # Multi-line text
├── CurrencyInput.tsx     # Currency display
├── Select.tsx            # Custom dropdown
├── InlineSaveButtons.tsx # Save/discard button component
├── utils/
│   ├── emailFormatting.ts   # Email validation utilities
│   └── phoneFormatting.ts   # Phone formatting utilities
└── README.md             # This file
```

## Usage Across the App

These components are used in:

- `DynamicForm.tsx` - Lead capture forms
- `/affiliate/signup` - Affiliate registration
- `/affiliate/settings` - Profile management
- `/affiliate/withdrawals` - Payment requests
- `/login` - Unified login page

## Migration Notes

The old `src/components/ui/PhoneInput.tsx` is deprecated. Always import from:

```tsx
// ✅ Correct
import { PhoneInput } from '@/components/ui/fields';

// ❌ Deprecated
import PhoneInput from '@/components/ui/PhoneInput';
```

## Adding New Smart Fields

1. Create component in `src/components/ui/fields/`
2. Follow existing patterns (value/onChange props, variant support, label/error/helperText)
3. Add utility functions to `utils/` if needed
4. Export from `index.ts`
5. Update this README
