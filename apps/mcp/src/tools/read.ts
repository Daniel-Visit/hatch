import { z } from 'zod';
import { jsonResult, type McpContext, type ToolResult } from '../types.js';

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
// list_apps
// ---------------------------------------------------------------------------

const ListAppsSchema = z.object({
  cursor: z.string().datetime({ offset: true }).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const listApps: ToolDescriptor = {
  name: 'list_apps',
  description:
    'List published apps ordered by published_at descending. Supports cursor-based pagination.',
  inputSchema: {
    type: 'object',
    properties: {
      cursor: {
        type: 'string',
        format: 'date-time',
        description: 'ISO timestamp — return apps published before this cursor.',
      },
      limit: {
        type: 'number',
        description: 'Max results (default 20, max 50).',
      },
    },
  },
  async handler(args, ctx) {
    const { cursor, limit } = ListAppsSchema.parse(args);
    const sb = ctx.supabase;

    let query = sb
      .from('apps')
      .select(
        'id, slug, title, tagline, description, link, category_id, cover_url, art_kind, accent, tags, built_with, is_published, published_at, likes_count, saves_count, comments_count, views_count, hue, bg, hot_score, author:profiles!apps_author_id_fkey(handle, display_name, avatar_url, hue, emoji)',
      )
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('published_at', cursor);
    }

    const { data, error } = await query;
    if (error) {
      // eslint-disable-next-line no-console
      console.error('mcp db_error', {
        message: error.message,
        code: (error as { code?: string }).code,
      });
      throw new Error('db_error');
    }

    const apps = data ?? [];
    const next_cursor = apps.length === limit ? apps[apps.length - 1]?.published_at : undefined;

    return jsonResult({ apps, ...(next_cursor ? { next_cursor } : {}) });
  },
};

// ---------------------------------------------------------------------------
// search_apps
// ---------------------------------------------------------------------------

const SearchAppsSchema = z.object({
  query: z.string().min(2),
  limit: z.number().int().min(1).max(50).default(20),
});

export const searchApps: ToolDescriptor = {
  name: 'search_apps',
  description: 'Full-text search across published apps using Postgres search_vector.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms (min 2 chars).',
        minLength: 2,
      },
      limit: {
        type: 'number',
        description: 'Max results (default 20, max 50).',
      },
    },
    required: ['query'],
  },
  async handler(args, ctx) {
    const { query, limit } = SearchAppsSchema.parse(args);
    const sb = ctx.supabase;

    const { data, error } = await sb
      .from('apps')
      .select(
        'id, slug, title, tagline, description, link, category_id, cover_url, art_kind, accent, tags, built_with, is_published, published_at, likes_count, saves_count, comments_count, views_count, hue, bg, hot_score, author:profiles!apps_author_id_fkey(handle, display_name, avatar_url, hue, emoji)',
      )
      .eq('is_published', true)
      .textSearch('search_vector', query, { type: 'plain', config: 'english' })
      .order('hot_score', { ascending: false })
      .limit(limit);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('mcp db_error', {
        message: error.message,
        code: (error as { code?: string }).code,
      });
      throw new Error('db_error');
    }

    return jsonResult({ apps: data ?? [] });
  },
};

// ---------------------------------------------------------------------------
// get_app
// ---------------------------------------------------------------------------

const GetAppSchema = z.object({
  slug: z.string().min(1),
});

export const getApp: ToolDescriptor = {
  name: 'get_app',
  description: 'Fetch a single app by its slug, including author profile and counter columns.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'The app slug.' },
    },
    required: ['slug'],
  },
  async handler(args, ctx) {
    const { slug } = GetAppSchema.parse(args);
    const sb = ctx.supabase;

    const { data, error } = await sb
      .from('apps')
      .select(
        '*, author:profiles!apps_author_id_fkey(handle, display_name, avatar_url, hue, emoji)',
      )
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('mcp db_error', {
        message: error.message,
        code: (error as { code?: string }).code,
      });
      throw new Error('db_error');
    }
    if (!data) throw new Error('not_found');

    return jsonResult(data);
  },
};

// ---------------------------------------------------------------------------
// list_categories
// ---------------------------------------------------------------------------

const ListCategoriesSchema = z.object({});

export const listCategories: ToolDescriptor = {
  name: 'list_categories',
  description: 'Return all app categories ordered by sort_order.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  async handler(args, ctx) {
    ListCategoriesSchema.parse(args);
    const sb = ctx.supabase;

    const { data, error } = await sb
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('mcp db_error', {
        message: error.message,
        code: (error as { code?: string }).code,
      });
      throw new Error('db_error');
    }

    return jsonResult({ categories: data ?? [] });
  },
};

// ---------------------------------------------------------------------------
// get_profile
// ---------------------------------------------------------------------------

const GetProfileSchema = z.object({
  handle: z.string().min(1),
});

export const getProfile: ToolDescriptor = {
  name: 'get_profile',
  description: 'Fetch a user profile by handle, including published app count and follower count.',
  inputSchema: {
    type: 'object',
    properties: {
      handle: { type: 'string', description: 'User handle (case-insensitive).' },
    },
    required: ['handle'],
  },
  async handler(args, ctx) {
    const { handle } = GetProfileSchema.parse(args);
    const sb = ctx.supabase;

    const { data: profile, error } = await sb
      .from('profiles')
      .select('*')
      .eq('handle', handle)
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('mcp db_error', {
        message: error.message,
        code: (error as { code?: string }).code,
      });
      throw new Error('db_error');
    }
    if (!profile) throw new Error('not_found');

    const [{ count: app_count }, { count: follower_count }] = await Promise.all([
      sb
        .from('apps')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', profile.id)
        .eq('is_published', true),
      sb
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('followee_id', profile.id),
    ]);

    return jsonResult({
      ...profile,
      app_count: app_count ?? 0,
      follower_count: follower_count ?? 0,
    });
  },
};

// ---------------------------------------------------------------------------
// list_notifications
// ---------------------------------------------------------------------------

const ListNotificationsSchema = z.object({
  unread_only: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const listNotifications: ToolDescriptor = {
  name: 'list_notifications',
  description: "List the authenticated user's notifications, optionally filtering to unread only.",
  inputSchema: {
    type: 'object',
    properties: {
      unread_only: {
        type: 'boolean',
        description: 'When true, only return notifications where read_at is null.',
      },
      limit: {
        type: 'number',
        description: 'Max results (default 20, max 100).',
      },
    },
  },
  async handler(args, ctx) {
    const { unread_only, limit } = ListNotificationsSchema.parse(args);
    const sb = ctx.supabase;

    // Service-role bypasses RLS; we scope manually to ctx.userId.
    let query = sb
      .from('notifications')
      .select('*')
      .eq('recipient_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unread_only) {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;
    if (error) {
      // eslint-disable-next-line no-console
      console.error('mcp db_error', {
        message: error.message,
        code: (error as { code?: string }).code,
      });
      throw new Error('db_error');
    }

    return jsonResult({ notifications: data ?? [] });
  },
};
