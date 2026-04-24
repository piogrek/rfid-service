import type { TagSnapshot, StoredTagReading } from '../types';

export interface DatabaseService {
  storeSnapshot(snapshot: TagSnapshot): Promise<number>;
  getRecentByAgent(agentId: string, limit: number): Promise<StoredTagReading[]>;
  getRecentByEpc(epc: string, limit: number): Promise<StoredTagReading[]>;
  getLatestPerTag(agentId: string): Promise<StoredTagReading[]>;
}
