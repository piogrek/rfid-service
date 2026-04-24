import type { Env } from '../types';
import type { DatabaseService } from '../services/database';
import { authenticateUser, requireRole } from '../middleware/auth';

function extractId(pathname: string): number | null {
  const id = parseInt(pathname.split('/').pop() ?? '', 10);
  return isNaN(id) ? null : id;
}

export async function handleZones(request: Request, db: DatabaseService, env: Env, url: URL): Promise<Response> {
  if (request.method === 'GET') {
    return Response.json(await db.listZones());
  }

  const auth = await authenticateUser(request, env);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.value, 'admin');
  if (denied) return denied;

  if (request.method === 'POST') {
    const body = await request.json() as { name?: string; code?: string; location?: Record<string, unknown> };
    if (!body.name || !body.code) return new Response('name and code are required', { status: 400 });
    const zone = await db.createZone(body.name, body.code, body.location ?? {});
    return Response.json(zone, { status: 201 });
  }

  const id = extractId(url.pathname);
  if (!id) return new Response('ID required', { status: 400 });

  if (request.method === 'PUT') {
    const body = await request.json() as { name?: string; code?: string; location?: Record<string, unknown> };
    if (!body.name || !body.code) return new Response('name and code are required', { status: 400 });
    const zone = await db.updateZone(id, body.name, body.code, body.location ?? {});
    return zone ? Response.json(zone) : new Response('Not found', { status: 404 });
  }

  if (request.method === 'DELETE') {
    await db.deleteZone(id);
    return new Response(null, { status: 204 });
  }

  return new Response('Method not allowed', { status: 405 });
}
