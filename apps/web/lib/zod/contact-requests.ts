import { z } from 'zod';

export const ContactRequestCreate = z.object({
  appId: z.string().uuid(),
  recipientId: z.string().uuid(),
  role: z.enum(['investor', 'partner', 'hire', 'fan']),
  note: z.string().trim().max(600),
  link: z.string().url().optional(),
  consent: z.literal(true),
});
export type ContactRequestCreateT = z.infer<typeof ContactRequestCreate>;

export const ContactRequestRespond = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['accept', 'decline']),
});
export type ContactRequestRespondT = z.infer<typeof ContactRequestRespond>;
