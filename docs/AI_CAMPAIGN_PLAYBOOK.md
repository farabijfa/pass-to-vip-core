# AI Campaign Playbook
## Pass To VIP - Backend Operations Guide

This playbook documents all backend commands for launching loyalty campaigns via AI agent chat interface.

---

## Quick Reference

### Live Programs
| Program Name | PassKit ID | Tier ID | Enrollment Form URL | Protocol |
|-------------|------------|---------|---------------------|----------|
| Gift Card Rewards | `20bCfEUuHxQgvo7toZbTTy` | `gift_card` | `https://pub2.pskt.io/t/ffxqqe` | MEMBERSHIP |
| Beta Tester Pizza | `4RhsVhHek0dliVogVznjSQ` | `base`, `base_2` | *(Get from PassKit Dashboard)* | MEMBERSHIP |

### PostGrid Templates
| Template ID | Description | Status |
|------------|-------------|--------|
| `template_3J62GbmowSk7SeD4dFcaUs` | Standard QR Letter | LIVE |

---

## Understanding the Two Campaign Flows

Pass To VIP supports **two distinct enrollment flows**. Choose the right one based on your use case:

### Flow 1: Vertical C - Generic In-Store QR (Data Collection Required)
**Use Case:** Display a single QR code at your front desk for walk-in customers.

- Customer scans QR → PassKit hosted form → enters name/email → gets pass
- URL Format: `https://pub2.pskt.io/t/{formId}` (e.g., `ffxqqe`)
- Different form IDs exist per tier (configured in PassKit Dashboard > Distribution)
- Visible in client dashboard Assets page

### Flow 2: Postcard Campaign - Personalized Letters (No Data Collection)
**Use Case:** Mail printed letters to known customers with pre-filled info.

- Letter mailed to address → customer scans QR → **SKIPS data entry** → pass installs directly
- URL Format: Your `/claim/{code}` endpoint
- Customer info already captured when creating claim code
- System calls PassKit API directly with pre-filled data

---

## Flow 1: Generic Enrollment QR (Vertical C)

### Setting Up Enrollment URLs
Each program/tier needs a PassKit enrollment form URL:

1. Log into PassKit Dashboard (app.passkit.com)
2. Select your program
3. Go to **Distribution** tab
4. Find your enrollment form and copy URL: `https://pub2.pskt.io/t/{formId}`

### Store Enrollment URL in System
```bash
curl -X PATCH "https://YOUR_REPLIT_URL/api/programs/{programId}/enrollment-url" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enrollment_url": "https://pub2.pskt.io/t/ffxqqe"
  }'
```

### View in Dashboard
Once set, the enrollment URL appears in:
- **Assets Page** → Shows QR code for printing/display
- **Program Details** → Shows enrollment link for sharing

### Form Template for AI: Generic QR Setup
```
=== GENERIC ENROLLMENT SETUP ===

Program Name: [e.g., Gift Card Rewards]
PassKit Program ID: [e.g., 20bCfEUuHxQgvo7toZbTTy]
Tier ID: [e.g., gift_card]
PassKit Form URL: [e.g., https://pub2.pskt.io/t/ffxqqe]

Action: Store enrollment URL in system
```

---

## Flow 2: Postcard Campaign (Personalized Letters)

### How It Works
1. You provide recipient list with names and addresses
2. System generates unique claim codes for each recipient
3. PostGrid creates letters with personalized QR codes
4. When customer scans, they go directly to wallet installation (no form)

### Backend Command: Send Test Letter
```bash
curl -X POST "https://YOUR_REPLIT_URL/api/admin/test-send-letter" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "passkitProgramId": "20bCfEUuHxQgvo7toZbTTy",
    "templateId": "template_3J62GbmowSk7SeD4dFcaUs",
    "recipient": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "addressLine1": "123 Main St",
      "addressLine2": "Apt 4B",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001"
    },
    "description": "Holiday 2025 Campaign"
  }'
```

### Response
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
    },
    "passkit": {
      "programId": "20bCfEUuHxQgvo7toZbTTy"
    }
  }
}
```

### Form Template for AI: Postcard Campaign
```
=== POSTCARD CAMPAIGN REQUEST ===

Campaign Type: POSTCARD_LETTER
PassKit Program ID: [e.g., 20bCfEUuHxQgvo7toZbTTy]
PostGrid Template ID: [e.g., template_3J62GbmowSk7SeD4dFcaUs]

Recipients:
1. Name: John Doe
   Email: john@example.com
   Address: 123 Main St, Apt 4B
   City: New York
   State: NY
   Postal: 10001

2. Name: Jane Smith
   Email: jane@example.com
   Address: 456 Oak Ave
   City: Miami
   State: FL
   Postal: 33101

Campaign Description: Holiday 2025 VIP Rewards
Test Mode: YES (no physical mail)
```

---

## Checking Campaign Status

### Get Claim Code Status
```bash
curl "https://YOUR_REPLIT_URL/api/claim/{CLAIM_CODE}/status"
```

### Status Values
| Status | Meaning |
|--------|---------|
| `ISSUED` | Claim created, letter sent, not yet scanned |
| `INSTALLED` | Pass successfully added to wallet |
| `EXPIRED` | Claim code expired |
| `CANCELLED` | Claim cancelled |

---

## Program Management

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

### Get PassKit Tiers
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

## End-to-End Testing

### Test Postcard Flow
```bash
# Step 1: Create test letter
curl -X POST "https://YOUR_REPLIT_URL/api/admin/test-send-letter" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "passkitProgramId": "20bCfEUuHxQgvo7toZbTTy",
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

# Step 2: Check claim status (should be ISSUED)
curl "https://YOUR_REPLIT_URL/api/claim/{CLAIM_CODE}/status"

# Step 3: Simulate scan (or scan QR with phone)
curl "https://YOUR_REPLIT_URL/claim/{CLAIM_CODE}"

# Step 4: Verify installation (should be INSTALLED)
curl "https://YOUR_REPLIT_URL/api/claim/{CLAIM_CODE}/status"
```

---

## Tier-Specific Enrollment URLs

Different tiers can have different PassKit enrollment forms. Store the correct form URL per program:

| Program | Tier | PassKit Form ID | Full URL |
|---------|------|-----------------|----------|
| Gift Card Rewards | gift_card | `ffxqqe` | `https://pub2.pskt.io/t/ffxqqe` |
| Beta Tester Pizza | base | *(Get from Dashboard)* | *(Configure)* |
| Beta Tester Pizza | base_2 | *(Get from Dashboard)* | *(Configure)* |

**To get form IDs:** PassKit Dashboard → Program → Distribution → Enrollment Links

---

## Troubleshooting

### "TIER_NOT_FOUND" Error
- Go to PassKit Dashboard > Program > Tiers And Designs
- Create at least one tier
- Verify tier appears in: `GET /api/admin/passkit/programs/{id}/tiers`

### Claim Code Shows Wrong Name
- Check that recipient data is correct when calling test-send-letter
- Names are stored in Supabase `claim_codes` table

### Enrollment URL Returns 404
- Verify the form ID is correct (from PassKit Dashboard > Distribution)
- Format should be: `https://pub2.pskt.io/t/{formId}` (not `/c/{tierId}`)

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

## Summary: Which Flow to Use?

| Scenario | Flow | What Happens |
|----------|------|--------------|
| In-store QR display | **Flow 1 (Vertical C)** | Customer enters name/email on PassKit form |
| Mailed postcard to known customer | **Flow 2 (Postcard)** | Customer scans, skips form, pass installs directly |
| Website enrollment button | **Flow 1** | Link to branded landing page or PassKit form |
| Targeted promotion to mailing list | **Flow 2** | Personalized letters with pre-filled claim codes |

---

*Generated: December 2025 | Pass To VIP v2.6.0*
