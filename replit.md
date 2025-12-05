# Pass To VIP - Phygital Loyalty Ecosystem

## Overview
Multi-tenant SaaS platform bridging physical mail and digital wallets. Developed for **Pass To VIP** (passtovip.com / scantovip.com), operated by **Oakmont Logic LLC**.

**Support Contact:** support@passtovip.com

**Key Capabilities:**
- React client dashboard with analytics, member management, and POS simulator
- JWT authentication with role-based access control (SUPER_ADMIN, PLATFORM_ADMIN, CLIENT_ADMIN)
- Dual QR/barcode scanning (keyboard-wedge external scanners + mobile camera)
- Digital wallet integration (Apple Wallet, Google Pay via PassKit)
- Physical mail campaigns (postcards/letters via PostGrid)
- Unique enrollment URLs per client via dashboard_slug

**Three Enrollment Verticals:**
- **Vertical A (Push):** Direct mail campaigns with claim codes
- **Vertical B (Pull):** Reception QR codes for walk-in enrollment
- **Vertical C (EDDM):** High-volume neighborhood blanket campaigns

**Target Industries:** Retail, Hospitality, Event Management.

## User Preferences
- Iterative development preferred
- Ask before making major changes to the codebase
- Detailed explanations for new features or complex logic
- Do NOT modify the `/admin` folder (legacy HTML pages)

## Design System

### USA Patriotic Color Scheme
| Color | HSL Value | Hex | Usage |
|-------|-----------|-----|-------|
| Primary Blue | `hsl(215, 74%, 45%)` | `#2563eb` | Buttons, active states, positive actions |
| Secondary Red | `hsl(356, 72%, 48%)` | `#dc2626` | Warnings, churned status, redeem actions |
| White | - | `#ffffff` | Backgrounds, cards |

### Branding Elements
- **Header:** "Pass To VIP" logo with program name
- **Footer:** "Operated by Oakmont Logic LLC"
- **Support:** support@passtovip.com

## System Architecture

### File Structure
```
├── client/                    # React frontend (Vite + TailwindCSS + shadcn/ui)
│   └── src/
│       ├── components/        # UI components
│       │   ├── ui/           # shadcn/ui base components
│       │   └── app-sidebar.tsx
│       ├── pages/            # Route pages
│       │   ├── login.tsx     # JWT authentication
│       │   ├── dashboard.tsx # Program overview
│       │   ├── analytics.tsx # Enrollment charts, retention
│       │   ├── members.tsx   # Searchable member list
│       │   ├── pos.tsx       # POS simulator with dual scanning
│       │   └── admin-clients.tsx # Platform admin
│       ├── lib/
│       │   ├── auth.tsx      # AuthContext with JWT
│       │   ├── api.ts        # Authenticated API client
│       │   └── queryClient.ts
│       └── index.css         # Tailwind + theme variables
├── server/
│   ├── controllers/          # Request handlers
│   ├── services/             # Business logic
│   │   ├── logic.service.ts  # POS orchestrator
│   │   ├── passkit.service.ts
│   │   ├── passkit-provision.service.ts  # Auto-provisioning orchestrator
│   │   ├── postgrid.service.ts
│   │   └── supabase.service.ts
│   ├── routes/
│   │   ├── client.routes.ts  # Dashboard API (JWT auth)
│   │   ├── pos.routes.ts     # Internal POS (JWT auth)
│   │   └── webhook.routes.ts # External POS (API key)
│   ├── middleware/
│   └── index.ts
├── migrations/               # SQL for Supabase
├── docs/
│   └── POS_INTEGRATION.md   # External POS webhook guide
└── design_guidelines.md     # UI/UX specifications
```

### Core Design
- **Controllers:** Handle API requests and delegate tasks
- **Services:** Encapsulate business logic (Supabase, PassKit, PostGrid)
- **Logic Service:** Orchestrates POS actions → Supabase RPC + PassKit sync
- **Data Flow:** Client → Controller → `logic.service.ts` → Supabase RPC + `passkit.service.ts`

### Protocol Routing
- `MEMBERSHIP`: Points earn/redeem via `process_membership_transaction` RPC
- `EVENT_TICKET`: One-time check-ins via `process_one_time_use` RPC
- `COUPON`: Coupon issue/redeem via `process_one_time_use` RPC

### PassKit Auto-Provisioning

The `passkit-provision.service.ts` orchestrates automatic digital wallet program creation:

**Flow:** Program → Tier → Enrollment URL

| Step | API Endpoint | Result |
|------|--------------|--------|
| 1. Create Program | POST `/members/program` | `programId` |
| 2. Create Tier | POST `/members/tier` | `tierId` |
| 3. Get Enrollment URL | GET `/members/tier/{tierId}/links` | Apple/Google URLs |

**Soft-Fail Approach:**
- Client provisioning continues even if PassKit API fails
- Response includes `passkitStatus`: `provisioned`, `manual_required`, or `skipped`
- Wallet integration can be manually configured later if auto-provisioning fails

**Provisioning Status Values:**
| Status | Description |
|--------|-------------|
| `pending` | Provisioning in progress (retry attempt) |
| `provisioned` | PassKit program/tier created automatically |
| `manual_required` | Auto-provision failed; manual setup needed |
| `skipped` | Protocol doesn't support auto-provisioning |

## Client Dashboard Pages

| Page | Path | Description |
|------|------|-------------|
| Login | `/login` | JWT authentication with Supabase |
| Dashboard | `/dashboard` | Program overview, quick stats |
| Analytics | `/analytics` | Enrollment charts, retention rates, source breakdown |
| Members | `/members` | Searchable/paginated member list |
| POS Simulator | `/pos` | Dual-mode scanning, earn/redeem points |
| Admin Clients | `/admin/clients` | Platform admin client management |

## POS Simulator Features

### Dual Scanning Modes
| Mode | Description | Use Case |
|------|-------------|----------|
| **Keyboard Wedge** | USB/Bluetooth scanners type + Enter | Retail counters, fixed POS |
| **Camera Scan** | Mobile camera via html5-qrcode | Mobile staff, pop-ups |

### Smart Code Parser
Automatically extracts member IDs from various formats:
```
URL: https://example.com/member?code=PUB-ABC123 → PUB-ABC123
Path: https://example.com/claim/CLM-XYZ789 → CLM-XYZ789
Raw: pub-abc123 → PUB-ABC123
```

### Supported Prefixes
| Prefix | Source | Description |
|--------|--------|-------------|
| `PUB-` | Public Enrollment | Walk-in QR scan |
| `CLM-` | Claim Code | Direct mail redemption |
| `MBR-` | Member ID | Direct lookup |

## API Endpoints

### Client Dashboard API (JWT Authentication)
- **POST /api/client/login** - Authenticate, receive JWT token
- **GET /api/client/me** - User profile and program context
- **GET /api/client/analytics** - Member counts by enrollment source
- **GET /api/client/members** - Paginated members with search
- **GET /api/client/campaigns** - Campaign/notification history

### Admin API (API Key Authentication)
- **GET /api/admin/tenants** - List all clients with dashboard_slug and passkit_status
- **GET /api/admin/tenants/:userId** - Get single tenant details
- **POST /api/admin/provision** - Create new client account with auto PassKit provisioning
- **DELETE /api/admin/tenants/:userId** - Remove client
- **POST /api/admin/tenants/:programId/retry-passkit** - Retry PassKit provisioning (for manual_required/skipped)
- **PATCH /api/admin/tenants/:programId/passkit** - Manually update PassKit settings
- **GET /api/admin/passkit/status** - Check PassKit API health

### Internal POS API (JWT Authentication)
- **POST /api/pos/lookup** - Member lookup by external_id
- **POST /api/pos/earn** - Award points
- **POST /api/pos/redeem** - Deduct points

### External POS Webhooks (API Key Authentication)
- **POST /api/webhooks/pos/lookup** - Member lookup
- **POST /api/webhooks/pos/earn** - Add points (idempotent)
- **POST /api/webhooks/pos/redeem** - Deduct points (idempotent)

**Headers:** `x-api-key: pk_live_*`, `Idempotency-Key: unique-id`

### Public Enrollment
- **GET /api/enroll/:slug** - Public program lookup by dashboard_slug
  - Uses SUPABASE_ANON_KEY only (no service role key exposure)
  - Returns 503 if anon key not configured

### PassKit Callbacks (Signature Verification)
- **POST /api/callbacks/passkit** - PassKit wallet event webhook
  - No API key required (bypasses POS auth)
  - Uses HMAC signature verification (`x-passkit-signature` header)
  - Events: `pass.installed` → ACTIVE, `pass.uninstalled` → CHURNED
  - Always returns 200 to prevent PassKit retries

## Role-Based Access Control

| Role | Description | Access |
|------|-------------|--------|
| `SUPER_ADMIN` | Platform owner | Full system access |
| `PLATFORM_ADMIN` | Platform operator | Client provisioning |
| `CLIENT_ADMIN` | Business client | Own program only |

### Permissions Matrix
| Endpoint | SUPER_ADMIN | PLATFORM_ADMIN | CLIENT_ADMIN |
|----------|-------------|----------------|--------------|
| `/api/client/admin/*` | ✅ | ✅ | ❌ |
| `/api/client/analytics` | ✅ | ✅ | ✅ (own) |
| `/api/client/members` | ✅ | ✅ | ✅ (own) |
| `/api/pos/*` | ✅ | ✅ | ✅ (own) |

## Security Features
- **JWT Authentication:** Secure client dashboard sessions
- **Multi-Tenant Isolation:** Data separated by program_id
- **Rate Limiting:** `/api/pos/*` (60/min), `/api/notify/*` (10/min)
- **Kill Switch:** Instantly suspend programs
- **Input Validation:** Zod schemas on all endpoints
- **Anon Key Lockdown:** Public endpoints use RPC functions only (no direct table access)
- **Row Level Security:** All tables have deny-by-default policies for anon role

### Anon Key Security (Migration 012)
The `SUPABASE_ANON_KEY` is intentionally public. To prevent data exposure:
- **Direct table access revoked:** Anon role cannot SELECT from any table
- **RPC-only access:** Anon can only call `get_public_program_info(slug)`
- **RLS enforcement:** All tables have explicit deny policies for anon role
- **Service role preserved:** Backend operations use service role key (full access)

## Environment Variables

### Required
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only) |
| `SUPABASE_ANON_KEY` | Anonymous key (public endpoints) |
| `ADMIN_API_KEY` | External API authentication |
| `SESSION_SECRET` | Session encryption |

### Client Dashboard
| Variable | Description |
|----------|-------------|
| `VITE_MOCK_MODE` | Enable mock data (`true`/`false`) |

### Optional
| Variable | Required For |
|----------|--------------|
| `PASSKIT_API_KEY` | Digital wallet sync |
| `PASSKIT_API_SECRET` | Digital wallet sync |
| `POSTGRID_API_KEY` | Physical mail |
| `APP_URL` | QR code generation |

## Database Migrations

Execute in Supabase Studio SQL Editor (in order):
```
migrations/001_performance_indexes.sql
migrations/002_program_suspension.sql
migrations/003_passkit_tier_id.sql
migrations/004_rpc_functions_verification.sql
migrations/010_dashboard_slug.sql
migrations/011_pos_integration.sql
migrations/012_secure_public_access.sql  # CRITICAL: Locks down anon key access
migrations/013_passkit_status_tracking.sql  # Adds passkit_status and timezone columns
migrations/014_nullable_passkit_fields.sql  # CRITICAL: Enables soft-fail provisioning
```

## Development Commands

```bash
# Start development server
npm run dev

# Seed test members
npx tsx scripts/seed-members.ts <program_id>

# Production validation (7 flows)
npx tsx scripts/prod-validation.ts
```

## External Dependencies

### Supabase (Required)
- **Database:** PostgreSQL for loyalty data
- **Authentication:** User auth for dashboards
- **RPC Functions:** Stored procedures for core logic

### PassKit (Optional)
- **Digital Wallets:** Apple Wallet & Google Pay passes
- **Push Notifications:** Real-time wallet updates

### PostGrid (Optional)
- **Direct Mail:** Postcards and letters
- **Template Management:** Dynamic content

## Recent Changes
- **Protocol Selection:** POST `/api/admin/provision` now accepts `protocol` field (MEMBERSHIP, EVENT_TICKET, COUPON)
  - MEMBERSHIP: Triggers PassKit auto-provisioning for digital wallet passes
  - EVENT_TICKET/COUPON: Sets passkit_status to "skipped" (no PassKit provisioning)
- **Soft-Fail Provisioning:** Migration 014 makes passkit_program_id nullable, enabling client onboarding even when PassKit is unavailable
- **E2E Test Suite:** `scripts/test-provisioning.ts` validates health check, protocol-based provisioning, duplicate detection
- **PassKit Retry Provisioning:** POST `/api/admin/tenants/:programId/retry-passkit` to retry failed provisioning
- **PassKit Settings Update:** PATCH `/api/admin/tenants/:programId/passkit` to manually configure PassKit IDs with duplicate detection
- **PassKit Health Check:** GET `/api/admin/passkit/status` to verify PassKit API credentials
- **Status Tracking:** Migration 013 adds `passkit_status` (pending/provisioned/manual_required/skipped) and `timezone` columns
- **Improved Error Codes:** Duplicate detection returns specific codes (DUPLICATE_BUSINESS_NAME, DUPLICATE_PASSKIT_ID)
- **PassKit Auto-Provisioning:** New orchestration service creates programs/tiers automatically with soft-fail approach
- **Admin API Enhanced:** passkitProgramId now optional; response includes PassKit status, tier ID, enrollment URL
- **POS Clerk Override:** Redemption actions require confirmation modal to prevent accidental point deductions
- **Security hardening:** Migration 012 locks down anon key to RPC-only access
- **Public enrollment:** Uses secure `get_public_program_info` RPC function
- POS Simulator with dual scanning (keyboard wedge + camera)
- "Scan with Camera" button uses primary blue for prominence
- USA patriotic color scheme (blue/red/white)
- Role-based access control with JWT
- Unique enrollment URLs via dashboard_slug
- Comprehensive README with full documentation
