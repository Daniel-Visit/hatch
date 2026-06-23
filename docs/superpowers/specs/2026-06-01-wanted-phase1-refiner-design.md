# Diseño — Wanted Fase 1 / Slice 1a: Refiner (backend)

**Fecha:** 2026-06-01
**Estado:** aprobado (brainstorm) → listo para `/tac:feature`
**Rama:** `feature/wanted-v1`
**Predecesor:** Fase 0 (migraciones 0030–0034, `@hatch/shared` wanted, repo/invariants/completeness) — commiteada.
**Fuente:** `new/02-apis.md`, `new/03-agents.md` (§3.1 Refiner), `docs/superpowers/specs/2026-06-01-wanted-adaptation-design.md` (D1–D5).

## Propósito

Construir el **backend del agente Refiner** en modo CHAT: el seeker mantiene una
conversación corta y estructurada que convierte un problema vago en un
`BriefContent` bien formado. Esta es la **primera integración LLM del repo**
(Anthropic SDK + prompt caching). Slice 1a es solo backend — verificable por
tests y `curl`, sin UI. La UI (`#refiner` port) es Slice 1b; Parser/Validator
son Fase 1.5; el Matcher real es Fase 2.

## Alcance

**Dentro (1a):**

- Agente Refiner (CHAT, `claude-sonnet-4-6`, temp 0.4, prompt caching) con los 2
  _text-tools_: `update_brief_draft`, `mark_ready_for_matching`.
- 3 endpoints REST bajo `/api/v1/briefs`: create, refine (SSE), approve.
- Persistencia de turnos (`brief_refinement_turns`), merge de patches en
  `briefs.content`, recompute de `completeness_score`, transiciones de estado.
- Eval harness `tests/eval/refiner/` (env-guarded, API real).
- Gating por `isWantedEnabled` + rate-limits + errores RFC 7807.

**Fuera:** las 6 UI-tools declarativas y los endpoints `ui-response` (1.5); el
endpoint `parse`/`validate` (1.5); matching real (2); MCP tools (4); UI (1b).

## Decisiones (cerradas en brainstorm)

| #   | Decisión                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Modelo `claude-sonnet-4-6`, temp 0.4, prompt caching de system+schema. SDK `@anthropic-ai/sdk` en `apps/web`. Key `ANTHROPIC_API_KEY`.                                           |
| 2   | **SSE real**: route `nodejs` que devuelve `ReadableStream` `text/event-stream`. Eventos: `token`, `structured_update`, `completeness_score`, `done`.                             |
| 3   | El agente SIEMPRE emite mensaje ≤3 frases + 1 tool call. Server enforce: `mark_ready` rechazado si completeness < 0.5; cap 12 turnos; output malformado → 1 retry → turno no-op. |
| 4   | Escritura con cliente Supabase de **sesión** (RLS, el usuario es autor). Sin service-role.                                                                                       |
| 5   | `approve` valida gate (completeness ≥ 0.5; CHAT sin quality gate) + transición a `MATCHING`; matching es un **stub** `triggerMatching(briefId)` (no-op + TODO Fase 2).           |
| 6   | Estados: `DRAFT → REFINING` (primer refine) → `MATCHING` (approve).                                                                                                              |
| 7   | Eval harness env-guarded (como `brief-repo.integration.test.ts`).                                                                                                                |

## Arquitectura y archivos

### Puro — `packages/shared/src/wanted/`

- **`agent-prompts.ts`** (nuevo): `REFINER_SYSTEM_PROMPT` (constante, §3.1.3 verbatim),
  `REFINER_MODEL = 'claude-sonnet-4-6'`, `REFINER_TEMPERATURE = 0.4`,
  `REFINER_MAX_TURNS = 12`, `MARK_READY_COMPLETENESS_FLOOR = 0.5`, y las defs de los
  2 text-tools (`update_brief_draft` con `BriefContentSchema.partial()` como input,
  `mark_ready_for_matching` sin args) como objetos tool de Anthropic.
- Reusa `BriefContentSchema` (`brief-content.ts`) y `computeCompletenessScore`
  (mover/reusar — ver nota abajo).
- Exportar desde `index.ts`.

> Nota: `computeCompletenessScore` hoy vive en `apps/web/lib/wanted/completeness.ts`.
> Es pura y la necesitan tanto el agente (shared) como las rutas. **Moverla a
> `packages/shared/src/wanted/completeness.ts`** y reexportar; actualizar imports y
> su test. (Mejora de frontera dentro del alcance.)

### Agéntico/estado — `apps/web/lib/wanted/`

- **`agents/refiner.ts`** (nuevo): `runRefinerTurn({ client, brief, history, userMessage })`
  → async generator / callback que produce eventos `{type:'token'|'structured_update'|'completeness_score'|'done'}`.
  Encapsula: construcción de mensajes (system cacheado + historial + draft actual +
  userMessage), llamada `stream` del SDK con `tools`, parseo incremental de
  `content_block_delta` (texto) y `tool_use`, retry-once en output malformado.
  No escribe en DB — solo produce eventos y el patch/decisión.
- **`turn-repo.ts`** (nuevo): `appendTurn(...)`, `listTurns(briefId, round)`,
  `nextTurnIndex(...)`, `countTurns(briefId)` (para el cap de 12). Inserta en
  `brief_refinement_turns` (role `turn_role`, content, content_json,
  model_used, tokens_in/out, round, turn_index).
- **`brief-state.ts`** (nuevo): `applyDraftPatch(content, patch)` (merge inmutable),
  `transition(brief, event)` (DRAFT→REFINING, →MATCHING) con guardas; reusa
  `computeCompletenessScore`. Persiste `content`, `completeness_score`,
  `refinement_round`, `status`, `matching_started_at`.
- **`matching.ts`** (nuevo, stub): `triggerMatching(briefId): Promise<{matchingJobId}>`
  — no-op que loguea + devuelve un uuid placeholder. TODO(Fase 2).

### Rutas — `apps/web/app/api/v1/briefs/`

- **`route.ts`** — `POST` create. Body `{ mode:'chat'|'form'|'paste', seed?, pastedText?, source? }`.
  Slice 1a implementa **solo `mode:'chat'`** (form/paste → `400 mode_not_supported_yet`
  hasta 1.5). Valida quota (reusa `createBrief`), guarda `seed` como turno 0 si viene.
  201 `{ briefId, status:'DRAFT', nextAction:'start_refinement' }`.
- **`[id]/refine/route.ts`** — `POST` SSE. Body `{ userMessage, round? }`. Flujo:
  carga brief (RLS) → si `DRAFT` transiciona a `REFINING` → persiste turno user →
  `runRefinerTurn` → stream de eventos al cliente, aplicando patches y persistiendo
  turno agente al cierre → `done`. Enforce cap 12 y floor de `mark_ready`.
- **`[id]/approve/route.ts`** — `POST`. Gate + transición `MATCHING` + `triggerMatching`.
  200 `{ briefId, status:'MATCHING', matchingJobId }`.

### Infra transversal

- `pnpm add @anthropic-ai/sdk` (workspace `apps/web`).
- `apps/web/lib/wanted/anthropic.ts` (nuevo): factory del cliente Anthropic (lee
  `ANTHROPIC_API_KEY`, server-only).
- `apps/web/lib/wanted/gate.ts` (nuevo): `assertWantedEnabled()` para rutas (404 si off),
  leyendo `isWantedEnabled(profile, env)`.
- `apps/web/lib/wanted/problem.ts` (nuevo): helper RFC 7807 (`problemResponse(type,title,status,detail)`).
- Rate-limits §2.4 reusando `@/lib/rate-limit`: create 10/h/user; refine 60/h/brief + 12 turnos/brief.

## Flujo SSE (refine)

```
seeker → POST /briefs/:id/refine { userMessage }
server: brief RLS load → (DRAFT→REFINING) → appendTurn(user)
        runRefinerTurn():
          ← SSE token "..." (deltas del mensaje del agente)
          [tool_use update_brief_draft] → applyDraftPatch + persist + recompute
          ← SSE structured_update { patch }
          ← SSE completeness_score { score }
          [o tool_use mark_ready_for_matching] (rechazado si score<0.5)
        appendTurn(agent) (content, content_json=patch, tokens)
        ← SSE done { shouldStop, completeness, nextAction:'review_brief'|'continue' }
```

## Manejo de errores (RFC 7807, §2.5)

`brief_quota_exceeded` (409), `too_many_drafts` (429), `mode_not_supported_yet` (400),
`brief_not_found` (404), `refine_turn_cap_exceeded` (400/409), `mark_ready_too_early`
(server reabre el turno), `anthropic_unavailable` (503 con draft guardado),
`wanted_disabled` (404). `type` URL estable `https://hatchme.cc/errors/<slug>`.

## Eval harness — `tests/eval/refiner/`

- `cases.json`: las 5 seed cases de §3.1.8 (`case_001..005`), shape
  `{ id, seedMessage, expectedTurnsMax, mustExtract, mustAsk[], mustNotAsk[] }`.
- `runner.ts`: por cada caso, crea brief efímero (o stub en memoria), maneja el
  refiner por turnos simulando respuestas del seeker hasta `mark_ready` o
  `expectedTurnsMax`, y asserta extracción/preguntas. Umbral: **80%** de casos pasan.
- **Env-guarded**: corre solo con `WANTED_EVAL_LIVE=1` + `ANTHROPIC_API_KEY`
  (igual patrón que el integration test existente). Skip en CI por defecto.

## Tests (1a)

- Unit (sin API): `applyDraftPatch` (merge correcto, inmutabilidad), `transition`
  (guardas de estado), enforce de cap 12 y floor de `mark_ready`, validación de
  bodies por modo, gating off→404, mapping de eventos SSE (con un stream de
  Anthropic mockeado).
- Integration env-guarded: un refine real de 1 turno produce `structured_update` +
  `completeness_score`.
- Eval harness (arriba), env-guarded.

## Definition of Done — Slice 1a

- `POST /briefs` (chat) crea DRAFT respetando quota; gating off → 404.
- `POST /briefs/:id/refine` streamea SSE, persiste turnos, mergea patches, recomputa
  completeness, respeta cap 12 y floor; output malformado se recupera (retry/no-op).
- `POST /briefs/:id/approve` gatea y transiciona a MATCHING con `matchingJobId` stub.
- `computeCompletenessScore` reubicado en shared, imports/tests actualizados.
- Unit tests verdes; eval harness corre localmente (env) y pasa ≥80%.
- Todo inerte tras el flag (off por defecto).

## Notas / decisiones abiertas (no bloquean 1a)

- `nextAction` exacto en `done` (`review_brief` vs `continue`) se decide por
  `shouldStop`/completeness; copy fino se ajusta en 1b.
- El `matchingJobId` placeholder no se persiste como job real hasta Fase 2.
