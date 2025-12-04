# Phygital Loyalty Ecosystem - Backend API

## Overview
This project is a Node.js/Express backend API for a 'Phygital' Loyalty Ecosystem. It seamlessly integrates digital wallets with physical rewards processing, bridging physical interactions and digital loyalty programs. Key capabilities include comprehensive membership point management, one-time offer redemptions, dynamic digital pass creation and updates, and a "Physical Bridge" designed to convert physical mail recipients into active digital wallet users. The business vision is to provide a robust, scalable platform that enhances customer engagement through a unified loyalty experience across physical and digital touchpoints, unlocking significant market potential in retail, hospitality, and event management. The project aims to be the leading backend solution for phygital loyalty programs.

## User Preferences
I want iterative development.
I prefer to be asked before you make any major changes to the codebase.
I prefer detailed explanations when new features or complex logic are introduced.
I do not want the agent to make changes to the /admin folder.

## System Architecture

### Core Design
- **Controllers:** Manage incoming API requests and delegate tasks to appropriate services.
- **Services:** Encapsulate business logic and handle integrations with external systems (Supabase, PassKit, PostGrid).
- **Logic Service:** Acts as the central orchestrator for Point-of-Sale (POS) actions, routing requests to Supabase RPC for data operations and PassKit for wallet synchronization.

### Data Flow
1. Client Request → Controller → `logic.service.ts`
2. `logic.service.ts` → Supabase RPC (executes stored procedures)
3. Supabase performs transactional database operations.
4. `logic.service.ts` → `passkit.service.ts` (triggers digital wallet updates if required).

### UI/UX Decisions
- **Admin Dashboard:** Features a Bootstrap-based UI for managing bulk campaigns, including drag-and-drop CSV upload, toggles for postcards/letters, configurable program IDs, templates, and real-time processing status.

### Technical Implementations
- **API Endpoints:** A comprehensive set of RESTful APIs for POS actions, loyalty operations, digital wallet management, direct mail, physical bridge, and high-scale notifications.
- **Supabase RPC:** Utilizes Supabase Remote Procedure Calls for secure and efficient execution of complex database logic, such as `process_membership_transaction`, `process_one_time_use`, `generate_claim_code`, `lookup_claim_code`, and `update_claim_code_status`.
- **Physical Bridge:** Implements a full "Phygital" loop where physical mail (postcards via PostGrid) with QR codes leads to digital wallet enrollment via a claim route (`/claim/:id`), integrating claim code generation, lookup, and PassKit enrollment.
- **Multi-Tenant SaaS:** Supports tenant provisioning through an admin API, allowing the creation of new tenants with associated Supabase Auth users, programs, and admin profiles, with automatic rollback on failure.
- **High-Scale Notification Service:** Designed for efficient broadcast and targeted notifications (e.g., birthday runs) using batch processing (50 users/batch) and parallel execution to manage PassKit rate limits, logging all campaigns.
- **QR Code Generation:** Automatically generates printable QR code image URLs using `api.qrserver.com` for integration into PostGrid templates.
- **Security:** Admin API endpoints are protected by API key authentication (`X-API-Key` header) and admin routes use Basic Auth.

### Feature Specifications
- **POS Actions:** Supports various action types including `MEMBER_EARN`, `MEMBER_REDEEM`, `COUPON_ISSUE`, and `COUPON_REDEEM`.
- **Digital Wallet:** Manages enrollment, coupon issuance, pass creation, updates, deletion, and push notifications through PassKit.
- **Direct Mail:** Integrates with PostGrid for sending postcards and letters, supporting various sizes and template variables.
- **Bulk Campaign Manager:** Facilitates batch campaigns via CSV upload, allowing for sending postcards or letters with dynamically generated claim codes.
- **Broadcast Notifications:** Send push notifications to all active passes in a program.
  - **Dry-Run Testing:** `POST /api/notify/broadcast/test` previews recipients without sending.
  - **Batched Execution:** Processes 50 passes per batch with 200ms throttle to prevent rate limiting.
  - **Input Validation:** Requires message (min 5 chars) and programId; supports VIP segment filtering.
  - **Audit Logging:** Full audit trail in `notification_logs` with message content, success/failure counts.
- **Birthday Bot:** Configuration-driven automated process to identify members with birthdays, award points, and send personalized push notifications.
  - **Configuration:** Uses `programs.birthday_bot_enabled`, `birthday_reward_points`, and `birthday_message` columns for per-program settings.
  - **Double-Gifting Prevention:** Uses `birthday_logs` table with UNIQUE constraint on `(pass_id, year)` to prevent duplicate birthday rewards.
  - **Scheduling:** Runs via cron job (`scripts/birthday-cron.cjs`) at 9 AM daily (cron: `0 9 * * *`).
  - **Dry-Run Testing:** Test endpoint `GET /api/notify/birthday-bot/test?testDate=YYYY-MM-DD` allows safe testing without side effects.
- **CSV Campaign Upload:** Supports `birth_date` and `phone_number` columns with flexible header mapping and multiple date formats (YYYY-MM-DD, MM/DD/YYYY, MM/DD/YY). Automatically upserts users by email.

## External Dependencies

-   **Supabase:**
    -   **Database:** PostgreSQL database for storing all loyalty program data, member information, transactions, and claim codes.
    -   **Authentication:** Handles user authentication for tenants and admin users.
    -   **Edge Functions/RPC:** Executes stored procedures for core loyalty logic (`process_membership_transaction`, `generate_claim_code`, etc.).
-   **PassKit (via PassKit API):**
    -   **Digital Wallet Management:** Core service for creating, updating, and managing digital passes (memberships, coupons, event tickets).
    -   **Push Notifications:** Delivers real-time updates and messages to digital wallet holders.
    -   **Pass Install URLs:** Provides unique URLs for users to install digital passes.
-   **PostGrid (via PostGrid API):**
    -   **Direct Mail:** Used for sending physical postcards and letters as part of loyalty campaigns and the "Physical Bridge."
    -   **Template Management:** Utilizes PostGrid templates for dynamic content generation in physical mail.
-   **`api.qrserver.com`:**
    -   **QR Code Generation:** An external service used to convert claim URLs into QR code image URLs for printing on physical mail.

## Key Files

### Birthday Bot
- `server/services/notification.service.ts` - Core birthday bot logic with dry-run support
- `server/controllers/notification.controller.ts` - API endpoints for birthday bot (run and test)
- `server/routes/notification.routes.ts` - Route definitions for `/api/notify/*`
- `scripts/birthday-cron.cjs` - Cron job script for scheduled execution
- `migrations/003_birthday_bot_config.sql` - Database migration for birthday bot configuration

### CSV Campaign Upload
- `server/services/campaign.service.ts` - CSV parsing with birth_date/phone_number support
- `server/services/supabase.service.ts` - Contains `upsertUser()` for user data management

### PassKit Webhooks
- `server/controllers/webhook.controller.ts` - Webhook handlers for PassKit events
- `server/routes/webhook.routes.ts` - Route definitions for `/api/webhooks/*`
- `server/services/supabase.service.ts` - Contains `processPassUninstall()` for churn tracking

## API Authentication
- **Admin API Key:** Set via `ADMIN_API_KEY` environment variable (default: `pk_phygital_admin_2024`)
- **Header:** `X-API-Key: <your-api-key>`
- **Admin Dashboard:** Uses Basic Auth with `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables

## Complete API Reference

### Health Check
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health check with service status |

### POS Actions (`/api/pos`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pos/actions` | GET | List all available POS action types |
| `/api/pos/action` | POST | Execute POS action (MEMBER_EARN, MEMBER_REDEEM, COUPON_ISSUE, COUPON_REDEEM) |

**POST /api/pos/action** body:
```json
{
  "external_id": "member-passkit-id",
  "action": "MEMBER_EARN",
  "amount": 100
}
```

### Loyalty (`/api/loyalty`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/loyalty/membership` | POST | Process membership transaction |
| `/api/loyalty/one-time-use` | POST | Process one-time offer redemption |
| `/api/loyalty/members/:memberId/balance` | GET | Get member point balance |
| `/api/loyalty/members/:memberId/transactions` | GET | Get member transaction history |

### Digital Wallet / PassKit (`/api/wallet`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wallet/passes` | POST | Create new digital pass |
| `/api/wallet/passes/:serialNumber` | GET | Get pass details |
| `/api/wallet/passes/:serialNumber` | PATCH | Update pass |
| `/api/wallet/passes/:serialNumber` | DELETE | Delete pass |
| `/api/wallet/passes/:serialNumber/push` | POST | Send push notification to pass |
| `/api/wallet/enroll` | POST | Enroll new member |
| `/api/wallet/coupons` | POST | Issue coupon |
| `/api/wallet/tickets` | POST | Issue event ticket |

### PostGrid Direct Mail (`/api/mail`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mail/templates` | GET | List available mail templates |
| `/api/mail/mail` | POST | Send direct mail (postcard/letter) |
| `/api/mail/mail/:mailId` | GET | Get mail job status |
| `/api/mail/mail/:mailId` | DELETE | Cancel mail job |
| `/api/mail/campaign` | POST | Send batch campaign |

### Physical Bridge / Claim Codes (`/api/claim`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/claim/:id` | GET | Redeem claim code (redirects to PassKit install) |
| `/api/claim/:id/status` | GET | Check claim code status |

### Notifications (`/api/notify`) - Requires X-API-Key
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notify/broadcast` | POST | Send broadcast notification |
| `/api/notify/broadcast/test` | POST | Dry-run broadcast (no messages sent) |
| `/api/notify/birthday-run` | POST | Run birthday bot |
| `/api/notify/birthday-bot/test` | GET | Dry-run birthday bot test |
| `/api/notify/logs` | GET | Get notification campaign logs |

### Campaign Upload (`/api/campaign`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/campaign/upload-csv` | POST | Upload CSV for bulk campaign (multipart/form-data) |

### Admin (`/api/admin`) - Requires Basic Auth
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/tenants` | POST | Provision new tenant |

### Webhooks (`/api/webhooks`) - No Auth Required
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhooks/passkit/uninstall` | POST | PassKit pass uninstall callback |
| `/api/webhooks/passkit/event` | POST | Generic PassKit event handler |

**PassKit Uninstall Webhook**
- Called by PassKit when a user removes a pass from their wallet
- Updates `passes_master` (status=UNINSTALLED, is_active=false)
- Logs UNINSTALL transaction in `transactions` table
- Always returns 200 OK (as required by PassKit)
- No authentication required (PassKit cannot send custom headers)

**Example webhook payload:**
```json
{
  "id": "passkit-internal-id",
  "event": "delete"
}
```

## Test Results Summary (December 2024)

### API Endpoint Tests - All Passing ✅

| Component | Status | Notes |
|-----------|--------|-------|
| **PostGrid Mail** | ✅ | Templates list (10 templates), validation working |
| **POS Actions** | ✅ | All action types validated, proper error handling |
| **Loyalty** | ✅ | Membership, one-time-use, balance, transactions |
| **Digital Wallet** | ✅ | Pass CRUD, enrollment, coupons, push notifications |
| **Physical Bridge** | ✅ | Claim code status & redemption (route fixed) |
| **Notifications** | ✅ | Broadcast, birthday bot, campaign logs |

### Database Schema Relationships
- `passes_master.program_id` → `programs.id` (FK relationship)
- `programs.passkit_program_id` - PassKit external program ID
- Query pattern: Lookup programs by `passkit_program_id`, then query `passes_master` by internal `program_id`

### Key Fixes Applied
1. **Broadcast Query Fix**: Updated to first lookup program by `passkit_program_id`, then query `passes_master` using internal `program_id` FK
2. **Claim Routes Registration**: Added missing `/api/claim` routes to main router index
3. **Notification Logging**: Uses internal `program.id` for `notification_logs` table