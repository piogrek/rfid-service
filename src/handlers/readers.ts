import type { Env } from '../types';
import type { DatabaseService } from '../services/database';
import { authenticateUser, requireRole } from '../middleware/auth';

export async function handleReaders(request: Request, db: DatabaseService, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = await authenticateUser(request, env);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.value, 'admin');
  if (denied) return denied;

  return Response.json(await db.listReaders());
}
