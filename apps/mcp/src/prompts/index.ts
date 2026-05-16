import type { McpContext } from '../types.js';
import { getProfile } from '../tools/read.js';

interface PromptArg {
  name: string;
  description: string;
  required?: boolean;
}

interface PromptDescriptor {
  name: string;
  description: string;
  arguments: PromptArg[];
}

const DESCRIPTORS: PromptDescriptor[] = [
  {
    name: 'draft_app_description',
    description: 'Draft a Hatch-style app description from short builder inputs.',
    arguments: [
      { name: 'app_name', description: 'The name of the app', required: true },
      { name: 'what_it_does', description: 'A short sentence about what it does', required: true },
      { name: 'target_audience', description: 'Who the app is for (optional)', required: false },
    ],
  },
  {
    name: 'review_my_apps',
    description: "Review the authenticated user's apps and propose copy/tag improvements.",
    arguments: [],
  },
  {
    name: 'compose_message',
    description: 'Draft a direct message in Hatch tone toward another builder.',
    arguments: [
      { name: 'to_handle', description: 'Recipient handle on Hatch', required: true },
      { name: 'intent', description: 'What you want to say (1-2 sentences)', required: true },
    ],
  },
];

export function listPrompts() {
  return DESCRIPTORS.map((d) => ({
    name: d.name,
    description: d.description,
    arguments: d.arguments,
  }));
}

function pickStr(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

export async function getPrompt(
  name: string,
  rawArgs: Record<string, unknown> | undefined,
  ctx: McpContext,
) {
  const args = rawArgs ?? {};

  if (name === 'draft_app_description') {
    const app_name = pickStr(args, 'app_name');
    const what_it_does = pickStr(args, 'what_it_does');
    const target_audience = pickStr(args, 'target_audience') ?? 'builders and indie hackers';
    if (!app_name || !what_it_does) throw new Error('missing_required_args');

    const text = [
      `Draft a Hatch-style app description for "${app_name}".`,
      `What it does: ${what_it_does}.`,
      `Target audience: ${target_audience}.`,
      ``,
      `Tone: concise, builder-friendly, 80-120 words. No marketing fluff, no exclamation marks.`,
      `Lead with the concrete problem it solves. End with the simplest call-to-action.`,
    ].join('\n');

    return {
      description: 'Draft a Hatch-style app description',
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
    };
  }

  if (name === 'review_my_apps') {
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('handle, display_name')
      .eq('id', ctx.userId)
      .maybeSingle();

    if (!profile) throw new Error('profile_not_found');

    const profileResult = await getProfile.handler({ handle: profile.handle }, ctx);
    const profileJson = profileResult.content[0]?.text ?? '{}';

    const text = [
      `Review the Hatch apps published by @${profile.handle} (${profile.display_name}).`,
      ``,
      `Profile + apps JSON:`,
      profileJson,
      ``,
      `For each app, propose 1-3 concrete improvements to the title, tagline, description,`,
      `or tag selection. Be specific. Prefer cuts over additions. Flag any apps that share`,
      `the same hook with sibling apps — those should be differentiated more sharply.`,
    ].join('\n');

    return {
      description: `Review apps for @${profile.handle}`,
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
    };
  }

  if (name === 'compose_message') {
    const to_handle = pickStr(args, 'to_handle');
    const intent = pickStr(args, 'intent');
    if (!to_handle || !intent) throw new Error('missing_required_args');

    let recipientContext = '';
    try {
      const recipientResult = await getProfile.handler({ handle: to_handle }, ctx);
      recipientContext = recipientResult.content[0]?.text ?? '';
    } catch {
      recipientContext = '(profile not found — draft a generic friendly opening)';
    }

    const text = [
      `Draft a direct message on Hatch to @${to_handle}.`,
      ``,
      `Intent: ${intent}`,
      ``,
      `Recipient context (their Hatch profile + apps):`,
      recipientContext,
      ``,
      `Style: warm, concise, 2-4 sentences max. Reference one thing from their profile or apps`,
      `that makes the message feel genuine. End with a clear next-step ask. No emojis.`,
    ].join('\n');

    return {
      description: `Compose a DM to @${to_handle}`,
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
    };
  }

  throw new Error(`unknown_prompt: ${name}`);
}
