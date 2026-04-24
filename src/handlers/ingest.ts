import type { TagSnapshot, Env } from '../types';
import type { DatabaseService } from '../services/database';

export async function handleIngest(request: Request, db: DatabaseService, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || token !== env.INGEST_TOKEN) {
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
