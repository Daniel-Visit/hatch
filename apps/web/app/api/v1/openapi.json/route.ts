import { NextResponse } from 'next/server';
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { ApiAppsList, ApiAppDetail, ApiProfileDetail, ApiSearch } from '@/lib/zod/api';

extendZodWithOpenApi(z);

export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const revalidate = 3600;

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  // HATCH-009: hint shared caches not to mix responses across origins.
  Vary: 'Origin',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  const registry = new OpenAPIRegistry();

  registry.registerPath({
    method: 'get',
    path: '/api/v1/apps',
    summary: 'List published apps',
    description:
      "Paginated list of published apps, optionally filtered by category. Cursor is the last item's published_at ISO timestamp.",
    request: { query: ApiAppsList },
    responses: {
      200: {
        description: 'OK',
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      429: { description: 'Rate limit exceeded' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/apps/{slug}',
    summary: 'Get app detail by slug',
    request: { params: z.object({ slug: ApiAppDetail.shape.slug }) },
    responses: {
      200: {
        description: 'OK',
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      404: { description: 'Not found' },
      429: { description: 'Rate limit exceeded' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/profiles/{handle}',
    summary: 'Get profile and their published apps by handle',
    request: { params: z.object({ handle: ApiProfileDetail.shape.handle }) },
    responses: {
      200: {
        description: 'OK',
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      404: { description: 'Not found' },
      429: { description: 'Rate limit exceeded' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/categories',
    summary: 'List all categories',
    responses: {
      200: {
        description: 'OK',
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      429: { description: 'Rate limit exceeded' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/v1/search',
    summary: 'Full-text search published apps',
    request: { query: ApiSearch },
    responses: {
      200: {
        description: 'OK',
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      400: { description: 'Invalid query' },
      429: { description: 'Rate limit exceeded' },
    },
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);
  const doc = generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Hatch Public API',
      version: '1.0.0',
      description:
        'Read-only JSON API for the Hatch app gallery. CORS open. Rate-limited at 60 requests per minute per IP. For authenticated agent access (publishing, social actions, messaging), use the MCP server — see https://hatch.dev/developers.',
    },
    servers: [{ url: 'https://hatch.dev' }],
  });

  return NextResponse.json(doc, { headers: CORS });
}
