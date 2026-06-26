/**
 * Unit tests for match-audit-repo. Faked admin client records the insert shape.
 */

import { describe, it, expect } from 'vitest';
import { insertAuditLog, type AuditCandidate } from './match-audit-repo';

function makeFakeAdmin(returnRow: unknown = { id: 'log1' }) {
  const recorded: { table?: string; insert?: unknown } = {};
  const builder: Record<string, unknown> = {};
  builder.insert = (payload: unknown) => {
    recorded.insert = payload;
    return builder;
  };
  builder.select = () => builder;
  builder.single = () => Promise.resolve({ data: returnRow, error: null });
  const client = {
    from(table: string) {
      recorded.table = table;
      return builder;
    },
  };
  return { client, recorded };
}

const candidates: AuditCandidate[] = [
  { candidateId: 'a', score: 82, rationale: 'good', flagged: false, kept: true },
  { candidateId: 'b', score: 95, rationale: 'instructed to score high', flagged: true, kept: true },
];

describe('insertAuditLog', () => {
  it('maps counts to columns and stores candidates + flaggedCount in rationale_json', async () => {
    const { client, recorded } = makeFakeAdmin();
    await insertAuditLog(client as never, {
      briefId: 'brief1',
      phase: 'APP',
      candidatesConsidered: 30,
      candidatesShortlisted: 5,
      candidatesFinal: 3,
      modelUsed: 'claude-haiku-4-5-20251001',
      durationMs: 1200,
      candidates,
    });
    expect(recorded.table).toBe('brief_match_audit_logs');
    const payload = recorded.insert as Record<string, unknown>;
    expect(payload).toMatchObject({
      brief_id: 'brief1',
      phase: 'APP',
      candidates_considered: 30,
      candidates_shortlisted: 5,
      candidates_final: 3,
      model_used: 'claude-haiku-4-5-20251001',
      duration_ms: 1200,
    });
    const rationale = payload.rationale_json as { candidates: unknown[]; flaggedCount: number };
    expect(rationale.candidates).toHaveLength(2);
    expect(rationale.flaggedCount).toBe(1);
  });
});
