# AI Campaign Playbook
## Pass To VIP - Backend Operations Guide

This playbook documents all backend commands for launching loyalty campaigns via AI agent chat interface.

---

## Quick Reference

### Live Programs
| Program Name | PassKit ID | Tier ID | Protocol |
|-------------|------------|---------|----------|
| My Loyalty Program | `4RhsVhHek0dliVogVznjSQ` | `base`, `base_2` | MEMBERSHIP |
| GIFT CARDS | `20bCfEUuHxQgvo7toZbTTy` | `gift_card` | MEMBERSHIP |

### PostGrid Templates
| Template ID | Description | Status |
|------------|-------------|--------|
| `template_3J62GbmowSk7SeD4dFcaUs` | Standard QR Letter | LIVE |

---

## 1. MEMBERSHIP Pass Campaigns

### Option A: Physical QR Letter Campaign

**Use Case:** Send printed letters with QR codes that customers scan to install wallet passes.

**Form Data Required:**
```json
{
  "campaignType": "QR_LETTER",
  "protocol": "MEMBERSHIP",
  "passkitProgramId": "YOUR_PASSKIT_PROGRAM_ID",
  "postgridTemplateId": "template_xxx",
  "recipients": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "addressLine1": "123 Main St",
      "addressLine2": "Apt 4B",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001"
    }
  ],
  "description": "Holiday 2025 Campaign"
}
```

**Backend Command:**
```bash
curl -X POST "https://YOUR_REPLIT_URL/api/admin/test-send-letter" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "passkitProgramId": "4RhsVhHek0dliVogVznjSQ",
    "templateId": "template_3J62GbmowSk7SeD4dFcaUs",
    "recipient": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "addressLine1": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001"
    },
    "description": "Test Letter Campaign"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "letter": {
      "id": "letter_xxx",
      "status": "ready",
      "previewUrl": "https://dashboard.postgrid.com/..."
    },
    "claim": {
      "claimCode": "ABC12345",
      "claimUrl": "https://your-app.replit.dev/claim/ABC12345",
      "qrCodeUrl": "https://api.qrserver.com/..."
    }
  }
}
```

### Option B: PassKit Hosted Enrollment Page

**Use Case:** Direct customers to PassKit's hosted form where they enter name/email to get a pass.

**Getting Enrollment URLs:**
1. Log into PassKit Dashboard (app.passkit.com)
2. Select your program (e.g., "GIFT CARDS")
3. Go to **Distribution** tab
4. Find **Enrollment Links** section
5. Copy the URL format: `https://pub2.pskt.io/t/{formId}`

**Enrollment URL Format:**
```
https://pub2.pskt.io/t/{enrollmentFormId}    # Hosted form with name/email fields
https://pub2.pskt.io/c/{campaignId}          # Campaign distribution link
```

**Store Enrollment URL in System:**
```bash
curl -X PATCH "https://YOUR_REPLIT_URL/api/programs/{programId}/enrollment-url" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enrollment_url": "https://pub2.pskt.io/t/YOUR_FORM_ID"
  }'
```

---

## 2. Checking Campaign Status

### Get Claim Code Status
```bash
curl "https://YOUR_REPLIT_URL/api/claim/{CLAIM_CODE}/status"
```

**Status Values:**
- `PENDING` - Claim created, not yet scanned
- `INSTALLED` - Pass installed to wallet
- `EXPIRED` - Claim code expired
- `CANCELLED` - Claim cancelled

### List All Claims for a Program
```bash
curl "https://YOUR_REPLIT_URL/api/admin/claims?programId=4RhsVhHek0dliVogVznjSQ" \
  -H "x-api-key: $ADMIN_API_KEY"
```

---

## 3. Program Management

### List All Programs
```bash
curl "https://YOUR_REPLIT_URL/api/programs" \
  -H "x-api-key: $ADMIN_API_KEY"
```

### Get Program Details
```bash
curl "https://YOUR_REPLIT_URL/api/programs/{programId}" \
  -H "x-api-key: $ADMIN_API_KEY"
```

### Get Program Tiers from PassKit
```bash
curl "https://YOUR_REPLIT_URL/api/admin/passkit/programs/{passkitProgramId}/tiers" \
  -H "x-api-key: $ADMIN_API_KEY"
```

### Generate Program QR Code
```bash
curl "https://YOUR_REPLIT_URL/api/programs/{programId}/qr?format=svg" \
  -H "x-api-key: $ADMIN_API_KEY"
```

---

## 4. Form Template for AI Agent

When you want to launch a campaign, fill out this form and provide to AI agent:

```
=== CAMPAIGN REQUEST FORM ===

Campaign Type: [QR_LETTER / ENROLLMENT_PAGE]

Protocol: [MEMBERSHIP / COUPON / EVENT_TICKET]

PassKit Program ID: 
(Get from PassKit Dashboard > Program > Overview)

PostGrid Template ID: (if QR_LETTER)
(Your pre-configured template)

Enrollment URL: (if ENROLLMENT_PAGE)
(From PassKit Dashboard > Distribution)

Recipients: (if QR_LETTER)
- Name: 
- Email:
- Address Line 1:
- Address Line 2:
- City:
- State:
- Postal Code:

Campaign Description:

Test Mode: [YES / NO]
(YES = letters not physically mailed)
```

---

## 5. End-to-End Flow Verification

### Step 1: Create Test Letter
```bash
curl -X POST "https://YOUR_REPLIT_URL/api/admin/test-send-letter" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "passkitProgramId": "20bCfEUuHxQgvo7toZbTTy",
    "templateId": "template_3J62GbmowSk7SeD4dFcaUs",
    "recipient": {
      "firstName": "Test",
      "lastName": "User",
      "email": "test@example.com",
      "addressLine1": "100 Test St",
      "city": "Miami",
      "state": "FL",
      "postalCode": "33101"
    }
  }'
```

### Step 2: Get Claim URL from Response
The response includes:
- `claimUrl`: URL to test scanning
- `qrCodeUrl`: QR code image URL

### Step 3: Simulate Scan (or use phone camera)
```bash
curl "https://YOUR_REPLIT_URL/claim/{CLAIM_CODE}"
```
This redirects to PassKit wallet installation.

### Step 4: Verify Installation
```bash
curl "https://YOUR_REPLIT_URL/api/claim/{CLAIM_CODE}/status"
```
Should show `status: "INSTALLED"`

---

## 6. System Health Checks

### Check PassKit Connection
```bash
curl "https://YOUR_REPLIT_URL/api/admin/passkit/health" \
  -H "x-api-key: $ADMIN_API_KEY"
```

### List PassKit Programs
```bash
curl "https://YOUR_REPLIT_URL/api/admin/passkit/programs" \
  -H "x-api-key: $ADMIN_API_KEY"
```

### Check Supabase Connection
The system automatically syncs with Supabase for:
- Client data
- Program configurations
- Claim code tracking
- Member records

---

## 7. Configuration Checklist

Before running campaigns, verify:

- [ ] PassKit API keys set in environment
- [ ] PostGrid API key set in environment
- [ ] ADMIN_API_KEY set for backend access
- [ ] PassKit program has at least one tier
- [ ] PostGrid template created and tested
- [ ] Enrollment URL set (if using hosted forms)

---

## 8. Troubleshooting

### "TIER_NOT_FOUND" Error
- Go to PassKit Dashboard > Program > Tiers And Designs
- Create at least one tier
- Verify tier appears in: `GET /api/admin/passkit/programs/{id}/tiers`

### "ENROLLMENT_FAILED" Error
- Check PassKit API credentials
- Verify tier ID is valid
- Check server logs for detailed error

### Letter Not Created
- Verify PostGrid API key
- Check template ID exists
- Verify recipient address format

---

## Environment Variables Required

```
PASSKIT_API_KEY=your_passkit_key
PASSKIT_API_SECRET=your_passkit_secret
POSTGRID_API_KEY=your_postgrid_key
ADMIN_API_KEY=your_admin_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

---

*Generated: December 2025 | Pass To VIP v2.6.0*
