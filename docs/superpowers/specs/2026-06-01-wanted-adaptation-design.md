# Diseño — Adaptación de "Brief & Match / Wanted" al stack de hatch

**Fecha:** 2026-06-01
**Estado:** aprobado (brainstorm) → listo para `/tac:feature` de la Fase 0
**Fuente:** spec ejecutable en `new/` (8 docs + 2 HTML de diseño)

## Propósito

La carpeta `new/` contiene una spec opinada y completa de una feature grande
("Brief & Match", nombre externo "Wanted"): un usuario ("seeker") publica una
necesidad y un sistema de 4 agentes la estructura y la empareja con apps
existentes o con builders de Hatch. Alcance original: 40 tareas, 5 fases.

El problema: **la spec asume un stack que no es el de hatch.** Los docs de datos
(`01-architecture-and-data.md`) y plan (`06-implementation-plan.md`) están
escritos en **Prisma + `packages/core` + `packages/mcp` + pgvector + shadcn/ui**.
hatch real usa **Supabase (SQL crudo aplicado vía MCP) + `apps/web` + `apps/mcp`
+ `packages/shared` + full-text search + convención prototype-port (CSS verbatim)**.

Curiosamente, el índice de diseño de la spec (`new/README 2.md`) **sí** está
alineado con hatch (rutas `apps/web/app/(shell)/wanted/`, `prototype-wanted.css`,
componentes existentes). O sea: los docs de datos/plan hablan Prisma, el de
diseño habla hatch. Hay que **adaptar los primeros, no copiarlos literal**.

Este documento fija las decisiones de adaptación, las convenciones, el mapa de
las 5 fases, y detalla la **Fase 0 (foundations)** lista para construir. Cada
fase posterior tendrá su propio ciclo brainstorm → spec → plan.

---

## 1. Decisiones de adaptación (cerradas con el usuario)

### D1 — Motor de matching: **híbrido por capas (sin proveedor de embeddings en v1)**

Anthropic no tiene API de embeddings y Supabase solo los **almacena** (pgvector),
no los genera. Matching semántico ⇒ obliga a un proveedor externo (OpenAI/Voyage),
lo que choca con la regla "no stack nuevo sin aprobación".

**Decisión:** el Matcher v1 recupera candidatos con **full-text search**
(`search_vector` tsvector/GIN, ya existente) **+ filtros duros** (budget, dominio,
liveness) **+ re-rank LLM con Haiku** (que la spec ya define igual), todo detrás de
una interfaz **`CandidateRetriever`**. Los embeddings semánticos quedan
**diferidos** hasta aprobación explícita del proveedor; ese día se enchufa una
segunda implementación de `CandidateRetriever` sin rehacer arquitectura.

**Implicación de datos:** la Fase 0 **NO** añade columnas `vector`. La dimensión
(`1536` OpenAI vs `1024` Voyage) depende del proveedor no elegido, así que la
extensión pgvector + columnas + índices HNSW + dimensión van en una migración de
embeddings **diferida**.

### D2 — Lógica de agentes y reparto REST↔MCP: **híbrido alineado a hatch**

Patrón actual de hatch: `apps/web` y `apps/mcp` hablan **directo a Supabase** cada
uno; `packages/shared` guarda solo **tipos + constantes puras**. El SDK de Anthropic
**no se usa todavía** en el repo — estos agentes serían la primera integración LLM.

**Decisión:**
- **Puro → `packages/shared/src/wanted/`**: schemas zod (`BriefContent`), enums/tipos,
  prompts de agentes (constantes), recetas de embedding-text. Sin efectos, reusable
  por ambos runtimes.
- **Agéntico/estado → `apps/web/lib/wanted/`**: repos, los 4 agentes (Anthropic SDK
  + prompt caching), orquestación de matching, SSE. Vive en el runtime de Next.js
  porque ahí están el streaming, las rutas y las escrituras service-role.
- **MCP**: las tools agénticas (refine/parse/validate/approve/match/swipe) **delegan
  a la web API** (`/api/v1/...`) — necesitan ese runtime igual; las lecturas triviales
  (`list_briefs`) pegan **directo a Supabase** como el MCP ya hace hoy.

**Por qué:** menor desviación del patrón actual, concentra la complejidad LLM/SSE en
un solo runtime (evita el doble-entorno de la opción `packages/core`), mantiene
`packages/shared` en su rol, y da paridad REST↔MCP donde importa.

### D3 — Feature flag `wanted_v1_enabled`: **env default + override por-usuario**

hatch no tiene sistema de flags. La spec pide off por defecto, canary por-usuario
(staff), luego público.

**Decisión:** `WANTED_V1_ENABLED` (env Vercel) como default/kill-switch global,
**más** `profiles.feature_flags jsonb default '{}'` para overrides por cuenta.
Helper `isWantedEnabled(profile, env)` en `packages/shared`. Compuerta en tres
lugares (se cablea conforme se construyen): layout `(shell)/wanted/*` (404 si off),
rutas `/api/v1/...` (403/404 si off), MCP tools (ocultas si off).

### D4 — Prisma: **descartado**

Se traduce el `schema.prisma` (§1.4) a SQL nativo Supabase. Sin Prisma, sin
Postgres local, sin Docker. Tipos vía Supabase MCP → `apps/web/lib/supabase/types.ts`.

### D5 — Alcance de este doc: **decisiones + mapa de 5 fases + Fase 0 detallada**

La feature es demasiado grande para un solo spec→plan. Se decompone por fase; este
doc detalla solo la Fase 0 y mapea el resto a alto nivel.

---

## 2. Convenciones (siguiendo hatch, no la spec)

- Tablas `public.<snake_plural>`: `briefs`, `matches`, `brief_refinement_turns`,
  `brief_match_audit_logs`, `validator_suggestions`.
- IDs `uuid default gen_random_uuid()` (no cuid). Columnas snake_case.
  `created_at` / `updated_at timestamptz`; trigger plpgsql para bump de `updated_at`.
- Enums **nativos** de Postgres (`create type ... as enum`) → Supabase MCP los
  convierte en uniones TS.
- **RLS habilitada** en toda tabla nueva (políticas por autor / builder emparejado /
  visibilidad pública, espejando §2.1 `GET /briefs/:id` y la matriz de Story I).
- Invariantes §1.7 como `CHECK` + triggers donde sea expresable; las cross-row
  (quota ≤ 3 activos) en el repo de la app + un job diario de sanity.
- El **`User`** de la spec mapea a **`public.profiles`** (el "app-level user");
  `auth.users` es solo identidad Supabase.
- Próxima migración: **`0030`** (la última es `0029_apps_built_with.sql`).

---

## 3. Fase 0 — Foundations (este slice → `/tac:feature`)

### 3.1 Migraciones SQL (`packages/db/migrations/`, aplicadas vía MCP de Supabase)

1. **`0030_wanted_enums.sql`** — enums nativos (de los enums de `01` §1.4):
   `brief_status` (DRAFT, REFINING, PARSING, AWAITING_VALIDATION, REVIEW_HEALTH,
   MATCHING, PRIVATE, PUBLIC, RESOLVED, EXPIRED), `brief_entry_mode` (CHAT, FORM,
   PASTE), `suggestion_status`, `brief_visibility`, `brief_use_case`,
   `technical_level`, `budget_band`, `brief_timeline`, `solution_type`,
   `candidate_type`, `swipe_action`, `commercial_status`, `turn_role`,
   `match_phase`, `brief_resolution`.

2. **`0031_briefs.sql`** — `public.briefs`:
   - `id uuid pk`, `author_id uuid references profiles(id) on delete cascade`.
   - `status brief_status default 'DRAFT'`, `entry_mode brief_entry_mode`,
     `refinement_round int default 0`.
   - `completeness_score float default 0`, `quality_score float default 0`,
     `quality_by_section jsonb`, `match_potential_estimate jsonb`,
     `manually_edited_fields text[] default '{}'`, `parsed_from text`.
   - `title text`, `content jsonb not null default '{}'` (ProblemStatement +
     OutcomeStatement + Context + Constraints + SolutionType[]).
   - Extractos consultables: `industry`, `use_case brief_use_case`,
     `technical_level`, `budget_band`, `timeline brief_timeline`,
     `solution_types solution_type[]`, `geography`.
   - `intent text default 'request'`, `visibility brief_visibility default
     'PRIVATE_MATCHED'`, `public_likes int default 0`, `public_rank float default 0`.
   - Lifecycle: `created_at`, `matching_started_at`, `public_at`,
     `expires_at not null` (default now()+14d), `resolved_at`,
     `resolution brief_resolution`.
   - Índices: `(status)`, `(author_id, status)`,
     `(visibility, public_rank desc)`, `(expires_at)`.
   - **CHECK** `expires_at > created_at`; **CHECK** `entry_mode = 'PASTE' ⇒
     parsed_from is not null`.
   - RLS + trigger updated_at. **Sin columna vector** (diferida).

3. **`0032_matches.sql`** — `public.matches`:
   - FK `brief_id → briefs on delete cascade`.
   - `candidate_type candidate_type`, `candidate_app_id uuid references apps(id)`,
     `candidate_builder_id uuid references profiles(id)`.
   - **CHECK** "exactamente un candidato" (app XOR builder, nunca ambos/ninguno).
   - `agent_confidence float`, `agent_rationale text`,
     `seeker_action swipe_action default 'PENDING'`,
     `candidate_action swipe_action default 'PENDING'`, `thread_id uuid`,
     `commercial_status commercial_status default 'NONE'`, timestamps de acción.
   - Índices `(brief_id, agent_confidence desc)`,
     `(candidate_builder_id, candidate_action)`, `(candidate_app_id)`;
     **unique** `(brief_id, candidate_type, candidate_app_id, candidate_builder_id)`.
   - RLS.

4. **`0033_brief_audit.sql`**:
   - `brief_refinement_turns` (round, turn_index, role turn_role, content,
     content_json, **`ui_component_invocation jsonb`**, model_used, tokens_in/out,
     created_at; índice `(brief_id, round, turn_index)`).
   - `brief_match_audit_logs` (phase match_phase, candidates_considered/shortlisted/
     final, model_used, duration_ms, rationale_json).
   - `validator_suggestions` (section_path, diagnosis, example_better,
     status suggestion_status default 'PENDING', applied_value, model_used,
     created_at, resolved_at; índice `(brief_id, status)`).
   - RLS (autor del brief).

5. **`0034_extend_profiles_apps.sql`**:
   - `profiles`: `accepts_requests boolean default false`,
     `request_capacity int default 3`, `request_domains text[] default '{}'`,
     `request_rate_band budget_band`, `inferred_capabilities text[] default '{}'`,
     `last_brief_response_at timestamptz`,
     **`feature_flags jsonb default '{}'`** (para D3).
   - `apps`: `discovery_via_brief_count int default 0`,
     `solves_problems text[] default '{}'`.

Cada migración con su sección de rollback (down) comentada, según convención hatch.

### 3.2 TypeScript

- **`packages/shared/src/wanted/`** (puro):
  - `brief-content.ts` — `BriefContentSchema` (zod, §3.1.4) + tipos derivados.
  - `enums.ts` — uniones TS de los enums (o reexport de los tipos generados).
  - `embedding-recipes.ts` — recetas de texto §1.6 como constantes (sin efectos),
    listas para cuando se active el proveedor.
- **`packages/shared/src/feature-flags.ts`** — `isWantedEnabled(profile, env)`.
- **`apps/web/lib/wanted/brief-repo.ts`** — CRUD, quota check (cuenta solo estados
  activos: REFINING, PARSING, AWAITING_VALIDATION, REVIEW_HEALTH, MATCHING, PRIVATE),
  transiciones de estado.
- **`apps/web/lib/wanted/invariants.ts`** — guardas §1.7 a nivel app (las que no son
  CHECK/trigger: quota ≤ 3, quality gate al pasar a MATCHING, CHAT ⇒ ≥1 user turn).
- **`apps/web/lib/wanted/completeness.ts`** — `computeCompletenessScore(content)`
  (pura, §3.1.6).
- Regenerar **`apps/web/lib/supabase/types.ts`** vía MCP tras aplicar migraciones.

### 3.3 Tests (Fase 0)

- `computeCompletenessScore` — cada check booleano produce la fracción esperada.
- quota — cuenta solo estados activos; el 4º brief activo → error.
- invariantes — intentos de bypass fallan.
- `isWantedEnabled` — env global on/off + override por-usuario.

### 3.4 Definition of Done — Fase 0

- Las 5 migraciones aplican limpio en el proyecto cloud (vía MCP); `types.ts`
  regenerado y tipado.
- `brief-repo` crea y lee un brief; bloquea el 4º brief activo del mismo autor.
- Enums tipados en TS; flag helper testeado.
- Todo **inerte tras el flag** (off por defecto). Ninguna ruta/UI nueva expuesta aún.

---

## 4. Mapa de las 5 fases

| Fase | Contenido | Δ por decisiones |
|------|-----------|------------------|
| **0 Foundations** | migraciones, repo, flag, types, tests | sin columnas vector (D1) |
| **1 Refiner** | agente Refiner (Anthropic SDK + prompt caching, skill `claude-api`), REST create / refine(SSE) / approve, eval harness, UI chat + summary panel (port mockup `#refiner`) | agente en `apps/web/lib/wanted/agents/` (D2) |
| **1.5 Multi-modo + Validación** | mode picker, Form, Parser, Paste, Validator, Brief Health Card, 6 componentes UI declarativos (port `refiner-ui-catalog.html` → `prototype-wanted.css` + `.rui-*`), ciclo `ui_call`/`ui_response` + cap 3 | port verbatim (regla de prototipo) |
| **2 Matcher** | `CandidateRetriever` (impl FTS+filtros), Phase A apps, Phase B builders, orquestación + REST, eval, guards anti-inyección | **tareas de embeddings diferidas** (D1); retrieval por FTS |
| **3 Builder side + swipe** | preferencias de request, inbox builder, match deck seeker, brief detail (port `#matches/#inbox/#settings`) | — |
| **4 Lifecycle / gallery / MCP** | cron fallback público 48h, resolve/extend, **13 MCP tools** (delegando a web API), `llms.txt` + openapi regen | MCP delega (D2) |
| **5 Polish** | notificaciones (primitiva existente), telemetría, anti-abuso/rate-limits, canary del flag | — |

### Trabajo diferido (pendiente de aprobación de stack)

- **Proveedor de embeddings** (OpenAI `text-embedding-3-small` ó Voyage `voyage-3`).
  Habilita: segunda impl de `CandidateRetriever` (retrieval semántico) + migración
  `vector` (extensión pgvector + columnas en `briefs`/`apps`/`profiles` + índices
  HNSW, dimensión según proveedor) + cron nocturno de capability-embeddings.

---

## 5. Naming y notas

- **Código/DB:** `Brief`/`briefs`. **UX:** "Wanted". Flag `wanted_v1_enabled`.
- Decisiones de diseño abiertas (no bloquean Fase 0): color del intent pill
  `request`, nombre externo final, copy del CTA — ver `new/README 2.md` §"Open
  design decisions". Defaults de la spec valen hasta revisión de marca.
- Los 2 HTML (`new/mockups.html`, `new/refiner-ui-catalog.html`) son el **spec
  visual**: port byte-a-byte conforme a `.claude/rules/prototype-port-exception.md`.
