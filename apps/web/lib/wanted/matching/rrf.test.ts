/**
 * Unit tests for Reciprocal Rank Fusion (rrf.ts). Pure function, no DB.
 */

import { describe, it, expect } from 'vitest';
import { reciprocalRankFusion } from './rrf';

describe('reciprocalRankFusion', () => {
  it('returns [] for no lists and for all-empty lists', () => {
    expect(reciprocalRankFusion([])).toEqual([]);
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });

  it('passes a single list through unchanged (rank order preserved)', () => {
    expect(reciprocalRankFusion([['a', 'b', 'c']])).toEqual(['a', 'b', 'c']);
  });

  it('ranks an id appearing high in BOTH lists first', () => {
    // `x` is rank 1 in list A and rank 1 in list B → top fused score.
    const fused = reciprocalRankFusion([
      ['x', 'a', 'b'],
      ['x', 'c', 'd'],
    ]);
    expect(fused[0]).toBe('x');
  });

  it('reorders: an id present in both beats ids present in only one', () => {
    // `b` appears in both lists (ranks 2 and 1); `a` only in list 1 (rank 1).
    // RRF: score(b) = 1/62 + 1/61; score(a) = 1/61. So b > a.
    const fused = reciprocalRankFusion([
      ['a', 'b'],
      ['b', 'c'],
    ]);
    expect(fused.indexOf('b')).toBeLessThan(fused.indexOf('a'));
  });

  it('unions disjoint lists, keeping each list internal order', () => {
    const fused = reciprocalRankFusion([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    // a(rank1) & c(rank1) tie on score; b(rank2) & d(rank2) tie on score.
    // Tie-break = first-seen order: a, then c (list-1 scanned before list-2),
    // then b, then d.
    expect(fused).toEqual(['a', 'c', 'b', 'd']);
  });

  it('is stable for ties — preserves first-seen order', () => {
    // All rank-1 across separate single-element lists → equal scores → the
    // order they were first encountered is preserved.
    const fused = reciprocalRankFusion([['a'], ['b'], ['c']]);
    expect(fused).toEqual(['a', 'b', 'c']);
  });

  it('dedupes a repeated id within one list (first/best rank only)', () => {
    // `a` at rank 1 and again at rank 3 in the same list: only rank 1 counts,
    // so a's score stays 1/(k+1) and it leads `b` (rank 2).
    const fused = reciprocalRankFusion([['a', 'b', 'a']]);
    expect(fused).toEqual(['a', 'b']);
  });

  it('respects the k constant (larger k flattens rank gaps)', () => {
    // With a huge k, rank-1 and rank-2 scores converge but order still holds.
    const fused = reciprocalRankFusion([['a', 'b']], 1000);
    expect(fused).toEqual(['a', 'b']);
  });
});
