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

### 1. Environment Variables (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_URL` | Production URL for QR codes | `https://passtovip.replit.app` |
| `SUPABASE_URL` | Your Supabase project URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (not anon key) | `eyJhbGciOi...` |
| `ADMIN_USERNAME` | Admin dashboard login username | `admin_passtovip` |
| `ADMIN_PASSWORD` | Admin dashboard login password | `Ptv$2024!Secure#Key` |
| `ADMIN_API_KEY` | API key for WeWeb/external calls | `pk_live_passtovip_8f3k9m2x7q` |
| `SESSION_SECRET` | Express session encryption key | Random 32+ char string |

**IMPORTANT:** Before launching mail campaigns, update `APP_URL` to your production domain (e.g., `https://passtovip.replit.app`). QR codes will point to this URL.

### 2. Optional Secrets (For Full Features)

| Secret | Description | Required For |
|--------|-------------|--------------|
| `PASSKIT_API_KEY` | PassKit API credentials | Digital wallet sync |
| `PASSKIT_API_SECRET` | PassKit API secret | Digital wallet sync |
| `POSTGRID_API_KEY` | PostGrid API key | Physical mail campaigns |

### 3. Database Migrations (Run in Supabase Studio)

Run these SQL files in **Supabase Studio > SQL Editor** in order:

| Migration | File | Purpose |
|-----------|------|---------|
| 001 | `migrations/001_performance_indexes.sql` | Performance indexes for queries |
| 002 | `migrations/002_program_suspension.sql` | Kill switch for program suspension |
| 003 | `migrations/003_passkit_tier_id.sql` | PassKit tier ID, PostGrid template ID, protocol columns |
| 004 | `migrations/004_rpc_functions_verification.sql` | Verify & create RPC functions |

### 4. Required Supabase RPC Functions

Your Supabase must have these RPC functions deployed:

| Function | Purpose |
|----------|---------|
| `process_membership_transaction` | Handle MEMBER_EARN, MEMBER_REDEEM, MEMBER_ADJUST actions |
| `process_one_time_use` | Handle COUPON_ISSUE, COUPON_REDEEM, TICKET_CHECKIN actions |
| `generate_claim_code` | Create unique claim codes for mail campaigns |
| `lookup_claim_code` | Look up claim code details for Physical Bridge |
| `update_claim_code_status` | Update claim code after wallet installation |
| `get_service_status` | Health check (optional) |

**To verify:** Run `migrations/004_rpc_functions_verification.sql` - it shows which functions exist and provides templates for missing ones.

---

## Operational Workflow (Client Onboarding)

### Step 1: PassKit (Digital Asset)
1. Create a new Membership/Event project in PassKit
2. Design the card (logo, colors, fields)
3. Configure fields: `points`, `tierLabel`
4. Copy the **Program ID** and **Tier ID**

### Step 2: PostGrid (Physical Asset)
1. Create a new postcard template in PostGrid
2. Add merge variables: `{{firstName}}`, `{{qrCodeUrl}}`
3. Copy the **Template ID**

### Step 3: Provision Tenant
Via WeWeb Admin or API:
- Business Name
- PassKit Program ID
- PassKit Tier ID (from Step 1)
- PostGrid Template ID (from Step 2)
- Protocol: `MEMBERSHIP`, `EVENT_TICKET`, or `COUPON`

### Step 4: Launch Campaign
1. Upload CSV with customer data
2. System generates claim codes
3. PostGrid sends physical mail with QR codes
4. QR codes redirect to `/claim/:id` → PassKit enrollment

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

### Protocol Routing
The system routes POS actions based on protocol:
- `MEMBERSHIP` → `process_membership_transaction` RPC (points earn/redeem)
- `EVENT_TICKET` → `process_one_time_use` RPC (check-in once)
- `COUPON` → `process_one_time_use` RPC (issue/redeem offers)

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

### Physical Bridge (Claim Flow)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/claim/:id` | GET | Process claim code → redirect to PassKit install |
| `/api/claim/:id/status` | GET | Get claim code status |

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
| `programs` | Client programs with PassKit IDs, tier IDs, template IDs, protocol, suspension status |
| `passes_master` | All digital passes with status, points, member info |
| `transactions` | Point earn/redeem history |
| `admin_profiles` | Links Supabase users to programs (multi-tenant) |
| `claim_codes` | Physical bridge claim codes for mail campaigns |

### Programs Table Columns (after migrations)
| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `name` | TEXT | Business name |
| `passkit_program_id` | TEXT | PassKit program identifier |
| `passkit_tier_id` | TEXT | PassKit tier (default: 'base') |
| `postgrid_template_id` | TEXT | PostGrid template for mail |
| `protocol` | TEXT | MEMBERSHIP, EVENT_TICKET, COUPON |
| `is_suspended` | BOOLEAN | Kill switch |
| `birthday_bot_enabled` | BOOLEAN | Auto birthday rewards |

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

### Full Health Check (with services)
```bash
curl http://localhost:5000/api/health
```
Returns status of Supabase, PassKit, and PostGrid connections.

### Test API Key
```bash
curl -H "x-api-key: pk_live_passtovip_8f3k9m2x7q" http://localhost:5000/api/programs
```

---

## Deployment Checklist

Before deploying to production:

- [ ] Set `APP_URL` to production domain (e.g., `https://passtovip.replit.app`)
- [ ] All required secrets configured in Replit Secrets
- [ ] Run `migrations/001_performance_indexes.sql` in Supabase
- [ ] Run `migrations/002_program_suspension.sql` in Supabase
- [ ] Run `migrations/003_passkit_tier_id.sql` in Supabase
- [ ] Verify RPC functions exist using `migrations/004_rpc_functions_verification.sql`
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

### QR codes pointing to localhost
Update `APP_URL` environment variable to your production URL.

### PassKit enrollment fails
1. Check `PASSKIT_API_KEY` and `PASSKIT_API_SECRET` are configured
2. Verify the program ID exists in PassKit
3. Check the tier ID is valid (default: 'base')

### RPC function not found
Run `migrations/004_rpc_functions_verification.sql` in Supabase to check which functions are missing, then create them using the templates provided.
