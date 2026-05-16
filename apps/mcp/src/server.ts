import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './types.js';
import * as readTools from './tools/read.js';
import * as publishTools from './tools/publish.js';
import * as socialTools from './tools/social.js';
import { listResources, readResource } from './resources/index.js';
import { listPrompts, getPrompt } from './prompts/index.js';

// All registered tools in dispatch order.
const TOOLS = [
  readTools.listApps,
  readTools.searchApps,
  readTools.getApp,
  readTools.listCategories,
  readTools.getProfile,
  readTools.listNotifications,
  publishTools.publishApp,
  publishTools.updateApp,
  socialTools.likeApp,
  socialTools.unlikeApp,
  socialTools.saveApp,
  socialTools.unsaveApp,
  socialTools.followUser,
  socialTools.unfollowUser,
  socialTools.sendMessage,
];

/**
 * Create a fresh MCP Server instance bound to the given request context.
 * Tools (Task 6) are fully wired here. Resources (Task 7) and Prompts (Task 8)
 * remain as stubs until those tasks are implemented.
 */
export function createMcpServer(ctx: McpContext): Server {
  const server = new Server(
    { name: 'hatch-mcp', version: '0.1.0' },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  );

  // Tools — fully implemented (Task 6)
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = TOOLS.find((t) => t.name === req.params.name);
    if (!tool) throw new Error(`unknown_tool: ${req.params.name}`);
    return await tool.handler(req.params.arguments ?? {}, ctx);
  });

  // Resources — implemented (Task 7)
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: listResources(),
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    return await readResource(req.params.uri, ctx);
  });

  // Prompts — implemented (Task 8)
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: listPrompts(),
  }));
  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    return await getPrompt(req.params.name, req.params.arguments, ctx);
  });

  return server;
}
