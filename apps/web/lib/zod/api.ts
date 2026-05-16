import { z } from 'zod';

export const ApiAppsList = z.object({
  category: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().datetime().optional(), // ISO timestamp for keyset pagination by published_at
});
export type ApiAppsListT = z.infer<typeof ApiAppsList>;

export const ApiAppDetail = z.object({
  slug: z.string().min(1).max(200),
});
export type ApiAppDetailT = z.infer<typeof ApiAppDetail>;

export const ApiProfileDetail = z.object({
  handle: z.string().min(1).max(64),
});
export type ApiProfileDetailT = z.infer<typeof ApiProfileDetail>;

export const ApiSearch = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
export type ApiSearchT = z.infer<typeof ApiSearch>;
