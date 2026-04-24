import type { Env } from '../types';
import type { DatabaseService } from '../services/database';
import { authenticateUser, requireRole } from '../middleware/auth';
import { hashPassword } from '../services/crypto';

function extractId(pathname: string): number | null {
  const id = parseInt(pathname.split('/').pop() ?? '', 10);
  return isNaN(id) ? null : id;
}

export async function handleUsers(request: Request, db: DatabaseService, env: Env, url: URL): Promise<Response> {
  const auth = await authenticateUser(request, env);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.value, 'admin');
  if (denied) return denied;

  if (request.method === 'GET') {
    return Response.json(await db.listUsers());
  }

  if (request.method === 'POST') {
    const body = await request.json() as { name?: string; email?: string; password?: string; role?: string };
    if (!body.name || !body.email || !body.password) {
      return new Response('name, email, and password are required', { status: 400 });
    }
    if (body.password.length < 8) {
      return new Response('password must be at least 8 characters', { status: 400 });
    }
    const role = body.role ?? 'viewer';
    if (!['admin', 'viewer'].includes(role)) {
      return new Response('role must be admin or viewer', { status: 400 });
    }

    const passwordHash = await hashPassword(body.password);
    const user = await db.createUser(body.name, body.email, passwordHash, role);
    return Response.json(user, { status: 201 });
  }

  if (request.method === 'DELETE') {
    const id = extractId(url.pathname);
    if (!id) return new Response('ID required', { status: 400 });
    if (id === auth.value.sub) {
      return new Response('Cannot delete yourself', { status: 400 });
    }
    await db.deleteUser(id);
    return new Response(null, { status: 204 });
  }

  return new Response('Method not allowed', { status: 405 });
}
