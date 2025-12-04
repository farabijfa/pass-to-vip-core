# Phygital Loyalty Ecosystem - Backend API

## Overview
This project is a Node.js/Express backend API for a 'Phygital' Loyalty Ecosystem. It integrates digital wallets with physical rewards processing, bridging physical interactions and digital loyalty programs. Key capabilities include membership point management, one-time offer redemptions, dynamic digital pass creation and updates, and a "Physical Bridge" to convert physical mail recipients into digital wallet users. The business vision is to provide a robust, scalable platform that enhances customer engagement through a unified loyalty experience across physical and digital touchpoints, with significant market potential in retail, hospitality, and event management.

## User Preferences
I want iterative development.
I prefer to be asked before you make any major changes to the codebase.
I prefer detailed explanations when new features or complex logic are introduced.
I do not want the agent to make changes to the /admin folder.

## System Architecture

### Core Design
- **Controllers:** Manage API requests and delegate to services.
- **Services:** Encapsulate business logic and handle integrations with external systems (Supabase, PassKit, PostGrid).
- **Logic Service:** Orchestrates Point-of-Sale (POS) actions, routing requests to Supabase RPC for data operations and PassKit for wallet synchronization.

### Data Flow
1. Client Request → Controller → `logic.service.ts`
2. `logic.service.ts` → Supabase RPC (executes stored procedures)
3. Supabase performs transactional database operations.
4. `logic.service.ts` → `passkit.service.ts` (triggers digital wallet updates if required).

### UI/UX Decisions
- **Admin Dashboard:** Bootstrap-based UI for managing bulk campaigns, including CSV upload, configurable program IDs, templates, and real-time processing status.

### Technical Implementations
- **API Endpoints:** RESTful APIs for POS actions, loyalty, digital wallet management, direct mail, physical bridge, and high-scale notifications.
- **Supabase RPC:** Utilizes Supabase Remote Procedure Calls for secure execution of complex database logic (`process_membership_transaction`, `process_one_time_use`, `generate_claim_code`, etc.).
- **Physical Bridge:** Implements a full "Phygital" loop where physical mail with QR codes leads to digital wallet enrollment via a claim route, integrating claim code generation, lookup, and PassKit enrollment.
- **Multi-Tenant SaaS:** Supports tenant provisioning through an admin API, allowing creation of new tenants with associated Supabase Auth users, programs, and admin profiles.
- **High-Scale Notification Service:** Designed for efficient broadcast and targeted notifications using batch processing and parallel execution to manage PassKit rate limits, with campaign logging.
- **QR Code Generation:** Automatically generates printable QR code image URLs using `api.qrserver.com`.
- **Security:** Admin API endpoints are protected by API key authentication; admin routes use Basic Auth.

### Feature Specifications
- **POS Actions:** Supports `MEMBER_EARN`, `MEMBER_REDEEM`, `COUPON_ISSUE`, `COUPON_REDEEM`.
- **Digital Wallet:** Manages enrollment, coupon issuance, pass creation, updates, deletion, and push notifications via PassKit.
- **Direct Mail:** Integrates with PostGrid for sending postcards and letters, supporting templates and variables.
- **Bulk Campaign Manager:** Facilitates batch campaigns via CSV upload, sending physical mail with dynamically generated claim codes.
- **Broadcast Notifications:** Sends push notifications to all active passes in a program, with dry-run testing and batched execution.
- **Birthday Bot:** Configuration-driven automated process to identify members with birthdays, award points, and send personalized push notifications, with double-gifting prevention and scheduling.
- **CSV Campaign Upload:** Supports `birth_date` and `phone_number` columns with flexible header mapping and multiple date formats, automatically upserting users by email.

## External Dependencies

-   **Supabase:**
    -   **Database:** PostgreSQL for loyalty program data, member information, transactions, and claim codes.
    -   **Authentication:** Handles user authentication.
    -   **Edge Functions/RPC:** Executes stored procedures for core loyalty logic.
-   **PassKit (via PassKit API):**
    -   **Digital Wallet Management:** Creates, updates, and manages digital passes (memberships, coupons, event tickets).
    -   **Push Notifications:** Delivers real-time updates and messages to digital wallet holders.
-   **PostGrid (via PostGrid API):**
    -   **Direct Mail:** Sends physical postcards and letters for loyalty campaigns and the "Physical Bridge."
    -   **Template Management:** Uses PostGrid templates for dynamic content in physical mail.
-   **`api.qrserver.com`:**
    -   **QR Code Generation:** Converts claim URLs into QR code image URLs for printing on physical mail.

## Key Files

### Birthday Bot
- `server/services/notification.service.ts` - Core birthday bot logic with dry-run support
- `server/controllers/notification.controller.ts` - API endpoints for birthday bot (run and test)
- `server/routes/notification.routes.ts` - Route definitions for `/api/notify/*`
- `scripts/birthday-cron.cjs` - Cron job script for scheduled execution

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

**PassKit Webhook Events**
- `PASS_EVENT_UNINSTALLED` - User removes pass from wallet
- `PASS_EVENT_RECORD_DELETED` - Pass permanently deleted from PassKit
- Always returns 200 OK (as required by PassKit)
- No authentication required (PassKit cannot send custom headers)

**Supported Protocol Types:**
| Protocol Code | Type | Description |
|--------------|------|-------------|
| 100 | MEMBERSHIP | Loyalty/membership cards |
| 200 | COUPON | Single-use coupons |
| 300 | EVENT_TICKET | Event tickets |

**Actions on Uninstall:**
- Updates `passes_master` (status=UNINSTALLED, is_active=false)
- Logs UNINSTALL transaction in `transactions` table
- Returns protocol type, classId (campaign), and pass details

**Example PassKit webhook payload (PASS_EVENT_UNINSTALLED):**
```json
{
  "event": "PASS_EVENT_UNINSTALLED",
  "pass": {
    "id": "5u5EO18473CDVG0Vw0VgPV",
    "classId": "24hmYozRggBJTtPt0Y2e3X",
    "protocol": 100,
    "personDetails": {
      "displayName": "John Doe",
      "emailAddress": "john@example.com"
    },
    "metadata": {
      "status": 2,
      "lifecycleEvents": [1, 2, 1024]
    },
    "recordData": {
      "members.member.externalId": "ABC123",
      "members.program.id": "24hmYozRggBJTtPt0Y2e3X"
    }
  }
}
```

**Legacy payload format (still supported):**
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
| **Webhooks** | ✅ | PassKit uninstall/delete events, all protocol types (MEMBERSHIP, COUPON, EVENT_TICKET) |

### Database Schema Relationships
- `passes_master.program_id` → `programs.id` (FK relationship)
- `programs.passkit_program_id` - PassKit external program ID
- Query pattern: Lookup programs by `passkit_program_id`, then query `passes_master` by internal `program_id`

### Key Fixes Applied
1. **Broadcast Query Fix**: Updated to first lookup program by `passkit_program_id`, then query `passes_master` using internal `program_id` FK
2. **Claim Routes Registration**: Added missing `/api/claim` routes to main router index
3. **Notification Logging**: Uses internal `program.id` for `notification_logs` table
4. **PassKit Webhook Enhancement**: Updated to handle correct PassKit event types (`PASS_EVENT_UNINSTALLED`, `PASS_EVENT_RECORD_DELETED`) with nested `pass.id` payload structure and protocol identification for all pass types
