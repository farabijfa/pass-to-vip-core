-- Performance Indexes for Multi-Tenant SaaS
-- Run this in Supabase Studio > SQL Editor
-- These indexes improve query speed as your client count grows

-- Index for filtering passes by program (critical for client isolation)
CREATE INDEX IF NOT EXISTS idx_passes_master_program_id 
ON passes_master(program_id);

-- Index for filtering passes by status (Active/Churned dashboard charts)
CREATE INDEX IF NOT EXISTS idx_passes_master_status 
ON passes_master(status);

-- Composite index for common query pattern: program + status together
CREATE INDEX IF NOT EXISTS idx_passes_master_program_status 
ON passes_master(program_id, status);

-- Index for customer transaction history lookups
CREATE INDEX IF NOT EXISTS idx_transactions_pass_id 
ON transactions(pass_id);

-- Index for sorting transactions by date
CREATE INDEX IF NOT EXISTS idx_transactions_created_at 
ON transactions(created_at DESC);

-- Index for admin login/profile lookups
CREATE INDEX IF NOT EXISTS idx_admin_profiles_user_id 
ON admin_profiles(id);

-- Verify indexes were created successfully
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('passes_master', 'transactions', 'admin_profiles')
ORDER BY tablename, indexname;
