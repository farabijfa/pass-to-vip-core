-- Migration 029 Part 1: Backfill existing passes
-- Run this first to fix the immediate issue with passes not appearing

-- Backfill existing passes for Manali Bakes program
-- Set status=INSTALLED, is_active=true, protocol=MEMBERSHIP for all passes
UPDATE passes_master
SET 
  status = 'INSTALLED',
  is_active = true,
  protocol = 'MEMBERSHIP',
  last_updated = NOW()
WHERE program_id = '983af33b-5864-4115-abf3-2627781f5da1';

-- Also backfill VIP Rewards Demo program if it exists
UPDATE passes_master
SET 
  status = 'INSTALLED',
  is_active = true,
  protocol = 'MEMBERSHIP',
  last_updated = NOW()
WHERE program_id = 'e0ca8249-d5a6-4fd0-b930-f93c335d38b3';
