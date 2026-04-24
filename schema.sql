CREATE TABLE IF NOT EXISTS tag_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  agent_zone TEXT NOT NULL DEFAULT '',
  epc TEXT NOT NULL,
  rssi INTEGER NOT NULL,
  avg_rssi REAL NOT NULL,
  pc INTEGER NOT NULL,
  distance REAL NOT NULL,
  proximity TEXT NOT NULL,
  read_count INTEGER NOT NULL,
  tag_last_seen TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tag_readings_epc_time ON tag_readings (epc, received_at);
CREATE INDEX IF NOT EXISTS idx_tag_readings_agent_time ON tag_readings (agent_id, received_at);

-- Current state of each tag per agent, updated on every ingest.
CREATE TABLE IF NOT EXISTS tag_snapshots (
  epc TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_zone TEXT NOT NULL DEFAULT '',
  rssi INTEGER NOT NULL,
  avg_rssi REAL NOT NULL,
  pc INTEGER NOT NULL,
  distance REAL NOT NULL,
  proximity TEXT NOT NULL,
  read_count INTEGER NOT NULL,
  tag_last_seen TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (epc, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_snapshots_agent ON tag_snapshots (agent_id, distance);

-- Tag roles: classify tags by EPC pattern
CREATE TABLE IF NOT EXISTS tag_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  patterns TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Zones: physical locations matching agent_zone codes
CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Assets: tracked items associated with RFID tags
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '{}',
  location_description TEXT NOT NULL DEFAULT '',
  attributes TEXT NOT NULL DEFAULT '{}',
  epc TEXT NOT NULL DEFAULT '',
  zone_id INTEGER REFERENCES zones(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- API keys for agent authentication
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys (key_prefix);

-- Users for frontend authentication
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Refresh tokens for JWT rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);
