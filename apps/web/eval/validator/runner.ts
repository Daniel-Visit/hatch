/**
 * Eval runner for the Wanted Validator.
 *
 * Calls runValidator with a real Anthropic client and asserts eval criteria:
 * - overallQuality falls within the expected range.
 * - Per-section scores fall within expected ranges.
 * - Suggestion count is within [minSuggestions, maxSuggestions].
 * - Required sections are flagged (appear in suggestions).
 * - Forbidden sections are not flagged.
 * - Each suggestion's exampleBetter is >= 30 chars (suggestionsMustHaveConcreteExamples).
 *
 * NOTE — match potential delta (§3.4.5 "withSuggestions - current >= 2"):
 * The `matchPotentialEstimate` is computed by `matching/heuristic.ts`, NOT by
 * `runValidator`. This eval runner only exercises the LLM half of §3.4.1
 * (quality + suggestions). The delta assertion from the spec is therefore NOT
 * tested here; it lives in `apps/web/lib/wanted/matching/heuristic.test.ts`
 * (unit-level, no LLM). `validator_007_low_quality_multi_flag` asserts low
 * quality + 2–3 suggestions on a deliberately weak brief — the "match_potential"
 * naming in the spec was a shorthand for "brief that would benefit most from
 * suggestions", not a directive to assert the numeric delta in this runner.
 *
 * This module is only imported in the env-guarded eval test — it is never
 * executed in normal unit test runs.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { BriefContent } from '@hatch/shared';
import { runValidator, MIN_EXAMPLE_BETTER_CHARS } from '@/lib/wanted/agents/validator';
import cases from './cases.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EvalCase = {
  id: string;
  briefContent: BriefContent;
  expected: {
    overallQualityRange: [number, number];
    sectionScoreRanges: Record<string, [number, number]>;
    minSuggestions: number;
    maxSuggestions: number;
    requiredSuggestionSections?: string[];
    forbiddenSuggestionSections?: string[];
    suggestionsMustHaveConcreteExamples: boolean;
  };
};

export type CaseResult = {
  id: string;
  passed: boolean;
  details: {
    overallQuality: number;
    qualityBySection: Record<string, number>;
    suggestionCount: number;
    injectionFlagged: boolean;
    failedAssertions: string[];
  };
};

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

function checkQualityRange(overallQuality: number, [min, max]: [number, number]): string[] {
  if (overallQuality < min || overallQuality > max) {
    return [`overallQuality ${overallQuality.toFixed(3)} not in expected range [${min}, ${max}]`];
  }
  return [];
}

function checkSectionScoreRanges(
  qualityBySection: Record<string, number>,
  sectionScoreRanges: Record<string, [number, number]>,
): string[] {
  const failures: string[] = [];
  for (const [section, [min, max]] of Object.entries(sectionScoreRanges)) {
    const score = qualityBySection[section];
    if (score === undefined) {
      failures.push(`section "${section}" missing from qualityBySection`);
    } else if (score < min || score > max) {
      failures.push(
        `qualityBySection["${section}"] = ${score.toFixed(3)} not in expected range [${min}, ${max}]`,
      );
    }
  }
  return failures;
}

function checkSuggestionCount(count: number, min: number, max: number): string[] {
  if (count < min || count > max) {
    return [`suggestion count ${count} not in expected range [${min}, ${max}]`];
  }
  return [];
}

function checkRequiredSections(
  suggestions: Array<{ sectionPath: string }>,
  required: string[] | undefined,
): string[] {
  if (!required || required.length === 0) return [];
  const failures: string[] = [];
  const flaggedPaths = new Set(suggestions.map((s) => s.sectionPath));
  for (const section of required) {
    if (!flaggedPaths.has(section)) {
      failures.push(`required section "${section}" not flagged in suggestions`);
    }
  }
  return failures;
}

function checkForbiddenSections(
  suggestions: Array<{ sectionPath: string }>,
  forbidden: string[] | undefined,
): string[] {
  if (!forbidden || forbidden.length === 0) return [];
  const failures: string[] = [];
  for (const s of suggestions) {
    if (forbidden.includes(s.sectionPath)) {
      failures.push(`forbidden section "${s.sectionPath}" appears in suggestions`);
    }
  }
  return failures;
}

function checkConcreteExamples(
  suggestions: Array<{ sectionPath: string; exampleBetter: string }>,
  mustHave: boolean,
): string[] {
  if (!mustHave) return [];
  const failures: string[] = [];
  for (const s of suggestions) {
    if (s.exampleBetter.trim().length < MIN_EXAMPLE_BETTER_CHARS) {
      failures.push(
        `suggestion for "${s.sectionPath}" has exampleBetter of length ${s.exampleBetter.trim().length} (< ${MIN_EXAMPLE_BETTER_CHARS})`,
      );
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

/**
 * Run one eval case through the Validator.
 * Returns a structured result with pass/fail and details.
 */
export async function runCase(anthropic: Anthropic, testCase: EvalCase): Promise<CaseResult> {
  const result = await runValidator({ anthropic, content: testCase.briefContent });
  const { expected } = testCase;

  const failedAssertions: string[] = [
    ...checkQualityRange(result.overallQuality, expected.overallQualityRange),
    ...checkSectionScoreRanges(result.qualityBySection, expected.sectionScoreRanges),
    ...checkSuggestionCount(
      result.suggestions.length,
      expected.minSuggestions,
      expected.maxSuggestions,
    ),
    ...checkRequiredSections(result.suggestions, expected.requiredSuggestionSections),
    ...checkForbiddenSections(result.suggestions, expected.forbiddenSuggestionSections),
    ...checkConcreteExamples(result.suggestions, expected.suggestionsMustHaveConcreteExamples),
  ];

  return {
    id: testCase.id,
    passed: failedAssertions.length === 0,
    details: {
      overallQuality: result.overallQuality,
      qualityBySection: result.qualityBySection,
      suggestionCount: result.suggestions.length,
      injectionFlagged: result.injectionFlagged,
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
  const typedCases = cases as unknown as EvalCase[];
  const results: CaseResult[] = [];

  for (const testCase of typedCases) {
    const result = await runCase(anthropic, testCase);
    results.push(result);
  }

  const passed = results.filter((r) => r.passed).length;
  const passRate = results.length > 0 ? passed / results.length : 0;

  return { passRate, results };
}
