# Pass To VIP - Phygital Loyalty Ecosystem

## Overview
A production-ready multi-tenant SaaS platform designed to bridge physical mail campaigns with digital wallet technology. The platform enables businesses in Retail, Hospitality, and Event Management to manage loyalty programs, engage with customers via direct mail, and integrate with Apple Wallet and Google Pay. System has passed 4 production validation protocols ensuring commercial readiness.

## User Preferences
- Iterative development preferred
- Ask before making major changes to the codebase
- Detailed explanations for new features or complex logic
- Do NOT modify the `/admin` folder (legacy HTML pages)

## Recent Changes (December 2024)
- **Protocol A:** Soft-fail provisioning - clients created even if PassKit API fails
- **Protocol B:** PassKit webhook churn tracking via `/api/callbacks/passkit`
- **Protocol C:** POS clerk protection - redeem requires confirmation modal
- **Protocol D:** RLS security validated - anon key blocked from direct table access
- **Migrations 012-014:** Security policies, status tracking, nullable PassKit fields

## System Architecture

### Core Design
The system employs a client-server architecture. The frontend is a React application built with Vite, TailwindCSS, and shadcn/ui. The backend is structured with controllers for handling requests, services for encapsulating business logic (e.g., Supabase, PassKit, PostGrid), and a `logic.service.ts` to orchestrate core POS actions and data synchronization with Supabase and PassKit.

### UI/UX Decisions
The client dashboard utilizes a USA Patriotic Color Scheme:
- **Primary Blue (`hsl(215, 74%, 45%)` / `#2563eb`):** Used for buttons, active states, and positive actions.
- **Secondary Red (`hsl(356, 72%, 48%)` / `#dc2626`):** Used for warnings, churned status, and redeem actions.
- **White (`#ffffff`):** Used for backgrounds and cards.
Branding includes a "Pass To VIP" logo in the header and "Operated by Oakmont Logic LLC" in the footer.

### Technical Implementations
- **Authentication:** JWT authentication with role-based access control (`SUPER_ADMIN`, `PLATFORM_ADMIN`, `CLIENT_ADMIN`).
- **Data Management:** PostgreSQL via Supabase, with extensive use of RPC functions for core logic and Row Level Security (RLS) for multi-tenant isolation.
- **Scanning:** Supports dual QR/barcode scanning modes (keyboard-wedge and mobile camera via `html5-qrcode`).
- **Code Parsing:** A smart code parser extracts member IDs from various URL and raw string formats.
- **Digital Wallet Integration:** Orchestrated via `passkit-provision.service.ts` for automatic creation of digital wallet programs and tiers, supporting a "soft-fail" approach where provisioning continues even if PassKit API fails.
- **Protocol Routing:** Supports `MEMBERSHIP`, `EVENT_TICKET`, and `COUPON` protocols, each interacting with Supabase RPCs for specific transaction types.
- **Security:** Includes JWT authentication, multi-tenant isolation, rate limiting, input validation with Zod, and a locked-down anonymous key for public endpoints.

### Feature Specifications
- **Client Dashboard:** Features include a login page, a program overview dashboard, analytics (enrollment charts, retention), member management, a POS simulator, and an admin interface for client management (for `PLATFORM_ADMIN`).
- **POS Simulator:** Offers dual scanning modes, supports various member ID prefixes (`PUB-`, `CLM-`, `MBR-`), and includes a confirmation modal for redeem actions (Protocol C).
- **API Endpoints:** Separated into Client Dashboard API (JWT protected), Admin API (API key protected), Internal POS API (JWT protected), External POS Webhooks (API key protected with idempotency), Public Enrollment API (Supabase ANON key with RLS), and PassKit Callbacks (HMAC signature verified).
- **Role-Based Access Control:** Granular permissions define access levels for different user roles across various API endpoints.

## Production Validation Protocols

The system has been hardened with 4 validation protocols:

| Protocol | Name | Status |
|----------|------|--------|
| **A** | Soft-Fail Provisioning | PASSED - Client created with `passkit_status: manual_required` when API fails |
| **B** | Webhook Churn Tracking | PASSED - `pass.uninstalled` updates `passes_master.status` to UNINSTALLED |
| **C** | Clerk Proof POS | PASSED - Modal appears before redeem, Enter key confirms |
| **D** | RLS Security | PASSED - `SELECT * FROM programs` returns error 42501 for anon role |

## Database Migrations

Run in order in Supabase SQL Editor:
```
migrations/001_performance_indexes.sql      # Performance optimization
migrations/002_program_suspension.sql       # Kill switch feature
migrations/003_passkit_tier_id.sql         # Tier-based programs
migrations/004_rpc_functions_verification.sql  # Core RPC functions
migrations/010_dashboard_slug.sql          # Unique enrollment URLs
migrations/011_pos_integration.sql         # POS API keys & transactions
migrations/012_secure_public_access.sql    # CRITICAL: RLS for anon key
migrations/013_passkit_status_tracking.sql # Soft-fail provisioning support
migrations/014_nullable_passkit_fields.sql # CRITICAL: Non-destructive onboarding
```

## Key Files

### Controllers
- `server/controllers/passkit-webhook.controller.ts` - Handles wallet install/uninstall events, updates `passes_master` table
- `server/controllers/admin.controller.ts` - Tenant provisioning with soft-fail PassKit
- `server/controllers/pos.controller.ts` - POS lookup/earn/redeem operations

### Services
- `server/services/passkit-provision.service.ts` - Auto-provisions PassKit programs with soft-fail
- `server/services/admin.service.ts` - Client provisioning orchestration
- `server/services/logic.service.ts` - Core POS transaction logic

### Routes
- `server/routes/callbacks.routes.ts` - PassKit webhook endpoint (no API key, uses HMAC)
- `server/routes/admin.routes.ts` - Admin API (API key protected)
- `server/routes/pos.routes.ts` - POS endpoints (JWT protected)

### Frontend
- `client/src/pages/pos.tsx` - POS with confirmation modal (lines 143-159, 297-312)
- `client/src/pages/dashboard.tsx` - Program overview
- `client/src/pages/members.tsx` - Member management

### Documentation
- `docs/SECURITY_VALIDATION.md` - Protocol D test procedures
- `docs/POS_INTEGRATION.md` - External POS webhook guide

## External Dependencies

- **Supabase:** PostgreSQL database, authentication, and RPC functions for core business logic.
- **PassKit:** Digital wallet functionality (Apple Wallet, Google Pay passes) and real-time wallet updates via webhooks.
- **PostGrid:** Direct mail campaigns, including postcards and letters, with dynamic template management.

## Environment Variables

### Required
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `SUPABASE_ANON_KEY` - Anonymous key for public endpoints (locked down with RLS)
- `ADMIN_API_KEY` - API key for external admin calls
- `SESSION_SECRET` - Session encryption key

### Optional (for full functionality)
- `PASSKIT_API_KEY` - PassKit credentials for wallet sync
- `PASSKIT_API_SECRET` - For HMAC webhook verification
- `POSTGRID_API_KEY` - For physical mail campaigns
- `APP_URL` - Production URL for QR codes

## Known Gaps for Future Improvement

High Priority:
- Webhook retry queue for failed PassKit callbacks
- Audit logging for admin actions

Medium Priority:
- Analytics caching layer
- PassKit rate limiting with backoff
- API key rotation UI
- Structured JSON logging

Low Priority:
- Mobile POS native app
- Multi-language support
- Dark mode completion
