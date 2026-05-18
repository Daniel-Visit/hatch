-- 0029: optional built_with text[] on apps — declare AI models used to build.
-- Closed list of 8 vendor slugs. Default empty. No data backfill needed.

alter table public.apps
  add column if not exists built_with text[] not null default '{}'::text[];

-- CHECK constraint: each element must be one of the 8 allowed slugs.
-- The `array_length(... ) is null or` guard accepts an empty array.
alter table public.apps
  drop constraint if exists apps_built_with_check;

alter table public.apps
  add constraint apps_built_with_check check (
    array_length(built_with, 1) is null
    or (
      array_length(built_with, 1) <= 3
      and built_with <@ array[
        'claude','deepseek','gemini','github-copilot',
        'gpt','kimi','mistral','qwen'
      ]::text[]
    )
  );

-- GIN index for future filter use (e.g. `WHERE 'claude' = any(built_with)`).
create index if not exists apps_built_with_idx
  on public.apps using gin (built_with);
