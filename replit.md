# Phygital Loyalty Ecosystem - Backend API

## Overview
This project is a Node.js/Express backend API for a 'Phygital' Loyalty Ecosystem that integrates digital wallets with physical rewards processing. Built for **PassToVIP** (passtovip.com / scantovip.com) under OakMontLogic.

The platform bridges physical interactions and digital loyalty programs through:
- Membership point management
- One-time offer redemptions
- Dynamic digital pass creation and updates
- "Physical Bridge" to convert physical mail recipients into digital wallet users

Target industries: Retail, Hospitality, Event Management.

---

## Required Setup

### 1. Environment Secrets (Required)

These secrets MUST be configured in Replit Secrets for the application to work:

| Secret | Description | Example |
|--------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (not anon key) | `eyJhbGciOi...` |
| `ADMIN_USERNAME` | Admin dashboard login username | `admin_passtovip` |
| `ADMIN_PASSWORD` | Admin dashboard login password | `Ptv$2024!Secure#Key` |
| `ADMIN_API_KEY` | API key for WeWeb/external calls | `pk_live_passtovip_8f3k9m2x7q` |
| `SESSION_SECRET` | Express session encryption key | Random 32+ char string |

### 2. Optional Secrets (For Full Features)

| Secret | Description | Required For |
|--------|-------------|--------------|
| `PASSKIT_API_KEY` | PassKit API credentials | Digital wallet sync |
| `PASSKIT_API_SECRET` | PassKit API secret | Digital wallet sync |
| `POSTGRID_API_KEY` | PostGrid API key | Physical mail campaigns |

### 3. Database Migrations (Run in Supabase Studio)

Run these SQL files in **Supabase Studio > SQL Editor** in order:

**Migration 1: Performance Indexes**
```
migrations/001_performance_indexes.sql
```
Adds indexes for high-frequency queries (program filtering, status charts, transaction history).

**Migration 2: Program Suspension (Kill Switch)**
```
migrations/002_program_suspension.sql
```
Adds `is_suspended` column to programs table for instant client shutoff.

---

## User Preferences

- Iterative development preferred
- Ask before making major changes to the codebase
- Detailed explanations for new features or complex logic
- Do NOT modify the `/admin` folder

---

## System Architecture

### Core Design
- **Controllers:** Manage API requests and delegate to services
- **Services:** Encapsulate business logic and handle integrations (Supabase, PassKit, PostGrid)
- **Logic Service:** Orchestrates POS actions, routing to Supabase RPC + PassKit sync
- **Data Flow:** Client Request → Controller → `logic.service.ts` → Supabase RPC + `passkit.service.ts`

### File Structure
```
server/
├── controllers/       # API request handlers
├── services/          # Business logic & integrations
├── middleware/        # Auth, validation, rate limiting
├── routes/            # Express route definitions
├── config/            # Configuration & environment
└── index.ts           # Server entry point

migrations/            # SQL migrations for Supabase
public/                # Static files (admin dashboard)
```

---

## API Endpoints

### Authentication
All API endpoints require the `x-api-key` header:
```
x-api-key: pk_live_passtovip_8f3k9m2x7q
```

### POS Actions
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pos/action` | POST | Process POS transaction (earn, redeem, coupon) |

Supported actions: `MEMBER_EARN`, `MEMBER_REDEEM`, `MEMBER_ADJUST`, `COUPON_ISSUE`, `COUPON_REDEEM`, `TICKET_CHECKIN`

### WeWeb Integration APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/programs` | GET | List all programs with birthday bot config |
| `/api/programs/:programId` | GET | Get single program by UUID |
| `/api/programs/:programId` | PATCH | Update birthday bot settings |
| `/api/customers?programId=...` | GET | List customers with pagination |
| `/api/customers/stats?programId=...` | GET | Dashboard stats (total, active rate) |
| `/api/customers/:customerId` | GET | Customer detail with transaction history |

### Notifications
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notify/broadcast` | POST | Send push to all active passes in a program |
| `/api/notify/targeted` | POST | Send push to specific passes |

### Admin Dashboard
| Endpoint | Method | Auth |
|----------|--------|------|
| `/admin/campaign` | GET | Basic Auth (username/password) |

---

## External Dependencies

### Supabase (Required)
- **Database:** PostgreSQL for loyalty data, members, transactions, claim codes
- **Authentication:** User authentication for client dashboards
- **RPC Functions:** Stored procedures for core loyalty logic

### PassKit (Optional)
- **Digital Wallet Management:** Creates/updates Apple & Google Wallet passes
- **Push Notifications:** Real-time updates to wallet holders

### PostGrid (Optional)
- **Direct Mail:** Sends physical postcards and letters
- **Template Management:** Dynamic content in physical mail

---

## Production Security Features

### Multi-Tenant Isolation
- Invalid/non-existent `programId` returns empty data (not cross-tenant data)
- Zero-state handling: New clients get clean `{ total: 0, activeRate: 0 }` responses

### Rate Limiting
| Route | Limit | Purpose |
|-------|-------|---------|
| `/api/pos/*` | 60/min | Prevent brute-force scanning |
| `/api/notify/*` | 10/min | Prevent notification spam |

### Input Validation
- All `programId` params/queries validated as UUID format
- Malformed inputs return 400 Bad Request
- Prevents SQL injection attempts

### Duplicate Prevention
- `createTenant` validates unique business name + PassKit program ID
- Prevents accidental duplicate program creation

### Kill Switch (Program Suspension)
- Set `is_suspended = true` in programs table
- Blocks ALL POS transactions for that client immediately
- Error: "Program Suspended. Contact Admin."

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `programs` | Client programs with PassKit IDs, birthday bot config, suspension status |
| `passes_master` | All digital passes with status, points, member info |
| `transactions` | Point earn/redeem history |
| `admin_profiles` | Links Supabase users to programs (multi-tenant) |
| `claim_codes` | Physical bridge claim codes for mail campaigns |

### Performance Indexes
After running `migrations/001_performance_indexes.sql`:
- `idx_passes_master_program_id` - Client filtering
- `idx_passes_master_status` - Active/Churned charts
- `idx_passes_master_program_status` - Composite queries
- `idx_transactions_pass_id` - Transaction history
- `idx_transactions_created_at` - Date ordering

---

## Running the Application

### Development
The workflow `Start application` runs:
```bash
npm run dev
```
This starts Express server + Vite frontend on port 5000.

### Health Check
```bash
curl http://localhost:5000/api
```
Returns: `{ "status": "UP", "service": "Phygital Loyalty Orchestrator" }`

### Test API Key
```bash
curl -H "x-api-key: pk_live_passtovip_8f3k9m2x7q" http://localhost:5000/api/programs
```

---

## Deployment Checklist

Before deploying to production:

- [ ] All required secrets configured in Replit Secrets
- [ ] Run `migrations/001_performance_indexes.sql` in Supabase
- [ ] Run `migrations/002_program_suspension.sql` in Supabase
- [ ] Test API endpoints with production API key
- [ ] Verify WeWeb dashboard connects successfully
- [ ] Configure PassKit credentials (if using digital wallets)
- [ ] Configure PostGrid credentials (if using physical mail)

---

## Troubleshooting

### "Supabase is not configured"
Missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` secrets.

### "Invalid API key"
Check `x-api-key` header matches `ADMIN_API_KEY` secret.

### "programId must be a valid UUID format"
The programId parameter must be a valid UUID (e.g., `941f4975-6e0a-4ae0-9c47-de4b96404139`).

### "Program Suspended. Contact Admin."
The program has `is_suspended = true`. Update in Supabase to re-enable.

### Dashboard returns empty data
1. Verify `programId` exists in `programs` table
2. Check that passes exist in `passes_master` with matching `program_id`
3. Ensure indexes are created for performance
