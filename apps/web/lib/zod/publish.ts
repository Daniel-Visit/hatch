import { z } from 'zod';

// Source of truth: prototype/apps-gallery/publish.jsx line 5
export const ART_KINDS = [
  'pixel',
  'palette',
  'cursor',
  'dj',
  'roast',
  'fog',
  'bingo',
  'snail',
  'karaoke',
  'tinydraw',
  'pasta',
  'letter',
] as const;
export type ArtKind = (typeof ART_KINDS)[number];

// Source of truth: prototype/apps-gallery/publish.jsx line 6
export const ACCENT_COLORS = [
  '#ff7a59',
  '#f59e0b',
  '#84cc16',
  '#06b6d4',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
  '#f43f5e',
] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

export const ArtKindEnum = z.enum(ART_KINDS);
export const AccentColorEnum = z.enum(ACCENT_COLORS);

// Constraints match prototype/apps-gallery/publish.jsx:
// - title: maxLength={32} (line 75)
// - tagline: maxLength={90} (line 81)
// - description: no maxLength in prototype, cap at 10000 server-side as a defensive limit
// - link: must be http(s):// URL (matches DB check `link ~ '^https?://'`)
// - tags: max 6 (line 130)
export const PublishAppInput = z.object({
  title: z.string().trim().min(1).max(32),
  tagline: z.string().trim().min(1).max(90),
  description: z.string().max(10000).default(''),
  link: z
    .string()
    .url()
    .regex(/^https?:\/\//i, 'Link must start with http(s)://'),
  categoryId: z.string().min(1),
  tags: z.array(z.string().trim().min(1)).max(6).default([]),
  artKind: ArtKindEnum,
  accent: AccentColorEnum,
  coverUrl: z.string().nullable().optional(),
});
export type PublishAppInputT = z.infer<typeof PublishAppInput>;

export const CoverUploadInput = z.object({
  filename: z.string().regex(/\.(png|jpe?g|webp)$/i, 'Cover must be PNG, JPG, or WEBP'),
});
export type CoverUploadInputT = z.infer<typeof CoverUploadInput>;
