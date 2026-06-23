import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import {
  MATCHER_RERANK_MODEL,
  MATCHER_PHASE_A_RERANK_PROMPT,
  type BriefContent,
} from '@hatch/shared';
import type { AppCandidate, CandidateRetriever } from './retriever';

/**
 * Matcher Phase A — App-first (`new/03-agents.md` §3.2.1).
 *
 * retrieve apps → pre-filter (done in the retriever) → single batched Haiku
 * re-rank → thresholds (>= 75 strong, >= 60 keep) → top 3.
 *
 * The Anthropic client is INJECTED (mirrors `agents/refiner.ts`) so the re-rank
 * is unit-testable with a mocked client. The retriever is injected too.
 *
 * This module performs NO database writes — it returns ranked candidates + the
 * audit payload; `run.ts` persists matches + audit logs via the admin repos.
 *
 * Anti-injection (§3.2.6): brief + candidate text are wrapped in `<brief>` /
 * `<apps>` delimiters and the system prompt (`MATCHER_PHASE_A_RERANK_PROMPT`)
 * reminds the model that delimited content is DATA, not instructions. Re-rank
 * scores >= 90 whose rationale contains injection trigger phrases are flagged.
 */

const STRONG_THRESHOLD = 75;
const KEEP_THRESHOLD = 60;
const TOP_N = 3;
const MAX_TOKENS = 2048;
const TEMPERATURE = 0;

/** Trigger phrases that suggest a prompt-injection-influenced high score. */
const INJECTION_TRIGGERS = [
  'instructed to',
  'told to',
  'score high because',
  'ignore prior',
  'ignore previous',
  'as instructed',
  'you must score',
];

/** A scored candidate after the Haiku re-rank. */
export interface ScoredApp {
  app: AppCandidate;
  score: number;
  rationale: string;
  /** True if this score tripped the §3.2.6 injection heuristic. */
  flagged: boolean;
}

export interface PhaseAResult {
  /** Top-N kept candidates (score >= KEEP_THRESHOLD), sorted desc by score. */
  ranked: ScoredApp[];
  /** True if any candidate scored >= STRONG_THRESHOLD ("might already exist"). */
  hasStrongMatch: boolean;
  /** All scored candidates (for the audit log), sorted desc. */
  allScored: ScoredApp[];
  /** Count of candidates retrieved + considered (pre-threshold). */
  consideredCount: number;
  /** Model identifier used for the re-rank. */
  modelUsed: string;
  /** Wall-clock duration of the phase in milliseconds. */
  durationMs: number;
  /** Token usage from the re-rank call. */
  tokensIn: number;
  tokensOut: number;
}

/**
 * Wrap brief content as delimited DATA for the LLM (§3.2.6). We serialize the
 * structured brief to JSON; the prompt template already provides the
 * surrounding `<brief>...</brief>` delimiters.
 */
export function serializeBriefForRerank(brief: BriefContent): string {
  return JSON.stringify(brief);
}

/** Enumerate app candidates as delimited, numbered data blocks for the prompt. */
export function enumerateAppSummaries(apps: AppCandidate[]): string {
  return apps
    .map((app, i) => {
      const solves =
        app.solvesProblems.length > 0 ? `\n  solves: ${app.solvesProblems.join(', ')}` : '';
      const tags = app.tags.length > 0 ? `\n  tags: ${app.tags.join(', ')}` : '';
      return [
        `<app index="${i}" appId="${app.id}">`,
        `  ${app.title} — ${app.tagline}`,
        `  category: ${app.categoryId}`,
        `  ${app.description}`.trimEnd() + solves + tags,
        `</app>`,
      ].join('\n');
    })
    .join('\n');
}

/** One raw re-rank row as emitted by the model. */
export type RerankRow = { id: string; score: number; rationale: string };

/**
 * Extract the JSON array from a model response. Tolerates surrounding prose and
 * code fences. Returns [] on any parse failure (the caller degrades to keeping
 * no candidates rather than throwing — a malformed re-rank must not crash a run).
 *
 * `idKey` is the field name the prompt asked for (`appId` / `builderId`); we
 * normalize it to `id`.
 */
export function parseRerankJson(text: string, idKey: string): RerankRow[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const rows: RerankRow[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    const id = rec[idKey] ?? rec.id;
    const score = rec.score;
    const rationale = rec.rationale;
    if (typeof id !== 'string') continue;
    if (typeof score !== 'number') continue;
    rows.push({
      id,
      score: Math.max(0, Math.min(100, score)),
      rationale: typeof rationale === 'string' ? rationale : '',
    });
  }
  return rows;
}

/** Apply the §3.2.6 high-score-injection heuristic to a single scored row. */
export function isInjectionFlagged(score: number, rationale: string): boolean {
  if (score < 90) return false;
  const lower = rationale.toLowerCase();
  return INJECTION_TRIGGERS.some((t) => lower.includes(t));
}

/**
 * Core batched re-rank LLM call, shared by Phase A and Phase B (phase-b.ts
 * imports this). Sends ONE Haiku message: the fully-interpolated re-rank prompt
 * (rules + delimited brief + candidates) is delivered as a single USER turn —
 * NOT as an Anthropic `system` block. There is no system block here.
 *
 * Naming note: the parameter is called `rerankPrompt`, not `systemPrompt`,
 * because it is sent as user-turn content. Using "system" would invite a
 * cargo-cult mistake where a future caller adds prompt caching expecting a
 * real system block, which would silently not cache.
 *
 * Exported so Phase B reuses identical anti-injection + parsing behavior.
 */
export async function runRerank(args: {
  anthropic: Anthropic;
  /** Fully-interpolated re-rank prompt sent as the single user-turn message. */
  rerankPrompt: string;
  /** Field name the prompt asked the model to key on (`appId`/`builderId`). */
  idKey: string;
}): Promise<{ rows: RerankRow[]; tokensIn: number; tokensOut: number }> {
  const { anthropic, rerankPrompt, idKey } = args;

  const message = await anthropic.messages.create({
    model: MATCHER_RERANK_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    // The whole prompt (rules + delimited brief + candidates) is supplied as a
    // single user turn; the rules already mark delimited content as DATA.
    messages: [{ role: 'user', content: [{ type: 'text', text: rerankPrompt }] }],
  });

  const text = message.content
    .filter(
      (b): b is Anthropic.TextBlock =>
        typeof b === 'object' && b !== null && (b as { type?: unknown }).type === 'text',
    )
    .map((b) => b.text)
    .join('');

  return {
    rows: parseRerankJson(text, idKey),
    tokensIn: message.usage.input_tokens,
    tokensOut: message.usage.output_tokens,
  };
}

/**
 * Fill the Phase A prompt template with the delimited brief + enumerated apps.
 */
export function buildPhaseAPrompt(brief: BriefContent, apps: AppCandidate[]): string {
  return MATCHER_PHASE_A_RERANK_PROMPT.replace(
    '{briefContent}',
    serializeBriefForRerank(brief),
  ).replace('{enumeratedAppSummaries}', enumerateAppSummaries(apps));
}

/**
 * Run Phase A end-to-end (retrieve → re-rank → threshold → top 3). Pure of DB
 * writes; `run.ts` persists the result.
 */
export async function runPhaseA(args: {
  anthropic: Anthropic;
  retriever: CandidateRetriever;
  brief: BriefContent;
  k?: number;
}): Promise<PhaseAResult> {
  const { anthropic, retriever, brief, k = 30 } = args;
  const startedAt = Date.now();

  const apps = await retriever.retrieveApps(brief, k);

  // No candidates → empty result, but still a valid (auditable) phase run.
  if (apps.length === 0) {
    return {
      ranked: [],
      hasStrongMatch: false,
      allScored: [],
      consideredCount: 0,
      modelUsed: MATCHER_RERANK_MODEL,
      durationMs: Date.now() - startedAt,
      tokensIn: 0,
      tokensOut: 0,
    };
  }

  const { rows, tokensIn, tokensOut } = await runRerank({
    anthropic,
    rerankPrompt: buildPhaseAPrompt(brief, apps),
    idKey: 'appId',
  });

  const scoreById = new Map(rows.map((r) => [r.id, r]));

  const allScored: ScoredApp[] = apps
    .map((app): ScoredApp => {
      const row = scoreById.get(app.id);
      const score = row?.score ?? 0;
      const rationale = row?.rationale ?? '';
      return {
        app,
        score,
        rationale,
        flagged: isInjectionFlagged(score, rationale),
      };
    })
    .sort((a, b) => b.score - a.score);

  const kept = allScored.filter((s) => s.score >= KEEP_THRESHOLD);
  const ranked = kept.slice(0, TOP_N);
  const hasStrongMatch = allScored.some((s) => s.score >= STRONG_THRESHOLD);

  return {
    ranked,
    hasStrongMatch,
    allScored,
    consideredCount: apps.length,
    modelUsed: MATCHER_RERANK_MODEL,
    durationMs: Date.now() - startedAt,
    tokensIn,
    tokensOut,
  };
}

export const PHASE_A_THRESHOLDS = {
  STRONG: STRONG_THRESHOLD,
  KEEP: KEEP_THRESHOLD,
  TOP_N,
} as const;
