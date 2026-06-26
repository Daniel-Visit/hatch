# Feature: Wanted Fases 1.5 + 2 — Multi-modo + Validación + Matcher

## Metadata

issue_number: `wanted-p15-2`
adw_id: `1`
issue_json: `new/ (spec ejecutable) + docs/superpowers/specs/2026-06-01-wanted-adaptation-design.md`

## Feature Description

Bloque combinado que completa el **input multi-modo** y el **matching** de Wanted:

- **Fase 1.5 — Multi-modo + Validación:** mode picker (Chat/Form/Paste), Form mode,
  Paste mode + **Parser agent**, **Validator agent** + Brief Health Card, las **6 UI-tools
  declarativas** del Refiner + el ciclo `ui_call`/`ui_response`.
- **Fase 2 — Matcher:** `CandidateRetriever` (FTS + filtros duros, embeddings DIFERIDOS por
  D1), Matcher **Phase A** (apps) + **Phase B** (builders), orquestación real (reemplaza el
  stub `triggerMatching`), endpoints REST de match/swipe, **match deck UI**, evals y guardas
  anti-inyección.

Construye sobre Fase 1 (Refiner CHAT backend+UI, ya hecho). Todo inerte tras `wanted_v1_enabled`.

## User Story

As a **seeker** I want to **enter my need by chatting, filling a form, or pasting text, get
quality feedback, and then see real matches (existing apps or builders)** so that **I reach
a solution the fastest way for me**.
As a **builder** I want to **receive briefs that fit my profile** so that **I find relevant work**.

## Problem Statement

Fase 1 solo cubre el modo CHAT y deja el matching como stub. Falta: Form/Paste, el Parser y
Validator agents, el Health Card, los componentes UI declarativos, y TODO el Matcher real
(retrieval FTS + re-rank Haiku + matches + swipe + UI). Sin esto el feature no entrega valor
end-to-end (un brief no produce matches).

## Solution Statement

Añadir los agentes Parser/Validator (mismo patrón Anthropic que el Refiner de 1a), los
endpoints faltantes, el retrieval por **full-text search** sobre `apps.search_vector` +
filtros + re-rank Haiku (interfaz `CandidateRetriever` para enchufar embeddings luego), y
portar verbatim las pantallas restantes del mockup (`#matches`, mode picker, form, paste,
health card) + los 6 componentes de `refiner-ui-catalog.html`. Escrituras a `matches`,
`validator_suggestions`, `brief_match_audit_logs` van con cliente **admin** (esas tablas solo
tienen RLS de SELECT).

## Relevant Files

**Spec (fuente de verdad — los subagentes DEBEN leer las secciones citadas):**

- `new/02-apis.md` — endpoints `/parse`, `/validate`, `/suggestions/:id/apply|dismiss`,
  `/turns/:turnId/ui-response`, `/match`, `/matches`, `/matches/:id/swipe`, `/matches/:id/respond`; rate-limits §2.4; errores RFC 7807 §2.5.
- `new/03-agents.md` — Refiner UI-tools **§3.1.5** + §3.1.5.1/.2; **Parser §3.3**; **Validator §3.4** (incl. match-potential §3.4.5, anti-injection §3.4.10); **Matcher §3.2** (Phase A §3.2.1, Phase B §3.2.2, anti-injection §3.2.6, eval §3.2.3).
- `new/04-ui-and-flows.md` — rutas §4.1, árbol §4.2, journeys §4.4.0–4.4.5 (mode picker, form, paste, health card), match deck §4.4.1/.2, MatchCard §4.3.
- `new/mockups.html` — `#matches` (match deck + MatchCard + match-banner), `#zoom` (MatchCard/BriefCard art). Port verbatim.
- `new/refiner-ui-catalog.html` — los 6 componentes declarativos (multiple_choice, app_comparison, negative_picker, dimension_slider, priority_ranking, budget_picker) con sus estados interactive/frozen y el envelope `ui_call`/`ui_response`. Port verbatim (`.rui-*`).

**Patrones existentes a seguir (de Fase 1):**

- `apps/web/lib/wanted/agents/refiner.ts` — patrón de agente Anthropic (streaming/tool-use, prompt caching, retry-once).
- `apps/web/lib/wanted/anthropic.ts`, `gate.ts`, `problem.ts`, `sse.ts`, `turn-repo.ts`, `brief-state.ts`, `brief-repo.ts`, `matching.ts` (stub a reemplazar).
- `apps/web/app/api/v1/briefs/route.ts`, `[id]/refine/route.ts` (SSE), `[id]/approve/route.ts`, `[id]/content/route.ts` — patrón de route handlers + clientes mixtos (sesión para `briefs`, admin para tablas sin INSERT RLS).
- `apps/web/app/(shell)/wanted/new/page.tsx` + `refiner-client.tsx` + `_components/*` + `_lib/sse-client.ts` — patrón de página gated + cliente SSE + componentes ported.
- `apps/web/app/styles/wanted.css`, `apps/web/messages/{en,es}.json` (namespace `Wanted`).
- `packages/shared/src/wanted/agent-prompts.ts` (REFINER\_\*), `brief-content.ts`, `enums.ts`, `completeness.ts`.
- `packages/db/migrations/0031_briefs.sql`, `0032_matches.sql`, `0033_brief_audit.sql`, `0034_extend_profiles_apps.sql`, `0006_apps.sql` (apps.search_vector tsvector + GIN).

### New Files (resumen — detalle por tarea)

- `packages/shared/src/wanted/agent-prompts.ts` (extender: PARSER*\*, VALIDATOR*\*, UI_TOOLS).
- `apps/web/lib/wanted/agents/{parser,validator}.ts`.
- `apps/web/lib/wanted/matching/{retriever,phase-a,phase-b,run,heuristic}.ts`.
- `apps/web/lib/wanted/{suggestion-repo,match-repo,match-audit-repo}.ts`.
- `apps/web/app/api/v1/briefs/[id]/{parse,validate,match}/route.ts`, `[id]/suggestions/[sid]/{apply,dismiss}/route.ts`, `[id]/turns/[turnId]/ui-response/route.ts`.
- `apps/web/app/api/v1/matches/[id]/{swipe,respond}/route.ts`.
- `apps/web/app/(shell)/wanted/new/page.tsx` (→ mode picker), `new/chat/`, `new/form/`, `new/paste/`, `[id]/health/`, `[id]/matches/` + `_components/*` (match-card, match-deck, match-banner, suggestion-row, quality-breakdown, match-potential-delta, mode-picker, refiner-ui/{6 components}).
- Evals: `apps/web/eval/{parser,validator,matcher}/`.

## Implementation Plan

### Phase A: shared + agents (no UI deps)

Extender `agent-prompts.ts` con prompts/tools de Parser, Validator y los 6 UI-tools. Implementar
los agentes Parser y Validator y el heurístico de match-potential. Implementar el
`CandidateRetriever` (FTS) y las dos fases del Matcher + repos de matches/suggestions/audit.

### Phase B: endpoints

parse (SSE), validate, suggestions apply/dismiss, ui-response, match, matches (GET), swipe,
respond. Extender create para form/paste. Reemplazar el stub `triggerMatching` por la orquestación real.

### Phase C: UI (port verbatim) + i18n/css

mode picker, form, paste, health card (+ sub-componentes), match deck (+ match-card/banner),
6 componentes declarativos. Extender `wanted.css` y el namespace `Wanted`.

### Phase D: evals + validación + experts.

## Expert Context

Consultados: **nextjs**, **supabase**, **database**, **testing** (ya actualizados en F1; aplican).

- **supabase/database:** FTS vía `apps.search_vector` (tsvector + GIN, `0006_apps.sql`) — usar
  `client.from('apps').select(...).textSearch('search_vector', query, { type: 'websearch' })`.
  Filtros duros con `.in/.contains/.overlaps` sobre `apps.solves_problems` (GIN), `apps` status/live,
  y `profiles.{accepts_requests,request_capacity,request_domains,request_rate_band}`. **Escrituras a
  `matches`/`validator_suggestions`/`brief_match_audit_logs` con cliente ADMIN** (solo SELECT RLS;
  patrón idéntico a `turn-repo` de 1a). Lecturas con sesión (RLS author/candidate). Sin migraciones
  nuevas (las tablas ya existen de Fase 0); NO regenerar types.
- **nextjs:** páginas bajo `(shell)/wanted/**` heredan shell; server gate `getUser`→redirect +
  `isWantedEnabled`→`notFound`. SSE cliente con `streamRefine`-style (fetch+reader). Port verbatim
  (regla prototype-port ya extendida a `(shell)/wanted/**`). i18n `useTranslations('Wanted')`.
- **claude-api skill:** prompt caching en system+tools para Parser/Validator/Matcher (Haiku para
  re-rank del Matcher, Sonnet para Parser/Validator).
  > Ignorar reglas stale `frontend-store.md`/`frontend-components.md`/`database-migrations.md`.

## Team Orchestration

Ejecutado vía `/tac:implement` (subagente fresco por tarea, two-stage review).

### Team Members

- **shared-agents-builder** — agentes + prompts + matcher core (Agent Type: `build-agent`, Model: opus, Owns: `packages/shared/src/wanted/agent-prompts.ts`, `apps/web/lib/wanted/agents/*`, `apps/web/lib/wanted/matching/*`, `apps/web/lib/wanted/{suggestion-repo,match-repo,match-audit-repo}.ts`; Caps: Write/Edit/Read/Bash; Plan Approval: true)
- **api-builder** — route handlers (Agent Type: `build-agent`, Model: opus, Owns: `apps/web/app/api/v1/briefs/[id]/{parse,validate,match}/route.ts`, `[id]/suggestions/**`, `[id]/turns/**`, `apps/web/app/api/v1/matches/**`, `apps/web/app/api/v1/briefs/route.ts`; Caps: Write/Edit/Read/Bash; Plan Approval: true)
- **ui-builder-15** — UI de 1.5 (Agent Type: `build-agent`, Model: sonnet, Owns: `apps/web/app/(shell)/wanted/new/**` (picker/chat/form/paste), `[id]/health/**`, the refiner-ui components; Caps: Write/Edit/Read/Bash)
- **ui-builder-2** — UI del matcher (Agent Type: `build-agent`, Model: sonnet, Owns: `apps/web/app/(shell)/wanted/[id]/matches/**`, `(shell)/wanted/_components/{match-card,match-deck,match-banner,intent-badge-request}.tsx`; Caps: Write/Edit/Read/Bash)
- **style-i18n-builder** — css + i18n (Agent Type: `build-agent`, Model: sonnet, Owns: `apps/web/app/styles/wanted.css`, `apps/web/messages/{en,es}.json`; Caps: Write/Edit/Read/Bash)
- **eval-builder** — evals (Agent Type: `build-agent`, Model: sonnet, Owns: `apps/web/eval/{parser,validator,matcher}/**`; Caps: Write/Edit/Read/Bash)
- **validator** — validación + experts (Agent Type: `general-purpose`, Model: sonnet, Owns: none)

### ⚠️ Regla para TODOS los subagentes

**Prohibido `git stash`, `git checkout`, `git reset`, `git clean` o cualquier comando git que
cambie el árbol** — hay mucho trabajo sin commitear; un `git stash` paralelo ya corrompió el árbol
una vez (revierte archivos trackeados). Solo leer/escribir los archivos propios + typecheck/lint/test.

## Validation Hooks

### Available Validators

- `validate_new_file.py --directory <dir> --extension <ext>` (Stop)
- `validate_file_contains.py --directory <dir> --extension <ext> --contains '<string>'` (Stop)

### Custom Validators

None — existing validators cover this; verbatim-port fidelity se valida por review + el screenshot.

### Hook Assignments

| Team Member           | Hook | Matcher | Validator                                                                                                   |
| --------------------- | ---- | ------- | ----------------------------------------------------------------------------------------------------------- |
| api-builder           | Stop | —       | `validate_file_contains.py --directory apps/web/app/api/v1 --extension ts --contains 'assertWantedEnabled'` |
| shared-agents-builder | Stop | —       | `validate_new_file.py --directory apps/web/lib/wanted/matching --extension ts`                              |

## Step by Step Tasks

### 1. Prompts + tool defs (shared)

- **Task ID**: shared-prompts
- **Depends On**: none
- **Assigned To**: shared-agents-builder
- **Parallel**: true
- **Owns Files**: `packages/shared/src/wanted/agent-prompts.ts`
- **Context**: Extender `agent-prompts.ts` (NO romper los `REFINER_*` existentes). Añadir: `PARSER_SYSTEM_PROMPT` (verbatim de `new/03-agents.md` §3.3.3), `PARSER_MODEL='claude-sonnet-4-6'`, `PARSER_TEMPERATURE=0.2`, `PARSE_MAX_CHARS=4000`; `VALIDATOR_SYSTEM_PROMPT` (§3.4.3 verbatim), `VALIDATOR_MODEL='claude-sonnet-4-6'`, `VALIDATOR_TEMPERATURE=0.6`; `MATCHER_RERANK_MODEL='claude-haiku-4-5-20251001'` + los dos prompts de re-rank de Matcher (Phase A §3.2.1, Phase B §3.2.2, verbatim, con delimitadores `<brief>`); `UI_TOOLS` = las 6 tool defs declarativas (§3.1.5, input/output schema a mano, sin deps). Reexportar en `index.ts`. Leer §3.1.5/§3.3/§3.4/§3.2 antes.
- **Actions**: extender prompts/tools; reexportar; `pnpm --filter @hatch/shared typecheck`.

### 2. Parser + Validator agents + match-potential heuristic

- **Task ID**: agents-pv
- **Depends On**: shared-prompts
- **Assigned To**: shared-agents-builder
- **Parallel**: false
- **Owns Files**: `apps/web/lib/wanted/agents/parser.ts`, `apps/web/lib/wanted/agents/validator.ts`, `apps/web/lib/wanted/matching/heuristic.ts`
- **Context**: Seguir el patrón de `agents/refiner.ts`. `parser.ts`: `runParser({anthropic, pastedText})` one-shot (no streaming necesario, pero puede stremear) → patch BriefContent + parserConfidence + summary (§3.3). `validator.ts`: `runValidator({anthropic, content})` → `QualityAssessment` (overallQuality, qualityBySection, suggestions[], §3.4) con validación de output (exampleBetter ≥30 chars, diagnosis referencia tokens del brief, ≤3 suggestions, retry-once). `heuristic.ts`: `computeMatchPotential(brief, retriever)` heurístico barato sin LLM (§3.4.5: cosine N/A→usar FTS rank/overlap, hard_filters, liveness). Anti-inyección: envolver content en `<brief>`. Leer §3.3, §3.4, §3.4.5.
- **Actions**: implementar los 3; `pnpm --filter web typecheck`.

### 3. CandidateRetriever (FTS) + Matcher Phase A/B + repos

- **Task ID**: matcher-core
- **Depends On**: shared-prompts
- **Assigned To**: shared-agents-builder
- **Parallel**: false
- **Owns Files**: `apps/web/lib/wanted/matching/retriever.ts`, `apps/web/lib/wanted/matching/phase-a.ts`, `apps/web/lib/wanted/matching/phase-b.ts`, `apps/web/lib/wanted/matching/run.ts`, `apps/web/lib/wanted/match-repo.ts`, `apps/web/lib/wanted/match-audit-repo.ts`, `apps/web/lib/wanted/suggestion-repo.ts`
- **Context**: `retriever.ts`: interfaz `CandidateRetriever` + impl FTS — `retrieveApps(brief, k=30)` (Supabase `.textSearch('search_vector', q, {type:'websearch'})` derivando `q` del brief; pre-filtros: drop apps en `existingStack`, licensing opuesto, archived/no-live; usar `solves_problems` overlap) y `retrieveBuilders(brief, k=50)` (filtros §3.2.2: `accepts_requests`, `request_capacity` vs matches activos, `request_rate_band` overlap budget, `request_domains` incluye industry o vacío, ≥1 app shipped). `phase-a.ts` (§3.2.1: retrieve→prefilter→Haiku batched re-rank→threshold 75/60→top 3) + audit. `phase-b.ts` (§3.2.2: retrieve→hard filter→Haiku re-rank→≥60 cap 5→write matches). `run.ts`: `runMatching(briefId, mode='both')` orquesta A→(condicional)B, escribe `matches` (admin, XOR app|builder), audit logs. Repos (cliente admin, tablas sin INSERT RLS): `match-repo` (insert/list/get/updateAction sobre `matches`), `match-audit-repo` (insert `brief_match_audit_logs`), `suggestion-repo` (insert/list/updateStatus sobre `validator_suggestions`). Anti-inyección §3.2.6 (delimitadores + flag score≥90 con rationale sospechoso). Leer §3.2 completo. Embeddings DIFERIDOS (solo FTS).
- **Actions**: implementar retriever+fases+run+repos; `pnpm --filter web typecheck`.

### 4. Endpoints de validación/parse/ui-response + create multi-modo

- **Task ID**: api-15
- **Depends On**: agents-pv, matcher-core
- **Assigned To**: api-builder
- **Parallel**: false
- **Owns Files**: `apps/web/app/api/v1/briefs/route.ts` (extender), `apps/web/app/api/v1/briefs/[id]/parse/route.ts`, `apps/web/app/api/v1/briefs/[id]/validate/route.ts`, `apps/web/app/api/v1/briefs/[id]/suggestions/[sid]/apply/route.ts`, `apps/web/app/api/v1/briefs/[id]/suggestions/[sid]/dismiss/route.ts`, `apps/web/app/api/v1/briefs/[id]/turns/[turnId]/ui-response/route.ts`
- **Context**: Patrón de `briefs/[id]/refine/route.ts` (SSE) y `content/route.ts`. Extender `POST /briefs` para aceptar `mode:'form'|'paste'` (form crea DRAFT; paste valida 80–4000 chars y crea PARSING con `parsed_from`). `POST /:id/parse` (SSE, §2.1: structured_update + parser_summary + done; corre `runParser`, persiste content + parserConfidence, transición PARSING→AWAITING_VALIDATION→REVIEW_HEALTH). `POST /:id/validate` (§2.1: corre `runValidator`, persiste `quality_score`/`quality_by_section`, inserta `validator_suggestions` vía suggestion-repo, `match_potential_estimate` vía heuristic; status REVIEW_HEALTH; gate completeness≥0.5). `suggestions/:sid/apply` (aplica exampleBetter|customValue en content vía setContentPath, status APPLIED, re-run heuristic) y `/dismiss`. `POST /:id/turns/:turnId/ui-response` (§2.1.1: valida output vs schema del componente, sintetiza user message, reanuda el stream del Refiner; cap 3/sesión). RFC 7807, rate-limits §2.4. Leer §2.1.
- **Actions**: implementar; `pnpm --filter web typecheck`.

### 5. Endpoints de matching + swipe + approve real

- **Task ID**: api-2
- **Depends On**: matcher-core
- **Assigned To**: api-builder
- **Parallel**: false
- **Owns Files**: `apps/web/app/api/v1/briefs/[id]/match/route.ts`, `apps/web/app/api/v1/briefs/[id]/matches/route.ts`, `apps/web/app/api/v1/matches/[id]/swipe/route.ts`, `apps/web/app/api/v1/matches/[id]/respond/route.ts`, `apps/web/lib/wanted/matching.ts` (reemplazar stub)
- **Context**: Reemplazar `triggerMatching` (stub) por una llamada a `runMatching` (de `matching/run.ts`); `approve` ya la invoca. `POST /:id/match` (§2.1: re-trigger, mode apps|builders|both). `GET /:id/matches` (§2.1: author-only, lista desde match-repo con candidate summary). `POST /matches/:id/swipe` (seeker CONNECT|SKIP; app match auto-crea thread). `POST /matches/:id/respond` (builder CONNECT|SKIP + feedback; en mutual CONNECT crea thread reusando la primitiva de mensajes existente y notifica). Clientes: lectura sesión (RLS), escritura de matches admin. Leer §2.1 (match/swipe/respond) y la primitiva de threads/notifs existente.
- **Actions**: implementar; `pnpm --filter web typecheck`.

### 6. CSS + i18n (extender)

- **Task ID**: style-i18n
- **Depends On**: none
- **Assigned To**: style-i18n-builder
- **Parallel**: true
- **Owns Files**: `apps/web/app/styles/wanted.css`, `apps/web/messages/en.json`, `apps/web/messages/es.json`
- **Context**: Extender `wanted.css` (append, sin tocar lo de F1) con el CSS VERBATIM de `new/mockups.html` para `#matches` (`.match-banner*`, `.match-deck*`, `.card-match*`, `.match-conf`, `.intent-pill*`) y del mode picker / form / paste / health card si están en el mockup; y de `new/refiner-ui-catalog.html` los `.rui-*` de los 6 componentes. Extender el namespace `Wanted` en en/es (ES neutro, sin voseo) con todo el copy nuevo: mode picker (3 cards), form labels, paste placeholder/counter, health card (quality by section, match potential, suggestions, "Publish as-is", "Apply all"), match deck ("This might already exist…", Connect/Skip, confidence), inbox/empty states relevantes. JSON válido. Leer §4.4 para el copy.
- **Actions**: extender css + messages; verificar JSON parsea + typecheck no rompe.

### 7. UI 1.5 — mode picker + form + paste + health card + 6 componentes declarativos

- **Task ID**: ui-15
- **Depends On**: api-15, style-i18n
- **Assigned To**: ui-builder-15
- **Parallel**: false
- **Owns Files**: `apps/web/app/(shell)/wanted/new/page.tsx` (→ mode picker), `apps/web/app/(shell)/wanted/new/_components/mode-picker.tsx`, `apps/web/app/(shell)/wanted/new/chat/page.tsx` (mover el refiner actual aquí), `apps/web/app/(shell)/wanted/new/form/**`, `apps/web/app/(shell)/wanted/new/paste/**`, `apps/web/app/(shell)/wanted/[id]/health/**`, `apps/web/app/(shell)/wanted/_components/{suggestion-row,quality-breakdown,match-potential-delta}.tsx`, `apps/web/app/(shell)/wanted/new/_components/refiner-ui/*` (6 componentes)
- **Context**: Port VERBATIM (regla prototype-port, sin Tailwind, clases del mockup). **Mover** la página actual `wanted/new/page.tsx` (refiner) a `wanted/new/chat/page.tsx` y hacer `wanted/new/page.tsx` el **mode picker** (3 cards §4.4.0, recuerda última elección via localStorage, rutea a chat/form/paste). `form/`: page server-gate + `form-mode-client.tsx` (campos editables full-page reusando `EditableField`/`RemovableChip` de F1, autosave vía `PATCH /content`, barra de completeness, CTA `Validate & match` → `POST /validate` → redirect `/wanted/[id]/health`). `paste/`: page + `paste-mode-client.tsx` (textarea 80–4000 + `Parse it` → `POST /parse` SSE poblando la forma en vivo + banner del parser). `[id]/health/`: page + `health-card-client.tsx` (§4.4.5: quality bar, quality-breakdown por sección, match-potential-delta, suggestion-row con Apply/Dismiss → endpoints, "Publish as-is" gated qualityScore≥0.5 → approve). 6 componentes en `new/_components/refiner-ui/` (estados interactive/frozen, port de `refiner-ui-catalog.html`); cablear su render en `refiner-transcript.tsx` (vía SendMessage a ui-builder si toca ese archivo — coordinarlo: este task PUEDE editar refiner-transcript.tsx para el render de ui bubbles) y el flujo `ui_call`→render→`POST /ui-response`→reanudar SSE en `refiner-client.tsx`. **Nota:** si necesitas tocar `refiner-client.tsx`/`refiner-transcript.tsx` (owned por F1), está permitido SOLO para este wiring. Leer §4.2/§4.4 y `refiner-ui-catalog.html`. `useTranslations('Wanted')`.
- **Actions**: implementar; `pnpm --filter web typecheck` + `lint`.

### 8. UI 2 — match deck + match card + banner

- **Task ID**: ui-2
- **Depends On**: api-2, style-i18n
- **Assigned To**: ui-builder-2
- **Parallel**: false
- **Owns Files**: `apps/web/app/(shell)/wanted/[id]/matches/**`, `apps/web/app/(shell)/wanted/_components/match-card.tsx`, `apps/web/app/(shell)/wanted/_components/match-deck.tsx`, `apps/web/app/(shell)/wanted/_components/match-banner.tsx`, `apps/web/app/(shell)/wanted/_components/intent-badge-request.tsx`
- **Context**: Port VERBATIM del mockup `#matches` + `#zoom` (MatchCard). `[id]/matches/page.tsx` (server gate author-only; carga `GET /matches`) + `match-deck` (stack + swipe → `POST /matches/:id/swipe`) + `match-card` (app variant con cover_url / builder variant con avatar+gradient, rationale, confidence, Connect/Skip — keyboard →/←) + `match-banner` ("This might already exist…" cuando hay app ≥75). `intent-badge-request` (color request). Leer §4.3/§4.4.1/.2 y el mockup. `useTranslations('Wanted')`.
- **Actions**: implementar; `pnpm --filter web typecheck` + `lint`.

### 9. Evals (parser + validator + matcher) — env-guarded

- **Task ID**: evals
- **Depends On**: agents-pv, matcher-core
- **Assigned To**: eval-builder
- **Parallel**: false
- **Owns Files**: `apps/web/eval/parser/**`, `apps/web/eval/validator/**`, `apps/web/eval/matcher/**`
- **Context**: Mismo patrón env-guarded que `apps/web/eval/refiner/` (skipIf sin `WANTED_EVAL_LIVE`). Parser: cases §3.3.7 (6 seed) umbral 80%. Validator: cases §3.4.7 (7 seed) umbral 85%. Matcher: cases §3.2.3 (5 seed, con pool sintético de apps/builders) umbral 85%. Runners que ejercen los agentes reales y assertan. Leer §3.3.7/§3.4.7/§3.2.3.
- **Actions**: implementar cases+runners+tests env-guarded; `pnpm --filter web exec vitest run` (unit verdes, evals skipped).

### 10. Validación final

- **Task ID**: validate-all
- **Depends On**: api-15, api-2, ui-15, ui-2, style-i18n, evals
- **Assigned To**: validator
- **Parallel**: false
- **Context**: Correr `pnpm typecheck`, `pnpm lint`, `pnpm --filter web exec vitest run`, `pnpm build`. Verificar que las rutas nuevas (`/wanted/new`, `/new/{chat,form,paste}`, `/[id]/health`, `/[id]/matches`, y todos los `/api/v1/briefs/[id]/*` + `/api/v1/matches/*`) compilan y aparecen en el manifest. Verificar acceptance criteria. Reportar pass/fail con salida real.
- **Actions**: correr comandos; verificar; reportar.

### 11. Self-improve experts

- **Task ID**: experts
- **Depends On**: validate-all
- **Assigned To**: validator
- **Parallel**: false
- **Context**: Self-improve `nextjs`, `supabase`, `database`, `testing` con los patrones nuevos (Parser/Validator/Matcher agents, retrieval FTS, match deck, ui_call/ui_response, evals). Surgical, YAML válido. (Estos son comandos `experts:*:self-improve`; como el asistente NO puede invocar comandos, este task ACTUALIZA los `expertise.yaml` directamente, sin invocar el comando.)
- **Actions**: editar los 4 `expertise.yaml`; verificar parseo YAML.

## Testing Strategy

### Unit Tests

- retriever: construcción de query FTS + filtros (con cliente Supabase fakeado).
- heuristic: cálculo de match-potential determinista.
- parser/validator: con cliente Anthropic mockeado (patrón de `refiner.test.ts`).
- match-repo/suggestion-repo: shape de insert (cliente fakeado).

### Edge Cases

- paste <80 / >4000 chars; parser confidence baja; validator 0 suggestions (quality≥0.7).
- Phase A ≥75 + no custom_build → skip Phase B; budget/geo/existingStack filtros; matches XOR.
- ui_call cap 3; ui-response component mismatch.
- swipe app auto-thread; mutual builder connect → thread.
- flag off → 404 en todas las rutas nuevas.

## Acceptance Criteria

- Mode picker en `/wanted/new`; Chat/Form/Paste funcionales; Paste corre el Parser (SSE) y puebla la forma; Form/Paste pasan por `/health`.
- Validator produce QualityAssessment + suggestions persistidas; Health Card aplica/descarta y "Publish as-is" gated a quality≥0.5.
- `approve` dispara matching REAL: Phase A (apps, FTS+Haiku) y, condicional, Phase B (builders); `matches` escritos (XOR), audit logged.
- `GET /matches` + match deck + swipe + builder respond + thread en mutual connect.
- 6 componentes declarativos renderizan (interactive/frozen) y el ciclo ui_call/ui_response reanuda el Refiner.
- `pnpm typecheck`/`lint`/`vitest`/`build` verdes; rutas en el manifest. Evals corren localmente (env) y pasan sus umbrales. Todo inerte tras el flag.

## Validation Commands

- `pnpm typecheck` · `pnpm lint` · `pnpm --filter web exec vitest run` · `pnpm build`
- UI: `WANTED_V1_ENABLED=true NODE_OPTIONS='--max-http-header-size=131072' pnpm --filter web dev` → recorrer `/wanted/new` → chat/form/paste → health → matches.

## Notes

- **Sin dependencias nuevas ni migraciones** (tablas y FTS ya existen de Fase 0). Embeddings semánticos DIFERIDOS (D1): el Matcher v1 es FTS+filtros+Haiku tras `CandidateRetriever` (segunda impl de embeddings se enchufa luego sin rehacer).
- **Escrituras admin** a `matches`/`validator_suggestions`/`brief_match_audit_logs` (solo SELECT RLS), authN/authZ por sesión antes.
- **Port verbatim** de `mockups.html` (#matches) + `refiner-ui-catalog.html` (6 `.rui-*`); copy a i18n (ES neutro).
- **MAGNITUD:** ~11 tareas grandes, varias con mucho fan-out interno (agents + matcher + 2 superficies UI). Es el bloque más grande del feature. Recomendado correr con Fase 1 **ya commiteada** (base limpia evita pérdidas por `git stash`).
- **Fuera de este bloque:** Fase 3 (builder inbox `/inbox?tab=requests`, settings/requests, brief detail público), Fase 4 (cron público 48h, resolve/extend, 13 MCP tools, llms.txt/openapi), Fase 5 (notifs/telemetría/anti-abuso/canary).
