# Feature: Wanted Fase 1 (cierre) — UI del Refiner + autosave

## Metadata

issue_number: `wanted-p1b`
adw_id: `1`
issue_json: `docs/superpowers/specs/2026-06-01-wanted-phase1-refiner-ui-design.md`

## Feature Description

UI del agente Refiner: la página `/wanted/new` donde un _seeker_ articula su problema
en un chat guiado, ve el **brief summary** llenarse en vivo, **edita campos inline**
(autosave) y **aprueba** para pasar a matching. Es un **port byte-a-byte** del mockup
`new/mockups.html` `#refiner` (CSS classes + inline styles verbatim, SIN Tailwind, regla
`.claude/rules/prototype-port-exception.md`) cableado a los endpoints REST de Slice 1a
(`POST /briefs`, `POST /briefs/:id/refine` SSE, `POST /briefs/:id/approve`) más un endpoint
nuevo `PATCH /briefs/:id/content` para el autosave del panel. Cierra la Fase 1 end-to-end.

## User Story

As a **seeker**
I want to **describir mi problema en un chat que lo estructura en vivo y poder corregir cualquier campo**
So that **publico un brief accionable sin redactar nada formal**.

## Problem Statement

Slice 1a dejó el agente Refiner y los 3 endpoints, pero **no hay UI**: el feature no es
usable por un humano. Falta la página del chat, el panel de resumen editable, el consumo
del stream SSE, y el endpoint de edición por-campo (`PATCH /content`) que el panel necesita.

## Solution Statement

Portar verbatim el screen `#refiner` (split-pane: chat a la izquierda, brief summary a la
derecha) a componentes React bajo `apps/web/app/(shell)/wanted/`, con un cliente
(`'use client'`) que orquesta crear→refine(SSE)→approve y maneja el autosave de campos.
La página server-component gatea el feature flag (`notFound()` si off). El CSS verbatim del
mockup va en `apps/web/app/styles/wanted.css`. Un endpoint `PATCH /content` + helper
`setContentPath` habilita la edición inline.

## Relevant Files

**Referencia / patrón:**

- `docs/superpowers/specs/2026-06-01-wanted-phase1-refiner-ui-design.md` — diseño aprobado.
- `new/mockups.html` — **SPEC visual**. `#refiner`: CSS líneas **404–698**, HTML **1341–1500+**. Portar verbatim.
- `new/README 2.md` — "Component index" (class roots + archivos propuestos) e "Interaction principles".
- `apps/web/app/(shell)/layout.tsx` — el ShellLayout (getUser + `<Shell>`); las páginas hijas heredan el shell.
- `apps/web/app/(shell)/gallery/page.tsx` — patrón de página RSC ported + i18n (`getTranslations`).
- `apps/web/app/layout.tsx` — imports de CSS (líneas 10–15); aquí se añade `wanted.css`.
- `apps/web/app/_components/cards.tsx` — `Avatar` (mismo contrato hue/emoji) por si se reusa.
- `apps/web/lib/auth.ts` — `getUser()` (`{user, profile}|null`), `requireUser()` (throws).
- `apps/web/app/api/v1/apps/route.ts` — patrón de route handler (runtime/dynamic/CORS/OPTIONS/jsonResponse/rate-limit).
- `apps/web/lib/wanted/*` (de 1a): `brief-repo.ts` (`getBrief`), `brief-state.ts` (`applyDraftPatch`, `computeAndPersistContent`; aquí se añade `setContentPath`), `gate.ts` (`assertWantedEnabled`), `problem.ts` (RFC 7807).
- `packages/shared/src/wanted/*`: `BriefContent`/`BriefContentSchema`, `computeCompletenessScore`, `isWantedEnabled`.
- `apps/web/messages/en.json`, `apps/web/messages/es.json` — i18n (añadir namespace `Wanted`). Español **neutro** (tú/quieres), nunca voseo.
- `apps/web/app/styles/prototype-base.css` `:root` — tokens (`--ax`, `--mono`, gradient del logo) que `wanted.css` consume.
- `.claude/rules/prototype-port-exception.md` — extender su scope con los nuevos paths wanted.

### New Files

- `apps/web/app/styles/wanted.css` — CSS verbatim del mockup.
- `apps/web/app/api/v1/briefs/[id]/content/route.ts` — `PATCH` por-campo.
- `apps/web/lib/wanted/set-content-path.test.ts` — test del setter.
- `apps/web/app/(shell)/wanted/new/page.tsx` — server, gate del flag.
- `apps/web/app/(shell)/wanted/new/refiner-client.tsx` — orquestador `'use client'`.
- `apps/web/app/(shell)/wanted/new/_lib/sse-client.ts` — consumo SSE (fetch+reader+parser).
- `apps/web/app/(shell)/wanted/new/_components/refiner-transcript.tsx` — burbujas.
- `apps/web/app/(shell)/wanted/new/_components/refiner-composer.tsx` — composer.
- `apps/web/app/(shell)/wanted/_components/brief-summary-panel.tsx` — panel derecho.
- `apps/web/app/(shell)/wanted/_components/editable-field.tsx` — campo inline editable.
- `apps/web/app/(shell)/wanted/_components/removable-chip.tsx` — chip removible + add.

## Implementation Plan

### Phase 1: Foundation (paralelo)

CSS verbatim (`wanted.css` + import + extender la regla prototype-port), endpoint
`PATCH /content` + `setContentPath` + test, cliente SSE (`sse-client.ts`), componentes
presentacionales ported (chat + summary), e i18n (`Wanted` namespace). Todo en archivos
disjuntos → 6 tareas en paralelo.

### Phase 2: Core Implementation

El orquestador `refiner-client.tsx` + `page.tsx` (gate) cablean componentes + SSE +
endpoints (create/refine/approve/patch) en el flujo completo.

### Phase 3: Integration

Validación Playwright (screenshot vs mockup `#refiner`) + typecheck/lint/build + self-improve nextjs.

## Expert Context

Consultados: **nextjs**, **supabase** (ya actualizados en Slice 1a; sus patrones aplican).

- **nextjs**: páginas en `apps/web/app/(shell)/<ruta>/page.tsx` (RSC por defecto, `'use client'` solo donde hay interacción); CSS de prototipo importado en root `app/layout.tsx`; i18n con `getTranslations` (server) / `useTranslations` (client) namespace por feature; ports de prototipo usan CSS verbatim, NO Tailwind (`.claude/rules/prototype-port-exception.md`). Route handlers SSE devuelven `Response` con `ReadableStream` (`apps/web/lib/wanted/sse.ts` ya existe para el server; el cliente parsea frames `event:/data:`). Auth en server: `getUser()`; el ShellLayout ya provee shell + sesión.
- **supabase**: cliente de **sesión** para `briefs` (RLS `author all`); RFC 7807 vía `problem.ts`. El `PATCH /content` escribe `briefs.content`/`manually_edited_fields`/`completeness_score` con el cliente de sesión.

**Takeaways:** (1) la página hereda el shell de `(shell)/layout.tsx` — NO re-renderizar shell; (2) gate del flag en el server component con `notFound()`; (3) copy a i18n aunque el port sea verbatim (los ports previos se i18n'aron); (4) SSE en el cliente con `fetch`+reader (EventSource no soporta POST).

> Ignorar `.claude/rules/frontend-store.md` y `.claude/rules/frontend-components.md` (artefactos stale de la librería fuente — dashboard Zustand/WebSocket; NO aplican a hatch). Igual `.claude/rules/database-migrations.md` (referencia `apps/orchestrator_db` inexistente).

## Team Orchestration

Ejecutado vía `/tac:implement` (subagente fresco por tarea, two-stage review). El lead orquesta.

### Team Members

- **css-builder**
  - Role: CSS verbatim del mockup + wiring del import + scope de la regla prototype-port
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/web/app/styles/wanted.css`, `apps/web/app/layout.tsx`, `.claude/rules/prototype-port-exception.md`
  - Required Capabilities: file write (Write, Edit), Read, shell (Bash) para typecheck
  - Plan Approval: false
  - Hooks:
    - Stop: `validate_new_file.py --directory apps/web/app/styles --extension css`

- **patch-builder**
  - Role: endpoint PATCH /content + helper setContentPath + test
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/web/app/api/v1/briefs/[id]/content/route.ts`, `apps/web/lib/wanted/brief-state.ts`, `apps/web/lib/wanted/set-content-path.test.ts`
  - Required Capabilities: file write (Write, Edit), Read, shell (Bash) para typecheck/vitest
  - Plan Approval: false
  - Hooks:
    - Stop: `validate_file_contains.py --directory apps/web/app/api/v1/briefs --extension ts --contains 'assertWantedEnabled'`

- **sse-client-builder**
  - Role: cliente SSE (streamRefine) + test
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/web/app/(shell)/wanted/new/_lib/sse-client.ts`, `apps/web/app/(shell)/wanted/new/_lib/sse-client.test.ts`
  - Required Capabilities: file write (Write, Edit), Read, shell (Bash) para vitest
  - Plan Approval: false
  - Hooks: none

- **chat-components-builder**
  - Role: port verbatim de transcript + composer
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/web/app/(shell)/wanted/new/_components/refiner-transcript.tsx`, `apps/web/app/(shell)/wanted/new/_components/refiner-composer.tsx`
  - Required Capabilities: file write (Write, Edit), Read, shell (Bash) para typecheck
  - Plan Approval: false
  - Hooks: none

- **summary-components-builder**
  - Role: port verbatim del panel + editable-field + removable-chip
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/web/app/(shell)/wanted/_components/brief-summary-panel.tsx`, `apps/web/app/(shell)/wanted/_components/editable-field.tsx`, `apps/web/app/(shell)/wanted/_components/removable-chip.tsx`
  - Required Capabilities: file write (Write, Edit), Read, shell (Bash) para typecheck
  - Plan Approval: false
  - Hooks: none

- **i18n-builder**
  - Role: namespace `Wanted` en en/es
  - Agent Type: `build-agent`
  - Model: sonnet
  - Owns Files: `apps/web/messages/en.json`, `apps/web/messages/es.json`
  - Required Capabilities: file write (Edit), Read
  - Plan Approval: false
  - Hooks: none

- **orchestrator-builder**
  - Role: refiner-client (estado + flujo) + page server gate
  - Agent Type: `build-agent`
  - Model: opus
  - Owns Files: `apps/web/app/(shell)/wanted/new/page.tsx`, `apps/web/app/(shell)/wanted/new/refiner-client.tsx`
  - Required Capabilities: file write (Write, Edit), Read, shell (Bash) para typecheck/build
  - Plan Approval: true
  - Hooks:
    - Stop: `validate_new_file.py --directory apps/web/app/(shell)/wanted/new --extension tsx`

- **ui-validator**
  - Role: validación Playwright (screenshot /wanted/new vs mockup) + comandos
  - Agent Type: `ui-validator`
  - Model: sonnet
  - Owns Files: none
  - Required Capabilities: browser automation (mcp**playwright**\*), shell (Bash) para dev server + typecheck/lint/build, supabase MCP para sesión de prueba si aplica
  - Plan Approval: false
  - Hooks: none

- **validator**
  - Role: validación final por comandos + self-improve
  - Agent Type: `general-purpose`
  - Model: sonnet
  - Owns Files: none
  - Required Capabilities: all standard tools (Bash)
  - Plan Approval: false
  - Hooks: none

## Validation Hooks

### Available Validators

- `validate_new_file.py --directory <dir> --extension <ext>` (Stop)
- `validate_file_contains.py --directory <dir> --extension <ext> --contains '<string>'` (Stop)

### Custom Validators

None — existing validators cover this problem. (La fidelidad del port verbatim se valida con
la review de spec + el screenshot Playwright vs mockup; `build-agent` ya trae
`no_tailwind_in_prototype_port.py`. Se evitan validators nuevos por la fragilidad de hooks en este harness.)

### Hook Assignments

| Team Member          | Hook Type | Matcher | Validator                                                                                                          |
| -------------------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| css-builder          | Stop      | —       | `validate_new_file.py --directory apps/web/app/styles --extension css`                                             |
| patch-builder        | Stop      | —       | `validate_file_contains.py --directory apps/web/app/api/v1/briefs --extension ts --contains 'assertWantedEnabled'` |
| orchestrator-builder | Stop      | —       | `validate_new_file.py --directory apps/web/app/(shell)/wanted/new --extension tsx`                                 |

## Step by Step Tasks

### 1. CSS verbatim + import + scope de la regla

- **Task ID**: css-port
- **Depends On**: none
- **Assigned To**: css-builder
- **Agent Type**: build-agent
- **Parallel**: true
- **Owns Files**: `apps/web/app/styles/wanted.css`, `apps/web/app/layout.tsx`, `.claude/rules/prototype-port-exception.md`
- **Context**: Crear `apps/web/app/styles/wanted.css` copiando **verbatim** el CSS del Refiner de `new/mockups.html` líneas **404–698** (selectores `.refiner`, `.refiner-chat`, `.refiner-head`, `.refiner-bubble*`, `.refiner-approve*`, `.refiner-composer*`, `.send-btn`, `.brief-summary*`, `.brief-quality*`, `.brief-summary-section.is-editable/.is-editing/.is-edited-manually`, `.edit-pencil`, `.inline-edit-input`, `.inline-edit-actions`, `.btn-mini*`, `.chip-mini*`, `.chip-mini-remove`, `.add-chip`, `.brief-summary-select`, `.brief-summary-note`). NO traducir a Tailwind, NO renombrar clases. Los tokens (`--ax`, `--mono`, `--surface`, gradient) ya existen en `prototype-base.css` — solo consumirlos. Añadir `import './styles/wanted.css';` en `apps/web/app/layout.tsx` junto a los demás imports de CSS (líneas 10–15). En `.claude/rules/prototype-port-exception.md`, añadir a la lista de "Scope of exception" los paths nuevos: `apps/web/app/(shell)/wanted/**/*.tsx` y `apps/web/app/styles/wanted.css` (port verbatim del mockup `#refiner`).
- **Actions**:
  - Leer `new/mockups.html` 404–698 y copiar el CSS verbatim a `wanted.css`.
  - Añadir el import en `layout.tsx`; extender la regla.
  - `pnpm --filter web typecheck` (no debe romper nada).

### 2. Endpoint PATCH /content + setContentPath

- **Task ID**: patch-content
- **Depends On**: none
- **Assigned To**: patch-builder
- **Agent Type**: build-agent
- **Parallel**: true
- **Owns Files**: `apps/web/app/api/v1/briefs/[id]/content/route.ts`, `apps/web/lib/wanted/brief-state.ts`, `apps/web/lib/wanted/set-content-path.test.ts`
- **Context**: Añadir a `apps/web/lib/wanted/brief-state.ts` un helper PURO `setContentPath(content: BriefContent, path: string, value: unknown): BriefContent` — set inmutable por dot-path (`'title'`, `'problem.trigger'`, `'desiredOutcome.mustHaves'`, `'context.technicalLevel'`, `'constraints.budgetBand'`, `'preferredSolutionType'`, etc.); soporta 1–2 niveles; no muta el input. Validar el `path` contra una **whitelist** de paths de `BriefContent` (rechazar otros). Crear `apps/web/app/api/v1/briefs/[id]/content/route.ts` — `PATCH`, siguiendo el patrón de `apps/web/app/api/v1/briefs/route.ts` (runtime nodejs, dynamic, CORS, OPTIONS, `requireUser` con try/catch→401, `assertWantedEnabled(profile narrowed, process.env)`→404, `getBrief(session,id)`→404). Body `{ path: z.string(), value: z.unknown() }` (zod). Flujo: `newContent = setContentPath(brief.content, path, value)` → update `briefs` set `content=newContent`, `completeness_score=computeCompletenessScore(newContent)`, `manually_edited_fields` = union(existing, [path]) (usar el array existente del brief + push sin duplicar), cliente de **sesión**. 200 `{ briefId, manuallyEditedFields, completenessScore }`. Path inválido → 400 `invalid_path`. Rate-limit 200/h (clave `briefs:content:${id}`). RFC 7807. Crear `set-content-path.test.ts` (vitest, sin red): set de nivel 1 y 2, inmutabilidad, rechazo de path no-whitelisted.
- **Actions**:
  - `setContentPath` en brief-state.ts + whitelist.
  - route PATCH `/content`.
  - test del setter.
  - `pnpm --filter web typecheck` + `pnpm --filter web exec vitest run apps/web/lib/wanted/set-content-path.test.ts`.

### 3. Cliente SSE (streamRefine)

- **Task ID**: sse-client
- **Depends On**: none
- **Assigned To**: sse-client-builder
- **Agent Type**: build-agent
- **Parallel**: true
- **Owns Files**: `apps/web/app/(shell)/wanted/new/_lib/sse-client.ts`, `apps/web/app/(shell)/wanted/new/_lib/sse-client.test.ts`
- **Context**: Crear `streamRefine(briefId, userMessage, handlers, signal?)` que hace `fetch('/api/v1/briefs/'+briefId+'/refine', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({userMessage}), signal })`, lee `res.body!.getReader()`, decodifica con `TextDecoder`, **parsea frames SSE** (separados por `\n\n`; cada frame tiene líneas `event: <name>` y `data: <json>`), y despacha a `handlers`: `onToken({delta})`, `onStructuredUpdate({patch})`, `onCompleteness({score})`, `onDone({shouldStop, completeness, nextAction})`, `onError({type,message})`. Manejar buffer parcial entre chunks. Exportar tipos de los payloads (coinciden con los eventos que emite la ruta de 1a: `token`/`structured_update`/`completeness_score`/`done`/`error`). Test (`sse-client.test.ts`, vitest): construir un fake `Response` con un `ReadableStream` que emita frames SSE de prueba y assert que los handlers se llaman en orden con los payloads parseados. (Usar `new Response(new ReadableStream(...))` o un stub del reader; sin red.)
- **Actions**:
  - Implementar el parser SSE + `streamRefine`.
  - Test con stream fake.
  - `pnpm --filter web typecheck` + el test.

### 4. Componentes de chat (port verbatim)

- **Task ID**: chat-components
- **Depends On**: none
- **Assigned To**: chat-components-builder
- **Agent Type**: build-agent
- **Parallel**: true
- **Owns Files**: `apps/web/app/(shell)/wanted/new/_components/refiner-transcript.tsx`, `apps/web/app/(shell)/wanted/new/_components/refiner-composer.tsx`
- **Context**: Port **verbatim** del mockup `new/mockups.html` (HTML ~1342–1420). `refiner-transcript.tsx` (`'use client'` no necesario si es presentacional puro; recibe props): renderiza el header `.refiner-head` (`<h1>` con copy i18n `Wanted.head.title`, `.turn-counter` "turn N / 6") y la lista de burbujas `.refiner-bubble.is-agent`/`.is-user` (avatar `.refiner-bubble-avatar` — agente glyph `⬢`, user = inicial; contenido `.refiner-bubble-content`). Props: `turns: {role:'agent'|'user', content:string, streaming?:boolean}[]`, `turnCounter:{current:number,max:number}`. La burbuja agente en streaming muestra el texto acumulado. `refiner-composer.tsx` (`'use client'`): `.refiner-composer` > `.refiner-composer-wrap` con `<textarea>` autosize (rows 1, max 140px) + `.send-btn` (`→`), y `.refiner-composer-hint`. Props: `onSend(text)`, `disabled`. Enter envía, Shift+Enter newline, Esc opcional. Copy (placeholder, hint) vía `useTranslations('Wanted')` keys (`composer.placeholder`, `composer.hint`). **Clases CSS exactamente como el mockup**; nada de Tailwind; inline styles solo si el mockup los usa. NO importar CSS (las clases las provee `wanted.css`, tarea aparte). Usar `useTranslations` de `next-intl`.
- **Actions**:
  - Portar transcript + composer con clases verbatim.
  - `pnpm --filter web typecheck`.

### 5. Componentes del panel (port verbatim)

- **Task ID**: summary-components
- **Depends On**: none
- **Assigned To**: summary-components-builder
- **Agent Type**: build-agent
- **Parallel**: true
- **Owns Files**: `apps/web/app/(shell)/wanted/_components/brief-summary-panel.tsx`, `apps/web/app/(shell)/wanted/_components/editable-field.tsx`, `apps/web/app/(shell)/wanted/_components/removable-chip.tsx`
- **Context**: Port **verbatim** del mockup (HTML ~1423–1500+, CSS 517–698). `brief-summary-panel.tsx`: `<aside class="brief-summary">` sticky, `.brief-summary-head` con `<h3>` (i18n `Wanted.summary.title`) y `.brief-quality` (`.brief-quality-bar` > `.brief-quality-bar-fill` con `style={{width: pct+'%'}}`, y el número de completeness). `.brief-summary-body` con `.brief-summary-note` (i18n `Wanted.Brief.editHint`) y las secciones mapeadas desde un prop `draft: BriefContent` + `completeness:number` + `manuallyEditedFields:string[]`: title, trigger (`problem.trigger`), end state (`desiredOutcome.definitionOfGoodEnough`), must-haves (chips `desiredOutcome.mustHaves`), out of scope (`desiredOutcome.outOfScope`), technical level (select `context.technicalLevel`), solution preference (chips `preferredSolutionType`), budget·timeline. Cada sección de texto usa `<EditableField>`; las de array usan `<RemovableChip>` list + add; technicalLevel usa `<select class="brief-summary-select">`. Prop `onPatch(path, value)` se pasa hacia abajo. `editable-field.tsx` (`'use client'`): `.brief-summary-section.is-editable` ↔ `.is-editing`; muestra label + value (o `.empty` si vacío) + `.edit-pencil`; al click entra en edición (`<textarea class="inline-edit-input">` + `.inline-edit-actions` con `.btn-mini.btn-cancel`/`.btn-save`); on Save llama `onPatch(path, value)` y vuelve a vista; marca `.is-edited-manually` si `path ∈ manuallyEditedFields`. Props: `{ path, label, value, multiline?, manuallyEdited, onPatch }`. `removable-chip.tsx` (`'use client'`): `.chip-mini.is-removable` + `.chip-mini-remove` (`×`) y un `.chip-mini.add-chip` (`+ add`) que abre un input mínimo; on remove/add llama `onPatch(path, nextArray)`. Clases CSS verbatim; copy vía `useTranslations('Wanted')`. NO importar CSS.
- **Actions**:
  - Portar panel + editable-field + removable-chip con clases verbatim.
  - `pnpm --filter web typecheck`.

### 6. i18n namespace Wanted

- **Task ID**: i18n-wanted
- **Depends On**: none
- **Assigned To**: i18n-builder
- **Agent Type**: build-agent
- **Parallel**: true
- **Owns Files**: `apps/web/messages/en.json`, `apps/web/messages/es.json`
- **Context**: Añadir un namespace `"Wanted"` a `apps/web/messages/en.json` y `es.json` (insertar la key sin romper el JSON existente; respetar formato/orden). Keys (EN literal del mockup; ES **neutro**, nunca voseo): `head.title` ("Post a need" / "Publica una necesidad"), `composer.placeholder` ("Reply or ask the agent a question…"), `composer.hint` ("Enter to send · Shift+Enter for newline · Esc to stop streaming"), `summary.title` ("Brief summary" / "Resumen del brief"), `Brief.editHint` ("Click any field to edit. Changes auto-save and the agent will respect them on next turns."), labels: `labels.title`, `labels.trigger`, `labels.endState`, `labels.mustHaves`, `labels.outOfScope`, `labels.technicalLevel`, `labels.solutionPreference`, `labels.budgetTimeline`; `approve.ready` ("Looks good. Quality at {score} with your edits."), `approve.keepTalking` ("Keep talking"), `approve.cta` ("Approve & match →"), `approve.editsTag` ("✎ {n} edits"), `approve.autosaved` ("All edits auto-saved · agent will respect them"), `empty.outOfScope` ("— click to add what wouldn't solve this —"), `addChip` ("+ add"), `approved.title` ("Matching started"), `approved.body` ("We're finding matches for your brief."), `technicalLevel.nonTechnical/semiTechnical/developer`. Validar que ambos JSON parsean.
- **Actions**:
  - Añadir el namespace `Wanted` a en.json y es.json.
  - Verificar parseo JSON de ambos.

### 7. Orquestador + página (gate)

- **Task ID**: orchestrator-page
- **Depends On**: patch-content, sse-client, chat-components, summary-components, i18n-wanted
- **Assigned To**: orchestrator-builder
- **Agent Type**: build-agent
- **Parallel**: false
- **Owns Files**: `apps/web/app/(shell)/wanted/new/page.tsx`, `apps/web/app/(shell)/wanted/new/refiner-client.tsx`
- **Context**: `page.tsx` (server component, hereda el shell de `(shell)/layout.tsx` — NO renderizar shell): `const result = await getUser();` si `!result` → `redirect('/sign-in')` (patrón existente). `if (!isWantedEnabled(result.profile, process.env)) notFound();` (de `@hatch/shared` y `next/navigation`). Render `<RefinerClient />`. `refiner-client.tsx` (`'use client'`): estado `briefId|null`, `turns: {role,content,streaming?}[]`, `draft: BriefContent` (inicial `{}` parseado con defaults), `completeness:number`, `manuallyEditedFields:string[]`, `phase:'idle'|'streaming'|'ready'|'approved'`, `turnCount`. Render: `<div className="refiner">` con `<div className="refiner-chat">` (`<RefinerTranscript turns turnCounter />`, el callout `.refiner-approve` cuando `phase==='ready'` — variante `.has-edits` si hay edits — con botones "Keep talking"/"Approve & match", y `<RefinerComposer onSend disabled={phase==='streaming'} />`) y `<BriefSummaryPanel draft completeness manuallyEditedFields onPatch={handlePatch} />`. Lógica:
  - `handleSend(text)`: push burbuja user; si `!briefId` → `POST /api/v1/briefs {mode:'chat'}` → set briefId; luego `streamRefine(briefId, text, handlers)` (de `_lib/sse-client`): onToken → append/extender la burbuja agente en streaming; onStructuredUpdate → `draft = applyDraftPatch(draft, patch)` (importar de `@/lib/wanted/brief-state`); onCompleteness → set completeness; onDone → si `shouldStop` set `phase='ready'`, si no `phase='idle'`.
  - `handlePatch(path, value)`: `PATCH /api/v1/briefs/${briefId}/content {path,value}` → respuesta actualiza `manuallyEditedFields` + `completeness`; aplicar `value` en `draft` localmente (optimista) con `setContentPath` o merge.
  - `handleApprove()`: `POST /api/v1/briefs/${briefId}/approve` → `phase='approved'`; render estado de confirmación (`Wanted.approved.title/body`). (No navegar a matches — no existe.)
  - Usar `useTranslations('Wanted')`. Manejar errores SSE (`onError`) mostrando un aviso no bloqueante. Clases CSS verbatim del mockup (`.refiner`, `.refiner-approve*`, etc.).
- **Actions**:
  - Implementar page (gate) + refiner-client (estado + flujo + cableado de componentes/SSE/endpoints).
  - `pnpm --filter web typecheck` + `pnpm --filter web lint`.

### 8. Validación Playwright (UI)

- **Task ID**: playwright-validate
- **Depends On**: css-port, orchestrator-page
- **Assigned To**: ui-validator
- **Agent Type**: ui-validator
- **Parallel**: false
- **Owns Files**: none
- **Context**: Validar visualmente `/wanted/new` contra el mockup `#refiner`. Arrancar el dev server con el flag ON y el header grande (evita el 431 conocido): `WANTED_V1_ENABLED=true NODE_OPTIONS='--max-http-header-size=131072' pnpm --filter web dev` (puerto 3000). Navegar a `http://localhost:3000/wanted/new`. La ruta vive bajo `(shell)` → requiere sesión: si redirige a `/sign-in`, intentar iniciar sesión con credenciales de prueba si están en env (`TEST_USER_EMAIL`/`TEST_USER_PASSWORD`); si no hay credenciales, **documentar la limitación** (screenshot del sign-in) y continuar con la validación por comandos — no es bloqueante. Con sesión: screenshot del split-pane; comparar a nivel de sección con el mockup (`new/mockups.html` `#refiner`, abrir en el browser como referencia): header "Post a need" + turn counter, panel derecho "Brief summary" con barra de calidad, composer abajo. Enviar un mensaje en el composer y verificar que aparece la burbuja user y (si hay `ANTHROPIC_API_KEY`) la respuesta del agente en streaming + el panel actualizándose. Reportar con screenshots y diffs a nivel sección. Si el agente no puede correr (sin API key), validar al menos el render estático del split-pane vacío.
- **Actions**:
  - Arrancar dev server (flag on, NODE_OPTIONS), navegar, screenshot.
  - Comparar secciones vs mockup; enviar un mensaje; capturar resultado.
  - Reportar pass/fail + limitaciones (auth/API key).

### 9. Validación final (comandos)

- **Task ID**: validate-all
- **Depends On**: css-port, patch-content, sse-client, chat-components, summary-components, i18n-wanted, orchestrator-page
- **Assigned To**: validator
- **Agent Type**: general-purpose
- **Parallel**: false
- **Context**: Correr los Validation Commands; verificar acceptance criteria; reportar pass/fail con salida real.
- **Actions**:
  - `pnpm typecheck`, `pnpm lint`, `pnpm --filter web exec vitest run`, `pnpm build`.
  - Verificar acceptance criteria.

### 10. Self-improve experto nextjs

- **Task ID**: expert-self-improve
- **Depends On**: validate-all
- **Assigned To**: validator
- **Agent Type**: general-purpose
- **Parallel**: false
- **Context**: El dominio nextjs ganó patrones: páginas `(shell)/wanted/`, consumo SSE en cliente (`fetch`+reader), `wanted.css`, componentes ported wanted, gate con `notFound()`. Actualizar `.claude/commands/experts/nextjs/expertise.yaml` (surgical, YAML válido).
- **Actions**:
  - Actualizar la expertise de nextjs con los patrones nuevos.

## Testing Strategy

### Unit Tests

- `setContentPath`: set nivel 1/2, inmutabilidad, rechazo de path no-whitelisted.
- `sse-client`: parser de frames SSE (handlers en orden, payloads correctos, buffer parcial).

### Edge Cases

- Flag off → `/wanted/new` da 404 (notFound).
- Sin sesión → redirect a /sign-in.
- Primer mensaje crea el brief; mensajes siguientes reusan briefId.
- Editar un campo marca `✎ edited` y recomputa completeness.
- `done.shouldStop` muestra el callout; approve → confirmación.
- Error SSE → aviso no bloqueante, draft preservado.

## Acceptance Criteria

- `/wanted/new` renderiza el split-pane idéntico al mockup `#refiner` (clases/estructura verbatim, sin Tailwind); flag off → 404; sin sesión → /sign-in.
- Enviar un mensaje crea el brief, streamea la respuesta token-a-token y actualiza el brief summary + barra de completeness en vivo.
- Editar un campo del panel hace autosave (`PATCH /content`), lo marca `✎ edited` y recomputa completeness.
- `mark_ready` (completeness ≥ 0.5) muestra el callout approve; "Approve & match" llama `/approve` y muestra confirmación.
- `pnpm typecheck`, `pnpm lint`, `pnpm --filter web exec vitest run`, `pnpm build` verdes.
- Screenshot Playwright validado vs mockup (o limitación de auth/API documentada).
- Todo inerte tras el flag.

## Validation Commands

- `pnpm typecheck` — TS en todos los workspaces.
- `pnpm lint` — ESLint en todos los workspaces.
- `pnpm --filter web exec vitest run` — unit tests (incl. setContentPath + sse-client).
- `pnpm build` — build de producción; valida que `/wanted/new` y `PATCH /content` compilan.
- UI: `WANTED_V1_ENABLED=true NODE_OPTIONS='--max-http-header-size=131072' pnpm --filter web dev` + Playwright a `http://localhost:3000/wanted/new`.

## Notes

- **Sin dependencias nuevas.** SSE en cliente con `fetch`+`ReadableStream` (nativo). `@anthropic-ai/sdk` ya instalado (1a).
- **Backend nuevo:** solo `PATCH /briefs/:id/content` + `setContentPath` (Δ2 del README). create/refine/approve ya existen (1a).
- **Port verbatim:** CSS classes + inline styles del mockup, sin Tailwind (regla prototype-port, extendida a los paths wanted). Copy a i18n (como los ports previos).
- **Español neutro** en es.json (tú/quieres), nunca voseo.
- **Fuera:** UI-tools declarativas `.rui-*` (1.5), mode picker/Form/Paste/Validator (1.5), página de matches (Fase 2). El `approve` muestra confirmación in-page, no navega.
- **Playwright/auth:** `(shell)` exige sesión; la validación visual puede quedar limitada sin credenciales de prueba — no bloquea el cierre (build/typecheck/lint/vitest son el gate duro).
- Ignorar reglas stale: `frontend-store.md`, `frontend-components.md`, `database-migrations.md` (artefactos de la librería fuente, no aplican a hatch).
