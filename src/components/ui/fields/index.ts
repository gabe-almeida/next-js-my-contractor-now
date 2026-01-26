/**
 * Smart Field Components - Self-contained inputs with built-in formatting
 *
 * WHY: DRY principle - formatting logic is embedded in components, not imported separately
 * WHEN: Use these for all form inputs requiring formatting (phone, email, currency, text)
 * HOW: Import from '@/components/ui/fields' - all formatting happens automatically
 *
 * IMPORTANT: These are SMART components with internal formatting logic.
 * Changing the internal utils automatically updates ALL instances app-wide.
 *
 * All components use consistent orange brand styling to match the site's design.
 *
 * @example
 * // Basic form usage (modals, create forms)
 * import { TextInput, TextAreaInput, PhoneInput, EmailInput, CurrencyInput, Select } from '@/components/ui/fields';
 *
 * <TextInput value={name} onChange={setName} label="Name" />
 * <TextInput value={name} onChange={setName} label="Name" capitalizeFirst />
 * <TextAreaInput value={notes} onChange={setNotes} label="Notes" rows={4} />
 * <PhoneInput value={phone} onChange={(clean) => setPhone(clean)} label="Phone" />
 * <EmailInput value={email} onChange={setEmail} label="Email" />
 * <CurrencyInput value={price} onChange={(clean) => setPrice(clean)} label="Price" />
 * <Select value={status} onChange={setStatus} options={options} label="Status" />
 *
 * @example
 * // With inline save/discard buttons (for detail page editing)
 * <PhoneInput
 *   value={phone}
 *   onChange={(clean) => setPhone(clean)}
 *   label="Phone"
 *   inline={{
 *     onSave: () => saveToDatabase({ phone }),
 *     onDiscard: () => setPhone(originalPhone),
 *     hasChanges: phone !== originalPhone,
 *     saving: isSaving,
 *     saveSuccess: saved,
 *   }}
 * />
 */

// Smart field components
export { TextInput } from './TextInput';
export type { TextInputProps } from './TextInput';

export { TextAreaInput } from './TextAreaInput';
export type { TextAreaInputProps } from './TextAreaInput';

export { PhoneInput } from './PhoneInput';
export type { PhoneInputProps } from './PhoneInput';

export { EmailInput } from './EmailInput';
export type { EmailInputProps } from './EmailInput';

export { CurrencyInput } from './CurrencyInput';
export type { CurrencyInputProps } from './CurrencyInput';

export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';

// Inline editing support (for detail page editing)
export { InlineSaveButtons } from './InlineSaveButtons';
export type { InlineConfig } from './InlineSaveButtons';

// Re-export existing AddressAutocomplete for convenience
// Note: AddressAutocomplete lives in forms/inputs but is exported here for consistency
export { default as AddressAutocomplete } from '@/components/forms/inputs/AddressAutocomplete';
export type { AddressSelectData } from '@/components/forms/inputs/AddressAutocomplete';
