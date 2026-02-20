import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './tools.js';

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Human Pages MCP Server running on stdio');
