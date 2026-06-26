# Feature: Wanted Fase 1 / Slice 1a — Refiner (backend)

## Metadata

issue_number: `wanted-p1a`
adw_id: `1`
issue_json: `docs/superpowers/specs/2026-06-01-wanted-phase1-refiner-design.md`

## Feature Description

Backend del agente **Refiner** del feature "Wanted" (Brief & Match). El Refiner
mantiene una conversación corta y estructurada (modo CHAT) que convierte el
problema vago de un _seeker_ en un `BriefContent` bien formado. Es la **primera
integración LLM del repo**: Anthropic SDK (`claude-sonnet-4-6`) con prompt
caching y tool-use. Esta slice es **solo backend** — verificable por tests y
`curl`, sin UI. Entrega: el agente, 3 endpoints REST (create / refine-SSE /
approve), persistencia de turnos, merge de patches en `briefs.content`, recompute
de completeness, transiciones de estado, eval harness env-guarded, gating por
feature flag, rate-limits y errores RFC 7807.

## User Story

As a **seeker** (usuario con un problema que resolver)
I want to **describir mi problema en un chat guiado que lo estructura por mí**
So that **builders reciban un brief accionable sin que yo tenga que saber cómo redactarlo**.

(En 1a el consumidor es la API/tests; la UI del chat llega en Slice 1b.)

## Problem Statement

Fase 0 dejó el esquema (`briefs`, `brief_refinement_turns`), tipos compartidos,
`createBrief`, invariantes y `computeCompletenessScore` — todo inerte tras el
flag. No hay ningún agente ni endpoint que produzca o refine un brief. Sin el
Refiner, un seeker no tiene forma de crear un brief estructurado; el resto del
pipeline (matching) no tiene insumo.

## Solution Statement

Construir el Refiner como una función de runtime en `apps/web/lib/wanted/agents/`
que llama al Anthropic SDK en streaming con dos _text-tools_ (`update_brief_draft`,
`mark_ready_for_matching`), emitiendo eventos que las rutas REST traducen a un
stream SSE. La lógica pura (system prompt, defs de tools, schema, completeness) vive
en `packages/shared`. Las escrituras de `briefs` usan el cliente Supabase de sesión
(RLS `author all`); las inserciones en `brief_refinement_turns` usan el cliente
admin/service-role (la tabla solo tiene RLS de SELECT — diseño "write-via-service_role").
`approve` valida los gates y transiciona a `MATCHING` con un `triggerMatching` stub
(no-op, TODO Fase 2). Todo queda detrás de `isWantedEnabled` (404 si off).

## Relevant Files

Use these files to implement the feature:

**Leer como referencia / patrón:**

- `README.md`, `CLAUDE.md` — convenciones (pnpm, no Docker, RLS, prototype-port).
- `docs/superpowers/specs/2026-06-01-wanted-phase1-refiner-design.md` — diseño aprobado de esta slice.
- `docs/superpowers/specs/2026-06-01-wanted-adaptation-design.md` — decisiones D1–D5.
- `new/02-apis.md` — contrato REST de `/briefs`, `/refine` (SSE), `/approve`, rate-limits §2.4, errores RFC 7807 §2.5.
- `new/03-agents.md` §3.1 — rol, system prompt (§3.1.3 verbatim), tools (§3.1.5), completeness (§3.1.6), failure modes (§3.1.7), eval cases (§3.1.8).
- `apps/web/app/api/v1/apps/route.ts` — patrón de route handler (runtime nodejs, CORS, jsonResponse, rate-limit, zod validation).
- `apps/web/lib/supabase/server.ts` (`createSupabaseServerClient`), `apps/web/lib/supabase/admin.ts` (`createSupabaseAdminClient`), `apps/web/lib/auth.ts` (`requireUser`, `getUser`).
- `apps/web/lib/wanted/brief-repo.ts` (`createBrief`, `getBrief`, `countActiveBriefs`), `apps/web/lib/wanted/invariants.ts` (quota, `chatRequiresUserTurn`), `apps/web/lib/wanted/completeness.ts` (a mover a shared).
- `packages/shared/src/wanted/brief-content.ts` (`BriefContentSchema`), `packages/shared/src/wanted/enums.ts` (TURN_ROLE, BRIEF_STATUS, ACTIVE_BRIEF_STATUSES), `packages/shared/src/wanted/index.ts`, `packages/shared/src/feature-flags.ts` (`isWantedEnabled`).
- `packages/db/migrations/0031_briefs.sql`, `0033_brief_audit.sql` — esquema y RLS exactos.
- `apps/web/lib/wanted/brief-repo.integration.test.ts` — patrón de test env-guarded.
- `apps/web/lib/rate-limit.ts` — `checkRateLimit`, `ipFromRequest`.
- `apps/web/lib/supabase/types.ts` — tipos `Database` (tabla `brief_refinement_turns`, enums).

### New Files

- `packages/shared/src/wanted/agent-prompts.ts` — system prompt + config + defs de tools (puro).
- `packages/shared/src/wanted/completeness.ts` — `computeCompletenessScore` movido desde apps/web (puro, reusable por agente y rutas).
- `apps/web/lib/wanted/anthropic.ts` — factory del cliente Anthropic (server-only).
- `apps/web/lib/wanted/agents/refiner.ts` — runtime del Refiner (streaming + tool-use → eventos).
- `apps/web/lib/wanted/turn-repo.ts` — persistencia de `brief_refinement_turns` (cliente admin).
- `apps/web/lib/wanted/brief-state.ts` — `applyDraftPatch`, `transition`, persistencia de contenido/estado (cliente sesión).
- `apps/web/lib/wanted/matching.ts` — `triggerMatching` stub (TODO Fase 2).
- `apps/web/lib/wanted/gate.ts` — `assertWantedEnabled()` (404 si flag off).
- `apps/web/lib/wanted/problem.ts` — helper RFC 7807.
- `apps/web/lib/wanted/sse.ts` — helper para construir el `ReadableStream` SSE.
- `apps/web/app/api/v1/briefs/route.ts` — POST create (chat-only).
- `apps/web/app/api/v1/briefs/[id]/refine/route.ts` — POST refine (SSE).
- `apps/web/app/api/v1/briefs/[id]/approve/route.ts` — POST approve.
- Tests unit: `apps/web/lib/wanted/brief-state.test.ts`, `apps/web/lib/wanted/refiner.test.ts` (con stream Anthropic mockeado), `apps/web/lib/wanted/gate.test.ts`.
- Eval: `apps/web/eval/refiner/cases.json`, `apps/web/eval/refiner/runner.ts`, `apps/web/eval/refiner/refiner.eval.test.ts` (env-guarded).

## Implementation Plan

### Phase 1: Foundation

Mover `computeCompletenessScore` a `packages/shared` y crear `agent-prompts.ts`
(system prompt §3.1.3, modelo/temp/caps, defs de tools). Instalar `@anthropic-ai/sdk`
en `apps/web` y crear la infra transversal: `anthropic.ts`, `gate.ts`, `problem.ts`,
`sse.ts`, `matching.ts` (stub). Estas piezas no dependen entre sí salvo el SDK.

### Phase 2: Core Implementation

`turn-repo.ts` (inserts admin), `brief-state.ts` (merge de patch + transiciones +
persistencia sesión), y `agents/refiner.ts` (Anthropic streaming + tool-use → generador
de eventos `token`/`structured_update`/`completeness_score`/`done`, con retry-once en
output malformado). El refiner NO escribe en DB; solo produce eventos y el patch.

### Phase 3: Integration

Las 3 rutas REST cablean todo: `route.ts` (create chat-only + quota + gate),
`[id]/refine/route.ts` (carga brief RLS → DRAFT→REFINING → persiste turno user →
corre refiner → SSE al cliente aplicando patches y persistiendo turno agente →
enforce cap 12 y floor de mark_ready), `[id]/approve/route.ts` (gate completeness ≥ 0.5
→ MATCHING → triggerMatching stub). Luego tests unit, eval harness env-guarded, y
self-improve de expertos.

## Expert Context

Consultados: **nextjs**, **supabase** (leídos `expertise.yaml`).

- **nextjs**: route handlers viven en `apps/web/app/api/v1/`; usan `export const runtime='nodejs'; export const dynamic='force-dynamic'`; CORS + `jsonResponse` helper; rate-limit vía `@/lib/rate-limit`; validación con zod. Server Components por defecto; `'use client'` solo si hace falta (no aplica a 1a). Auth vía `getUser()`/`requireUser()` en `apps/web/lib/auth.ts`.
- **supabase**: `createSupabaseServerClient()` (RLS-scoped al usuario) para ops de usuario; `createSupabaseAdminClient()` (service-role, server-only) para trabajo privilegiado. RLS: confiar en RLS, **nunca** bypass para ops de cara al usuario — service-role solo cuando la tabla lo exige (aquí `brief_refinement_turns`, que no tiene INSERT policy). Tipos en `apps/web/lib/supabase/types.ts`, re-exportados por `packages/shared/src/database.ts`. Migraciones cloud-only vía MCP (esta slice **no** añade migraciones — 0033 ya tiene la tabla de turnos).

**Takeaways aplicados:** (1) patrón mixto de clientes en las rutas (sesión para `briefs`, admin para `brief_refinement_turns`), con authN/authZ previa del autor; (2) seguir el patrón de `apps/web/app/api/v1/apps/route.ts` para CORS/rate-limit/zod; (3) no tocar migraciones ni regenerar types (la tabla ya existe).

> Nota: ignorar `.claude/rules/database-migrations.md` (referencia `apps/orchestrator_db/models.py` que NO existe en hatch — artefacto stale de la librería fuente). Esta slice no toca migraciones.

## Team Orchestration

Ejecutado vía `/tac:implement` con subagent-driven development (subagente fresco por
tarea, two-stage review). El lead orquesta; no escribe código directo.

### Team Members

- **shared-builder**
  - Role: lógica pura en `packages/shared` (prompts, schema-tools, completeness movido)
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `packages/shared/src/wanted/agent-prompts.ts`, `packages/shared/src/wanted/completeness.ts`, `packages/shared/src/wanted/index.ts`
  - Required Capabilities: file write (Write, Edit), Read/Grep/Glob, shell (Bash) para `pnpm --filter @hatch/shared typecheck`
  - Plan Approval: false
  - Hooks:
    - Stop: `validate_file_contains.py --directory packages/shared/src/wanted --extension ts --contains 'REFINER_SYSTEM_PROMPT'`

- **infra-builder**
  - Role: infra transversal de apps/web (cliente Anthropic, gate, problem, sse, matching stub) + instalar SDK
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/web/lib/wanted/anthropic.ts`, `apps/web/lib/wanted/gate.ts`, `apps/web/lib/wanted/problem.ts`, `apps/web/lib/wanted/sse.ts`, `apps/web/lib/wanted/matching.ts`, `apps/web/package.json`
  - Required Capabilities: file write (Write, Edit), shell (Bash) para `pnpm --filter web add @anthropic-ai/sdk`
  - Plan Approval: false
  - Hooks: none

- **agent-runtime-builder**
  - Role: el Refiner y la capa de estado/persistencia (lo más complejo: streaming + tool-use)
  - Agent Type: `build-agent`
  - Model: opus
  - Owns Files: `apps/web/lib/wanted/agents/refiner.ts`, `apps/web/lib/wanted/turn-repo.ts`, `apps/web/lib/wanted/brief-state.ts`
  - Required Capabilities: file write (Write, Edit), Read/Grep, shell (Bash) para typecheck/vitest
  - Plan Approval: true
  - Hooks:
    - Stop: `validate_new_file.py --directory apps/web/lib/wanted/agents --extension ts`

- **api-builder**
  - Role: las 3 route handlers REST
  - Agent Type: `build-agent`
  - Model: opus
  - Owns Files: `apps/web/app/api/v1/briefs/route.ts`, `apps/web/app/api/v1/briefs/[id]/refine/route.ts`, `apps/web/app/api/v1/briefs/[id]/approve/route.ts`
  - Required Capabilities: file write (Write, Edit), Read/Grep, shell (Bash) para typecheck/`curl`
  - Plan Approval: true
  - Hooks:
    - Stop: `validate_file_contains.py --directory apps/web/app/api/v1/briefs --extension ts --contains 'assertWantedEnabled'`

- **test-builder**
  - Role: tests unit + eval harness env-guarded
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/web/lib/wanted/brief-state.test.ts`, `apps/web/lib/wanted/refiner.test.ts`, `apps/web/lib/wanted/gate.test.ts`, `apps/web/eval/refiner/cases.json`, `apps/web/eval/refiner/runner.ts`, `apps/web/eval/refiner/refiner.eval.test.ts`
  - Required Capabilities: file write (Write, Edit), shell (Bash) para `pnpm --filter web test`
  - Plan Approval: false
  - Hooks: none

- **validator**
  - Role: validación final (typecheck/lint/build/test, sin regresiones)
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: none (solo ejecuta)
  - Required Capabilities: all standard tools (Bash para los comandos de validación)
  - Plan Approval: false
  - Hooks: none

## Validation Hooks

### Available Validators

- `validate_new_file.py --directory <dir> --extension <ext>` (Stop)
- `validate_file_contains.py --directory <dir> --extension <ext> --contains '<string>'` (Stop)

### Custom Validators

None — existing validators cover this problem. (Se evita añadir validators custom
nuevos: en este harness los hooks ya son frágiles; la two-stage review de
`/tac:implement` cubre la conformidad con el spec.)

### Hook Assignments

| Team Member           | Hook Type | Matcher | Validator                                                                                                            |
| --------------------- | --------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| shared-builder        | Stop      | —       | `validate_file_contains.py --directory packages/shared/src/wanted --extension ts --contains 'REFINER_SYSTEM_PROMPT'` |
| agent-runtime-builder | Stop      | —       | `validate_new_file.py --directory apps/web/lib/wanted/agents --extension ts`                                         |
| api-builder           | Stop      | —       | `validate_file_contains.py --directory apps/web/app/api/v1/briefs --extension ts --contains 'assertWantedEnabled'`   |

## Step by Step Tasks

### 1. Mover completeness a shared + agent-prompts

- **Task ID**: shared-pure
- **Depends On**: none
- **Assigned To**: shared-builder
- **Agent Type**: build-agent
- **Parallel**: true
- **Owns Files**: `packages/shared/src/wanted/agent-prompts.ts`, `packages/shared/src/wanted/completeness.ts`, `packages/shared/src/wanted/index.ts`
- **Context**: `computeCompletenessScore` vive hoy en `apps/web/lib/wanted/completeness.ts` (copiar su contenido textual — depende solo de `BriefContent` de `@hatch/shared`). Crear `packages/shared/src/wanted/completeness.ts` con esa función. Crear `agent-prompts.ts` con: `REFINER_SYSTEM_PROMPT` (string constante = el system prompt de `new/03-agents.md` §3.1.3 VERBATIM, entre comillas), `REFINER_MODEL='claude-sonnet-4-6'`, `REFINER_TEMPERATURE=0.4`, `REFINER_MAX_TURNS=12`, `MARK_READY_COMPLETENESS_FLOOR=0.5`, y `REFINER_TOOLS` = array de 2 tools en formato Anthropic Messages API: `update_brief_draft` (description de §3.1.5, `input_schema` con `{ type:'object', properties:{ patch: <JSON schema de BriefContent parcial> } }`) y `mark_ready_for_matching` (`input_schema:{ type:'object', properties:{} }`). Para el JSON schema del patch del tool, **escribirlo a mano** reflejando los campos de `BriefContentSchema` (NO añadir `zod-to-json-schema` ni ninguna dep nueva — no está instalada). El JSON schema del tool es solo el hint para el modelo; la validación real server-side la hace `BriefContentSchema.partial()` en el agente. Reexportar todo desde `packages/shared/src/wanted/index.ts` (revisar el index actual para no romper exports existentes). NO borrar aún `apps/web/lib/wanted/completeness.ts` hasta que se actualicen los imports (lo hace este task: actualizar `apps/web/lib/wanted/brief-state.ts` no existe aún; los imports actuales de completeness son en sus tests — dejar un reexport temporal `export { computeCompletenessScore } from '@hatch/shared'` en el viejo path, o actualizar imports). Decisión: dejar `apps/web/lib/wanted/completeness.ts` como `export { computeCompletenessScore } from '@hatch/shared';` (shim de 1 línea) para no romper `completeness.test.ts`.
- **Actions**:
  - Crear `packages/shared/src/wanted/completeness.ts` y `agent-prompts.ts`.
  - Reexportar desde `index.ts`.
  - Convertir `apps/web/lib/wanted/completeness.ts` en shim de reexport.
  - `pnpm --filter @hatch/shared typecheck`.

### 2. Infra transversal apps/web + SDK

- **Task ID**: web-infra
- **Depends On**: none
- **Assigned To**: infra-builder
- **Agent Type**: build-agent
- **Parallel**: true
- **Owns Files**: `apps/web/lib/wanted/anthropic.ts`, `apps/web/lib/wanted/gate.ts`, `apps/web/lib/wanted/problem.ts`, `apps/web/lib/wanted/sse.ts`, `apps/web/lib/wanted/matching.ts`, `apps/web/package.json`
- **Context**: Instalar el SDK: `pnpm --filter web add @anthropic-ai/sdk` (Node 22/pnpm 10; nunca npm/yarn). Crear:
  - `anthropic.ts`: `import 'server-only'`; `export function createAnthropic(){ return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }); }`.
  - `gate.ts`: `assertWantedEnabled(profile, env)` que lanza un error tipado `WantedDisabledError` si `isWantedEnabled(profile, env)` (de `@hatch/shared`) es false. Firma de `isWantedEnabled`: revisar `packages/shared/src/feature-flags.ts` para los args exactos (env default + override por-usuario via `profile.feature_flags`). El helper debe poder llamarse desde una route con el `profile` del usuario y `process.env`.
  - `problem.ts`: `problemResponse(slug, title, status, detail)` → `NextResponse.json` con shape RFC 7807 (`type: 'https://hatchme.cc/errors/'+slug`, title, status, detail, instance opcional) y `content-type: application/problem+json`.
  - `sse.ts`: helper `sseStream(producer)` que devuelve un `Response` con `ReadableStream` y headers `text/event-stream`, `cache-control: no-cache`, `connection: keep-alive`; expone `send(event, data)` que escribe `event: <event>\ndata: <json>\n\n`.
  - `matching.ts`: `export async function triggerMatching(briefId: string): Promise<{ matchingJobId: string }> { /* TODO Fase 2 */ console.info('[wanted] triggerMatching stub', briefId); return { matchingJobId: crypto.randomUUID() }; }`.
- **Actions**:
  - `pnpm --filter web add @anthropic-ai/sdk`.
  - Crear los 5 archivos.
  - `pnpm --filter web typecheck`.

### 3. Estado + persistencia de turnos

- **Task ID**: state-turns
- **Depends On**: shared-pure
- **Assigned To**: agent-runtime-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/lib/wanted/turn-repo.ts`, `apps/web/lib/wanted/brief-state.ts`
- **Context**: Tabla `brief_refinement_turns` (ver `0033_brief_audit.sql`): columnas `brief_id, round, turn_index, role (turn_role: AGENT|USER|SYSTEM), content (text), content_json (jsonb), model_used, tokens_in, tokens_out`. **Solo RLS de SELECT (author) → inserts requieren cliente admin** (`createSupabaseAdminClient` de `@/lib/supabase/admin`). Crear:
  - `turn-repo.ts`: `appendTurn(admin, { briefId, round, turnIndex, role, content, contentJson?, modelUsed?, tokensIn?, tokensOut? })`; `countTurns(client, briefId)` (para cap 12, puede usar cliente sesión, RLS SELECT ok); `nextTurnIndex(client, briefId, round)`; `listTurns(client, briefId, round)`. Tipar con `Database['public']['Tables']['brief_refinement_turns']`.
  - `brief-state.ts`: `applyDraftPatch(content: BriefContent, patch: Partial<BriefContent>): BriefContent` (merge inmutable y profundo por sección — problem/desiredOutcome/context/constraints se mergean campo a campo; arrays se REEMPLAZAN, no se concatenan). `computeAndPersistContent(sessionClient, briefId, newContent)` → update `briefs` set `content`, `completeness_score = computeCompletenessScore(newContent)`, `refinement_round` si aplica (cliente sesión, RLS author all). `transition(sessionClient, brief, event)` con guardas: `'first_refine'`: DRAFT→REFINING; `'approve'`: REFINING|DRAFT→MATCHING (set `matching_started_at=now()`). Usar `computeCompletenessScore` de `@hatch/shared`.
- **Actions**:
  - Crear `turn-repo.ts` (admin para inserts) y `brief-state.ts`.
  - Unit-test mental de `applyDraftPatch` (no escribir test aquí; lo hace test-builder).
  - `pnpm --filter web typecheck`.

### 4. Agente Refiner (streaming + tool-use)

- **Task ID**: refiner-agent
- **Depends On**: shared-pure, web-infra
- **Assigned To**: agent-runtime-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/lib/wanted/agents/refiner.ts`
- **Context**: Implementar el runtime del Refiner usando el skill `claude-api` (prompt caching). Firma sugerida: `async function* runRefinerTurn({ anthropic, history, draft, userMessage }): AsyncGenerator<RefinerEvent>` donde `RefinerEvent = {type:'token',delta} | {type:'structured_update',patch} | {type:'mark_ready'} | {type:'agent_message_done',text,tokensIn,tokensOut,toolCall}`. Detalles:
  - Mensajes: `system` = `REFINER_SYSTEM_PROMPT` con `cache_control: {type:'ephemeral'}` (prompt caching del system + tools). `tools` = `REFINER_TOOLS` (de `@hatch/shared`). `messages` = historial mapeado (USER→user, AGENT→assistant) + el `userMessage` actual + un bloque de contexto con el draft actual y el completeness score.
  - Modelo `REFINER_MODEL`, `temperature REFINER_TEMPERATURE`, `max_tokens` razonable (~1024).
  - Streaming con `anthropic.messages.stream(...)`: emitir `{type:'token'}` por cada `content_block_delta` de texto; al cerrarse un `tool_use` de `update_brief_draft`, validar `patch` contra `BriefContentSchema.partial()` y emitir `{type:'structured_update',patch}`; si es `mark_ready_for_matching`, emitir `{type:'mark_ready'}`.
  - Al final, emitir `agent_message_done` con el texto acumulado, tokens (de `message.usage`), y el toolCall crudo (para `content_json`).
  - **Retry-once**: si la respuesta no contiene ningún tool_use válido (output malformado, §3.1.7), reintentar 1 vez con un mensaje recordando el schema; en el 2º fallo, emitir un `agent_message_done` no-op (texto "déjame reformular eso") sin patch.
  - El agente **NO** escribe en DB ni decide transiciones — solo produce eventos. El enforcement (floor de mark_ready, cap 12) lo hace la ruta.
  - Anti-inyección: envolver `draft`/`userMessage` data en delimitadores claros en el contexto (no es crítico en Refiner como en Matcher, pero mantener el patrón).
- **Actions**:
  - Implementar `runRefinerTurn` con streaming + tool-use + retry-once.
  - `pnpm --filter web typecheck`.

### 5. Ruta POST /briefs (create, chat-only)

- **Task ID**: route-create
- **Depends On**: shared-pure, web-infra
- **Assigned To**: api-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/app/api/v1/briefs/route.ts`
- **Context**: Seguir el patrón de `apps/web/app/api/v1/apps/route.ts` (runtime nodejs, dynamic force-dynamic, CORS, OPTIONS). Flujo POST:
  1. `requireUser()` (de `@/lib/auth`) → si no auth, 401.
  2. Cargar el `profile` del usuario y `assertWantedEnabled(profile, process.env)` → 404 (`wanted_disabled`) si off.
  3. Rate-limit create: 10/hora/usuario (reusar `@/lib/rate-limit`).
  4. Validar body con zod: `{ mode:'chat'|'form'|'paste', seed?:string(≤2000), pastedText?:string, source? }`. **Solo `mode:'chat'`** soportado en 1a; `form`/`paste` → 400 `mode_not_supported_yet`. `chat`: `pastedText` debe estar ausente.
  5. `createBrief(sessionClient, userId, { entryMode:'CHAT', content:{} })` (reusar de `brief-repo.ts`; maneja quota → `BriefQuotaExceededError` → 409 `brief_quota_exceeded`).
  6. Si viene `seed`, persistir como turno USER round 0 turn_index 0 (admin client via `appendTurn`).
  7. 201 `{ briefId, status:'DRAFT', nextAction:'start_refinement' }`.
     Errores RFC 7807 vía `problemResponse`.
- **Actions**:
  - Implementar route.ts.
  - `pnpm --filter web typecheck`.

### 6. Ruta POST /briefs/:id/refine (SSE)

- **Task ID**: route-refine
- **Depends On**: state-turns, refiner-agent, web-infra
- **Assigned To**: api-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/app/api/v1/briefs/[id]/refine/route.ts`
- **Context**: POST con respuesta SSE (`sseStream` de `sse.ts`). Flujo:
  1. `requireUser()` + `assertWantedEnabled`.
  2. Rate-limit: 60/hora/brief.
  3. `getBrief(sessionClient, id)` (RLS → null si no es autor → 404 `brief_not_found`).
  4. Validar body `{ userMessage:string(1..), round?:number }`.
  5. `countTurns` ≥ 12 → 409 `refine_turn_cap_exceeded`.
  6. Si `status==='DRAFT'`: `transition(sessionClient, brief, 'first_refine')` (→REFINING).
  7. `appendTurn(admin, USER, content=userMessage)` (round actual, nextTurnIndex).
  8. Abrir SSE. Cargar `history` (`listTurns`) y `draft` (brief.content). Iterar `runRefinerTurn`:
     - `token` → `send('token',{delta})`.
     - `structured_update` → `applyDraftPatch` + `computeAndPersistContent` → `send('structured_update',{patch})` + `send('completeness_score',{score})`.
     - `mark_ready` → si completeness < 0.5: NO transicionar, `send('done',{shouldStop:false, completeness, nextAction:'continue'})` con nota; si ≥ 0.5: `send('done',{shouldStop:true, completeness, nextAction:'review_brief'})`.
     - `agent_message_done` → `appendTurn(admin, AGENT, content=text, content_json=toolCall, model_used=REFINER_MODEL, tokens_in/out)`.
  9. Si no hubo `mark_ready`: `send('done',{shouldStop:false, completeness, nextAction:'continue'})`.
  10. Manejo de error del SDK: `send('error', {type:'anthropic_unavailable'})` y cerrar; el draft ya está guardado.
- **Actions**:
  - Implementar route SSE.
  - `pnpm --filter web typecheck`.

### 7. Ruta POST /briefs/:id/approve

- **Task ID**: route-approve
- **Depends On**: state-turns, web-infra
- **Assigned To**: api-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/app/api/v1/briefs/[id]/approve/route.ts`
- **Context**: POST. Flujo:
  1. `requireUser()` + `assertWantedEnabled`.
  2. `getBrief` (RLS → 404 si no autor).
  3. Gate: `completeness_score >= 0.5` (recompute desde content para estar seguro). Para CHAT **no** hay quality gate (Validator es 1.5). Si `< 0.5` → 400 `brief_incomplete`.
  4. (CHAT invariant) `chatRequiresUserTurn('CHAT', userTurnCount)` debe ser true → si no, 400.
  5. `transition(sessionClient, brief, 'approve')` → status MATCHING, `matching_started_at`.
  6. `triggerMatching(briefId)` (stub) → `matchingJobId`.
  7. 200 `{ briefId, status:'MATCHING', matchingJobId }`.
- **Actions**:
  - Implementar route.ts.
  - `pnpm --filter web typecheck`.

### 8. Tests unit + eval harness

- **Task ID**: tests-eval
- **Depends On**: state-turns, refiner-agent, route-create, route-refine, route-approve
- **Assigned To**: test-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/lib/wanted/brief-state.test.ts`, `apps/web/lib/wanted/refiner.test.ts`, `apps/web/lib/wanted/gate.test.ts`, `apps/web/eval/refiner/cases.json`, `apps/web/eval/refiner/runner.ts`, `apps/web/eval/refiner/refiner.eval.test.ts`
- **Context**: Vitest (ver `apps/web/lib/wanted/completeness.test.ts` para el patrón). Tests SIN red:
  - `brief-state.test.ts`: `applyDraftPatch` (merge por sección correcto, inmutabilidad del input, arrays reemplazados); `transition` guardas (DRAFT→REFINING ok, estados inválidos rechazados).
  - `refiner.test.ts`: `runRefinerTurn` con un **cliente Anthropic mockeado** (stub de `messages.stream` que emite deltas de texto + un `tool_use update_brief_draft`); assert que produce `token` → `structured_update` con el patch validado → `agent_message_done`. Caso malformado (sin tool_use) → retry → no-op.
  - `gate.test.ts`: `assertWantedEnabled` lanza con flag off, pasa con on (env + override).
  - Eval `cases.json`: las 5 seed cases de `new/03-agents.md` §3.1.8 (`case_001_solo_designer_needs_invoicing`, `case_002_dev_wants_to_fork_lumen`, `case_003_smb_legacy_migration`, `case_004_vague_dont_know`, `case_005_seeker_already_solution_focused`) con shape `{ id, seedMessage, expectedTurnsMax, mustExtract, mustAsk[], mustNotAsk[] }`.
  - `runner.ts`: por caso, simula la conversación (seeker responde con respuestas plausibles derivadas de `mustExtract`) manejando el refiner real hasta `mark_ready`/`expectedTurnsMax`; asserta extracción y preguntas. Umbral 80%.
  - `refiner.eval.test.ts`: **env-guarded** — `describe.skipIf(!process.env.WANTED_EVAL_LIVE || !process.env.ANTHROPIC_API_KEY)` (mismo patrón que `brief-repo.integration.test.ts`). Corre el runner contra la API real.
- **Actions**:
  - Escribir los 3 tests unit y los 3 archivos de eval.
  - `pnpm --filter web test` (unit verdes; eval se salta sin env).

### 9. Validación final

- **Task ID**: validate-all
- **Depends On**: tests-eval, route-create, route-refine, route-approve
- **Assigned To**: validator
- **Agent Type**: general-purpose
- **Parallel**: false
- **Context**: Verificar la feature completa sin regresiones. Correr los Validation Commands. Confirmar cada Acceptance Criterion. Reportar pass/fail con la salida real de cada comando.
- **Actions**:
  - `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm --filter web test`.
  - Verificar acceptance criteria.
  - Reportar.

### 10. Self-improve de expertos

- **Task ID**: expert-self-improve
- **Depends On**: validate-all
- **Assigned To**: validator
- **Agent Type**: general-purpose
- **Parallel**: false
- **Context**: Tras implementar, los dominios nextjs y supabase fueron modificados (rutas API nuevas, patrón mixto de clientes, primera integración Anthropic SDK). Correr self-improve para que la expertise refleje los patrones nuevos (rutas `/api/v1/briefs`, `wanted/` runtime, cliente Anthropic, SSE helper).
- **Actions**:
  - `/experts:nextjs:self-improve`
  - `/experts:supabase:self-improve`

## Testing Strategy

### Unit Tests

- `applyDraftPatch`: merge profundo por sección; inmutabilidad; arrays reemplazados.
- `transition`: cada guarda de estado válida/ inválida.
- `runRefinerTurn` (Anthropic mockeado): secuencia de eventos para update_brief_draft y para mark_ready; retry-once en malformado.
- `assertWantedEnabled`: on/off (env global + override por-usuario).
- Validación de bodies por modo (chat ok; form/paste → mode_not_supported_yet).

### Edge Cases

- `mark_ready` con completeness < 0.5 → no transiciona, sigue pidiendo.
- Turno 13 → `refine_turn_cap_exceeded`.
- Patch parcial que solo toca `problem.trigger` → no pisa otras secciones.
- 4º brief activo del mismo autor → `brief_quota_exceeded` (ya cubierto por `createBrief`).
- Flag off → 404 en las 3 rutas.
- SDK down → SSE `error` + draft persistido.
- Output del agente sin tool_use → retry → no-op (no rompe el stream).

## Acceptance Criteria

- `POST /api/v1/briefs {mode:'chat'}` crea un brief DRAFT respetando quota; `form`/`paste` → 400 `mode_not_supported_yet`; flag off → 404.
- `POST /api/v1/briefs/:id/refine` devuelve un stream `text/event-stream` con eventos `token`/`structured_update`/`completeness_score`/`done`; persiste turnos USER y AGENT; mergea patches en `briefs.content`; recomputa `completeness_score`; respeta cap 12 y floor de `mark_ready`; recupera output malformado.
- `POST /api/v1/briefs/:id/approve` gatea completeness ≥ 0.5 y transiciona a MATCHING con `matchingJobId` (stub); 400 `brief_incomplete` si no llega.
- `computeCompletenessScore` reside en `@hatch/shared`; el viejo path es un shim; tests de completeness siguen verdes.
- `@anthropic-ai/sdk` instalado en `apps/web`; cliente server-only.
- Tests unit verdes; eval harness corre localmente con `WANTED_EVAL_LIVE=1` y pasa ≥80% de las 5 cases; se salta sin env.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` sin errores (cero regresiones).
- Todo inerte tras el flag por defecto; ninguna UI nueva.

## Validation Commands

Execute every command to validate the feature works correctly with zero regressions.

- `pnpm --filter web add @anthropic-ai/sdk` — instala el SDK (parte del task web-infra; verificar que quedó en package.json).
- `pnpm typecheck` — TypeScript en todos los workspaces, cero errores.
- `pnpm lint` — ESLint en todos los workspaces.
- `pnpm --filter web test` — vitest de apps/web (unit verdes; eval se salta sin env).
- `WANTED_EVAL_LIVE=1 ANTHROPIC_API_KEY=… pnpm --filter web test apps/web/eval/refiner/refiner.eval.test.ts` — corre el eval harness real (manual, no CI); ≥80% de cases pasan.
- `pnpm build` — build de producción de todos los workspaces.

## Notes

- **Nueva dependencia**: `@anthropic-ai/sdk` (workspace `apps/web`). Primera integración LLM del repo. Key vía `ANTHROPIC_API_KEY` (ya en `.env.sample`).
- **Patrón mixto de clientes Supabase**: `briefs` con cliente de sesión (RLS `author all`); `brief_refinement_turns` con cliente admin (la tabla solo tiene RLS de SELECT). Las rutas autentican + autorizan al autor (RLS read) antes de cualquier escritura admin.
- **Sin migraciones**: 0033 ya tiene `brief_refinement_turns`. No regenerar `types.ts`.
- **Stub de matching**: `triggerMatching` es no-op (TODO Fase 2). `approve` transiciona a MATCHING pero no hay matcher todavía.
- **Hooks frágiles en este harness**: el prompt-gate Haiku puede bloquear comandos que tocan `.claude`, y `dangerous_command_blocker` puede falsear positivos en `git commit`. No añadimos validators custom nuevos para no agravar.
- **Fuera de 1a**: las 6 UI-tools declarativas + `ui-response` (1.5), `parse`/`validate` (1.5), matcher real (2), MCP tools (4), UI `#refiner` port (1b).
- **i18n**: las rutas API no necesitan i18n; la UI (1b) sí.
- **`requireUser()` lanza, no devuelve null**: `apps/web/lib/auth.ts` `requireUser()` arroja `Error('UNAUTHORIZED')` si no hay sesión (y `getUser()` devuelve `{user, profile}` con `profile` = fila completa de `profiles`, incluye `feature_flags`). En las 3 rutas: envolver `requireUser()` en try/catch → 401 si lanza; luego `assertWantedEnabled(profile, process.env)`.
- **`build-agent` validado**: sus hooks PostToolUse `ruff_validator`/`ty_validator` hacen no-op en archivos no-`.py` (skip explícito); `no_tailwind_in_prototype_port` no aplica (nuestros archivos no están en paths de prototype-port); `no_vapid_private_in_client` es inofensivo. Seguro para este feature TS.
