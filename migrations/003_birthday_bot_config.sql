-- Migration: Birthday Bot Configuration
-- Run this in Supabase SQL Editor
-- Date: 2025-12-04

-- 1. Add Configuration Columns to Programs Table
-- Each program/tenant can have different birthday settings
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS birthday_bot_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS birthday_reward_points INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS birthday_message TEXT DEFAULT 'Happy Birthday! We added points to your pass.';

-- 2. Create Birthday Logs Table (Anti-Double-Gift Protection)
-- UNIQUE constraint makes it physically impossible to gift twice in the same year
CREATE TABLE IF NOT EXISTS birthday_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pass_id UUID NOT NULL REFERENCES passes_master(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    year INT NOT NULL,
    points_awarded INT NOT NULL,
    message_sent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pass_id, year)
);

-- 3. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_birthday_logs_year ON birthday_logs(year);
CREATE INDEX IF NOT EXISTS idx_birthday_logs_pass_program ON birthday_logs(pass_id, program_id);

-- 4. Enable a program for testing (optional - run if you want to test)
-- UPDATE programs 
-- SET birthday_bot_enabled = TRUE, 
--     birthday_reward_points = 50,
--     birthday_message = 'Happy Birthday! We added 50 points to your loyalty card.'
-- WHERE id = 'YOUR_PROGRAM_ID';

COMMENT ON TABLE birthday_logs IS 'Tracks birthday gifts to prevent duplicate awarding in same year';
COMMENT ON COLUMN programs.birthday_bot_enabled IS 'Whether this program auto-awards birthday points';
COMMENT ON COLUMN programs.birthday_reward_points IS 'Number of points to award on birthday';
COMMENT ON COLUMN programs.birthday_message IS 'Push notification message for birthday';
