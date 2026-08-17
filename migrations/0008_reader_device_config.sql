-- Cloud-managed reader device config + one-time claim bootstrap secret
ALTER TABLE api_keys ADD COLUMN mqtt_server TEXT;
ALTER TABLE api_keys ADD COLUMN mqtt_port TEXT DEFAULT '1883';
ALTER TABLE api_keys ADD COLUMN timezone TEXT DEFAULT 'CET-1CEST,M3.5.0/2,M10.5.0/3';
ALTER TABLE api_keys ADD COLUMN bootstrap_api_key TEXT;
