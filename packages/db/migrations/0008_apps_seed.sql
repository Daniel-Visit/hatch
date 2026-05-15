-- Phase 3: seed 10 demo authors + 12 apps from prototype/apps-gallery/data.js
--
-- Authors: hardcoded UUIDs aaaaaaaa-0000-0000-0000-00000000000{1..a}.
-- The handle_new_user trigger from 0001_init.sql fires on auth.users INSERT
-- and creates the matching profiles row from user_name/full_name/avatar_url.
-- The trigger uses a HASH for hue and defaults emoji to '◇' — so we UPDATE
-- profiles after insert to set the prototype's exact hue + emoji.
--
-- Apps seeded with author_id resolved via (select id from profiles where handle=...).

begin;

-- ─── 10 demo authors via auth.users (trigger creates profiles automatically) ─

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  encrypted_password, raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at
) values
  ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'mila@hatch-seed.local', now(), null,
    jsonb_build_object('user_name','mila','full_name','Mila Tanaka','avatar_url',null),
    jsonb_build_object('provider','email'), now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'juno@hatch-seed.local', now(), null,
    jsonb_build_object('user_name','junopark','full_name','Juno Park','avatar_url',null),
    jsonb_build_object('provider','email'), now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'rafa@hatch-seed.local', now(), null,
    jsonb_build_object('user_name','rafaeth','full_name','Rafa Ortiz','avatar_url',null),
    jsonb_build_object('provider','email'), now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'pip@hatch-seed.local', now(), null,
    jsonb_build_object('user_name','pip','full_name','Pip Beaumont','avatar_url',null),
    jsonb_build_object('provider','email'), now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'zee@hatch-seed.local', now(), null,
    jsonb_build_object('user_name','zeeokk','full_name','Zee Okonkwo','avatar_url',null),
    jsonb_build_object('provider','email'), now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'ito@hatch-seed.local', now(), null,
    jsonb_build_object('user_name','itoc','full_name','Ito Castellanos','avatar_url',null),
    jsonb_build_object('provider','email'), now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000007'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'noa@hatch-seed.local', now(), null,
    jsonb_build_object('user_name','noal','full_name','Noa Lindqvist','avatar_url',null),
    jsonb_build_object('provider','email'), now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000008'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'vex@hatch-seed.local', now(), null,
    jsonb_build_object('user_name','vex','full_name','Vex Romero','avatar_url',null),
    jsonb_build_object('provider','email'), now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000009'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'kim@hatch-seed.local', now(), null,
    jsonb_build_object('user_name','kimsol','full_name','Kim Solberg','avatar_url',null),
    jsonb_build_object('provider','email'), now(), now()),
  ('aaaaaaaa-0000-0000-0000-00000000000a'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'ash@hatch-seed.local', now(), null,
    jsonb_build_object('user_name','ashp','full_name','Ash Petrov','avatar_url',null),
    jsonb_build_object('provider','email'), now(), now())
on conflict (id) do nothing;

-- ─── Override hue + emoji on the auto-created profiles ────────────────────

update public.profiles set hue = 280, emoji = '🌸' where handle = 'mila';
update public.profiles set hue = 200, emoji = '🛸' where handle = 'junopark';
update public.profiles set hue =  25, emoji = '🌶️' where handle = 'rafaeth';
update public.profiles set hue = 145, emoji = '🍵' where handle = 'pip';
update public.profiles set hue = 320, emoji = '⚡' where handle = 'zeeokk';
update public.profiles set hue =  50, emoji = '🌽' where handle = 'itoc';
update public.profiles set hue = 175, emoji = '🪩' where handle = 'noal';
update public.profiles set hue =   5, emoji = '🦊' where handle = 'vex';
update public.profiles set hue = 220, emoji = '🐚' where handle = 'kimsol';
update public.profiles set hue = 100, emoji = '🍀' where handle = 'ashp';

-- ─── 12 apps from HATCH_APPS ─────────────────────────────────────────────

insert into public.apps (
  slug, author_id, title, tagline, description, link, category_id,
  art_kind, accent, tags, hue, bg, is_featured,
  likes_count, remixes_count, views_count, published_at
) values
  ('pixel-sushi', (select id from public.profiles where handle='mila'),
    'Pixel Sushi', 'A nigiri-roguelike for your lunch break. Roll, season, survive.',
    'Pixel Sushi is a tiny rogue-lite where every run is a sushi shift. Slice fish, time the rice, dodge wasabi outbreaks. 8 chefs to unlock, 40+ seed types, daily seeded runs with global leaderboards. Built in a weekend, polished for 6 months.',
    'https://hatch.dev/a/pixel-sushi', 'games',
    'pixel', '#ff7a59', array['Phaser','TypeScript','WebGL','Pixel art'],
    18, '#1a0f1a', false, 2814, 312, 42100, now() - interval '3 days'),

  ('toast-roaster', (select id from public.profiles where handle='rafaeth'),
    'Toast Roaster', 'Pastes your LinkedIn post, returns a roast. Surprisingly accurate.',
    'Trained on 80k posts flagged as "cringe" by a small group of senior engineers. Paste any thought-leadership LinkedIn post and Toast Roaster returns a tier ranking (S–F), specific critiques, and a rewrite that says the same thing in 1/4 the words.',
    'https://hatch.dev/a/toast-roaster', 'ai',
    'roast', '#f59e0b', array['GPT-4o','Next.js','Vercel AI SDK'],
    30, '#1a160a', true, 9201, 1840, 210000, now() - interval '7 days'),

  ('chromacalm', (select id from public.profiles where handle='pip'),
    'ChromaCalm', 'Drop a photo, get a 6-color palette + Tailwind config + Figma file.',
    'Upload any photo (sunset, fabric, plate of food) and ChromaCalm extracts a balanced 6-color palette using k-means with perceptual deltaE distance, then ships you a Tailwind config snippet and a Figma color-style file you can import in two clicks.',
    'https://hatch.dev/a/chromacalm', 'creative',
    'palette', '#06b6d4', array['Canvas API','Tailwind','Figma plugin'],
    175, '#04181a', false, 4502, 720, 88000, now() - interval '14 days'),

  ('dawn-dj', (select id from public.profiles where handle='noal'),
    'Dawn DJ', 'A lofi radio that follows your timezone. Plays sunrise music at sunrise.',
    'Dawn DJ checks your timezone, sunrise/sunset times, and weather, then auto-selects from a 400-track library of mood-tagged lofi. Hot-swaps tracks at golden hour. Works as a background tab; uses 4MB of RAM.',
    'https://hatch.dev/a/dawn-dj', 'music',
    'dj', '#ec4899', array['Web Audio API','Cloudflare Workers'],
    320, '#1a081a', true, 6120, 240, 134000, now() - interval '4 days'),

  ('loop-letter', (select id from public.profiles where handle='junopark'),
    'Loop Letter', 'Turns your group chats into a weekly newsletter. Privacy-first.',
    'Connect a Signal or WhatsApp export and Loop Letter summarizes the week into a digest your less-online friends can actually read. All processing happens locally in your browser — no message ever touches a server.',
    'https://hatch.dev/a/loop-letter', 'productivity',
    'letter', '#3b82f6', array['WASM','IndexedDB','React'],
    200, '#0a0f1a', false, 1820, 95, 24000, now() - interval '5 days'),

  ('mood-cursor', (select id from public.profiles where handle='zeeokk'),
    'Mood Cursor', 'A cursor that reacts to scroll speed. Slow = calm. Fast = chaos.',
    'A 4kb script you drop on any page. The cursor leaves a trail whose hue, length, and wobble respond to scroll velocity, click rhythm, and viewport time. Eight presets from "office hours" to "javascript at 3am".',
    'https://hatch.dev/a/mood-cursor', 'tools',
    'cursor', '#a855f7', array['Canvas','No deps','4kb'],
    280, '#160820', true, 11200, 2400, 380000, now() - interval '12 days'),

  ('bento-bingo', (select id from public.profiles where handle='itoc'),
    'Bento Bingo', 'Generates a 5x5 workout bingo. Friends compete to fill the card first.',
    'Pick a workout style (calisthenics, mobility, run intervals, climbing). Bento Bingo generates a 5x5 card with 25 challenges scaled to your level. Share a link, friends get the same card, first to bingo wins.',
    'https://hatch.dev/a/bento-bingo', 'creative',
    'bingo', '#eab308', array['Svelte','Konva'],
    50, '#1a1604', false, 980, 60, 14000, now() - interval '2 days'),

  ('snail-mail', (select id from public.profiles where handle='vex'),
    'Snail Mail', 'Schedule emails to arrive at deliberately inconvenient times.',
    'You shouldn''t send that email at midnight. Snail Mail queues it for Tuesday at 10:14am — a time chosen by an algorithm that maximizes reply rate based on 2 years of public email metadata research. Or pick "in 3 weeks, when you''ve forgotten".',
    'https://hatch.dev/a/snail-mail', 'productivity',
    'snail', '#f43f5e', array['Gmail API','Hono','Bun'],
    8, '#1a0608', false, 540, 22, 8200, now() - interval '6 days'),

  ('karaoke-court', (select id from public.profiles where handle='rafaeth'),
    'Karaoke Court', 'AI judges your friends'' singing. The Simon, Paula, and Randy are all you.',
    'Karaoke Court listens via mic, scores pitch + timing + vibe, and serves up a roast in the voice of three judges. Works with any YouTube karaoke link. Leaderboard per group.',
    'https://hatch.dev/a/karaoke-court', 'ai',
    'karaoke', '#f472b6', array['Whisper','Pitch.js','Supabase'],
    340, '#1a0814', false, 3120, 410, 54000, now() - interval '9 days'),

  ('tinydraw', (select id from public.profiles where handle='kimsol'),
    'Tinydraw', '8×8 pixel pad. Export as SVG, PNG, or copy-pasta emoji art.',
    'A no-account, no-tracking, no-onboarding 8×8 pixel pad. Click to fill, drag to paint, shift-click to erase. Export modes: SVG, transparent PNG, ASCII, emoji collage. One screen, one purpose.',
    'https://hatch.dev/a/tinydraw', 'creative',
    'tinydraw', '#60a5fa', array['Vanilla JS','8kb','No build'],
    220, '#040a1a', false, 7200, 1100, 160000, now() - interval '21 days'),

  ('focusfog', (select id from public.profiles where handle='ashp'),
    'FocusFog', 'Blurs everything except where your eyes are looking. Webcam-based.',
    'Uses your webcam to estimate gaze and applies a soft blur to the rest of your screen. Reduces tab-switching by ~40% in a small self-reported study (n=12, my friends). Runs locally; no data leaves the browser.',
    'https://hatch.dev/a/focusfog', 'productivity',
    'fog', '#10b981', array['MediaPipe','WebGL','Local-only'],
    145, '#04181a', false, 2200, 180, 36000, now() - interval '1 day'),

  ('pasta-db', (select id from public.profiles where handle='pip'),
    'Pasta DB', 'Rate every pasta you''ve eaten. Find the global #1. (It''s gemelli.)',
    'A pure delight of a database. Log a pasta, rate sauce-fit, texture, regional accuracy. See global leaderboards by shape, sauce, and city. Currently 14k entries, 280 shapes. Yes, you can argue about whether gnocchi counts.',
    'https://hatch.dev/a/pasta-db', 'data',
    'pasta', '#fb923c', array['Astro','Turso','D3'],
    35, '#1a0e04', false, 1450, 88, 22000, now() - interval '11 days')
on conflict (slug) do nothing;

commit;
