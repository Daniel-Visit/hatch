# Wanted — Semantic Embeddings (Voyage) Design

**Date:** 2026-06-23
**Branch:** `feature/wanted-v1`
**Status:** Approved — ready for implementation plan
**Lifts:** Decision D1 deferral in `2026-06-01-wanted-adaptation-design.md` (embeddings provider was deferred pending approval).

## 1. Context

The Wanted Matcher v1 retrieves candidates with Postgres full-text search (FTS)
over `apps.search_vector` plus hard filters, then re-ranks with Haiku — all behind
the `CandidateRetriever` interface (`apps/web/lib/wanted/matching/retriever.ts`).
Semantic embeddings were deferred (Decision D1) because Anthropic has no embeddings
API and Supabase only _stores_ vectors (pgvector), forcing an external provider.

This spec plugs in semantic retrieval as a **second `CandidateRetriever`
implementation** without rehaping the matcher architecture. `phase-a`, `phase-b`,
`run`, and the Haiku re-rank are **unchanged** — only the retrieval step changes.

## 2. Decisions (closed with user)

| #   | Decision          | Choice                                                                                                                                                                                     |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E1  | Provider          | **Voyage `voyage-3`** (1024 dims). Anthropic's recommended embeddings provider; cheaper HNSW index/storage than 1536.                                                                      |
| E2  | Population timing | **Hybrid**: `briefs.embedding` + `apps.embedding` computed synchronously (best-effort) in their write routes; `profiles.capability_embedding` recomputed by nightly cron + on app publish. |
| E3  | Retrieval fusion  | **Hybrid FTS + vector with Reciprocal Rank Fusion (RRF)** inside the hard-filtered set; top-N to Haiku. Keeps exact lexical match (tech/brand names) and semantic match.                   |
| E4  | Cron infra        | **Vercel Cron → protected route handler** (`CRON_SECRET`). Reuses the same TypeScript Voyage/embedding code as the synchronous path — no Deno duplication.                                 |
| E5  | Failure mode      | **Never block writes.** Voyage failure → row saved with `embedding = NULL`, logged. Nightly cron sweeps NULLs and backfills (also covers existing rows). Match degrades to FTS meanwhile.  |

## 3. Architecture

```
Brief/App write route ──(best-effort)──> embed() ──> Voyage ──> UPDATE embedding (or NULL)
                                                                       │
Match request ──> Matcher ──> CandidateRetriever (selected by env) ────┤
                                  ├─ SemanticCandidateRetriever (VOYAGE_API_KEY set)
                                  │     hard filters → FTS + cosine RPC → RRF → top-N
                                  └─ FtsCandidateRetriever (fallback, unchanged)
                                          │
                                          └──> phase-a / phase-b → Haiku re-rank → deck

Nightly Vercel Cron ──> /api/cron/capability-embeddings (CRON_SECRET)
                          ├─ recompute capability_embedding per builder (top-5 loved)
                          └─ sweep embedding IS NULL on briefs + apps → backfill
```

**Retriever selection:** the matcher picks `SemanticCandidateRetriever` when
`VOYAGE_API_KEY` is set, else `FtsCandidateRetriever`. This makes rollout a config
flip and keeps production safe if the key is absent.

## 4. Components

### 4.1 `apps/web/lib/wanted/embeddings/voyage.ts` (new, server-only)

- Wraps the Voyage embeddings HTTP API. Model `voyage-3`, output 1024 dims.
- `input_type: 'query'` for brief text; `'document'` for app/capability text.
- Single-text and batched-text entry points (batch used by cron).
- Reads `VOYAGE_API_KEY`. Throws a typed error on failure; callers decide policy.

### 4.2 `apps/web/lib/wanted/embeddings/embed.ts` (new)

- `embedBrief(input) → number[] | null`, `embedApp(input) → number[] | null`,
  `embedCapability(appTexts) → number[] | null`.
- Each builds text via the **pure recipes** in
  `packages/shared/src/wanted/embedding-recipes.ts`, calls Voyage, returns the
  vector. Best-effort variant catches Voyage errors and returns `null` (for the
  synchronous write path); the cron uses the throwing variant per-row in try/catch.

### 4.3 `packages/db/migrations/0040_wanted_embeddings.sql` (new)

- `create extension if not exists vector;`
- `alter table briefs add column embedding vector(1024);`
- `alter table apps add column embedding vector(1024);`
- `alter table profiles add column capability_embedding vector(1024);`
- HNSW indexes with `vector_cosine_ops` on each of the three columns.
- RPCs (cosine `<=>` is not cleanly expressible via PostgREST):
  - `match_apps_by_embedding(query_embedding vector(1024), match_count int, ...)`
    → returns candidate app ids ordered by cosine distance, respecting the same
    hard filters (`is_published`, category/domain, existing-stack exclusion).
  - `match_builders_by_embedding(query_embedding vector(1024), match_count int, ...)`
    → returns candidate builder ids ordered by cosine distance, respecting
    `accepts_requests`, rate band, domains, `shippedAppCount >= 1`.
- RPCs are `security definer` only if required by RLS; prefer `security invoker`
  with policies that already allow the matcher's read path. Verify with advisors.

### 4.4 `apps/web/lib/wanted/matching/semantic-retriever.ts` (new)

- `SemanticCandidateRetriever implements CandidateRetriever`.
- Applies the **same hard pre-filters** as the FTS retriever.
- Runs two retrievals over the filtered set: the existing FTS query and the new
  cosine RPC; fuses ranks with **RRF** (`score = Σ 1/(k + rank_i)`, `k=60`) and
  returns the top-N candidates (same shape `AppCandidate` / `BuilderCandidate`).
- **Degradation:** if the brief's `embedding` is `NULL` (Voyage was down at write),
  the vector arm is skipped and RRF runs with the FTS arm only.
- Supabase client injected (unit-testable with a faked client, no live DB).

### 4.5 `apps/web/app/api/cron/capability-embeddings/route.ts` (new)

- Auth: requires `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron header).
  Returns 401 otherwise. No user session.
- Work, idempotent and resumable:
  1. For each builder with published apps, recompute `capability_embedding` from
     the top-5 loved apps' embedding texts (recency-weighted per recipe), via
     `userCapabilityText` + Voyage `document`.
  2. Sweep `briefs` and `apps` where `embedding IS NULL`, embed and fill them
     (this is the backfill of existing/failed rows).
- Per-row try/catch; a Voyage failure leaves the row NULL for the next run.
- Bounded batch size per invocation to stay within function limits; logs counts.

### 4.6 Wire-ups (edits)

- Brief create/refine route(s) and app publish/edit route(s): after the row is
  written, call the best-effort `embed*` and `UPDATE ... SET embedding = ...`.
  Failures never fail the request.
- App publish route additionally triggers an on-demand capability recompute for
  the author (reuses the cron's capability function).
- Matcher entry point: select retriever by `VOYAGE_API_KEY` presence.
- `vercel.json`: add nightly cron pointing at the capability-embeddings route.
- `packages/shared/src/wanted/embedding-recipes.ts`: update stale `vector(1536)`
  comments to `vector(1024)` (Voyage). Recipe bodies are dimension-agnostic — no
  logic change.

## 5. Error handling

| Failure                                    | Behavior                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Voyage error on synchronous write          | Log, save row with `embedding = NULL`, return success to user. Cron backfills later. |
| Voyage error in cron (per row)             | try/catch around each row; leave NULL; retry next night.                             |
| Query (brief) embedding NULL at match time | Vector arm disabled; RRF runs FTS-only.                                              |
| `VOYAGE_API_KEY` unset                     | Matcher uses `FtsCandidateRetriever`; writes skip embedding entirely.                |
| Cron called without valid `CRON_SECRET`    | 401, no work performed.                                                              |

## 6. Testing

- **Unit**
  - `voyage.ts`: mocked `fetch` — request shape (model, input_type, batch),
    response parsing, error path.
  - RRF fusion: pure function — known rank inputs → expected fused order; tie /
    single-arm / empty cases.
  - `SemanticCandidateRetriever`: faked Supabase client — hard filters applied,
    RRF order, NULL-embedding degradation to FTS-only.
  - Cron handler: 401 without secret; idempotent sweep with a faked client.
- **Eval** (env-guarded, real Voyage key)
  - Extend `apps/web/eval/matcher/` to run the suite through the semantic
    retriever; assert semantic cases (paraphrase ≈ feature) now surface where FTS
    alone missed them. Keep existing FTS eval intact.

## 7. Config

- New env vars: `VOYAGE_API_KEY`, `CRON_SECRET`. Add to `.env.example` with
  comments. `VOYAGE_API_KEY` absence is a supported state (FTS fallback).

## 8. Out of scope

- Re-embedding strategy on model upgrades / dimension changes (future migration).
- Realtime/streaming embedding updates (nightly cron + on-write is sufficient).
- Cross-encoder rerankers (Haiku re-rank stays as the final stage).
