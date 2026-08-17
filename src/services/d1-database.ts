import type {
  TagSnapshot,
  StoredTagReading,
  CurrentTagState,
  TagRole,
  Zone,
  Asset,
  ApiKey,
  User,
  UserWithPassword,
  Message,
  Reader,
  ReaderConfig,
  ReaderUpdateInput,
  ClaimStatusResult,
} from '../types';
import type { DatabaseService, AssetInput } from './database';
import { API_KEY_PREFIX_LENGTH } from './crypto';

const DEFAULT_MQTT_PORT = '1883';
const DEFAULT_TIMEZONE = 'CET-1CEST,M3.5.0/2,M10.5.0/3';

type RawTagRole = Omit<TagRole, 'patterns'> & { patterns: string };
type RawZone = Omit<Zone, 'location'> & { location: string };
type RawAsset = Omit<Asset, 'location' | 'attributes'> & { location: string; attributes: string };

function parseTagRole(r: RawTagRole): TagRole {
  return { ...r, patterns: JSON.parse(r.patterns) };
}

function parseZone(r: RawZone): Zone {
  return { ...r, location: JSON.parse(r.location) };
}

function parseAsset(r: RawAsset): Asset {
  return { ...r, location: JSON.parse(r.location), attributes: JSON.parse(r.attributes) };
}

export class D1DatabaseService implements DatabaseService {
  constructor(private db: D1Database) {}

  async storeSnapshot(snapshot: TagSnapshot, apiKey: ApiKey): Promise<number> {
    if (!snapshot.tags.length) return 0;

    const insertReading = this.db.prepare(
      `INSERT INTO tag_readings (
         agent_id, agent_zone, api_key_id, api_key_name,
         epc, rssi, avg_rssi, pc, distance, proximity, read_count, tag_last_seen
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const upsertSnapshot = this.db.prepare(
      `INSERT INTO tag_snapshots (
         epc, agent_id, agent_zone, api_key_id, api_key_name,
         rssi, avg_rssi, pc, distance, proximity, read_count, tag_last_seen, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (epc, agent_id) DO UPDATE SET
         agent_zone = excluded.agent_zone,
         api_key_id = excluded.api_key_id,
         api_key_name = excluded.api_key_name,
         rssi = excluded.rssi,
         avg_rssi = excluded.avg_rssi,
         pc = excluded.pc,
         distance = excluded.distance,
         proximity = excluded.proximity,
         read_count = excluded.read_count,
         tag_last_seen = excluded.tag_last_seen,
         updated_at = excluded.updated_at`
    );

    const batch = snapshot.tags.flatMap((tag) => [
      insertReading.bind(
        snapshot.agent_id,
        snapshot.agent_zone,
        apiKey.id,
        apiKey.name,
        tag.epc,
        tag.rssi,
        tag.avg_rssi,
        tag.pc,
        tag.distance_m,
        tag.proximity,
        tag.read_count,
        tag.last_seen
      ),
      upsertSnapshot.bind(
        tag.epc,
        snapshot.agent_id,
        snapshot.agent_zone,
        apiKey.id,
        apiKey.name,
        tag.rssi,
        tag.avg_rssi,
        tag.pc,
        tag.distance_m,
        tag.proximity,
        tag.read_count,
        tag.last_seen
      ),
    ]);

    await this.db.batch(batch);
    return snapshot.tags.length;
  }

  async getRecentByAgent(agentId: string, limit: number): Promise<StoredTagReading[]> {
    const result = await this.db
      .prepare('SELECT * FROM tag_readings WHERE agent_id = ? ORDER BY received_at DESC LIMIT ?')
      .bind(agentId, limit)
      .all<StoredTagReading>();
    return result.results;
  }

  async getRecentByEpc(epc: string, limit: number): Promise<StoredTagReading[]> {
    const result = await this.db
      .prepare('SELECT * FROM tag_readings WHERE epc = ? ORDER BY received_at DESC LIMIT ?')
      .bind(epc, limit)
      .all<StoredTagReading>();
    return result.results;
  }

  async getLatestPerTag(agentId: string): Promise<StoredTagReading[]> {
    const result = await this.db
      .prepare(
        `SELECT t.* FROM tag_readings t
         INNER JOIN (
           SELECT epc, MAX(received_at) as max_time
           FROM tag_readings WHERE agent_id = ?
           GROUP BY epc
         ) latest ON t.epc = latest.epc AND t.received_at = latest.max_time
         WHERE t.agent_id = ?
         ORDER BY t.distance ASC`
      )
      .bind(agentId, agentId)
      .all<StoredTagReading>();
    return result.results;
  }

  async getCurrentTags(agentId: string): Promise<CurrentTagState[]> {
    const result = await this.db
      .prepare('SELECT * FROM tag_snapshots WHERE agent_id = ? ORDER BY distance ASC')
      .bind(agentId)
      .all<CurrentTagState>();
    return result.results;
  }

  // --- Tag Roles ---

  async listTagRoles(): Promise<TagRole[]> {
    const result = await this.db.prepare('SELECT * FROM tag_roles ORDER BY name').all<RawTagRole>();
    return result.results.map(parseTagRole);
  }

  async createTagRole(name: string, patterns: string[]): Promise<TagRole> {
    const result = await this.db
      .prepare('INSERT INTO tag_roles (name, patterns) VALUES (?, ?) RETURNING *')
      .bind(name, JSON.stringify(patterns))
      .first<RawTagRole>();
    return parseTagRole(result!);
  }

  async updateTagRole(id: number, name: string, patterns: string[]): Promise<TagRole | null> {
    const result = await this.db
      .prepare('UPDATE tag_roles SET name = ?, patterns = ? WHERE id = ? RETURNING *')
      .bind(name, JSON.stringify(patterns), id)
      .first<RawTagRole>();
    return result ? parseTagRole(result) : null;
  }

  async deleteTagRole(id: number): Promise<void> {
    await this.db.prepare('DELETE FROM tag_roles WHERE id = ?').bind(id).run();
  }

  // --- Zones ---

  async listZones(): Promise<Zone[]> {
    const result = await this.db.prepare('SELECT * FROM zones ORDER BY name').all<RawZone>();
    return result.results.map(parseZone);
  }

  async createZone(name: string, code: string, location: Record<string, unknown>): Promise<Zone> {
    const result = await this.db
      .prepare('INSERT INTO zones (name, code, location) VALUES (?, ?, ?) RETURNING *')
      .bind(name, code, JSON.stringify(location))
      .first<RawZone>();
    return parseZone(result!);
  }

  async updateZone(id: number, name: string, code: string, location: Record<string, unknown>): Promise<Zone | null> {
    const result = await this.db
      .prepare('UPDATE zones SET name = ?, code = ?, location = ? WHERE id = ? RETURNING *')
      .bind(name, code, JSON.stringify(location), id)
      .first<RawZone>();
    return result ? parseZone(result) : null;
  }

  async deleteZone(id: number): Promise<void> {
    await this.db.prepare('DELETE FROM zones WHERE id = ?').bind(id).run();
  }

  // --- Assets ---

  async listAssets(): Promise<Asset[]> {
    const result = await this.db.prepare('SELECT * FROM assets ORDER BY name').all<RawAsset>();
    return result.results.map(parseAsset);
  }

  async createAsset(input: AssetInput): Promise<Asset> {
    const result = await this.db
      .prepare(
        `INSERT INTO assets (name, asset_type, location, location_description, attributes, epc, zone_id)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
      )
      .bind(
        input.name, input.asset_type, JSON.stringify(input.location),
        input.location_description, JSON.stringify(input.attributes), input.epc, input.zone_id
      )
      .first<RawAsset>();
    return parseAsset(result!);
  }

  async updateAsset(id: number, input: AssetInput): Promise<Asset | null> {
    const result = await this.db
      .prepare(
        `UPDATE assets SET name = ?, asset_type = ?, location = ?, location_description = ?,
         attributes = ?, epc = ?, zone_id = ?, updated_at = datetime('now')
         WHERE id = ? RETURNING *`
      )
      .bind(
        input.name, input.asset_type, JSON.stringify(input.location),
        input.location_description, JSON.stringify(input.attributes), input.epc, input.zone_id, id
      )
      .first<RawAsset>();
    return result ? parseAsset(result) : null;
  }

  async deleteAsset(id: number): Promise<void> {
    await this.db.prepare('DELETE FROM assets WHERE id = ?').bind(id).run();
  }

  // --- API Keys ---

  async getApiKeyByPrefix(prefix: string): Promise<(ApiKey & { key_hash: string }) | null> {
    return this.db
      .prepare('SELECT * FROM api_keys WHERE key_prefix = ?')
      .bind(prefix)
      .first<ApiKey & { key_hash: string }>();
  }

  async createApiKey(name: string, keyPrefix: string, keyHash: string, description: string, expiresAt: string | null): Promise<ApiKey> {
    const result = await this.db
      .prepare('INSERT INTO api_keys (name, key_prefix, key_hash, description, expires_at) VALUES (?, ?, ?, ?, ?) RETURNING id, name, key_prefix, description, expires_at, created_at, last_used_at')
      .bind(name, keyPrefix, keyHash, description, expiresAt)
      .first<ApiKey>();
    return result!;
  }

  async listApiKeys(): Promise<ApiKey[]> {
    const result = await this.db
      .prepare('SELECT id, name, key_prefix, description, expires_at, created_at, last_used_at FROM api_keys ORDER BY created_at DESC')
      .all<ApiKey>();
    return result.results;
  }

  async deleteApiKey(id: number): Promise<void> {
    await this.db.prepare('DELETE FROM api_keys WHERE id = ?').bind(id).run();
  }

  async touchApiKey(id: number): Promise<void> {
    await this.db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").bind(id).run();
  }

  // --- Users ---

  async createUser(name: string, email: string, passwordHash: string, role: string): Promise<User> {
    const result = await this.db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id, name, email, role, created_at, updated_at')
      .bind(name, email, passwordHash, role)
      .first<User>();
    return result!;
  }

  async getUserByEmail(email: string): Promise<UserWithPassword | null> {
    return this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first<UserWithPassword>();
  }

  async getUserById(id: number): Promise<User | null> {
    return this.db
      .prepare('SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?')
      .bind(id)
      .first<User>();
  }

  async listUsers(): Promise<User[]> {
    const result = await this.db
      .prepare('SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY name')
      .all<User>();
    return result.results;
  }

  async deleteUser(id: number): Promise<void> {
    await this.db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  }

  // --- Refresh Tokens ---

  async storeRefreshToken(userId: number, tokenHash: string, expiresAt: string): Promise<void> {
    await this.db
      .prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
      .bind(userId, tokenHash, expiresAt)
      .run();
  }

  async getRefreshToken(tokenHash: string): Promise<{ id: number; user_id: number; expires_at: string } | null> {
    return this.db
      .prepare('SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ?')
      .bind(tokenHash)
      .first<{ id: number; user_id: number; expires_at: string }>();
  }

  async deleteRefreshToken(id: number): Promise<void> {
    await this.db.prepare('DELETE FROM refresh_tokens WHERE id = ?').bind(id).run();
  }

  async deleteExpiredRefreshTokens(): Promise<void> {
    await this.db.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')").run();
  }

  // --- Messages ---

  async createMessage(name: string, email: string, content: string | null): Promise<Message> {
    const result = await this.db
      .prepare('INSERT INTO messages (name, email, content) VALUES (?, ?, ?) RETURNING *')
      .bind(name, email, content)
      .first<Message>();
    return result!;
  }

  async listMessages(): Promise<Message[]> {
    const result = await this.db
      .prepare('SELECT * FROM messages ORDER BY created_at DESC')
      .all<Message>();
    return result.results;
  }

  async getMessageById(id: number): Promise<Message | null> {
    return this.db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .bind(id)
      .first<Message>();
  }

  // --- Readers (RFID devices) ---

  async registerReaderClaimCode(hardwareId: string, claimCode: string): Promise<void> {
    const existing = await this.db
      .prepare('SELECT id FROM api_keys WHERE hardware_id = ?')
      .bind(hardwareId)
      .first<{ id: number }>();

    if (existing) {
      return;
    }

    await this.db
      .prepare(
        `INSERT INTO api_keys (name, key_prefix, key_hash, description, hardware_id, claim_code)
         VALUES (?, '', '', 'Unclaimed reader', ?, ?)`
      )
      .bind(`Reader ${hardwareId}`, hardwareId, claimCode)
      .run();
  }

  async claimReader(
    claimCode: string,
    zoneId: number,
    userId: number,
    apiKey: string,
    apiKeyHash: string
  ): Promise<ReaderConfig> {
    const reader = await this.db
      .prepare('SELECT * FROM api_keys WHERE claim_code = ? AND claimed_at IS NULL')
      .bind(claimCode)
      .first<ApiKey & { bootstrap_api_key?: string | null }>();

    if (!reader) {
      throw new Error('Invalid or already claimed code');
    }

    const zone = await this.db
      .prepare('SELECT code, name FROM zones WHERE id = ?')
      .bind(zoneId)
      .first<{ code: string; name: string }>();

    if (!zone) {
      throw new Error('Zone not found');
    }

    const keyPrefix = apiKey.substring(0, API_KEY_PREFIX_LENGTH);
    const deviceName = `Reader ${reader.hardware_id}`;
    const mqttServer = reader.mqtt_server ?? '';
    const mqttPort = reader.mqtt_port || DEFAULT_MQTT_PORT;
    const timezone = reader.timezone || DEFAULT_TIMEZONE;

    await this.db
      .prepare(
        `UPDATE api_keys SET
           name = ?,
           key_prefix = ?,
           key_hash = ?,
           zone_id = ?,
           claimed_at = datetime('now'),
           claimed_by_user_id = ?,
           description = ?,
           mqtt_server = ?,
           mqtt_port = ?,
           timezone = ?,
           bootstrap_api_key = ?
         WHERE id = ?`
      )
      .bind(
        deviceName,
        keyPrefix,
        apiKeyHash,
        zoneId,
        userId,
        `Claimed to zone: ${zone.name}`,
        mqttServer,
        mqttPort,
        timezone,
        apiKey,
        reader.id
      )
      .run();

    return {
      api_key: apiKey,
      zone_code: zone.code,
      device_name: deviceName,
      mqtt_server: mqttServer,
      mqtt_port: mqttPort,
      timezone,
    };
  }

  async getClaimStatus(hardwareId: string, claimCode: string): Promise<ClaimStatusResult | null> {
    const row = await this.db
      .prepare(
        `SELECT
           ak.id,
           ak.name,
           ak.claimed_at,
           ak.bootstrap_api_key,
           ak.mqtt_server,
           ak.mqtt_port,
           ak.timezone,
           z.code as zone_code
         FROM api_keys ak
         LEFT JOIN zones z ON ak.zone_id = z.id
         WHERE ak.hardware_id = ? AND ak.claim_code = ?`
      )
      .bind(hardwareId, claimCode)
      .first<{
        id: number;
        name: string;
        claimed_at: string | null;
        bootstrap_api_key: string | null;
        mqtt_server: string | null;
        mqtt_port: string | null;
        timezone: string | null;
        zone_code: string | null;
      }>();

    if (!row) {
      return null;
    }

    if (!row.claimed_at) {
      return { claimed: false, config: null };
    }

    if (!row.bootstrap_api_key) {
      return { claimed: true, config: null };
    }

    const config: ReaderConfig = {
      api_key: row.bootstrap_api_key,
      zone_code: row.zone_code || '',
      device_name: row.name,
      mqtt_server: row.mqtt_server ?? '',
      mqtt_port: row.mqtt_port || DEFAULT_MQTT_PORT,
      timezone: row.timezone || DEFAULT_TIMEZONE,
    };

    await this.db
      .prepare('UPDATE api_keys SET bootstrap_api_key = NULL WHERE id = ?')
      .bind(row.id)
      .run();

    return { claimed: true, config };
  }

  async getReaderByClaimCode(claimCode: string): Promise<ApiKey | null> {
    return this.db
      .prepare('SELECT * FROM api_keys WHERE claim_code = ?')
      .bind(claimCode)
      .first<ApiKey>();
  }

  async getReaderByHardwareId(hardwareId: string): Promise<ApiKey | null> {
    return this.db
      .prepare('SELECT * FROM api_keys WHERE hardware_id = ?')
      .bind(hardwareId)
      .first<ApiKey>();
  }

  async getReaderConfig(apiKeyId: number): Promise<ReaderConfig | null> {
    const result = await this.db
      .prepare(
        `SELECT
           ak.name,
           ak.mqtt_server,
           ak.mqtt_port,
           ak.timezone,
           z.code as zone_code
         FROM api_keys ak
         LEFT JOIN zones z ON ak.zone_id = z.id
         WHERE ak.id = ? AND ak.claimed_at IS NOT NULL`
      )
      .bind(apiKeyId)
      .first<{
        name: string;
        mqtt_server: string | null;
        mqtt_port: string | null;
        timezone: string | null;
        zone_code: string | null;
      }>();

    if (!result) {
      return null;
    }

    return {
      api_key: '',
      zone_code: result.zone_code || '',
      device_name: result.name,
      mqtt_server: result.mqtt_server ?? '',
      mqtt_port: result.mqtt_port || DEFAULT_MQTT_PORT,
      timezone: result.timezone || DEFAULT_TIMEZONE,
    };
  }

  async listReaders(): Promise<Reader[]> {
    const result = await this.db
      .prepare(
        `SELECT
           ak.id,
           ak.name,
           ak.hardware_id,
           ak.claim_code,
           ak.zone_id,
           z.name as zone_name,
           z.code as zone_code,
           ak.claimed_at,
           ak.claimed_by_user_id,
           ak.created_at,
           ak.mqtt_server,
           ak.mqtt_port,
           ak.timezone
         FROM api_keys ak
         LEFT JOIN zones z ON ak.zone_id = z.id
         WHERE ak.hardware_id IS NOT NULL
         ORDER BY ak.claimed_at DESC NULLS LAST, ak.created_at DESC`
      )
      .all<Reader>();
    return result.results;
  }

  async updateReader(id: number, input: ReaderUpdateInput): Promise<Reader | null> {
    const existing = await this.db
      .prepare(
        `SELECT id FROM api_keys
         WHERE id = ? AND hardware_id IS NOT NULL AND claimed_at IS NOT NULL`
      )
      .bind(id)
      .first<{ id: number }>();

    if (!existing) {
      return null;
    }

    const zone = await this.db
      .prepare('SELECT id, name FROM zones WHERE id = ?')
      .bind(input.zone_id)
      .first<{ id: number; name: string }>();

    if (!zone) {
      throw new Error('Zone not found');
    }

    const mqttServer = input.mqtt_server ?? '';
    const mqttPort = input.mqtt_port || DEFAULT_MQTT_PORT;
    const timezone = input.timezone || DEFAULT_TIMEZONE;

    await this.db
      .prepare(
        `UPDATE api_keys SET
           name = ?,
           zone_id = ?,
           mqtt_server = ?,
           mqtt_port = ?,
           timezone = ?,
           description = ?
         WHERE id = ?`
      )
      .bind(
        input.name,
        input.zone_id,
        mqttServer,
        mqttPort,
        timezone,
        `Claimed to zone: ${zone.name}`,
        id
      )
      .run();

    const updated = await this.db
      .prepare(
        `SELECT
           ak.id,
           ak.name,
           ak.hardware_id,
           ak.claim_code,
           ak.zone_id,
           z.name as zone_name,
           z.code as zone_code,
           ak.claimed_at,
           ak.claimed_by_user_id,
           ak.created_at,
           ak.mqtt_server,
           ak.mqtt_port,
           ak.timezone
         FROM api_keys ak
         LEFT JOIN zones z ON ak.zone_id = z.id
         WHERE ak.id = ?`
      )
      .bind(id)
      .first<Reader>();

    return updated ?? null;
  }
}

