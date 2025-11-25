# Buyer Credential Encryption

This document describes the encryption implementation for securing sensitive buyer credentials in the database.

## Overview

All sensitive buyer credentials are encrypted at rest using **AES-256-GCM** (Authenticated Encryption with Associated Data). This provides:

- **Confidentiality**: Data cannot be read without the encryption key
- **Integrity**: Tampered data will fail authentication
- **Authenticity**: Verifies data hasn't been modified

## Encrypted Fields

The following fields in the `buyers` table are encrypted:

1. **authConfig** - API authentication credentials (API keys, bearer tokens, OAuth secrets)
2. **webhookSecret** - HMAC secret for webhook signature verification

## Encryption Algorithm

**Algorithm**: AES-256-GCM
**Key Derivation**: PBKDF2 with SHA-256 (100,000 iterations)
**IV Length**: 128 bits (16 bytes)
**Auth Tag Length**: 128 bits (16 bytes)
**Salt Length**: 256 bits (32 bytes)

### Encrypted Data Format

```
salt:iv:authTag:ciphertext
```

All components are base64-encoded. Example:

```
kj3h8sdf7h2kjsdf...==:9h3kjsdf8h2kjsdf...==:8h2kjsdf7h2kjsdf...==:7h2kjsdf6h2kjsdf...==
```

## Setup

### 1. Generate Encryption Key

Generate a secure 256-bit encryption key:

```bash
openssl rand -base64 32
```

### 2. Set Environment Variable

Add the key to your `.env` file:

```bash
ENCRYPTION_KEY=your_base64_encoded_key_here
```

**IMPORTANT**:
- Never commit the encryption key to version control
- Store production keys in a secure key management service (AWS KMS, Azure Key Vault, etc.)
- Use different keys for development, staging, and production

### 3. Migrate Existing Data

Run the migration script to encrypt existing plaintext credentials:

```bash
# Dry run (preview changes)
tsx scripts/migrate-encrypt-credentials.ts --dry-run

# Apply encryption
tsx scripts/migrate-encrypt-credentials.ts
```

## Usage

### Encrypting Data

```typescript
import { encrypt } from '@/lib/security/encryption';

// Encrypt credentials before storing
const authConfig = { type: 'bearer', token: 'secret-token' };
const encrypted = encrypt(JSON.stringify(authConfig));

await prisma.buyer.create({
  data: {
    authConfig: encrypted,
    // ... other fields
  }
});
```

### Decrypting Data

```typescript
import { decrypt, isEncrypted } from '@/lib/security/encryption';

const buyer = await prisma.buyer.findUnique({ where: { id } });

if (buyer.authConfig) {
  // Decrypt if encrypted, otherwise use as-is (for migration compatibility)
  const configStr = isEncrypted(buyer.authConfig)
    ? decrypt(buyer.authConfig)
    : buyer.authConfig;

  const authConfig = JSON.parse(configStr);
}
```

### Helper Functions

```typescript
import { encryptIfNeeded, isEncrypted } from '@/lib/security/encryption';

// Safely encrypt (won't double-encrypt)
const encrypted = encryptIfNeeded(plaintext);

// Check if data is encrypted
if (isEncrypted(data)) {
  // Handle encrypted data
}
```

## API Implementation

### Buyer Creation (POST /api/admin/buyers)

Credentials are automatically encrypted before storage:

```typescript
const encryptedAuthConfig = encrypt(JSON.stringify(authConfig));
const encryptedWebhookSecret = encrypt(webhookSecret);

await prisma.buyer.create({
  data: {
    authConfig: encryptedAuthConfig,
    webhookSecret: encryptedWebhookSecret,
    // ...
  }
});
```

**Important**: The plaintext `webhookSecret` is returned ONLY on creation so the buyer can configure their webhooks. It's never returned on GET requests.

### Buyer Retrieval (GET /api/admin/buyers)

Credentials are decrypted only when needed (e.g., to show auth type), but full credentials are NEVER exposed:

```typescript
// Decrypt only to extract authType
const configStr = isEncrypted(buyer.authConfig)
  ? decrypt(buyer.authConfig)
  : buyer.authConfig;

const authConfig = JSON.parse(configStr);
const authType = authConfig.type; // Only expose the type, not credentials
```

### Webhook Verification

The webhook secret is decrypted before signature verification:

```typescript
const webhookSecret = isEncrypted(buyer.webhookSecret)
  ? decrypt(buyer.webhookSecret)
  : buyer.webhookSecret;

const isValid = verifyWebhookSignature(body, signature, webhookSecret);
```

## Security Properties

### Authenticated Encryption

AES-GCM provides authenticated encryption:

```typescript
// Tampering with any part of encrypted data will fail
const encrypted = encrypt('secret-data');
const tampered = encrypted.replace('a', 'b');

decrypt(tampered); // Throws: "Decryption failed"
```

### Unique Encryption

Each encryption uses a unique IV and salt:

```typescript
const plaintext = 'same-data';

const encrypted1 = encrypt(plaintext);
const encrypted2 = encrypt(plaintext);

// Different ciphertext due to unique IV and salt
encrypted1 !== encrypted2; // true

// But both decrypt to same plaintext
decrypt(encrypted1) === decrypt(encrypted2); // true
```

### Key Derivation

The master key is combined with a random salt using PBKDF2:

- **100,000 iterations** - Slow down brute-force attacks
- **Unique salt per encryption** - Prevents rainbow table attacks
- **SHA-256 hashing** - Industry-standard hash function

## Migration Guide

### Migrating Existing Data

1. **Backup your database**:
   ```bash
   sqlite3 prisma/dev.db ".backup backup.db"
   ```

2. **Test encryption key**:
   ```bash
   node -e "console.log(process.env.ENCRYPTION_KEY)"
   ```

3. **Dry run migration**:
   ```bash
   tsx scripts/migrate-encrypt-credentials.ts --dry-run
   ```

4. **Apply migration**:
   ```bash
   tsx scripts/migrate-encrypt-credentials.ts
   ```

5. **Verify**:
   ```sql
   SELECT name, LENGTH(authConfig) as auth_len, LENGTH(webhookSecret) as secret_len
   FROM buyers;
   ```

   Encrypted values should be significantly longer (~200-300 characters).

### Rolling Back

If needed, you can restore from backup:

```bash
cp backup.db prisma/dev.db
```

## Key Rotation

To rotate encryption keys:

1. Generate new key:
   ```bash
   openssl rand -base64 32
   ```

2. Update all encrypted records:
   ```typescript
   import { reencrypt } from '@/lib/security/encryption';

   const buyers = await prisma.buyer.findMany();

   for (const buyer of buyers) {
     if (buyer.authConfig) {
       const newAuthConfig = reencrypt(buyer.authConfig, newKey);
       await prisma.buyer.update({
         where: { id: buyer.id },
         data: { authConfig: newAuthConfig }
       });
     }
   }
   ```

3. Update environment variable

4. Verify all records decrypt correctly

## Testing

Run encryption tests:

```bash
npm test -- tests/unit/security/encryption.test.ts --config=jest.config.unit.js
```

Test coverage:
- ✅ Basic encryption/decryption (31 tests)
- ✅ Format validation
- ✅ Error handling
- ✅ Security properties
- ✅ Key generation
- ✅ Migration scenarios

## Troubleshooting

### "ENCRYPTION_KEY environment variable is required"

**Solution**: Ensure `ENCRYPTION_KEY` is set in your `.env` file.

```bash
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
```

### "Decryption failed"

**Possible causes**:
1. Wrong encryption key
2. Corrupted encrypted data
3. Data was tampered with

**Solution**: Check that `ENCRYPTION_KEY` matches the key used for encryption.

### "Invalid encrypted data format"

**Cause**: Data is not in the expected format (salt:iv:authTag:ciphertext).

**Solution**: Verify the data was encrypted with the current implementation.

## Best Practices

1. **Never log encrypted or decrypted credentials**
   ```typescript
   // ❌ BAD
   console.log('Auth config:', authConfig);

   // ✅ GOOD
   console.log('Auth type:', authConfig.type);
   ```

2. **Use encryption helpers**
   ```typescript
   // ✅ GOOD - Prevents double encryption
   const encrypted = encryptIfNeeded(data);

   // ❌ BAD - Might double-encrypt
   const encrypted = encrypt(data);
   ```

3. **Check encryption status**
   ```typescript
   // ✅ GOOD
   const plaintext = isEncrypted(data) ? decrypt(data) : data;

   // ❌ BAD - Assumes always encrypted
   const plaintext = decrypt(data);
   ```

4. **Minimize decryption**
   - Only decrypt when absolutely necessary
   - Store derived fields (like `authType`) separately
   - Never pass decrypted credentials to frontend

5. **Secure key management**
   - Use environment variables (development)
   - Use key management services (production)
   - Rotate keys periodically
   - Never commit keys to version control

## Performance Considerations

- **Encryption**: ~2-5ms per operation
- **Decryption**: ~2-5ms per operation
- **PBKDF2 derivation**: ~100ms (intentionally slow)

For high-throughput applications, consider:
- Caching decrypted credentials (with TTL)
- Using connection pooling
- Batch operations when possible

## Compliance

This encryption implementation helps meet compliance requirements:

- **PCI DSS**: Encryption of cardholder data at rest
- **HIPAA**: Protected Health Information (PHI) encryption
- **GDPR**: Personal data protection
- **SOC 2**: Data encryption controls

## References

- [NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf) - GCM specification
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
