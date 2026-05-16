export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const revalidate = 3600; // 1h is fine — content rarely changes

const BODY = `# Hatch

Product-Hunt-for-builders. Discover, publish, and discuss small apps and tools.

## Browse
- Discover: https://hatch.dev/
- Trending (last 7 days): https://hatch.dev/trending
- Following: https://hatch.dev/following
- Categories: https://hatch.dev/c/{category_id}
- App detail: https://hatch.dev/a/{slug}
- Maker profile: https://hatch.dev/u/{handle}

## Public read-only JSON API (CORS open, rate-limited 60/min/IP)
- List apps: https://hatch.dev/api/v1/apps
- App detail: https://hatch.dev/api/v1/apps/{slug}
- Maker profile + apps: https://hatch.dev/api/v1/profiles/{handle}
- Categories: https://hatch.dev/api/v1/categories
- Full-text search: https://hatch.dev/api/v1/search?q={query}
- OpenAPI 3 spec: https://hatch.dev/api/v1/openapi.json

## MCP server (authenticated agent surface)
- Hosted at: see /settings/api-keys for the Claude Desktop config snippet
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
