# Phygital Loyalty Ecosystem - Backend API

## Overview

A Node.js/Express backend API system for a 'Phygital' Loyalty Ecosystem that integrates digital wallets with physical rewards processing. Built with a strict Service/Controller architecture pattern using Supabase PostgreSQL for data persistence.

## Project Architecture

```
server/
├── config/           # Environment configuration
│   └── index.ts      # Centralized config for Supabase, PassKit, PostGrid
├── services/         # Business logic adapters
│   ├── supabase.service.ts   # Supabase RPC calls for transactions
│   ├── passkit.service.ts    # Digital wallet management
│   ├── postgrid.service.ts   # Direct mail services
│   └── index.ts
├── controllers/      # Request handlers
│   ├── loyalty.controller.ts  # Membership & one-time use processing
│   ├── passkit.controller.ts  # Wallet pass operations
│   ├── postgrid.controller.ts # Mail campaign operations
│   ├── health.controller.ts   # Health check endpoints
│   └── index.ts
├── routes/           # API endpoint definitions
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

## Environment Variables

### Required for Full Functionality
```
SUPABASE_URL=           # Supabase project URL
SUPABASE_ANON_KEY=      # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY=  # Supabase service role key (optional)

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
-- Parameters: p_member_id, p_transaction_type, p_points, p_description, p_metadata, p_store_id, p_pass_serial_number
-- Returns: { transaction_id, new_balance, previous_balance, message }
```

### process_one_time_use
```sql
-- Parameters: p_member_id, p_offer_id, p_redemption_code, p_store_id, p_metadata
-- Returns: { redemption_id, offer_details: { offer_id, offer_name, offer_value }, message }
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
  "data": { ... },
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  },
  "metadata": {
    "requestId": "uuid",
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
- express-validator for request validation
- Zod for schema validation

## Development

Run the development server:
```bash
npm run dev
```

The server binds to port 5000 by default.

## Recent Changes
- Initial API implementation with complete Service/Controller architecture
- Supabase integration with RPC calls for all business logic
- PassKit service adapter for digital wallet management
- PostGrid service adapter for direct mail functionality
- Comprehensive request validation and error handling
- Health check endpoints for deployment monitoring
