<p align="center">
  <img src="https://img.shields.io/badge/Platform-Pass%20To%20VIP-2563eb?style=for-the-badge" alt="Platform"/>
  <img src="https://img.shields.io/badge/Status-Production%20Ready-22c55e?style=for-the-badge" alt="Status"/>
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
</p>

<h1 align="center">Pass To VIP - Phygital Loyalty Ecosystem</h1>

<p align="center">
  <strong>Enterprise-grade multi-tenant SaaS platform bridging physical mail and digital wallets</strong>
</p>

<p align="center">
  Operated by <strong>Oakmont Logic LLC</strong>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> |
  <a href="#-features">Features</a> |
  <a href="#-client-dashboard">Client Dashboard</a> |
  <a href="#-architecture">Architecture</a> |
  <a href="#-api-reference">API Reference</a> |
  <a href="#-deployment">Deployment</a>
</p>

---

## What is Phygital?

**Phygital** = **Physical** + **Digital**

This platform transforms physical mail recipients into digital wallet users through QR-based redemption flows. Built for **Pass To VIP** (passtovip.com / scantovip.com) by **Oakmont Logic LLC**, it serves retail, hospitality, and event management industries.

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
- [Client Dashboard](#-client-dashboard)
- [POS Simulator](#-pos-simulator)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [API Reference](#-api-reference)
- [Role-Based Access Control](#-role-based-access-control)
- [Database Schema](#-database-schema)
- [Security & Enterprise Features](#-security--enterprise-features)
- [Environment Configuration](#-environment-configuration)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Support](#-support)
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
SUPABASE_ANON_KEY=your_anon_key
ADMIN_API_KEY=pk_live_your_api_key
SESSION_SECRET=your_random_secret

# Client Dashboard
VITE_MOCK_MODE=false

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
migrations/010_dashboard_slug.sql
migrations/011_pos_integration.sql
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
| **Client Dashboard** | React-based portal for program managers with analytics, members, and POS |
| **Digital Wallet Integration** | Apple Wallet & Google Pay passes via PassKit |
| **Physical Mail Campaigns** | Automated postcards & letters via PostGrid |
| **Physical Bridge** | QR code redemption converting mail to digital wallet users |
| **POS Integration** | Real-time points earn/redeem with dual scanning support |
| **Push Notifications** | Real-time wallet updates with buzz notifications |
| **Birthday Bot** | Automated birthday reward distribution |

### Three Enrollment Verticals

| Vertical | Name | Description |
|----------|------|-------------|
| **A** | Push (Direct Mail) | Postcards with claim codes mailed to customers |
| **B** | Pull (Reception QR) | QR codes at business locations for walk-in enrollment |
| **C** | EDDM | High-volume neighborhood blanket campaigns |

### Enterprise Security

| Feature | Description |
|---------|-------------|
| **Role-Based Access** | SUPER_ADMIN, PLATFORM_ADMIN, CLIENT_ADMIN roles |
| **Kill Switch** | Instantly suspend non-paying clients |
| **Rate Limiting** | 60 req/min for POS, 10 req/min for notifications |
| **API Key Authentication** | Secure API access with rotatable keys |
| **JWT Authentication** | Secure client dashboard sessions |
| **Input Validation** | Zod schema validation on all endpoints |

---

## Client Dashboard

The React-based client dashboard provides program managers with a complete view of their loyalty program.

### Dashboard Pages

| Page | Path | Description |
|------|------|-------------|
| **Login** | `/login` | JWT authentication with Supabase |
| **Dashboard** | `/dashboard` | Program overview and quick stats |
| **Analytics** | `/analytics` | Enrollment charts, retention rates, source breakdown |
| **Members** | `/members` | Searchable member list with pagination |
| **POS Simulator** | `/pos` | Point-of-sale transaction testing |
| **Admin Clients** | `/admin/clients` | Platform admin client management |

### Design System

The dashboard uses a **USA Patriotic Color Scheme**:

| Color | HSL Value | Hex | Usage |
|-------|-----------|-----|-------|
| Primary Blue | `hsl(215, 74%, 45%)` | `#2563eb` | Active states, positive actions, buttons |
| Secondary Red | `hsl(356, 72%, 48%)` | `#dc2626` | Warnings, churned status, redeem actions |
| White | - | `#ffffff` | Backgrounds, cards |

### Branding

- **Header**: "Pass To VIP" with program name
- **Footer**: "Operated by Oakmont Logic LLC"
- **Support**: support@passtovip.com

---

## POS Simulator

The POS Simulator supports **dual scanning modes** for maximum flexibility:

### Scanning Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Keyboard Wedge** | USB/Bluetooth barcode scanners that type + Enter | Retail counters, fixed POS stations |
| **Camera Scan** | Mobile camera QR scanning via html5-qrcode | Mobile staff, pop-up locations |

### Smart Code Parser

The system automatically parses various scan formats:

```
URL: https://example.com/member?code=PUB-ABC123 → PUB-ABC123
Path: https://example.com/claim/CLM-XYZ789 → CLM-XYZ789
Raw: pub-abc123 → PUB-ABC123
Direct: MBR-12345 → MBR-12345
```

### Supported Prefixes

| Prefix | Source | Description |
|--------|--------|-------------|
| `PUB-` | Public Enrollment | Walk-in QR scan enrollments |
| `CLM-` | Claim Code | Direct mail redemptions |
| `MBR-` | Member ID | Direct member lookup |

### POS Actions

| Action | Description | Points Required |
|--------|-------------|-----------------|
| **Lookup** | Find member by ID | No |
| **Earn** | Award points | Yes |
| **Redeem** | Deduct points | Yes |

---

## Architecture

### High-Level System Design

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                      |
|   +-------------+    +-------------+    +-------------+    +----------------+     |
|   |   Client    |    |    POS      |    |   Mobile    |    |   Mail Scan    |     |
|   |  Dashboard  |    |   System    |    |   Wallet    |    |    (QR Code)   |     |
|   +------+------+    +------+------+    +------+------+    +-------+--------+     |
+----------|------------------|------------------|------------------|--------------+
           |                  |                  |                  |
           v                  v                  v                  v
+-----------------------------------------------------------------------------------+
|                              API GATEWAY (Express.js :5000)                        |
|   +------------------------------------------------------------------------+      |
|   |  Middleware: CORS | Rate Limiting | JWT Auth | Request ID | Validation  |      |
|   +------------------------------------------------------------------------+      |
+-----------------------------------------------------------------------------------+
           |
           v
+-----------------------------------------------------------------------------------+
|                                 ROUTES LAYER                                       |
|   +---------+ +--------+ +-------+ +-------+ +----------+ +--------+ +--------+   |
|   | Client  | |  POS   | | Claim | |Loyalty| |Notify    | |Programs| |Webhooks|   |
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

### Physical Bridge Flow (Vertical A)

```
Step 1: Campaign Upload          Step 2: Mail Sent            Step 3: User Scans QR
+-------------------+           +------------------+          +-------------------+
|  Admin uploads    |           |   Postcard or    |          |  Phone camera     |
|  CSV with names,  |  ------>  |   Letter with    |  ------> |  opens:           |
|  addresses        |           |   QR code        |          |  /claim/A1B2C3D4  |
+-------------------+           +------------------+          +-------------------+
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
         v                                  v                                 v
+-------------------+              +--------------------+            +-------------------+
| Store prints QR   |              |  PassKit form      |            |  Backend syncs    |
| or displays on    |              |  collects name,    |            |  user to Supabase |
| digital signage   |              |  email, birthday   |            |  with pass record |
+-------------------+              +--------------------+            +-------------------+
```

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
| jsonwebtoken | Latest | JWT authentication |
| html5-qrcode | Latest | Camera-based QR scanning |

### Database

| Technology | Purpose |
|------------|---------|
| PostgreSQL (Supabase) | Primary database |
| Supabase Auth | User authentication |
| Supabase RPC | Stored procedures for business logic |

### External Services

| Service | Purpose | Region |
|---------|---------|--------|
| PassKit | Digital wallet passes | US (PUB2) |
| PostGrid | Physical mail delivery | US/Canada |
| QR Server | QR code generation | Global CDN |

### Frontend

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| Vite | Build tool |
| TailwindCSS | Styling |
| shadcn/ui | UI components |
| TanStack Query | Data fetching |
| wouter | Routing |
| Recharts | Analytics charts |

---

## API Reference

### Base URL

```
Production: https://your-app.replit.app/api
Development: http://localhost:5000/api
```

### Authentication Methods

**Client Dashboard (JWT):**
```
Authorization: Bearer <jwt_token>
```

**External API (API Key):**
```
x-api-key: pk_live_YOUR_API_KEY
```

**POS Webhooks (API Key):**
```
x-api-key: pk_live_YOUR_API_KEY
Idempotency-Key: unique-request-id
```

---

### Client API Endpoints

#### POST /api/client/login
Authenticate client and receive JWT token.

**Request:**
```json
{
  "email": "admin@business.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "admin@business.com",
      "role": "CLIENT_ADMIN"
    },
    "program": {
      "id": "uuid",
      "name": "Pizza Palace",
      "protocol": "MEMBERSHIP"
    }
  }
}
```

#### GET /api/client/me
Get current user profile and program context.

#### GET /api/client/analytics
Get program analytics with enrollment breakdown.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 1250,
    "active": 980,
    "churned": 270,
    "enrollmentBySource": [
      { "source": "SMARTPASS", "count": 450 },
      { "source": "CLAIM_CODE", "count": 800 }
    ]
  }
}
```

#### GET /api/client/members
Get paginated member list with search.

**Query Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 20 | Items per page |
| `search` | - | Search by name, email, or ID |

---

### POS Endpoints

#### POST /api/pos/lookup
Look up a member by external ID.

**Request:**
```json
{
  "externalId": "PUB-ABC123"
}
```

#### POST /api/pos/earn
Award points to a member.

**Request:**
```json
{
  "externalId": "PUB-ABC123",
  "points": 100
}
```

#### POST /api/pos/redeem
Deduct points from a member.

**Request:**
```json
{
  "externalId": "PUB-ABC123",
  "points": 50
}
```

---

### POS Webhook Endpoints

External POS systems can integrate via authenticated webhook endpoints:

#### POST /api/webhooks/pos/lookup
#### POST /api/webhooks/pos/earn
#### POST /api/webhooks/pos/redeem

**Authentication:** `x-api-key` header with `pk_live_*` format  
**Idempotency:** `Idempotency-Key` header prevents duplicate processing  
**Rate Limiting:** 60 requests/min per API key

See `docs/POS_INTEGRATION.md` for full integration guide.

---

### Public Enrollment Endpoint

#### GET /api/enroll/:slug
Public enrollment page lookup by dashboard slug.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Pizza Palace",
    "protocol": "MEMBERSHIP",
    "enrollment_url": "https://pub2.pskt.io/c/abc123",
    "is_suspended": false
  }
}
```

**Security:** Uses `SUPABASE_ANON_KEY` only (no service role key exposure).

---

## Role-Based Access Control

### Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `SUPER_ADMIN` | Platform owner | Full system access |
| `PLATFORM_ADMIN` | Platform operator | Client provisioning, system settings |
| `CLIENT_ADMIN` | Business client | Own program dashboard, analytics, POS |

### Role Permissions

| Endpoint | SUPER_ADMIN | PLATFORM_ADMIN | CLIENT_ADMIN |
|----------|-------------|----------------|--------------|
| `/api/client/admin/tenants` | ✅ | ✅ | ❌ |
| `/api/client/admin/provision` | ✅ | ✅ | ❌ |
| `/api/client/analytics` | ✅ | ✅ | ✅ (own program) |
| `/api/client/members` | ✅ | ✅ | ✅ (own program) |
| `/api/pos/*` | ✅ | ✅ | ✅ (own program) |

---

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `programs` | Client loyalty programs with settings |
| `passes_master` | Member records with pass status |
| `transactions` | Point earn/redeem history |
| `claim_codes` | Physical mail redemption codes |
| `admin_profiles` | User-program associations with roles |
| `campaign_logs` | Notification audit trail |

### Key Columns (programs)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | VARCHAR | Business name |
| `passkit_program_id` | VARCHAR | PassKit program ID |
| `protocol` | ENUM | MEMBERSHIP, EVENT_TICKET, COUPON |
| `is_suspended` | BOOLEAN | Kill switch status |
| `dashboard_slug` | VARCHAR | Unique URL slug for enrollment |
| `enrollment_url` | VARCHAR | PassKit enrollment URL |

### Required RPC Functions

| Function | Purpose |
|----------|---------|
| `process_membership_transaction` | Points earn/redeem |
| `process_one_time_use` | Coupon/ticket redemption |
| `get_service_status` | Health check |

---

## Security & Enterprise Features

### Kill Switch (Program Suspension)

Instantly block all transactions for a program:

```bash
curl -X PATCH http://localhost:5000/api/programs/{programId}/suspend \
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
| `/api/webhooks/pos/*` | 60/min | External POS integration |
| `/api/notify/*` | 10/min | Prevent notification spam |
| `/api/client/admin/*` | 30/min | Protect provisioning |

### Multi-Tenant Isolation

- All queries filter by `program_id`
- JWT tokens encode program context
- UUID validation prevents SQL injection
- Role-based endpoint protection

### Input Validation

- All request bodies validated with Zod schemas
- Program IDs validated as UUID format
- Claim codes validated before database lookup
- File uploads restricted to CSV only

---

## Environment Configuration

### Required Secrets

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | `eyJhbGciOi...` |
| `SUPABASE_ANON_KEY` | Anonymous key (for public endpoints) | `eyJhbGciOi...` |
| `ADMIN_API_KEY` | API key for external calls | `pk_live_passtovip_xxx` |
| `SESSION_SECRET` | Session encryption key | Random 32+ chars |

### Client Dashboard

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_MOCK_MODE` | Enable mock data for development | `true` or `false` |

### Optional Secrets

| Variable | Description | Required For |
|----------|-------------|--------------|
| `PASSKIT_API_KEY` | PassKit credentials | Digital wallet sync |
| `PASSKIT_API_SECRET` | PassKit secret | Digital wallet sync |
| `POSTGRID_API_KEY` | PostGrid API key | Physical mail |
| `APP_URL` | Production URL for QR codes | Mail campaigns |

---

## Deployment

### Replit Deployment

1. **Configure Secrets** in the Secrets tab
2. **Run Migrations** in Supabase Studio (001-004, 010-011)
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
- [ ] Database migrations run (001-004, 010-011)
- [ ] RPC functions verified in Supabase
- [ ] `APP_URL` set to production domain
- [ ] `VITE_MOCK_MODE` set to `false`
- [ ] PassKit credentials configured (for wallet features)
- [ ] PostGrid credentials configured (for mail features)
- [ ] Production validation script passes

---

## Troubleshooting

### Common Issues

| Error | Solution |
|-------|----------|
| "Supabase is not configured" | Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| "Invalid API key" | Check `x-api-key` header matches `ADMIN_API_KEY` |
| "Unauthorized" | Check JWT token is valid and not expired |
| "Program Suspended" | Set `is_suspended = false` via PATCH |
| Camera not working | Ensure HTTPS (required for camera access) |
| QR codes point to localhost | Set `APP_URL` to production URL |

### Health Check

```bash
curl http://localhost:5000/api/health | jq
```

**Service Status Interpretation:**

| Service | Status | Meaning |
|---------|--------|---------|
| Supabase | connected | Database operational |
| PassKit | connected (api_verified) | Full wallet functionality |
| PostGrid | connected | Mail sending available |

---

## Project Structure

```
.
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/        # UI components
│   │   │   ├── ui/           # shadcn/ui components
│   │   │   └── app-sidebar.tsx
│   │   ├── pages/            # Route pages
│   │   │   ├── login.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── analytics.tsx
│   │   │   ├── members.tsx
│   │   │   └── pos.tsx
│   │   ├── lib/              # Utilities
│   │   │   ├── auth.tsx      # Auth context
│   │   │   ├── api.ts        # API client
│   │   │   └── queryClient.ts
│   │   └── index.css         # Tailwind + theme
│   └── index.html
├── server/
│   ├── controllers/          # Request handlers
│   ├── services/             # Business logic
│   ├── routes/               # Express routes
│   │   ├── client.routes.ts  # Dashboard API
│   │   ├── pos.routes.ts     # POS API
│   │   └── webhook.routes.ts # External webhooks
│   ├── middleware/           # Auth, validation
│   └── index.ts              # Server entry
├── migrations/               # SQL migrations
├── docs/
│   └── POS_INTEGRATION.md   # POS webhook guide
├── design_guidelines.md     # UI/UX guidelines
└── README.md
```

---

## Support

- **Email**: support@passtovip.com
- **Documentation**: This README and `replit.md`
- **POS Integration**: See `docs/POS_INTEGRATION.md`

---

## License

MIT License - See LICENSE file for details.

---

<p align="center">
  <strong>Pass To VIP - Bridging Physical Mail and Digital Wallets</strong>
  <br>
  <sub>Operated by Oakmont Logic LLC</sub>
</p>
