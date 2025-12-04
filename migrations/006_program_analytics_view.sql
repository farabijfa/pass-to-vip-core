-- Migration: 006_program_analytics_view.sql
-- Purpose: Create analytics view for program enrollment breakdown by source
-- Required for: WeWeb Client Dashboard (UI)
-- Author: Replit Agent
-- Date: 2024-12-04

-- Drop existing view if it exists (for safe re-run)
DROP VIEW IF EXISTS view_program_analytics;

-- Create the analytics view with enrollment source breakdown
-- This view provides:
--   - program_id: The internal program UUID
--   - enrollment_source: CSV, SMARTPASS, CLAIM_CODE, or UNKNOWN
--   - total_count: Total number of passes from this source
--   - active_count: Currently installed passes
--   - churned_count: Uninstalled passes (churn)
CREATE OR REPLACE VIEW view_program_analytics AS
SELECT 
  program_id,
  COALESCE(enrollment_source, 'UNKNOWN') AS enrollment_source,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE status = 'INSTALLED') AS active_count,
  COUNT(*) FILTER (WHERE status = 'UNINSTALLED') AS churned_count
FROM passes_master
GROUP BY program_id, COALESCE(enrollment_source, 'UNKNOWN')
ORDER BY program_id, enrollment_source;

-- Create summary view for totals per program
DROP VIEW IF EXISTS view_program_summary;

CREATE OR REPLACE VIEW view_program_summary AS
SELECT 
  program_id,
  COUNT(*) AS total_members,
  COUNT(*) FILTER (WHERE status = 'INSTALLED') AS active_members,
  COUNT(*) FILTER (WHERE status = 'UNINSTALLED') AS churned_members,
  COUNT(*) FILTER (WHERE enrollment_source = 'CSV') AS from_mail,
  COUNT(*) FILTER (WHERE enrollment_source = 'SMARTPASS') AS from_walkin,
  COUNT(*) FILTER (WHERE enrollment_source = 'CLAIM_CODE') AS from_claim_code
FROM passes_master
GROUP BY program_id;

-- Grant SELECT access to authenticated users (via RLS)
-- Note: Actual RLS policies should be configured in Supabase dashboard
COMMENT ON VIEW view_program_analytics IS 
  'Enrollment analytics broken down by source (CSV vs SMARTPASS vs CLAIM_CODE) for WeWeb dashboards';

COMMENT ON VIEW view_program_summary IS 
  'Summary statistics per program for WeWeb Client Dashboard';
