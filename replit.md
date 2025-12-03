# Phygital Loyalty Ecosystem - Backend API

## Overview
This project is a Node.js/Express backend API for a 'Phygital' Loyalty Ecosystem. It integrates digital wallets with physical rewards processing to create a seamless experience between physical interactions and digital loyalty programs. Key capabilities include membership point management, one-time offer redemptions, digital pass creation and updates, and a "Physical Bridge" to convert physical mail recipients into digital wallet users.

## System Architecture

### Core Design
- **Controllers:** Handle incoming requests and delegate to services
- **Services:** Business logic and external system integration (Supabase, PassKit, PostGrid)
- **Logic Service:** Main orchestrator for POS actions, routing to Supabase RPC and PassKit sync

### Data Flow
1. Request → Controller → logic.service.ts
2. Logic Service → Supabase RPC (stored procedure)
3. Supabase executes transaction
4. Logic Service → passkit.service.ts (wallet sync if needed)

## API Endpoints

### POS Actions (Softr Integration)
- `POST /api/pos/action` - Process POS action
- `GET /api/pos/actions` - List available action types

### Loyalty Operations
- `POST /api/loyalty/membership` - Process membership transaction
- `POST /api/loyalty/one-time-use` - Process one-time offer
- `GET /api/loyalty/members/:memberId/balance` - Get points balance
- `GET /api/loyalty/members/:memberId/transactions` - Get transaction history

### Digital Wallet (PassKit)
- `POST /api/wallet/enroll` - Enroll new member
- `POST /api/wallet/coupons` - Issue single-use coupon
- `POST /api/wallet/passes` - Create pass
- `PATCH /api/wallet/passes/:serialNumber` - Update pass
- `DELETE /api/wallet/passes/:serialNumber` - Delete pass
- `POST /api/wallet/passes/:serialNumber/push` - Send push notification

### Direct Mail (PostGrid)
- `POST /api/mail/mail` - Send direct mail
- `GET /api/mail/mail/:mailId` - Get mail status
- `DELETE /api/mail/mail/:mailId` - Cancel mail
- `GET /api/mail/templates` - List templates
- `POST /api/mail/campaign` - Send batch campaign (postcards)

### Physical Bridge (Claim Route)
- `GET /claim/:id` - Process claim code and redirect to PassKit
- `GET /claim/:id/status` - Check claim code status

### Health Checks
- `GET /api/health` - Full health check
- `GET /api/health/ready` - Readiness probe
- `GET /api/health/live` - Liveness probe

## POS Actions

```bash
POST /api/pos/action
{
  "external_id": "QR_CODE_OR_PIN",
  "action": "MEMBER_EARN",
  "amount": 100
}
```

### Action Types
- `MEMBER_EARN` / `MEMBER_REDEEM` / `MEMBER_ADJUST` - Membership points
- `COUPON_ISSUE` / `COUPON_REDEEM` - Coupon operations
- `TICKET_CHECKIN` - Event tickets (placeholder)
- `INSTALL` / `UNINSTALL` - Pass lifecycle

### Supabase RPC Return Fields

**MEMBERSHIP actions:**
```json
{
  "passkit_internal_id": "member_id",
  "passkit_program_id": "4RhsVhHek0dliVogVznjSQ",
  "new_balance": 1100
}
```

**COUPON_ISSUE action:**
```json
{
  "passkit_campaign_id": "YOUR_CAMPAIGN_ID",
  "passkit_offer_id": "YOUR_OFFER_ID"
}
```

## Physical Bridge

Closes the Phygital loop: Physical Mail → QR Scan → Digital Wallet

### Flow
1. **Batch Campaign** → Generate claim codes in Supabase → Send postcards via PostGrid
2. **User Scans QR** → Hits `/claim/{code}` → Lookup in Supabase → Redirect to PassKit
3. **Pass Installed** → User is now a digital loyalty member

### Batch Campaign

```bash
POST /api/mail/campaign
{
  "frontTemplateId": "template_wUMgpJdU5Hi7tPxXNTgLwj",
  "backTemplateId": "template_rBEJn1PtQepWxnKFb4RezV",
  "size": "9x6",
  "programId": "4RhsVhHek0dliVogVznjSQ",
  "baseClaimUrl": "https://your-app.replit.app/claim",
  "contacts": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "addressLine1": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "postalCode": "94102",
      "country": "US"
    }
  ]
}
```

**PostGrid Size Values** (width x height):
- `6x4` - Standard postcard (default)
- `9x6` - Mid-size postcard
- `11x6` - Oversized postcard

### Claim Route Flow
1. Looks up claim code (`lookup_claim_code` RPC)
2. Validates status is `ISSUED`
3. Enrolls user in PassKit (`enrollMember`)
4. Updates status to `INSTALLED`
5. Redirects to PassKit install URL

### PostGrid Template Variables
- `{{firstName}}`, `{{lastName}}`, `{{fullName}}`
- `{{qrCodeUrl}}` - The claim URL for QR code
- `{{claimCode}}` - Raw claim code

## Supabase RPC Functions

### process_membership_transaction
```sql
-- Parameters: p_external_id, p_action, p_amount
-- Returns: transaction_id, new_balance, passkit_internal_id, passkit_program_id
```

### process_one_time_use
```sql
-- Parameters: p_external_id, p_action
-- Returns: passkit_internal_id, passkit_campaign_id, passkit_offer_id
```

### generate_claim_code
```sql
-- Parameters: p_passkit_program_id, p_first_name, p_last_name, p_email, p_address_*
-- Returns: { claim_code }
```

### lookup_claim_code
```sql
-- Parameters: p_claim_code
-- Returns: claim_code, status, passkit_program_id, passkit_install_url, first_name, etc.
-- Status: ISSUED, INSTALLED, EXPIRED, CANCELLED
```

### update_claim_code_status
```sql
-- Parameters: p_claim_code, p_status, p_passkit_install_url
```

## PassKit Protocol Status

| Protocol | Status | Notes |
|----------|--------|-------|
| MEMBERSHIP | ✅ LIVE | Push notifications working |
| COUPON | ✅ LIVE | Issue and redeem |
| EVENT_TICKET | ⏳ PLACEHOLDER | Requires Venue + Event setup |

## Environment Variables

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PASSKIT_API_KEY=
PASSKIT_API_SECRET=
POSTGRID_API_KEY=
```

## Bulk Campaign Manager

### Admin Dashboard
- **URL:** `/admin/campaign`
- **Authentication:** Basic Auth (default: admin/phygital2024)
- **Features:**
  - Drag-and-drop CSV file upload
  - Toggle between Postcards and Letters
  - Configurable program ID, templates, and postcard size
  - Real-time processing status with results table

### CSV Upload Endpoint
```bash
POST /api/campaign/upload-csv
Content-Type: multipart/form-data
Authorization: Basic base64(username:password)

# Common fields
file: campaign.csv
program_id: 4RhsVhHek0dliVogVznjSQ
resource_type: postcard | letter
base_claim_url: https://your-app.replit.app/claim (optional)

# Postcard-specific fields
front_template_id: template_wUMgpJdU5Hi7tPxXNTgLwj
back_template_id: template_rBEJn1PtQepWxnKFb4RezV
size: 6x4 | 9x6 | 11x6

# Letter-specific fields
template_id: template_xxx
```

### CSV Format
```csv
first_name,last_name,email,address,city,state,zip
John,Doe,john@example.com,123 Main St,San Francisco,CA,94102
```

### Response
```json
{
  "success": true,
  "data": {
    "summary": { "total": 10, "success": 9, "failed": 1 },
    "results": [
      { "contact": "John Doe", "success": true, "claimCode": "ABC12345", "postcardId": "postcard_xxx" }
    ]
  }
}
```

## Recent Changes

### 2025-12-03 - Letter Support Added
- Added `sendLetter()` to PostGrid service with letter-specific options (addressPlacement, doubleSided, color)
- Updated campaign.service.ts to accept `resourceType` config and route to postcard or letter
- Updated campaign.controller.ts to accept `resource_type` parameter
- Updated admin dashboard with Postcard/Letter toggle selector and conditional form fields
- Added PostGridLetter schema and types to shared/schema.ts

### 2025-12-03 - Bulk Campaign Manager
- Added multer for CSV file upload handling
- Created campaign.service.ts with CSV stream processing
- Created campaign.controller.ts and POST /api/campaign/upload-csv endpoint
- Built admin dashboard at /admin/campaign with Bootstrap UI
- Added basic auth middleware for admin routes
- End-to-end tested: CSV upload → claim codes generated → postcards sent

### 2025-12-03 - Physical Bridge Complete
- Added `sendPostcard()` to PostGrid service with front/back template support
- Added claim code RPC functions to Supabase service
- Created `POST /api/mail/campaign` batch endpoint
- Created `GET /claim/:id` redirect route with PassKit enrollment
- Created `GET /claim/:id/status` endpoint for claim status lookup
- Fixed PostGrid size format (width x height: `6x4`, `9x6`, `11x6`)
- Fixed PassKit enrollment to include required `tierId` parameter
- Full Phygital loop verified working: Postcard → QR Scan → PassKit Enrollment

### 2025-12-03 - Coupon Protocol
- Added `issueCoupon()` function
- Added `POST /api/wallet/coupons` endpoint

### 2025-12-03 - PassKit Production
- Live pass updates with push notifications
- JWT authentication via passkitJWT.ts
- US region: `https://api.pub2.passkit.io`
- Pass install URL format: `https://pub2.pskt.io/{memberId}`
