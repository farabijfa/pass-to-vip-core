# Campaign Launcher Admin Architecture

**Status:** Parked for Later Implementation  
**Created:** December 2024  
**Priority:** High - Revenue Protection

## Executive Summary

The current Campaign Launcher allows client self-service CSV upload and postcard launching. This architecture document outlines the admin-controlled version where all campaign launches require admin authorization, template assignment, and quota management.

## Problem Statement

Current gaps in self-service Campaign Launcher:
1. **No Template Control** - Clients could theoretically specify any template_id
2. **No Cost Control** - No quota limits on how many campaigns a client can run
3. **No Approval Flow** - Admin has no visibility before campaigns are sent
4. **No Audit Trail** - Limited tracking of who authorized what

## Proposed Solution

### Control Model

| Control | Owner | Description |
|---------|-------|-------------|
| Feature Toggle | Admin | Enable/disable Campaign Launcher per client |
| Quota | Admin | Set 1, 2, or 3 campaign runs per client |
| Template Assignment | Admin | Configure PostGrid template_id per client |
| Launch Authorization | Client | Client initiates, but only if admin-enabled |
| Cost Visibility | Both | Admin sets pricing, client sees estimate |

---

## Database Schema

### Table: `campaign_permissions`

```sql
CREATE TABLE campaign_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT FALSE,
  remaining_runs SMALLINT DEFAULT 0,
  max_runs SMALLINT DEFAULT 0,
  created_by_admin UUID REFERENCES admin_profiles(id),
  updated_by_admin UUID REFERENCES admin_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id)
);

CREATE INDEX idx_campaign_permissions_program ON campaign_permissions(program_id);
```

### Table: `campaign_templates`

```sql
CREATE TABLE campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  resource_type VARCHAR(20) NOT NULL DEFAULT 'postcard', -- postcard, letter
  template_id VARCHAR(100), -- PostGrid template ID
  front_template_id VARCHAR(100),
  back_template_id VARCHAR(100),
  size VARCHAR(10) DEFAULT '6x4', -- 6x4, 9x6, 11x6
  display_name VARCHAR(100) NOT NULL,
  notes TEXT,
  is_default BOOLEAN DEFAULT TRUE,
  active BOOLEAN DEFAULT TRUE,
  created_by_admin UUID REFERENCES admin_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_templates_program ON campaign_templates(program_id);
CREATE INDEX idx_campaign_templates_active ON campaign_templates(program_id, active, is_default);
```

### Table: `campaign_launches`

```sql
CREATE TABLE campaign_launches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id),
  template_id UUID REFERENCES campaign_templates(id),
  run_number SMALLINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, previewed, launched, failed, canceled
  cost_cents INTEGER,
  contact_total INTEGER,
  contact_valid INTEGER,
  contact_invalid INTEGER,
  resource_type VARCHAR(20),
  size VARCHAR(10),
  postgrid_template_id VARCHAR(100), -- Snapshot of template used
  filename VARCHAR(255),
  authorized_by_admin UUID REFERENCES admin_profiles(id),
  launched_by_user UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_campaign_launches_program ON campaign_launches(program_id);
CREATE INDEX idx_campaign_launches_status ON campaign_launches(status);
```

### Table: `campaign_launch_events`

```sql
CREATE TABLE campaign_launch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id UUID REFERENCES campaign_launches(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL, -- preview, launch, cost_estimate, quota_decrement, quota_blocked, template_changed, enabled, disabled
  actor_admin_id UUID REFERENCES admin_profiles(id),
  actor_user_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_events_launch ON campaign_launch_events(launch_id);
CREATE INDEX idx_campaign_events_type ON campaign_launch_events(event_type);
```

---

## API Endpoints

### Admin Endpoints (ADMIN_API_KEY or SUPER_ADMIN/PLATFORM_ADMIN JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/campaigns/:programId/enable` | Enable campaigns for client |
| POST | `/api/admin/campaigns/:programId/disable` | Disable campaigns for client |
| PATCH | `/api/admin/campaigns/:programId/quota` | Set/update quota (remaining_runs, max_runs) |
| POST | `/api/admin/campaigns/:programId/template` | Assign template to client |
| PATCH | `/api/admin/campaigns/:programId/template/:templateId` | Update template settings |
| GET | `/api/admin/campaigns/:programId/settings` | Get full settings (permissions, quota, templates, history) |
| GET | `/api/admin/campaigns/:programId/history` | Get launch history with audit events |

#### Enable Request Body
```json
{
  "max_runs": 3,
  "template": {
    "template_id": "tmpl_xxx",
    "front_template_id": "tmpl_front_xxx",
    "back_template_id": "tmpl_back_xxx",
    "size": "6x4",
    "resource_type": "postcard",
    "display_name": "Holiday Promo Card"
  }
}
```

### Client Endpoints (JWT Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaign/settings` | Get enabled status, quota, template info |
| POST | `/api/campaign/preview-csv` | Preview CSV (only if enabled) |
| POST | `/api/campaign/launch` | Launch campaign (only if enabled + quota > 0) |

#### Settings Response
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "remaining_runs": 2,
    "max_runs": 3,
    "template": {
      "display_name": "Holiday Promo Card",
      "resource_type": "postcard",
      "size": "6x4"
    },
    "pricing": {
      "6x4": 0.89,
      "9x6": 1.29,
      "11x6": 1.49
    }
  }
}
```

---

## Business Logic

### Gating Rules

```typescript
// Before allowing preview or launch:
async function checkCampaignAccess(programId: string): Promise<{allowed: boolean; reason?: string}> {
  const permissions = await getCampaignPermissions(programId);
  
  if (!permissions) {
    return { allowed: false, reason: "Campaigns not configured for this program" };
  }
  
  if (!permissions.enabled) {
    return { allowed: false, reason: "Campaign Launcher is disabled" };
  }
  
  if (permissions.remaining_runs <= 0) {
    return { allowed: false, reason: "No campaign runs remaining. Contact admin." };
  }
  
  return { allowed: true };
}
```

### Transactional Quota Decrement

```typescript
// Atomic quota decrement with rollback on failure
async function launchCampaignWithQuota(programId: string, csvData: ParsedCSV) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Lock and decrement quota
    const result = await client.query(`
      UPDATE campaign_permissions 
      SET remaining_runs = remaining_runs - 1, updated_at = NOW()
      WHERE program_id = $1 AND remaining_runs > 0
      RETURNING remaining_runs
    `, [programId]);
    
    if (result.rowCount === 0) {
      throw new Error('Quota exhausted');
    }
    
    // Get assigned template
    const template = await getDefaultTemplate(programId);
    
    // Create launch record
    const launch = await createLaunchRecord(programId, template, csvData);
    
    // Send to PostGrid with assigned template (not client-supplied)
    const postgridResult = await sendToPostGrid(csvData, template);
    
    // Update launch status
    await updateLaunchStatus(launch.id, 'launched', postgridResult);
    
    await client.query('COMMIT');
    return { success: true, launch };
    
  } catch (error) {
    await client.query('ROLLBACK');
    // Log audit event for failed launch
    await logAuditEvent('launch_failed', programId, error);
    throw error;
  } finally {
    client.release();
  }
}
```

---

## UI Flows

### Admin UI (Admin Clients Page)

```
+------------------------------------------+
| Client: Demo Pizza Rewards               |
+------------------------------------------+
| Campaign Launcher                   [ON] |
|                                          |
| Quota: [2] / 3 runs remaining            |
|                                          |
| Template: Holiday Promo Card             |
| Type: Postcard (6x4)                     |
| Template ID: tmpl_holiday_2024           |
|                                          |
| [Edit Template] [Reset Quota]            |
|                                          |
| History:                                 |
| - 12/01: 500 sent, $445 - Success        |
| - 11/15: 200 sent, $178 - Success        |
+------------------------------------------+
```

### Client UI (Campaigns Page)

#### When Disabled
```
+------------------------------------------+
| Campaign Launcher                        |
|                                          |
| [LOCKED ICON]                            |
| Campaign Launcher is not enabled         |
| for your account.                        |
|                                          |
| Contact support to enable.               |
+------------------------------------------+
```

#### When Enabled with Quota
```
+------------------------------------------+
| Campaign Launcher                        |
| 2 campaign runs remaining                |
+------------------------------------------+
| Your Template: Holiday Promo Card        |
| Type: 6x4 Postcard                       |
+------------------------------------------+
| [Upload CSV]                             |
|                                          |
| After preview:                           |
| - 500 valid addresses                    |
| - Estimated cost: $445.00                |
| - Template: Holiday Promo Card           |
|                                          |
| [Launch Campaign]                        |
+------------------------------------------+
```

---

## Implementation Phases

### Phase 1: Database & Admin API (2-3 hours)
1. Create Supabase migrations for all 4 tables
2. Add admin API endpoints for enable/disable/quota/template
3. Add RLS policies for multi-tenant security

### Phase 2: Client Gating (1-2 hours)
1. Add client settings endpoint
2. Modify preview/launch to check permissions
3. Add transactional quota logic

### Phase 3: Admin UI (2-3 hours)
1. Add Campaign Launcher panel to Admin Clients page
2. Template selector with PostGrid template dropdown
3. Quota controls and history view

### Phase 4: Client UI Updates (1-2 hours)
1. Fetch and display settings
2. Show locked state when disabled
3. Display template info and remaining quota
4. Cost estimate in preview

### Phase 5: Testing & Audit (1 hour)
1. E2E test admin flow
2. E2E test client flow with various states
3. Verify audit trail logging

---

## Security Considerations

1. **Template IDs are never client-supplied** - Always read from `campaign_templates`
2. **Quota decrement is atomic** - Uses row-level locking
3. **All actions are audited** - `campaign_launch_events` table
4. **Role-based access** - Admin endpoints require SUPER_ADMIN or PLATFORM_ADMIN
5. **RLS on all tables** - Multi-tenant isolation

---

## Cost Schedule

| Size | Unit Price | Example (500 cards) |
|------|------------|---------------------|
| 6x4  | $0.89      | $445.00             |
| 9x6  | $1.29      | $645.00             |
| 11x6 | $1.49      | $745.00             |

---

## Migration Path

The current self-service Campaign Launcher (`/campaigns` page) will remain functional but gated:
1. Add settings check on page load
2. If no permissions record exists, show "Contact admin to enable"
3. Existing code for preview/launch remains, just wrapped with permission checks

This is a non-breaking change - clients without explicit permissions simply can't access the feature.
