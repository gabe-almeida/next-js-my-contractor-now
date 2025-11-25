# Compliance Field Mappings - Buyer Configuration Guide

## Overview

The platform supports **custom compliance field mappings** for each buyer. This allows each lead buyer to specify exactly what field names they expect for compliance data like TrustedForm certificates, Jornaya LeadIDs, TCPA consent, etc.

## How It Works

When compliance data is included in PING or POST requests, the Template Engine maps internal compliance data to buyer-specific field names defined in their configuration.

### Data Flow

```
Internal Data → Buyer Field Mappings → Payload Sent to Buyer
```

**Example:**
```javascript
// Internal data
lead.trustedFormCertUrl = "https://cert.trustedform.com/abc-123"

// Modernize field mappings
complianceFieldMappings: {
  trustedForm: {
    certUrl: ['trustedform_cert_url', 'tf_certificate']
  }
}

// Payload sent to Modernize
{
  "trustedform_cert_url": "https://cert.trustedform.com/abc-123",
  "tf_certificate": "https://cert.trustedform.com/abc-123"
}
```

---

## Configuration Structure

### Type Definition

```typescript
interface ComplianceFieldMappings {
  trustedForm?: {
    certUrl?: string[];      // TrustedForm certificate URL field names
    certId?: string[];       // TrustedForm certificate ID/token field names
  };
  jornaya?: {
    leadId?: string[];       // Jornaya LeadID field names
  };
  tcpa?: {
    consent?: string[];      // TCPA consent flag field names
    timestamp?: string[];    // Consent timestamp field names
  };
  technical?: {
    ipAddress?: string[];    // IP address field names
    userAgent?: string[];    // User agent field names
    timestamp?: string[];    // Submission timestamp field names
  };
  geo?: {
    latitude?: string[];     // Latitude field names
    longitude?: string[];    // Longitude field names
    city?: string[];         // City field names
    state?: string[];        // State field names
  };
}
```

### Location in Buyer Config

```typescript
// In src/lib/buyers/configurations.ts

private static modernizeGlobalSettings(): BuyerGlobalSettings {
  return {
    // ... other settings ...
    complianceFieldMappings: {
      trustedForm: {
        certUrl: ['trustedform_cert_url', 'tf_certificate'],
        certId: ['trustedform_token', 'tf_cert_id']
      },
      jornaya: {
        leadId: ['leadid_token', 'jornaya_lead_id']
      }
      // ... etc
    }
  };
}
```

---

## Current Buyer Configurations

### Modernize

```typescript
complianceFieldMappings: {
  trustedForm: {
    certUrl: ['trustedform_cert_url', 'tf_certificate'],
    certId: ['trustedform_token', 'tf_cert_id']
  },
  jornaya: {
    leadId: ['leadid_token', 'jornaya_lead_id']
  },
  tcpa: {
    consent: ['tcpa_consent', 'consent_given'],
    timestamp: ['consent_date']
  },
  technical: {
    ipAddress: ['ip_address'],
    userAgent: ['user_agent'],
    timestamp: ['submit_timestamp']
  },
  geo: {
    latitude: ['lat'],
    longitude: ['lng'],
    city: ['city_name'],
    state: ['state_code']
  }
}
```

**Example Payload:**
```json
{
  "zip_code": "90210",
  "homeowner": "yes",
  "window_count": 12,
  "trustedform_cert_url": "https://cert.trustedform.com/abc-123",
  "tf_certificate": "https://cert.trustedform.com/abc-123",
  "trustedform_token": "abc-123-def",
  "tf_cert_id": "abc-123-def",
  "leadid_token": "jornaya-789",
  "jornaya_lead_id": "jornaya-789",
  "tcpa_consent": true,
  "consent_given": true,
  "consent_date": "2025-10-20T15:30:00Z",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "submit_timestamp": "2025-10-20T15:30:00Z",
  "lat": 34.0522,
  "lng": -118.2437,
  "city_name": "Beverly Hills",
  "state_code": "CA"
}
```

---

### HomeAdvisor

```typescript
complianceFieldMappings: {
  trustedForm: {
    certUrl: ['tf_cert_url', 'certificate_url', 'trustedform_url'],
    certId: ['tf_token', 'certificate_token']
  },
  jornaya: {
    leadId: ['universal_leadid', 'jornaya_token', 'lead_identifier']
  },
  tcpa: {
    consent: ['consent_status', 'tcpa_flag', 'opt_in'],
    timestamp: ['consent_timestamp', 'opt_in_time']
  },
  technical: {
    ipAddress: ['client_ip', 'source_ip'],
    userAgent: ['browser_string', 'user_agent_string'],
    timestamp: ['submission_time', 'received_at']
  },
  geo: {
    latitude: ['geo_lat', 'location_lat'],
    longitude: ['geo_lon', 'location_lon'],
    city: ['customer_city', 'location_city'],
    state: ['customer_state', 'location_state']
  }
}
```

**Example Payload:**
```json
{
  "postal_code": "90210",
  "owns_property": true,
  "num_windows": 12,
  "tf_cert_url": "https://cert.trustedform.com/abc-123",
  "certificate_url": "https://cert.trustedform.com/abc-123",
  "trustedform_url": "https://cert.trustedform.com/abc-123",
  "tf_token": "abc-123-def",
  "certificate_token": "abc-123-def",
  "universal_leadid": "jornaya-789",
  "jornaya_token": "jornaya-789",
  "lead_identifier": "jornaya-789",
  "consent_status": true,
  "tcpa_flag": true,
  "opt_in": true,
  "consent_timestamp": "2025-10-20T15:30:00Z",
  "opt_in_time": "2025-10-20T15:30:00Z",
  "client_ip": "192.168.1.100",
  "source_ip": "192.168.1.100",
  "browser_string": "Mozilla/5.0...",
  "user_agent_string": "Mozilla/5.0...",
  "submission_time": "2025-10-20T15:30:00Z",
  "received_at": "2025-10-20T15:30:00Z",
  "geo_lat": 34.0522,
  "location_lat": 34.0522,
  "geo_lon": -118.2437,
  "location_lon": -118.2437,
  "customer_city": "Beverly Hills",
  "location_city": "Beverly Hills",
  "customer_state": "CA",
  "location_state": "CA"
}
```

---

### Angi

```typescript
complianceFieldMappings: {
  trustedForm: {
    certUrl: ['cert_url'],
    certId: ['cert_id']
  },
  jornaya: {
    leadId: ['leadid', 'jornaya_id']
  },
  tcpa: {
    consent: ['consent', 'opted_in'],
    timestamp: ['consent_time']
  },
  technical: {
    ipAddress: ['ip'],
    userAgent: ['agent'],
    timestamp: ['timestamp']
  },
  geo: {
    latitude: ['latitude'],
    longitude: ['longitude'],
    city: ['city'],
    state: ['state']
  }
}
```

**Example Payload:**
```json
{
  "zip": "90210",
  "homeowner_status": "owner",
  "timeline": "1-3 months",
  "cert_url": "https://cert.trustedform.com/abc-123",
  "cert_id": "abc-123-def",
  "leadid": "jornaya-789",
  "jornaya_id": "jornaya-789",
  "consent": true,
  "opted_in": true,
  "consent_time": "2025-10-20T15:30:00Z",
  "ip": "192.168.1.100",
  "agent": "Mozilla/5.0...",
  "timestamp": "2025-10-20T15:30:00Z",
  "latitude": 34.0522,
  "longitude": -118.2437,
  "city": "Beverly Hills",
  "state": "CA"
}
```

---

## Adding a New Buyer

When adding a new buyer, define their compliance field mappings:

```typescript
private static newBuyerGlobalSettings(): BuyerGlobalSettings {
  return {
    // ... standard settings ...
    complianceFieldMappings: {
      trustedForm: {
        certUrl: ['their_cert_field', 'backup_cert_field'],
        certId: ['their_token_field']
      },
      jornaya: {
        leadId: ['their_leadid_field']
      },
      tcpa: {
        consent: ['their_consent_field'],
        timestamp: ['their_timestamp_field']
      },
      technical: {
        ipAddress: ['their_ip_field'],
        userAgent: ['their_ua_field'],
        timestamp: ['their_submit_time_field']
      },
      geo: {
        latitude: ['their_lat_field'],
        longitude: ['their_lon_field'],
        city: ['their_city_field'],
        state: ['their_state_field']
      }
    }
  };
}
```

### Multi-Field Support

Each mapping supports **multiple field names** (array of strings). This allows:

1. **Primary + Backup Fields**: Send the same data to multiple field names for compatibility
2. **Legacy Support**: Support old field names while transitioning to new ones
3. **Redundancy**: Ensure buyer receives data even if they change field names

**Example:**
```typescript
trustedForm: {
  certUrl: ['primary_field', 'legacy_field', 'backup_field']
}
```

Will generate:
```json
{
  "primary_field": "https://cert.trustedform.com/abc-123",
  "legacy_field": "https://cert.trustedform.com/abc-123",
  "backup_field": "https://cert.trustedform.com/abc-123"
}
```

---

## Default Mappings

If a buyer doesn't specify `complianceFieldMappings`, the system uses defaults:

```typescript
// From src/lib/templates/engine.ts:getDefaultComplianceFieldMappings()

{
  trustedForm: {
    certUrl: ['xxTrustedFormCertUrl', 'trusted_form_cert_url'],
    certId: ['xxTrustedFormToken', 'trusted_form_token']
  },
  jornaya: {
    leadId: ['universal_leadid', 'jornaya_leadid', 'leadid']
  },
  tcpa: {
    consent: ['tcpa_consent', 'opt_in_consent', 'marketing_consent'],
    timestamp: ['consent_timestamp']
  },
  technical: {
    ipAddress: ['ip_address', 'client_ip'],
    userAgent: ['user_agent', 'browser_info'],
    timestamp: ['submission_timestamp']
  },
  geo: {
    latitude: ['latitude'],
    longitude: ['longitude'],
    city: ['city'],
    state: ['state']
  }
}
```

---

## Adding New Service Types

When adding a new service type to an existing buyer (e.g., "HVAC" for Modernize):

**You don't need to update compliance mappings!**

Compliance field mappings are defined at the **buyer level** (in `globalSettings`), not the service level. All service types for that buyer will automatically use the same compliance field mappings.

**Example:**
```typescript
// Add new HVAC service for Modernize
private static modernizeHvacConfig(): BuyerServiceConfig {
  return {
    buyerId: 'modernize',
    serviceTypeId: 'hvac',
    // ... pricing, mappings, etc ...
    pingTemplate: {
      mappings: [/* HVAC-specific fields */],
      includeCompliance: true  // ✅ Uses Modernize's global compliance mappings
    }
  };
}
```

---

## Benefits of This Approach

1. **Buyer Flexibility**: Each buyer can use their own field names
2. **Future-Proof**: Add new buyers or services without touching existing configs
3. **No Hardcoding**: Field names aren't hardcoded in the template engine
4. **Backwards Compatible**: Defaults ensure existing buyers work without changes
5. **Multi-Field Support**: Send compliance data to multiple field names for redundancy
6. **Type-Safe**: TypeScript ensures correct configuration structure

---

## Testing Compliance Mappings

To verify a buyer receives correct field names:

1. **Inspect Transaction Logs**: Check `payload` field in database
2. **Network Monitoring**: Use buyer's webhook logs to see actual requests
3. **Unit Tests**: Test `TemplateEngine.addComplianceFields()` with buyer configs
4. **Integration Tests**: Test full PING/POST flow with real buyer configs

---

## Related Files

- **Type Definitions**: `src/lib/templates/types.ts`
- **Template Engine**: `src/lib/templates/engine.ts`
- **Buyer Configurations**: `src/lib/buyers/configurations.ts`
- **Auction Engine**: `src/lib/auction/engine.ts`

---

## Summary

The compliance field mapping system provides:
- ✅ **Complete flexibility** for buyer-specific field names
- ✅ **Automatic application** across all service types per buyer
- ✅ **No code changes** needed when adding new service types
- ✅ **Multiple field names** per data point for redundancy
- ✅ **Type-safe** configuration with TypeScript
- ✅ **Backwards compatible** with sensible defaults
