import type { TagSnapshot, StoredTagReading, CurrentTagState, TagRole, Zone, Asset, ApiKey, User, UserWithPassword } from '../types';

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

  // API keys
  getApiKeyByPrefix(prefix: string): Promise<(ApiKey & { key_hash: string }) | null>;
  createApiKey(name: string, keyPrefix: string, keyHash: string, description: string, expiresAt: string | null): Promise<ApiKey>;
  listApiKeys(): Promise<ApiKey[]>;
  deleteApiKey(id: number): Promise<void>;
  touchApiKey(id: number): Promise<void>;

  // Users
  createUser(name: string, email: string, passwordHash: string, role: string): Promise<User>;
  getUserByEmail(email: string): Promise<UserWithPassword | null>;
  getUserById(id: number): Promise<User | null>;
  listUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<void>;

  // Refresh tokens
  storeRefreshToken(userId: number, tokenHash: string, expiresAt: string): Promise<void>;
  getRefreshToken(tokenHash: string): Promise<{ id: number; user_id: number; expires_at: string } | null>;
  deleteRefreshToken(id: number): Promise<void>;
  deleteExpiredRefreshTokens(): Promise<void>;
}
