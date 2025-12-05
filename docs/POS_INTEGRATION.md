# POS Integration Guide

## Overview

This document describes how to integrate external Point-of-Sale (POS) systems with the Pass To Vip loyalty platform. The integration supports member lookup, point earning, and point redemption through authenticated webhook endpoints.

## Authentication

All webhook endpoints require API key authentication.

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `x-api-key` | Yes | Your POS API key (format: `pk_live_xxx...`) |
| `Idempotency-Key` | Recommended | Unique key to prevent duplicate transactions |
| `Content-Type` | Yes | `application/json` |
| `X-Request-Id` | Optional | Custom request identifier for tracking |

### Rate Limiting

- Default: 60 requests per minute per API key
- Configurable per-client

## Endpoints

### Base URL

```
Production: https://your-domain.replit.app/api/webhooks/pos
```

---

### POST /lookup

Look up a member by their external ID or scan code.

**Request:**
```json
{
  "externalId": "PUB-abc123"
}
```

Or using scan code:
```json
{
  "scanCode": "PUB-abc123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Member found",
  "data": {
    "member": {
      "id": "uuid-here",
      "external_id": "PUB-abc123",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone": "+15551234567",
      "points_balance": 1250,
      "tier_name": "Gold",
      "status": "INSTALLED",
      "enrollment_source": "SMARTPASS",
      "program_id": "program-uuid",
      "program_name": "Demo Pizza Rewards",
      "created_at": "2024-10-15T10:30:00Z"
    }
  },
  "metadata": {
    "requestId": "req_abc123",
    "timestamp": "2024-12-05T12:00:00Z",
    "processingTime": 45
  }
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Member not found"
  },
  "metadata": {
    "requestId": "req_abc123",
    "timestamp": "2024-12-05T12:00:00Z",
    "processingTime": 12
  }
}
```

---

### POST /earn

Add points to a member's balance.

**Request:**
```json
{
  "externalId": "PUB-abc123",
  "points": 100,
  "transactionRef": "POS-TXN-12345"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Points earned successfully",
  "data": {
    "action": "EARN",
    "externalId": "PUB-abc123",
    "pointsAdded": 100,
    "previousBalance": 1250,
    "newBalance": 1350,
    "transactionId": "txn_1733400000000",
    "transactionRef": "POS-TXN-12345",
    "timestamp": "2024-12-05T12:00:00Z"
  },
  "metadata": {
    "requestId": "req_def456",
    "timestamp": "2024-12-05T12:00:00Z",
    "processingTime": 120
  }
}
```

**Validation Rules:**
- `points` must be a positive integer (1 - 100,000)
- `externalId` is required
- Member must exist and program must not be suspended

---

### POST /redeem

Deduct points from a member's balance.

**Request:**
```json
{
  "externalId": "PUB-abc123",
  "points": 50,
  "transactionRef": "POS-REDEEM-789"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Points redeemed successfully",
  "data": {
    "action": "REDEEM",
    "externalId": "PUB-abc123",
    "pointsRedeemed": 50,
    "previousBalance": 1350,
    "newBalance": 1300,
    "transactionId": "txn_1733400000001",
    "transactionRef": "POS-REDEEM-789",
    "timestamp": "2024-12-05T12:00:05Z"
  },
  "metadata": {
    "requestId": "req_ghi789",
    "timestamp": "2024-12-05T12:00:05Z",
    "processingTime": 95
  }
}
```

**Response (Insufficient Balance):**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient points. Available: 1300",
    "details": {
      "requested": 2000,
      "available": 1300
    }
  },
  "metadata": {
    "requestId": "req_jkl012",
    "timestamp": "2024-12-05T12:00:10Z",
    "processingTime": 55
  }
}
```

---

## Idempotency

To prevent duplicate transactions, include an `Idempotency-Key` header with a unique value for each transaction.

```bash
curl -X POST https://your-domain/api/webhooks/pos/earn \
  -H "x-api-key: pk_live_your_key_here" \
  -H "Idempotency-Key: txn-2024-12-05-unique-123" \
  -H "Content-Type: application/json" \
  -d '{"externalId": "PUB-abc123", "points": 100}'
```

If the same `Idempotency-Key` is sent again, the original response will be returned without re-processing the transaction.

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `MISSING_API_KEY` | 401 | x-api-key header not provided |
| `INVALID_API_KEY` | 401 | API key is invalid or inactive |
| `PROGRAM_SUSPENDED` | 403 | Program is suspended |
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `NOT_FOUND` | 404 | Member not found |
| `INSUFFICIENT_BALANCE` | 400 | Not enough points to redeem |
| `PROCESSING_ERROR` | 500 | Server-side error |

---

## Example Integration (Node.js)

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://your-domain.replit.app/api/webhooks/pos',
  headers: {
    'x-api-key': 'pk_live_your_api_key_here',
    'Content-Type': 'application/json'
  }
});

// Lookup member
async function lookupMember(externalId) {
  const response = await client.post('/lookup', { externalId });
  return response.data;
}

// Earn points
async function earnPoints(externalId, points, transactionRef) {
  const response = await client.post('/earn', {
    externalId,
    points,
    transactionRef
  }, {
    headers: {
      'Idempotency-Key': transactionRef // Use transaction reference as idempotency key
    }
  });
  return response.data;
}

// Redeem points
async function redeemPoints(externalId, points, transactionRef) {
  const response = await client.post('/redeem', {
    externalId,
    points,
    transactionRef
  }, {
    headers: {
      'Idempotency-Key': transactionRef
    }
  });
  return response.data;
}
```

---

## Database Setup

Before using POS integration, apply the following migration to your Supabase database:

```sql
-- Run migrations/011_pos_integration.sql in Supabase SQL Editor
```

This creates:
- `pos_api_keys` - Stores hashed API keys for authentication
- `pos_transactions` - Transaction log with idempotency support

---

## Generating API Keys

API keys are generated via the admin panel or through Supabase:

```sql
-- Example: Generate and insert a new API key
INSERT INTO pos_api_keys (program_id, key_hash, label) 
VALUES (
  'your-program-uuid',
  'sha256_hash_of_pk_live_xxx', -- Use crypto.createHash('sha256').update(key).digest('hex')
  'Store #1 POS'
);
```

API key format: `pk_live_` followed by 48 hex characters.

---

## Security Best Practices

1. **Store API keys securely** - Never expose in client-side code
2. **Use HTTPS only** - All requests must use TLS
3. **Implement idempotency** - Prevent duplicate transactions on network retries
4. **Monitor usage** - Review transaction logs for anomalies
5. **Rotate keys periodically** - Generate new keys and deprecate old ones

---

## Support

For integration support, contact PassToVIP support team.
