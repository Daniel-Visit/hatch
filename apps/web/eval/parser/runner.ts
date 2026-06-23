/**
 * Eval runner for the Wanted Parser.
 *
 * Calls runParser with a real Anthropic client and asserts eval criteria:
 * - Required fields extracted (expectedFields must appear in the patch).
 * - Forbidden fields absent (forbiddenFields must not be set in the patch).
 * - parserConfidence meets minimumConfidence.
 * - Parser did not hard-fail (failed === false for inputs with expected content).
 *
 * This module is only imported in the env-guarded eval test — it is never
 * executed in normal unit test runs.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { BriefContent } from '@hatch/shared';
import { runParser } from '@/lib/wanted/agents/parser';
import cases from './cases.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EvalCase = {
  id: string;
  inputText: string;
  /** Fields that MUST be extracted (subset match, case-insensitive substrings). */
  expectedFields: DeepPartial<BriefContent>;
  /** Dot-paths whose parsed value must be absent/null/empty. */
  forbiddenFields: string[];
  /** parserConfidence must be >= this value. */
  minimumConfidence: number;
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type CaseResult = {
  id: string;
  passed: boolean;
  details: {
    parserConfidence: number;
    extractedFields: string[];
    missingFields: string[];
    failed: boolean;
    failedAssertions: string[];
  };
};

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/** Flatten a deep partial into [dotPath, value] leaf pairs. */
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
 * Retrieve the value at a dot-path from a partial BriefContent patch.
 * Returns undefined if any segment is absent.
 */
function getAtPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur = obj;
  for (const part of parts) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** True if a field at a dot-path is populated (non-null, non-empty). */
function isPopulated(obj: unknown, path: string): boolean {
  const v = getAtPath(obj, path);
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v as object).length > 0;
  return true;
}

/**
 * Assert all expectedFields leaves appear in the patch (case-insensitive
 * substring match on stringified patch).
 */
function checkExpectedFields(
  patch: Partial<BriefContent>,
  expectedFields: DeepPartial<BriefContent>,
): string[] {
  const failures: string[] = [];
  const patchStr = JSON.stringify(patch).toLowerCase();

  for (const [path, expected] of flattenLeaves(expectedFields)) {
    const values = Array.isArray(expected) ? (expected as string[]) : [String(expected)];
    for (const v of values) {
      if (!patchStr.includes(String(v).toLowerCase())) {
        failures.push(`expectedFields[${path}]="${v}" not found in patch`);
      }
    }
  }

  return failures;
}

/**
 * Assert forbidden dot-paths are absent/empty in the patch.
 */
function checkForbiddenFields(patch: Partial<BriefContent>, forbiddenFields: string[]): string[] {
  const failures: string[] = [];
  for (const path of forbiddenFields) {
    if (isPopulated(patch, path)) {
      failures.push(`forbiddenField "${path}" is set in patch but should not be`);
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

/**
 * Run one eval case through the Parser.
 * Returns a structured result with pass/fail and details.
 */
export async function runCase(anthropic: Anthropic, testCase: EvalCase): Promise<CaseResult> {
  const result = await runParser({ anthropic, pastedText: testCase.inputText });

  const failedAssertions: string[] = [];

  // 1. If there ARE expected fields, check them.
  const hasExpected = Object.keys(testCase.expectedFields).length > 0;
  if (hasExpected) {
    failedAssertions.push(...checkExpectedFields(result.patch, testCase.expectedFields));
  }

  // 2. Forbidden fields must not be set.
  failedAssertions.push(...checkForbiddenFields(result.patch, testCase.forbiddenFields));

  // 3. Confidence threshold.
  if (result.parserConfidence < testCase.minimumConfidence) {
    failedAssertions.push(
      `parserConfidence ${result.parserConfidence} < minimumConfidence ${testCase.minimumConfidence}`,
    );
  }

  // 4. Hard-fail check: if expectedFields is non-empty, the parser must not have fully failed.
  if (hasExpected && result.failed) {
    failedAssertions.push('parser returned failed=true for a case that expects extracted fields');
  }

  return {
    id: testCase.id,
    passed: failedAssertions.length === 0,
    details: {
      parserConfidence: result.parserConfidence,
      extractedFields: result.extractedFields,
      missingFields: result.missingFields,
      failed: result.failed,
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
