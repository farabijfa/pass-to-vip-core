-- Migration 024: Add dynamic tier naming system to programs table
-- Allows programs to define custom tier names based on their use case:
-- LOYALTY: Bronze, Silver, Gold, Platinum
-- OFFICE: Member, Staff, Admin, Executive
-- GYM: Weekday, 7-Day, 24/7, Family
-- CUSTOM: User-defined tier names
-- NONE: No tier progression, just a single member label

-- Add tier system type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tier_system_type') THEN
        CREATE TYPE tier_system_type AS ENUM ('LOYALTY', 'OFFICE', 'GYM', 'CUSTOM', 'NONE');
    END IF;
END
$$;

-- Add tier naming columns to programs table
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS tier_system_type tier_system_type DEFAULT 'LOYALTY',
ADD COLUMN IF NOT EXISTS tier_1_name TEXT DEFAULT 'Bronze',
ADD COLUMN IF NOT EXISTS tier_2_name TEXT DEFAULT 'Silver',
ADD COLUMN IF NOT EXISTS tier_3_name TEXT DEFAULT 'Gold',
ADD COLUMN IF NOT EXISTS tier_4_name TEXT DEFAULT 'Platinum',
ADD COLUMN IF NOT EXISTS default_member_label TEXT DEFAULT 'Member';

-- Add comments for documentation
COMMENT ON COLUMN programs.tier_system_type IS 'Type of tier naming system: LOYALTY, OFFICE, GYM, CUSTOM, or NONE';
COMMENT ON COLUMN programs.tier_1_name IS 'Custom name for tier 1 (lowest tier)';
COMMENT ON COLUMN programs.tier_2_name IS 'Custom name for tier 2';
COMMENT ON COLUMN programs.tier_3_name IS 'Custom name for tier 3';
COMMENT ON COLUMN programs.tier_4_name IS 'Custom name for tier 4 (highest tier)';
COMMENT ON COLUMN programs.default_member_label IS 'Default label when tier system is NONE or member has no tier';
