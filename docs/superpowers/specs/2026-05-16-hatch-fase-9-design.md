# Hatch — Phase 9 Design (MCP Server + API Keys)

> Last updated: 2026-05-16
> Status: brainstorm cerrado, listo para `/tac:feature`
> Depends on: Phases 5 (publish) + 7 (messages) — ambas shipped
> Unblocks: Phase 12 (public API + llms.txt)
> Repo: github.com/Daniel-Visit/Hatch — push real-time

---

## 1. Objetivo

Exponer Hatch como un MCP server consumible desde Claude Desktop (y otros clientes MCP) con surface **completa**: lectura, publicación de apps y acciones sociales. Sin atajos "v1 minimal". El server corre en Railway con Nixpacks (sin Dockerfile). Auth via Personal Access Tokens (PATs) generados desde la UI de la app web.

**Trade-off explícito asumido:** un PAT == acceso full-account. Si el usuario revoca el token, pierde acceso. No hay scopes granulares en esta fase (se documenta en §10 como follow-up post-v1).

---

## 2. Decisiones cerradas en brainstorm

| #   | Decisión         | Detalle                                                                                                                                                    |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Surface de tools | **Completa** — read + publish + social (10 tools, ver §5.1)                                                                                                |
| 2   | API key scoping  | **Token único por usuario, full-account**. Revoca = pierde acceso. Una row activa máx en `api_keys`.                                                       |
| 3   | Transport        | **Streamable HTTP** (MCP spec 2025-03-26). Single `POST /mcp` endpoint, soporta SSE para streaming.                                                        |
| 4   | Primitivas MCP   | **Tools + Resources + Prompts** — los tres. Sin atajos.                                                                                                    |
| 5   | Deploy           | **Railway + Nixpacks**, Node 22 auto-detect. Sin Dockerfile.                                                                                               |
| 6   | DB client        | Server usa `service_role` (bypasea RLS), pero cada handler valida ownership manualmente.                                                                   |
| 7   | PAT format       | `hatch_pat_` + 32 bytes random URL-safe base64 (~43 chars). Hashed con bcrypt antes de persistir. Plain token mostrado al user UNA SOLA VEZ tras creación. |

---

## 3. Arquitectura

```
Claude Desktop
      │
      │ POST /mcp  (Authorization: Bearer hatch_pat_xxx)
      ▼
Railway: apps/mcp (Node 22, Nixpacks)
      │
      ├─ src/server.ts         MCP SDK server, registra tools/resources/prompts
      ├─ src/transport.ts      Streamable HTTP transport wrapper
      ├─ src/auth.ts           Bearer → user_id (bcrypt compare contra api_keys)
      ├─ src/supabase.ts       Singleton Supabase client (service_role)
      ├─ src/tools/*.ts        10 tool handlers
      ├─ src/resources/*.ts    3 resource handlers
      └─ src/prompts/*.ts      3 prompt templates
      │
      ▼
Supabase Postgres (vcbdtjjkkwryvmqbflah)
      │
      └─ api_keys, profiles, apps, follows, likes, saves, comments,
         contact_requests, conversations, messages, notifications
```

Auth flow por request:

1. Extrae `Authorization: Bearer hatch_pat_xxx` del header.
2. Query `api_keys where token_prefix = first 12 chars AND revoked_at IS NULL`.
3. Para cada row, `bcrypt.compare(plain_token, token_hash)` — primer match gana.
4. Si match: set `user_id` en context, `UPDATE api_keys SET last_used_at = now() WHERE id = ...` (fire-and-forget).
5. Si no match: 401.

---

## 4. Schema — migration `0019_api_keys.sql`

```sql
create table public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  token_hash   text not null,
  token_prefix text not null,                  -- first 12 chars of plain token, for indexed lookup
  label        text not null default 'Claude Desktop',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index api_keys_user_id_idx on public.api_keys (user_id) where revoked_at is null;
create index api_keys_token_prefix_idx on public.api_keys (token_prefix) where revoked_at is null;
create unique index api_keys_one_active_per_user on public.api_keys (user_id) where revoked_at is null;

alter table public.api_keys enable row level security;

-- Users see only their own keys, never the hash
create policy "users read own api_keys"
  on public.api_keys for select
  using (user_id = auth.uid());

create policy "users insert own api_keys"
  on public.api_keys for insert
  with check (user_id = auth.uid());

create policy "users revoke own api_keys"
  on public.api_keys for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and revoked_at is not null);

-- No delete policy — soft-delete only via revoked_at
```

Notas:

- `token_prefix` permite lookup indexado sin escanear toda la tabla y bcrypt-comparar cada row.
- `unique partial index` sobre `(user_id) where revoked_at is null` asegura "un solo token activo por user" a nivel DB, no solo aplicación.
- Hash con bcrypt cost 12 (default Supabase Auth).

---

## 5. MCP Surface

### 5.1 — Tools (10)

| Tool                            | Input                                                                         | Output                                      | Validación                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `list_apps`                     | `{ cursor?, limit? }` (default 20, max 50)                                    | `{ apps: App[], next_cursor? }`             | —                                                                                        |
| `search_apps`                   | `{ query, limit? }`                                                           | `{ apps: App[] }`                           | `query.length ≥ 2`                                                                       |
| `get_app`                       | `{ slug }`                                                                    | `App` con autor expandido                   | 404 si no existe                                                                         |
| `list_categories`               | `{}`                                                                          | `{ categories: Category[] }`                | —                                                                                        |
| `get_profile`                   | `{ handle }`                                                                  | `Profile` con `app_count`, `follower_count` | 404                                                                                      |
| `list_notifications`            | `{ unread_only?, limit? }`                                                    | `{ notifications: Notification[] }`         | scoped a `user_id` actual                                                                |
| `publish_app`                   | `{ name, slug?, description, category, repo_url?, demo_url?, app_art_seed? }` | `App`                                       | Zod estricto, `slug` autogen si falta; reusa lógica de `apps/web/lib/actions/publish.ts` |
| `update_app`                    | `{ slug, ...partial }`                                                        | `App` actualizado                           | ownership check: `app.author_id = user_id`                                               |
| `like_app` / `unlike_app`       | `{ slug }`                                                                    | `{ ok: true, liked: bool }`                 | toggle                                                                                   |
| `save_app` / `unsave_app`       | `{ slug }`                                                                    | `{ ok: true, saved: bool }`                 | toggle                                                                                   |
| `follow_user` / `unfollow_user` | `{ handle }`                                                                  | `{ ok: true, following: bool }`             | toggle, no self-follow                                                                   |
| `send_message`                  | `{ to_handle, body }`                                                         | `Message`                                   | requiere `contact_request` accepted previo (reusa `apps/web/lib/actions/messages.ts`)    |

Total: 10 tool families (algunas son toggle pairs). Cuento las pairs como una sola en el resumen de §2.

### 5.2 — Resources (3)

| URI template               | Contenido                                           | MIME               |
| -------------------------- | --------------------------------------------------- | ------------------ |
| `hatch://app/{slug}`       | JSON del app con autor + counters                   | `application/json` |
| `hatch://profile/{handle}` | JSON del profile con apps + follower count          | `application/json` |
| `hatch://notifications`    | JSON array de las últimas 50 notifs del user actual | `application/json` |

Los resources permiten "pinear" entidades en el contexto de Claude sin que el usuario tenga que copiar/pegar.

### 5.3 — Prompts (3)

| Prompt name             | Arguments                                      | Purpose                                                                    |
| ----------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| `draft_app_description` | `{ app_name, what_it_does, target_audience? }` | Genera descripción larga estilo Hatch desde inputs cortos.                 |
| `review_my_apps`        | `{}`                                           | Toma los apps del user (via `get_profile`) y propone mejoras de copy/tags. |
| `compose_message`       | `{ to_handle, intent }`                        | Drafta un mensaje DM apropiado al tono de Hatch.                           |

Los prompts son templates server-side que Claude Desktop expone como slash commands. El user los invoca, Claude llama al MCP server para resolver el template, y el resultado va al contexto.

---

## 6. UI — `/settings/api-keys`

Route nueva: `apps/web/app/(auth)/settings/api-keys/page.tsx` (Server Component).

Estados:

- **Sin token activo:** botón "Generate API Key", al click crea row + muestra el plain token UNA vez en un modal con copy-button y warning "Save this now, you won't see it again."
- **Con token activo:** muestra `label`, `created_at`, `last_used_at`, masked prefix (`hatch_pat_abc1...****`), botón "Revoke". Bajo eso, un bloque copiable con `mcp-config.json` lleno con el endpoint Railway y un placeholder `<paste-your-token>` porque el plain text ya no existe en DB.

Server action: `apps/web/lib/actions/api-keys.ts` con `generate()` y `revoke()`. `generate()` valida que no haya activa, genera plain token, hashea, inserta row, devuelve plain SOLO en el response (nunca lo persiste en plain).

Schema Zod: `apps/web/lib/zod/api-key.ts` (`label` opcional, default "Claude Desktop").

---

## 7. Deploy — Railway + Nixpacks

Archivos a crear/modificar:

- `apps/mcp/nixpacks.toml` — pin Node 22, install steps, start command.
- `apps/mcp/.env.example` — vars requeridas (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- `apps/mcp/package.json` — agregar deps: `@supabase/supabase-js`, `bcrypt`, `@types/bcrypt`, `zod`. Build script ya existe.
- Root `pnpm-workspace.yaml` — ya incluye `apps/mcp/`.

Railway config (vía dashboard, no en repo):

- Root directory: `apps/mcp`
- Build command: (auto via Nixpacks — corre `pnpm install` + `pnpm build`)
- Start command: `pnpm start`
- Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT` (Railway lo inyecta)
- Health check: `GET /health` (ya existe en stub actual, mantener)

URL pública será algo como `https://hatch-mcp-production.up.railway.app/mcp` — copiada manualmente al `mcp-config.json` que se muestra en la UI.

---

## 8. Validación / smoke test

Antes de marcar Phase 9 done:

1. `pnpm typecheck && pnpm lint && pnpm build` verdes en root.
2. Migration `0019_api_keys.sql` aplicada vía Supabase MCP `apply_migration`. Types regenerados (`pnpm gen:types` o equivalente actual).
3. RLS validator: confirmar que `api_keys` tiene RLS enabled, que un user no puede leer/escribir keys de otro user (vía `mcp__supabase__execute_sql` con dos JWTs distintos).
4. UI manual: generar key en `/settings/api-keys`, copiar token, revocar, confirmar que aparece "no active key".
5. Railway deploy verde, `GET /health` responde 200.
6. **Smoke test desde Claude Desktop:** pegar `mcp-config.json` con el token generado en step 4, restart Claude Desktop, confirmar que aparecen los tools/resources/prompts. Llamar `list_apps`, `get_app`, `publish_app` (dry-run con app de prueba), `send_message`. Capturar evidencia en `tests/visual-baselines/phase-9-mcp/` (screenshots de Claude Desktop con cada llamada).
7. Auth negativo: llamada sin Bearer → 401. Llamada con token revocado → 401. Llamada con token válido pero usuario sin perfil (edge) → 401.

---

## 9. Adaptaciones forzadas vs SPEC §11

| SPEC §11 dice                                              | Realidad                                               | Mitigación                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| Dockerfile en `apps/mcp/Dockerfile`                        | Sin Docker                                             | `nixpacks.toml` en su lugar; Railway autodetecta Node 22      |
| API keys con scopes granulares opcionales                  | Cerrado a full-account                                 | Documentado en §10 follow-up                                  |
| Múltiples tokens por user con labels                       | Uno activo por user                                    | `unique partial index` lo enforce a nivel DB                  |
| Resources de tipo `hatch://search?q=...` con query strings | Solo `app/{slug}`, `profile/{handle}`, `notifications` | Search está disponible como tool; no se duplica como resource |

---

## 10. Out of scope (post-v1, no entran en Phase 9)

- Scopes granulares por token (read/write/social separados)
- Múltiples tokens por user con labels distintos
- Audit log de invocaciones MCP (qué tool, qué params, qué resultado)
- Rate limiting per-token (Railway tiene global rate limit suficiente para v1)
- OAuth2 flow para clientes que no soporten bearer estático
- AI tools (`summarize_app`, `suggest_tags`) — Phase 13+ si llega
- MCP server multi-tenant (un solo deploy sirve a todos los users de Hatch)

---

## 11. Outputs esperados de este spec

1. Este documento (committed a git).
2. `/tac:feature` → genera plan implementacional con tasks numeradas y waves de ejecución.
3. Migration `0019_api_keys.sql` + RLS policies.
4. Código en `apps/mcp/src/` + UI en `apps/web/app/(auth)/settings/api-keys/`.
5. Smoke test verde desde Claude Desktop con screenshots de evidencia.

---

_End of design._
