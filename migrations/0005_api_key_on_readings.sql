-- Record which agent API key produced each ingest.

ALTER TABLE tag_readings ADD COLUMN api_key_id INTEGER;
ALTER TABLE tag_readings ADD COLUMN api_key_name TEXT NOT NULL DEFAULT '';

ALTER TABLE tag_snapshots ADD COLUMN api_key_id INTEGER;
ALTER TABLE tag_snapshots ADD COLUMN api_key_name TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_tag_readings_api_key ON tag_readings (api_key_id, received_at);
CREATE INDEX IF NOT EXISTS idx_tag_snapshots_api_key ON tag_snapshots (api_key_id);
