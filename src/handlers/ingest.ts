import type { TagSnapshot } from '../types';
import type { DatabaseService } from '../services/database';
import { authenticateAgent } from '../middleware/auth';

export async function handleIngest(request: Request, db: DatabaseService): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = await authenticateAgent(request, db);
  if (!auth.ok) return auth.response;

  let snapshot: TagSnapshot;
  try {
    snapshot = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!snapshot.agent_id || !Array.isArray(snapshot.tags)) {
    return new Response('Invalid payload', { status: 400 });
  }

  // Persist which agent API key authenticated this ingest (name + id).
  const count = await db.storeSnapshot(snapshot, auth.value);
  return Response.json({
    stored: count,
    api_key_id: auth.value.id,
    api_key_name: auth.value.name,
  });
}
