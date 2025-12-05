-- Migration 014: Make PassKit fields nullable for soft-fail provisioning
-- Allows client onboarding even when PassKit is unavailable

-- Make passkit_program_id nullable (for soft-fail when PassKit is down)
ALTER TABLE programs 
ALTER COLUMN passkit_program_id DROP NOT NULL;

-- Make passkit_tier_id nullable if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'programs' AND column_name = 'passkit_tier_id'
    ) THEN
        ALTER TABLE programs ALTER COLUMN passkit_tier_id DROP NOT NULL;
    END IF;
END $$;

-- Update any existing NULL values to empty string if needed (optional cleanup)
-- UPDATE programs SET passkit_program_id = '' WHERE passkit_program_id IS NULL;

-- Comments for documentation
COMMENT ON COLUMN programs.passkit_program_id IS 'PassKit program ID (nullable for soft-fail provisioning)';
