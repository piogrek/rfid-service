export interface TagReading {
  epc: string;
  rssi: number;
  avg_rssi: number;
  pc: number;
  distance_m: number;
  proximity: string;
  read_count: number;
  last_seen: string;
}

export interface TagSnapshot {
  agent_id: string;
  agent_zone: string;
  timestamp: string;
  tags: TagReading[];
}

export interface StoredTagReading {
  id: number;
  agent_id: string;
  agent_zone: string;
  /** API key that authenticated the ingest (reader credentials). */
  api_key_id: number | null;
  /** Display name of that API key (reader name). */
  api_key_name: string;
  epc: string;
  rssi: number;
  avg_rssi: number;
  pc: number;
  distance: number;
  proximity: string;
  read_count: number;
  tag_last_seen: string;
  received_at: string;
}

export interface CurrentTagState {
  epc: string;
  agent_id: string;
  agent_zone: string;
  api_key_id: number | null;
  api_key_name: string;
  rssi: number;
  avg_rssi: number;
  pc: number;
  distance: number;
  proximity: string;
  read_count: number;
  tag_last_seen: string;
  updated_at: string;
}

export interface TagRole {
  id: number;
  name: string;
  patterns: string[];
  created_at: string;
}

export interface Zone {
  id: number;
  name: string;
  code: string;
  location: Record<string, unknown>;
  created_at: string;
}

export interface Asset {
  id: number;
  name: string;
  asset_type: string;
  location: Record<string, unknown>;
  location_description: string;
  attributes: Record<string, unknown>;
  epc: string;
  zone_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  description: string;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  hardware_id: string | null;
  claim_code: string | null;
  zone_id: number | null;
  claimed_at: string | null;
  claimed_by_user_id: number | null;
  mqtt_server: string | null;
  mqtt_port: string | null;
  timezone: string | null;
}

export interface Reader {
  id: number;
  name: string;
  hardware_id: string;
  claim_code: string | null;
  zone_id: number | null;
  zone_name: string | null;
  zone_code: string | null;
  claimed_at: string | null;
  claimed_by_user_id: number | null;
  created_at: string;
  mqtt_server: string | null;
  mqtt_port: string | null;
  timezone: string | null;
}

/** Device-facing config. api_key is only set on one-time claim bootstrap. */
export interface ReaderConfig {
  api_key: string;
  zone_code: string;
  device_name: string;
  mqtt_server: string;
  mqtt_port: string;
  timezone: string;
}

export interface ReaderUpdateInput {
  name: string;
  zone_id: number;
  mqtt_server?: string | null;
  mqtt_port?: string | null;
  timezone?: string | null;
}

export interface ClaimStatusResult {
  claimed: boolean;
  config: ReaderConfig | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

export interface Message {
  id: number;
  name: string;
  email: string;
  content: string | null;
  created_at: string;
  updated_at: string;
}

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  TURNSTILE_SECRET: string;
  PORTAL_ORIGINS: string;
}
