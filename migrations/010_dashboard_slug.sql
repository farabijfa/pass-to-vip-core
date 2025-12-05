-- Migration 010: Add dashboard_slug column for unique client dashboard URLs
-- This enables each client to have a unique, shareable enrollment URL

-- Add dashboard_slug column to programs table
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS dashboard_slug TEXT UNIQUE;

COMMENT ON COLUMN programs.dashboard_slug IS 'Unique short-uuid slug for client dashboard/enrollment URL (e.g., /enroll/{slug})';

-- Create index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_programs_dashboard_slug ON programs(dashboard_slug);

-- Verify migration success
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'programs' 
        AND column_name = 'dashboard_slug'
    ) THEN
        RAISE NOTICE '✅ Migration 010: dashboard_slug column added successfully';
    ELSE
        RAISE EXCEPTION '❌ Migration 010 failed: dashboard_slug column not created';
    END IF;
END $$;
