export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const revalidate = 3600; // 1h is fine — content rarely changes

const BODY = `# Hatch

Product-Hunt-for-builders. Discover, publish, and discuss small apps and tools.

## Browse
- Discover: https://hatchme.cc/
- Trending (last 7 days): https://hatchme.cc/trending
- Following: https://hatchme.cc/following
- Categories: https://hatchme.cc/c/{category_id}
- App detail: https://hatchme.cc/a/{slug}
- Maker profile: https://hatchme.cc/u/{handle}

## Public read-only JSON API (CORS open, rate-limited 60/min/IP)
- List apps: https://hatchme.cc/api/v1/apps
- App detail: https://hatchme.cc/api/v1/apps/{slug}
- Maker profile + apps: https://hatchme.cc/api/v1/profiles/{handle}
- Categories: https://hatchme.cc/api/v1/categories
- Full-text search: https://hatchme.cc/api/v1/search?q={query}
- OpenAPI 3 spec: https://hatchme.cc/api/v1/openapi.json

## MCP server (authenticated agent surface)
- Connect guide (get an API key + add the server): https://hatchme.cc/developers
- Endpoint: https://hatch-mcp-production.up.railway.app/mcp
- Tools (15): list_apps, search_apps, get_app, list_categories, get_profile, list_notifications, publish_app, update_app, like_app, unlike_app, save_app, unsave_app, follow_user, unfollow_user, send_message
- Resources (3): hatch://app/{slug}, hatch://profile/{handle}, hatch://notifications
- Prompts (3): draft_app_description, review_my_apps, compose_message
`;

export async function GET() {
  return new Response(BODY, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
