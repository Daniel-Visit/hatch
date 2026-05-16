import { z } from 'zod';

export const PushSubscribeInput = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  userAgent: z.string().optional(),
});
export type PushSubscribeInputT = z.infer<typeof PushSubscribeInput>;

export const PushUnsubscribeInput = z.object({
  endpoint: z.string().url(),
});
export type PushUnsubscribeInputT = z.infer<typeof PushUnsubscribeInput>;
