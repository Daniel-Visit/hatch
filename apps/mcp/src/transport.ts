import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createMcpServer } from './server.js';
import { resolveUserId } from './auth.js';
import { getSupabase } from './supabase.js';

// HATCH-011 (part 2): per-IP rate-limit on /mcp.
// Cap to 120 attempts per 60s per source so an unauthenticated attacker
// cannot drown the worker forcing bcrypt-cost-10 work via repeated bogus
// Bearer tokens. In-memory counter — fine for a single-replica Railway
// worker; for multi-replica swap for a Redis/Postgres atomic counter.
const MCP_LIMIT = 120;
const MCP_WINDOW_MS = 60_000;
const mcpHits = new Map<string, { count: number; resetAt: number }>();

function ipOf(req: IncomingMessage): string {
  const xv = req.headers['x-vercel-forwarded-for'];
  if (typeof xv === 'string' && xv.length > 0) return (xv.split(',')[0] ?? xv).trim();
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) return (xf.split(',')[0] ?? xf).trim();
  return req.socket.remoteAddress ?? 'unknown';
}

function checkMcpRateLimit(ip: string): { ok: boolean; resetAt: number } {
  const now = Date.now();
  const cur = mcpHits.get(ip);
  if (!cur || cur.resetAt <= now) {
    const resetAt = now + MCP_WINDOW_MS;
    mcpHits.set(ip, { count: 1, resetAt });
    return { ok: true, resetAt };
  }
  cur.count += 1;
  if (cur.count > MCP_LIMIT) return { ok: false, resetAt: cur.resetAt };
  return { ok: true, resetAt: cur.resetAt };
}

/**
 * Handle a single POST /mcp request per the MCP Streamable HTTP spec (2025-03-26):
 *  1. Rate-limit per source IP — reject 429 if exceeded (HATCH-011).
 *  2. Authenticate via Authorization: Bearer — reject 401 if missing/invalid.
 *  3. Build a per-request McpContext (userId + service-role Supabase client).
 *  4. Instantiate a fresh Server + stateless StreamableHTTPServerTransport.
 *  5. Connect the server to the transport, then delegate the raw request.
 *
 * A fresh server+transport pair is created for every request (stateless mode:
 * sessionIdGenerator is undefined), which is correct for a single-user-per-request
 * auth model and avoids shared mutable state between concurrent callers.
 */
export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const ip = ipOf(req);
  const rl = checkMcpRateLimit(ip);
  if (!rl.ok) {
    const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    res.writeHead(429, {
      'content-type': 'application/json',
      'retry-after': String(retryAfterSec),
    });
    res.end(JSON.stringify({ error: 'rate_limited' }));
    return;
  }

  const userId = await resolveUserId(req.headers.authorization);
  if (!userId) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return;
  }

  const ctx = { userId, supabase: getSupabase() };
  const server = createMcpServer(ctx);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session cookie issued
  });

  await server.connect(transport);
  await transport.handleRequest(req, res);
}
