import type { Env } from '../types';
import type { DatabaseService } from '../services/database';
import { authenticateAgent } from '../middleware/auth';

export async function handleReaderConfig(request: Request, db: DatabaseService, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = await authenticateAgent(request, db);
  if (!auth.ok) return auth.response;

  const config = await db.getReaderConfig(auth.value.id);
  if (!config) {
    return new Response('Reader not claimed or not found', { status: 404 });
  }

  return Response.json(config);
}
