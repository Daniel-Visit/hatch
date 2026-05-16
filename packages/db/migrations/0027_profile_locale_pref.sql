-- 0027: profiles.locale_pref
-- Adds a nullable text column for signed-in users' persisted UI language.
-- Null means "use cookie or auto-detect". Constrained to the supported locale set.

alter table public.profiles
  add column if not exists locale_pref text check (locale_pref in ('en', 'es'));
