-- migration 0011_social_seed — Phase 4: demo likes/comments/follows/comment_likes
-- so the detail page Comments + profile Liked tab look populated
-- Uses UUIDs from 0008_apps_seed.sql

-- Author handles → UUIDs (from 0008_apps_seed.sql):
-- mila     = 'aaaaaaaa-0000-0000-0000-000000000001'
-- junopark = 'aaaaaaaa-0000-0000-0000-000000000002'
-- rafaeth  = 'aaaaaaaa-0000-0000-0000-000000000003'
-- pip      = 'aaaaaaaa-0000-0000-0000-000000000004'
-- zeeokk   = 'aaaaaaaa-0000-0000-0000-000000000005'
-- itoc     = 'aaaaaaaa-0000-0000-0000-000000000006'
-- noal     = 'aaaaaaaa-0000-0000-0000-000000000007'
-- vex      = 'aaaaaaaa-0000-0000-0000-000000000008'
-- kimsol   = 'aaaaaaaa-0000-0000-0000-000000000009'
-- ashp     = 'aaaaaaaa-0000-0000-0000-00000000000a'

-- App slugs → app UUIDs resolved at runtime via subquery (not hardcoded in 0008).
-- Author for each app (drives is_creator pill in UI):
-- pixel-sushi    → mila     (001)
-- toast-roaster  → rafaeth  (003)
-- chromacalm     → pip      (004)
-- dawn-dj        → noal     (007)
-- loop-letter    → junopark (002)
-- mood-cursor    → zeeokk   (005)
-- bento-bingo    → itoc     (006)
-- snail-mail     → vex      (008)
-- karaoke-court  → rafaeth  (003)
-- tinydraw       → kimsol   (009)
-- focusfog       → ashp     (00a)
-- pasta-db       → pip      (004)

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- LIKES (~40 rows)
-- Every app gets at least 2-3 likes from different authors.
-- Asymmetric distribution (some authors are big fans of specific apps).
-- likes_count on public.apps is already seeded in 0008; these rows drive the
-- actual join table used by the UI for "did I like this?" state.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.likes (user_id, app_id, created_at) values

  -- pixel-sushi (mila's app) — liked by 4 others
  ('aaaaaaaa-0000-0000-0000-000000000005', (select id from public.apps where slug='pixel-sushi'), now() - interval '2 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000004', (select id from public.apps where slug='pixel-sushi'), now() - interval '5 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000003', (select id from public.apps where slug='pixel-sushi'), now() - interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000007', (select id from public.apps where slug='pixel-sushi'), now() - interval '2 days'),

  -- toast-roaster (rafaeth's app) — liked by 5 others (it's featured)
  ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.apps where slug='toast-roaster'), now() - interval '3 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000002', (select id from public.apps where slug='toast-roaster'), now() - interval '6 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000005', (select id from public.apps where slug='toast-roaster'), now() - interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000008', (select id from public.apps where slug='toast-roaster'), now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-000000000009', (select id from public.apps where slug='toast-roaster'), now() - interval '3 days'),

  -- chromacalm (pip's app) — liked by 4 others
  ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.apps where slug='chromacalm'), now() - interval '4 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000003', (select id from public.apps where slug='chromacalm'), now() - interval '12 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000007', (select id from public.apps where slug='chromacalm'), now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', (select id from public.apps where slug='chromacalm'), now() - interval '4 days'),

  -- dawn-dj (noal's app) — liked by 4 others (featured)
  ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.apps where slug='dawn-dj'), now() - interval '1 hour'),
  ('aaaaaaaa-0000-0000-0000-000000000005', (select id from public.apps where slug='dawn-dj'), now() - interval '3 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000006', (select id from public.apps where slug='dawn-dj'), now() - interval '8 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000009', (select id from public.apps where slug='dawn-dj'), now() - interval '1 day'),

  -- loop-letter (junopark's app) — liked by 3 others
  ('aaaaaaaa-0000-0000-0000-000000000004', (select id from public.apps where slug='loop-letter'), now() - interval '2 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000007', (select id from public.apps where slug='loop-letter'), now() - interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000008', (select id from public.apps where slug='loop-letter'), now() - interval '3 days'),

  -- mood-cursor (zeeokk's app) — liked by 5 others (featured, most liked)
  ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.apps where slug='mood-cursor'), now() - interval '30 minutes'),
  ('aaaaaaaa-0000-0000-0000-000000000002', (select id from public.apps where slug='mood-cursor'), now() - interval '2 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000003', (select id from public.apps where slug='mood-cursor'), now() - interval '5 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000004', (select id from public.apps where slug='mood-cursor'), now() - interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000009', (select id from public.apps where slug='mood-cursor'), now() - interval '5 days'),

  -- bento-bingo (itoc's app) — liked by 3 others
  ('aaaaaaaa-0000-0000-0000-000000000002', (select id from public.apps where slug='bento-bingo'), now() - interval '4 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000005', (select id from public.apps where slug='bento-bingo'), now() - interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000007', (select id from public.apps where slug='bento-bingo'), now() - interval '2 days'),

  -- snail-mail (vex's app) — liked by 2 others
  ('aaaaaaaa-0000-0000-0000-000000000003', (select id from public.apps where slug='snail-mail'), now() - interval '6 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000006', (select id from public.apps where slug='snail-mail'), now() - interval '2 days'),

  -- karaoke-court (rafaeth's app) — liked by 3 others
  ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.apps where slug='karaoke-court'), now() - interval '3 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000005', (select id from public.apps where slug='karaoke-court'), now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', (select id from public.apps where slug='karaoke-court'), now() - interval '4 days'),

  -- tinydraw (kimsol's app) — liked by 4 others
  ('aaaaaaaa-0000-0000-0000-000000000002', (select id from public.apps where slug='tinydraw'), now() - interval '1 hour'),
  ('aaaaaaaa-0000-0000-0000-000000000004', (select id from public.apps where slug='tinydraw'), now() - interval '4 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000006', (select id from public.apps where slug='tinydraw'), now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000000008', (select id from public.apps where slug='tinydraw'), now() - interval '7 days'),

  -- focusfog (ashp's app) — liked by 2 others
  ('aaaaaaaa-0000-0000-0000-000000000002', (select id from public.apps where slug='focusfog'), now() - interval '5 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000007', (select id from public.apps where slug='focusfog'), now() - interval '18 hours'),

  -- pasta-db (pip's app) — liked by 2 others
  ('aaaaaaaa-0000-0000-0000-000000000003', (select id from public.apps where slug='pasta-db'), now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-000000000009', (select id from public.apps where slug='pasta-db'), now() - interval '5 days')

on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- COMMENTS (~30 top-level + 6 replies = 36 total)
-- 6-8 featured apps get 2-4 top-level comments each.
-- Each featured app gets at least one reply from the app's author (is_creator pill).
-- Comment UUIDs: c0000001-... through c0000024-... (top-level)
--               r0000001-... through r0000006-... (replies)
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.comments (id, app_id, author_id, parent_id, body, created_at, updated_at) values

  -- ── pixel-sushi (mila's app) ─────────────────────────────────────────────
  (
    'c0000001-0000-0000-0000-000000000001',
    (select id from public.apps where slug='pixel-sushi'),
    'aaaaaaaa-0000-0000-0000-000000000005', -- zeeokk
    null,
    'this is unhinged in the best way. the leaderboard idea is chef''s kiss 🍣',
    now() - interval '2 hours',
    now() - interval '2 hours'
  ),
  (
    'c0000002-0000-0000-0000-000000000001',
    (select id from public.apps where slug='pixel-sushi'),
    'aaaaaaaa-0000-0000-0000-000000000004', -- pip
    null,
    'okay but how did you ship this in a weekend?? the wasabi physics alone…',
    now() - interval '5 hours',
    now() - interval '5 hours'
  ),
  (
    'c0000003-0000-0000-0000-000000000001',
    (select id from public.apps where slug='pixel-sushi'),
    'aaaaaaaa-0000-0000-0000-000000000003', -- rafaeth
    null,
    'love that you put effort into the daily seed. tiny details like that are what separate jam games from real games.',
    now() - interval '1 day',
    now() - interval '1 day'
  ),
  -- reply from mila (the creator — triggers is_creator pill)
  (
    'b0000001-0000-0000-0000-000000000001',
    (select id from public.apps where slug='pixel-sushi'),
    'aaaaaaaa-0000-0000-0000-000000000001', -- mila (creator)
    'c0000002-0000-0000-0000-000000000001',
    'lots of coffee + I cheated and started 4 weekends ago 😅',
    now() - interval '4 hours',
    now() - interval '4 hours'
  ),

  -- ── toast-roaster (rafaeth's app) ────────────────────────────────────────
  (
    'c0000004-0000-0000-0000-000000000001',
    (select id from public.apps where slug='toast-roaster'),
    'aaaaaaaa-0000-0000-0000-000000000001', -- mila
    null,
    'pasted my own post and got an F tier. it was correct. 10/10.',
    now() - interval '6 hours',
    now() - interval '6 hours'
  ),
  (
    'c0000005-0000-0000-0000-000000000001',
    (select id from public.apps where slug='toast-roaster'),
    'aaaaaaaa-0000-0000-0000-000000000002', -- junopark
    null,
    'the rewrite that comes out the other end is genuinely better copy. this is your actual product.',
    now() - interval '10 hours',
    now() - interval '10 hours'
  ),
  (
    'c0000006-0000-0000-0000-000000000001',
    (select id from public.apps where slug='toast-roaster'),
    'aaaaaaaa-0000-0000-0000-000000000007', -- noal
    null,
    '"leveraging synergies" got S-tier roasted. justice.',
    now() - interval '1 day 4 hours',
    now() - interval '1 day 4 hours'
  ),
  (
    'c0000007-0000-0000-0000-000000000001',
    (select id from public.apps where slug='toast-roaster'),
    'aaaaaaaa-0000-0000-0000-000000000009', -- kimsol
    null,
    'trained on 80k cringe posts is the funniest dataset provenance I''ve read this year.',
    now() - interval '2 days',
    now() - interval '2 days'
  ),
  -- reply from rafaeth (creator)
  (
    'b0000002-0000-0000-0000-000000000001',
    (select id from public.apps where slug='toast-roaster'),
    'aaaaaaaa-0000-0000-0000-000000000003', -- rafaeth (creator)
    'c0000004-0000-0000-0000-000000000001',
    'that''s the highest praise I could ask for. the model doesn''t lie.',
    now() - interval '5 hours',
    now() - interval '5 hours'
  ),

  -- ── mood-cursor (zeeokk's app) ───────────────────────────────────────────
  (
    'c0000008-0000-0000-0000-000000000001',
    (select id from public.apps where slug='mood-cursor'),
    'aaaaaaaa-0000-0000-0000-000000000001', -- mila
    null,
    '"javascript at 3am" preset is dangerously accurate. my cursor is vibrating.',
    now() - interval '30 minutes',
    now() - interval '30 minutes'
  ),
  (
    'c0000009-0000-0000-0000-000000000001',
    (select id from public.apps where slug='mood-cursor'),
    'aaaaaaaa-0000-0000-0000-000000000003', -- rafaeth
    null,
    '4kb with no deps doing this is absurd. how.',
    now() - interval '3 hours',
    now() - interval '3 hours'
  ),
  (
    'c0000010-0000-0000-0000-000000000001',
    (select id from public.apps where slug='mood-cursor'),
    'aaaaaaaa-0000-0000-0000-000000000004', -- pip
    null,
    'dropped this on my portfolio and immediately got two DMs asking what library it was. no library. just vibes.',
    now() - interval '8 hours',
    now() - interval '8 hours'
  ),
  (
    'c0000011-0000-0000-0000-000000000001',
    (select id from public.apps where slug='mood-cursor'),
    'aaaaaaaa-0000-0000-0000-000000000002', -- junopark
    null,
    'eight presets and "office hours" is somehow the scariest one.',
    now() - interval '2 days',
    now() - interval '2 days'
  ),
  -- reply from zeeokk (creator)
  (
    'b0000003-0000-0000-0000-000000000001',
    (select id from public.apps where slug='mood-cursor'),
    'aaaaaaaa-0000-0000-0000-000000000005', -- zeeokk (creator)
    'c0000009-0000-0000-0000-000000000001',
    'a lot of trig and one very committed requestAnimationFrame. that''s the secret.',
    now() - interval '2 hours 30 minutes',
    now() - interval '2 hours 30 minutes'
  ),

  -- ── dawn-dj (noal's app) ─────────────────────────────────────────────────
  (
    'c0000012-0000-0000-0000-000000000001',
    (select id from public.apps where slug='dawn-dj'),
    'aaaaaaaa-0000-0000-0000-000000000001', -- mila
    null,
    'woke up at 5:30, opened a tab, it was already on sunrise mode. I don''t know how you did that but thank you.',
    now() - interval '1 hour',
    now() - interval '1 hour'
  ),
  (
    'c0000013-0000-0000-0000-000000000001',
    (select id from public.apps where slug='dawn-dj'),
    'aaaaaaaa-0000-0000-0000-000000000005', -- zeeokk
    null,
    '4MB RAM is a flex. my Slack tab uses 400MB and does less.',
    now() - interval '4 hours',
    now() - interval '4 hours'
  ),
  (
    'c0000014-0000-0000-0000-000000000001',
    (select id from public.apps where slug='dawn-dj'),
    'aaaaaaaa-0000-0000-0000-000000000006', -- itoc
    null,
    'the golden-hour hot-swap is seamless. I noticed the track change before I registered the sun had moved.',
    now() - interval '12 hours',
    now() - interval '12 hours'
  ),
  -- reply from noal (creator)
  (
    'b0000004-0000-0000-0000-000000000001',
    (select id from public.apps where slug='dawn-dj'),
    'aaaaaaaa-0000-0000-0000-000000000007', -- noal (creator)
    'c0000012-0000-0000-0000-000000000001',
    'sunrise times from the Sunrise-Sunset API, timezone from your IP. simple ingredients, hopefully magic output.',
    now() - interval '45 minutes',
    now() - interval '45 minutes'
  ),

  -- ── chromacalm (pip's app) ───────────────────────────────────────────────
  (
    'c0000015-0000-0000-0000-000000000001',
    (select id from public.apps where slug='chromacalm'),
    'aaaaaaaa-0000-0000-0000-000000000003', -- rafaeth
    null,
    'used this on a photo of my lunch and now my side project has a better brand than my day job.',
    now() - interval '3 hours',
    now() - interval '3 hours'
  ),
  (
    'c0000016-0000-0000-0000-000000000001',
    (select id from public.apps where slug='chromacalm'),
    'aaaaaaaa-0000-0000-0000-000000000007', -- noal
    null,
    'the Figma import is two clicks and it actually works. I''ve been burned by "two clicks" before.',
    now() - interval '1 day',
    now() - interval '1 day'
  ),
  (
    'c0000017-0000-0000-0000-000000000001',
    (select id from public.apps where slug='chromacalm'),
    'aaaaaaaa-0000-0000-0000-000000000001', -- mila
    null,
    'perceptual deltaE distance for palette extraction is the right call. colors feel balanced, not just mathematically even.',
    now() - interval '3 days',
    now() - interval '3 days'
  ),
  -- reply from pip (creator)
  (
    'b0000005-0000-0000-0000-000000000001',
    (select id from public.apps where slug='chromacalm'),
    'aaaaaaaa-0000-0000-0000-000000000004', -- pip (creator)
    'c0000015-0000-0000-0000-000000000001',
    'lunch palette branding is the use case I didn''t know I was building for. love it.',
    now() - interval '2 hours',
    now() - interval '2 hours'
  ),

  -- ── tinydraw (kimsol's app) ───────────────────────────────────────────────
  (
    'c0000018-0000-0000-0000-000000000001',
    (select id from public.apps where slug='tinydraw'),
    'aaaaaaaa-0000-0000-0000-000000000002', -- junopark
    null,
    'no account, no tracking, no onboarding — this should be in a museum of things the web used to be.',
    now() - interval '1 hour',
    now() - interval '1 hour'
  ),
  (
    'c0000019-0000-0000-0000-000000000001',
    (select id from public.apps where slug='tinydraw'),
    'aaaaaaaa-0000-0000-0000-000000000004', -- pip
    null,
    'emoji collage export is absolutely unhinged and I''ve already used it twice today.',
    now() - interval '6 hours',
    now() - interval '6 hours'
  ),
  (
    'c0000020-0000-0000-0000-000000000001',
    (select id from public.apps where slug='tinydraw'),
    'aaaaaaaa-0000-0000-0000-000000000006', -- itoc
    null,
    '8kb, no build step. this is what peak performance looks like.',
    now() - interval '2 days',
    now() - interval '2 days'
  ),

  -- ── karaoke-court (rafaeth's app) ────────────────────────────────────────
  (
    'c0000021-0000-0000-0000-000000000001',
    (select id from public.apps where slug='karaoke-court'),
    'aaaaaaaa-0000-0000-0000-000000000001', -- mila
    null,
    'I scored a C+ on Bohemian Rhapsody and the roast was accurate. I am not okay.',
    now() - interval '2 hours',
    now() - interval '2 hours'
  ),
  (
    'c0000022-0000-0000-0000-000000000001',
    (select id from public.apps where slug='karaoke-court'),
    'aaaaaaaa-0000-0000-0000-000000000005', -- zeeokk
    null,
    'the "vibe" score is doing a lot of heavy lifting and I respect it.',
    now() - interval '1 day',
    now() - interval '1 day'
  ),
  -- reply from rafaeth (creator)
  (
    'b0000006-0000-0000-0000-000000000001',
    (select id from public.apps where slug='karaoke-court'),
    'aaaaaaaa-0000-0000-0000-000000000003', -- rafaeth (creator)
    'c0000021-0000-0000-0000-000000000001',
    'C+ is passing! the judges are tough but fair. try a slower song — the pitch model is kinder at lower BPM.',
    now() - interval '1 hour 30 minutes',
    now() - interval '1 hour 30 minutes'
  ),

  -- ── loop-letter (junopark's app) ─────────────────────────────────────────
  (
    'c0000023-0000-0000-0000-000000000001',
    (select id from public.apps where slug='loop-letter'),
    'aaaaaaaa-0000-0000-0000-000000000008', -- vex
    null,
    'all processing in the browser is the only correct answer for something that touches message history. thank you.',
    now() - interval '3 hours',
    now() - interval '3 hours'
  ),
  (
    'c0000024-0000-0000-0000-000000000001',
    (select id from public.apps where slug='loop-letter'),
    'aaaaaaaa-0000-0000-0000-000000000004', -- pip
    null,
    'the friend group that doesn''t scroll but still wants to know what happened — this is for them. perfect.',
    now() - interval '2 days',
    now() - interval '2 days'
  )

on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- COMMENT LIKES (~10 rows)
-- Different authors liking specific comments.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.comment_likes (user_id, comment_id, created_at) values

  -- likes on pixel-sushi comments
  ('aaaaaaaa-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', now() - interval '1 hour 30 minutes'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'c0000001-0000-0000-0000-000000000001', now() - interval '2 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'b0000001-0000-0000-0000-000000000001', now() - interval '3 hours 30 minutes'),

  -- likes on toast-roaster comments
  ('aaaaaaaa-0000-0000-0000-000000000003', 'c0000005-0000-0000-0000-000000000001', now() - interval '9 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'c0000006-0000-0000-0000-000000000001', now() - interval '1 day 2 hours'),

  -- likes on mood-cursor comments
  ('aaaaaaaa-0000-0000-0000-000000000005', 'c0000008-0000-0000-0000-000000000001', now() - interval '20 minutes'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'c0000009-0000-0000-0000-000000000001', now() - interval '2 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'b0000003-0000-0000-0000-000000000001', now() - interval '2 hours'),

  -- likes on dawn-dj comments
  ('aaaaaaaa-0000-0000-0000-000000000003', 'c0000013-0000-0000-0000-000000000001', now() - interval '3 hours'),

  -- likes on tinydraw comments
  ('aaaaaaaa-0000-0000-0000-000000000009', 'c0000018-0000-0000-0000-000000000001', now() - interval '45 minutes')

on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- FOLLOWS (~12 rows)
-- Each author follows 1-2 others. No self-follows (DB check enforces this).
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.follows (follower_id, followee_id, created_at) values

  -- mila follows junopark + zeeokk
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', now() - interval '3 days'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', now() - interval '1 day'),

  -- junopark follows rafaeth + noal
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003', now() - interval '5 days'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000007', now() - interval '2 days'),

  -- rafaeth follows mila
  ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '4 days'),

  -- pip follows zeeokk + kimsol
  ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000005', now() - interval '6 days'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000009', now() - interval '3 days'),

  -- zeeokk follows mila + pip
  ('aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000004', now() - interval '7 days'),

  -- itoc follows junopark
  ('aaaaaaaa-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000002', now() - interval '1 day'),

  -- vex follows rafaeth + ashp
  ('aaaaaaaa-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000003', now() - interval '8 days'),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-00000000000a', now() - interval '4 days')

on conflict do nothing;

commit;

-- end migration 0011
