# UI Testing Credentials

## Unified Login

**URL:** https://mycontractornow.com/login

All user types can login from the same page. The system detects your account type and redirects you to the correct dashboard.

## Test Accounts

| User Type | Email | Password | Dashboard |
|-----------|-------|----------|-----------|
| **Super Admin** | `gabe@mycontractornow.com` | `TestAdmin123!` | `/admin` |
| **Affiliate** | `gabe@mycontractornow.com` | `TestAffiliate123!` | `/affiliate/dashboard` |
| **Contractor** | `gabe@mycontractornow.com` | `TestContractor123!` | `/contractor/dashboard` |

## Legacy Direct Login URLs

These still work if needed:
- Admin: `/admin/login`
- Affiliate: `/affiliate/login`
- Contractor: `/contractor/login`

## Notes

- All test accounts use the same email but different passwords
- Change passwords after first login
- Accounts created: 2026-01-26
