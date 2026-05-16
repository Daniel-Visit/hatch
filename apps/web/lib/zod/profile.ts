import { z } from 'zod';

export const ProfileLinkSchema = z.object({
  label: z.string().min(1).max(40),
  url: z.string().url(),
});

export const UpdateProfileInput = z.object({
  display_name: z.string().min(1).max(60),
  bio: z.string().max(280).nullable(),
  links: z.array(ProfileLinkSchema).max(8),
  hue: z.number().int().min(0).max(360),
  banner_gradient: z.string().max(400).nullable(),
});

export type UpdateProfileInputType = z.infer<typeof UpdateProfileInput>;
