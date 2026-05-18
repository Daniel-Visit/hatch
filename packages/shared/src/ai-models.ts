// Built-with AI models — single source of truth.
// Adding a new model requires:
//   1. Append { slug, name } below.
//   2. Update the CHECK constraint in a new migration
//      (see packages/db/migrations/0029_apps_built_with.sql).
//   3. No i18n key needed — `aiModelName(slug)` returns the display name
//      from this module (single source of truth, AI vendor names are product
//      nouns not translated).

// Slugs declared as a tuple `as const` so `z.enum(AI_MODEL_SLUGS)` infers
// the literal union, matching Zod's required `[string, ...string[]]` shape
// without a cast (which the MCP package's stricter tsconfig rejects).
export const AI_MODEL_SLUGS = [
  'claude',
  'deepseek',
  'gemini',
  'github-copilot',
  'gpt',
  'kimi',
  'mistral',
  'qwen',
] as const;

export type AiModelSlug = (typeof AI_MODEL_SLUGS)[number];

export const AI_MODELS: ReadonlyArray<{ slug: AiModelSlug; name: string }> = [
  { slug: 'claude', name: 'Claude' },
  { slug: 'deepseek', name: 'DeepSeek' },
  { slug: 'gemini', name: 'Gemini' },
  { slug: 'github-copilot', name: 'GitHub Copilot' },
  { slug: 'gpt', name: 'GPT' },
  { slug: 'kimi', name: 'Kimi' },
  { slug: 'mistral', name: 'Mistral' },
  { slug: 'qwen', name: 'Qwen' },
];

export function isAiModelSlug(s: string): s is AiModelSlug {
  return (AI_MODEL_SLUGS as readonly string[]).includes(s);
}

/** Look up the display name for a slug (or return the slug as fallback). */
export function aiModelName(slug: AiModelSlug): string {
  return AI_MODELS.find((m) => m.slug === slug)?.name ?? slug;
}
