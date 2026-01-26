# Smart Field Components

**Location:** `src/components/ui/fields/`
**Import:** `import { TextInput, PhoneInput, EmailInput, CurrencyInput, Select, TextAreaInput } from '@/components/ui/fields'`

## Overview

Smart field components embed formatting logic directly in the component, eliminating the need to import separate utility functions. All components share consistent orange brand styling and API patterns.

## Available Components

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| `TextInput` | Single-line text | Auto-capitalize option, validation |
| `TextAreaInput` | Multi-line text | Character count, row control |
| `PhoneInput` | Phone numbers | Auto-format to (555) 555-5555 |
| `EmailInput` | Email addresses | Auto-validate, normalize to lowercase |
| `CurrencyInput` | Dollar amounts | Auto-format to $1,234.56 |
| `Select` | Dropdown selection | Portal-based, keyboard nav |
| `AddressAutocomplete` | Address lookup | Radar.com integration |

## Shared Props (All Components)

```typescript
interface CommonProps {
  value: string;              // Current value
  onChange: (value) => void;  // Value change handler
  label?: string;             // Field label
  required?: boolean;         // Shows asterisk on label
  error?: string;             // Error message to display
  helperText?: string;        // Help text below field
  disabled?: boolean;         // Disabled state
  showValidation?: boolean;   // Show green border when valid
  inline?: InlineConfig;      // Inline save/discard buttons
  variant?: 'orange' | 'emerald';  // Color theme (default: 'orange')
}
```

## Color Variants

All components support two color themes:

- **`variant="orange"`** (default) - For public-facing pages (lead forms, landing pages)
- **`variant="emerald"`** - For affiliate portal pages

```tsx
// Public form (orange theme - default)
<PhoneInput value={phone} onChange={setPhone} />

// Affiliate portal (emerald theme)
<PhoneInput value={phone} onChange={setPhone} variant="emerald" />
```

## Basic Usage

```tsx
import {
  TextInput,
  PhoneInput,
  EmailInput,
  CurrencyInput,
  Select,
  TextAreaInput
} from '@/components/ui/fields';

function ContactForm() {
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <form>
      {/* Auto-capitalize first letter */}
      <TextInput
        value={firstName}
        onChange={setFirstName}
        label="First Name"
        capitalizeFirst
        required
      />

      {/* Auto-formats: 9787980276 → (978) 798-0276 */}
      <PhoneInput
        value={phone}
        onChange={setPhone}  // Receives clean: "9787980276"
        label="Phone"
        required
      />

      {/* Auto-validates, normalizes to lowercase */}
      <EmailInput
        value={email}
        onChange={setEmail}
        label="Email"
        showValidation
      />

      {/* Auto-formats: 1234.56 → $1,234.56 */}
      <CurrencyInput
        value={budget}
        onChange={setBudget}  // Receives clean: "1234.56"
        label="Budget"
        min={100}
        max={50000}
      />

      {/* Styled dropdown with portal */}
      <Select
        value={status}
        onChange={setStatus}
        label="Status"
        options={[
          { value: 'new', label: 'New Lead' },
          { value: 'contacted', label: 'Contacted' },
          { value: 'qualified', label: 'Qualified' },
        ]}
      />

      {/* Multi-line with character count */}
      <TextAreaInput
        value={notes}
        onChange={setNotes}
        label="Notes"
        rows={4}
        maxLength={500}
        showCharCount
      />
    </form>
  );
}
```

## Inline Editing (Detail Pages)

For detail pages where fields save immediately to the database:

```tsx
import { PhoneInput, type InlineConfig } from '@/components/ui/fields';

function ContactDetail({ contact }) {
  const [phone, setPhone] = useState(contact.phone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const inlineConfig: InlineConfig = {
    onSave: async () => {
      setSaving(true);
      await updateContact({ phone });
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onDiscard: () => setPhone(contact.phone),
    hasChanges: phone !== contact.phone,
    saving,
    saveSuccess: saved,
    position: 'right',  // or 'below'
  };

  return (
    <PhoneInput
      value={phone}
      onChange={setPhone}
      label="Phone"
      inline={inlineConfig}
    />
  );
}
```

## Component-Specific Features

### TextInput

```tsx
<TextInput
  value={name}
  onChange={setName}
  label="Name"
  capitalizeFirst      // Auto-capitalize first letter
  validate={(v) => v.length >= 2}  // Custom validation
/>
```

### TextAreaInput

```tsx
<TextAreaInput
  value={bio}
  onChange={setBio}
  label="Bio"
  rows={6}
  maxLength={1000}
  showCharCount        // Shows "500/1000" counter
/>
```

### PhoneInput

```tsx
<PhoneInput
  value={phone}
  onChange={setPhone}  // Clean: "9787980276"
  label="Phone"
  icon={<PhoneIcon />} // Optional left icon
  showValidation       // Green border when valid (10 digits)
/>
```

### EmailInput

```tsx
<EmailInput
  value={email}
  onChange={setEmail}
  label="Email"
  normalizeOnBlur={true}  // Default: lowercase on blur
  showValidation          // Green border when valid
/>
```

### CurrencyInput

```tsx
<CurrencyInput
  value={amount}
  onChange={setAmount}  // Clean: "1234.56"
  label="Amount"
  min={0}
  max={100000}
  decimals={2}          // Default: 2
  showValidation
/>
```

### Select

```tsx
<Select
  value={selected}
  onChange={setSelected}
  label="Category"
  placeholder="Choose..."
  options={[
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B', disabled: true },
  ]}
/>
```

## Styling

All components use consistent brand styling:

- **Border:** `border-2 border-orange-300`
- **Focus:** `focus:ring-2 focus:ring-orange-500 focus:border-orange-500`
- **Rounded:** `rounded-xl`
- **Padding:** `px-4 py-3`
- **Error state:** `border-red-300` with red focus ring
- **Valid state:** `border-green-400` with green focus ring (when `showValidation`)

## Migration Guide

### From raw inputs

```tsx
// Before: Manual formatting
import { formatPhoneForDisplay, cleanPhoneNumber } from '@/lib/utils/phone';

<input
  value={formatPhoneForDisplay(phone)}
  onChange={(e) => setPhone(cleanPhoneNumber(e.target.value))}
/>

// After: Smart component
import { PhoneInput } from '@/components/ui/fields';

<PhoneInput
  value={phone}
  onChange={setPhone}  // Already receives clean value
/>
```

### From AccessibleInput

```tsx
// Before
<AccessibleInput
  type="tel"
  value={phone}
  onChange={(e) => setPhone(e.target.value)}
  label="Phone"
/>

// After
<PhoneInput
  value={phone}
  onChange={setPhone}
  label="Phone"
/>
```

## File Structure

```
src/components/ui/fields/
├── index.ts              # Unified exports
├── TextInput.tsx         # Single-line text
├── TextAreaInput.tsx     # Multi-line text
├── PhoneInput.tsx        # Phone with formatting
├── EmailInput.tsx        # Email with validation
├── CurrencyInput.tsx     # Currency with formatting
├── Select.tsx            # Custom dropdown
├── InlineSaveButtons.tsx # Save/discard for inline editing
└── utils/
    ├── emailFormatting.ts    # Email validation logic
    └── currencyFormatting.ts # Currency formatting logic
```

Phone utilities are in `src/lib/utils/phone.ts` (shared across the app).
