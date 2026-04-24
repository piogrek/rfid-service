import type { Env } from '../types';
import type { DatabaseService } from '../services/database';

function checkAuth(request: Request, env: Env): boolean {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  return !!token && token === env.INGEST_TOKEN;
}

function extractId(pathname: string): number | null {
  const id = parseInt(pathname.split('/').pop() ?? '', 10);
  return isNaN(id) ? null : id;
}

export async function handleTagRoles(request: Request, db: DatabaseService, env: Env, url: URL): Promise<Response> {
  if (request.method === 'GET') {
    return Response.json(await db.listTagRoles());
  }

  if (!checkAuth(request, env)) return new Response('Unauthorized', { status: 401 });

  if (request.method === 'POST') {
    const body = await request.json() as { name?: string; patterns?: string[] };
    if (!body.name) return new Response('name is required', { status: 400 });
    const role = await db.createTagRole(body.name, body.patterns ?? []);
    return Response.json(role, { status: 201 });
  }

  const id = extractId(url.pathname);
  if (!id) return new Response('ID required', { status: 400 });

  if (request.method === 'PUT') {
    const body = await request.json() as { name?: string; patterns?: string[] };
    if (!body.name) return new Response('name is required', { status: 400 });
    const role = await db.updateTagRole(id, body.name, body.patterns ?? []);
    return role ? Response.json(role) : new Response('Not found', { status: 404 });
  }

  if (request.method === 'DELETE') {
    await db.deleteTagRole(id);
    return new Response(null, { status: 204 });
  }

  return new Response('Method not allowed', { status: 405 });
}
