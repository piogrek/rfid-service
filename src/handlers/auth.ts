import type { Env } from '../types';
import type { DatabaseService } from '../services/database';
import { verifyPassword, hashApiKey, signJwt, generateRefreshToken } from '../services/crypto';

const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days

export async function handleAuth(request: Request, db: DatabaseService, env: Env, url: URL): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (url.pathname === '/api/auth/login') return handleLogin(request, db, env);
  if (url.pathname === '/api/auth/refresh') return handleRefresh(request, db, env);
  if (url.pathname === '/api/auth/logout') return handleLogout(request, db);

  return new Response('Not found', { status: 404 });
}

async function handleLogin(request: Request, db: DatabaseService, env: Env): Promise<Response> {
  const body = await request.json() as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return new Response('email and password are required', { status: 400 });
  }

  const user = await db.getUserByEmail(body.email);
  if (!user) return new Response('Invalid credentials', { status: 401 });

  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) return new Response('Invalid credentials', { status: 401 });

  db.deleteExpiredRefreshTokens();

  const accessToken = await signJwt(
    { sub: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL },
    env.JWT_SECRET
  );

  const refreshTokenRaw = generateRefreshToken();
  const refreshTokenHash = await hashApiKey(refreshTokenRaw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000).toISOString();
  await db.storeRefreshToken(user.id, refreshTokenHash, expiresAt);

  return Response.json({
    access_token: accessToken,
    refresh_token: refreshTokenRaw,
    expires_in: ACCESS_TOKEN_TTL,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

async function handleRefresh(request: Request, db: DatabaseService, env: Env): Promise<Response> {
  const body = await request.json() as { refresh_token?: string };
  if (!body.refresh_token) return new Response('refresh_token is required', { status: 400 });

  const tokenHash = await hashApiKey(body.refresh_token);
  const stored = await db.getRefreshToken(tokenHash);
  if (!stored) return new Response('Invalid refresh token', { status: 401 });

  await db.deleteRefreshToken(stored.id);

  if (new Date(stored.expires_at) < new Date()) {
    return new Response('Refresh token expired', { status: 401 });
  }

  const user = await db.getUserById(stored.user_id);
  if (!user) return new Response('User not found', { status: 401 });

  const accessToken = await signJwt(
    { sub: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL },
    env.JWT_SECRET
  );

  const newRefreshRaw = generateRefreshToken();
  const newRefreshHash = await hashApiKey(newRefreshRaw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000).toISOString();
  await db.storeRefreshToken(stored.user_id, newRefreshHash, expiresAt);

  return Response.json({
    access_token: accessToken,
    refresh_token: newRefreshRaw,
    expires_in: ACCESS_TOKEN_TTL,
  });
}

async function handleLogout(request: Request, db: DatabaseService): Promise<Response> {
  const body = await request.json() as { refresh_token?: string };
  if (!body.refresh_token) return new Response('refresh_token is required', { status: 400 });

  const tokenHash = await hashApiKey(body.refresh_token);
  const stored = await db.getRefreshToken(tokenHash);
  if (stored) await db.deleteRefreshToken(stored.id);

  return new Response(null, { status: 204 });
}
