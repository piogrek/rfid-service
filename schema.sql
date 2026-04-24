CREATE TABLE IF NOT EXISTS tag_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  agent_zone TEXT NOT NULL DEFAULT '',
  epc TEXT NOT NULL,
  rssi INTEGER NOT NULL,
  avg_rssi REAL NOT NULL,
  pc INTEGER NOT NULL,
  distance REAL NOT NULL,
  zone TEXT NOT NULL,
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
  zone TEXT NOT NULL,
  read_count INTEGER NOT NULL,
  tag_last_seen TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (epc, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_snapshots_agent ON tag_snapshots (agent_id, distance);
