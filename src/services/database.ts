import type { TagSnapshot, StoredTagReading, CurrentTagState, TagRole, Zone, Asset } from '../types';

export interface AssetInput {
  name: string;
  asset_type: string;
  location: Record<string, unknown>;
  location_description: string;
  attributes: Record<string, unknown>;
  epc: string;
  zone_id: number | null;
}

export interface DatabaseService {
  storeSnapshot(snapshot: TagSnapshot): Promise<number>;
  getRecentByAgent(agentId: string, limit: number): Promise<StoredTagReading[]>;
  getRecentByEpc(epc: string, limit: number): Promise<StoredTagReading[]>;
  getLatestPerTag(agentId: string): Promise<StoredTagReading[]>;
  getCurrentTags(agentId: string): Promise<CurrentTagState[]>;

  listTagRoles(): Promise<TagRole[]>;
  createTagRole(name: string, patterns: string[]): Promise<TagRole>;
  updateTagRole(id: number, name: string, patterns: string[]): Promise<TagRole | null>;
  deleteTagRole(id: number): Promise<void>;

  listZones(): Promise<Zone[]>;
  createZone(name: string, code: string, location: Record<string, unknown>): Promise<Zone>;
  updateZone(id: number, name: string, code: string, location: Record<string, unknown>): Promise<Zone | null>;
  deleteZone(id: number): Promise<void>;

  listAssets(): Promise<Asset[]>;
  createAsset(input: AssetInput): Promise<Asset>;
  updateAsset(id: number, input: AssetInput): Promise<Asset | null>;
  deleteAsset(id: number): Promise<void>;
}
