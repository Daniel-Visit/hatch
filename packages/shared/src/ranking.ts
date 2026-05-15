// Hot score helper used by both `apps/web` and `apps/mcp`.
// Phase 0 stub returns 0; Phase 10 implements the real Reddit-style decay
// per SPEC.md §12.1.

export interface HotScoreInput {
  likes: number;
  comments: number;
  saves: number;
  publishedAt: Date;
}

export function hotScore(_input: HotScoreInput): number {
  return 0;
}
