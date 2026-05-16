import type { McpContext, ToolResult } from '../types.js';
import { getApp, getProfile, listNotifications } from '../tools/read.js';

interface ResourceTemplate {
  uri: string; // template form for ListResources
  name: string;
  description: string;
  mimeType: string;
}

const TEMPLATES: ResourceTemplate[] = [
  {
    uri: 'hatch://app/{slug}',
    name: 'Hatch app',
    description: 'Full JSON of an app by slug (author + counters included).',
    mimeType: 'application/json',
  },
  {
    uri: 'hatch://profile/{handle}',
    name: 'Hatch profile',
    description: 'Full JSON of a profile by handle (app_count + follower_count included).',
    mimeType: 'application/json',
  },
  {
    uri: 'hatch://notifications',
    name: 'Your notifications',
    description: 'Last 50 notifications for the authenticated user.',
    mimeType: 'application/json',
  },
];

export function listResources() {
  return TEMPLATES.map((t) => ({
    uri: t.uri,
    name: t.name,
    description: t.description,
    mimeType: t.mimeType,
  }));
}

function toResourceContents(uri: string, result: ToolResult) {
  const first = result.content[0];
  if (!first) throw new Error(`tool_returned_empty_content: ${uri}`);
  return { contents: [{ uri, mimeType: 'application/json', text: first.text }] };
}

export async function readResource(uri: string, ctx: McpContext) {
  // Parse hatch://app/{slug}
  const appMatch = /^hatch:\/\/app\/([a-z0-9-]+)$/i.exec(uri);
  if (appMatch) {
    const result = await getApp.handler({ slug: appMatch[1] }, ctx);
    return toResourceContents(uri, result);
  }

  // Parse hatch://profile/{handle}
  const profileMatch = /^hatch:\/\/profile\/([a-z0-9_]+)$/i.exec(uri);
  if (profileMatch) {
    const result = await getProfile.handler({ handle: profileMatch[1] }, ctx);
    return toResourceContents(uri, result);
  }

  // Parse hatch://notifications
  if (uri === 'hatch://notifications') {
    const result = await listNotifications.handler({ limit: 50 }, ctx);
    return toResourceContents(uri, result);
  }

  throw new Error(`unknown_resource: ${uri}`);
}
