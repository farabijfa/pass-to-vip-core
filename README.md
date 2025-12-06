<p align="center">
  <img src="https://img.shields.io/badge/Platform-Pass%20To%20VIP-2563eb?style=for-the-badge" alt="Platform"/>
  <img src="https://img.shields.io/badge/Version-2.6.0-blue?style=for-the-badge" alt="Version"/>
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

## What's New in v2.6.0

### Dynamic Tier Discount System

Configure **per-tier discount percentages** directly from the Client Command Center. This enables businesses to offer progressive discounts as customers advance through loyalty tiers.

| Tier | Default Discount | Use Case |
|------|-----------------|----------|
| **Tier 1 (Bronze)** | 0% | Entry level - no discount |
| **Tier 2 (Silver)** | 5% | First loyalty reward |
| **Tier 3 (Gold)** | 10% | Regular customer benefit |
| **Tier 4 (Platinum)** | 15% | VIP maximum discount |

**Key Features:**
- Configurable 0-100% discount per tier level
- Progressive discount validation (higher tiers must have equal or higher discounts)
- Real-time discount display in External POS responses
- Client Command Center UI with intuitive input fields

**Database Schema (Migration 021):**
```sql
ALTER TABLE programs ADD COLUMN tier_1_discount_percent INTEGER DEFAULT 0;
ALTER TABLE programs ADD COLUMN tier_2_discount_percent INTEGER DEFAULT 5;
ALTER TABLE programs ADD COLUMN tier_3_discount_percent INTEGER DEFAULT 10;
ALTER TABLE programs ADD COLUMN tier_4_discount_percent INTEGER DEFAULT 15;
```

**Discount Calculation Logic:**
```typescript
// POS Webhook Service calculates discount based on tier
getDiscountForTier(tierLevel: TierLevel, config: SpendTierConfig): number {
  switch (tierLevel) {
    case 'TIER_4': return config.tier4DiscountPercent;  // e.g., 15%
    case 'TIER_3': return config.tier3DiscountPercent;  // e.g., 10%
    case 'TIER_2': return config.tier2DiscountPercent;  // e.g., 5%
    case 'TIER_1': 
    default: return config.tier1DiscountPercent;        // e.g., 0%
  }
}
```

---

### External POS Webhook System

Production-ready API for external point-of-sale systems to trigger **spend-based tier upgrades**. This enables retail chains like Levi's to integrate their existing POS with Pass To VIP for automatic tier calculation.

**Transaction Flow:**
```
External POS                    Pass To VIP                      PassKit
    |                               |                               |
    |  POST /api/external/pos/tx    |                               |
    |  { externalMemberId, amount } |                               |
    |------------------------------>|                               |
    |                               | 1. Upsert member              |
    |                               | 2. Record spend in ledger     |
    |                               | 3. Update cumulative total    |
    |                               | 4. Calculate new tier         |
    |                               | 5. Get tier discount %        |
    |                               | 6. Sync PassKit pass          |
    |                               |------------------------------>|
    |                               |                               |
    |  { tierLevel, discountPercent,|                               |
    |    tierUpgraded, passUrl }    |                               |
    |<------------------------------|                               |
```

**Spend-Based Tier Thresholds (Configurable):**
```
Tier 1 (Bronze):   $0 - $299.99     (0 - 29,999 cents)
Tier 2 (Silver):   $300 - $999.99   (30,000 - 99,999 cents)
Tier 3 (Gold):     $1,000 - $2,499.99 (100,000 - 249,999 cents)
Tier 4 (Platinum): $2,500+          (250,000+ cents)
```

**Tier Calculation Logic:**
```typescript
// server/services/pos-webhook.service.ts
calculateSpendTier(spendTotalCents: number, config: SpendTierConfig): TierLevel {
  if (spendTotalCents >= config.tier4ThresholdCents) return 'TIER_4';  // $2,500+
  if (spendTotalCents >= config.tier3ThresholdCents) return 'TIER_3';  // $1,000+
  if (spendTotalCents >= config.tier2ThresholdCents) return 'TIER_2';  // $300+
  return 'TIER_1';  // Default
}
```

**External POS API Endpoints:**
```
POST   /api/external/pos/:programId/transaction    # Process spend transaction
GET    /api/external/pos/:programId/member/:extId  # Lookup member by external ID
POST   /api/external/pos/:programId/api-key        # Generate API key (admin)
DELETE /api/external/pos/:programId/api-key/:keyId # Revoke API key (admin)
```

**Transaction Request Schema:**
```typescript
interface POSWebhookTransaction {
  externalMemberId: string;      // Required: External system's customer ID
  amountCents: number;           // Required: Transaction amount in cents
  transactionId?: string;        // Optional: External transaction ID
  storeId?: string;              // Optional: Store location identifier
  currency?: string;             // Optional: Currency code (default: USD)
  customerEmail?: string;        // Optional: For new member creation
  customerFirstName?: string;    // Optional: Customer first name
  customerLastName?: string;     // Optional: Customer last name
  customerPhone?: string;        // Optional: Customer phone
  metadata?: Record<string, any>;// Optional: Additional data
}
```

**Transaction Response Schema:**
```typescript
interface POSWebhookResponse {
  success: boolean;
  memberId?: string;             // Internal Pass To VIP member ID
  externalMemberId?: string;     // Echo of external ID
  tierLevel?: TierLevel;         // TIER_1, TIER_2, TIER_3, TIER_4
  tierName?: string;             // Human-readable: "Gold", "Platinum", etc.
  discountPercent?: number;      // Applicable discount (0-100)
  spendTotalCents?: number;      // Cumulative lifetime spend
  passUrl?: string;              // Digital wallet pass URL
  isNewMember?: boolean;         // True if member was just created
  tierUpgraded?: boolean;        // True if tier changed this transaction
  previousTier?: string;         // Previous tier name (if upgraded)
  transactionId?: string;        // Transaction record ID
  error?: { code: string; message: string };
}
```

**Idempotency Support:**
```bash
# Prevents duplicate processing with X-Idempotency-Key header
curl -X POST /api/external/pos/prog-123/transaction \
  -H "X-API-Key: pk_live_abc123" \
  -H "X-Idempotency-Key: tx-20241206-001" \
  -d '{"externalMemberId": "cust-456", "amountCents": 5000}'
```

---

### Enhanced Notification System

Push notification system with **triple validation**, dynamic tier segments, and automated rewards:

**Segment Types:**
| Segment | Description | Use Case |
|---------|-------------|----------|
| `ALL` | All active members | Announcements, promotions |
| `TIER_1` - `TIER_4` | Members at specific tier | Tier-specific offers |
| `GEO` | Geographic region (future) | Location-based marketing |
| `CSV` | Custom member list upload | Targeted campaigns |
| `BIRTHDAY` | Members with birthday today | Automated birthday rewards |

**Triple Validation:**
1. **Tier Validation**: Ensures segment matches actual member tier levels
2. **PassKit Validation**: Confirms members have active wallet passes
3. **Protocol Validation**: Filters by program protocol (MEMBERSHIP only for push)

**Segment Preview:**
```typescript
// Preview segment before sending
GET /api/notifications/:programId/preview?segment=TIER_3

Response:
{
  "segmentType": "TIER_3",
  "memberCount": 156,
  "sampleMembers": [
    { "id": "...", "name": "John D.", "tierLevel": "TIER_3" },
    ...
  ]
}
```

**Birthday Bot Integration:**
- Automated daily scan for member birthdays
- Configurable birthday reward messages
- PassKit push notification with personalized content

---

### Client Command Center Enhancements

The admin interface for managing tenant configurations has been significantly enhanced:

**Tier Configuration Panel:**
```
+-----------------------------------------------------------+
| Tier Thresholds                              [Expand/Collapse] |
+-----------------------------------------------------------+
| Tier System: [LOYALTY ▼]                                    |
|                                                             |
| Tier Names:                                                 |
| Bronze [________] Silver [________] Gold [________] Platinum [________] |
|                                                             |
| Point Thresholds:                                           |
| Bronze Max [_1000_] Silver Max [_5000_] Gold Max [_10000_] |
|                                                             |
| PassKit Tier IDs:                                           |
| Bronze ID [________] Silver ID [________] Gold ID [________] Platinum ID [________] |
|                                                             |
| Tier Discounts (%):                           [NEW in 2.6] |
| Tier 1 [_0_%] Tier 2 [_5_%] Tier 3 [_10_%] Tier 4 [_15_%] |
+-----------------------------------------------------------+
```

**Validation Rules:**
- Discount percentages must be 0-100
- Higher tiers should have equal or higher discounts (warning, not blocking)
- Empty fields default to 0% discount

---

### Mock Mode for Development

Enable `VITE_MOCK_MODE=true` for rapid testing without Supabase authentication:

**Features:**
- Bypass JWT authentication
- "Demo Login" button for quick access
- Pre-populated sample data for UI testing
- "Test Mode" badge indicator in UI

**Environment Configuration:**
```bash
# Development testing (bypass auth)
VITE_MOCK_MODE=true

# Production (require real auth)
VITE_MOCK_MODE=false
```

---

## What's New in v2.5.0

### Multi-Program Architecture
One tenant can now manage **multiple programs** (verticals) simultaneously:

| Protocol | Use Case | Example |
|----------|----------|---------|
| **MEMBERSHIP** | Loyalty rewards programs | "Joe's Pizza VIP Club" |
| **EVENT_TICKET** | Event-based passes | "Summer Music Festival 2025" |
| **COUPON** | Promotional offers | "Flash Sale 50% Off" |

**Key Features:**
- Each program has independent PassKit credentials and enrollment URLs
- Primary program designation for default routing
- Protocol-specific visual badges in admin UI
- Add/remove programs without affecting existing members

**New Admin API Endpoints:**
```
GET    /api/client/admin/tenants/:userId/programs          # List all programs
POST   /api/client/admin/tenants/:userId/programs          # Add new program
DELETE /api/client/admin/tenants/:userId/programs/:id      # Remove program
PATCH  /api/client/admin/tenants/:userId/programs/:id/primary  # Set primary
```

---

## Table of Contents

- [Quick Start](#-quick-start)
- [Features](#-features)
- [Client Dashboard](#-client-dashboard)
- [Client Command Center](#client-command-center)
- [POS Simulator](#-pos-simulator)
- [External POS Integration](#external-pos-integration)
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
- [Changelog](#changelog)
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
migrations/001_performance_indexes.sql      # Performance optimization
migrations/002_program_suspension.sql       # Kill switch feature
migrations/003_passkit_tier_id.sql         # Tier-based programs
migrations/004_rpc_functions_verification.sql  # Core RPC functions
migrations/010_dashboard_slug.sql          # Unique enrollment URLs
migrations/011_pos_integration.sql         # POS API keys & transactions
migrations/012_secure_public_access.sql    # CRITICAL: RLS for anon key
migrations/013_passkit_status_tracking.sql # Soft-fail provisioning support
migrations/014_nullable_passkit_fields.sql # CRITICAL: Non-destructive onboarding
migrations/015_earn_rate_multiplier.sql    # Integer-based point system
migrations/017_hardening_claims_and_transactions.sql  # SECURITY: Gap E & F fixes
migrations/018_billing_and_quotas.sql      # Gap G: Revenue leakage prevention
migrations/019_campaign_tracking.sql       # Campaign runs & contacts tracking
migrations/020_multi_program_support.sql   # Multi-program architecture
migrations/021_tier_discount_columns.sql   # NEW: Tier discount percentages
migrations/025_external_pos_spend_tracking.sql  # External POS & spend ledger
```

**Important:** 
- Migrations 012 and 014 are critical for production security and resilient client provisioning.
- Migrations 017-018 add security hardening for atomic transactions and billing quotas.
- Migration 019 is idempotent and can be safely re-run.
- **Migration 020** enables one tenant to manage multiple programs (verticals) simultaneously.
- **Migration 021** adds tier discount percentage columns (tier_1_discount_percent through tier_4_discount_percent).
- **Migration 025** adds external_id, spend tracking columns, and spend_ledger table for External POS integration.

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

### 6. Run Security Validation (Recommended)

After migrations, run Protocol D security test in **Supabase SQL Editor**:

```sql
SET ROLE anon;
SELECT * FROM programs;  -- Should return error 42501 (permission denied)
```

If this returns data instead of an error, your RLS policies are not working. Apply migration 012 immediately.

See `docs/SECURITY_VALIDATION.md` for the complete security test suite.

---

## Production Validation Protocols

This system has been hardened with **seven validation protocols** designed to break the system under stress:

| Protocol | Name | Test Objective | Success Criteria |
|----------|------|----------------|------------------|
| **A** | Provisioning Resilience | Client creation with broken PassKit API | Client created, `passkit_status: manual_required` |
| **B** | Churn Loop | Webhook updates member status | `pass.uninstalled` → status changes to `CHURNED` |
| **C** | Clerk Proof POS | Redeem action blocked until confirmed | Modal appears, Enter key confirms, no premature API call |
| **D** | Security Tunnel | Anon key data access | Direct SELECT fails, RPC returns only public data |
| **E** | Double-Claim Prevention | Same claim code processed twice | Atomic RPC with FOR UPDATE locks prevents duplicate |
| **F** | Race Condition Prevention | Concurrent point updates | Atomic transaction processing prevents data corruption |
| **G** | Revenue Leakage Prevention | Member quota enforcement | Billing audit monitors and alerts on quota overages |

### Protocol Details

**A: Soft-Fail Provisioning**
- Temporarily break `PASSKIT_API_KEY` → provision a client → verify client created
- Expected: `passkit_status: "manual_required"`, `passkit_program_id: null`

**B: Webhook Churn Detection**
- Send `pass.uninstalled` event to `/api/callbacks/passkit`
- Expected: Member's `status` changes to `UNINSTALLED` in `passes_master`

**C: POS Clerk Protection**
- Scan code in "Redeem" tab → modal should appear (no API call yet)
- Press Enter → transaction completes

**D: RLS Security**
- Use anon key to attempt `SELECT * FROM programs` → must fail with 42501
- Use RPC `get_public_program_info('slug')` → must return only name and URL

**E: Double-Claim Prevention**
- Attempt to claim same code twice simultaneously
- Expected: First claim succeeds, second returns "Already claimed" error
- Implementation: Atomic RPC `process_claim_attempt` with FOR UPDATE locks

**F: Race Condition Prevention**
- Attempt concurrent point earn/redeem on same member
- Expected: Both transactions processed correctly without data corruption
- Implementation: Atomic RPC `process_membership_transaction_atomic`

**G: Revenue Leakage Prevention**
- Programs with member quotas are monitored nightly
- Expected: Alert generated when program exceeds member limit
- Implementation: `server/scripts/billing-cron.ts` with usage snapshots

---

## Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Multi-Tenant Architecture** | Secure data isolation per client with program-level access control |
| **Multi-Program Support** | One tenant can manage multiple verticals (MEMBERSHIP, EVENT_TICKET, COUPON) simultaneously |
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
| **Row Level Security** | PostgreSQL RLS prevents data leakage (Protocol D verified) |
| **HMAC Webhooks** | PassKit callbacks verified with signature |

### Production-Grade Architecture

| Feature | Description |
|---------|-------------|
| **Soft-Fail Provisioning** | Client creation succeeds even if PassKit API fails |
| **Protocol Routing** | MEMBERSHIP auto-provisions, EVENT_TICKET/COUPON skip PassKit |
| **Webhook Status Sync** | Real-time wallet install/uninstall tracking |
| **Idempotent Transactions** | Duplicate API calls return same result |
| **Clerk Protection** | POS redeem requires confirmation modal |
| **Atomic Transactions** | FOR UPDATE locks prevent double-claims and race conditions |
| **Integer Point System** | "Casino Chip" model avoids floating-point precision issues |
| **Billing Quotas** | Member limits enforced with nightly audit monitoring |

### Campaign Launcher (Admin-Only)

Full-featured direct mail campaign system for SUPER_ADMIN and PLATFORM_ADMIN roles:

| Feature | Description |
|---------|-------------|
| **Client Selection** | Dropdown from list OR manual client ID with backend validation |
| **Resource Types** | Postcards (6 sizes) or Letters (3 sizes) |
| **Mailing Classes** | Standard (3-14 days) or First Class (2-5 days) |
| **Template Management** | Fetch templates from PostGrid catalog |
| **CSV Upload** | Drag-and-drop with contact parsing and validation |
| **Cost Estimation** | Real-time per-piece and total cost calculation |
| **Campaign History** | Track status (pending, processing, completed, failed) |

### Integer-Based Point System

The "Casino Chip" model uses integer points with configurable multipliers:

```
Formula: points = floor(transactionAmount × earn_rate_multiplier)
Default: $1.00 = 10 points (multiplier = 10)
```

| Transaction | Amount | Multiplier | Points |
|-------------|--------|------------|--------|
| Coffee purchase | $4.50 | 10 | 45 points |
| Full meal | $25.00 | 10 | 250 points |
| Gas fillup | $60.00 | 5 | 300 points |

Benefits: Avoids floating-point precision issues, whole numbers feel like rewards.

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
| **Assets** | `/assets` | Program QR codes, PNG/SVG downloads, social sharing links |
| **POS Simulator** | `/pos` | Point-of-sale transaction testing |
| **Campaign Launcher** | `/admin/campaigns` | Admin-only direct mail campaign management |
| **Admin Clients** | `/admin/clients` | Platform admin client management with multi-program support |
| **Client Command Center** | `/admin/clients/:userId` | Individual client configuration and tier management |

---

## Client Command Center

The Client Command Center (`/admin/clients/:userId`) provides comprehensive tenant management for SUPER_ADMIN and PLATFORM_ADMIN users.

### Sections

| Section | Description |
|---------|-------------|
| **Client Identity** | Business name, email, creation date |
| **Program Cards** | Multi-program overview with protocol badges |
| **Tier Configuration** | Thresholds, names, PassKit IDs, and discount percentages |
| **Billing & Usage** | Active members, usage percentage, limits |
| **API Keys** | POS webhook keys with create/revoke controls |
| **PassKit Sync** | Retry button for manual_required status |

### Tier Discount Configuration

The tier discount feature allows admins to set percentage discounts for each tier level:

```typescript
// Validation Rules
1. Each discount must be 0-100%
2. Higher tiers should have equal or higher discounts (warning only)
3. Empty fields default to 0%

// Database Columns
tier_1_discount_percent: INTEGER DEFAULT 0   // Bronze discount
tier_2_discount_percent: INTEGER DEFAULT 5   // Silver discount  
tier_3_discount_percent: INTEGER DEFAULT 10  // Gold discount
tier_4_discount_percent: INTEGER DEFAULT 15  // Platinum discount
```

### Program Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| **Tier System Type** | LOYALTY, OFFICE, GYM, CUSTOM, NONE | LOYALTY |
| **Tier Names** | Custom names for each tier | Bronze, Silver, Gold, Platinum |
| **Point Thresholds** | Points required for tier upgrades | 1000, 5000, 10000 |
| **Spend Thresholds** | Spend in cents for tier upgrades | 30000, 100000, 250000 |
| **PassKit Tier IDs** | Unique PassKit template IDs per tier | pk_tier_bronze_001 |
| **Discount Percentages** | Discount % for each tier (0-100) | 0%, 5%, 10%, 15% |

### API Endpoint

```
GET  /api/client/admin/tenants/:userId/profile  # Get full tenant profile
POST /api/client/admin/tenants/:userId/update   # Update tenant configuration
```

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

## External POS Integration

The External POS Webhook System enables third-party point-of-sale systems to integrate with Pass To VIP for **spend-based tier management**.

### Overview

```
+------------------+     HTTP/REST      +------------------+     PassKit      +------------------+
|  External POS    |  --------------->  |  Pass To VIP     |  ------------>  |   Digital        |
|  (Levi's, etc.)  |                    |  Webhook API     |                  |   Wallet Pass    |
+------------------+                    +------------------+                  +------------------+
     |                                         |
     | POST /api/external/pos/:programId/transaction
     |                                         |
     +--- externalMemberId ----+               |
     +--- amountCents ---------+               |
     +--- X-API-Key -----------+               |
     +--- X-Idempotency-Key ---+               |
                                               |
     <---- tierLevel, discountPercent, tierUpgraded, passUrl ----+
```

### Authentication

External POS systems authenticate using API keys generated from the Client Command Center:

```bash
# Request header
X-API-Key: pk_live_abc123def456

# Generate new key (admin only)
POST /api/external/pos/:programId/api-key
Authorization: Bearer <admin-jwt>

# Revoke key
DELETE /api/external/pos/:programId/api-key/:keyId
Authorization: Bearer <admin-jwt>
```

### Spend-Based Tier Calculation

The system tracks cumulative spend and automatically upgrades tiers:

| Tier | Spend Threshold | Default Discount |
|------|-----------------|------------------|
| **Bronze (TIER_1)** | $0+ | 0% |
| **Silver (TIER_2)** | $300+ | 5% |
| **Gold (TIER_3)** | $1,000+ | 10% |
| **Platinum (TIER_4)** | $2,500+ | 15% |

### Transaction Processing

```bash
# Process a transaction
curl -X POST "https://your-domain/api/external/pos/prog-001/transaction" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pk_live_abc123" \
  -H "X-Idempotency-Key: tx-20241206-001" \
  -d '{
    "externalMemberId": "CUST-12345",
    "amountCents": 15000,
    "transactionId": "POS-TX-789",
    "storeId": "STORE-NYC-01",
    "customerEmail": "customer@example.com",
    "customerFirstName": "John",
    "customerLastName": "Doe"
  }'

# Response
{
  "success": true,
  "memberId": "uuid-internal-member-id",
  "externalMemberId": "CUST-12345",
  "tierLevel": "TIER_2",
  "tierName": "Silver",
  "discountPercent": 5,
  "spendTotalCents": 45000,
  "passUrl": "https://pub2.pskt.io/pass-abc123",
  "isNewMember": false,
  "tierUpgraded": true,
  "previousTier": "Bronze",
  "transactionId": "tx-record-uuid"
}
```

### Member Lookup

```bash
# Lookup member by external ID
curl "https://your-domain/api/external/pos/prog-001/member/CUST-12345" \
  -H "X-API-Key: pk_live_abc123"

# Response
{
  "found": true,
  "member": {
    "id": "uuid-internal-id",
    "externalId": "CUST-12345",
    "spendTotalCents": 45000,
    "tierLevel": "TIER_2",
    "tierName": "Silver",
    "discountPercent": 5,
    "passUrl": "https://pub2.pskt.io/pass-abc123"
  }
}
```

### Database Schema (Migration 025)

```sql
-- Add external ID and spend tracking to passes_master
ALTER TABLE passes_master ADD COLUMN external_id VARCHAR(255);
ALTER TABLE passes_master ADD COLUMN spend_total_cents INTEGER DEFAULT 0;
ALTER TABLE passes_master ADD COLUMN spend_tier_level VARCHAR(20) DEFAULT 'TIER_1';

-- Add spend tier thresholds to programs
ALTER TABLE programs ADD COLUMN spend_tier_2_threshold_cents INTEGER DEFAULT 30000;
ALTER TABLE programs ADD COLUMN spend_tier_3_threshold_cents INTEGER DEFAULT 100000;
ALTER TABLE programs ADD COLUMN spend_tier_4_threshold_cents INTEGER DEFAULT 250000;

-- Create spend ledger for transaction history
CREATE TABLE spend_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id),
  member_id UUID REFERENCES passes_master(id),
  external_transaction_id VARCHAR(255),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  store_id VARCHAR(255),
  idempotency_key VARCHAR(255) UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add POS API keys table
CREATE TABLE pos_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id),
  key_hash VARCHAR(64) NOT NULL,
  key_prefix VARCHAR(12) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
```

### Idempotency

The `X-Idempotency-Key` header prevents duplicate transaction processing:

```typescript
// First request: Transaction processed, points added
POST /transaction + X-Idempotency-Key: tx-001 → { success: true, isDuplicate: false }

// Retry request: Same key, returns previous result
POST /transaction + X-Idempotency-Key: tx-001 → { success: true, isDuplicate: true }
```

### Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `PROGRAM_NOT_FOUND` | Invalid program ID | Verify program exists |
| `INVALID_API_KEY` | API key invalid or revoked | Generate new key |
| `PROCESSING_ERROR` | Database or service error | Retry with same idempotency key |
| `DUPLICATE_TRANSACTION` | Already processed | Safe to ignore |

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

### PassKit Webhook Callbacks

PassKit sends wallet events to these endpoints for real-time status sync:

#### POST /api/callbacks/passkit

Receives wallet install/uninstall events from PassKit.

**No API key required** - Uses HMAC signature verification instead.

**Headers:**
```
x-passkit-signature: <hmac_sha256_signature>
```

**Events Handled:**

| Event | Action | Database Update |
|-------|--------|-----------------|
| `pass.installed` | User added pass to wallet | `status: INSTALLED`, `is_active: true` |
| `pass.uninstalled` | User removed pass | `status: UNINSTALLED`, `is_active: false` |
| `pass.updated` | Pass data changed | `last_updated` timestamp |

**Request:**
```json
{
  "event": "pass.uninstalled",
  "externalId": "PUB-ABC123",
  "passId": "passkit-internal-id",
  "timestamp": "2024-12-05T12:00:00Z"
}
```

**Response:** Always returns `200 OK` to prevent PassKit retries.

---

### Admin API Endpoints

#### POST /api/admin/provision

Create a new client tenant with optional PassKit auto-provisioning.

**Authentication:** `x-api-key` header

**Request:**
```json
{
  "businessName": "Pizza Palace",
  "email": "admin@pizzapalace.com",
  "password": "SecurePass123!",
  "protocol": "MEMBERSHIP",
  "timezone": "America/New_York",
  "autoProvision": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "programId": "uuid",
    "dashboardSlug": "abc123",
    "dashboardUrl": "/enroll/abc123",
    "passkit": {
      "status": "provisioned",
      "programId": "pk-program-id",
      "tierId": "pk-tier-id",
      "enrollmentUrl": "https://pub2.pskt.io/c/..."
    }
  }
}
```

**Soft-Fail Behavior:**
If PassKit API fails, client is still created with `passkit.status: "manual_required"`.

#### GET /api/admin/tenants

List all client tenants (PLATFORM_ADMIN only).

#### GET /api/admin/tenants/:userId

Get specific tenant details.

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
| `/api/campaigns/*` | ✅ | ✅ | ❌ |
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
| `campaign_runs` | Direct mail campaign tracking |
| `campaign_contacts` | Per-contact status and mail IDs |
| `billing_snapshots` | Member quota usage history |

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
| `earn_rate_multiplier` | INTEGER | Points per $1 spent (default: 10) |
| `member_limit` | INTEGER | Maximum active members allowed |
| `tier_1_discount_percent` | INTEGER | Tier 1 discount (default: 0%) |
| `tier_2_discount_percent` | INTEGER | Tier 2 discount (default: 5%) |
| `tier_3_discount_percent` | INTEGER | Tier 3 discount (default: 10%) |
| `tier_4_discount_percent` | INTEGER | Tier 4 discount (default: 15%) |
| `spend_tier_2_threshold_cents` | INTEGER | Spend for tier 2 (default: 30000) |
| `spend_tier_3_threshold_cents` | INTEGER | Spend for tier 3 (default: 100000) |
| `spend_tier_4_threshold_cents` | INTEGER | Spend for tier 4 (default: 250000) |

### Key Columns (passes_master) - v2.6.0

| Column | Type | Description |
|--------|------|-------------|
| `external_id` | VARCHAR | External POS system member ID |
| `spend_total_cents` | INTEGER | Cumulative lifetime spend |
| `spend_tier_level` | VARCHAR | Current tier (TIER_1-TIER_4) |

### New Tables (v2.6.0)

| Table | Description |
|-------|-------------|
| `spend_ledger` | External POS transaction history |
| `pos_api_keys` | API keys for external POS integration |

### Required RPC Functions

| Function | Purpose |
|----------|---------|
| `process_membership_transaction` | Points earn/redeem (legacy) |
| `process_membership_transaction_atomic` | Atomic points earn/redeem (Protocol F) |
| `process_claim_attempt` | Atomic claim code processing (Protocol E) |
| `process_one_time_use` | Coupon/ticket redemption |
| `get_service_status` | Health check |
| `count_members_by_program` | Billing quota monitoring |

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

**Required:**
- [ ] All required secrets configured (SUPABASE_*, ADMIN_API_KEY, SESSION_SECRET)
- [ ] Database migrations run (001-004, 010-014)
- [ ] RPC functions verified in Supabase
- [ ] `APP_URL` set to production domain
- [ ] `VITE_MOCK_MODE` set to `false`

**Security Validation (Critical):**
- [ ] Protocol D passed: `SELECT * FROM programs` returns error 42501
- [ ] Migration 012 applied (RLS policies)
- [ ] Migration 014 applied (soft-fail provisioning)

**External Services:**
- [ ] PassKit credentials configured (for wallet features)
- [ ] PostGrid credentials configured (for mail features)
- [ ] PassKit webhook URL configured: `https://your-domain/api/callbacks/passkit`

**Validation:**
- [ ] Production validation script passes: `npx tsx scripts/prod-validation.ts`
- [ ] All 4 hardening protocols verified (A-D)

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
│   │   │   ├── assets.tsx    # Program QR codes & downloads
│   │   │   ├── campaigns.tsx # Campaign Launcher (admin)
│   │   │   ├── admin-clients.tsx        # Client list (admin)
│   │   │   ├── admin-client-details.tsx # Client Command Center (admin) [v2.6]
│   │   │   └── pos.tsx
│   │   ├── lib/              # Utilities
│   │   │   ├── auth.tsx      # Auth context (with mock mode support)
│   │   │   ├── api.ts        # API client
│   │   │   └── queryClient.ts
│   │   └── index.css         # Tailwind + theme
│   └── index.html
├── server/
│   ├── controllers/          # Request handlers
│   │   ├── admin.controller.ts
│   │   ├── pos.controller.ts
│   │   ├── client.controller.ts  # Client profile & tier discount updates [v2.6]
│   │   ├── campaign.controller.ts
│   │   └── passkit-webhook.controller.ts
│   ├── services/             # Business logic
│   │   ├── logic.service.ts
│   │   ├── supabase.service.ts
│   │   ├── passkit-provision.service.ts
│   │   ├── postgrid.service.ts
│   │   ├── admin.service.ts   # Tier discount persistence [v2.6]
│   │   └── pos-webhook.service.ts  # External POS spend tracking [v2.6]
│   ├── routes/               # Express routes
│   │   ├── client.routes.ts  # Dashboard API
│   │   ├── pos.routes.ts     # POS API
│   │   ├── campaign.routes.ts # Campaign API (admin)
│   │   ├── callbacks.routes.ts # PassKit webhooks
│   │   ├── webhook.routes.ts # External POS webhooks [v2.6]
│   │   └── external-pos.routes.ts  # External POS API [v2.6]
│   ├── utils/
│   │   └── tier-calculator.ts  # Tier level calculations [v2.6]
│   ├── middleware/           # Auth, validation
│   ├── scripts/
│   │   └── billing-cron.ts   # Nightly billing audit
│   └── index.ts              # Server entry
├── migrations/               # SQL migrations (001-025)
│   ├── 001-020              # Core migrations
│   ├── 021_tier_discount_columns.sql  # Tier discount percentages [v2.6]
│   └── 025_external_pos_spend_tracking.sql  # External POS & spend ledger [v2.6]
├── scripts/
│   ├── prod-validation.ts   # Production validation tests
│   └── test-provisioning.ts # Provisioning tests
├── docs/
│   ├── POS_INTEGRATION.md   # POS webhook guide
│   ├── EXTERNAL_POS_INTEGRATION.md  # External POS API guide [v2.6]
│   ├── SECURITY_VALIDATION.md  # Protocol D security tests
│   └── CAMPAIGN_LAUNCHER_ADMIN_ARCHITECTURE.md
├── shared/
│   └── schema.ts            # POSWebhookTransaction & POSWebhookResponse types [v2.6]
├── design_guidelines.md     # UI/UX guidelines
└── README.md
```

---

## Support

- **Email**: support@passtovip.com
- **Documentation**: This README and `replit.md`
- **POS Integration**: See `docs/POS_INTEGRATION.md`
- **Security**: See `docs/SECURITY_VALIDATION.md`

---

## Known Gaps & Future Enhancements

The following areas have been identified for future improvement. AI agents may assist in addressing these:

### Data & Performance
| Gap | Description | Priority |
|-----|-------------|----------|
| **Analytics Caching** | Dashboard analytics queries run directly on DB | Medium |
| **Batch Transactions** | POS processes one transaction at a time | Low |
| **Query Optimization** | Large member lists may need pagination improvements | Medium |

### Integration & Reliability
| Gap | Description | Priority |
|-----|-------------|----------|
| **Webhook Retry Queue** | Failed PassKit callbacks are not automatically retried | High |
| **PassKit Rate Limiting** | No backoff strategy for PassKit API rate limits | Medium |
| **PostGrid Status Tracking** | Mail delivery status not synced back to dashboard | Low |

### Monitoring & Observability
| Gap | Description | Priority |
|-----|-------------|----------|
| **Structured Logging** | Logs are text-based, not JSON for aggregation | Medium |
| **Metrics Dashboard** | No Prometheus/Grafana integration | Low |
| **Error Alerting** | No PagerDuty/Slack integration for failures | Medium |

### Security & Compliance
| Gap | Description | Priority |
|-----|-------------|----------|
| **API Key Rotation UI** | Keys must be rotated via SQL, no admin UI | Medium |
| **Audit Logging** | Admin actions not tracked for compliance | High |
| **GDPR Export** | No self-service data export for members | Medium |

### User Experience
| Gap | Description | Priority |
|-----|-------------|----------|
| **Mobile POS App** | POS is web-only, no native mobile app | Low |
| **Multi-Language** | Dashboard is English-only | Low |
| **Dark Mode** | Dashboard theme not fully implemented | Low |

---

## Changelog

### v2.6.0 - Dynamic Tier Discounts & External POS Integration (December 2024)

**Dynamic Tier Discount System:**
- ✅ Configurable discount percentages per tier level (0-100%)
- ✅ Database columns: `tier_1_discount_percent` through `tier_4_discount_percent`
- ✅ Client Command Center UI with tier discount input fields
- ✅ Progressive discount validation (higher tiers ≥ lower tiers)
- ✅ Real-time discount display in External POS responses

**External POS Webhook System:**
- ✅ Production-ready API for external POS integration
- ✅ Spend-based tier calculation with configurable thresholds
- ✅ Cumulative spend tracking in `spend_ledger` table
- ✅ Member upsert by external ID with customer data enrichment
- ✅ Idempotency support via `X-Idempotency-Key` header
- ✅ API key management with create/revoke controls
- ✅ Tier upgrade detection with `tierUpgraded` response field

**Enhanced Notification System:**
- ✅ Triple validation (tier, PassKit, protocol)
- ✅ Dynamic tier segments (TIER_1 through TIER_4)
- ✅ Segment preview before sending
- ✅ Automated birthday rewards integration

**Client Command Center Enhancements:**
- ✅ Tier configuration panel with expand/collapse
- ✅ PassKit tier ID mapping per tier level
- ✅ Spend threshold configuration for external POS
- ✅ Discount percentage inputs with validation

**Development Experience:**
- ✅ Mock mode (`VITE_MOCK_MODE=true`) for testing without Supabase auth
- ✅ "Demo Login" button for quick access
- ✅ Pre-populated sample data for UI testing
- ✅ "Test Mode" badge indicator

**Database Migrations:**
- ✅ Migration 021: Tier discount percentage columns
- ✅ Migration 025: External POS spend tracking, spend_ledger table, pos_api_keys table

**New API Endpoints:**
- `POST /api/external/pos/:programId/transaction` - Process spend transaction
- `GET /api/external/pos/:programId/member/:externalId` - Member lookup
- `POST /api/external/pos/:programId/api-key` - Generate API key
- `DELETE /api/external/pos/:programId/api-key/:keyId` - Revoke API key

---

### v2.5.0 - Multi-Program Architecture (December 2024)
- ✅ One tenant can manage multiple programs (verticals) simultaneously
- ✅ Protocol support: MEMBERSHIP, EVENT_TICKET, COUPON
- ✅ Independent PassKit credentials per program
- ✅ Primary program designation for default routing
- ✅ Protocol-specific visual badges in admin UI
- ✅ Migration 020: Multi-program support

---

### v1.2.0 - Campaign Launcher & Security Hardening (December 2024)
- ✅ Campaign Launcher with dual client selection (dropdown + manual ID)
- ✅ PostGrid integration for postcards and letters (6 + 3 sizes)
- ✅ Campaign history tracking with status monitoring
- ✅ Backend role enforcement for admin-only routes
- ✅ Migration 019: Campaign tracking tables with RLS
- ✅ Idempotent migration (safe to re-run)

### v1.1.0 - Enterprise Security (December 2024)
- ✅ Protocol E: Double-claim prevention with atomic RPCs
- ✅ Protocol F: Race condition prevention with FOR UPDATE locks
- ✅ Protocol G: Revenue leakage prevention with billing quotas
- ✅ Integer-based point system ("Casino Chip" model)
- ✅ Program Assets page with QR code downloads
- ✅ Migrations 015-018: Security hardening and billing

### v1.0.0 - Production Hardening (December 2024)
- ✅ Soft-fail provisioning (Protocol A)
- ✅ PassKit webhook status sync (Protocol B)
- ✅ POS clerk protection modal (Protocol C)
- ✅ RLS security validation (Protocol D)
- ✅ Complete migration set (001-014)
- ✅ API documentation for all endpoints

---

## License

MIT License - See LICENSE file for details.

---

<p align="center">
  <strong>Pass To VIP - Bridging Physical Mail and Digital Wallets</strong>
  <br>
  <sub>Operated by Oakmont Logic LLC</sub>
  <br><br>
  <img src="https://img.shields.io/badge/Validated-Protocol%20A%20B%20C%20D%20E%20F%20G-22c55e?style=flat-square" alt="Validated"/>
  <img src="https://img.shields.io/badge/Security-RLS%20Verified-2563eb?style=flat-square" alt="Security"/>
  <img src="https://img.shields.io/badge/Campaigns-PostGrid%20Ready-dc2626?style=flat-square" alt="Campaigns"/>
</p>
