# Conditional Documentation Guide

Read the relevant documentation files when working in these areas.

## Feature Documentation

- app_docs/feature-pair-4-mcp-server-api-keys.md
  - Conditions:
    - When working with the MCP server (`apps/mcp/`), its Streamable HTTP transport, tools/resources/prompts handlers, or Bearer-token auth
    - When modifying `api_keys` table, `/settings/api-keys` page, `generateApiKey`/`revokeApiKey` server actions, or `lib/zod/api-key.ts`
    - When deploying or debugging Railway/Railpack for `apps/mcp` or the `packages/shared` Database type re-export
    - When troubleshooting Claude Desktop ↔ Hatch MCP connection

- app_docs/feature-pair-5-ranking-search-public-api.md
  - Conditions:
    - When working with hot-score ranking (`compute_hot_score`, `refresh_hot_scores`, `pick_featured_app`, `featured_apps`), pg_cron schedules, or FeaturedHero data flow
    - When working with full-text search (`searchApps` action, `/search` page, topbar form wire) or the `search_vector` column
    - When modifying any `/api/v1/*` public endpoint, `/llms.txt`, `/api/v1/openapi.json`, or the Postgres-backed rate limiter (`lib/rate-limit.ts`, `api_rate_limits` table, `increment_rate_limit` RPC)
    - When troubleshooting Vercel monorepo deploy (Root Directory + "Include source files outside" toggle), CRON_SECRET, or the `@asteasolutions/zod-to-openapi` generator

- app_docs/feature-session-2026-05-16-shell-route-group-and-polish.md
  - Conditions:
    - When touching `app/(shell)/layout.tsx`, `app/layout.tsx`, or anything that decides which routes get the topbar+sidebar shell vs render bare (e.g. `/sign-in`)
    - When modifying the avatar dropdown (`AvatarMenu` in `shell.tsx`), sidebar nav `Link` items, or the topbar Browse/Publish buttons
    - When changing routing from gallery cards to the detail page (`/a/<slug>`), or the `id`-is-slug convention in `data-mappers.ts`
    - When working with view tracking (`app_views` table, `bump_views_count` trigger, `lib/actions/views.ts`, `recordView`, `VIEW_HASH_SALT`)
    - When touching profile editing (`/settings/profile`, `ProfileForm`, `uploadAvatar`, `updateProfile`, the avatars storage bucket, `profiles.banner_gradient` column, `lib/profile-gradients.ts`, `resolveBannerCss`)
    - When changing dynamic stats on `/u/[handle]` (Followers/Following/Joined) or how the profile banner CSS is resolved
    - When the remix concept resurfaces — column, trigger, UI, or types — and needs to stay removed (SPEC.md §1)
    - When configuring Node header size for Supabase auth cookies (`NODE_OPTIONS=--max-http-header-size=65536`) or hitting HTTP 431
    - When updating `next.config.ts` `images.remotePatterns` for OAuth or Supabase-hosted images
    - When troubleshooting the favicon / `app/icon.svg` / site title metadata

- app_docs/feature-portable-eval-kit.md
  - Conditions:
    - When working with the portable eval kit or cross-project eval ingestion
    - When modifying eval_ingest.py, /eval:setup, /eval:run, or ProjectFilter
    - When troubleshooting eval result push or project filtering

- app_docs/feature-Engine-eval-engine.md
  - Conditions:
    - When working with the eval engine (datasets, scorers, experiments)
    - When modifying eval_engine.py, eval_analytics.py, or online_scoring.py
    - When troubleshooting experiment execution or scoring

- app_docs/feature-telemetry-panels-workflow-redesign.md
  - Conditions:
    - When working with telemetry panels or workflow visualization
    - When modifying TelemetryDashboard, workflow components, or OTLP ingestion
    - When troubleshooting telemetry metrics display

- app_docs/feature-restore-orchestrator-teams-tasks.md
  - Conditions:
    - When working with teams, tasks, or orchestrator management
    - When modifying TeamPanel, TaskList, or agent_manager.py
    - When troubleshooting team creation or task assignment

- app_docs/feature-vue-to-nextjs-lucide-migration.md
  - Conditions:
    - When working with frontend component architecture or icon system
    - When migrating or refactoring frontend components
    - When troubleshooting icon imports or component structure

- app_docs/feature-orchestrator-tools-expansion-cli-agent.md
  - Conditions:
    - When working with orchestrator tools, agent*manager.py, or tools*\*.py modules
    - When modifying telemetry, recovery, budget, or remote worker tools
    - When working with the CLI orchestrator agent (.claude/agents/orchestrator.md)
    - When troubleshooting orchestrator tool registration or backend API integration

- app_docs/feature-session-2026-04-04-orchestrator-expansion-hooks.md
  - Conditions:
    - When working with the cognitive hook engine (hook_engine.py, hooks/\*.py, hookable_orchestrator_service.py)
    - When modifying hook handlers or adding new handlers to hook_registry.py
    - When troubleshooting hook execution, HooksPanel, or COGNITIVE_HOOKS_ENABLED
    - When working with orchestrator tool expansion or the CLI orchestrator agent

- docs/superpowers/specs/2026-04-04-adapt-codebase-bootstrap-library-bundle-design.md
  - Conditions:
    - When working with adapt-codebase skill or the bootstrap Phase -1
    - When modifying the agentic library bundle system
    - When troubleshooting agentic layer creation from scratch on new codebases

- app_docs/feature-multi-project-orchestrator.md
  - Conditions:
    - When working with multi-project orchestration or target project selection
    - When modifying SubagentRegistry, target_project_path, or project capabilities API
    - When troubleshooting project selector UI, ProjectBadge, ProjectModal, or agentic explorer target awareness
    - When working with expertise_injector target resolution or protected agent list

- app_docs/analysis-pi-ecosystem-inspiration.md
  - Conditions:
    - When designing new cognitive hooks or hook handlers
    - When brainstorming new dashboard capabilities or features
    - When evaluating patterns from other agent ecosystems (Pi, Codex, etc.)
    - When working on context management, file reservation, or review automation

- app_docs/feature-StrongDM-formal-verification-multi-mode.md
  - Conditions:
    - When working with formal-mode state-machine specs (`*.ioa.toml`) or the L0 symbolic verifier
    - When modifying anything under `apps/dashboard/backend/modules/formal/` or `routers/formal.py`
    - When touching the `bounded_effects_validator.py` or `formal_spec_validator.py` hooks
    - When changing the `--mode={explore|spec|formal}` flag on ADW commands or the cognitive-hooks pre-flight gate
    - When modifying the FormalModePanel, MemoryStoresPanel sidebar accordions, or the Zustand `formalSpecs` slice
    - When troubleshooting `COGNITIVE_HOOKS_FORMAL_MODE`, `AGENT_MODE`, or `AGENT_ROLE` env vars

## Council Reports

- app*docs/council_verdict*\*.md
  - Conditions:
    - When making architectural decisions about API design, database strategy, or validation
    - When evaluating GraphQL vs REST, SQLAlchemy vs asyncpg, or event-driven patterns
    - When reviewing prior council decisions for consistency

- app_docs/feature-session-2026-04-03-agentic-layer-expansion.md
  - Conditions:
    - When working with sandbox council, team conversations, or remote worker mesh
    - When modifying ConversationsPanel, RemotePanel, agent_job_poller, or sandbox_council/
    - When troubleshooting remote dispatch, Listen worker, or inter-agent message capture
    - When adding new dashboard tabs or extending the worker registry
