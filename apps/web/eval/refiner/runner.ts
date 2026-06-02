/**
 * Eval runner for the Wanted Refiner.
 *
 * Drives a multi-turn conversation using a real Anthropic client, collecting
 * events from runRefinerTurn, applying draft patches, and asserting eval
 * criteria at the end of each case.
 *
 * The seeker simulator is intentionally deterministic: it feeds one mustExtract
 * leaf value per turn as a short natural sentence, ensuring the agent has
 * something to extract without requiring a real human in the loop.
 *
 * This module is only imported in the env-guarded eval test — it is never
 * executed in normal unit test runs.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { BriefContent } from '@hatch/shared';
import { runRefinerTurn } from '@/lib/wanted/agents/refiner';
import { applyDraftPatch } from '@/lib/wanted/brief-state';
import type { RefinerHistoryTurn } from '@/lib/wanted/agents/refiner';
import cases from './cases.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EvalCase = {
  id: string;
  seedMessage: string;
  expectedTurnsMax: number;
  mustExtract: DeepPartial<BriefContent>;
  mustAsk: string[];
  mustNotAsk: string[];
};

// Recursive partial — lets us type mustExtract loosely.
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type CaseResult = {
  id: string;
  passed: boolean;
  details: {
    turns: number;
    finalDraft: BriefContent;
    agentTexts: string[];
    failedAssertions: string[];
  };
};

// ---------------------------------------------------------------------------
// Seeker simulator
// ---------------------------------------------------------------------------

/**
 * Flatten a deep partial object into a list of [path, value] leaf pairs.
 * Each pair is used to synthesise one seeker turn.
 */
function flattenLeaves(obj: DeepPartial<BriefContent>, prefix = ''): Array<[string, unknown]> {
  const leaves: Array<[string, unknown]> = [];

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      leaves.push([path, value]);
    } else if (value !== null && typeof value === 'object') {
      leaves.push(...flattenLeaves(value as DeepPartial<BriefContent>, path));
    } else if (value !== undefined) {
      leaves.push([path, value]);
    }
  }

  return leaves;
}

/**
 * Generate a short seeker sentence from a leaf value.
 * Maps common field names to natural phrasing; falls back to a generic template.
 */
function synthesiseSeekerMessage(path: string, value: unknown): string {
  const v = Array.isArray(value) ? (value as string[]).join(', ') : String(value);
  const field = path.split('.').pop() ?? path;

  const templates: Record<string, (v: string) => string> = {
    trigger: (v) => `The trigger is: ${v}.`,
    affected: (v) => `It affects: ${v}.`,
    currentWorkaround: (v) => `My current workaround is: ${v}.`,
    costOfNotSolving: (v) => `The cost of not solving this is: ${v}.`,
    definitionOfGoodEnough: (v) => `Success looks like: ${v}.`,
    mustHaves: (v) => `I need: ${v}.`,
    niceToHaves: (v) => `It would be nice to have: ${v}.`,
    outOfScope: (v) => `Out of scope: ${v}.`,
    industry: (v) => `My industry is: ${v}.`,
    useCase: (v) => `The use case is: ${v}.`,
    technicalLevel: (v) => `My technical level is ${v}.`,
    existingStack: (v) => `My existing stack includes: ${v}.`,
    budgetBand: (v) => `My budget is ${v}.`,
    timeline: (v) => `My timeline is ${v}.`,
    title: (v) => `This is about: ${v}.`,
    preferredSolutionType: (v) => `I prefer: ${v}.`,
  };

  const fn = templates[field];
  return fn ? fn(v) : `Regarding ${field}: ${v}.`;
}

// ---------------------------------------------------------------------------
// Initial draft — blank slate matching BriefContent defaults
// ---------------------------------------------------------------------------

const BLANK_DRAFT: BriefContent = {
  problem: {},
  desiredOutcome: { mustHaves: [], niceToHaves: [], outOfScope: [] },
  context: { existingStack: [] },
  constraints: { licensing: 'no_pref', geography: null },
  preferredSolutionType: [],
};

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Check that every leaf value in mustExtract is present somewhere in the
 * final draft. Strings are checked case-insensitively as substrings.
 */
function checkMustExtract(draft: BriefContent, mustExtract: DeepPartial<BriefContent>): string[] {
  const failures: string[] = [];
  const draftStr = JSON.stringify(draft).toLowerCase();

  for (const [path, expected] of flattenLeaves(mustExtract)) {
    const values = Array.isArray(expected) ? (expected as string[]) : [String(expected)];
    for (const v of values) {
      if (!draftStr.includes(String(v).toLowerCase())) {
        failures.push(`mustExtract[${path}]="${v}" not found in final draft`);
      }
    }
  }

  return failures;
}

/**
 * Check that each mustAsk substring appears (case-insensitive) in at least
 * one agent turn.
 */
function checkMustAsk(agentTexts: string[], mustAsk: string[]): string[] {
  const failures: string[] = [];
  const combined = agentTexts.join('\n').toLowerCase();

  for (const substring of mustAsk) {
    if (!combined.includes(substring.toLowerCase())) {
      failures.push(`mustAsk="${substring}" not found in any agent turn`);
    }
  }

  return failures;
}

/**
 * Check that no mustNotAsk substring appears in any agent turn.
 */
function checkMustNotAsk(agentTexts: string[], mustNotAsk: string[]): string[] {
  const failures: string[] = [];
  const combined = agentTexts.join('\n').toLowerCase();

  for (const substring of mustNotAsk) {
    if (combined.includes(substring.toLowerCase())) {
      failures.push(`mustNotAsk="${substring}" found in agent turns`);
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

/**
 * Run one eval case through multi-turn refiner conversation.
 * Returns a structured result with pass/fail and details.
 */
export async function runCase(anthropic: Anthropic, testCase: EvalCase): Promise<CaseResult> {
  let draft: BriefContent = { ...BLANK_DRAFT };
  const history: RefinerHistoryTurn[] = [];
  const agentTexts: string[] = [];
  let turns = 0;
  let done = false;

  // Pre-compute seeker simulator leaf queue (one message per leaf)
  const leafQueue = flattenLeaves(testCase.mustExtract).slice();

  // First user message is always the seed
  let nextUserMessage = testCase.seedMessage;

  while (!done && turns < testCase.expectedTurnsMax) {
    turns++;

    // Add user turn to history
    history.push({ role: 'USER', content: nextUserMessage });

    // Collect all events from one refiner turn
    let agentText = '';
    let markedReady = false;

    for await (const event of runRefinerTurn({
      anthropic,
      history: history.slice(0, -1), // history excludes the current user msg (it's the userMessage arg)
      draft,
      userMessage: nextUserMessage,
    })) {
      if (event.type === 'token') {
        agentText += event.delta;
      } else if (event.type === 'structured_update') {
        draft = applyDraftPatch(draft, event.patch);
      } else if (event.type === 'mark_ready') {
        markedReady = true;
      }
    }

    // Record agent text for mustAsk assertions
    agentTexts.push(agentText);

    // Add agent turn to history
    history.push({ role: 'AGENT', content: agentText });

    if (markedReady) {
      done = true;
      break;
    }

    // Synthesise next seeker message from remaining leaf queue
    if (leafQueue.length > 0) {
      const [path, value] = leafQueue.shift()!;
      nextUserMessage = synthesiseSeekerMessage(path, value);
    } else {
      // No more info to give — send a generic acknowledgement
      nextUserMessage = 'That covers everything I know.';
    }
  }

  // Run assertions
  const failedAssertions: string[] = [
    ...checkMustExtract(draft, testCase.mustExtract),
    ...checkMustAsk(agentTexts, testCase.mustAsk),
    ...checkMustNotAsk(agentTexts, testCase.mustNotAsk),
  ];

  return {
    id: testCase.id,
    passed: failedAssertions.length === 0,
    details: {
      turns,
      finalDraft: draft,
      agentTexts,
      failedAssertions,
    },
  };
}

/**
 * Run all eval cases and return aggregate results.
 */
export async function runAll(
  anthropic: Anthropic,
): Promise<{ passRate: number; results: CaseResult[] }> {
  const typedCases = cases as EvalCase[];
  const results: CaseResult[] = [];

  for (const testCase of typedCases) {
    const result = await runCase(anthropic, testCase);
    results.push(result);
  }

  const passed = results.filter((r) => r.passed).length;
  const passRate = results.length > 0 ? passed / results.length : 0;

  return { passRate, results };
}
