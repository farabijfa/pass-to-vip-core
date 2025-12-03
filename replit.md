# Phygital Loyalty Ecosystem - Backend API

## Overview

A Node.js/Express backend API system for a 'Phygital' Loyalty Ecosystem that integrates digital wallets with physical rewards processing. Built with a strict Service/Controller architecture pattern using Supabase PostgreSQL for data persistence.

## Project Architecture

```
server/
├── config/           # Environment configuration
│   ├── index.ts      # Centralized config for Supabase, PassKit, PostGrid
│   └── supabase.ts   # Supabase client initialization
├── utils/            # Utility functions
│   └── passkitJWT.ts # JWT token generation for PassKit API auth
├── services/         # Business logic adapters
│   ├── supabase.service.ts   # Supabase RPC calls for transactions
│   ├── passkit.service.ts    # Digital wallet management + syncPass (production ready)
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

PASSKIT_API_KEY=        # PassKit API key (from PassKit dashboard)
PASSKIT_API_SECRET=     # PassKit API secret (from PassKit dashboard)

POSTGRID_API_URL=       # PostGrid API URL (default: https://api.postgrid.com/print-mail/v1)
POSTGRID_API_KEY=       # PostGrid API key

CORS_ORIGINS=           # Comma-separated list of allowed origins
```

## PassKit Integration (Production)

The PassKit service (`server/services/passkit.service.ts`) connects to the PassKit API at `https://api.pub2.passkit.io` (US region).

### Authentication
- Uses JWT tokens generated by `server/utils/passkitJWT.ts`
- Tokens are short-lived (60 seconds) for security
- Tokens are generated using `PASSKIT_API_KEY` and `PASSKIT_API_SECRET`

### Mock Mode
If `PASSKIT_API_KEY` or `PASSKIT_API_SECRET` are not set, the service falls back to mock mode:
- Logs sync operations to console
- Returns success without making API calls
- Allows local development without PassKit credentials

### Sync Protocol Routing
The `syncPass` function routes to different PassKit endpoints based on protocol:
- `MEMBERSHIP` → `PUT /members/member/{id}` - Updates member points balance
- `COUPON` → `PUT /coupons/coupon/{id}/redeem` - Redeems coupon
- `EVENT_TICKET` → `PUT /flights/boardingPass/{id}/redeem` - Checks in ticket

### Push Notifications
The `changeMessage` field triggers lock screen push notifications on the user's device when the pass is updated.

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
- **PassKit Production Integration** (2025-12-03)
  - Created `server/utils/passkitJWT.ts` for JWT token generation
  - Updated `passkit.service.ts` with real API calls to `https://api.pub2.passkit.io` (US region)
  - Added mock mode fallback when API keys are not configured
  - Implemented protocol-based routing (MEMBERSHIP, COUPON, EVENT_TICKET)
- Added POS action endpoint (`/api/pos/action`) for Softr integration
- Created Logic Service as the main orchestrator for action routing
- Added syncPass method to PassKit service for automatic wallet sync
- Created dedicated Supabase client initialization
- Enhanced startup console messages with service status banner
- Added security headers via helmet and request logging via morgan
