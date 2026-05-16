'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SearchInput, type SearchInputT } from '@/lib/zod/search';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export interface SearchResultApp {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  accent: string;
  art_kind: string;
  hue: number;
  category_id: string;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  hot_score: number;
  published_at: string;
  cover_url: string | null;
  author: {
    handle: string;
    display_name: string;
    avatar_url: string | null;
    hue: number;
    emoji: string;
  } | null;
}

export async function searchApps(
  input: SearchInputT,
): Promise<Result<{ apps: SearchResultApp[]; query: string }>> {
  const parsed = SearchInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const { query, limit } = parsed.data;
  const sb = await createSupabaseServerClient();

  const { data, error } = await sb
    .from('apps')
    .select(
      'id, slug, title, tagline, accent, art_kind, hue, category_id, likes_count, comments_count, saves_count, hot_score, published_at, cover_url, author:profiles!apps_author_id_fkey(handle, display_name, avatar_url, hue, emoji)',
    )
    .eq('is_published', true)
    .textSearch('search_vector', query, { type: 'plain', config: 'simple' })
    .order('hot_score', { ascending: false })
    .limit(Math.min(limit ?? 30, 50));

  if (error) return { ok: false, error: 'db_error' };

  // Supabase types the joined author as an array because of FK orientation;
  // we know it's always 0-or-1 with .single FK, so normalize.
  const apps = (data ?? []).map((row) => ({
    ...row,
    author: Array.isArray(row.author) ? (row.author[0] ?? null) : row.author,
  })) as SearchResultApp[];

  return { ok: true, data: { apps, query } };
}
