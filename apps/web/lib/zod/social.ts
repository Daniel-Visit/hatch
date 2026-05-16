import { z } from 'zod';

export const LikeToggleInput = z.object({
  appId: z.string().uuid(),
  slug: z.string().min(1),
});
export type LikeToggleInputT = z.infer<typeof LikeToggleInput>;

export const SaveToggleInput = z.object({
  appId: z.string().uuid(),
  slug: z.string().min(1),
});
export type SaveToggleInputT = z.infer<typeof SaveToggleInput>;

export const FollowToggleInput = z.object({
  followeeId: z.string().uuid(),
  followeeHandle: z.string().min(1),
  followerHandle: z.string().min(1),
});
export type FollowToggleInputT = z.infer<typeof FollowToggleInput>;

export const CommentCreateInput = z.object({
  appId: z.string().uuid(),
  slug: z.string().min(1),
  body: z.string().trim().min(1).max(2000),
  parentId: z.string().uuid().optional(),
});
export type CommentCreateInputT = z.infer<typeof CommentCreateInput>;

export const CommentDeleteInput = z.object({
  commentId: z.string().uuid(),
  slug: z.string().min(1),
});
export type CommentDeleteInputT = z.infer<typeof CommentDeleteInput>;

export const CommentLikeToggleInput = z.object({
  commentId: z.string().uuid(),
  slug: z.string().min(1),
});
export type CommentLikeToggleInputT = z.infer<typeof CommentLikeToggleInput>;
