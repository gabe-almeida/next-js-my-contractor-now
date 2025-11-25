# Address Autocomplete Usage Guide

## Quick Start

### 1. Basic Implementation

```tsx
import AddressAutocomplete from '@/components/forms/inputs/AddressAutocomplete';

function MyForm() {
  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState('');

  return (
    <AddressAutocomplete
      value={address}
      placeholder="Enter your address"
      onAddressSelect={(addr, zip) => {
        setAddress(addr);
        setZipCode(zip || '');
      }}
      onInputChange={setAddress}
    />
  );
}
```

### 2. With Error Handling

```tsx
function MyFormWithErrors() {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const validateAddress = (addr: string) => {
    if (!addr.trim()) {
      setError('Address is required');
      return false;
    }
    setError('');
    return true;
  };

  return (
    <AddressAutocomplete
      value={address}
      error={error}
      onAddressSelect={(addr, zip) => {
        if (validateAddress(addr)) {
          setAddress(addr);
          // Process the address...
        }
      }}
    />
  );
}
```

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | `''` | Current input value |
| `placeholder` | `string` | `'Enter your address or ZIP code'` | Input placeholder text |
| `onAddressSelect` | `(address: string, zipCode?: string) => void` | Required | Called when user selects an address |
| `onInputChange` | `(value: string) => void` | Optional | Called when input value changes |
| `disabled` | `boolean` | `false` | Disable the input |
| `className` | `string` | `''` | Additional CSS classes |
| `error` | `string` | Optional | Error message to display |

## Integration Examples

### In Dynamic Forms

```tsx
// In DynamicForm.tsx
case 'address':
  return (
    <AddressAutocomplete
      value={answers[currentQuestion.id]?.address || ''}
      onAddressSelect={(address, zipCode) => {
        const addressData = { address, zipCode };
        handleAnswer(currentQuestion.id, addressData);
      }}
    />
  );
```

### With React Hook Form

```tsx
import { useForm, Controller } from 'react-hook-form';

function FormWithHookForm() {
  const { control, handleSubmit, setValue } = useForm();

  return (
    <Controller
      name="address"
      control={control}
      render={({ field, fieldState }) => (
        <AddressAutocomplete
          value={field.value?.address || ''}
          error={fieldState.error?.message}
          onAddressSelect={(address, zipCode) => {
            setValue('address', { address, zipCode });
            setValue('zipCode', zipCode);
          }}
        />
      )}
    />
  );
}
```

## Styling

### Custom Styling

```tsx
<AddressAutocomplete
  className="my-custom-input"
  // ... other props
/>
```

### CSS Classes Applied

- Input: `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500`
- Dropdown: `absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg`
- Selected Item: `bg-orange-50 border-orange-200`
- Error State: `border-red-300 focus:border-red-500`

## Accessibility

The component includes:
- ARIA attributes (`aria-expanded`, `aria-haspopup`, `role="combobox"`)
- Keyboard navigation support
- Screen reader compatibility
- Focus management

### Keyboard Controls

- **Arrow Up/Down**: Navigate suggestions
- **Enter**: Select highlighted suggestion
- **Escape**: Close dropdown and blur input
- **Tab**: Move to next form element

## Error Handling

### Common Scenarios

1. **API Key Missing**: Automatic fallback to basic input
2. **Network Failure**: Error message with retry capability
3. **Invalid API Key**: Clear error message
4. **No Results**: Allows manual entry

### Error Messages

- "Invalid Radar API key"
- "Network error - check internet connection"
- "Address validation service unavailable"

## Performance Tips

1. **Debouncing**: Built-in 300ms debounce reduces API calls
2. **Minimum Length**: Only searches after 3+ characters
3. **Caching**: Browser handles HTTP caching automatically
4. **Lazy Loading**: Radar SDK loaded only when needed

## Testing

### Unit Tests

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import AddressAutocomplete from './AddressAutocomplete';

test('calls onAddressSelect when address is selected', async () => {
  const mockSelect = jest.fn();
  
  render(
    <AddressAutocomplete onAddressSelect={mockSelect} />
  );
  
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: '1600 Penn' } });
  
  await waitFor(() => {
    expect(screen.getByText(/Pennsylvania/)).toBeInTheDocument();
  });
  
  fireEvent.click(screen.getByText(/Pennsylvania/));
  expect(mockSelect).toHaveBeenCalledWith(
    expect.stringContaining('Pennsylvania'),
    expect.any(String)
  );
});
```

### Manual Testing

1. Test with real addresses
2. Verify ZIP code extraction
3. Test keyboard navigation
4. Check error states
5. Verify fallback mode

## Troubleshooting

### Common Issues

1. **No suggestions appear**
   - Check API key in environment variables
   - Verify network connectivity
   - Check browser console for errors

2. **Suggestions are wrong**
   - Verify country setting (US only)
   - Check layer configuration
   - Review query formatting

3. **Slow performance**
   - Check debounce timing
   - Verify API response times
   - Monitor network requests

### Debug Mode

Enable detailed logging:

```tsx
// In development, check browser console
console.log('Radar initialization:', { isReady, error, fallbackMode });
```