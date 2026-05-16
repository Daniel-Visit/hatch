import { z } from 'zod';
import { jsonResult, type McpContext, type ToolResult } from '../types.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  handler: (args: unknown, ctx: McpContext) => Promise<ToolResult>;
}

const SlugSchema = z.object({ slug: z.string().min(1) });
const HandleSchema = z.object({ handle: z.string().min(1) });

/** Resolve app id from slug; throws not_found if missing. */
async function resolveAppId(slug: string, ctx: McpContext): Promise<string> {
  const { data, error } = await ctx.supabase
    .from('apps')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`db_error: ${error.message}`);
  if (!data) throw new Error('not_found');
  return data.id;
}

/** Resolve profile id from handle; throws not_found if missing. */
async function resolveProfileId(handle: string, ctx: McpContext): Promise<string> {
  const { data, error } = await ctx.supabase
    .from('profiles')
    .select('id')
    .eq('handle', handle)
    .maybeSingle();
  if (error) throw new Error(`db_error: ${error.message}`);
  if (!data) throw new Error('not_found');
  return data.id;
}

// ---------------------------------------------------------------------------
// like_app
// ---------------------------------------------------------------------------

export const likeApp: ToolDescriptor = {
  name: 'like_app',
  description: 'Like an app (idempotent — safe to call even if already liked).',
  inputSchema: {
    type: 'object',
    properties: { slug: { type: 'string', description: 'The app slug.' } },
    required: ['slug'],
  },
  async handler(args, ctx) {
    const { slug } = SlugSchema.parse(args);
    const appId = await resolveAppId(slug, ctx);

    const { error } = await ctx.supabase
      .from('likes')
      .insert({ user_id: ctx.userId, app_id: appId });

    // 23505 = unique_violation → already liked; treat as success (idempotent)
    if (error && error.code !== '23505') throw new Error(`db_error: ${error.message}`);

    return jsonResult({ ok: true, liked: true });
  },
};

// ---------------------------------------------------------------------------
// unlike_app
// ---------------------------------------------------------------------------

export const unlikeApp: ToolDescriptor = {
  name: 'unlike_app',
  description: 'Remove a like from an app (idempotent — safe even if not liked).',
  inputSchema: {
    type: 'object',
    properties: { slug: { type: 'string', description: 'The app slug.' } },
    required: ['slug'],
  },
  async handler(args, ctx) {
    const { slug } = SlugSchema.parse(args);
    const appId = await resolveAppId(slug, ctx);

    const { error } = await ctx.supabase
      .from('likes')
      .delete()
      .eq('user_id', ctx.userId)
      .eq('app_id', appId);

    if (error) throw new Error(`db_error: ${error.message}`);

    return jsonResult({ ok: true, liked: false });
  },
};

// ---------------------------------------------------------------------------
// save_app
// ---------------------------------------------------------------------------

export const saveApp: ToolDescriptor = {
  name: 'save_app',
  description: "Save an app to the authenticated user's collection (idempotent).",
  inputSchema: {
    type: 'object',
    properties: { slug: { type: 'string', description: 'The app slug.' } },
    required: ['slug'],
  },
  async handler(args, ctx) {
    const { slug } = SlugSchema.parse(args);
    const appId = await resolveAppId(slug, ctx);

    const { error } = await ctx.supabase
      .from('saves')
      .insert({ user_id: ctx.userId, app_id: appId });

    // 23505 = unique_violation → already saved; treat as success
    if (error && error.code !== '23505') throw new Error(`db_error: ${error.message}`);

    return jsonResult({ ok: true, saved: true });
  },
};

// ---------------------------------------------------------------------------
// unsave_app
// ---------------------------------------------------------------------------

export const unsaveApp: ToolDescriptor = {
  name: 'unsave_app',
  description: "Remove a saved app from the authenticated user's collection (idempotent).",
  inputSchema: {
    type: 'object',
    properties: { slug: { type: 'string', description: 'The app slug.' } },
    required: ['slug'],
  },
  async handler(args, ctx) {
    const { slug } = SlugSchema.parse(args);
    const appId = await resolveAppId(slug, ctx);

    const { error } = await ctx.supabase
      .from('saves')
      .delete()
      .eq('user_id', ctx.userId)
      .eq('app_id', appId);

    if (error) throw new Error(`db_error: ${error.message}`);

    return jsonResult({ ok: true, saved: false });
  },
};

// ---------------------------------------------------------------------------
// follow_user
// ---------------------------------------------------------------------------

export const followUser: ToolDescriptor = {
  name: 'follow_user',
  description: 'Follow a user by handle (idempotent). Cannot follow yourself.',
  inputSchema: {
    type: 'object',
    properties: { handle: { type: 'string', description: 'Handle of the user to follow.' } },
    required: ['handle'],
  },
  async handler(args, ctx) {
    const { handle } = HandleSchema.parse(args);
    const followeeId = await resolveProfileId(handle, ctx);

    if (followeeId === ctx.userId) throw new Error('cannot_follow_self');

    const { error } = await ctx.supabase
      .from('follows')
      .insert({ follower_id: ctx.userId, followee_id: followeeId });

    // 23505 = already following; idempotent
    if (error && error.code !== '23505') throw new Error(`db_error: ${error.message}`);

    return jsonResult({ ok: true, following: true });
  },
};

// ---------------------------------------------------------------------------
// unfollow_user
// ---------------------------------------------------------------------------

export const unfollowUser: ToolDescriptor = {
  name: 'unfollow_user',
  description: 'Unfollow a user by handle (idempotent).',
  inputSchema: {
    type: 'object',
    properties: { handle: { type: 'string', description: 'Handle of the user to unfollow.' } },
    required: ['handle'],
  },
  async handler(args, ctx) {
    const { handle } = HandleSchema.parse(args);
    const followeeId = await resolveProfileId(handle, ctx);

    const { error } = await ctx.supabase
      .from('follows')
      .delete()
      .eq('follower_id', ctx.userId)
      .eq('followee_id', followeeId);

    if (error) throw new Error(`db_error: ${error.message}`);

    return jsonResult({ ok: true, following: false });
  },
};

// ---------------------------------------------------------------------------
// send_message
// ---------------------------------------------------------------------------

const SendMessageSchema = z.object({
  to_handle: z.string().min(1),
  body: z.string().min(1).max(4000),
  app_id: z.string().uuid().optional(),
});

export const sendMessage: ToolDescriptor = {
  name: 'send_message',
  description:
    'Send a direct message to another user. Both parties must have an accepted contact request.',
  inputSchema: {
    type: 'object',
    properties: {
      to_handle: { type: 'string', description: 'Handle of the message recipient.' },
      body: { type: 'string', description: 'Message body (1–4000 chars).', maxLength: 4000 },
      app_id: {
        type: 'string',
        description: 'Optional app UUID to associate with the conversation.',
      },
    },
    required: ['to_handle', 'body'],
  },
  async handler(args, ctx) {
    const { to_handle, body, app_id } = SendMessageSchema.parse(args);
    const sb = ctx.supabase;

    // Resolve recipient
    const recipientId = await resolveProfileId(to_handle, ctx);
    if (recipientId === ctx.userId) throw new Error('cannot_message_self');

    // Verify accepted contact request exists in either direction
    const { data: cr } = await sb
      .from('contact_requests')
      .select('id')
      .or(
        `and(sender_id.eq.${ctx.userId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${ctx.userId})`,
      )
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle();

    if (!cr) throw new Error('no_accepted_contact_request');

    // Find or create conversation via SECURITY DEFINER RPC.
    // The generated type has app: string, but the SQL function accepts NULL — cast to satisfy TS.
    const { data: conversationId, error: rpcError } = await sb.rpc('find_or_create_conversation', {
      user_a: ctx.userId,
      user_b: recipientId,
      app: (app_id ?? null) as string,
    });

    if (rpcError || !conversationId) {
      throw new Error(`rpc_error: ${rpcError?.message ?? 'no conversation id returned'}`);
    }

    // Insert the message — DB trigger fires 'message' notification automatically
    const { data: message, error: msgError } = await sb
      .from('messages')
      .insert({
        conversation_id: conversationId as string,
        sender_id: ctx.userId,
        body,
      })
      .select('id, conversation_id')
      .single();

    if (msgError || !message) throw new Error(`db_error: ${msgError?.message ?? 'insert failed'}`);

    return jsonResult({ id: message.id, conversation_id: message.conversation_id });
  },
};
