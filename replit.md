# Pass To VIP - Phygital Loyalty Ecosystem

## Overview
Pass To VIP is a production-ready, multi-tenant SaaS platform designed to bridge physical mail campaigns with digital wallet technology. It enables businesses in Retail, Hospitality, and Event Management to manage loyalty programs, engage with customers via direct mail, and integrate with Apple Wallet and Google Pay. The platform has undergone rigorous production validation, ensuring its commercial readiness. Its core purpose is to provide a robust, secure, and scalable solution for modern loyalty and customer engagement.

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
- **Client Command Center (Admin-Only):** Detailed client profile management for platform administrators, including identity, configuration, billing health, API keys, and PassKit sync retry.
- **Campaign Launcher (Admin-Only):** Full-featured system for direct mail campaigns via PostGrid, supporting dual client selection, various resource types (postcards, letters), mailing classes, template selection, CSV upload with validation, real-time cost estimation, and campaign history tracking.
- **API Endpoints:** Categorized into Client Dashboard (JWT), Admin (API key), Internal POS (JWT), External POS Webhooks (API key + idempotency), Public Enrollment (Supabase ANON + RLS), Campaign (JWT + admin role), and PassKit Callbacks (HMAC verified).
- **Role-Based Access Control:** Granular permissions across API endpoints for different user roles.

## External Dependencies

-   **Supabase:** Provides PostgreSQL database, authentication services, and custom RPC functions for business logic.
-   **PassKit:** Integrates digital wallet functionality (Apple Wallet, Google Pay) and manages real-time updates via webhooks.
-   **PostGrid:** Handles direct mail campaigns, including postcards and letters, with dynamic template management.