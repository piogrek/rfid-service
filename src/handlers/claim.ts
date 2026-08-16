import type { Env } from '../types';
import type { DatabaseService } from '../services/database';
import { authenticateUser, requireRole } from '../middleware/auth';
import { generateApiKey, hashApiKey } from '../services/crypto';

export async function handleClaim(request: Request, db: DatabaseService, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await request.json() as {
    action?: 'register' | 'claim';
    hardware_id?: string;
    claim_code?: string;
    zone_id?: number;
  };

  if (body.action === 'register') {
    if (!body.hardware_id || !body.claim_code) {
      return new Response('hardware_id and claim_code are required', { status: 400 });
    }

    await db.registerReaderClaimCode(body.hardware_id, body.claim_code);
    return Response.json({ registered: true });
  }

  if (body.action === 'claim' || !body.action) {
    const auth = await authenticateUser(request, env);
    if (!auth.ok) return auth.response;
    const denied = requireRole(auth.value, 'admin');
    if (denied) return denied;

    if (!body.claim_code || !body.zone_id) {
      return new Response('claim_code and zone_id are required', { status: 400 });
    }

    try {
      const rawKey = generateApiKey();
      const keyHash = await hashApiKey(rawKey);
      const config = await db.claimReader(
        body.claim_code,
        body.zone_id,
        auth.value.sub,
        rawKey,
        keyHash
      );

      return Response.json({
        claimed: true,
        config,
      });
    } catch (error) {
      return new Response(
        error instanceof Error ? error.message : 'Failed to claim reader',
        { status: 400 }
      );
    }
  }

  return new Response('Invalid action', { status: 400 });
}
