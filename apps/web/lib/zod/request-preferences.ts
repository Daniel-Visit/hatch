import { z } from 'zod';

export const RequestPreferencesInput = z.object({
  accepts_requests: z.boolean(),
  request_capacity: z.number().int().min(0).max(20),
  request_domains: z.array(z.string().min(1).max(64)).max(32),
  inferred_capabilities: z.array(z.string().min(1).max(64)).max(32),
  request_rate_band: z
    .enum(['EXPLORATORY', 'LT_500', 'FROM_500_2K', 'FROM_2K_10K', 'GT_10K', 'OPEN'])
    .nullable(),
});

export type RequestPreferencesInputType = z.infer<typeof RequestPreferencesInput>;
