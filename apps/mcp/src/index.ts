import http from 'node:http';
import { handleMcpRequest } from './transport.js';

const PORT = Number(process.env.PORT ?? 8080);

const server = http.createServer(async (req, res) => {
  // Health check — unauthenticated, used by infra probes
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'hatch-mcp', version: '0.1.0' }));
    return;
  }

  // MCP Streamable HTTP endpoint — authenticated, all MCP traffic
  if (req.method === 'POST' && req.url === '/mcp') {
    try {
      await handleMcpRequest(req, res);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[mcp] handler error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal_error' }));
      }
    }
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[mcp] listening on :${PORT} with /health and /mcp`);
});
