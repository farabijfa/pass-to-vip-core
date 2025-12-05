-- Migration: Add program_id to claim_codes for Multi-Program Support
-- This migration enables claim codes to be linked directly to internal programs
-- Version: 021
-- Date: 2024-12-05
-- Part of: Protocol K - Campaign Launcher Multi-Program Fix

-- ============================================================
-- STEP 1: Add program_id column to claim_codes table
-- This creates a direct link to the internal programs table
-- ============================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'claim_codes' AND column_name = 'program_id'
    ) THEN
        ALTER TABLE claim_codes ADD COLUMN program_id UUID REFERENCES programs(id);
        RAISE NOTICE 'Added program_id column to claim_codes table';
    ELSE
        RAISE NOTICE 'program_id column already exists in claim_codes table';
    END IF;
END $$;

-- ============================================================
-- STEP 2: Create index for program_id lookups
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_claim_codes_program_id 
ON claim_codes(program_id);

-- Composite index for program + status queries
CREATE INDEX IF NOT EXISTS idx_claim_codes_program_status 
ON claim_codes(program_id, status);

-- ============================================================
-- STEP 3: Backfill existing claim codes with program_id
-- Match claim codes to programs via passkit_program_id
-- ============================================================

UPDATE claim_codes cc
SET program_id = p.id
FROM programs p
WHERE cc.passkit_program_id = p.passkit_program_id
AND cc.program_id IS NULL;

-- ============================================================
-- STEP 4: Update generate_claim_code RPC function
-- Add p_program_id parameter for direct program linking
-- ============================================================

CREATE OR REPLACE FUNCTION generate_claim_code(
    p_passkit_program_id TEXT,
    p_first_name TEXT,
    p_last_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_address_line_1 TEXT DEFAULT NULL,
    p_address_line_2 TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_postal_code TEXT DEFAULT NULL,
    p_country TEXT DEFAULT 'US',
    p_program_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_claim_code TEXT;
    v_resolved_program_id UUID;
BEGIN
    -- Generate unique claim code (8 character alphanumeric)
    v_claim_code := upper(encode(gen_random_bytes(4), 'hex'));
    
    -- Resolve program_id: use provided p_program_id, or look up from passkit_program_id
    IF p_program_id IS NOT NULL THEN
        v_resolved_program_id := p_program_id;
    ELSE
        -- Fallback: look up program by passkit_program_id
        SELECT id INTO v_resolved_program_id 
        FROM programs 
        WHERE passkit_program_id = p_passkit_program_id
        LIMIT 1;
    END IF;
    
    -- Insert claim code record
    INSERT INTO claim_codes (
        claim_code,
        passkit_program_id,
        program_id,
        first_name,
        last_name,
        email,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country,
        status,
        created_at
    ) VALUES (
        v_claim_code,
        p_passkit_program_id,
        v_resolved_program_id,
        p_first_name,
        p_last_name,
        p_email,
        p_address_line_1,
        p_address_line_2,
        p_city,
        p_state,
        p_postal_code,
        p_country,
        'ISSUED',
        NOW()
    );
    
    -- Return claim code and program info
    RETURN json_build_object(
        'claim_code', v_claim_code,
        'program_id', v_resolved_program_id,
        'passkit_program_id', p_passkit_program_id,
        'status', 'ISSUED'
    );
END;
$$;

-- ============================================================
-- STEP 5: Create helper function to get claim codes by program
-- ============================================================

CREATE OR REPLACE FUNCTION get_claim_codes_by_program(
    p_program_id UUID,
    p_status TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    claim_code TEXT,
    program_id UUID,
    passkit_program_id TEXT,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    installed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cc.claim_code,
        cc.program_id,
        cc.passkit_program_id,
        cc.first_name,
        cc.last_name,
        cc.email,
        cc.status,
        cc.created_at,
        cc.installed_at
    FROM claim_codes cc
    WHERE cc.program_id = p_program_id
    AND (p_status IS NULL OR cc.status = p_status)
    ORDER BY cc.created_at DESC
    LIMIT p_limit;
END;
$$;

-- ============================================================
-- STEP 6: Add campaign_run_id column for tracking
-- Links claim codes to specific campaign runs
-- ============================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'claim_codes' AND column_name = 'campaign_run_id'
    ) THEN
        ALTER TABLE claim_codes ADD COLUMN campaign_run_id UUID REFERENCES campaign_runs(id);
        RAISE NOTICE 'Added campaign_run_id column to claim_codes table';
    ELSE
        RAISE NOTICE 'campaign_run_id column already exists in claim_codes table';
    END IF;
END $$;

-- Index for campaign tracking
CREATE INDEX IF NOT EXISTS idx_claim_codes_campaign_run 
ON claim_codes(campaign_run_id);

-- ============================================================
-- VERIFICATION
-- ============================================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM information_schema.columns 
    WHERE table_name = 'claim_codes' 
    AND column_name IN ('program_id', 'campaign_run_id');
    
    IF v_count >= 1 THEN
        RAISE NOTICE '✅ Migration 021 completed successfully';
        RAISE NOTICE '   - program_id column added to claim_codes';
        RAISE NOTICE '   - generate_claim_code RPC updated with p_program_id';
        RAISE NOTICE '   - get_claim_codes_by_program helper function created';
        RAISE NOTICE '   - Indexes created for efficient querying';
    ELSE
        RAISE WARNING '⚠️ Migration may be incomplete. Check columns.';
    END IF;
END $$;
