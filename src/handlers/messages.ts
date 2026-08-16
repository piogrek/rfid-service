import type { Env } from '../types';
import type { DatabaseService } from '../services/database';
import { authenticateUser, requireRole } from '../middleware/auth';
import { verifyTurnstileToken } from '../services/turnstile';

function extractId(pathname: string): number | null {
  const id = parseInt(pathname.split('/').pop() ?? '', 10);
  return Number.isNaN(id) ? null : id;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function handleMessages(request: Request, db: DatabaseService, env: Env, url: URL): Promise<Response> {
  if (request.method === 'POST' && url.pathname === '/api/messages') {
    const body = await request.json() as {
      name?: string;
      email?: string;
      content?: string;
      turnstile_token?: string;
    };

    const name = body.name?.trim() ?? '';
    const email = body.email?.trim().toLowerCase() ?? '';
    const content = body.content?.trim() ?? '';
    const turnstileToken = body.turnstile_token?.trim() ?? '';

    if (!name || !email) {
      return new Response('name and email are required', { status: 400 });
    }
    if (!isValidEmail(email)) {
      return new Response('Invalid email format', { status: 400 });
    }
    if (!turnstileToken) {
      return new Response('turnstile_token is required', { status: 400 });
    }
    if (content.length > 5000) {
      return new Response('content must be 5000 characters or less', { status: 400 });
    }

    const isHuman = await verifyTurnstileToken(
      turnstileToken,
      env.TURNSTILE_SECRET,
      request.headers.get('CF-Connecting-IP')
    );

    if (!isHuman) {
      return new Response('Turnstile verification failed', { status: 403 });
    }

    const message = await db.createMessage(name, email, content || null);
    return Response.json(message, { status: 201 });
  }

  const auth = await authenticateUser(request, env);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.value, 'admin');
  if (denied) return denied;

  if (request.method === 'GET' && url.pathname === '/api/messages') {
    return Response.json(await db.listMessages());
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/messages/')) {
    const id = extractId(url.pathname);
    if (!id) return new Response('ID required', { status: 400 });
    const message = await db.getMessageById(id);
    return message ? Response.json(message) : new Response('Not found', { status: 404 });
  }

  return new Response('Method not allowed', { status: 405 });
}
