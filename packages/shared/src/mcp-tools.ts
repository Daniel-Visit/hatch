// Single source of truth for the MCP server's tool surface.
// Imported by:
//   - apps/web/app/_landing/agents.tsx (marketing display on /)
//   - (future) any other place that needs to enumerate tools.
// The actual MCP server implementations live in apps/mcp/src/tools/{read,publish,social}.ts.
// When you add/remove a tool there, update this list to match.

// Public endpoint of the deployed Hatch MCP server (Streamable HTTP transport,
// POST /mcp). Single source of truth so the /developers connect guide and the
// /settings/api-keys config snippet never drift apart.
export const MCP_ENDPOINT_URL = 'https://hatch-mcp-production.up.railway.app/mcp';

export type McpToolName =
  | 'list_apps'
  | 'search_apps'
  | 'get_app'
  | 'list_categories'
  | 'get_profile'
  | 'list_notifications'
  | 'publish_app'
  | 'update_app'
  | 'like_app'
  | 'unlike_app'
  | 'save_app'
  | 'unsave_app'
  | 'follow_user'
  | 'unfollow_user'
  | 'send_message';

export const MCP_TOOLS: readonly McpToolName[] = [
  // Read (6)
  'list_apps',
  'search_apps',
  'get_app',
  'list_categories',
  'get_profile',
  'list_notifications',
  // Publish (2)
  'publish_app',
  'update_app',
  // Social (7)
  'like_app',
  'unlike_app',
  'save_app',
  'unsave_app',
  'follow_user',
  'unfollow_user',
  'send_message',
];

export const MCP_TOOL_GROUPS = {
  read: [
    'list_apps',
    'search_apps',
    'get_app',
    'list_categories',
    'get_profile',
    'list_notifications',
  ] as const,
  publish: ['publish_app', 'update_app'] as const,
  social: [
    'like_app',
    'unlike_app',
    'save_app',
    'unsave_app',
    'follow_user',
    'unfollow_user',
    'send_message',
  ] as const,
} as const;
