import type { DatabaseService } from '../services/database';

export async function handleLatest(request: Request, db: DatabaseService): Promise<Response> {
  const url = new URL(request.url);
  const agentId = url.searchParams.get('agent_id') ?? 'agent-1';
  const readings = await db.getLatestPerTag(agentId);
  return Response.json({ agent_id: agentId, tags: readings });
}

export async function handleHistory(request: Request, db: DatabaseService): Promise<Response> {
  const url = new URL(request.url);
  const epc = url.searchParams.get('epc');
  const agentId = url.searchParams.get('agent_id');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 1000);

  if (epc) {
    const readings = await db.getRecentByEpc(epc, limit);
    return Response.json({ epc, readings });
  }

  if (agentId) {
    const readings = await db.getRecentByAgent(agentId, limit);
    return Response.json({ agent_id: agentId, readings });
  }

  return new Response('Provide ?epc= or ?agent_id=', { status: 400 });
}
