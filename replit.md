# Phygital Loyalty Ecosystem - Backend API

## Overview
This project is a Node.js/Express backend API for a 'Phygital' Loyalty Ecosystem that integrates digital wallets with physical rewards processing. Developed for **PassToVIP**, it aims to bridge physical interactions and digital loyalty programs.

**Key Capabilities:**
- Membership point management
- One-time offer redemptions
- Dynamic digital pass creation and updates
- "Physical Bridge" to convert physical mail recipients into digital wallet users
- **Three Enrollment Verticals:**
  - **Vertical A (Push):** Direct mail campaigns with claim codes
  - **Vertical B (Pull):** Reception QR codes for walk-in enrollment
  - **Vertical C (EDDM):** High-volume neighborhood blanket campaigns

**Target Industries:** Retail, Hospitality, Event Management.

## User Preferences
- Iterative development preferred
- Ask before making major changes to the codebase
- Detailed explanations for new features or complex logic
- Do NOT modify the `/admin` folder

## System Architecture

### Core Design
The system employs a clear separation of concerns:
- **Controllers:** Handle API requests and delegate tasks.
- **Services:** Encapsulate business logic and manage integrations (Supabase, PassKit, PostGrid).
- **Logic Service:** Orchestrates Point-of-Sale (POS) actions, routing to Supabase RPC functions and PassKit synchronization.
- **Data Flow:** Client Request → Controller → `logic.service.ts` → Supabase RPC + `passkit.service.ts`.

### File Structure
The project follows a standard Express application structure:
```
server/
├── controllers/
├── services/
├── middleware/
├── routes/
├── config/
└── index.ts

migrations/
public/
```

### Protocol Routing
The system dynamically routes POS actions based on predefined protocols:
- `MEMBERSHIP`: Processes points earn/redeem via `process_membership_transaction` RPC.
- `EVENT_TICKET`: Handles one-time check-ins via `process_one_time_use` RPC.
- `COUPON`: Manages coupon issue/redeem via `process_one_time_use` RPC.

### Client API Endpoints
The system includes a React client portal with the following authenticated endpoints:
- **POST /api/client/login** - Authenticates via Supabase and returns JWT token
- **GET /api/client/me** - Returns user profile and program context
- **GET /api/client/analytics** - Returns member counts (total, active, churned) by enrollment source
- **GET /api/client/members** - Returns paginated members list with search support
- **GET /api/client/campaigns** - Returns campaign/notification history with success rates

### Admin API Endpoints (Requires SUPER_ADMIN or PLATFORM_ADMIN role)
- **GET /api/client/admin/tenants** - Lists all client accounts and their programs (includes dashboard_slug for unique URLs)
- **POST /api/client/admin/provision** - Creates new client account with Supabase Auth user, program, admin_profiles link, and unique dashboard_slug
- **DELETE /api/client/admin/tenants/:userId** - Removes client account and associated data

### Public Enrollment API
- **GET /api/enroll/:slug** - Public endpoint for enrollment via unique dashboard URL
  - Returns program info (id, name, protocol, enrollment_url, is_suspended)
  - Uses anon key only (no service role key for security)
  - Returns 503 if anon key not configured or dashboard_slug column missing
  - Returns 404 if slug not found

### Role-Based Access Control
The system implements server-side role validation for admin operations:
- **SUPER_ADMIN** - Full platform access
- **PLATFORM_ADMIN** - Admin access to client provisioning
- **CLIENT_ADMIN** - Standard client access (dashboard, analytics, members)
- Admin API endpoints validate JWT tokens and check `admin_profiles.role` before processing

### Test Data
The seed script (`scripts/seed-members.ts`) can be used to populate test members for development:
```bash
npx tsx scripts/seed-members.ts <program_id>
```

### UI/UX Decisions
The project includes an admin dashboard (located in `public/`) and a React client portal (`client/`) for program managers. The design emphasizes clear data presentation for customer and program statistics.

### Security Features
- **Multi-Tenant Isolation:** Ensures data separation between clients.
- **Rate Limiting:** Protects `/api/pos/*` (60/min) and `/api/notify/*` (10/min) endpoints.
- **Input Validation:** Prevents common vulnerabilities like SQL injection.
- **Duplicate Prevention:** Ensures unique program and business name creation.
- **Kill Switch:** Allows suspension of programs for immediate halting of POS transactions.
- **Legacy Admin Pages:** HTML admin pages (`/admin/*`) are disabled in production mode; use React dashboard at `/admin/clients` instead.
- **Anon Key for Public Endpoints:** Public enrollment API uses Supabase anon key only (no service role key exposure).

### Webhook Architecture (Vertical B/C)
The PassKit enrollment webhook (`/api/webhooks/passkit/enrollment`) handles high-volume EDDM campaigns:
- **Idempotency:** Duplicate webhooks (e.g., PassKit retries) are absorbed gracefully
- **External ID Format:** `PUB-{short-uuid}` prefix for all public enrollments
- **Enrollment Source:** Set to `SMARTPASS` for all public enrollment paths
- **Program Lookup:** Maps `passkit_program_id` → internal Supabase UUID
- **Birthday Validation:** Validates and formats dates before storing
- **Spike Protection:** Always returns HTTP 200 to prevent webhook retries

## External Dependencies

-   **Supabase (Required):**
    -   **Database:** PostgreSQL for storing loyalty data, members, transactions, and claim codes.
    -   **Authentication:** User authentication for client dashboards.
    -   **RPC Functions:** Stored procedures for core loyalty logic.
-   **PassKit (Optional):**
    -   **Digital Wallet Management:** Creation and updates of Apple Wallet and Google Wallet passes.
    -   **Push Notifications:** Real-time updates to digital wallet holders.
-   **PostGrid (Optional):**
    -   **Direct Mail:** Sending physical postcards and letters.
    -   **Template Management:** Dynamic content integration for physical mail campaigns.