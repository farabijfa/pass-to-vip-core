-- Migration: Multi-Program Support for Pass To VIP
-- This migration enables one tenant to have multiple programs (verticals)
-- Version: 020
-- Date: 2024-12-05

-- ============================================================
-- STEP 1: Add tenant_id to programs table
-- This allows multiple programs per user while maintaining 
-- backward compatibility with admin_profiles
-- ============================================================

-- Add tenant_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'programs' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE programs ADD COLUMN tenant_id UUID REFERENCES auth.users(id);
        RAISE NOTICE 'Added tenant_id column to programs table';
    ELSE
        RAISE NOTICE 'tenant_id column already exists in programs table';
    END IF;
END $$;

-- ============================================================
-- STEP 2: Backfill tenant_id from existing admin_profiles
-- This ensures existing programs are linked to their owners
-- ============================================================

UPDATE programs p
SET tenant_id = ap.id
FROM admin_profiles ap
WHERE p.id = ap.program_id
AND p.tenant_id IS NULL;

-- ============================================================
-- STEP 3: Add indexes for multi-program queries
-- ============================================================

-- Index for fast tenant_id lookups
CREATE INDEX IF NOT EXISTS idx_programs_tenant_id 
ON programs(tenant_id);

-- Composite index for protocol-specific queries per tenant
CREATE INDEX IF NOT EXISTS idx_programs_tenant_protocol 
ON programs(tenant_id, protocol);

-- ============================================================
-- STEP 4: Add unique constraint for tenant+passkit_program_id
-- Prevents duplicate PassKit programs within a tenant
-- ============================================================

-- Note: We allow same passkit_program_id across tenants (edge case)
-- but prevent duplicates within a single tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_tenant_passkit_program
ON programs(tenant_id, passkit_program_id)
WHERE passkit_program_id IS NOT NULL;

-- ============================================================
-- STEP 5: Add is_primary column for multi-program scenarios
-- ============================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'programs' AND column_name = 'is_primary'
    ) THEN
        ALTER TABLE programs ADD COLUMN is_primary BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_primary column to programs table';
    ELSE
        RAISE NOTICE 'is_primary column already exists in programs table';
    END IF;
END $$;

-- Set first program per tenant as primary
UPDATE programs p1
SET is_primary = true
FROM (
    SELECT DISTINCT ON (tenant_id) id, tenant_id
    FROM programs
    WHERE tenant_id IS NOT NULL
    ORDER BY tenant_id, created_at ASC
) p2
WHERE p1.id = p2.id AND p1.is_primary IS DISTINCT FROM true;

-- ============================================================
-- STEP 6: Create RPC function to get all programs for a tenant
-- ============================================================

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
        p.created_at
    FROM programs p
    WHERE p.tenant_id = p_tenant_id
    ORDER BY p.is_primary DESC, p.created_at ASC;
END;
$$;

-- ============================================================
-- STEP 7: Create RPC function to add program to existing tenant
-- ============================================================

CREATE OR REPLACE FUNCTION add_program_to_tenant(
    p_tenant_id UUID,
    p_name TEXT,
    p_protocol TEXT,
    p_passkit_program_id TEXT DEFAULT NULL,
    p_passkit_tier_id TEXT DEFAULT NULL,
    p_enrollment_url TEXT DEFAULT NULL,
    p_passkit_status TEXT DEFAULT 'skipped',
    p_timezone TEXT DEFAULT 'America/New_York',
    p_earn_rate_multiplier INTEGER DEFAULT 10
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_program_id UUID;
    v_dashboard_slug TEXT;
    v_is_first BOOLEAN;
BEGIN
    -- Generate unique dashboard slug
    v_dashboard_slug := encode(gen_random_bytes(8), 'hex');
    
    -- Check if this is the first program for this tenant
    SELECT NOT EXISTS (
        SELECT 1 FROM programs WHERE tenant_id = p_tenant_id
    ) INTO v_is_first;
    
    -- Insert new program
    INSERT INTO programs (
        tenant_id,
        name,
        protocol,
        passkit_program_id,
        passkit_tier_id,
        enrollment_url,
        passkit_status,
        dashboard_slug,
        timezone,
        earn_rate_multiplier,
        is_primary,
        created_at
    ) VALUES (
        p_tenant_id,
        p_name,
        p_protocol,
        p_passkit_program_id,
        p_passkit_tier_id,
        p_enrollment_url,
        p_passkit_status,
        v_dashboard_slug,
        p_timezone,
        p_earn_rate_multiplier,
        v_is_first,
        NOW()
    )
    RETURNING id INTO v_program_id;
    
    RETURN v_program_id;
END;
$$;

-- ============================================================
-- STEP 8: Create RPC function to set primary program
-- ============================================================

CREATE OR REPLACE FUNCTION set_primary_program(
    p_tenant_id UUID,
    p_program_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify the program belongs to this tenant
    IF NOT EXISTS (
        SELECT 1 FROM programs 
        WHERE id = p_program_id AND tenant_id = p_tenant_id
    ) THEN
        RAISE EXCEPTION 'Program does not belong to this tenant';
    END IF;
    
    -- Clear existing primary
    UPDATE programs 
    SET is_primary = false 
    WHERE tenant_id = p_tenant_id;
    
    -- Set new primary
    UPDATE programs 
    SET is_primary = true 
    WHERE id = p_program_id;
    
    RETURN true;
END;
$$;

-- ============================================================
-- STEP 9: Add Row Level Security for multi-program access
-- ============================================================

-- Ensure RLS is enabled on programs
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can view their own programs
DROP POLICY IF EXISTS "Tenants can view own programs" ON programs;
CREATE POLICY "Tenants can view own programs" ON programs
    FOR SELECT
    USING (
        tenant_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() 
            AND (role = 'SUPER_ADMIN' OR role = 'PLATFORM_ADMIN')
        )
    );

-- Policy: Tenants can update their own programs
DROP POLICY IF EXISTS "Tenants can update own programs" ON programs;
CREATE POLICY "Tenants can update own programs" ON programs
    FOR UPDATE
    USING (
        tenant_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() 
            AND (role = 'SUPER_ADMIN' OR role = 'PLATFORM_ADMIN')
        )
    );

-- Policy: Only admins can insert programs
DROP POLICY IF EXISTS "Admins can insert programs" ON programs;
CREATE POLICY "Admins can insert programs" ON programs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() 
            AND (role = 'SUPER_ADMIN' OR role = 'PLATFORM_ADMIN' OR role = 'CLIENT_ADMIN')
        )
    );

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
    AND column_name IN ('tenant_id', 'is_primary');
    
    IF v_count = 2 THEN
        RAISE NOTICE '✅ Migration 020 completed successfully';
        RAISE NOTICE '   - tenant_id column added';
        RAISE NOTICE '   - is_primary column added';
        RAISE NOTICE '   - RPC functions created';
        RAISE NOTICE '   - Indexes created';
        RAISE NOTICE '   - RLS policies updated';
    ELSE
        RAISE WARNING '⚠️ Migration may be incomplete. Check columns.';
    END IF;
END $$;
