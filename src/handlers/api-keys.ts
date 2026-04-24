import type { Env } from '../types';
import type { DatabaseService } from '../services/database';
import { authenticateUser, requireRole } from '../middleware/auth';
import { generateApiKey, hashApiKey } from '../services/crypto';

function extractId(pathname: string): number | null {
  const id = parseInt(pathname.split('/').pop() ?? '', 10);
  return isNaN(id) ? null : id;
}

export async function handleApiKeys(request: Request, db: DatabaseService, env: Env, url: URL): Promise<Response> {
  const auth = await authenticateUser(request, env);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.value, 'admin');
  if (denied) return denied;

  if (request.method === 'GET') {
    return Response.json(await db.listApiKeys());
  }

  if (request.method === 'POST') {
    const body = await request.json() as { name?: string; description?: string; expires_at?: string };
    if (!body.name) return new Response('name is required', { status: 400 });

    const rawKey = generateApiKey();
    const keyPrefix = rawKey.substring(0, 13);
    const keyHash = await hashApiKey(rawKey);
    const apiKey = await db.createApiKey(body.name, keyPrefix, keyHash, body.description ?? '', body.expires_at ?? null);

    return Response.json({ ...apiKey, key: rawKey }, { status: 201 });
  }

  if (request.method === 'DELETE') {
    const id = extractId(url.pathname);
    if (!id) return new Response('ID required', { status: 400 });
    await db.deleteApiKey(id);
    return new Response(null, { status: 204 });
  }

  return new Response('Method not allowed', { status: 405 });
}
