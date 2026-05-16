import { z } from 'zod';

export const NotificationPrefsUpdate = z.object({
  push_enabled: z.boolean().optional(),
  push_likes: z.boolean().optional(),
  push_follows: z.boolean().optional(),
  push_comments: z.boolean().optional(),
  push_messages: z.boolean().optional(),
  push_contact_requests: z.boolean().optional(),
});
export type NotificationPrefsUpdateT = z.infer<typeof NotificationPrefsUpdate>;

export const NotificationPrefs = z.object({
  push_enabled: z.boolean(),
  push_likes: z.boolean(),
  push_follows: z.boolean(),
  push_comments: z.boolean(),
  push_messages: z.boolean(),
  push_contact_requests: z.boolean(),
});
export type NotificationPrefsT = z.infer<typeof NotificationPrefs>;
