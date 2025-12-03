-- =====================================================
-- Physical Bridge: Claim Code System for Phygital Loyalty
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Create the claim_codes table
CREATE TABLE IF NOT EXISTS claim_codes (
  id SERIAL PRIMARY KEY,
  claim_code VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'INSTALLED', 'EXPIRED', 'CANCELLED')),
  passkit_program_id VARCHAR(100) NOT NULL,
  passkit_install_url TEXT,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  address_line_1 VARCHAR(255),
  address_line_2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  postal_code VARCHAR(20),
  country VARCHAR(50) DEFAULT 'US',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  installed_at TIMESTAMPTZ,
  postcard_id VARCHAR(100)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_claim_codes_code ON claim_codes(claim_code);
CREATE INDEX IF NOT EXISTS idx_claim_codes_status ON claim_codes(status);

-- 2. Function to generate a unique claim code
CREATE OR REPLACE FUNCTION generate_claim_code(
  p_passkit_program_id VARCHAR,
  p_first_name VARCHAR DEFAULT NULL,
  p_last_name VARCHAR DEFAULT NULL,
  p_email VARCHAR DEFAULT NULL,
  p_address_line_1 VARCHAR DEFAULT NULL,
  p_address_line_2 VARCHAR DEFAULT NULL,
  p_city VARCHAR DEFAULT NULL,
  p_state VARCHAR DEFAULT NULL,
  p_postal_code VARCHAR DEFAULT NULL,
  p_country VARCHAR DEFAULT 'US'
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_claim_code VARCHAR(20);
  v_attempts INT := 0;
  v_max_attempts INT := 10;
BEGIN
  -- Generate a unique alphanumeric claim code
  LOOP
    v_claim_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM claim_codes WHERE claim_code = v_claim_code) THEN
      EXIT;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique claim code after % attempts', v_max_attempts;
    END IF;
  END LOOP;
  
  -- Insert the new claim code
  INSERT INTO claim_codes (
    claim_code,
    passkit_program_id,
    first_name,
    last_name,
    email,
    address_line_1,
    address_line_2,
    city,
    state,
    postal_code,
    country
  ) VALUES (
    v_claim_code,
    p_passkit_program_id,
    p_first_name,
    p_last_name,
    p_email,
    p_address_line_1,
    p_address_line_2,
    p_city,
    p_state,
    p_postal_code,
    p_country
  );
  
  RETURN JSON_BUILD_OBJECT('claim_code', v_claim_code);
END;
$$;

-- 3. Function to lookup a claim code
CREATE OR REPLACE FUNCTION lookup_claim_code(p_claim_code VARCHAR)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT JSON_BUILD_OBJECT(
    'claim_code', claim_code,
    'status', status,
    'passkit_program_id', passkit_program_id,
    'passkit_install_url', passkit_install_url,
    'first_name', first_name,
    'last_name', last_name,
    'email', email,
    'created_at', created_at,
    'installed_at', installed_at
  )
  INTO v_result
  FROM claim_codes
  WHERE claim_code = UPPER(p_claim_code);
  
  IF v_result IS NULL THEN
    RETURN JSON_BUILD_OBJECT('error', 'Claim code not found');
  END IF;
  
  RETURN v_result;
END;
$$;

-- 4. Function to update claim code status
CREATE OR REPLACE FUNCTION update_claim_code_status(
  p_claim_code VARCHAR,
  p_status VARCHAR,
  p_passkit_install_url VARCHAR DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INT;
BEGIN
  UPDATE claim_codes
  SET 
    status = p_status,
    passkit_install_url = COALESCE(p_passkit_install_url, passkit_install_url),
    installed_at = CASE WHEN p_status = 'INSTALLED' THEN NOW() ELSE installed_at END
  WHERE claim_code = UPPER(p_claim_code);
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count = 0 THEN
    RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Claim code not found');
  END IF;
  
  RETURN JSON_BUILD_OBJECT('success', true, 'updated', v_updated_count);
END;
$$;

-- 5. Grant permissions (adjust as needed for your setup)
GRANT EXECUTE ON FUNCTION generate_claim_code TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION lookup_claim_code TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_claim_code_status TO authenticated, anon, service_role;
GRANT ALL ON claim_codes TO authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE claim_codes_id_seq TO authenticated, anon, service_role;

-- Verify setup
SELECT 'Setup complete! Functions created:' as message;
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('generate_claim_code', 'lookup_claim_code', 'update_claim_code_status');
