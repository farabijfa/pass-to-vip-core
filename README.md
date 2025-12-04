<p align="center">
  <img src="https://img.shields.io/badge/Platform-Phygital%20Loyalty-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIxIDEySDE3TDE0IDIxTDEwIDNMNyAxMkgzIi8+PC9zdmc+" alt="Platform"/>
  <img src="https://img.shields.io/badge/Status-Production%20Ready-22c55e?style=for-the-badge" alt="Status"/>
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
</p>

<h1 align="center">Phygital Loyalty Ecosystem</h1>

<p align="center">
  <strong>Enterprise-grade multi-tenant SaaS platform bridging physical mail and digital wallets</strong>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> |
  <a href="#-features">Features</a> |
  <a href="#-architecture">Architecture</a> |
  <a href="#-api-reference">API Reference</a> |
  <a href="#-deployment">Deployment</a>
</p>

---

## What is Phygital?

**Phygital** = **Physical** + **Digital**

This platform transforms physical mail recipients into digital wallet users through QR-based redemption flows. Built for **PassToVIP** (passtovip.com / scantovip.com) under **OakMontLogic**, it serves retail, hospitality, and event management industries.

```
    PHYSICAL WORLD                              DIGITAL WORLD
         
    +--------------+                        +------------------+
    |   Postcard   |     QR Code Scan      |   Apple Wallet   |
    |   or Letter  |  ------------------>  |   Google Pay     |
    |   with QR    |                        |   Loyalty Pass   |
    +--------------+                        +------------------+
          |                                         |
          |              UNIFIED LOYALTY            |
          +----------------EXPERIENCE---------------+
```

---

## Table of Contents

- [Quick Start](#-quick-start)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [API Reference](#-api-reference)
- [Database Schema](#-database-schema)
- [Security & Enterprise Features](#-security--enterprise-features)
- [WeWeb Integration](#-weweb-integration)
- [Production Validation](#-production-validation)
- [Environment Configuration](#-environment-configuration)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## Quick Start

### Prerequisites

- Node.js 20.x
- npm or yarn
- Supabase account (PostgreSQL database)
- PassKit account (digital wallet integration)
- PostGrid account (physical mail delivery)

### 1. Clone & Install

```bash
git clone <repository-url>
cd phygital-loyalty
npm install
```

### 2. Configure Environment

Create your environment variables (see [Environment Configuration](#-environment-configuration)):

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_API_KEY=pk_live_your_api_key
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=your_random_secret

# Optional (for full functionality)
PASSKIT_API_KEY=your_passkit_key
PASSKIT_API_SECRET=your_passkit_secret
POSTGRID_API_KEY=your_postgrid_key
APP_URL=https://your-app.replit.app
```

### 3. Run Database Migrations

Execute these SQL files in **Supabase Studio > SQL Editor** (in order):

```
migrations/001_performance_indexes.sql
migrations/002_program_suspension.sql
migrations/003_passkit_tier_id.sql
migrations/004_rpc_functions_verification.sql
```

### 4. Start Development Server

```bash
npm run dev
```

Server starts at `http://localhost:5000`

### 5. Verify Installation

```bash
# Health check
curl http://localhost:5000/api/health

# Run production validation (7 comprehensive tests)
npx tsx scripts/prod-validation.ts
```

---

## Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Multi-Tenant Architecture** | Secure data isolation per client with program-level access control |
| **Digital Wallet Integration** | Apple Wallet & Google Pay passes via PassKit |
| **Physical Mail Campaigns** | Automated postcards & letters via PostGrid |
| **Physical Bridge** | QR code redemption converting mail to digital wallet users |
| **POS Integration** | Real-time points earn/redeem for retail systems |
| **Push Notifications** | Real-time wallet updates with buzz notifications |
| **Birthday Bot** | Automated birthday reward distribution |

### Enterprise Security

| Feature | Description |
|---------|-------------|
| **Kill Switch** | Instantly suspend non-paying clients |
| **Rate Limiting** | 60 req/min for POS, 10 req/min for notifications |
| **API Key Authentication** | Secure API access with rotatable keys |
| **Input Validation** | Zod schema validation on all endpoints |
| **UUID Verification** | Prevents cross-tenant data leakage |
| **Dry-Run Mode** | Test campaigns without sending real notifications |

### Operational Features

| Feature | Description |
|---------|-------------|
| **Health Monitoring** | Detailed service status with reason codes |
| **Churn Tracking** | Webhook-based pass uninstall detection |
| **Campaign Logging** | Full audit trail for all marketing actions |
| **CSV Bulk Upload** | Process thousands of contacts at once |
| **WeWeb Dashboard** | Low-code admin interface integration |

---

## Architecture

### High-Level System Design

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                      |
|   +-------------+    +-------------+    +-------------+    +----------------+     |
|   |   WeWeb     |    |    POS      |    |   Mobile    |    |   Mail Scan    |     |
|   |  Dashboard  |    |   System    |    |   Wallet    |    |    (QR Code)   |     |
|   +------+------+    +------+------+    +------+------+    +-------+--------+     |
+----------|------------------|------------------|------------------|--------------+
           |                  |                  |                  |
           v                  v                  v                  v
+-----------------------------------------------------------------------------------+
|                              API GATEWAY (Express.js :5000)                        |
|   +------------------------------------------------------------------------+      |
|   |  Middleware: CORS | Rate Limiting | Auth | Request ID | Error Handler  |      |
|   +------------------------------------------------------------------------+      |
+-----------------------------------------------------------------------------------+
           |
           v
+-----------------------------------------------------------------------------------+
|                                 ROUTES LAYER                                       |
|   +---------+ +--------+ +-------+ +-------+ +----------+ +--------+ +--------+   |
|   |  Admin  | |  POS   | | Claim | |Loyalty| |Notify    | |Programs| |Webhooks|   |
|   | Routes  | | Routes | |Routes | |Routes | |  Routes  | | Routes | | Routes |   |
|   +---------+ +--------+ +-------+ +-------+ +----------+ +--------+ +--------+   |
+-----------------------------------------------------------------------------------+
           |
           v
+-----------------------------------------------------------------------------------+
|                              CONTROLLERS LAYER                                     |
|   Request validation, response formatting, error handling                          |
+-----------------------------------------------------------------------------------+
           |
           v
+-----------------------------------------------------------------------------------+
|                               SERVICES LAYER                                       |
|   +------------+  +------------+  +------------+  +------------+  +------------+  |
|   |   Logic    |  |  PassKit   |  |  PostGrid  |  | Supabase   |  | Notification|  |
|   |  Service   |  |  Service   |  |  Service   |  |  Service   |  |   Service   |  |
|   | (POS Flow) |  | (Wallets)  |  |  (Mail)    |  |   (DB)     |  |   (Push)    |  |
|   +------------+  +------------+  +------------+  +------------+  +------------+  |
+-----------------------------------------------------------------------------------+
           |                    |                  |
           v                    v                  v
+-----------------------------------------------------------------------------------+
|                            EXTERNAL SERVICES                                       |
|   +----------------+    +----------------+    +------------------+                 |
|   |    Supabase    |    |    PassKit     |    |     PostGrid     |                 |
|   |   PostgreSQL   |    | Digital Wallet |    |   Physical Mail  |                 |
|   |   RPC Functions|    |   Apple/Google |    |  Postcards/Letters|                 |
|   +----------------+    +----------------+    +------------------+                 |
+-----------------------------------------------------------------------------------+
```

### Request Flow

```
Client Request
      |
      v
+------------------+
|    Express       |
|   Middleware     |
| (CORS, Auth,     |
|  Rate Limit,     |
|  Request ID)     |
+--------+---------+
         |
         v
+------------------+
|     Router       |
| (URL Matching)   |
+--------+---------+
         |
         v
+------------------+
|   Controller     |
| (Validation,     |
|  Response)       |
+--------+---------+
         |
         v
+------------------+
|    Service       |
|(Business Logic)  |
+--------+---------+
         |
    +----+----+
    |         |
    v         v
+-------+ +--------+
|Supabase| |External|
|  RPC   | |  APIs  |
+-------+ +--------+
```

### Physical Bridge Flow

```
Step 1: Campaign Upload          Step 2: Mail Sent            Step 3: User Scans QR
+-------------------+           +------------------+          +-------------------+
|  Admin uploads    |           |   Postcard or    |          |  Phone camera     |
|  CSV with names,  |  ------>  |   Letter with    |  ------> |  opens:           |
|  addresses        |           |   QR code        |          |  /claim/A1B2C3D4  |
+-------------------+           +------------------+          +-------------------+
         |                               |                             |
         |                               |                             |
         v                               v                             v
+-------------------+           +------------------+          +-------------------+
| System generates  |           |  Customer's      |          |  Server enrolls   |
| claim codes &     |           |  mailbox         |          |  in PassKit &     |
| sends via PostGrid|           |                  |          |  redirects        |
+-------------------+           +------------------+          +-------------------+
                                                                       |
                                                                       v
                                                              +-------------------+
                                                              |  Digital wallet   |
                                                              |  pass installed   |
                                                              |  on phone!        |
                                                              +-------------------+
```

### Instant QR Enrollment Flow (Vertical B)

```
Step 1: Business Setup              Step 2: Customer Scans           Step 3: Pass Installed
+-------------------+              +--------------------+            +-------------------+
|  Admin gets       |              |  Customer sees     |            |  PassKit creates  |
|  enrollment URL   |  --------->  |  QR at register,   |  -------> |  pass & notifies  |
|  from PassKit     |              |  scans with phone  |            |  backend webhook  |
+-------------------+              +--------------------+            +-------------------+
         |                                  |                                 |
         |                                  |                                 |
         v                                  v                                 v
+-------------------+              +--------------------+            +-------------------+
| Store prints QR   |              |  PassKit form      |            |  Backend syncs    |
| or displays on    |              |  collects name,    |            |  user to Supabase |
| digital signage   |              |  email, birthday   |            |  with pass record |
+-------------------+              +--------------------+            +-------------------+
```

**Key Differences from Vertical A:**
- **No physical mail** - QR codes displayed at business locations
- **PassKit-hosted form** - Data collection happens on PassKit's page
- **Reverse sync** - PassKit creates pass first, backend syncs after
- **Instant enrollment** - No claim code needed, immediate pass installation

**Enrollment URL Format:**
```
https://pub2.pskt.io/c/{shortcode}
```

Store this URL in the program's `enrollment_url` field for easy access.

---

## Tech Stack

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20.x | Runtime environment |
| Express.js | 4.x | HTTP server & routing |
| TypeScript | 5.x | Type safety |
| Drizzle ORM | Latest | Type-safe database queries |
| Zod | Latest | Schema validation |
| Multer | Latest | File upload handling |
| csv-parser | Latest | CSV stream processing |

### Database

| Technology | Purpose |
|------------|---------|
| PostgreSQL (Supabase) | Primary database |
| Supabase RPC | Stored procedures for business logic |
| Drizzle Kit | Migrations & schema management |

### External Services

| Service | Purpose | Region |
|---------|---------|--------|
| PassKit | Digital wallet passes | US (PUB2) |
| PostGrid | Physical mail delivery | US/Canada |
| QR Server | QR code generation | Global CDN |

### Frontend (Admin)

| Technology | Purpose |
|------------|---------|
| React + Vite | Admin dashboard |
| TailwindCSS | Styling |
| shadcn/ui | UI components |
| TanStack Query | Data fetching |
| wouter | Routing |

---

## API Reference

### Base URL

```
Production: https://your-app.replit.app/api
Development: http://localhost:5000/api
```

### Authentication

**Admin Routes (Basic Auth):**
```
Authorization: Basic base64(username:password)
```

**API Routes (API Key):**
```
x-api-key: YOUR_ADMIN_API_KEY
```

---

### Health Endpoints

#### GET /api/health
Full system health check with service diagnostics.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-12-04T14:23:07.211Z",
    "version": "1.0.0",
    "services": {
      "supabase": {
        "status": "connected",
        "latency": 326
      },
      "passKit": {
        "status": "connected",
        "reason": "api_verified"
      },
      "postGrid": {
        "status": "connected"
      }
    }
  }
}
```

**PassKit Status Reasons:**
| Reason | Description |
|--------|-------------|
| `credentials_missing` | API key or secret not configured |
| `credentials_invalid` | Auth failed (401/403) |
| `api_unreachable` | Network cannot reach PassKit |
| `api_server_issue` | PassKit having issues (500/502/503) |
| `api_verified` | Everything working |

---

### Admin Endpoints

#### POST /api/admin/provision
Create a new tenant (business client).

**Headers:**
```
x-api-key: YOUR_API_KEY
```

**Request:**
```json
{
  "businessName": "Pizza Palace",
  "email": "admin@pizzapalace.com",
  "password": "SecurePass123!",
  "passkitProgramId": "pk_pizza_2024",
  "protocol": "MEMBERSHIP"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "programId": "uuid",
    "email": "admin@pizzapalace.com",
    "businessName": "Pizza Palace"
  }
}
```

#### GET /api/admin/tenants
List all tenants.

#### DELETE /api/admin/tenants/:userId
Delete a tenant.

---

### POS Endpoints

#### POST /api/pos/action
Process a POS transaction (earn, redeem, adjust points).

**Request:**
```json
{
  "external_id": "MEMBER_PIN_OR_QR_CODE",
  "action": "MEMBER_EARN",
  "amount": 100
}
```

**Action Types:**

| Action | Description | Amount Required |
|--------|-------------|-----------------|
| `MEMBER_EARN` | Award points | Yes |
| `MEMBER_REDEEM` | Deduct points | Yes |
| `MEMBER_ADJUST` | Adjust balance | Yes |
| `COUPON_ISSUE` | Issue coupon | No |
| `COUPON_REDEEM` | Redeem coupon | No |
| `TICKET_CHECKIN` | Event check-in | No |
| `INSTALL` | Pass installed | No |
| `UNINSTALL` | Pass removed | No |

**Response:**
```json
{
  "success": true,
  "message": "100 points earned! New balance: 500",
  "data": {
    "transaction_id": "txn_abc123",
    "new_balance": 500,
    "previous_balance": 400,
    "protocol": "MEMBERSHIP"
  },
  "passKitSync": {
    "synced": true
  }
}
```

#### GET /api/pos/actions
List available action types.

---

### Program Endpoints

#### GET /api/programs
List all programs.

**Headers:**
```
x-api-key: YOUR_API_KEY
```

#### GET /api/programs/:programId
Get program details (supports UUID or PassKit ID).

#### PATCH /api/programs/:programId
Update program settings.

**Request:**
```json
{
  "birthday_bot_enabled": true,
  "birthday_reward_points": 50,
  "birthday_message": "Happy Birthday! Enjoy 50 bonus points!",
  "is_suspended": false
}
```

---

### Customer Endpoints

#### GET /api/customers?programId=UUID
List customers with pagination.

**Query Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `programId` | Required | Program UUID |
| `page` | 1 | Page number |
| `limit` | 20 | Items per page |
| `status` | all | Filter: active, churned, all |

#### GET /api/customers/stats?programId=UUID
Get dashboard statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 1250,
    "activeRate": 78.4,
    "activeCount": 980,
    "churnedCount": 270
  }
}
```

#### GET /api/customers/:customerId
Get customer details with transaction history.

---

### Notification Endpoints

#### POST /api/notify/broadcast
Send push notification to all active passes.

**Headers:**
```
x-api-key: YOUR_API_KEY
```

**Request:**
```json
{
  "programId": "uuid",
  "message": "Flash Sale! 2x points today only!",
  "segment": "ALL"
}
```

#### POST /api/notify/broadcast/test
Dry-run broadcast (no messages sent).

**Request:**
```json
{
  "programId": "uuid",
  "message": "Test notification"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Dry run completed - no messages were sent",
  "data": {
    "totalRecipients": 1250,
    "messagePreview": "Test notification",
    "sampleRecipients": ["john@example.com", "jane@example.com"]
  }
}
```

#### POST /api/notify/birthday-run
Trigger birthday bot for all programs.

#### GET /api/notify/birthday-bot/test
Dry-run birthday bot with optional test date.

---

### Claim Endpoints (Physical Bridge)

#### GET /claim/:claimCode
Process claim code and redirect to PassKit.

**Flow:**
1. Lookup claim code in database
2. Validate status is `ISSUED`
3. Enroll member in PassKit
4. Update status to `INSTALLED`
5. Redirect to PassKit install URL

#### GET /claim/:claimCode/status
Check claim code status.

**Response:**
```json
{
  "success": true,
  "data": {
    "claimCode": "A1B2C3D4",
    "status": "ISSUED",
    "firstName": "John",
    "createdAt": "2025-12-04T10:00:00Z"
  }
}
```

**Status Values:**
| Status | Description |
|--------|-------------|
| `ISSUED` | Ready to be claimed |
| `INSTALLED` | Pass added to wallet |
| `EXPIRED` | Claim code expired |
| `CANCELLED` | Manually cancelled |

---

### Campaign Endpoints

#### POST /api/campaign/upload-csv
Upload CSV and send mail campaign.

**Headers:**
```
Authorization: Basic base64(username:password)
Content-Type: multipart/form-data
```

**Form Data:**
| Field | Required | Description |
|-------|----------|-------------|
| `file` | Yes | CSV file |
| `program_id` | Yes | Program UUID |
| `resource_type` | Yes | `postcard` or `letter` |
| `template_id` | For letters | PostGrid template ID |
| `front_template_id` | For postcards | Front template ID |
| `back_template_id` | For postcards | Back template ID |
| `size` | For postcards | `6x4`, `9x6`, or `11x6` |

**CSV Format:**
```csv
first_name,last_name,email,address_line_1,city,province,postal_code,country
John,Doe,john@example.com,123 Main St,Toronto,ON,M5V1A1,CA
```

---

### Webhook Endpoints

#### POST /api/webhooks/passkit/uninstall
Handle PassKit pass uninstall events.

**Request (from PassKit):**
```json
{
  "event": "PASS_EVENT_UNINSTALLED",
  "pass": {
    "id": "passkit_member_id",
    "protocol": 100
  }
}
```

#### POST /api/webhooks/passkit/enrollment
Handle PassKit enrollment events (Vertical B - Instant QR Enrollment).

**No authentication required** - PassKit sends this webhook when a new member enrolls.

**Request (from PassKit):**
```json
{
  "event": "PASS_EVENT_RECORD_CREATED",
  "pass": {
    "id": "passkit_internal_id",
    "classId": "passkit_program_id",
    "protocol": 100,
    "personDetails": {
      "forename": "John",
      "surname": "Doe",
      "emailAddress": "john@example.com"
    },
    "meta": {
      "birthday": "1990-05-15"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "acknowledged": true,
    "action": "processed",
    "event": "PASS_EVENT_RECORD_CREATED",
    "passKitId": "passkit_internal_id",
    "userId": "supabase_user_uuid",
    "email": "john@example.com",
    "protocol": "MEMBERSHIP",
    "enrollmentSource": "QR_SCAN"
  }
}
```

**PassKit Webhook Setup:**
1. In PassKit portal, go to Integrations > Webhooks
2. Add webhook URL: `https://your-app.replit.app/api/webhooks/passkit/enrollment`
3. Enable `PASS_EVENT_RECORD_CREATED` event

#### POST /api/webhooks/passkit/event
Generic PassKit event handler.

---

## Database Schema

### Key Tables

| Table | Purpose |
|-------|---------|
| `programs` | Client programs with PassKit/PostGrid config |
| `passes_master` | All digital passes with member info |
| `transactions` | Points earn/redeem history |
| `admin_profiles` | Links Supabase users to programs |
| `claim_codes` | Physical bridge claim codes |
| `campaign_logs` | Notification campaign audit trail |

### Programs Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Business name |
| `passkit_program_id` | TEXT | PassKit program ID |
| `passkit_tier_id` | TEXT | PassKit tier (default: 'base') |
| `postgrid_template_id` | TEXT | PostGrid template for mail |
| `protocol` | TEXT | MEMBERSHIP, EVENT_TICKET, COUPON |
| `is_suspended` | BOOLEAN | Kill switch |
| `birthday_bot_enabled` | BOOLEAN | Auto birthday rewards |
| `birthday_reward_points` | INTEGER | Points to award |
| `birthday_message` | TEXT | Custom message |

### Required Supabase RPC Functions

| Function | Purpose |
|----------|---------|
| `process_membership_transaction` | Handle MEMBER_EARN, REDEEM, ADJUST |
| `process_one_time_use` | Handle COUPON, TICKET actions |
| `generate_claim_code` | Create unique claim codes |
| `lookup_claim_code` | Look up claim details |
| `update_claim_code_status` | Update after wallet install |
| `get_service_status` | Health check (optional) |

### Performance Indexes

Run `migrations/001_performance_indexes.sql` to create:

```sql
CREATE INDEX idx_passes_master_program_id ON passes_master(program_id);
CREATE INDEX idx_passes_master_status ON passes_master(status);
CREATE INDEX idx_passes_master_program_status ON passes_master(program_id, status);
CREATE INDEX idx_transactions_pass_id ON transactions(pass_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
```

---

## Security & Enterprise Features

### Kill Switch (Program Suspension)

Instantly block all transactions for a program:

```bash
# Suspend a program
curl -X PATCH http://localhost:5000/api/programs/{programId} \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"is_suspended": true}'
```

When suspended:
- All POS actions return: `"Program Suspended. Contact Admin."`
- Notifications still work (for "service restored" messages)
- Dashboard still accessible

### Rate Limiting

| Route Pattern | Limit | Purpose |
|--------------|-------|---------|
| `/api/pos/*` | 60/min | Prevent brute-force scanning |
| `/api/notify/*` | 10/min | Prevent notification spam |
| `/api/admin/*` | 30/min | Protect provisioning |
| `/claim/*` | 120/min | Allow legitimate traffic |

### Multi-Tenant Isolation

- All queries filter by `program_id`
- Invalid/non-existent program IDs return empty data (not errors)
- UUID validation prevents SQL injection
- Zero-state handling: New clients get clean `{ total: 0 }` responses

### Input Validation

- All request bodies validated with Zod schemas
- Program IDs validated as UUID format
- Claim codes validated before database lookup
- File uploads restricted to CSV only

---

## WeWeb Integration

This API is designed for integration with WeWeb low-code dashboards.

### Dashboard Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/programs` | GET | List all programs |
| `/api/programs/:programId` | GET | Get program details |
| `/api/programs/:programId` | PATCH | Update birthday bot settings |
| `/api/customers?programId=...` | GET | List customers with pagination |
| `/api/customers/stats?programId=...` | GET | Dashboard stats |
| `/api/customers/:customerId` | GET | Customer detail |
| `/api/notify/logs?programId=...` | GET | Campaign logs |

### WeWeb Integration Steps

1. Add API connector with base URL and API key header
2. Create collections for Programs, Customers, Stats
3. Build dashboard pages with tables and charts
4. Add Birthday Bot toggle connected to PATCH endpoint
5. Add Broadcast form connected to notification endpoints

---

## Production Validation

### Automated Testing Script

Run the comprehensive 7-flow validation:

```bash
npx tsx scripts/prod-validation.ts
```

### What It Tests

| Flow | What's Tested |
|------|---------------|
| **A: Onboarding** | Create new tenant via API |
| **B: Campaign** | CSV upload with form-data |
| **C: Physical Bridge** | Claim code lookup |
| **D: POS Transactions** | Earn/Redeem/Validation |
| **E: Notifications** | Broadcast dry-run |
| **F: Churn Webhook** | PassKit uninstall event |
| **G: Kill Switch** | Program suspension |

### Expected Output

```
============================================================
  FINAL SCORECARD
============================================================

  [PASS] Flow A: Onboarding
  [PASS] Flow B: Campaign
  [PASS] Flow C: Physical Bridge
  [PASS] Flow D: POS Transactions
  [PASS] Flow E: Notifications
  [PASS] Flow F: Churn Webhook
  [PASS] Flow G: Kill Switch

  ALL SYSTEMS GO: 7/7 flows passed

  Your Phygital Loyalty Platform is PRODUCTION READY!

  The platform is:
    - Multi-Tenant (Data isolated per client)
    - Phygital (Seamless paper-to-mobile bridge)
    - Defensive (Rate-limited, Kill-switched, Dry-run protected)
```

---

## Environment Configuration

### Required Secrets

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | `eyJhbGciOi...` |
| `ADMIN_API_KEY` | API key for external calls | `pk_live_passtovip_xxx` |
| `ADMIN_USERNAME` | Admin dashboard username | `admin_passtovip` |
| `ADMIN_PASSWORD` | Admin dashboard password | `SecurePass!2024` |
| `SESSION_SECRET` | Session encryption key | Random 32+ chars |

### Optional Secrets

| Variable | Description | Required For |
|----------|-------------|--------------|
| `PASSKIT_API_KEY` | PassKit credentials | Digital wallet sync |
| `PASSKIT_API_SECRET` | PassKit secret | Digital wallet sync |
| `POSTGRID_API_KEY` | PostGrid API key | Physical mail |
| `APP_URL` | Production URL for QR codes | Mail campaigns |

### PassKit Configuration

| Setting | Value |
|---------|-------|
| Region | US (PUB2) |
| API Base URL | `https://api.pub2.passkit.io` |
| Install URL Format | `https://pub2.pskt.io/{memberId}` |

---

## Deployment

### Replit Deployment

1. **Configure Secrets** in the Secrets tab
2. **Run Migrations** in Supabase Studio
3. **Start Application**:
   ```bash
   npm run dev
   ```
4. **Verify Health**:
   ```bash
   curl https://your-app.replit.app/api/health
   ```

### Production Checklist

- [ ] All required secrets configured
- [ ] Database migrations run (001-004)
- [ ] RPC functions verified in Supabase
- [ ] `APP_URL` set to production domain
- [ ] Admin password changed from default
- [ ] PassKit credentials configured (for wallet features)
- [ ] PostGrid credentials configured (for mail features)
- [ ] Production validation script passes: `npx tsx scripts/prod-validation.ts`

---

## Troubleshooting

### Common Issues

| Error | Solution |
|-------|----------|
| "Supabase is not configured" | Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| "Invalid API key" | Check `x-api-key` header matches `ADMIN_API_KEY` |
| "programId must be UUID" | Use valid UUID format |
| "Program Suspended" | Set `is_suspended = false` via PATCH |
| QR codes point to localhost | Set `APP_URL` to production URL |
| PassKit enrollment fails | Check credentials & tier ID |

### Health Check Diagnostics

```bash
curl http://localhost:5000/api/health | jq
```

**Service Status Interpretation:**

| Service | Status | Meaning |
|---------|--------|---------|
| Supabase | connected | Database operational |
| PassKit | connected (api_verified) | Full wallet functionality |
| PassKit | connected (api_server_issue) | Credentials OK, server issues |
| PostGrid | connected | Mail sending available |

### Viewing Logs

```bash
# Server logs
npm run dev  # Logs to console

# Production validation
npx tsx scripts/prod-validation.ts
```

---

## Project Structure

```
.
├── server/
│   ├── controllers/       # Request handlers
│   │   ├── admin.controller.ts
│   │   ├── campaign.controller.ts
│   │   ├── claim.controller.ts
│   │   ├── customers.controller.ts
│   │   ├── health.controller.ts
│   │   ├── notification.controller.ts
│   │   ├── programs.controller.ts
│   │   └── webhook.controller.ts
│   ├── services/          # Business logic
│   │   ├── logic.service.ts       # POS orchestrator
│   │   ├── passkit.service.ts     # Digital wallet
│   │   ├── postgrid.service.ts    # Physical mail
│   │   ├── supabase.service.ts    # Database ops
│   │   └── notification.service.ts
│   ├── routes/            # Express routes
│   ├── middleware/        # Auth, validation, rate limiting
│   ├── config/            # Configuration
│   └── index.ts           # Server entry
├── client/                # React frontend (admin)
├── migrations/            # SQL migrations
├── scripts/
│   └── prod-validation.ts # Production tests
├── shared/                # Shared types
└── README.md
```

---

## API Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message",
  "metadata": {
    "requestId": "unique-id",
    "timestamp": "2025-12-04T14:00:00.000Z",
    "processingTime": 45
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... }
  },
  "metadata": {
    "requestId": "unique-id",
    "timestamp": "2025-12-04T14:00:00.000Z"
  }
}
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `INVALID_ACTION` | 400 | Unknown POS action |
| `CLAIM_NOT_FOUND` | 404 | Claim code doesn't exist |
| `CLAIM_ALREADY_USED` | 400 | Pass already installed |
| `PROGRAM_NOT_FOUND` | 404 | Invalid program ID |
| `PROGRAM_SUSPENDED` | 403 | Kill switch active |
| `PASSKIT_ERROR` | 502 | PassKit API failure |
| `POSTGRID_ERROR` | 502 | PostGrid API failure |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run validation: `npx tsx scripts/prod-validation.ts`
5. Submit a pull request

---

## License

MIT License - See LICENSE file for details.

---

## Support

- **Documentation**: This README and `replit.md`
- **Issues**: GitHub Issues
- **Contact**: OakMontLogic / PassToVIP team

---

<p align="center">
  <strong>Built with care by OakMontLogic for PassToVIP</strong>
  <br>
  <sub>Bridging the gap between physical mail and digital wallets</sub>
</p>
