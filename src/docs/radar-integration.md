# Radar.com Address Autocomplete Integration

## Overview

This implementation adds Radar.com address autocomplete functionality to replace the basic text input in the dynamic form. The integration provides real-time address suggestions, ZIP code extraction, and graceful fallback to manual entry.

## Components

### 1. AddressAutocomplete Component
- **Location**: `/src/components/forms/inputs/AddressAutocomplete.tsx`
- **Purpose**: Main component providing address autocomplete with Radar API
- **Features**:
  - Real-time address suggestions
  - Keyboard navigation (arrow keys, enter, escape)
  - ZIP code extraction
  - Loading states
  - Error handling with fallback mode
  - Accessibility support (ARIA attributes)

### 2. useRadar Hook
- **Location**: `/src/hooks/useRadar.ts`
- **Purpose**: Manages Radar SDK initialization and provides search functionality
- **Features**:
  - SDK initialization with error handling
  - Connection testing
  - Fallback mode for API failures
  - Reusable search function

### 3. Type Definitions
- **Location**: `/src/types/address.ts`
- **Purpose**: TypeScript types for address data and Radar API responses

## Environment Configuration

### Required Environment Variables

```bash
# Client-side (public)
NEXT_PUBLIC_RADAR_PUBLISHABLE_KEY=prj_live_pk_91767cffe84243dd66aae8025c9c44e0e5ebce49

# Server-side (private)
RADAR_SECRET_KEY=prj_live_sk_15e7412955622b6946e3978d9b4c930f04f5aafb
```

## Integration in DynamicForm

The address case in `DynamicForm.tsx` has been updated to:
1. Use the new `AddressAutocomplete` component
2. Store address data as an object with both address and ZIP code
3. Handle backward compatibility with string values
4. Auto-advance to the next step when address is selected

## API Configuration

### Radar Autocomplete Settings
- **Country**: US only
- **Layers**: address, postalCode
- **Limit**: 8 suggestions
- **Minimum query length**: 3 characters
- **Debounce delay**: 300ms

## Error Handling

### Fallback Modes
1. **Missing API Key**: Automatically switches to basic text input
2. **Network Errors**: Shows error message, maintains basic functionality
3. **Authentication Errors**: Displays key validation error
4. **SDK Load Failures**: Gracefully degrades to manual entry

### User Experience
- Loading indicators during API calls
- Clear error messages
- Automatic retry mechanisms
- Keyboard-friendly navigation
- Screen reader accessibility

## Testing

### Manual Testing Checklist
- [ ] Address suggestions appear as user types
- [ ] ZIP code is extracted and stored
- [ ] Keyboard navigation works (up/down arrows, enter, escape)
- [ ] Fallback mode works when API is unavailable
- [ ] Form auto-advances after address selection
- [ ] Error states display properly
- [ ] Loading states show during API calls

### Test Addresses
- "1600 Pennsylvania Avenue NW, Washington, DC"
- "350 Fifth Avenue, New York, NY"
- "90210" (ZIP code only)
- "123 Main St" (partial address)

## Performance Considerations

1. **Debounced Search**: 300ms delay to reduce API calls
2. **Minimum Query Length**: 3 characters to avoid unnecessary requests
3. **Dynamic Import**: Radar SDK loaded only when needed
4. **Result Caching**: Browser handles HTTP caching
5. **Graceful Degradation**: Fallback mode for poor connections

## Monitoring and Analytics

### Metrics to Track
- API success/failure rates
- Fallback mode usage
- User interaction patterns
- Performance metrics (response times)
- Error rates by type

### Logging
- SDK initialization status
- API call successes/failures
- User actions (address selections, manual entries)
- Error conditions and recovery

## Maintenance

### Regular Tasks
- Monitor API usage and billing
- Update SDK version for security patches
- Review error logs for patterns
- Test fallback modes periodically
- Validate API key rotation

### Troubleshooting
- Check browser console for errors
- Verify environment variables
- Test network connectivity
- Validate API key permissions
- Check Radar service status