# Pass To VIP - Phygital Loyalty Ecosystem

## Overview
Pass To VIP is a production-ready, multi-tenant SaaS platform that bridges physical mail campaigns with digital wallet technology. It enables businesses in Retail, Hospitality, and Event Management to manage loyalty programs, engage customers via direct mail, and integrate with Apple Wallet and Google Pay. The platform provides a robust, secure, and scalable solution for modern loyalty and customer engagement, supporting advanced features like spend-based tier upgrades and multi-program management for clients.

## User Preferences
- Iterative development preferred
- Ask before making major changes to the codebase
- Detailed explanations for new features or complex logic
- Do NOT modify the `/admin` folder (legacy HTML pages)

## System Architecture

### Core Design
The system uses a client-server architecture. The frontend is a React application built with Vite, TailwindCSS, and shadcn/ui. The backend is structured with controllers and services for Supabase, PassKit, and PostGrid, with a `logic.service.ts` orchestrating core POS actions and data synchronization.

### UI/UX Decisions
The client dashboard uses a USA Patriotic Color Scheme: Primary Blue (`#2563eb`), Secondary Red (`#dc2626`), and White (`#ffffff`). Branding includes a "Pass To VIP" logo and "Operated by Oakmont Logic LLC" in the footer.

### Technical Implementations
- **Authentication:** JWT with role-based access control (`SUPER_ADMIN`, `PLATFORM_ADMIN`, `CLIENT_ADMIN`).
- **Data Management:** PostgreSQL via Supabase, leveraging RPC functions and Row Level Security (RLS) for multi-tenancy.
- **Multi-Program Architecture:** Supports multiple programs (verticals) per client (tenant), each with its own PassKit credentials and enrollment URLs.
- **Scanning:** Supports dual QR/barcode scanning (keyboard-wedge and mobile camera via `html5-qrcode`).
- **Code Parsing:** Smart parser extracts member IDs from various formats.
- **Digital Wallet Integration:** Managed by `passkit-provision.service.ts`, supporting "soft-fail" provisioning.
- **Protocol Routing:** Supports `MEMBERSHIP`, `EVENT_TICKET`, and `COUPON` protocols.
- **Security:** Includes JWT, multi-tenant isolation, rate limiting, Zod validation, and a locked-down anonymous key.
- **Point System:** Integer-based "Casino Chip" model with configurable `earn_rate_multiplier` (default 10).
- **Tier System:** Configurable spend-based and point-based tiers with dynamic naming, visual enhancements, PassKit tier ID mapping for different pass designs, and **dynamic tier discounts** (0-100% per tier, editable via Client Command Center).
- **Notification System:** Enhanced system for push notifications to digital wallet passes with triple validation, dynamic tier segments, and protocol-aware segmentation (e.g., `ALL`, `TIER_1`, `GEO`, `CSV`). Includes segment preview and automated birthday rewards.

### Feature Specifications
- **Client Dashboard:** Program overview, analytics, member management, program assets, POS simulator, and admin interface.
- **Program Assets Page:** Provides high-res PNG/SVG QR code downloads and enrollment URLs.
- **POS Simulator:** Offers dual scanning, supports various member ID prefixes, and includes "Spend Amount" and "Direct Points" earning modes.
- **Client Command Center (Admin-Only):** Client profile management, including identity, configuration, billing health, API keys, and PassKit sync retry. Includes PostGrid template selection for per-program defaults.
- **Campaign Launcher (Admin-Only):** Full-featured system for direct mail campaigns via PostGrid, supporting various resource types, mailing classes, template selection, CSV upload, real-time cost estimation, and history tracking. Claim codes are linked to specific `program_id`. Includes budget limits with warning and block mechanisms.
- **Public Enrollment Engine:** Self-service enrollment via web form (`/enroll/:slug`) for `MEMBERSHIP` protocol programs, with duplicate email detection, PassKit soft-fail provisioning, and rate limiting.
- **API Endpoints:** Categorized into Client Dashboard (JWT), Admin (API key), Internal POS (JWT), External POS Webhooks (API key + idempotency), Public Enrollment (Zod validation + rate limiting), Campaign (JWT + admin role), Notifications (JWT + admin role), and PassKit Callbacks (HMAC verified).
- **External POS Webhook System:** Production-ready API for external POS systems to trigger spend-based tier upgrades, manage members, and track cumulative spend. Includes endpoints for transactions, member lookup, and API key management.

## External Dependencies

-   **Supabase:** PostgreSQL database, authentication, and custom RPC functions.
-   **PassKit:** Digital wallet functionality (Apple Wallet, Google Pay) and real-time updates.
-   **PostGrid:** Direct mail campaigns (postcards, letters) and dynamic template management.

## PassKit Sync System (v2.6.3)

### Problem Solved
When customers enroll through PassKit-hosted forms (SMARTPASS flow), passes are created directly in PassKit but may not exist in our Supabase database. This caused POS lookups to fail with "member not found" errors, resulting in missing points.

### Architecture
- **Source of Truth**: PassKit = pass existence; Supabase = points/balances
- **Sync Strategy**: Dual-path approach with real-time webhooks + scheduled API sync
- **Idempotent Upserts**: `upsert_membership_pass_from_passkit` RPC function ensures no duplicates or data loss

### Real-Time PassKit Webhook (NEW in v2.6.3)
**Webhook URL**: `https://passtovip.pro/api/callbacks/passkit`

Configure this URL in PassKit Admin Console → Program Settings → Webhooks

**Supported Events**:
- `pass.created` / `member.enrolled`: Auto-syncs new passes to Supabase immediately
- `pass.installed`: Updates pass status to INSTALLED
- `pass.uninstalled`: Updates pass status to UNINSTALLED
- `pass.updated`: Updates last_updated timestamp

**How it Works**:
1. Customer enrolls via PassKit-hosted form (e.g., `https://pub2.pskt.io/t/71aejp`)
2. PassKit sends webhook to our endpoint with pass data
3. System looks up program by `passkit_program_id`
4. Pass is upserted to Supabase via `upsert_membership_pass_from_passkit` RPC
5. Member immediately appears in Client Dashboard

**Security**: HMAC signature verification using `x-passkit-signature` header
- When `PASSKIT_API_SECRET` is configured: Requests with invalid/missing signatures are rejected with 401 Unauthorized
- When `PASSKIT_API_SECRET` is not configured: Requests are accepted without verification (development mode only)

### Database Tables (Migration 027)
- **passkit_sync_state**: Tracks sync cursors, timestamps, and status per program
- **passkit_event_journal**: Audit trail for all sync operations (creates, updates, failures)
- **Unique Index**: `idx_passes_master_program_passkit_id` prevents duplicate PassKit passes per program

### Admin API Endpoints
- `POST /api/admin/programs/:programId/sync` - Trigger full or delta sync
- `GET /api/admin/programs/:programId/sync-status` - Get current sync state
- `GET /api/admin/programs/:programId/sync-history` - View sync event history

### Services
- **passkit-sync.service.ts**: Core sync logic with listMembers, syncProgramMembers, and idempotent upserts
- **passkit.service.ts**: Extended with program/tier management and member listing

## Production Status (December 7, 2025)

### Working Client Credentials
**CLIENT_ADMIN Login** (use at /login):
- Email: `vip@passtovip.com`
- Password: `VipDemo2024!`
- Business Name: VIP Rewards Demo
- User ID: 178d18c5-5e58-481a-950c-444497b1c64e
- Program ID: e0ca8249-d5a6-4fd0-b930-f93c335d38b3

**ADMIN_API_KEY**: `pk_phygital_admin_2024`

### What's Working
- **Authentication: PRODUCTION READY** - Supabase Auth with JWT tokens
- **Client Dashboard: PRODUCTION READY** - Full dashboard with all features
- **POS System: PRODUCTION READY** - All operations verified with BETA-001 member
  - Lookup: Returns member details, points balance, tier
  - Earn: Add points based on spend (earn_rate_multiplier: 10)
  - Redeem: Deduct points with validation
  - Transaction history: Full audit trail in database
- **Existing Members**: All previously enrolled members work correctly

### What Requires Migration
The PassKit Sync System (v2.6.1) code is complete but **requires migration 027 to be applied to Supabase**:
- Manual pass insertion is disabled until migration is applied (returns helpful error)
- New passes enrolled via PassKit-hosted forms (SMARTPASS) won't sync until migration is applied
- The sync API endpoints are ready but will fail without the RPC function

**To enable PassKit sync:**
1. Open Supabase SQL Editor
2. Execute the contents of `migrations/027_passkit_sync_system.sql`
3. This creates: passkit_sync_state table, passkit_event_journal table, upsert_membership_pass_from_passkit RPC function

## Recent Changes (December 2025)
- **PassKit Real-Time Webhook v2.6.3**: Added webhook handler at `/api/callbacks/passkit` for real-time pass sync
  - Handles `pass.created`, `member.enrolled`, `pass.installed`, `pass.uninstalled`, `pass.updated` events
  - Auto-syncs new passes to Supabase immediately when customers enroll via PassKit forms
  - Includes HMAC signature verification support
- **PassKit Sync System v2.6.1**: Code complete, migration 027 APPLIED
- **PassKit Balance Push Fix v2.6.2**: Fixed PassKit PUT requests to use member `id` (not `externalId`) and include required `person` data
- Added migration 027 with passkit_sync_state and passkit_event_journal tables
- Created passkit-sync.service.ts with full sync capabilities
- Added admin API endpoints for manual sync triggering and status monitoring
- Added migration 028: Enhanced RPC to return member_email, member_first_name, member_last_name, external_id for PassKit sync
- Fixed `syncPass` method: Uses `payload.id` (PassKit internal ID) instead of `payload.externalId`
- Fixed `updateMemberPoints` method: Always includes person object with emailAddress, forename, surname
- Fixed campaign controller to fetch PassKit program ID from database before creating claim codes
- Fixed POS lookup endpoint - corrected `tier_level` to `spend_tier_level` column reference
- Fixed POS lookup endpoint - removed non-existent `member_phone` and `created_at` column references
- Applied migration 026 to fix `process_membership_transaction_atomic` RPC function (removed updated_at reference)
- **POS System Fully Working**: Lookup, Earn, and Redeem all verified
- **PassKit Balance Push Verified**: Test card 1POa48IlfW2AGvsXgisct0 successfully updated to 300 points
- **Added Admin Program Upsert Endpoint**: `POST /api/admin/programs/upsert-supabase` for syncing programs between local PostgreSQL and Supabase
- **Fixed Enrollment Controller**: Now uses `dashboard_slug` column (matching Supabase schema) instead of non-existent `enrollment_slug`
- **Manali Bakes Setup Complete**:
  - Program synced to Supabase (ID: 983af33b-5864-4115-abf3-2627781f5da1)
  - Branded enrollment URL working: `https://passtovip.pro/enroll/s669pxkpcZ4nfRY8i4zkKw`
  - Direct PassKit enrollment: `https://pub2.pskt.io/t/71aejp`
  - Login: `manali@passtovip.com` / `Manali2024!`