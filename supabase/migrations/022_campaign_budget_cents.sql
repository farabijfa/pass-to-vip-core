-- Migration: Add Campaign Budget Safety Rails (Gap M)
-- This adds per-program budget limits to prevent accidental overspending on campaigns
-- Version: 022
-- Date: 2024-12-05

-- ============================================================
-- STEP 1: Add campaign_budget_cents column to programs table
-- Default: $500.00 (50000 cents) - conservative safe default
-- ============================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'programs' AND column_name = 'campaign_budget_cents'
    ) THEN
        ALTER TABLE programs ADD COLUMN campaign_budget_cents INTEGER DEFAULT 50000;
        RAISE NOTICE 'Added campaign_budget_cents column to programs table (default: $500.00)';
    ELSE
        RAISE NOTICE 'campaign_budget_cents column already exists in programs table';
    END IF;
END $$;

-- ============================================================
-- STEP 2: Add index for budget queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_programs_campaign_budget 
ON programs(campaign_budget_cents);

-- ============================================================
-- STEP 3: Update get_tenant_programs RPC to include budget
-- Must DROP first because return type is changing (adding campaign_budget_cents)
-- ============================================================

DROP FUNCTION IF EXISTS get_tenant_programs(uuid);

CREATE OR REPLACE FUNCTION get_tenant_programs(p_tenant_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    protocol TEXT,
    passkit_program_id TEXT,
    passkit_tier_id TEXT,
    passkit_status TEXT,
    enrollment_url TEXT,
    dashboard_slug TEXT,
    timezone TEXT,
    earn_rate_multiplier INTEGER,
    is_suspended BOOLEAN,
    is_primary BOOLEAN,
    postgrid_template_id TEXT,
    member_limit INTEGER,
    campaign_budget_cents INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.protocol,
        p.passkit_program_id,
        p.passkit_tier_id,
        p.passkit_status,
        p.enrollment_url,
        p.dashboard_slug,
        p.timezone,
        p.earn_rate_multiplier,
        p.is_suspended,
        p.is_primary,
        p.postgrid_template_id,
        p.member_limit,
        p.campaign_budget_cents,
        p.created_at
    FROM programs p
    WHERE p.tenant_id = p_tenant_id
    ORDER BY p.is_primary DESC, p.created_at ASC;
END;
$$;

-- ============================================================
-- STEP 4: Create RPC function to get program budget
-- Used for quick budget checks during campaign launch
-- ============================================================

CREATE OR REPLACE FUNCTION get_program_budget(p_program_id UUID)
RETURNS TABLE (
    program_id UUID,
    program_name TEXT,
    campaign_budget_cents INTEGER,
    tenant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS program_id,
        p.name AS program_name,
        COALESCE(p.campaign_budget_cents, 50000) AS campaign_budget_cents,
        p.tenant_id
    FROM programs p
    WHERE p.id = p_program_id;
END;
$$;

-- ============================================================
-- VERIFICATION
-- ============================================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM information_schema.columns 
    WHERE table_name = 'programs' 
    AND column_name = 'campaign_budget_cents';
    
    IF v_count = 1 THEN
        RAISE NOTICE '✅ Migration 022 completed successfully';
        RAISE NOTICE '   - campaign_budget_cents column added (default: $500.00)';
        RAISE NOTICE '   - get_tenant_programs RPC updated';
        RAISE NOTICE '   - get_program_budget RPC created';
    ELSE
        RAISE WARNING '⚠️ Migration may be incomplete. Check columns.';
    END IF;
END $$;
