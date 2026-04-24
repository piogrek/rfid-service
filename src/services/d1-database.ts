import type { TagSnapshot, StoredTagReading, CurrentTagState, TagRole, Zone, Asset } from '../types';
import type { DatabaseService, AssetInput } from './database';

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

  async storeSnapshot(snapshot: TagSnapshot): Promise<number> {
    if (!snapshot.tags.length) return 0;

    const insertReading = this.db.prepare(
      `INSERT INTO tag_readings (agent_id, agent_zone, epc, rssi, avg_rssi, pc, distance, proximity, read_count, tag_last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const upsertSnapshot = this.db.prepare(
      `INSERT INTO tag_snapshots (epc, agent_id, agent_zone, rssi, avg_rssi, pc, distance, proximity, read_count, tag_last_seen, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (epc, agent_id) DO UPDATE SET
         agent_zone = excluded.agent_zone,
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
        snapshot.agent_id, snapshot.agent_zone, tag.epc, tag.rssi, tag.avg_rssi, tag.pc,
        tag.distance_m, tag.proximity, tag.read_count, tag.last_seen
      ),
      upsertSnapshot.bind(
        tag.epc, snapshot.agent_id, snapshot.agent_zone, tag.rssi, tag.avg_rssi, tag.pc,
        tag.distance_m, tag.proximity, tag.read_count, tag.last_seen
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
}
