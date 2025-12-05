# Pass To VIP - Phygital Loyalty Ecosystem

**Version:** 2.6.0  
**Last Updated:** December 5, 2025  
**Status:** Production Ready

## Overview
Pass To VIP is a production-ready, multi-tenant SaaS platform designed to bridge physical mail campaigns with digital wallet technology. It enables businesses in Retail, Hospitality, and Event Management to manage loyalty programs, engage with customers via direct mail, and integrate with Apple Wallet and Google Pay. The platform has undergone rigorous production validation, ensuring its commercial readiness. Its core purpose is to provide a robust, secure, and scalable solution for modern loyalty and customer engagement.

## Recent Changes (v2.6.0)
- **External POS Webhook System**: API for external POS systems (e.g., Levi's) to trigger spend-based tier upgrades
  - **Spend-Based Tier System**: Separate from points-based, uses cumulative purchase amounts (e.g., >$300 = Silver, >$1000 = Gold)
  - **Migration 025**: Added spend tier thresholds (`spend_tier_2_threshold_cents`, `spend_tier_3_threshold_cents`, `spend_tier_4_threshold_cents`) and discount columns (`tier_1_discount_percent` through `tier_4_discount_percent`) to programs table; Added `spend_total_cents`, `spend_tier_level`, and `external_id` to passes_master table; Created `spend_ledger` table for transaction audit trail
  - **POS API Key Management**: Admin endpoints to create, list, and revoke API keys per program
  - **Idempotency Support**: Transaction webhook supports idempotency keys to prevent duplicate processing
  - **Rate Limiting**: 100 requests per minute per API key
- **External POS Webhook Endpoints** (API key authenticated via `x-api-key` header):
  - `GET /api/pos/external/health` - Health check (no auth required)
  - `POST /api/pos/external/transactions` - Process purchase transaction with amount, triggers tier recalculation
  - `GET /api/pos/external/members/:externalId` - Lookup member by external ID
- **Admin API Key Endpoints** (API key authenticated):
  - `POST /api/admin/programs/:programId/api-keys` - Create new POS API key
  - `GET /api/admin/programs/:programId/api-keys` - List all API keys for program
  - `DELETE /api/admin/programs/:programId/api-keys/:keyId` - Revoke API key
  - `GET /api/admin/programs/:programId/spend-tier-config` - Get spend tier thresholds and discounts
  - `PATCH /api/admin/programs/:programId/spend-tier-config` - Update tier configuration

## Previous Changes (v2.5.0)
- **Multi-Program Architecture**: One client can now manage multiple programs (MEMBERSHIP, EVENT_TICKET, COUPON) simultaneously
- **Programs Management UI**: New "Programs" section in Client Command Center with add/remove/set-primary capabilities
- **Protocol-Specific Badges**: Visual differentiation of program types with icons and colors
- **Enhanced Admin API**: New endpoints for multi-program CRUD operations with RBAC protection
- **Migration 020**: Added `tenant_id` and `is_primary` columns to programs table
- **Protocol K Fix (Campaign Launcher)**: Two-step selector (Tenant → Program) prevents enrollment flow mismatches in multi-program clients
- **Migration 021**: Added `program_id` FK to claim_codes table for precise program targeting
- **Gap L Fix (Template Defaults)**: Each program stores its own `postgrid_template_id` for template-protocol matching; Client Command Center has dropdown to set default; Campaign Launcher auto-selects template with "Auto-filled" badge
- **Gap M Fix (Campaign Budget Limits)**: Per-program campaign budget limits prevent accidental large campaign launches
  - **Migration 022**: Added `campaign_budget_cents` column to programs table (default $500.00)
  - **Backend Validation**: Two-tier safety (80% warning, 100% block with typed "CONFIRM CHARGE" confirmation)
  - **Client Command Center**: New budget input field with currency formatting in Programs section
  - **Campaign Launcher UI**: Real-time budget tracking, amber warning at 80%, confirmation modal with typed override for over-budget campaigns
  - **Cost Estimate API**: Enhanced to return budget comparison info when program_id provided
- **Enhanced Notification System**: Smart segmentation for push notifications to digital wallet passes
  - **Triple Validation**: All notification operations require tenant+programId+protocol alignment before sending
  - **Dynamic Tier Segments (v2.5.2)**: Tier segment names now use dynamic naming from program configuration
    - Segments use generic types (TIER_1, TIER_2, TIER_3, TIER_4) with display names from tier_system_type presets
    - When tier_system_type is NONE, tier segments are automatically hidden from available segments
  - **Protocol-Aware Segments**:
    - MEMBERSHIP: ALL, TIER_1, TIER_2, TIER_3, TIER_4, VIP, DORMANT, GEO, CITY, CSV
    - COUPON: ALL_ACTIVE, UNREDEEMED, EXPIRING_SOON, GEO, CITY, CSV
    - EVENT_TICKET: ALL_TICKETED, NOT_CHECKED_IN, CHECKED_IN, GEO, CITY, CSV
  - **CITY Segment (v2.5.2)**: New segment type for targeting members by city name
  - **Tier-Based Segmentation**: Configurable thresholds per program with dynamic tier names
  - **Migration 023**: Added tier threshold columns (`tier_bronze_max`, `tier_silver_max`, `tier_gold_max`) to programs table
  - **Admin Notifications Page**: New `/admin/notifications` page with two-step Tenant → Program selector
  - **JWT-Authenticated Routes**: Notification endpoints now use `/api/client/admin/notifications/*` paths with JWT auth
  - **Segment Preview**: Dry-run capability shows recipient count and sample members before sending
  - **CSV Upload**: Target specific member IDs from uploaded CSV files
  - **Birthday Bot**: Automated birthday rewards with per-program configuration
- **PassKit Tier ID Mapping (v2.5.1)**: Per-tier pass design support
  - **Migration 020**: Added PassKit tier ID columns to programs table (`passkit_tier_bronze_id`, `passkit_tier_silver_id`, `passkit_tier_gold_id`, `passkit_tier_platinum_id`)
  - **Client Command Center UI**: Tier configuration section now includes optional PassKit Tier ID inputs per tier level
  - **API Enhancement**: Tier threshold endpoint now accepts PassKit tier IDs for saving tier-specific pass designs
  - **Pass Design Per Tier**: When member points cross tier thresholds, can display different PassKit visual templates
- **Tier System Visual Enhancements (v2.5.1)**: Complete tier display and celebration features
  - **Tier Calculation Utilities**: Shared utilities (`server/utils/tier-calculator.ts`, `client/src/lib/tier-calculator.ts`) determine member tier based on points and program thresholds (Bronze ≤ bronze_max, Silver ≤ silver_max, Gold ≤ gold_max, Platinum = unlimited)
  - **TierBadge Component**: Color-coded badges display tier status throughout the application with industry-standard colors (bronze, silver, gold, platinum)
  - **Members Page Integration**: TierBadge displays in member table for quick tier identification
  - **POS Tier Display**: Member info section shows current tier with TierBadge component
  - **Tier Upgrade Celebration**: POS earn flow detects tier upgrades and shows animated celebration modal when members cross tier thresholds
  - **Backend Tier Response**: POS earn endpoint returns `newTierName` for frontend tier upgrade detection
- **Dynamic Tier Naming System (v2.5.2)**: Flexible tier naming with preset and custom options
  - **Migration 024**: Added `tier_system_type` enum (LOYALTY, OFFICE, GYM, CUSTOM, NONE), tier name columns (`tier_1_name` through `tier_4_name`), and `default_member_label` to programs table
  - **Tier System Presets**: Three built-in naming conventions:
    - LOYALTY: Bronze / Silver / Gold / Platinum (default)
    - OFFICE: Member / Staff / Admin / Executive
    - GYM: Weekday / 7-Day / 24/7 / Family
  - **Custom Tier Names**: CUSTOM type allows fully customizable tier names per program
  - **Non-Tiered Programs**: NONE type uses single member label for programs without tier progression
  - **Client Command Center UI**: Tier configuration section includes:
    - Tier system type dropdown with preset auto-fill
    - Conditional custom name inputs (shown only for CUSTOM type)
    - Default member label input (shown only for NONE type)
    - Dynamic labels in tier thresholds and PassKit ID sections
  - **PassKit Integration**: Tier IDs section automatically hidden when tier system is NONE
  - **Backward Compatibility**: Existing programs default to LOYALTY preset with standard Bronze/Silver/Gold/Platinum names

## User Preferences
- Iterative development preferred
- Ask before making major changes to the codebase
- Detailed explanations for new features or complex logic
- Do NOT modify the `/admin` folder (legacy HTML pages)

## System Architecture

### Core Design
The system utilizes a client-server architecture. The frontend is a React application built with Vite, TailwindCSS, and shadcn/ui. The backend is structured with controllers, services (for Supabase, PassKit, PostGrid), and a `logic.service.ts` for orchestrating core POS actions and data synchronization.

### UI/UX Decisions
The client dashboard employs a USA Patriotic Color Scheme: Primary Blue (`#2563eb`) for actions, Secondary Red (`#dc2626`) for warnings, and White (`#ffffff`) for backgrounds. Branding includes a "Pass To VIP" logo and "Operated by Oakmont Logic LLC" in the footer.

### Technical Implementations
- **Authentication:** JWT with role-based access control (`SUPER_ADMIN`, `PLATFORM_ADMIN`, `CLIENT_ADMIN`).
- **Data Management:** PostgreSQL via Supabase, leveraging RPC functions and Row Level Security (RLS) for multi-tenancy.
- **Multi-Program Architecture:** One client (tenant) can manage multiple programs (verticals) simultaneously. Programs table has `tenant_id` FK and `is_primary` boolean. Each vertical (MEMBERSHIP, EVENT_TICKET, COUPON) can have its own PassKit credentials and enrollment URLs.
- **Scanning:** Supports dual QR/barcode scanning (keyboard-wedge and mobile camera via `html5-qrcode`).
- **Code Parsing:** Smart parser extracts member IDs from various formats.
- **Digital Wallet Integration:** Managed by `passkit-provision.service.ts`, supporting "soft-fail" provisioning.
- **Protocol Routing:** Supports `MEMBERSHIP`, `EVENT_TICKET`, and `COUPON` protocols.
- **Security:** Includes JWT, multi-tenant isolation, rate limiting, Zod validation, and a locked-down anonymous key.
- **Point System:** Integer-based "Casino Chip" model with configurable `earn_rate_multiplier` (default 10), avoiding floating-point issues.

### Feature Specifications
- **Client Dashboard:** Login, program overview, analytics, member management, program assets, POS simulator, and admin interface.
- **Program Assets Page:** Provides high-res PNG and SVG QR code downloads, and copy-to-clipboard functionality for enrollment URLs.
- **POS Simulator:** Offers dual scanning, supports various member ID prefixes, includes a confirmation modal for redeem actions, and supports "Spend Amount" and "Direct Points" earning modes.
- **Client Command Center (Admin-Only):** Detailed client profile management for platform administrators, including identity, configuration, billing health, API keys, and PassKit sync retry. Programs section includes PostGrid template dropdown selector for per-program template defaults.
- **Campaign Launcher (Admin-Only):** Full-featured system for direct mail campaigns via PostGrid. Features two-step Tenant → Program selector to prevent enrollment mismatches in multi-program clients. Supports various resource types (postcards, letters), mailing classes, template selection, CSV upload with validation, real-time cost estimation, and campaign history tracking. Claim codes are now linked to specific program_id for precise targeting.
- **Public Enrollment Engine:** Self-service enrollment for strangers via web form (`/enroll/:slug`). Captures firstName, lastName, email without pre-assigned codes. Features duplicate email detection (returns existing pass URL), PassKit soft-fail provisioning, rate limiting (20 requests/15min), and source tracking (`source: PUBLIC_FORM` in passes_master). Available for MEMBERSHIP protocol programs only.
- **API Endpoints:** Categorized into Client Dashboard (JWT), Admin (API key), Internal POS (JWT), External POS Webhooks (API key + idempotency), Public Enrollment (Zod validation + rate limiting, no auth), Campaign (JWT + admin role), Notifications (JWT + admin role), and PassKit Callbacks (HMAC verified).
- **Notification API Endpoints (JWT authenticated):**
  - `GET /api/client/admin/tenants-with-programs` - List all tenants with their programs for notification composer
  - `GET /api/client/admin/notifications/segments` - Get available segments for a program (requires tenantId, programId, protocol)
  - `POST /api/client/admin/notifications/segment/preview` - Preview segment recipients before sending
  - `POST /api/client/admin/notifications/broadcast` - Send push notification to targeted segment
  - `GET /api/client/admin/notifications/logs` - Get notification campaign history
- **Role-Based Access Control:** Granular permissions across API endpoints for different user roles.

## External Dependencies

-   **Supabase:** Provides PostgreSQL database, authentication services, and custom RPC functions for business logic.
-   **PassKit:** Integrates digital wallet functionality (Apple Wallet, Google Pay) and manages real-time updates via webhooks.
-   **PostGrid:** Handles direct mail campaigns, including postcards and letters, with dynamic template management.