# Hatch — Phase 0 Design (Scaffolding local)

> Brainstorm output. Audience: Claude Code + el dev humano.
> Status: aprobado para pasar a `writing-plans`.

Last updated: 2026-05-15
Repo destino (cuando se conecte): https://github.com/Daniel-Visit/hatch

---

## 1. Contexto

Construimos **Hatch** según `SPEC.md` (1786 líneas, 13 fases). Este documento cubre **solo Phase 0** — el scaffolding del monorepo. Las fases 1-13 quedan para roadmap maestro + epic ADW posterior.

### Constraints duros del entorno

| Constraint | Origen | Implicación |
|------------|--------|-------------|
| **No Docker** bajo ningún motivo | Decisión del usuario | No usamos `supabase start` (depende de Docker). Phase 0 no necesita Postgres local de todas formas. |
| **Supabase cloud en gestión** | El usuario lo está abriendo en paralelo | Phase 0 no toca Supabase. Stubs `lib/supabase/{server,client,admin}.ts` que leen env y fallan loud si faltan. Phase 1 conecta. |
| **Resend deferred** | API key se habilita "en su momento" | No instalar `resend` en Phase 0. Llega en Phase 8. |
| **Vercel/Railway/dominio listos** | Usuario confirmó | Disponibles cuando los necesitemos, pero NO en Phase 0. |
| **Repo GitHub `Daniel-Visit/hatch` existe** | URL provista | Se conecta en Phase 0 al final, después de validar local. Estado del repo (vacío vs con archivos) se valida en el momento del `git remote add`. |

### Filosofía de Phase 0

Phase 0 es **puramente local**. No deploy. No cloud. No DB. Solo:

- Scaffolding del monorepo pnpm
- Next.js 15 placeholder en `apps/web`
- MCP server placeholder en `apps/mcp`
- Packages compartidos (`shared`, `db`) como esqueletos vacíos
- Tooling de dev (TypeScript, ESLint, Prettier, Husky)
- `.env.example` con todas las claves de §17 del spec
- `pnpm dev` levanta web y mcp en paralelo

**Criterio Done absoluto:** un dev nuevo puede `git clone && pnpm install && pnpm dev`, ver Next en `:3000` y MCP `/health` en `:8080`. Nada más, nada menos.

---

## 2. Estructura final del repo

```
hatch/
├── apps/
│   ├── web/                    # Next.js 15 — :3000
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx        # <h1>Hatch</h1> placeholder
│   │   │   └── globals.css
│   │   ├── lib/
│   │   │   └── supabase/
│   │   │       ├── server.ts   # stub: throw si env falta
│   │   │       ├── client.ts   # stub
│   │   │       └── admin.ts    # stub
│   │   ├── public/
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts  # solo si Tailwind v4 lo requiere; v4 puede ir CSS-first
│   │   ├── postcss.config.mjs
│   │   ├── eslint.config.mjs
│   │   ├── tsconfig.json       # extends ../../tsconfig.base.json
│   │   ├── next-env.d.ts
│   │   └── package.json
│   └── mcp/                    # MCP server — :8080
│       ├── src/
│       │   └── index.ts        # http.createServer + GET /health → {ok:true}
│       ├── tsconfig.json       # extends ../../tsconfig.base.json
│       └── package.json
├── packages/
│   ├── shared/                 # cross-package types
│   │   ├── src/
│   │   │   ├── categories.ts   # stub: const CATEGORIES = [] (Phase 1+ lo llena)
│   │   │   ├── ranking.ts      # stub: export function hotScore() {…}
│   │   │   ├── types.ts        # stub: export type Placeholder = never;
│   │   │   └── index.ts        # re-exports
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── db/                     # migraciones Supabase
│       ├── migrations/         # vacío en Phase 0
│       ├── README.md           # explica que aquí van las .sql numeradas
│       └── package.json        # opcional, sin código
├── prototype/
│   └── Hatch.html              # movido desde root — solo referencia visual
├── docs/
│   └── superpowers/specs/      # este doc vive aquí
├── .claude/                    # ya existe (no tocar)
├── adws/                       # ya existe (no tocar)
├── agents/                     # ya existe (no tocar)
├── logs/                       # ya existe (no tocar)
├── .env.example                # todas las vars de §17 sin valores
├── .gitignore                  # node_modules, .next, .env*, dist, .turbo, etc.
├── .prettierrc.json
├── .prettierignore
├── eslint.config.mjs           # flat config raíz
├── tsconfig.base.json          # strict + paths comunes
├── pnpm-workspace.yaml
├── package.json                # scripts root
├── README.md                   # quickstart
├── SPEC.md                     # ya existe (no tocar)
└── .husky/                     # hooks de git
    └── pre-commit              # corre lint-staged
```

### Notas de organización

- **Hatch.html se mueve a `prototype/`** — el spec lo dice explícito (§16 Phase 0 no lo lista, pero §3 lo asume y §1 lo trata como referencia). Mejor moverlo ya para que el root quede limpio.
- **`.claude/`, `adws/`, `agents/`, `logs/` se respetan tal como están** — son la infraestructura ADW del usuario, fuera de scope.

---

## 3. Decisiones técnicas pinneadas

| Decisión | Valor | Razón |
|----------|-------|-------|
| Node | **22 LTS** | El Dockerfile del spec (§11.10) usa `node:22-alpine`. Coherencia. |
| Package manager | **pnpm 10.x** | Spec pide pnpm workspaces (§3). |
| Next.js | **15.x** | App Router. Spec lo asume todo el tiempo. |
| React | **19** | Viene con Next 15. |
| Tailwind | **v4** (CSS-first) | `create-next-app` actual la trae por default. La porting de tokens del spec (§14.1) usa CSS variables → encaja perfecto con Tailwind v4. |
| TypeScript | **5.x estricto** | Sin `any` (regla §18.5). |
| MCP SDK | **`@modelcontextprotocol/sdk` última** | Solo importar; sin tools en Phase 0. |
| Husky + lint-staged | **incluido** | Spec lo pide en Phase 0 §16 explícito. |
| Prettier | **default + 100 col** | Sin opiniones fuertes; la regla del proyecto. |
| ESLint | **flat config** (`eslint.config.mjs`) | Estándar moderno. Next 15 lo soporta. |
| `tsx` | **sí** en `apps/mcp` | Para correr `src/index.ts` sin build en dev. |
| Supabase CLI | **NO instalar todavía** | Sin Docker no aporta. Llega en Phase 1. |
| shadcn/ui | **NO** | Eso es Phase 2. |
| React Email | **NO** | Eso es Phase 8. |
| Sentry, analytics | **NO** | Phase 13. |

---

## 4. Contratos clave

### 4.1 — `package.json` raíz (scripts)

```json
{
  "name": "hatch",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "dev":       "pnpm -r --parallel dev",
    "dev:web":   "pnpm --filter web dev",
    "dev:mcp":   "pnpm --filter mcp dev",
    "build":     "pnpm -r build",
    "lint":      "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "format":    "prettier --write .",
    "prepare":   "husky"
  },
  "devDependencies": {
    "prettier": "^3",
    "husky": "^9",
    "lint-staged": "^15",
    "typescript": "^5"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["prettier --write", "eslint --fix"],
    "*.{md,json,css}":   ["prettier --write"]
  }
}
```

### 4.2 — `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 4.3 — `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

### 4.4 — `apps/mcp/src/index.ts` (placeholder mínimo)

```ts
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 8080);

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'hatch-mcp', version: '0.0.0' }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[mcp] listening on :${PORT}`);
});
```

> Nota: aquí no levantamos el `StreamableHTTPServerTransport` del SDK aún. Eso es Phase 9. Phase 0 solo prueba que el proceso boota y responde HTTP.

### 4.5 — Supabase stubs (`apps/web/lib/supabase/server.ts`)

```ts
// Phase 0: stub. Phase 1 implementa con @supabase/ssr.
export async function createSupabaseServerClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      '[supabase] NEXT_PUBLIC_SUPABASE_URL no está set. ' +
      'Phase 1 conecta este stub al cliente real.'
    );
  }
  throw new Error('[supabase] server client no implementado todavía (Phase 1).');
}
```

Idéntico patrón en `client.ts` y `admin.ts` con sus respectivos errores. **Razón:** que el código falle ruidoso si alguien intenta usar Supabase en Phase 0, en vez de fallar silencioso.

### 4.6 — `.env.example`

Una sola archivo en la raíz, con TODAS las claves de §17 sin valores. Cada app lee `process.env.*`. No partir el archivo por app — el monorepo comparte env file local en la raíz para simplicidad.

```bash
# ─── apps/web ──────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
CRON_SECRET=
NEXT_PUBLIC_MCP_URL=http://localhost:8080

# ─── apps/mcp ──────────────────────────────────────────────────────────
PORT=8080
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LOG_LEVEL=info
```

### 4.7 — `.gitignore`

Cubrir: `node_modules/`, `.next/`, `dist/`, `.env`, `.env.local`, `.env.*.local`, `*.tsbuildinfo`, `.turbo/`, `.DS_Store`, `coverage/`, `playwright-report/`, `test-results/`.

### 4.8 — `README.md` (quickstart mínimo)

Una sección "Quickstart" de 5 líneas:
```
git clone <repo> && cd hatch
cp .env.example .env.local      # rellena vars cuando Phase 1+ las necesite
pnpm install
pnpm dev                         # web :3000 + mcp :8080
```
Más una nota que apunta al `SPEC.md` para el detalle del producto.

---

## 5. Conexión a GitHub (al final de Phase 0)

Una vez `pnpm dev` esté verde local:

1. `git init` en `/Users/daniel/Downloads/hatch/`.
2. Verificar estado del repo remoto `Daniel-Visit/hatch`:
   - Si está vacío → `git remote add origin git@github.com:Daniel-Visit/hatch.git` y push directo.
   - Si tiene `README/LICENSE/.gitignore` que GitHub creó al inicializar → `git pull --rebase origin main` y resolver conflictos antes de push.
3. Primer commit: "feat: phase 0 — monorepo scaffolding".
4. Push a `main`.

> **Confirmación pendiente del usuario:** estado actual del repo remoto. Resolvible en el momento.

---

## 6. Lo que explícitamente NO entra en Phase 0

| Cosa | Cuándo entra |
|------|--------------|
| Cualquier deploy (Vercel, Railway) | Defer indefinido — el usuario decide cuándo |
| Crear/conectar Supabase project | Phase 1 |
| Cualquier migración SQL | Phase 1 |
| Sign in / OAuth | Phase 1 |
| Tokens de diseño / fonts Geist | Phase 2 |
| Componentes reales (`<AppCard>`, `<Shell>`, etc.) | Phase 2 |
| shadcn/ui | Phase 2 |
| Lectura de apps / detail / profile | Phase 3 |
| Likes, comments, follows | Phase 4 |
| Storage / publish | Phase 5 |
| Notifications / messaging | Phases 6-7 |
| React Email + Resend | Phase 8 |
| MCP tools/resources/prompts reales | Phase 9 |
| GitHub Actions CI | No definido en spec; defer hasta deploy time |

---

## 7. Criterio Done de Phase 0

Checklist explícita. Phase 0 está hecho **solo** si:

- [ ] `pnpm install` corre sin errores en clean clone
- [ ] `pnpm dev` levanta `apps/web` en `:3000` mostrando `<h1>Hatch</h1>`
- [ ] `pnpm dev` levanta `apps/mcp` en `:8080`; `curl http://localhost:8080/health` devuelve `{"ok":true,...}`
- [ ] `pnpm typecheck` pasa en todos los packages
- [ ] `pnpm lint` pasa en todos los packages
- [ ] `pnpm build` pasa para `web` y `mcp`
- [ ] `pnpm format` no encuentra archivos por reformatear (post-format inicial)
- [ ] `Hatch.html` movido a `prototype/Hatch.html`
- [ ] `.env.example` lista todas las vars de §17 sin valores
- [ ] Husky pre-commit hook activo (intentar commit con código malformado lo bloquea)
- [ ] Repo GitHub `Daniel-Visit/hatch` conectado, primer commit pusheado a `main`

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| `create-next-app` cambia defaults entre versiones | Media | Pinear comando exacto en el plan: `pnpm dlx create-next-app@15 ...` con flags explícitas. |
| Tailwind v4 vs v3 incompatibilidades | Media | Usar la versión que `create-next-app@15` instale por default; documentar cuál fue. |
| pnpm workspace + Next.js no resuelven `packages/shared` sin `transpilePackages` | Media | Configurar `transpilePackages: ['@hatch/shared']` en `next.config.ts`. |
| Husky no se instala en CI clones (no postinstall) | Baja | Documentar que `pnpm install` corre `prepare` automáticamente. |
| MCP SDK requiere ESM exclusivo y choca con CommonJS | Baja | Configurar `apps/mcp/package.json` con `"type": "module"` y `tsx` corre ESM nativo. |
| Repo `Daniel-Visit/hatch` no está vacío | Media | Verificar al hacer `git remote add` y rebase si necesario. |

---

## 9. Out of scope (post-Phase 0, próximos brainstorms)

Estos quedan registrados para cuando volvamos al meta-roadmap:

- **Roadmap maestro** — agrupar fases 1-13 en tracks con paralelización marcada
- **Epic ADW** — `epic.md` para alimentar `/adw:adw_epic` y automatizar plan→build→test→review por fase
- **Decisión de hosting** — Vercel + Railway parece dado por el spec, pero el usuario quiere validar local primero antes de comprometer
- **Estrategia de testing** — Playwright para los 4 flows críticos (§18.6) llega cuando haya UI real

---

*End of Phase 0 design.*
