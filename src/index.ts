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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = new D1DatabaseService(env.DB);
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/auth')) return handleAuth(request, db, env, url);
    if (path === '/api/ingest') return handleIngest(request, db, env);

    const auth = await authenticateUser(request, env);
    if (!auth.ok) return auth.response;

    if (path === '/api/tags/current') return handleCurrent(request, db);
    if (path === '/api/tags/latest') return handleLatest(request, db);
    if (path === '/api/tags/history') return handleHistory(request, db);
    if (path.startsWith('/api/tag-roles')) return handleTagRoles(request, db, env, url);
    if (path.startsWith('/api/zones')) return handleZones(request, db, env, url);
    if (path.startsWith('/api/assets')) return handleAssets(request, db, env, url);
    if (path.startsWith('/api/api-keys')) return handleApiKeys(request, db, env, url);
    if (path.startsWith('/api/users')) return handleUsers(request, db, env, url);

    return new Response('rfid-service', { status: 200 });
  },
};
