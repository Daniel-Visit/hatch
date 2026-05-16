import { z } from 'zod';

export const SearchInput = z.object({
  query: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type SearchInputT = z.infer<typeof SearchInput>;
