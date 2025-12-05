-- Migration 019: Campaign Tracking System
-- Adds campaign_runs and campaign_contacts tables for full campaign lifecycle tracking

-- Campaign runs table - tracks each campaign launch
CREATE TABLE IF NOT EXISTS campaign_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id TEXT NOT NULL,
  client_id TEXT,
  
  -- Campaign configuration
  resource_type TEXT NOT NULL CHECK (resource_type IN ('postcard', 'letter')),
  size TEXT CHECK (size IN ('4x6', '6x4', '6x9', '9x6', '6x11', '11x6', 'us_letter', 'us_legal', 'a4')),
  mailing_class TEXT CHECK (mailing_class IN ('standard_class', 'first_class')) DEFAULT 'standard_class',
  
  -- Template configuration
  template_id TEXT,
  front_template_id TEXT,
  back_template_id TEXT,
  
  -- PassKit integration
  protocol TEXT CHECK (protocol IN ('MEMBERSHIP', 'COUPON', 'EVENT_TICKET')),
  passkit_campaign_id TEXT,
  passkit_offer_id TEXT,
  
  -- Campaign metadata
  description TEXT,
  name TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- Statistics
  total_contacts INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Cost tracking
  estimated_cost_cents INTEGER,
  actual_cost_cents INTEGER,
  
  -- Audit fields
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Campaign contacts table - per-contact tracking
CREATE TABLE IF NOT EXISTS campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_run_id UUID NOT NULL REFERENCES campaign_runs(id) ON DELETE CASCADE,
  
  -- Contact information
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT DEFAULT 'US',
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed', 'cancelled')),
  error_message TEXT,
  
  -- PostGrid tracking
  postgrid_mail_id TEXT,
  postgrid_status TEXT,
  estimated_delivery_date TIMESTAMPTZ,
  
  -- PassKit tracking
  claim_code TEXT,
  claim_url TEXT,
  passkit_pass_id TEXT,
  passkit_status TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_runs_program_id ON campaign_runs(program_id);
CREATE INDEX IF NOT EXISTS idx_campaign_runs_status ON campaign_runs(status);
CREATE INDEX IF NOT EXISTS idx_campaign_runs_created_at ON campaign_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_run_id ON campaign_contacts(campaign_run_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_claim_code ON campaign_contacts(claim_code);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_postgrid_mail_id ON campaign_contacts(postgrid_mail_id);

-- RLS policies for multi-tenant isolation
ALTER TABLE campaign_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (makes migration idempotent/safe to re-run)
DROP POLICY IF EXISTS "service_role_full_access_campaign_runs" ON campaign_runs;
DROP POLICY IF EXISTS "service_role_full_access_campaign_contacts" ON campaign_contacts;
DROP POLICY IF EXISTS "anon_no_access_campaign_runs" ON campaign_runs;
DROP POLICY IF EXISTS "anon_no_access_campaign_contacts" ON campaign_contacts;

-- Service role has full access
CREATE POLICY "service_role_full_access_campaign_runs" ON campaign_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access_campaign_contacts" ON campaign_contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Block anon access
CREATE POLICY "anon_no_access_campaign_runs" ON campaign_runs
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "anon_no_access_campaign_contacts" ON campaign_contacts
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- Comments for documentation
COMMENT ON TABLE campaign_runs IS 'Tracks direct mail campaign launches with PostGrid and PassKit integration';
COMMENT ON TABLE campaign_contacts IS 'Per-contact tracking for campaign mail pieces and wallet passes';
COMMENT ON COLUMN campaign_runs.protocol IS 'PassKit protocol: MEMBERSHIP for loyalty cards, COUPON for offers, EVENT_TICKET for events';
COMMENT ON COLUMN campaign_runs.mailing_class IS 'PostGrid mailing speed: standard_class (3-14 days) or first_class (2-5 days)';
COMMENT ON COLUMN campaign_contacts.claim_code IS 'Unique code for wallet pass enrollment via physical mail QR code';
