# Network Lead Buyers

Documentation for all network lead buyer integrations (PING/POST auction partners).

## Active Buyers

| Buyer | Type | Services | Status |
|-------|------|----------|--------|
| [Modernize](./modernize/) | NETWORK | Windows, Roofing, HVAC, Bathrooms | Active |
| [PCM Growth](./PCM%20Growth/) | NETWORK | Windows (zip-only) | **Inactive** - Ready to activate |
| [Koalaty Leads](./koalaty-leads/) | NETWORK | Windows | **Inactive** |
| [PX](./PX/) | NETWORK | Windows, Bathrooms | **Inactive** - Awaiting API Token |

## Directory Structure

```
network-lead-buyers/
├── README.md              # This file
├── modernize/
│   └── windows.md         # (TODO: Add Modernize docs)
├── koalaty-leads/
│   └── windows.md         # Koalaty Leads Windows integration
├── PCM Growth/
│   └── windows.md         # PCM Growth Windows (zip-only) integration
├── PX/
│   └── README.md          # PX Windows & Bathrooms integration
└── Home Appointments/
    └── README.md          # Home Appointments integration
```

## Adding a New Buyer

1. Create a folder: `docs/network-lead-buyers/{buyer-name}/`
2. Add service docs: `{service}.md` (e.g., `windows.md`, `roofing.md`)
3. Include:
   - API endpoints (PING/POST URLs)
   - Authentication/static fields
   - Field mappings with transforms
   - Value mappings
   - Compliance requirements
   - Response handling
   - Database IDs

## Database Tables

| Table | Purpose |
|-------|---------|
| `buyers` | Buyer info, API URL, active status |
| `buyer_service_configs` | Per-service field mappings, URLs |
| `buyer_service_zip_codes` | Geographic coverage |

## Query Buyer Config

```sql
SELECT b.name, st.name as service, bsc.field_mappings
FROM buyers b
JOIN buyer_service_configs bsc ON b.id = bsc.buyer_id
JOIN service_types st ON bsc.service_type_id = st.id
WHERE b.name = 'Buyer Name';
```
