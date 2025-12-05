# Pass To VIP - Phygital Loyalty Ecosystem

## Overview
A multi-tenant SaaS platform designed to bridge physical mail campaigns with digital wallet technology. The platform enables businesses, particularly in Retail, Hospitality, and Event Management, to manage loyalty programs, engage with customers via direct mail, and integrate with digital wallets like Apple Wallet and Google Pay. Its core purpose is to provide a comprehensive solution for customer enrollment, engagement, and loyalty management across both physical and digital touchpoints.

## User Preferences
- Iterative development preferred
- Ask before making major changes to the codebase
- Detailed explanations for new features or complex logic
- Do NOT modify the `/admin` folder (legacy HTML pages)

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
- **POS Simulator:** Offers dual scanning modes and supports various member ID prefixes (`PUB-`, `CLM-`, `MBR-`).
- **API Endpoints:** Separated into Client Dashboard API (JWT protected), Admin API (API key protected), Internal POS API (JWT protected), External POS Webhooks (API key protected with idempotency), Public Enrollment API (Supabase ANON key with RLS), and PassKit Callbacks (HMAC signature verified).
- **Role-Based Access Control:** Granular permissions define access levels for different user roles across various API endpoints.

## External Dependencies

-   **Supabase:** Utilized for PostgreSQL database, authentication, and RPC functions for core business logic.
-   **PassKit:** Integrated for digital wallet functionality (Apple Wallet, Google Pay passes) and real-time wallet updates via webhooks.
-   **PostGrid:** Used for direct mail campaigns, including postcards and letters, with dynamic template management.