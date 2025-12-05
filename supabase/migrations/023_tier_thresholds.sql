-- Migration: Add Tier Threshold Configuration for MEMBERSHIP Programs
-- Enables protocol-aware notification segmentation with configurable tiers
-- Version: 023
-- Date: 2024-12-05

-- ============================================================
-- STEP 1: Add tier threshold columns to programs table
-- These define points boundaries for Bronze/Silver/Gold/Platinum
-- Only applicable to MEMBERSHIP protocol programs
-- ============================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'programs' AND column_name = 'tier_bronze_max'
    ) THEN
        ALTER TABLE programs ADD COLUMN tier_bronze_max INTEGER DEFAULT 999;
        RAISE NOTICE 'Added tier_bronze_max column (default: 999 points)';
    ELSE
        RAISE NOTICE 'tier_bronze_max column already exists';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'programs' AND column_name = 'tier_silver_max'
    ) THEN
        ALTER TABLE programs ADD COLUMN tier_silver_max INTEGER DEFAULT 4999;
        RAISE NOTICE 'Added tier_silver_max column (default: 4999 points)';
    ELSE
        RAISE NOTICE 'tier_silver_max column already exists';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'programs' AND column_name = 'tier_gold_max'
    ) THEN
        ALTER TABLE programs ADD COLUMN tier_gold_max INTEGER DEFAULT 14999;
        RAISE NOTICE 'Added tier_gold_max column (default: 14999 points)';
    ELSE
        RAISE NOTICE 'tier_gold_max column already exists';
    END IF;
END $$;

-- ============================================================
-- STEP 2: Update get_tenant_programs RPC to include tier thresholds
-- Must DROP first because return type is changing
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
    tier_bronze_max INTEGER,
    tier_silver_max INTEGER,
    tier_gold_max INTEGER,
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
        COALESCE(p.tier_bronze_max, 999),
        COALESCE(p.tier_silver_max, 4999),
        COALESCE(p.tier_gold_max, 14999),
        p.created_at
    FROM programs p
    WHERE p.tenant_id = p_tenant_id
    ORDER BY p.is_primary DESC, p.created_at ASC;
END;
$$;

-- ============================================================
-- STEP 3: Create RPC for protocol-aware segment counts
-- Optimized for notification preview without heavy in-app processing
-- ============================================================

CREATE OR REPLACE FUNCTION get_segment_counts(
    p_program_id UUID,
    p_protocol TEXT
)
RETURNS TABLE (
    segment_type TEXT,
    member_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bronze_max INTEGER;
    v_silver_max INTEGER;
    v_gold_max INTEGER;
BEGIN
    -- Get tier thresholds for this program
    SELECT 
        COALESCE(tier_bronze_max, 999),
        COALESCE(tier_silver_max, 4999),
        COALESCE(tier_gold_max, 14999)
    INTO v_bronze_max, v_silver_max, v_gold_max
    FROM programs WHERE id = p_program_id;

    IF p_protocol = 'MEMBERSHIP' THEN
        RETURN QUERY
        SELECT 'ALL'::TEXT, COUNT(*)
        FROM passes_master pm
        WHERE pm.program_id = p_program_id
          AND pm.status = 'INSTALLED'
          AND pm.is_active = true
        UNION ALL
        SELECT 'TIER_BRONZE'::TEXT, COUNT(*)
        FROM passes_master pm
        JOIN protocol_membership m ON pm.id = m.pass_id
        WHERE pm.program_id = p_program_id
          AND pm.status = 'INSTALLED'
          AND pm.is_active = true
          AND m.tier_points <= v_bronze_max
        UNION ALL
        SELECT 'TIER_SILVER'::TEXT, COUNT(*)
        FROM passes_master pm
        JOIN protocol_membership m ON pm.id = m.pass_id
        WHERE pm.program_id = p_program_id
          AND pm.status = 'INSTALLED'
          AND pm.is_active = true
          AND m.tier_points > v_bronze_max
          AND m.tier_points <= v_silver_max
        UNION ALL
        SELECT 'TIER_GOLD'::TEXT, COUNT(*)
        FROM passes_master pm
        JOIN protocol_membership m ON pm.id = m.pass_id
        WHERE pm.program_id = p_program_id
          AND pm.status = 'INSTALLED'
          AND pm.is_active = true
          AND m.tier_points > v_silver_max
          AND m.tier_points <= v_gold_max
        UNION ALL
        SELECT 'TIER_PLATINUM'::TEXT, COUNT(*)
        FROM passes_master pm
        JOIN protocol_membership m ON pm.id = m.pass_id
        WHERE pm.program_id = p_program_id
          AND pm.status = 'INSTALLED'
          AND pm.is_active = true
          AND m.tier_points > v_gold_max
        UNION ALL
        SELECT 'VIP'::TEXT, COUNT(*)
        FROM passes_master pm
        JOIN protocol_membership m ON pm.id = m.pass_id
        WHERE pm.program_id = p_program_id
          AND pm.status = 'INSTALLED'
          AND pm.is_active = true
          AND m.points_balance >= 500
        UNION ALL
        SELECT 'DORMANT'::TEXT, COUNT(*)
        FROM passes_master pm
        WHERE pm.program_id = p_program_id
          AND pm.status = 'INSTALLED'
          AND pm.is_active = true
          AND pm.last_updated < NOW() - INTERVAL '30 days';
          
    ELSIF p_protocol = 'COUPON' THEN
        RETURN QUERY
        SELECT 'ALL_ACTIVE'::TEXT, COUNT(*)
        FROM passes_master pm
        JOIN protocol_coupon c ON pm.id = c.pass_id
        WHERE pm.program_id = p_program_id
          AND pm.status = 'INSTALLED'
          AND pm.is_active = true
          AND c.redeemed_at IS NULL
        UNION ALL
        SELECT 'UNREDEEMED'::TEXT, COUNT(*)
        FROM passes_master pm
        JOIN protocol_coupon c ON pm.id = c.pass_id
        WHERE pm.program_id = p_program_id
          AND pm.status = 'INSTALLED'
          AND pm.is_active = true
          AND c.redeemed_at IS NULL
        UNION ALL
        SELECT 'EXPIRING_SOON'::TEXT, COUNT(*)
        FROM passes_master pm
        JOIN protocol_coupon c ON pm.id = c.pass_id
        WHERE pm.program_id = p_program_id
          AND pm.status = 'INSTALLED'
          AND pm.is_active = true
          AND c.redeemed_at IS NULL
          AND c.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days';
          
    ELSIF p_protocol = 'EVENT_TICKET' THEN
        RETURN QUERY
        SELECT 'ALL_TICKETED'::TEXT, COUNT(*)
        FROM passes_master pm
        JOIN protocol_event_ticket t ON pm.id = t.pass_id
        WHERE pm.program_id = p_program_id
          AND pm.status = 'INSTALLED'
          AND pm.is_active = true
        UNION ALL
        SELECT 'NOT_CHECKED_IN'::TEXT, COUNT(*)
        FROM passes_master pm
        JOIN protocol_event_ticket t ON pm.id = t.pass_id
        WHERE pm.program_id = p_program_id
          AND pm.status = 'INSTALLED'
          AND pm.is_active = true
          AND t.checked_in_at IS NULL
        UNION ALL
        SELECT 'CHECKED_IN'::TEXT, COUNT(*)
        FROM passes_master pm
        JOIN protocol_event_ticket t ON pm.id = t.pass_id
        WHERE pm.program_id = p_program_id
          AND pm.status = 'INSTALLED'
          AND pm.is_active = true
          AND t.checked_in_at IS NOT NULL;
    END IF;
END;
$$;

-- ============================================================
-- STEP 4: Create RPC for getting segment members with filters
-- Returns sample members for preview (limit 10 by default)
-- ============================================================

CREATE OR REPLACE FUNCTION get_segment_members(
    p_program_id UUID,
    p_protocol TEXT,
    p_segment TEXT,
    p_limit INTEGER DEFAULT 10,
    p_vip_threshold INTEGER DEFAULT 500,
    p_dormant_days INTEGER DEFAULT 30,
    p_zip_codes TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    pass_id UUID,
    external_id TEXT,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    zip TEXT,
    points_balance INTEGER,
    tier_points INTEGER,
    last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bronze_max INTEGER;
    v_silver_max INTEGER;
    v_gold_max INTEGER;
BEGIN
    -- Get tier thresholds
    SELECT 
        COALESCE(tier_bronze_max, 999),
        COALESCE(tier_silver_max, 4999),
        COALESCE(tier_gold_max, 14999)
    INTO v_bronze_max, v_silver_max, v_gold_max
    FROM programs WHERE id = p_program_id;

    IF p_protocol = 'MEMBERSHIP' THEN
        IF p_segment = 'ALL' THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   m.points_balance, m.tier_points, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_membership m ON pm.id = m.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
            ORDER BY pm.last_updated DESC LIMIT p_limit;
            
        ELSIF p_segment = 'TIER_BRONZE' THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   m.points_balance, m.tier_points, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_membership m ON pm.id = m.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
              AND m.tier_points <= v_bronze_max
            ORDER BY m.tier_points DESC LIMIT p_limit;
            
        ELSIF p_segment = 'TIER_SILVER' THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   m.points_balance, m.tier_points, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_membership m ON pm.id = m.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
              AND m.tier_points > v_bronze_max
              AND m.tier_points <= v_silver_max
            ORDER BY m.tier_points DESC LIMIT p_limit;
            
        ELSIF p_segment = 'TIER_GOLD' THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   m.points_balance, m.tier_points, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_membership m ON pm.id = m.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
              AND m.tier_points > v_silver_max
              AND m.tier_points <= v_gold_max
            ORDER BY m.tier_points DESC LIMIT p_limit;
            
        ELSIF p_segment = 'TIER_PLATINUM' THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   m.points_balance, m.tier_points, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_membership m ON pm.id = m.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
              AND m.tier_points > v_gold_max
            ORDER BY m.tier_points DESC LIMIT p_limit;
            
        ELSIF p_segment = 'VIP' THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   m.points_balance, m.tier_points, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_membership m ON pm.id = m.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
              AND m.points_balance >= p_vip_threshold
            ORDER BY m.points_balance DESC LIMIT p_limit;
            
        ELSIF p_segment = 'DORMANT' THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   m.points_balance, m.tier_points, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_membership m ON pm.id = m.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
              AND pm.last_updated < NOW() - (p_dormant_days || ' days')::INTERVAL
            ORDER BY pm.last_updated ASC LIMIT p_limit;
            
        ELSIF p_segment = 'GEO' AND p_zip_codes IS NOT NULL THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   m.points_balance, m.tier_points, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_membership m ON pm.id = m.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
              AND u.zip = ANY(p_zip_codes)
            ORDER BY u.zip LIMIT p_limit;
        END IF;
        
    ELSIF p_protocol = 'COUPON' THEN
        IF p_segment IN ('ALL_ACTIVE', 'UNREDEEMED') THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   0::INTEGER, 0::INTEGER, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_coupon c ON pm.id = c.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
              AND c.redeemed_at IS NULL
            ORDER BY pm.last_updated DESC LIMIT p_limit;
            
        ELSIF p_segment = 'EXPIRING_SOON' THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   0::INTEGER, 0::INTEGER, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_coupon c ON pm.id = c.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
              AND c.redeemed_at IS NULL
              AND c.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
            ORDER BY c.expiry_date ASC LIMIT p_limit;
            
        ELSIF p_segment = 'GEO' AND p_zip_codes IS NOT NULL THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   0::INTEGER, 0::INTEGER, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_coupon c ON pm.id = c.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
              AND c.redeemed_at IS NULL
              AND u.zip = ANY(p_zip_codes)
            ORDER BY u.zip LIMIT p_limit;
        END IF;
        
    ELSIF p_protocol = 'EVENT_TICKET' THEN
        IF p_segment = 'ALL_TICKETED' THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   0::INTEGER, 0::INTEGER, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_event_ticket t ON pm.id = t.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
            ORDER BY pm.last_updated DESC LIMIT p_limit;
            
        ELSIF p_segment = 'NOT_CHECKED_IN' THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   0::INTEGER, 0::INTEGER, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_event_ticket t ON pm.id = t.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
              AND t.checked_in_at IS NULL
            ORDER BY pm.last_updated DESC LIMIT p_limit;
            
        ELSIF p_segment = 'CHECKED_IN' THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   0::INTEGER, 0::INTEGER, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_event_ticket t ON pm.id = t.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
              AND t.checked_in_at IS NOT NULL
            ORDER BY t.checked_in_at DESC LIMIT p_limit;
            
        ELSIF p_segment = 'GEO' AND p_zip_codes IS NOT NULL THEN
            RETURN QUERY
            SELECT pm.id, pm.external_id, u.email, u.first_name, u.last_name, u.zip,
                   0::INTEGER, 0::INTEGER, pm.last_updated
            FROM passes_master pm
            JOIN users u ON pm.user_id = u.id
            JOIN protocol_event_ticket t ON pm.id = t.pass_id
            WHERE pm.program_id = p_program_id
              AND pm.status = 'INSTALLED' AND pm.is_active = true
              AND u.zip = ANY(p_zip_codes)
            ORDER BY u.zip LIMIT p_limit;
        END IF;
    END IF;
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
    AND column_name IN ('tier_bronze_max', 'tier_silver_max', 'tier_gold_max');
    
    IF v_count = 3 THEN
        RAISE NOTICE '✅ Migration 023 completed successfully';
        RAISE NOTICE '   - tier_bronze_max column added (default: 999)';
        RAISE NOTICE '   - tier_silver_max column added (default: 4999)';
        RAISE NOTICE '   - tier_gold_max column added (default: 14999)';
        RAISE NOTICE '   - get_tenant_programs RPC updated with tier thresholds';
        RAISE NOTICE '   - get_segment_counts RPC created';
        RAISE NOTICE '   - get_segment_members RPC created';
    ELSE
        RAISE WARNING '⚠️ Migration may be incomplete. Check columns.';
    END IF;
END $$;
