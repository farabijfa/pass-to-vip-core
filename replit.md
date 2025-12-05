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
- **Tier System:** Configurable spend-based and point-based tiers with dynamic naming, visual enhancements, and PassKit tier ID mapping for different pass designs.
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