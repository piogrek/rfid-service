import type { Env, ReaderUpdateInput } from '../types';
import type { DatabaseService } from '../services/database';
import { authenticateUser, requireRole } from '../middleware/auth';

function extractId(pathname: string): number | null {
  const parts = pathname.split('/').filter(Boolean);
  // /api/readers/:id
  if (parts.length < 3) return null;
  const id = parseInt(parts[parts.length - 1] ?? '', 10);
  return Number.isNaN(id) ? null : id;
}

export async function handleReaders(request: Request, db: DatabaseService, env: Env): Promise<Response> {
  const auth = await authenticateUser(request, env);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.value, 'admin');
  if (denied) return denied;

  if (request.method === 'GET') {
    return Response.json(await db.listReaders());
  }

  if (request.method === 'PUT') {
    const id = extractId(new URL(request.url).pathname);
    if (!id) return new Response('ID required', { status: 400 });

    const body = await request.json() as {
      name?: string;
      zone_id?: number;
      mqtt_server?: string | null;
      mqtt_port?: string | null;
      timezone?: string | null;
      api_key?: unknown;
    };

    if (body.api_key !== undefined) {
      return new Response('API key cannot be updated via reader edit', { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return new Response('name is required', { status: 400 });
    }

    if (body.zone_id === undefined || body.zone_id === null || Number.isNaN(Number(body.zone_id))) {
      return new Response('zone_id is required', { status: 400 });
    }

    const zoneId = Number(body.zone_id);
    const mqttPort =
      body.mqtt_port === undefined || body.mqtt_port === null
        ? undefined
        : String(body.mqtt_port).trim();

    if (mqttPort !== undefined && mqttPort !== '' && !/^\d{1,5}$/.test(mqttPort)) {
      return new Response('mqtt_port must be a numeric port', { status: 400 });
    }

    const input: ReaderUpdateInput = {
      name,
      zone_id: zoneId,
      mqtt_server:
        body.mqtt_server === undefined || body.mqtt_server === null
          ? ''
          : String(body.mqtt_server).trim(),
      mqtt_port: mqttPort === '' ? undefined : mqttPort,
      timezone:
        body.timezone === undefined || body.timezone === null
          ? undefined
          : String(body.timezone).trim() || undefined,
    };

    try {
      const reader = await db.updateReader(id, input);
      return reader ? Response.json(reader) : new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(
        error instanceof Error ? error.message : 'Failed to update reader',
        { status: 400 }
      );
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
