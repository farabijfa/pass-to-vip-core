# Pass To VIP - Phygital Loyalty Ecosystem

## Overview
Pass To VIP is a production-ready, multi-tenant SaaS platform designed for businesses in Retail, Hospitality, and Event Management. It integrates physical mail campaigns with digital wallet technology (Apple Wallet & Google Pay) to manage loyalty programs and enhance customer engagement. The platform offers a secure, scalable solution supporting features like spend-based tier upgrades, multi-program management, and robust customer communication.

## User Preferences
- Iterative development preferred
- Ask before making major changes to the codebase
- Detailed explanations for new features or complex logic
- Do NOT modify the `/admin` folder (legacy HTML pages)

## System Architecture

### Core Design
The system employs a client-server architecture. The frontend is a React application utilizing Vite, TailwindCSS, and shadcn/ui. The backend is organized with controllers and services for Supabase, PassKit, and PostGrid, orchestrated by a `logic.service.ts` for core POS actions and data synchronization.

### UI/UX Decisions
The client dashboard features a USA Patriotic Color Scheme: Primary Blue (`#2563eb`), Secondary Red (`#dc2626`), and White (`#ffffff`). Branding includes a "Pass To VIP" logo and "Operated by Oakmont Logic LLC" in the footer.

### Technical Implementations
- **Authentication:** JWT with role-based access control (`SUPER_ADMIN`, `PLATFORM_ADMIN`, `CLIENT_ADMIN`).
- **Data Management:** PostgreSQL via Supabase, utilizing RPC functions and Row Level Security (RLS) for multi-tenancy.
- **Multi-Program Architecture:** Supports multiple loyalty programs per client, each with dedicated PassKit credentials and enrollment URLs.
- **Scanning:** Dual QR/barcode scanning via keyboard-wedge and mobile camera (`html5-qrcode`).
- **Code Parsing:** Extracts member IDs from various formats.
- **Digital Wallet Integration:** Managed by `passkit-provision.service.ts`, supporting "soft-fail" provisioning for Apple Wallet and Google Pay.
- **Protocol Routing:** Supports `MEMBERSHIP`, `EVENT_TICKET`, and `COUPON` protocols.
- **Security:** Implements JWT, multi-tenant isolation, rate limiting, Zod validation, and a locked-down anonymous key.
- **Point System:** Integer-based "Casino Chip" model with configurable `earn_rate_multiplier`.
- **Tier System:** Configurable spend-based and point-based tiers with dynamic naming, visual enhancements, PassKit tier ID mapping, and dynamic discounts (0-100% per tier).
- **Notification System:** Enhanced push notifications to digital wallet passes with triple validation, dynamic tier segments, and protocol-aware segmentation (e.g., `ALL`, `TIER_1`, `GEO`, `CSV`), including segment preview and automated birthday rewards.

### Feature Specifications
- **Client Dashboard:** Provides program overview, analytics, member management, program assets, a POS simulator, and an admin interface.
- **Program Assets Page:** Offers high-resolution QR code downloads and enrollment URLs.
- **POS Simulator:** Features dual scanning, support for various member ID prefixes, and "Spend Amount" and "Direct Points" earning modes.
- **Client Command Center (Admin-Only):** Manages client profiles, configurations, billing, API keys, PassKit sync retry, and PostGrid template selection.
- **Campaign Launcher (Admin-Only):** Full-featured direct mail campaign system via PostGrid, supporting various resource types, mailing classes, template selection, CSV upload, real-time cost estimation, and history tracking. Includes budget limits.
- **Public Enrollment Engine:** Self-service enrollment via web form (`/enroll/:slug`) for `MEMBERSHIP` protocol programs, with duplicate email detection, PassKit soft-fail provisioning, and rate limiting.
- **API Endpoints:** Categorized for Client Dashboard (JWT), Admin (API key), Internal POS (JWT), External POS Webhooks (API key + idempotency), Public Enrollment (Zod validation + rate limiting), Campaign (JWT + admin role), Notifications (JWT + admin role), and PassKit Callbacks (HMAC verified).
- **External POS Webhook System:** Provides a production-ready API for external POS systems to trigger spend-based tier upgrades, manage members, and track cumulative spend.

### System Design Choices
- **PassKit Sync System:** Ensures data consistency between PassKit and Supabase. It uses a dual-path approach with real-time webhooks and a manual sync option, employing idempotent upserts via `upsert_membership_pass_from_passkit` RPC function. Reconciliation marks deleted PassKit passes as inactive in Supabase, and only active passes are displayed. Real-time PassKit webhooks (configured at `https://passtovip.pro/api/callbacks/passkit`) handle `pass.created`, `member.enrolled`, `pass.installed`, `pass.uninstalled`, and `pass.updated` events with HMAC signature verification.

## External Dependencies

-   **Supabase:** Utilized for PostgreSQL database, authentication, and custom RPC functions.
-   **PassKit:** Provides digital wallet functionality (Apple Wallet, Google Pay) and real-time updates.
-   **PostGrid:** Integrated for direct mail campaigns (postcards, letters) and dynamic template management.