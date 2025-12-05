-- Migration 013: Add PassKit status tracking columns
-- Enables tracking of PassKit provisioning status for soft-fail approach

-- Add passkit_status column to track provisioning state
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS passkit_status VARCHAR(20) DEFAULT 'skipped';

-- Add timezone column for PassKit tier configuration
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';

-- Add constraint for valid status values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'programs_passkit_status_check'
    ) THEN
        ALTER TABLE programs 
        ADD CONSTRAINT programs_passkit_status_check 
        CHECK (passkit_status IN ('provisioned', 'manual_required', 'skipped', 'pending'));
    END IF;
END $$;

-- Create index for quick lookup of programs needing manual setup
CREATE INDEX IF NOT EXISTS idx_programs_passkit_status 
ON programs(passkit_status) 
WHERE passkit_status = 'manual_required';

-- Comment for documentation
COMMENT ON COLUMN programs.passkit_status IS 'PassKit provisioning status: provisioned, manual_required, skipped, pending';
COMMENT ON COLUMN programs.timezone IS 'Timezone for PassKit tier (IANA format, e.g. America/New_York)';
