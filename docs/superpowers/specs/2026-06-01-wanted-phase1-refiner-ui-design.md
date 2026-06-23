# Diseño — Wanted Fase 1 (cierre): UI del Refiner + autosave

**Fecha:** 2026-06-01
**Estado:** aprobado (brainstorm/port) → listo para `/tac:feature`
**Rama:** `feature/wanted-v1`
**Predecesor:** Slice 1a (agente Refiner + endpoints create/refine-SSE/approve) — implementada, validada (typecheck/lint/build/tests verdes), sin commitear.
**Fuente visual (SPEC, port verbatim):** `new/mockups.html` `#refiner` (CSS líneas 404–698, HTML 1341–1500+) + `new/README 2.md` "Component index".

## Propósito

Cerrar la **Fase 1** construyendo la página del Refiner end-to-end: la conversación
`/wanted/new` donde el seeker articula su problema en chat, ve el **brief summary**
actualizarse en vivo, **edita campos inline** (autosave), y **aprueba** para pasar a
matching. Es un **port byte-a-byte** del mockup `#refiner` (regla
`.claude/rules/prototype-port-exception.md`: CSS classes + inline styles verbatim,
sin traducir a Tailwind) cableado a los endpoints REST de 1a + un endpoint nuevo
`PATCH /content` para el autosave.

## Alcance

**Dentro (cierre Fase 1):**

- Página `/wanted/new` (route group `(shell)`), gated por `isWantedEnabled` (`notFound()` si off).
- Componentes ported verbatim: transcript de chat (burbujas agent/user), composer, callout de approve, **brief summary panel** con campos editables (`EditableField`), chips removibles (`RemovableChip`), selects.
- CSS nuevo `apps/web/app/styles/wanted.css` (nombre semántico — NO `prototype-wanted.css`, por la regla de filenames; contiene `.refiner-*`, `.brief-summary-*`, `.chip-mini*`, `.inline-edit-*`, `.refiner-approve*` verbatim del mockup).
- Cliente que orquesta el flujo: crear brief → refine (consumo **SSE** con `fetch`+reader, render incremental de tokens) → summary live (de `structured_update`/`completeness_score`) → approve.
- **Endpoint nuevo `PATCH /api/v1/briefs/:id/content` `{ path, value }`** (Δ2): edición por-campo, marca `manually_edited_fields`, recomputa `completeness_score`. Habilita el autosave del panel.
- i18n: copy del panel/callout vía next-intl (namespace `Wanted`), incluyendo `Wanted.Brief.editHint`.

**Fuera (fases posteriores, NO en este cierre):**

- Las 6 UI-tools declarativas (`refiner-bubble-component` / `.rui-*`) y el ciclo `ui_call`/`ui_response` → **Fase 1.5** (en el mockup salen como estados "frozen"; los renderizamos solo si llegan, pero el agente de 1a no los emite).
- Mode picker (Chat/Form/Paste), Form, Paste, Validator, Brief Health Card → 1.5.
- Match deck / página de matches (el `approve` redirige a un estado de confirmación; la página `/wanted/[id]/matches` es Fase 2/3).

## Decisiones

| #   | Decisión                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Port **verbatim** del mockup `#refiner` (CSS + JSX + glyphs), sin Tailwind, regla prototype-port. CSS en `apps/web/app/styles/wanted.css`.                                                                                                        |
| 2   | SSE se consume con `fetch(POST)` + `ReadableStream` reader + parser de frames `event:/data:` (EventSource no sirve: es POST).                                                                                                                     |
| 3   | Crear el brief en el **primer mensaje del seeker** (`POST /briefs {mode:'chat'}` → `POST /briefs/:id/refine {userMessage}`); turnos siguientes solo `refine`. La primera burbuja del agente llega del primer `refine`.                            |
| 4   | Panel editable con **autosave on blur** vía `PATCH /content`; sin botón "Save edits" global (el inline-edit textarea sí tiene Save/Cancel locales como el mockup). Campos marcados `is-edited-manually` cuando están en `manually_edited_fields`. |
| 5   | El callout `refiner-approve` aparece cuando `done.shouldStop === true` (completeness ≥ 0.5 y el agente llamó `mark_ready`); variante `.has-edits` si hay `manually_edited_fields`.                                                                |
| 6   | `approve` → `POST /approve`; al éxito, estado de confirmación in-page ("Matching iniciado") — la página de matches no existe aún (Fase 2/3).                                                                                                      |
| 7   | Gating: `page.tsx` (server) hace `notFound()` si `!isWantedEnabled(profile, env)`.                                                                                                                                                                |

## Arquitectura y archivos

### Backend (1 endpoint nuevo)

- **`apps/web/app/api/v1/briefs/[id]/content/route.ts`** (nuevo) — `PATCH`. Body `{ path: string, value: unknown }`. Auth (`requireUser`) + `assertWantedEnabled` + `getBrief` (RLS) → 404. Aplica `value` en `briefs.content` por `path` (e.g. `problem.trigger`, `desiredOutcome.mustHaves`, `context.technicalLevel`) usando un setter de path inmutable; añade `path` a `manually_edited_fields` (sin duplicar); recomputa `completeness_score` (reusa `computeAndPersistContent` o un update directo con array_append). Cliente de **sesión** (RLS author all). 200 `{ briefId, manuallyEditedFields, completenessScore }`. Rate-limit 200/h. RFC 7807.
  - Helper nuevo en `apps/web/lib/wanted/brief-state.ts`: `setContentPath(content, path, value)` (pure, inmutable, dot-path).

### Frontend (port + wiring)

Estructura siguiendo `new/README 2.md` "Component index":

- **`apps/web/app/(shell)/wanted/new/page.tsx`** (server) — gate del flag (`getUser` → `isWantedEnabled` → `notFound()`), renderiza `<RefinerClient />`. (Si no hay sesión, redirige a sign-in como las demás (shell).)
- **`apps/web/app/(shell)/wanted/new/refiner-client.tsx`** (`'use client'`) — orquestador: estado de `briefId`, transcript (array de `{role, content, streaming?}`), `draft` (BriefContent), `completeness`, `phase` (idle/streaming/ready/approved). Maneja: enviar mensaje → (crear brief si no existe) → refine SSE; parsear eventos; render del approve callout; approve. Incluye inline `RefinerApprove`.
- **`apps/web/app/(shell)/wanted/new/_components/refiner-transcript.tsx`** — burbujas (`.refiner-bubble.is-agent/.is-user`, avatar `⬢` agente / inicial user, contenido). Render del token-streaming en la última burbuja agente.
- **`apps/web/app/(shell)/wanted/new/_components/refiner-composer.tsx`** — `.refiner-composer-wrap` + textarea autosize + `.send-btn` (`→`), hint (`Enter to send · Shift+Enter…`). Enter envía; Shift+Enter newline.
- **`apps/web/app/(shell)/wanted/_components/brief-summary-panel.tsx`** — `.brief-summary` sticky: head con `.brief-quality-bar` (fill width = completeness%), nota `editHint`, y las secciones (title, trigger, end state, must-haves, out of scope, technical level, solution preference, budget·timeline) mapeadas desde `draft`. Cada sección usa `EditableField`/`RemovableChip`/select.
- **`apps/web/app/(shell)/wanted/_components/editable-field.tsx`** (`'use client'`) — `.brief-summary-section.is-editable` ↔ `.is-editing` (textarea `.inline-edit-input` + `.inline-edit-actions` Save/Cancel `.btn-mini`), pencil, marca `.is-edited-manually`. On Save → callback `onPatch(path, value)` (→ PATCH /content).
- **`apps/web/app/(shell)/wanted/_components/removable-chip.tsx`** — `.chip-mini.is-removable` + `.chip-mini-remove` (`×`) + `.chip-mini.add-chip` (`+ add`). On remove/add → `onPatch(path, nextArray)`.
- **`apps/web/app/styles/wanted.css`** — CSS verbatim del mockup (404–698): `.refiner`, `.refiner-chat/head/bubble*`, `.refiner-approve*`, `.refiner-composer*`, `.send-btn`, `.brief-summary*`, `.brief-quality*`, `.chip-mini*`, `.inline-edit-*`, `.btn-mini*`, `.edit-pencil`. Importado en `apps/web/app/(shell)/wanted/layout.tsx` (o root layout junto a los otros styles).
- **Cliente SSE helper** `apps/web/app/(shell)/wanted/new/_lib/sse-client.ts` — `streamRefine(briefId, userMessage, handlers)`: `fetch(POST)`, lee el body como stream, parsea frames SSE, despacha `onToken/onStructuredUpdate/onCompleteness/onDone/onError`.

### Tokens / reuso

- Tokens (`--ax`, `--mono`, gradient del logo, etc.) ya viven en `apps/web/app/styles/prototype-base.css` `:root` — `wanted.css` solo los consume.
- Shell/topbar/sidebar reusados (`apps/web/app/_components/shell.tsx`); añadir item "Post a need" / "Wanted" al sidebar (opcional, mínimo).

## Flujo cliente (resumen)

```
load /wanted/new → page (server) gate flag → RefinerClient
seeker escribe 1er mensaje → POST /briefs {mode:'chat'} → briefId
  → streamRefine(briefId, msg):
       onToken → append a burbuja agente (streaming)
       onStructuredUpdate → applyDraftPatch(draft) local → re-render panel
       onCompleteness → barra de calidad
       onDone(shouldStop) → si true, mostrar refiner-approve
seeker edita campo en panel → onPatch → PATCH /content → update manuallyEditedFields + completeness
seeker manda otro mensaje → streamRefine(briefId, msg) (sin recrear brief)
Approve & match → POST /approve → estado "Matching iniciado"
```

## Validación (UI)

- **Playwright MCP**: arrancar dev server (con `NODE_OPTIONS=--max-http-header-size` por el 431 conocido), navegar a `/wanted/new` con el flag ON (env o profile canary), screenshot del split-pane, enviar un mensaje, ver burbuja + panel actualizándose, comparar contra el mockup `#refiner` a nivel de sección.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` sin errores.

## Acceptance Criteria

- `/wanted/new` renderiza el split-pane idéntico al mockup `#refiner` (clases/estructura verbatim); flag off → 404.
- Enviar un mensaje crea el brief, streamea la respuesta del agente token-a-token, y actualiza el brief summary + barra de completeness en vivo.
- Editar un campo del panel hace autosave (`PATCH /content`), lo marca `✎ edited`, y recomputa completeness.
- Cuando el agente llama `mark_ready` (completeness ≥ 0.5), aparece el callout approve; "Approve & match" llama `/approve` y muestra confirmación.
- typecheck/lint/build verdes; screenshot Playwright validado contra el mockup.
- Todo inerte tras el flag.

## Notas

- `PATCH /content` es backend nuevo (Δ2) necesario para el autosave del panel; los demás endpoints ya existen (1a).
- Las UI-tools declarativas (`.rui-*`) quedan fuera; si el stream trae un `ui_call` (no lo hace en 1a) se ignora con un fallback de texto.
- Nombre del CSS: `wanted.css` (semántico), no `prototype-wanted.css` — desviación consciente del README por la regla de filenames del usuario.
- El `approve` no navega a matches (no existe aún); muestra confirmación in-page.
