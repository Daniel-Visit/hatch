-- 0037_apps_licensing.sql
-- Wanted §3.2.1 step 2: activate the matcher's "opposite licensing class" pre-filter.
--
-- The FTS retriever (apps/web/lib/wanted/matching/retriever.ts) documents this
-- seam: "'opposite licensing class' has NO corresponding column on `apps` ... the
-- seam stays in place so a future migration adding `apps.licensing` can wire it
-- without a refactor." This migration is that column.
--
-- App-side delivery class. The brief carries the SEEKER preference
-- (constraints.licensing: saas_ok | self_hosted_only | oss_only | no_pref). The
-- retriever maps an exclusionary preference to a filter on this column:
--   self_hosted_only → exclude licensing = 'saas'
--   oss_only         → keep only licensing = 'oss'
-- NULL (unclassified) apps are NEVER excluded — unknown licensing is treated as a
-- match, mirroring the retriever's conservative pre-filter contract.
--
-- Additive + nullable: existing apps default to NULL (unknown), so matcher
-- behaviour is unchanged until apps are classified.

create type public.app_licensing as enum (
  'saas',
  'self_hosted',
  'oss'
);

alter table public.apps
  add column if not exists licensing public.app_licensing;

comment on column public.apps.licensing is
  'Delivery/licensing class used by the Wanted matcher pre-filter (§3.2.1). Null = unknown (never filtered out).';

notify pgrst, 'reload schema';

-- ── down ─────────────────────────────────────────────────────────────────────
-- alter table public.apps drop column if exists licensing;
-- drop type if exists public.app_licensing;
-- notify pgrst, 'reload schema';
