export interface TagReading {
  epc: string;
  rssi: number;
  avg_rssi: number;
  pc: number;
  distance_m: number;
  zone: string;
  read_count: number;
  last_seen: string;
}

export interface TagSnapshot {
  agent_id: string;
  timestamp: string;
  tags: TagReading[];
}

export interface StoredTagReading {
  id: number;
  agent_id: string;
  epc: string;
  rssi: number;
  avg_rssi: number;
  pc: number;
  distance: number;
  zone: string;
  read_count: number;
  tag_last_seen: string;
  received_at: string;
}

export interface CurrentTagState {
  epc: string;
  agent_id: string;
  rssi: number;
  avg_rssi: number;
  pc: number;
  distance: number;
  zone: string;
  read_count: number;
  tag_last_seen: string;
  updated_at: string;
}

export interface Env {
  DB: D1Database;
  INGEST_TOKEN: string;
}
