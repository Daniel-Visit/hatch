import { z } from 'zod';
import type { Database } from '@hatch/shared';
import { AI_MODEL_SLUGS } from '@hatch/shared';
import { jsonResult, type McpContext, type ToolResult } from '../types.js';

type AppUpdate = Database['public']['Tables']['apps']['Update'];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  handler: (args: unknown, ctx: McpContext) => Promise<ToolResult>;
}

// ---------------------------------------------------------------------------
// publish_app
// ---------------------------------------------------------------------------

const PublishAppSchema = z.object({
  title: z.string().min(1),
  tagline: z.string().min(1).max(140),
  description: z.string().optional(),
  link: z.string().regex(/^https?:\/\//),
  category_id: z.string().uuid(),
  tags: z.array(z.string()).max(6).optional(),
  art_kind: z.string().optional(),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  cover_url: z.string().url().optional(),
  built_with: z.array(z.enum(AI_MODEL_SLUGS)).max(3).optional(),
});

export const publishApp: ToolDescriptor = {
  name: 'publish_app',
  description:
    'Publish a new app as the authenticated user. The DB trigger derives the slug from the title.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'App title.' },
      tagline: {
        type: 'string',
        description: 'Short tagline (max 140 chars).',
        maxLength: 140,
      },
      description: { type: 'string', description: 'Longer description (Markdown OK).' },
      link: {
        type: 'string',
        description: 'URL of the app (must start with http:// or https://).',
      },
      category_id: { type: 'string', description: 'UUID of the category.' },
      tags: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 6,
        description: 'Up to 6 tags.',
      },
      art_kind: { type: 'string', description: 'Art style (gradient, emoji, cover, etc.).' },
      accent: {
        type: 'string',
        description: 'Hex accent colour e.g. #ff6600.',
        pattern: '^#[0-9a-fA-F]{6}$',
      },
      cover_url: { type: 'string', description: 'URL of a cover image.' },
      built_with: {
        type: 'array',
        items: { type: 'string', enum: AI_MODEL_SLUGS },
        maxItems: 3,
        description:
          'Optional AI models used to build this app. Up to 3 from: claude, deepseek, gemini, github-copilot, gpt, kimi, mistral, qwen.',
      },
    },
    required: ['title', 'tagline', 'link', 'category_id'],
  },
  async handler(args, ctx) {
    const parsed = PublishAppSchema.parse(args);
    const sb = ctx.supabase;

    // The apps_set_slug BEFORE INSERT trigger rewrites slug='' with a title-derived slug.
    const { data, error } = await sb
      .from('apps')
      .insert({
        author_id: ctx.userId,
        title: parsed.title,
        tagline: parsed.tagline,
        description: parsed.description ?? '',
        link: parsed.link,
        category_id: parsed.category_id,
        tags: parsed.tags ?? [],
        art_kind: parsed.art_kind ?? 'gradient',
        accent: parsed.accent ?? '#6366f1',
        cover_url: parsed.cover_url ?? null,
        built_with: parsed.built_with ?? [],
        slug: '', // trigger overwrites with title-derived slug
        is_published: true,
      })
      .select('id, slug')
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('duplicate_slug');
      throw new Error('db_error');
    }

    return jsonResult({ id: data.id, slug: data.slug });
  },
};

// ---------------------------------------------------------------------------
// update_app
// ---------------------------------------------------------------------------

const UpdateAppSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1).optional(),
  tagline: z.string().min(1).max(140).optional(),
  description: z.string().optional(),
  link: z
    .string()
    .regex(/^https?:\/\//)
    .optional(),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string()).max(6).optional(),
  art_kind: z.string().optional(),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  cover_url: z.string().url().optional(),
  is_published: z.boolean().optional(),
  built_with: z.array(z.enum(AI_MODEL_SLUGS)).max(3).optional(),
});

export const updateApp: ToolDescriptor = {
  name: 'update_app',
  description:
    'Update an existing app. Only the authenticated user (owner) may update their own app.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'The app slug to update.' },
      title: { type: 'string' },
      tagline: { type: 'string', maxLength: 140 },
      description: { type: 'string' },
      link: { type: 'string' },
      category_id: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' }, maxItems: 6 },
      art_kind: { type: 'string' },
      accent: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      cover_url: { type: 'string' },
      is_published: { type: 'boolean' },
      built_with: {
        type: 'array',
        items: { type: 'string', enum: AI_MODEL_SLUGS },
        maxItems: 3,
        description:
          'Optional AI models used to build this app. Up to 3 from: claude, deepseek, gemini, github-copilot, gpt, kimi, mistral, qwen.',
      },
    },
    required: ['slug'],
  },
  async handler(args, ctx) {
    const { slug, ...fields } = UpdateAppSchema.parse(args);
    const sb = ctx.supabase;

    // Step 1: ownership check
    const { data: existing, error: selectError } = await sb
      .from('apps')
      .select('id, author_id')
      .eq('slug', slug)
      .maybeSingle();

    if (selectError) {
      // eslint-disable-next-line no-console
      console.error('mcp db_error', {
        message: selectError.message,
        code: (selectError as { code?: string }).code,
      });
      throw new Error('db_error');
    }
    if (!existing) throw new Error('not_found');
    if (existing.author_id !== ctx.userId) throw new Error('forbidden');

    // Step 2: build the partial update payload from only provided fields
    const updatePayload: AppUpdate = {};
    if (fields.title !== undefined) updatePayload.title = fields.title;
    if (fields.tagline !== undefined) updatePayload.tagline = fields.tagline;
    if (fields.description !== undefined) updatePayload.description = fields.description;
    if (fields.link !== undefined) updatePayload.link = fields.link;
    if (fields.category_id !== undefined) updatePayload.category_id = fields.category_id;
    if (fields.tags !== undefined) updatePayload.tags = fields.tags;
    if (fields.art_kind !== undefined) updatePayload.art_kind = fields.art_kind;
    if (fields.accent !== undefined) updatePayload.accent = fields.accent;
    if (fields.cover_url !== undefined) updatePayload.cover_url = fields.cover_url;
    if (fields.is_published !== undefined) updatePayload.is_published = fields.is_published;
    if (fields.built_with !== undefined) updatePayload.built_with = fields.built_with;

    // HATCH-007 fix: close the TOCTOU window between the SELECT-for-ownership
    // and the UPDATE by binding the UPDATE to `author_id = ctx.userId` as well.
    // If the row was transferred to another user between the two queries, the
    // UPDATE matches zero rows and we reject with `forbidden` (same as the
    // ownership check would have produced if it had been a single statement).
    const { data, error } = await sb
      .from('apps')
      .update(updatePayload)
      .eq('id', existing.id)
      .eq('author_id', ctx.userId)
      .select('*')
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('mcp db_error', {
        message: error.message,
        code: (error as { code?: string }).code,
      });
      throw new Error('db_error');
    }
    if (!data) throw new Error('forbidden');

    return jsonResult(data);
  },
};
