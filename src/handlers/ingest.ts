import type { TagSnapshot, Env } from '../types';
import type { DatabaseService } from '../services/database';
import { authenticateAgent } from '../middleware/auth';

export async function handleIngest(request: Request, db: DatabaseService, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Support both legacy INGEST_TOKEN and new API keys
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return new Response('Unauthorized', { status: 401 });

  if (token.startsWith('rfid_')) {
    const auth = await authenticateAgent(request, db);
    if (!auth.ok) return auth.response;
  } else if (!env.INGEST_TOKEN || token !== env.INGEST_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  let snapshot: TagSnapshot;
  try {
    snapshot = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!snapshot.agent_id || !Array.isArray(snapshot.tags)) {
    return new Response('Invalid payload', { status: 400 });
  }

  const count = await db.storeSnapshot(snapshot);
  return Response.json({ stored: count });
}
