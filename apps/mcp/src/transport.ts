import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createMcpServer } from './server.js';
import { resolveUserId } from './auth.js';
import { getSupabase } from './supabase.js';

/**
 * Handle a single POST /mcp request per the MCP Streamable HTTP spec (2025-03-26):
 *  1. Authenticate via Authorization: Bearer — reject 401 if missing/invalid.
 *  2. Build a per-request McpContext (userId + service-role Supabase client).
 *  3. Instantiate a fresh Server + stateless StreamableHTTPServerTransport.
 *  4. Connect the server to the transport, then delegate the raw request.
 *
 * A fresh server+transport pair is created for every request (stateless mode:
 * sessionIdGenerator is undefined), which is correct for a single-user-per-request
 * auth model and avoids shared mutable state between concurrent callers.
 */
export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
