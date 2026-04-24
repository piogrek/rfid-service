import type { Env } from './types';
import { D1DatabaseService } from './services/d1-database';
import { handleIngest } from './handlers/ingest';
import { handleLatest, handleHistory, handleCurrent } from './handlers/query';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = new D1DatabaseService(env.DB);
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/api/ingest':
        return handleIngest(request, db, env);
      case '/api/tags/current':
        return handleCurrent(request, db);
      case '/api/tags/latest':
        return handleLatest(request, db);
      case '/api/tags/history':
        return handleHistory(request, db);
      default:
        return new Response('rfid-service', { status: 200 });
    }
  },
};
