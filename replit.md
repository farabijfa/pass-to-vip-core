# Phygital Loyalty Ecosystem - Backend API

## Overview

A Node.js/Express backend API system for a 'Phygital' Loyalty Ecosystem that integrates digital wallets with physical rewards processing. Built with a strict Service/Controller architecture pattern using Supabase PostgreSQL for data persistence.

## Project Architecture

```
server/
├── config/           # Environment configuration
│   ├── index.ts      # Centralized config for Supabase, PassKit, PostGrid
│   └── supabase.ts   # Supabase client initialization
├── services/         # Business logic adapters
│   ├── supabase.service.ts   # Supabase RPC calls for transactions
│   ├── passkit.service.ts    # Digital wallet management + syncPass
│   ├── postgrid.service.ts   # Direct mail services
│   ├── logic.service.ts      # Main orchestrator (The Brain)
│   └── index.ts
├── controllers/      # Request handlers
│   ├── loyalty.controller.ts  # Membership & one-time use processing
│   ├── passkit.controller.ts  # Wallet pass operations
│   ├── postgrid.controller.ts # Mail campaign operations
│   ├── health.controller.ts   # Health check endpoints
│   └── index.ts
├── routes/           # API endpoint definitions
│   ├── pos.routes.ts         # POS action endpoint (Softr integration)
│   ├── loyalty.routes.ts
│   ├── passkit.routes.ts
│   ├── postgrid.routes.ts
│   ├── health.routes.ts
│   └── index.ts
├── middleware/       # Express middleware
│   ├── validation.middleware.ts  # Request validation
│   ├── error.middleware.ts       # Error handling
│   ├── requestId.middleware.ts   # Request tracking
│   └── index.ts
├── routes.ts         # Main route registration
├── index.ts          # Express server entry point
└── storage.ts        # Storage interface (if needed)
```

## API Endpoints

### POS Actions (Softr Integration)
- `POST /api/pos/action` - Process POS action (MEMBER_EARN, MEMBER_REDEEM, COUPON_REDEEM, etc.)
- `GET /api/pos/actions` - List available action types

### Loyalty Operations
- `POST /api/loyalty/membership` - Process membership transaction (earn/redeem/adjust/expire points)
- `POST /api/loyalty/one-time-use` - Process one-time offer redemption
- `GET /api/loyalty/members/:memberId/balance` - Get member points balance
- `GET /api/loyalty/members/:memberId/transactions` - Get transaction history

### Digital Wallet (PassKit)
- `POST /api/wallet/passes` - Create new digital wallet pass
- `GET /api/wallet/passes/:serialNumber` - Get pass details
- `PATCH /api/wallet/passes/:serialNumber` - Update pass
- `DELETE /api/wallet/passes/:serialNumber` - Delete pass
- `POST /api/wallet/passes/:serialNumber/push` - Send push notification

### Direct Mail (PostGrid)
- `POST /api/mail/mail` - Send direct mail piece
- `GET /api/mail/mail/:mailId` - Get mail status
- `DELETE /api/mail/mail/:mailId` - Cancel pending mail
- `GET /api/mail/templates` - List available templates

### Health Checks
- `GET /api/health` - Full health check with service statuses
- `GET /api/health/ready` - Readiness probe for deployments
- `GET /api/health/live` - Liveness probe for deployments

## POS Action Endpoint

The main endpoint for Softr button integration:

```bash
POST /api/pos/action
Content-Type: application/json

{
  "external_id": "QR_CODE_OR_PIN",
  "action": "MEMBER_EARN",
  "amount": 100
}
```

### Supported Actions

**Membership Actions** (require `amount`):
- `MEMBER_EARN` - Add points to member balance
- `MEMBER_REDEEM` - Deduct points from member balance
- `MEMBER_ADJUST` - Adjust points (positive or negative)

**One-Time Actions**:
- `COUPON_REDEEM` - Redeem a coupon code
- `TICKET_CHECKIN` - Check in a ticket
- `INSTALL` - Record pass installation
- `UNINSTALL` - Record pass removal

### Response Format

```json
{
  "success": true,
  "message": "Points earned successfully",
  "data": {
    "transaction_id": "txn_123",
    "new_balance": 1100,
    "previous_balance": 1000,
    "notification_message": "You earned 100 points!"
  },
  "metadata": {
    "requestId": "abc123",
    "timestamp": "2025-12-03T16:30:00.000Z",
    "processingTime": 45
  }
}
```

## Logic Service (The Brain)

The `logic.service.ts` orchestrates all POS actions:

1. **Intelligent Routing**: Routes to correct Supabase RPC based on action type
2. **Atomic Execution**: Calls Supabase stored procedures
3. **PassKit Sync**: Updates digital wallet after successful transactions

## Environment Variables

### Required for Full Functionality
```
SUPABASE_URL=           # Supabase project URL
SUPABASE_ANON_KEY=      # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY=  # Supabase service role key (recommended for backend)

PASSKIT_API_URL=        # PassKit API URL (default: https://api.passkit.com)
PASSKIT_API_KEY=        # PassKit API key
PASSKIT_API_SECRET=     # PassKit API secret

POSTGRID_API_URL=       # PostGrid API URL (default: https://api.postgrid.com/print-mail/v1)
POSTGRID_API_KEY=       # PostGrid API key

CORS_ORIGINS=           # Comma-separated list of allowed origins
```

## Supabase RPC Functions

The backend expects these stored procedures in Supabase:

### process_membership_transaction
```sql
-- Parameters: p_external_id, p_action, p_amount
-- Returns: { transaction_id, new_balance, previous_balance, notification_message, passkit_internal_id }
```

### process_one_time_use
```sql
-- Parameters: p_external_id, p_action
-- Returns: { redemption_id, notification_message, passkit_internal_id, offer_details }
```

### get_member_balance
```sql
-- Parameters: p_member_id
-- Returns: { balance }
```

### get_member_transaction_history
```sql
-- Parameters: p_member_id, p_limit, p_offset
-- Returns: Array of transaction records
```

## API Response Format

All responses follow a consistent format:

```json
{
  "success": true|false,
  "message": "Human readable message",
  "data": { ... },
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  },
  "metadata": {
    "requestId": "short-uuid",
    "timestamp": "ISO8601",
    "processingTime": 123
  }
}
```

## Tech Stack
- Node.js with Express.js framework
- TypeScript for type safety
- Supabase PostgreSQL for database
- axios for external API calls
- helmet for security headers
- morgan for HTTP request logging
- short-uuid for readable request IDs
- express-validator for request validation
- Zod for schema validation

## Development

Run the development server:
```bash
npm run dev
```

The server binds to port 5000 by default.

## Recent Changes
- Added POS action endpoint (`/api/pos/action`) for Softr integration
- Created Logic Service as the main orchestrator for action routing
- Added syncPass method to PassKit service for automatic wallet sync
- Created dedicated Supabase client initialization
- Enhanced startup console messages with service status banner
- Added security headers via helmet and request logging via morgan
