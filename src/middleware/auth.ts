import type { Env, ApiKey } from '../types';
import type { DatabaseService } from '../services/database';
import { hashApiKey } from '../services/crypto';
import { verifyJwt, type JwtPayload } from '../services/crypto';

export type AuthResult<T> = { ok: true; value: T } | { ok: false; response: Response };

export async function authenticateAgent(request: Request, db: DatabaseService): Promise<AuthResult<ApiKey>> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, response: new Response('Missing Authorization header', { status: 401 }) };

  if (!token.startsWith('rfid_')) {
    return { ok: false, response: new Response('Invalid API key format', { status: 401 }) };
  }

  const prefix = token.substring(0, 13);
  const stored = await db.getApiKeyByPrefix(prefix);
  if (!stored) return { ok: false, response: new Response('Invalid API key', { status: 401 }) };

  if (stored.expires_at && new Date(stored.expires_at) < new Date()) {
    return { ok: false, response: new Response('API key expired', { status: 401 }) };
  }

  const hash = await hashApiKey(token);
  const storedBytes = new TextEncoder().encode(stored.key_hash);
  const computedBytes = new TextEncoder().encode(hash);
  if (storedBytes.byteLength !== computedBytes.byteLength || !crypto.subtle.timingSafeEqual(storedBytes, computedBytes)) {
    return { ok: false, response: new Response('Invalid API key', { status: 401 }) };
  }

  db.touchApiKey(stored.id);

  const { key_hash: _, ...apiKey } = stored;
  return { ok: true, value: apiKey };
}

export async function authenticateUser(request: Request, env: Env): Promise<AuthResult<JwtPayload>> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, response: new Response('Missing Authorization header', { status: 401 }) };

  if (token.startsWith('rfid_')) {
    return { ok: false, response: new Response('API keys cannot access this endpoint', { status: 403 }) };
  }

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) return { ok: false, response: new Response('Invalid or expired token', { status: 401 }) };

  return { ok: true, value: payload };
}

export function requireRole(payload: JwtPayload, ...roles: string[]): Response | null {
  if (!roles.includes(payload.role)) {
    return new Response('Forbidden', { status: 403 });
  }
  return null;
}
