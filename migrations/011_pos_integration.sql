-- POS Integration Tables for External System Communication
-- Migration: 011_pos_integration.sql
-- Purpose: Enable production-ready POS webhook integration with API key auth and idempotency

-- Table: pos_api_keys
-- Stores hashed API keys for external POS system authentication
CREATE TABLE IF NOT EXISTS pos_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL DEFAULT 'Default POS Key',
  is_active BOOLEAN NOT NULL DEFAULT true,
  rate_limit_per_minute INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Index for fast key lookups
CREATE INDEX IF NOT EXISTS idx_pos_api_keys_hash ON pos_api_keys(key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pos_api_keys_program ON pos_api_keys(program_id);

-- Table: pos_transactions
-- Transaction log with idempotency support to prevent duplicate processing
CREATE TABLE IF NOT EXISTS pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(255),
  action VARCHAR(20) NOT NULL CHECK (action IN ('LOOKUP', 'EARN', 'REDEEM', 'ADJUST')),
  external_id VARCHAR(100) NOT NULL,
  points INTEGER DEFAULT 0,
  previous_balance INTEGER,
  new_balance INTEGER,
  response_body JSONB,
  status VARCHAR(20) DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
  error_message TEXT,
  api_key_id UUID REFERENCES pos_api_keys(id),
  source_ip VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for idempotency - program + key combination must be unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_transactions_idempotency 
ON pos_transactions(program_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Index for transaction lookups
CREATE INDEX IF NOT EXISTS idx_pos_transactions_program ON pos_transactions(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_external_id ON pos_transactions(external_id, created_at DESC);

-- RLS Policies
ALTER TABLE pos_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;

-- Service role can manage API keys
CREATE POLICY "Service role can manage pos_api_keys" ON pos_api_keys
  FOR ALL USING (true);

-- Service role can manage transactions
CREATE POLICY "Service role can manage pos_transactions" ON pos_transactions
  FOR ALL USING (true);

-- Comments for documentation
COMMENT ON TABLE pos_api_keys IS 'API keys for external POS system authentication';
COMMENT ON TABLE pos_transactions IS 'POS transaction log with idempotency support';
COMMENT ON COLUMN pos_api_keys.key_hash IS 'SHA-256 hash of the actual API key';
COMMENT ON COLUMN pos_transactions.idempotency_key IS 'Client-provided key to prevent duplicate transactions';
