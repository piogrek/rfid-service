import type { TagSnapshot, StoredTagReading, CurrentTagState } from '../types';
import type { DatabaseService } from './database';

export class D1DatabaseService implements DatabaseService {
  constructor(private db: D1Database) {}

  async storeSnapshot(snapshot: TagSnapshot): Promise<number> {
    if (!snapshot.tags.length) return 0;

    const insertReading = this.db.prepare(
      `INSERT INTO tag_readings (agent_id, epc, rssi, avg_rssi, pc, distance, zone, read_count, tag_last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const upsertSnapshot = this.db.prepare(
      `INSERT INTO tag_snapshots (epc, agent_id, rssi, avg_rssi, pc, distance, zone, read_count, tag_last_seen, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (epc, agent_id) DO UPDATE SET
         rssi = excluded.rssi,
         avg_rssi = excluded.avg_rssi,
         pc = excluded.pc,
         distance = excluded.distance,
         zone = excluded.zone,
         read_count = excluded.read_count,
         tag_last_seen = excluded.tag_last_seen,
         updated_at = excluded.updated_at`
    );

    const batch = snapshot.tags.flatMap((tag) => [
      insertReading.bind(
        snapshot.agent_id, tag.epc, tag.rssi, tag.avg_rssi, tag.pc,
        tag.distance_m, tag.zone, tag.read_count, tag.last_seen
      ),
      upsertSnapshot.bind(
        tag.epc, snapshot.agent_id, tag.rssi, tag.avg_rssi, tag.pc,
        tag.distance_m, tag.zone, tag.read_count, tag.last_seen
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
}
