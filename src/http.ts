import 'dotenv/config';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './tools.js';

const app = express();
app.use(express.json({ limit: '256kb' }));

// Stateless: fresh server + transport per request
app.post('/mcp', async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Stateless mode — no SSE streams or session cleanup
app.get('/mcp', (_req, res) => { res.status(405).end(); });
app.delete('/mcp', (_req, res) => { res.status(405).end(); });

app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });

const port = parseInt(process.env.HTTP_PORT || '3002');
app.listen(port, '127.0.0.1', () => {
  console.log(`Human Pages MCP HTTP server on port ${port}`);
});
