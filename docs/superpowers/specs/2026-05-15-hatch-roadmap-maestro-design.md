# Hatch — Roadmap Maestro (Phases 1-13)

> Diseño post-Phase 0. Cubre cómo distribuir, secuenciar y ejecutar las 12 fases restantes hasta v1, con dos cirugías al SPEC original: corte de email y rediseño de notificaciones con browser push.

Last updated: 2026-05-15
Status: aprobado, pasa a `writing-plans` para sacar `epic.md`.
Repo: https://github.com/Daniel-Visit/Hatch (push real-time).

---

## 1. Contexto

Phase 0 está hecho (12 commits en `main`, monorepo local funcional). Quedan **Phases 1-12 + Phase 13 polish** del SPEC §16. Total estimado: ~14.5 días serial + Phase 13 variable.

### Decisiones macro tomadas en este brainstorm

| Decisión                  | Detalle                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alcance**               | Construir TODAS las fases del SPEC (no MVP recortado).                                                                                       |
| **Email eliminado**       | Phase 8 (Resend + React Email) **CUT**. Todo notificación pasa a in-platform.                                                                |
| **Browser push agregado** | Web Push API (opt-in, VAPID keys, sin servicios de terceros) en Phase 6 para suplir el "ping cuando estás afuera" que hacía email.           |
| **Modelo de ejecución**   | ADW híbrido: fases críticas (1, 9) manuales con `/adw:adw_plan_build_test_review`; el resto agrupado por bloques en `/adw:adw_epic`.         |
| **Sin Docker**            | Phase 1 usa Supabase cloud directo (no `supabase start`); migraciones via `supabase db push`. Phase 9 usa Railway Nixpacks (sin Dockerfile). |
| **OAuth only**            | Sin password/magic-link, ya estaba en spec.                                                                                                  |

---

## 2. Grafo de dependencias

```
Phase 0 ✓
   │
   ├─→ Phase 1 (auth + schema base) ──┐
   │                                  │
   └─→ Phase 2 (design system) ───────┤
                                      ▼
                            Phase 3 (read path: list/detail/profile)
                                      │
                          ┌───────────┼───────────┐
                          ▼           ▼           ▼
                    Phase 4       Phase 5     Phase 11
                  (social)       (publish)    (search)
                          │           │
                          └─────┬─────┘
                                ▼
                          Phase 6 (contact + notif bell + push)
                                │
                                ▼
                          Phase 7 (messages inbox)
                                │
                                ▼
                          Phase 9 (MCP server)
                                │
                                ▼
                          Phase 10 (ranking + cron)
                                │
                                ▼
                          Phase 12 (public API + llms.txt)
                                │
                                ▼
                          Phase 13 (polish — slice through)
```

> Phase 8 (Email) eliminada. Bloque de notificaciones se mueve íntegro a Phase 6 con push agregado.

---

## 3. Critical path

### Tabla maestra

| #     | Phase                                     | Days     | Bloqueado por        | Bloquea     | Notas                                                                         |
| ----- | ----------------------------------------- | -------- | -------------------- | ----------- | ----------------------------------------------------------------------------- |
| 1     | Auth + base schema                        | 1        | Supabase cloud listo | 3           | Profiles + categories. Sin Docker → cloud directo.                            |
| 2     | Design system + shell                     | 2        | —                    | UI de 3+    | Tokens del prototipo, Geist, Shell, ThemeToggle, AppArt, AppCard.             |
| 3     | Apps read path                            | 1        | 1, 2                 | 4, 5, 6, 11 | Migración `apps`, list/detail/profile pages, seed 12 demos.                   |
| 4     | Social                                    | 2        | 3                    | 6, 10       | Likes, saves, follows, comments + counters + RLS.                             |
| 5     | Publish                                   | 1        | 3                    | 6, 9        | Storage buckets, RLS, signed uploads, form RHF + Zod.                         |
| 6     | **Contact + notifications + bell + push** | **3**    | 4, 5                 | 7, 9        | +1 día vs spec por Web Push (ver §5).                                         |
| 7     | Messages / Inbox                          | 2        | 6                    | 9           | Slack-style 2-pane, realtime sub por thread.                                  |
| ~~8~~ | ~~Email~~                                 | —        | —                    | —           | **CUT.** Notificaciones in-platform + push.                                   |
| 9     | MCP server (Railway)                      | 2        | 5, 7                 | 12          | Streamable HTTP transport, API keys, tools/resources/prompts. Nixpacks build. |
| 10    | Ranking + cron                            | 0.5      | 4                    | 12          | `compute_hot_score`, Vercel Cron, FeaturedHero.                               |
| 11    | Search                                    | 0.5      | 3                    | 12          | tsvector + plainto_tsquery + topbar combobox.                                 |
| 12    | Public API + llms.txt + OpenAPI           | 0.5      | 9, 10, 11            | —           | `/api/v1/*`, llms.txt, openapi.json.                                          |
| 13    | Polish                                    | variable | — (slice)            | release     | Skeletons, error boundaries, OG images, sitemap, sentry, analytics.           |

**Total serial: ~14.5 días + Phase 13.**

### Paralelización marcada (no recomendada por defecto)

Si quieres acelerar y aceptar overhead de coordinación:

| Par                            | Ahorro   | Costo                                                              |
| ------------------------------ | -------- | ------------------------------------------------------------------ |
| Phase 2 ‖ Phase 1              | -2 días  | UI sin data real (hardcode mocks)                                  |
| Phase 5 ‖ Phase 4              | -1 día   | dos PRs simultáneos sobre `apps` schema vecino                     |
| Phase 11 ‖ Phase 4 ‖ Phase 5   | -0.5 día | search es read-only; bajo riesgo                                   |
| Phase 9 ‖ Phase 7              | -2 días  | MCP toca tools que dependen de mensajería; coordinación de schemas |
| Phase 10 ‖ Phase 11 ‖ Phase 12 | -1 día   | los 3 finales son lecturas independientes                          |

**Si paralelizas todo lo razonable: ~10 días.** Solo recomendable si entran más manos al ruedo (no para solo-dev con ADW).

---

## 4. Bloqueadores externos

| Bloqueador                                                 | Bloquea              | Status                                        | Acción                                                           |
| ---------------------------------------------------------- | -------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Supabase cloud project + URL + anon key + service-role key | Phase 1              | Tú lo gestionas (ETA "unos minutos")          | Antes de empezar Phase 1                                         |
| Google + GitHub OAuth apps configuradas                    | Phase 1              | Pendiente                                     | Crear OAuth credentials, pegar en Supabase Auth dashboard        |
| Railway service para MCP                                   | Phase 9 final        | Listo                                         | Conectar repo en Railway, point a `apps/mcp` con Nixpacks        |
| Vercel project + dominio                                   | Phase 13 deploy real | Listo                                         | Conectar repo en Vercel, set env vars, dominio custom            |
| MCP smoke test desde Claude Desktop                        | Phase 9 verificación | Local del usuario                             | Pegar `mcp-config.json` con PAT generado en `/settings/api-keys` |
| ~~Resend API key + DNS~~                                   | ~~Phase 8~~          | **N/A — eliminado**                           | —                                                                |
| VAPID keys para Web Push                                   | Phase 6              | Genera con `npx web-push generate-vapid-keys` | Antes de Phase 6                                                 |

---

## 5. Rediseño de notificaciones (en lugar de Phase 8)

Phase 6 absorbe el rol de notificación que tenía email + bell. Componentes:

### 5.1 — Surfaces de notificación

| Surface                     | Cuándo                                     | Donde                                                       |
| --------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| **Bell badge en topbar**    | Siempre, contador unread                   | Componente `<NotificationsBell>` (ya en spec §14.3.10)      |
| **Bell dropdown**           | Click en bell → últimas 20 notifs          | Mismo componente                                            |
| **Página `/notifications`** | Click "Ver todo" → inbox completo, filtros | Nueva ruta, no estaba en spec                               |
| **Toast**                   | Realtime fire mientras navegas             | Componente `<NotificationToast>` con `sonner` o equivalente |
| **`document.title`**        | Cuando hay unread > 0 → `(N) Hatch`        | Hook `useUnreadTitle()`                                     |
| **Favicon badge**           | Opcional, bajo prio                        | Library `favicon-notification` o casero                     |
| **Browser push**            | Usuario afuera del sitio, opt-in           | Service worker + Web Push API                               |

### 5.2 — Web Push setup

```
apps/web/
├── lib/push/
│   ├── vapid.ts              # client-side public key + subscribe helper
│   ├── server.ts             # server send via web-push lib
│   └── service-worker.ts     # template (compilado a public/sw.js)
├── public/
│   └── sw.js                 # service worker bundleado
└── app/api/push/
    ├── subscribe/route.ts    # POST: persist subscription
    └── unsubscribe/route.ts  # POST: remove subscription
```

Schema add (parte de Phase 6 migration `0005_messaging.sql` o nueva `0005a_push.sql`):

```sql
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index on public.push_subscriptions (user_id);
```

Server-side send (en `lib/push/server.ts`):

```ts
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:hello@hatch.dev',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function pushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(payload),
        );
      } catch (err: unknown) {
        // 410 Gone → unsubscribe stale endpoint
        if (
          err instanceof Error &&
          'statusCode' in err &&
          (err as { statusCode: number }).statusCode === 410
        ) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
      }
    }),
  );
}
```

### 5.3 — Reglas de surfacing por tipo

| Notif kind                  | Toast                     | Bell | Push (opt-in)              |
| --------------------------- | ------------------------- | ---- | -------------------------- |
| contact_request             | ✓ alta prio               | ✓    | ✓                          |
| contact_accepted / declined | ✓                         | ✓    | ✓                          |
| message                     | ✓ (si estás en otra ruta) | ✓    | ✓                          |
| comment_reply               | ✓                         | ✓    | ✓                          |
| comment                     | discreto                  | ✓    | opcional (off por default) |
| like                        | no                        | ✓    | no                         |
| follow                      | no                        | ✓    | no                         |

### 5.4 — `/settings/notifications` (reintroducido sin email)

Persiste en `profiles.notification_prefs jsonb`:

```json
{
  "push_enabled": false,
  "push_likes": false,
  "push_follows": false,
  "push_comments": true,
  "push_messages": true,
  "push_contact_requests": true
}
```

UI: card por tipo con switch. Master toggle "Habilitar notificaciones del navegador" hace el `Notification.requestPermission()` + subscribe al push subscription endpoint.

### 5.5 — Trade-off documentado

Aceptamos: usuarios sin push opt-in se enteran solo al volver al sitio. Para audiencia builders/tech que checa el sitio diario, OK. Si más adelante queremos cubrir el tail (usuarios casuales), agregamos:

- Push opt-in agresivo (banner en home la primera visita)
- O reintroducir email (refactor menor: meter Resend por encima del mismo `pushToUser` y duplicar destinos)

---

## 6. Adaptaciones forzadas vs SPEC

| SPEC dice                                          | Realidad nuestra              | Mitigación documentada                                                                                     |
| -------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `supabase start` (Docker stack)                    | Sin Docker                    | Phase 1 usa Supabase cloud directo. Migraciones via `supabase db push --linked` o `supabase migration up`. |
| MCP Dockerfile (§11.10)                            | Sin Docker                    | Railway con Nixpacks (auto-detecta Node 22, no necesita Dockerfile en el repo).                            |
| `notification_prefs jsonb` con email toggles (§10) | Sin email                     | Mismo column, solo con `push_*` keys (ver §5.4).                                                           |
| `email_log` table (§10.5)                          | Sin email                     | Tabla eliminada. Sin throttling necesario.                                                                 |
| `/api/webhooks/resend` (§10.4)                     | Sin email                     | Ruta eliminada.                                                                                            |
| React Email templates (§10.2)                      | Sin email                     | Carpeta `lib/email/` no se crea.                                                                           |
| Vercel Cron `weekly-digest` (§10.2)                | Sin email                     | Cron eliminado. Solo queda `refresh-scores` y `pick-featured`.                                             |
| GitHub Actions OIDC (§18.9)                        | Spec mismo dice "overkill v1" | Saltamos. Secrets manuales en Vercel/Railway/Supabase dashboards.                                          |
| `--src-dir=false` flag de create-next-app          | Flag obsoleto                 | Reemplazado por `--no-src-dir` en Phase 0 (ya hecho).                                                      |

---

## 7. Modelo de ejecución ADW

### Fases por modo

| Modo                                         | Fases                                           | Razón                                                                             |
| -------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| **Manual `/adw:adw_plan_build_test_review`** | Phase 1, Phase 9                                | Crítico (auth + RLS, MCP transport). Quiero aprobar diseño y plan antes de build. |
| **Epic ADW agrupado**                        | Phases 2+3 (UI shell + read path)               | Bloque coherente. Una pasada.                                                     |
| **Epic ADW agrupado**                        | Phases 4+5 (social + publish)                   | Ambos sobre `apps`.                                                               |
| **Epic ADW agrupado**                        | Phase 6+7 (notifications + push + messages)     | Bloque mensajería.                                                                |
| **Epic ADW agrupado**                        | Phases 10+11+12 (ranking + search + public API) | Pequeñas, read-only.                                                              |
| **Manual**                                   | Phase 13 (polish)                               | Slice through, no es realmente "una fase"                                         |

### Output deliverable inmediato

`writing-plans` (siguiente skill) genera `docs/superpowers/plans/2026-05-15-hatch-epic.md` con:

- Header consumible por `/adw:adw_epic`
- Lista numerada de fases con dependencias explícitas
- Cluster directives para los grupos (2+3, 4+5, 6+7, 10+11+12)
- Manual gates para Phase 1, Phase 9, Phase 13
- Bloqueadores externos como pre-conditions

### Smoke gates entre fases

Antes de considerar una fase "done":

- Tests del workflow `/adw:adw_plan_build_test_review` pasan
- `pnpm typecheck`, `pnpm lint`, `pnpm build` verdes (igual que Phase 0)
- Checklist Done específica de la fase (cada plan individual la define)

---

## 8. Riesgos del roadmap

| Riesgo                                          | Probabilidad | Mitigación                                                                |
| ----------------------------------------------- | ------------ | ------------------------------------------------------------------------- |
| Supabase cloud delay                            | Alta         | Phase 2 (UI shell) puede empezar en paralelo sin DB                       |
| RLS policies mal diseñadas en Phase 1           | Media        | `/adw:adw_plan_build_test_review` con tests SQL explícitos por policy     |
| Web Push iOS quirks                             | Media        | Documentar requisito PWA-install para iOS; v1 acepta limitación           |
| MCP transport dolores en Railway                | Media        | Phase 9 es manual, smoke test desde Claude Desktop antes de declarar done |
| Tests E2E flaky en Playwright                   | Media        | Solo 4 flows críticos según SPEC §18.6; mantener simples                  |
| Scope creep en Phase 13                         | Alta         | Time-box Phase 13 a 2 días máximo; posponer resto a v1.1                  |
| `/adw:adw_epic` falla a mitad                   | Media        | Cluster en bloques de 2-3 fases (no 12 fases en una corrida)              |
| Schema drift entre migrations y types generados | Baja         | Hook post-migration: `pnpm dlx supabase gen types ...` y commit           |

---

## 9. Lo que NO entra en el roadmap (post-v1)

Documentado para futuros brainstorms — explícitamente fuera de scope ahora:

- Email transaccional (refactor menor a re-introducir si lo queremos)
- Moderación / reports / soft-delete de autores
- Drafts UI (`is_published = false` ya funciona, falta UI dedicada)
- Imports desde GitHub / Product Hunt
- Collections / curated lists
- Maker week / events feed
- Direct messages sin contact-request previo
- AI features en MCP (`summarize_app`, `suggest_tags`)
- Sound notifications opt-in
- PWA install banner (la base service-worker ya queda)

---

## 10. Outputs esperados de este roadmap

1. **Este documento** (committed a git)
2. **`epic.md`** — output del próximo `writing-plans`. Formato consumible por `/adw:adw_epic`.
3. **Specs individuales por fase** — cuando empecemos cada fase, brainstorm pequeño + plan dedicado (al estilo Phase 0). Cada fase tiene su `2026-MM-DD-hatch-fase-N-design.md` y su plan.
4. **Tracking visual** — opcional, GitHub Issues o Project board (decisión post-roadmap, no bloquea).

---

_End of roadmap._
