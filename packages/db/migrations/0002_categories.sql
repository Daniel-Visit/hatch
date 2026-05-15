-- Phase 1: categories static table + seed
-- Per SPEC.md §4.2

create table public.categories (
  id          text primary key,
  label       text not null,
  icon        text not null,
  sort_order  int not null default 0
);

insert into public.categories (id, label, icon, sort_order) values
  ('ai',           'AI & ML',       '✦', 10),
  ('games',        'Games',         '◈', 20),
  ('tools',        'Dev tools',     '◐', 30),
  ('music',        'Music & audio', '◑', 40),
  ('productivity', 'Productivity',  '◉', 50),
  ('creative',     'Creative',      '✺', 60),
  ('data',         'Data viz',      '◰', 70),
  ('web3',         'Web3',          '◇', 80);
