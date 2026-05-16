import { z } from 'zod';

export const NotifKind = z.enum([
  'contact_request',
  'contact_accepted',
  'contact_declined',
  'like',
  'comment',
  'comment_reply',
  'follow',
  'message',
]);
export type NotifKindT = z.infer<typeof NotifKind>;

export const NotificationRead = z.object({
  id: z.string().uuid(),
});
export type NotificationReadT = z.infer<typeof NotificationRead>;

export const NotificationFilter = z.object({
  kind: NotifKind.optional(),
  unreadOnly: z.boolean().optional(),
  cursor: z.string().optional(), // ISO timestamp
});
export type NotificationFilterT = z.infer<typeof NotificationFilter>;
