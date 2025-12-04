-- Program Suspension Column
-- Run this in Supabase Studio > SQL Editor
-- Enables the "Kill Switch" to suspend client programs instantly

-- Add is_suspended column to programs table
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN programs.is_suspended IS 'When TRUE, all POS transactions for this program are blocked';

-- Create index for efficient suspension checks
CREATE INDEX IF NOT EXISTS idx_programs_is_suspended 
ON programs(is_suspended) 
WHERE is_suspended = true;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'programs' 
AND column_name = 'is_suspended';
