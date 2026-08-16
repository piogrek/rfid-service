import type { Env } from './types';
import { D1DatabaseService } from './services/d1-database';
import { handleIngest } from './handlers/ingest';
import { handleLatest, handleHistory, handleCurrent } from './handlers/query';
import { handleTagRoles } from './handlers/tag-roles';
import { handleZones } from './handlers/zones';
import { handleAssets } from './handlers/assets';
import { handleAuth } from './handlers/auth';
import { handleApiKeys } from './handlers/api-keys';
import { handleUsers } from './handlers/users';
import { authenticateUser } from './middleware/auth';
import { handleMessages } from './handlers/messages';
import { handleClaim } from './handlers/claim';
import { handleReaderConfig } from './handlers/reader-config';
import { handleReaders } from './handlers/readers';

function getAllowedOrigins(env: Env): Set<string> {
  return new Set(
    env.PORTAL_ORIGINS
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

function getRequestOrigin(request: Request, allowedOrigins: Set<string>): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  return allowedOrigins.has(origin) ? origin : null;
}

function withCors(response: Response, origin: string | null): Response {
  if (!origin) return response;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  headers.set('Vary', 'Origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = new D1DatabaseService(env.DB);
    const url = new URL(request.url);
    const path = url.pathname;
    const allowedOrigins = getAllowedOrigins(env);
    const corsOrigin = getRequestOrigin(request, allowedOrigins);

    if (request.method === 'OPTIONS' && path === '/api/messages') {
      if (!corsOrigin) {
        return new Response('Origin not allowed', { status: 403 });
      }
      return withCors(new Response(null, { status: 204 }), corsOrigin);
    }

    const respond = (response: Response): Response => withCors(response, corsOrigin);

    if (path.startsWith('/api/auth')) return respond(await handleAuth(request, db, env, url));
    if (path === '/api/ingest') return respond(await handleIngest(request, db));
    if (path === '/api/claim') return respond(await handleClaim(request, db, env));
    if (path === '/api/reader/config') return respond(await handleReaderConfig(request, db, env));
    if (path.startsWith('/api/messages')) return respond(await handleMessages(request, db, env, url));

    const auth = await authenticateUser(request, env);
    if (!auth.ok) return respond(auth.response);

    if (path === '/api/tags/current') return respond(await handleCurrent(request, db));
    if (path === '/api/tags/latest') return respond(await handleLatest(request, db));
    if (path === '/api/tags/history') return respond(await handleHistory(request, db));
    if (path.startsWith('/api/tag-roles')) return respond(await handleTagRoles(request, db, env, url));
    if (path.startsWith('/api/zones')) return respond(await handleZones(request, db, env, url));
    if (path.startsWith('/api/readers')) return respond(await handleReaders(request, db, env));
    if (path.startsWith('/api/assets')) return respond(await handleAssets(request, db, env, url));
    if (path.startsWith('/api/api-keys')) return respond(await handleApiKeys(request, db, env, url));
    if (path.startsWith('/api/users')) return respond(await handleUsers(request, db, env, url));

    return respond(new Response('rfid-service', { status: 200 }));
  },
};
