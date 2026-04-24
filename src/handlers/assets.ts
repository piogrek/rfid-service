import type { Env } from '../types';
import type { DatabaseService, AssetInput } from '../services/database';

function checkAuth(request: Request, env: Env): boolean {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  return !!token && token === env.INGEST_TOKEN;
}

function extractId(pathname: string): number | null {
  const id = parseInt(pathname.split('/').pop() ?? '', 10);
  return isNaN(id) ? null : id;
}

function parseBody(body: Record<string, unknown>): AssetInput {
  return {
    name: (body.name as string) ?? '',
    asset_type: (body.asset_type as string) ?? '',
    location: (body.location as Record<string, unknown>) ?? {},
    location_description: (body.location_description as string) ?? '',
    attributes: (body.attributes as Record<string, unknown>) ?? {},
    epc: (body.epc as string) ?? '',
    zone_id: body.zone_id != null ? Number(body.zone_id) : null,
  };
}

export async function handleAssets(request: Request, db: DatabaseService, env: Env, url: URL): Promise<Response> {
  if (request.method === 'GET') {
    return Response.json(await db.listAssets());
  }

  if (!checkAuth(request, env)) return new Response('Unauthorized', { status: 401 });

  if (request.method === 'POST') {
    const body = await request.json() as Record<string, unknown>;
    if (!body.name) return new Response('name is required', { status: 400 });
    const asset = await db.createAsset(parseBody(body));
    return Response.json(asset, { status: 201 });
  }

  const id = extractId(url.pathname);
  if (!id) return new Response('ID required', { status: 400 });

  if (request.method === 'PUT') {
    const body = await request.json() as Record<string, unknown>;
    if (!body.name) return new Response('name is required', { status: 400 });
    const asset = await db.updateAsset(id, parseBody(body));
    return asset ? Response.json(asset) : new Response('Not found', { status: 404 });
  }

  if (request.method === 'DELETE') {
    await db.deleteAsset(id);
    return new Response(null, { status: 204 });
  }

  return new Response('Method not allowed', { status: 405 });
}
