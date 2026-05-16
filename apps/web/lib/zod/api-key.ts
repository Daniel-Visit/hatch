import { z } from 'zod';

export const ApiKeyGenerate = z.object({
  label: z.string().trim().min(1).max(60).default('Claude Desktop'),
});
export type ApiKeyGenerateT = z.infer<typeof ApiKeyGenerate>;

export const ApiKeyRevoke = z.object({
  id: z.string().uuid(),
});
export type ApiKeyRevokeT = z.infer<typeof ApiKeyRevoke>;
