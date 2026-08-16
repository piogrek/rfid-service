-- Add reader claiming support to api_keys table
ALTER TABLE api_keys ADD COLUMN hardware_id TEXT;
ALTER TABLE api_keys ADD COLUMN claim_code TEXT;
ALTER TABLE api_keys ADD COLUMN zone_id INTEGER REFERENCES zones(id);
ALTER TABLE api_keys ADD COLUMN claimed_at TEXT;
ALTER TABLE api_keys ADD COLUMN claimed_by_user_id INTEGER REFERENCES users(id);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_hardware_id ON api_keys (hardware_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_claim_code ON api_keys (claim_code);
CREATE INDEX IF NOT EXISTS idx_api_keys_zone_id ON api_keys (zone_id);
