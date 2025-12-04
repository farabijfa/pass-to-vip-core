# Phygital Loyalty Ecosystem

A comprehensive Node.js/Express backend API that bridges physical and digital loyalty experiences. This system integrates digital wallet technology (PassKit) with physical mail delivery (PostGrid) to create seamless customer engagement through QR-based redemption flows.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [System Design](#system-design)
5. [API Reference](#api-reference)
6. [Services](#services)
7. [Physical Bridge Flow](#physical-bridge-flow)
8. [Database Schema](#database-schema)
9. [Environment Configuration](#environment-configuration)
10. [Admin Dashboard](#admin-dashboard)
11. [Deployment](#deployment)

---

## Overview

The Phygital Loyalty Ecosystem solves the challenge of connecting offline customer interactions with digital loyalty programs. Key capabilities include:

- **Membership Management**: Points earning, redemption, and balance tracking
- **Digital Wallet Integration**: Apple Wallet and Google Wallet pass creation via PassKit
- **Physical Mail Campaigns**: Automated postcard and letter sending via PostGrid
- **Physical Bridge**: QR code redemption flow converting mail recipients to digital wallet users
- **POS Integration**: Real-time transaction processing for Softr and other POS systems

### The "Phygital" Concept

```
Physical World                    Digital World
     │                                 │
     ▼                                 ▼
┌─────────────┐   QR Scan    ┌─────────────────┐
│  Postcard/  │ ──────────►  │  Digital Wallet │
│   Letter    │              │   (Apple/Google)│
└─────────────┘              └─────────────────┘
     │                                 │
     └────────── Unified ──────────────┘
                Loyalty
               Experience
```

---

## Architecture

### High-Level Architecture

```
                                    ┌──────────────────────────────────────────┐
                                    │           External Services              │
                                    │  ┌─────────┐ ┌─────────┐ ┌───────────┐  │
                                    │  │ PassKit │ │PostGrid │ │  Supabase │  │
                                    │  │   API   │ │   API   │ │    RPC    │  │
                                    │  └────┬────┘ └────┬────┘ └─────┬─────┘  │
                                    └───────┼──────────┼─────────────┼────────┘
                                            │          │             │
┌────────────────────────────────────────────────────────────────────────────────┐
│                              Application Layer                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           Express Server (:5000)                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│  ┌───────────────────────────────────┼──────────────────────────────────────┐  │
│  │                              Routes Layer                                 │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │   POS    │ │  Loyalty │ │  Wallet  │ │   Mail   │ │   Campaign   │   │  │
│  │  │  Routes  │ │  Routes  │ │  Routes  │ │  Routes  │ │    Routes    │   │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘   │  │
│  └───────┼────────────┼────────────┼────────────┼──────────────┼───────────┘  │
│          │            │            │            │              │               │
│  ┌───────┼────────────┼────────────┼────────────┼──────────────┼───────────┐  │
│  │       ▼            ▼            ▼            ▼              ▼            │  │
│  │                         Controllers Layer                                │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │   POS    │ │  Loyalty │ │  Wallet  │ │   Mail   │ │   Campaign   │   │  │
│  │  │Controller│ │Controller│ │Controller│ │Controller│ │  Controller  │   │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘   │  │
│  └───────┼────────────┼────────────┼────────────┼──────────────┼───────────┘  │
│          │            │            │            │              │               │
│  ┌───────┴────────────┴────────────┴────────────┴──────────────┴───────────┐  │
│  │                           Services Layer                                 │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │  │
│  │  │    Logic     │ │   PassKit    │ │   PostGrid   │ │   Supabase   │    │  │
│  │  │   Service    │ │   Service    │ │   Service    │ │   Service    │    │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘    │  │
│  │  ┌──────────────┐                                                        │  │
│  │  │   Campaign   │                                                        │  │
│  │  │   Service    │                                                        │  │
│  │  └──────────────┘                                                        │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Strict Separation of Concerns**
   - Controllers: Request/response handling, validation
   - Services: Business logic, external API integration
   - Routes: URL mapping, middleware application

2. **Database Logic via RPC**
   - All complex database operations use Supabase RPC stored procedures
   - Ensures transactional integrity and reduces round trips

3. **Stateless API Design**
   - JWT authentication for PassKit
   - Basic auth for admin routes
   - Session-based auth available for web interfaces

4. **Fail-Fast Error Handling**
   - Comprehensive error codes and messages
   - Detailed logging for debugging

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Runtime** | Node.js 20 | Server-side JavaScript |
| **Framework** | Express.js | HTTP server, routing, middleware |
| **Language** | TypeScript | Type safety, developer experience |
| **Database** | PostgreSQL (Supabase) | Data persistence, RPC functions |
| **ORM** | Drizzle ORM | Type-safe database queries |
| **Validation** | Zod | Schema validation |
| **Auth** | JWT / Basic Auth | API authentication |
| **File Upload** | Multer | CSV file handling |
| **CSV Parsing** | csv-parser | Stream-based CSV processing |

### External Services

| Service | Purpose | Region |
|---------|---------|--------|
| **PassKit** | Digital wallet passes (Apple/Google) | US (PUB2) |
| **PostGrid** | Physical mail delivery (postcards, letters) | US/Canada |
| **Supabase** | PostgreSQL database, RPC functions | Cloud |
| **QR Server** | QR code image generation | api.qrserver.com |

---

## System Design

### Request Flow

```
Client Request
      │
      ▼
┌─────────────────┐
│    Express      │
│   Middleware    │
│  (CORS, Auth,   │
│   Logging)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Router      │
│  (URL Matching) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Controller    │
│  (Validation,   │
│   Response)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Service      │
│ (Business Logic)│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│Supabase│ │External│
│  RPC   │ │  APIs  │
└───────┘ └───────┘
```

### Service Responsibilities

#### Logic Service (`logic.service.ts`)
The main orchestrator for POS actions:
- Routes actions to appropriate Supabase RPC functions
- Triggers PassKit wallet updates after transactions
- Handles action type mapping (MEMBER_EARN, COUPON_REDEEM, etc.)

#### PassKit Service (`passkit.service.ts`)
Digital wallet integration:
- Member enrollment and pass creation
- Pass updates with push notifications
- Coupon issuance and redemption
- JWT-based authentication to PassKit API

#### PostGrid Service (`postgrid.service.ts`)
Physical mail delivery:
- Postcard sending (front/back templates)
- Letter sending (A4 format)
- Template management
- Mail status tracking

#### Supabase Service (`supabase.service.ts`)
Database operations via RPC:
- `process_membership_transaction`: Points earn/redeem
- `process_one_time_use`: Coupon operations
- `generate_claim_code`: Physical bridge codes
- `lookup_claim_code`: Claim validation
- `update_claim_code_status`: Status transitions

#### Campaign Service (`campaign.service.ts`)
Bulk mail operations:
- CSV file parsing and validation
- Contact normalization
- Batch claim code generation
- Batch mail sending (postcards or letters)

---

## API Reference

### Base URL
```
Production: https://your-app.replit.app/api
Development: http://localhost:5000/api
```

### Authentication

**Admin Routes** (Basic Auth):
```
Authorization: Basic base64(username:password)
Default: admin:phygital2024
```

**API Routes** (API Key or JWT):
```
x-api-key: YOUR_API_KEY
# or
Authorization: Bearer <JWT>
```

---

### POS Actions

#### Process POS Action
```http
POST /api/pos/action
Content-Type: application/json

{
  "external_id": "QR_CODE_OR_MEMBER_PIN",
  "action": "MEMBER_EARN",
  "amount": 100
}
```

**Action Types:**
| Action | Description | Required Fields |
|--------|-------------|-----------------|
| `MEMBER_EARN` | Award points | `external_id`, `amount` |
| `MEMBER_REDEEM` | Deduct points | `external_id`, `amount` |
| `MEMBER_ADJUST` | Adjust balance | `external_id`, `amount` |
| `COUPON_ISSUE` | Issue coupon | `external_id` |
| `COUPON_REDEEM` | Redeem coupon | `external_id` |
| `INSTALL` | Pass installed | `external_id` |
| `UNINSTALL` | Pass removed | `external_id` |

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_123",
    "newBalance": 1100,
    "action": "MEMBER_EARN"
  }
}
```

---

### Loyalty Operations

#### Process Membership Transaction
```http
POST /api/loyalty/membership
Content-Type: application/json

{
  "externalId": "MEMBER_PIN",
  "action": "MEMBER_EARN",
  "amount": 50
}
```

#### Get Points Balance
```http
GET /api/loyalty/members/:memberId/balance
```

#### Get Transaction History
```http
GET /api/loyalty/members/:memberId/transactions
```

---

### Digital Wallet (PassKit)

#### Enroll New Member
```http
POST /api/wallet/enroll
Content-Type: application/json

{
  "programId": "4RhsVhHek0dliVogVznjSQ",
  "tierId": "base",
  "member": {
    "externalId": "MEMBER_001",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "memberId": "abc123",
    "installUrl": "https://pub2.pskt.io/abc123"
  }
}
```

#### Issue Coupon
```http
POST /api/wallet/coupons
Content-Type: application/json

{
  "campaignId": "CAMPAIGN_ID",
  "offerId": "OFFER_ID",
  "externalId": "COUPON_001"
}
```

#### Update Pass
```http
PATCH /api/wallet/passes/:serialNumber
Content-Type: application/json

{
  "points": 500,
  "tier": "gold"
}
```

#### Send Push Notification
```http
POST /api/wallet/passes/:serialNumber/push
```

---

### Direct Mail (PostGrid)

#### Send Postcard
```http
POST /api/mail/mail
Content-Type: application/json

{
  "type": "postcard",
  "frontTemplateId": "template_xxx",
  "backTemplateId": "template_yyy",
  "size": "6x4",
  "recipientAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "addressLine1": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "postalCode": "94102",
    "country": "US"
  },
  "mergeVariables": {
    "firstName": "John",
    "qrCodeUrl": "https://api.qrserver.com/..."
  }
}
```

#### Send Letter
```http
POST /api/mail/mail
Content-Type: application/json

{
  "type": "letter",
  "templateId": "template_xxx",
  "recipientAddress": { ... },
  "mergeVariables": { ... },
  "addressPlacement": "top_first_page",
  "doubleSided": true,
  "color": true
}
```

**Postcard Sizes:**
| Size | Dimensions | Description |
|------|------------|-------------|
| `6x4` | 6" × 4" | Standard postcard |
| `9x6` | 9" × 6" | Mid-size postcard |
| `11x6` | 11" × 6" | Oversized postcard |

---

### Bulk Campaign

#### Upload CSV Campaign
```http
POST /api/campaign/upload-csv
Content-Type: multipart/form-data
Authorization: Basic base64(admin:phygital2024)

file: campaign.csv
program_id: 4RhsVhHek0dliVogVznjSQ
resource_type: postcard | letter

# For postcards:
front_template_id: template_xxx
back_template_id: template_yyy
size: 6x4 | 9x6 | 11x6

# For letters:
template_id: template_xxx
```

**CSV Format:**
```csv
first_name,last_name,email,address,city,state,zip
John,Doe,john@example.com,123 Main St,San Francisco,CA,94102
Jane,Smith,jane@example.com,456 Oak Ave,Los Angeles,CA,90001
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 10,
      "success": 9,
      "failed": 1,
      "resourceType": "postcard"
    },
    "results": [
      {
        "contact": "John Doe",
        "success": true,
        "claimCode": "A1B2C3D4",
        "mailId": "postcard_xxx"
      }
    ]
  }
}
```

---

### Physical Bridge (Claim Routes)

#### Process Claim Code
```http
GET /claim/:claimCode
```
Redirects to PassKit install URL after:
1. Validating claim code
2. Enrolling member in PassKit
3. Updating claim status to INSTALLED

#### Check Claim Status
```http
GET /claim/:claimCode/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "claimCode": "A1B2C3D4",
    "status": "ISSUED",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Claim Status Flow:**
```
ISSUED ────► INSTALLED
   │              │
   └──► EXPIRED   │
   │              │
   └──► CANCELLED─┘
```

---

### Health Checks

```http
GET /api/health        # Full health check with service status
GET /api/health/ready  # Kubernetes readiness probe
GET /api/health/live   # Kubernetes liveness probe
```

---

## Physical Bridge Flow

The Physical Bridge connects offline mail campaigns to digital wallet enrollment:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         PHYSICAL BRIDGE FLOW                                │
└────────────────────────────────────────────────────────────────────────────┘

Step 1: Campaign Creation
┌─────────────────────┐
│  Admin Dashboard    │
│  /admin/campaign    │
│                     │
│  ┌───────────────┐  │
│  │ Upload CSV    │  │
│  └───────────────┘  │
└──────────┬──────────┘
           │
           ▼
Step 2: Process Each Contact
┌─────────────────────────────────────────────┐
│  For each row in CSV:                        │
│                                              │
│  1. Generate claim code (Supabase RPC)       │
│     └─► Returns: A1B2C3D4                    │
│                                              │
│  2. Generate QR code image                   │
│     └─► https://api.qrserver.com/...         │
│                                              │
│  3. Send mail via PostGrid                   │
│     └─► Postcard or Letter with QR           │
└─────────────────────────────────────────────┘
           │
           ▼
Step 3: Mail Delivered (Physical World)
┌─────────────────────────────────────────────┐
│  ┌───────────────────────────────────────┐  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │                                 │  │  │
│  │  │   Dear John,                    │  │  │
│  │  │                                 │  │  │
│  │  │   Scan to join our             │  │  │
│  │  │   loyalty program!              │  │  │
│  │  │                                 │  │  │
│  │  │   ┌─────────┐                   │  │  │
│  │  │   │ QR CODE │                   │  │  │
│  │  │   │  █▀▀█   │                   │  │  │
│  │  │   │  █▄▄█   │                   │  │  │
│  │  │   └─────────┘                   │  │  │
│  │  │                                 │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
           │
           ▼
Step 4: User Scans QR Code
┌─────────────────────────────────────────────┐
│  Phone Camera → Opens URL:                   │
│  https://app.replit.app/claim/A1B2C3D4      │
└─────────────────────────────────────────────┘
           │
           ▼
Step 5: Claim Processing
┌─────────────────────────────────────────────┐
│  GET /claim/A1B2C3D4                         │
│                                              │
│  1. Lookup claim code                        │
│     └─► Validate status = ISSUED            │
│                                              │
│  2. Enroll in PassKit                        │
│     └─► Create digital wallet pass          │
│                                              │
│  3. Update claim status                      │
│     └─► Status = INSTALLED                  │
│                                              │
│  4. Redirect to PassKit                      │
│     └─► https://pub2.pskt.io/memberId       │
└─────────────────────────────────────────────┘
           │
           ▼
Step 6: Digital Wallet (Digital World)
┌─────────────────────────────────────────────┐
│  ┌───────────────────────────────────────┐  │
│  │         LOYALTY CARD                  │  │
│  │                                       │  │
│  │    John Doe                           │  │
│  │    Member since Dec 2025              │  │
│  │                                       │  │
│  │    Points: 0                          │  │
│  │    Tier: Base                         │  │
│  │                                       │  │
│  │    ████████████████                   │  │
│  │    ████████████████                   │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  Saved to Apple Wallet / Google Pay         │
└─────────────────────────────────────────────┘
```

---

## Database Schema

### Supabase RPC Functions

#### `generate_claim_code`
```sql
CREATE OR REPLACE FUNCTION generate_claim_code(
  p_passkit_program_id TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_address_line_1 TEXT,
  p_city TEXT,
  p_state TEXT,
  p_postal_code TEXT,
  p_country TEXT DEFAULT 'US'
)
RETURNS JSON AS $$
  -- Generates unique 8-character claim code
  -- Stores contact info for later enrollment
  -- Returns: { "claim_code": "A1B2C3D4" }
$$;
```

#### `lookup_claim_code`
```sql
CREATE OR REPLACE FUNCTION lookup_claim_code(
  p_claim_code TEXT
)
RETURNS JSON AS $$
  -- Returns claim code details and status
  -- Returns: {
  --   "claim_code": "A1B2C3D4",
  --   "status": "ISSUED",
  --   "passkit_program_id": "...",
  --   "first_name": "John",
  --   ...
  -- }
$$;
```

#### `update_claim_code_status`
```sql
CREATE OR REPLACE FUNCTION update_claim_code_status(
  p_claim_code TEXT,
  p_status TEXT,
  p_passkit_install_url TEXT DEFAULT NULL
)
RETURNS JSON AS $$
  -- Updates claim status (ISSUED → INSTALLED)
  -- Stores PassKit install URL for reference
$$;
```

#### `process_membership_transaction`
```sql
CREATE OR REPLACE FUNCTION process_membership_transaction(
  p_external_id TEXT,
  p_action TEXT,
  p_amount INTEGER
)
RETURNS JSON AS $$
  -- Processes EARN/REDEEM/ADJUST actions
  -- Returns: {
  --   "transaction_id": "txn_123",
  --   "new_balance": 1100,
  --   "passkit_internal_id": "member_id",
  --   "passkit_program_id": "..."
  -- }
$$;
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# PassKit (US Region - PUB2)
PASSKIT_API_KEY=your_api_key
PASSKIT_API_SECRET=your_api_secret

# PostGrid
POSTGRID_API_KEY=test_sk_xxx

# Application
APP_URL=https://your-app.replit.app
SESSION_SECRET=random_secret_string
NODE_ENV=production

# Optional
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
```

### PassKit Configuration

| Setting | Value |
|---------|-------|
| Region | US (PUB2) |
| API Base URL | `https://api.pub2.passkit.io` |
| Install URL Format | `https://pub2.pskt.io/{memberId}` |
| Default Program ID | `4RhsVhHek0dliVogVznjSQ` |
| Default Tier ID | `base` |

### PostGrid Templates

| Template | ID | Purpose |
|----------|-----|---------|
| Postcard Front | `template_wUMgpJdU5Hi7tPxXNTgLwj` | QR code and branding |
| Postcard Back | `template_rBEJn1PtQepWxnKFb4RezV` | Message and CTA |
| Letter (A4) | `template_3J62GbmowSk7SeD4dFcaUs` | Full letter format |

### Template Merge Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{firstName}}` | Recipient first name | John |
| `{{lastName}}` | Recipient last name | Doe |
| `{{fullName}}` | Full name | John Doe |
| `{{qrCodeUrl}}` | QR code image URL | `https://api.qrserver.com/...` |
| `{{claimCode}}` | Raw claim code | A1B2C3D4 |

---

## Admin Dashboard

### Access
- **URL**: `/admin/campaign`
- **Authentication**: Basic Auth
- **Default Credentials**: `admin` / `phygital2024`

### Features

1. **CSV Upload**
   - Drag-and-drop file upload
   - Automatic column detection
   - Format validation

2. **Resource Type Selection**
   - Toggle between Postcards and Letters
   - Dynamic form fields based on selection

3. **Template Configuration**
   - Postcard: Front template, back template, size
   - Letter: Single template ID

4. **Real-Time Processing**
   - Progress indicator during batch processing
   - Results table with success/failure status
   - Claim codes and mail IDs displayed

### CSV Column Mappings

The system automatically detects these column variations:

| Target Field | Accepted Column Names |
|--------------|----------------------|
| firstName | first_name, firstname, fname, given_name |
| lastName | last_name, lastname, lname, surname |
| email | email, e-mail, email_address |
| addressLine1 | address, street, addr, address1 |
| city | city, town, locality |
| state | state, province, region, st |
| postalCode | zip, zipcode, postal_code, postalcode |

---

## Deployment

### Replit Deployment

1. **Environment Setup**
   - Add all required secrets in the Secrets tab
   - Set `APP_URL` to your Replit deployment URL

2. **Start Command**
   ```bash
   npm run dev
   ```

3. **Health Check**
   ```bash
   curl https://your-app.replit.app/api/health
   ```

### Production Checklist

- [ ] All environment variables configured
- [ ] PassKit API credentials (production)
- [ ] PostGrid API key (live mode)
- [ ] Supabase RPC functions deployed
- [ ] Admin password changed from default
- [ ] APP_URL set to production domain
- [ ] Health endpoints responding

---

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "resource_type must be either 'postcard' or 'letter'"
  },
  "metadata": {
    "requestId": "abc123",
    "timestamp": "2025-12-03T23:00:00.000Z"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `INVALID_RESOURCE_TYPE` | 400 | resource_type not postcard/letter |
| `INVALID_POSTCARD_SIZE` | 400 | Size not 6x4/9x6/11x6 |
| `CLAIM_NOT_FOUND` | 404 | Claim code doesn't exist |
| `CLAIM_ALREADY_USED` | 409 | Claim already installed |
| `PASSKIT_ERROR` | 502 | PassKit API failure |
| `POSTGRID_ERROR` | 502 | PostGrid API failure |
| `DATABASE_ERROR` | 500 | Supabase RPC failure |

---

## License

MIT License - See LICENSE file for details.

---

## Support

For issues and feature requests, please open a GitHub issue or contact the development team.
