import { z } from 'zod';

export const MessageSend = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});
export type MessageSendT = z.infer<typeof MessageSend>;

export const ConversationMarkRead = z.object({
  conversationId: z.string().uuid(),
});
export type ConversationMarkReadT = z.infer<typeof ConversationMarkRead>;
