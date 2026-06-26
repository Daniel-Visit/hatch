# Diseño — Wanted Fase 3 (lado builder + detalle de brief)

**Fecha:** 2026-06-04
**Estado:** aprobado (brainstorm) → listo para `/tac:feature`
**Rama:** `feature/wanted-v1`
**Predecesor:** `docs/superpowers/specs/2026-06-01-wanted-adaptation-design.md` (§4 mapa de fases)

## Propósito

Cerrar el loop **seeker ↔ builder**. Hoy un seeker crea un brief, lo refina y el
Matcher genera matches, pero **el lado builder no existe**: un builder no puede
activarse ni fijar capacidad/dominios, así que el Matcher Phase B nunca devuelve
builders (`profiles.accepts_requests` arranca en `false`), y no hay bandeja para
ver/responder matches entrantes. Esta fase construye ese lado más la página de
detalle del brief.

## Estado de partida (verificado contra el código, 2026-06-04)

- **Fases 0, 1, 1.5, 2 implementadas** (1.5+2 sin commitear). Flujo seeker
  verificado end-to-end en runtime: crear → refinar (Anthropic real) → loop
  `ui_call`/`ui_response` → panel de resumen en vivo.
- **Migración 0039 aplicada** — arregla la recursión infinita en las policies RLS
  `briefs ↔ matches` que tiraba 500 en todo create. Las policies "matched builder
  read" / "matches brief author read" ahora usan funciones `SECURITY DEFINER`
  (`is_matched_builder`, `is_brief_author`) y **no recursan**.
- **Modelo de datos del builder YA existe** (migración 0034):
  `profiles.accepts_requests bool`, `request_capacity int`, `request_domains text[]`,
  `request_rate_band budget_band`, `inferred_capabilities text[]`,
  `last_brief_response_at timestamptz`.
- **Rutas de acción de match YA existen**: `POST /api/v1/matches/[id]/respond`
  (CONNECT → abre thread vía `find_or_create_conversation` + notifica ambos lados;
  SKIP → graba `candidate_feedback`/`candidate_feedback_note`, columnas 0034/0036)
  y `POST /api/v1/matches/[id]/swipe`.

## Decisiones de esta fase (cerradas con el usuario)

- **D-3.1 — Bandeja del builder = ruta dedicada `/(shell)/requests`.** hatch no
  tiene `/inbox`; tiene `/messages` y `/notifications`. Se crea una superficie
  propia "Solicitudes / Requests" (más fiel al mockup `#inbox`, mantiene un inbox
  accionable separado de los mensajes efímeros). No es una pestaña de `/messages`.
- **D-3.2 — Detalle de brief = privado (autor + builder emparejado).** La vista
  pública de galería (briefs `PUBLIC`/`PUBLIC_GALLERY`, listado `/wanted`, cron de
  fallback) se difiere a **Fase 4**, como en el mapa original.
- **D-3.3 — Persistencia de preferencias = server action**, consistente con los
  settings existentes (`lib/actions/profile.ts`, `lib/actions/theme.ts`). El
  endpoint REST `PATCH /users/me/request-preferences` (paridad MCP) se difiere a
  **Fase 4** junto con el resto de las MCP tools.

## Alcance

**DENTRO (3 piezas):**

1. `/(shell)/settings/requests` — preferencias de request del builder (task-14).
2. `/(shell)/requests` — bandeja del builder de matches entrantes (task-15).
3. `/(shell)/wanted/[id]` — página de detalle del brief, privada (task-17).

**FUERA (explícito):**

- task-16 (match-deck del seeker / swipe UI) — **ya construido**
  (`/(shell)/wanted/[id]/matches/`, `match-card.tsx`, `match-deck.tsx`, rutas
  swipe/respond). No se reconstruye.
- Vista pública del brief + listado de galería + cron fallback → **Fase 4**.
- Endpoint REST + MCP tools de preferencias/inbox → **Fase 4**.
- Auto-inferencia de `inferred_capabilities` desde las apps del builder → diferida
  (en esta fase se editan manualmente).
- Indicador de "pensando" en el composer del refiner (typing indicator) →
  backlog de pulido, fuera de Fase 3.
- Embeddings semánticos → diferidos (decisión D1 del doc predecesor).

**Sin migraciones nuevas.** Todo el modelo de datos necesario está en 0034; la RLS
quedó sana tras 0039.

---

## Pieza 1 — `/(shell)/settings/requests` (preferencias del builder)

**Inputs spec:** `new/04-ui-and-flows.md` §4.2, §4.4; `new/06-implementation-plan.md`
task-14; mockup `#settings` (sección de requests).

**Rutas/archivos:**

- `apps/web/app/(shell)/settings/requests/page.tsx` — server component: gate del
  flag (404 si off, mismo patrón que `wanted/new/page.tsx`), `requireUser()`,
  fetch del profile, pasa los campos al form.
- `apps/web/app/(shell)/settings/requests/requests-form.tsx` — client (`'use client'`,
  RHF + Zod), espejando `settings/profile/profile-form.tsx`.
- `apps/web/lib/actions/request-preferences.ts` — server action
  `updateRequestPreferences(input)`: valida con Zod, escribe el profile con el
  **session client** (RLS: el user edita su propia fila), `revalidatePath`.

**Campos (todos en 0034):**

- `accepts_requests` — toggle on/off (master switch del builder).
- `request_capacity` — int, 0–20 (default 3); 0 ⇒ pausado aunque `accepts_requests`.
- `request_domains` — `text[]`, editor de chips (añadir/quitar).
- `request_rate_band` — select del enum `budget_band` (nullable).
- `inferred_capabilities` — `text[]`, editor de chips editable (manual por ahora).

**Validación (Zod, en `request-preferences.ts`):** capacity entero 0–20; arrays de
strings no vacíos, ≤ 32 ítems, cada uno ≤ 64 chars; `request_rate_band` ∈ enum o null.

**RLS:** usa la policy de update de `profiles` ya existente (autor). Sin cambios.

**Prototype-port:** si el mockup `#settings` cubre esta pantalla, port verbatim de
clases/markup; si no, CSS propio en `wanted.css` (como mode-picker/form/paste).

---

## Pieza 2 — `/(shell)/requests` (bandeja del builder)

**Inputs spec:** `new/04-ui-and-flows.md` §4.4.3; task-15; mockup `#inbox`.

**Rutas/archivos:**

- `apps/web/app/(shell)/requests/page.tsx` — server component: gate del flag,
  `requireUser()`, lista matches entrantes del builder + brief asociado.
- `apps/web/app/(shell)/requests/_components/request-card.tsx` — card por match
  (port de `#inbox`): resumen del brief, confianza/rationale del agente, botones
  **CONNECT / SKIP**, y en SKIP un selector de motivo opcional (`match_feedback`:
  not_my_area / no_capacity / budget_mismatch / other) + nota.
- `apps/web/app/(shell)/requests/_components/requests-client.tsx` — client que
  dispara `POST /api/v1/matches/[id]/respond` con optimistic update y quita la card.
- `apps/web/lib/wanted/match-repo.ts` — añadir `listBuilderRequests(client, builderId)`:
  matches con `candidate_builder_id = builderId`, `candidate_type='BUILDER'`,
  `candidate_action='PENDING'`, ordenados por `agent_confidence desc`, con join al
  brief (título + problem statement). Lectura con **session client** (RLS
  "matches candidate builder read own" + "briefs matched builder read", ambas ya
  no recursivas).

**UX:** indicador de capacidad (`request_capacity` vs matches activos), empty state
("no tienes solicitudes pendientes"), gate adicional: si `accepts_requests=false`,
mostrar CTA hacia `/settings/requests`.

**Reuso:** la lógica de CONNECT (abrir thread + notificar) y SKIP (grabar feedback)
ya vive en `respond/route.ts`. Esta pieza solo consume esa ruta.

---

## Pieza 3 — `/(shell)/wanted/[id]` (detalle del brief, privado)

**Inputs spec:** `new/04-ui-and-flows.md` §4.1; `new/02-apis.md` GET /briefs/:id;
task-17; Story I (matriz de visibilidad).

**Rutas/archivos:**

- `apps/web/app/(shell)/wanted/[id]/page.tsx` — server component: gate del flag,
  `getBrief(session, id)` (RLS resuelve visibilidad: autor ve todo; builder
  emparejado ve el brief; público → null por ahora → 404). Renderiza secciones del
  `BriefContent` + estado + metadatos.
- Vistas según rol:
  - **Autor:** detalle completo + enlaces a `/wanted/[id]/health` y
    `/wanted/[id]/matches` (ya existen) + estado del lifecycle.
  - **Builder emparejado:** detalle del brief (sin PII del seeker más allá de lo
    que el match expone), CTA a la card de su match en `/requests`.
- Reusa `brief-summary-panel.tsx` / componentes de secciones donde aplique.

**Matriz de visibilidad (Story I, subconjunto privado):**
| Rol | Ve el brief |
|-----|-------------|
| Autor | Sí (completo) |
| Builder con match al brief | Sí (vía policy "briefs matched builder read") |
| Otro usuario autenticado | No → 404 |
| Anónimo / público | No → 404 _(la vista PUBLIC entra en Fase 4)_ |

**Nota:** consolida la base `/(shell)/wanted/[id]` que hoy falta (solo existen los
subroutes `/health` y `/matches`).

---

## Transversal

- **Nav:** añadir entrada **"Solicitudes" / "Requests"** en el shell (junto a
  Mensajes/Notificaciones), visible solo cuando el flag está on para el usuario.
- **Feature flag:** las 3 superficies detrás de `wanted_v1_enabled` (gate de
  layout/route igual que las rutas wanted existentes; 404 si off).
- **i18n (EN + ES):** toda string vía `next-intl`; añadir claves a
  `apps/web/messages/en.json` y `es.json`. La app es **multilenguaje**: verificar
  ambos idiomas. (El Refiner ya responde en el idioma del seeker; el echo de
  selección usa `locale_pref` — ver helper `synthesizeUserMessage`.)
- **Prototype-port:** donde el mockup (`mockups.html` #inbox/#settings) tenga la
  pantalla, port byte-a-byte (clases + inline styles verbatim, sin Tailwind, regla
  `prototype-port-exception.md`). Lo no cubierto por el mockup se autora con CSS
  propio en `wanted.css`.

## Tests (vitest)

- `updateRequestPreferences` — validación (capacity fuera de rango, arrays
  inválidos, enum inválido) + escritura ok.
- `listBuilderRequests` — filtra por builder + pending + tipo BUILDER; ordena por
  confianza; join al brief.
- Visibilidad del detalle: autor ve; no-emparejado → no.
- Gate del flag en las 3 rutas (off → 404).

## Definition of Done — Fase 3

- Un builder puede activarse en `/settings/requests`, fijar capacidad/dominios/
  capacidades; persisten (server action, RLS propia).
- Con un builder activo y dominios compatibles, el Matcher Phase B lo incluye y su
  match aparece en `/requests`; CONNECT abre thread + notifica; SKIP graba feedback.
- `/wanted/[id]` muestra el detalle al autor y al builder emparejado; 404 a terceros.
- Nav con "Solicitudes", todo gateado por el flag, EN + ES, gates verdes
  (typecheck/lint/vitest/build).
- Sin migraciones nuevas. Inerte tras el flag.

## Método de ejecución

brainstorm (este doc) → `/tac:feature` sobre este spec → `/tac:implement` →
`/tac:review`. Los comandos los corre el usuario.
