-- Rename proximity column (was 'zone') in both tables
ALTER TABLE tag_readings RENAME COLUMN zone TO proximity;
ALTER TABLE tag_snapshots RENAME COLUMN zone TO proximity;

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
