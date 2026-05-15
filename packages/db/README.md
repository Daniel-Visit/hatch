# @hatch/db

SQL migrations for the Hatch Supabase project.

## Phase 0 status

Empty. Phase 1 onwards adds numbered migration files here following SPEC.md §4.

## Convention

- Migrations are plain `.sql` files in `migrations/`, numbered: `0001_init.sql`, `0002_apps.sql`, etc.
- Apply them via the Supabase CLI once cloud project is provisioned:
  ```bash
  pnpm dlx supabase db push
  ```
- After every migration: regenerate types:
  ```bash
  pnpm dlx supabase gen types typescript --project-id <id> > ../../apps/web/lib/supabase/types.ts
  ```

See `../../SPEC.md` §4 (data model) and §18.1-2 (migration discipline) for detail.
