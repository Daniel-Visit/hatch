-- migration 0018_phase6_seed — Phase 6 sample data for visual + manual testing
-- 5 contact_requests, 3 conversations with messages, ~22 notifications, 3 user notification_prefs updates
-- Notifications bypass fan-out triggers via session_replication_role='replica' for deterministic seed state
-- All UUIDs are deterministic (prefix c0000001..c0000004) for safe re-application

begin;

-- ─── A. 5 contact_requests targeting mila (0001) for pixel-sushi ──────────────
-- pixel-sushi app id: e3636b5d-a045-481b-a594-af4ee4b65239
-- Deterministic UUIDs: c0000001-0000-0000-0000-00000000000{1..5}

insert into public.contact_requests (
  id, app_id, sender_id, recipient_id, role, note, sender_link, status, responded_at, created_at
) values
  -- 1. pending: juno → mila (investor)
  ('c0000001-0000-0000-0000-000000000001'::uuid,
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'investor',
   'Hey Mila — caught Pixel Sushi on the front page yesterday. I lead pre-seed at Slope Partners and would love 25 mins…',
   'https://linkedin.com/in/junopark',
   'pending', null,
   now() - interval '2 days'),

  -- 2. pending: rafa → mila (investor)
  ('c0000001-0000-0000-0000-000000000002'::uuid,
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'investor',
   'Played for 40 mins last night. Doing some small angel checks ($10–50k). Would you be open to a chat?',
   'https://tinycap.co',
   'pending', null,
   now() - interval '1 day 8 hours'),

  -- 3. pending: zee → mila (partner)
  ('c0000001-0000-0000-0000-000000000003'::uuid,
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000005'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'partner',
   'I''m building a similar concept and would love to swap notes.',
   null,
   'pending', null,
   now() - interval '18 hours'),

  -- 4. accepted: noa → mila (hire); conversation_id set after conversations insert
  ('c0000001-0000-0000-0000-000000000004'::uuid,
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000007'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'hire',
   'I''m scouting consumer talent — would you take a discovery chat?',
   null,
   'accepted', now() - interval '1 day',
   now() - interval '3 days'),

  -- 5. declined: vex → mila (fan)
  ('c0000001-0000-0000-0000-000000000005'::uuid,
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000008'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'fan',
   'Big fan of the project.',
   null,
   'declined', now() - interval '2 days 12 hours',
   now() - interval '4 days')

on conflict (id) do nothing;

-- ─── B. 3 conversations ───────────────────────────────────────────────────────
-- Canonical ordering: participant_a = LEAST(uuid), participant_b = GREATEST(uuid)
-- Conv 1: mila(0001) + noa(0007)   → a=0001, b=0007
-- Conv 2: rafa(0003) + pip(0004)   → a=0003, b=0004
-- Conv 3: mila(0001) + ito(0006)   → a=0001, b=0006

insert into public.conversations (
  id, participant_a, participant_b, app_id, last_message_at, created_at
) values
  ('c0000002-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000007'::uuid,
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid,
   now() - interval '4 hours',
   now() - interval '3 days'),

  ('c0000002-0000-0000-0000-000000000002'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000004'::uuid,
   null,
   now() - interval '6 hours',
   now() - interval '5 days'),

  ('c0000002-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000006'::uuid,
   'b92de6cc-178e-4b4f-b5b5-de9c352bd19c'::uuid,
   now() - interval '30 minutes',
   now() - interval '2 days')

on conflict (id) do nothing;

-- Link accepted contact_request to Conv 1
update public.contact_requests
   set conversation_id = 'c0000002-0000-0000-0000-000000000001'::uuid
 where id = 'c0000001-0000-0000-0000-000000000004'::uuid
   and conversation_id is null;

-- ─── B2. Messages ─────────────────────────────────────────────────────────────
-- Message UUID series: c0000003-0000-0000-0000-XXXXXXXXXXXX

-- Conv 1: mila(0001) + noa(0007) — 5 messages alternating noa→mila→noa→mila→noa
insert into public.messages (id, conversation_id, sender_id, body, read_at, created_at) values
  ('c0000003-0000-0000-0000-000000000001'::uuid,
   'c0000002-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000007'::uuid,
   'Hey Mila! Saw Pixel Sushi on the front page — love what you built. Would you be open to a quick chat?',
   now() - interval '2 days 20 hours',
   now() - interval '3 days'),

  ('c0000003-0000-0000-0000-000000000002'::uuid,
   'c0000002-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'Hi Noa! Thanks so much — really means a lot. Happy to chat, what did you have in mind?',
   now() - interval '2 days 12 hours',
   now() - interval '2 days 22 hours'),

  ('c0000003-0000-0000-0000-000000000003'::uuid,
   'c0000002-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000007'::uuid,
   'I scout consumer talent for early-stage companies. Not a formal thing — just a discovery call to learn more about your background and goals.',
   now() - interval '1 day 18 hours',
   now() - interval '2 days 6 hours'),

  ('c0000003-0000-0000-0000-000000000004'::uuid,
   'c0000002-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'That sounds great! I''m free Thursday after 3pm ET — does that work?',
   now() - interval '8 hours',
   now() - interval '1 day 4 hours'),

  ('c0000003-0000-0000-0000-000000000005'::uuid,
   'c0000002-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000007'::uuid,
   'Thursday 3pm ET works perfectly. I''ll send a calendar invite. Looking forward to it!',
   null,
   now() - interval '4 hours')

on conflict (id) do nothing;

-- Conv 2: rafa(0003) + pip(0004) — 7 messages (organic, no app)
insert into public.messages (id, conversation_id, sender_id, body, read_at, created_at) values
  ('c0000003-0000-0000-0000-000000000006'::uuid,
   'c0000002-0000-0000-0000-000000000002'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
   'Hey Pip — did you see mood-cursor hit 11k likes? Wild.',
   now() - interval '4 days 20 hours',
   now() - interval '5 days'),

  ('c0000003-0000-0000-0000-000000000007'::uuid,
   'c0000002-0000-0000-0000-000000000002'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000004'::uuid,
   'Yeah! Zee is killing it. Meanwhile I''m over here debugging k-means for the 4th day in a row 😭',
   now() - interval '4 days 16 hours',
   now() - interval '4 days 22 hours'),

  ('c0000003-0000-0000-0000-000000000008'::uuid,
   'c0000002-0000-0000-0000-000000000002'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
   'lol the classic. What''s the issue?',
   now() - interval '4 days 10 hours',
   now() - interval '4 days 18 hours'),

  ('c0000003-0000-0000-0000-000000000009'::uuid,
   'c0000002-0000-0000-0000-000000000002'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000004'::uuid,
   'Perceptual color distance keeps collapsing near grays. DeltaE is supposed to fix this but it''s fighting me.',
   now() - interval '3 days 18 hours',
   now() - interval '4 days 8 hours'),

  ('c0000003-0000-0000-0000-00000000000a'::uuid,
   'c0000002-0000-0000-0000-000000000002'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
   'Have you tried seeding with k-means++ instead of random init? Massive difference on low-saturation palettes.',
   now() - interval '2 days 12 hours',
   now() - interval '3 days 6 hours'),

  ('c0000003-0000-0000-0000-00000000000b'::uuid,
   'c0000002-0000-0000-0000-000000000002'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000004'::uuid,
   'Oh wow — k-means++ totally fixed it. You''re a genius, thank you!',
   now() - interval '10 hours',
   now() - interval '1 day 6 hours'),

  ('c0000003-0000-0000-0000-00000000000c'::uuid,
   'c0000002-0000-0000-0000-000000000002'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
   'ha! glad it worked. ship it 🚀',
   null,
   now() - interval '6 hours')

on conflict (id) do nothing;

-- Conv 3: mila(0001) + ito(0006) — 10 messages, app=mood-cursor
insert into public.messages (id, conversation_id, sender_id, body, read_at, created_at) values
  ('c0000003-0000-0000-0000-00000000000d'::uuid,
   'c0000002-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000006'::uuid,
   'Mila! Just saw you featured mood-cursor in your post. Genuinely made my week, thank you.',
   now() - interval '1 day 22 hours',
   now() - interval '2 days'),

  ('c0000003-0000-0000-0000-00000000000e'::uuid,
   'c0000002-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'Of course! It''s genuinely one of my fave tools on Hatch. How long did it take you to build the cursor physics?',
   now() - interval '1 day 20 hours',
   now() - interval '1 day 23 hours'),

  ('c0000003-0000-0000-0000-00000000000f'::uuid,
   'c0000002-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000006'::uuid,
   'The physics took about 2 days. Getting the velocity smoothing right without it feeling laggy was the hardest part.',
   now() - interval '1 day 18 hours',
   now() - interval '1 day 21 hours'),

  ('c0000003-0000-0000-0000-000000000010'::uuid,
   'c0000002-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'I can totally see that. The "office hours" preset is so satisfying — that soft trail is perfect.',
   now() - interval '1 day 12 hours',
   now() - interval '1 day 19 hours'),

  ('c0000003-0000-0000-0000-000000000011'::uuid,
   'c0000002-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000006'::uuid,
   'ha, that one took the most iteration. glad it lands right. Are you still working on pixel-sushi?',
   now() - interval '1 day 6 hours',
   now() - interval '1 day 14 hours'),

  ('c0000003-0000-0000-0000-000000000012'::uuid,
   'c0000002-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'Yeah! Working on a multiplayer mode — two chefs, shared kitchen. Very chaotic.',
   now() - interval '22 hours',
   now() - interval '1 day 4 hours'),

  ('c0000003-0000-0000-0000-000000000013'::uuid,
   'c0000002-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000006'::uuid,
   'That sounds incredible. Overcooked vibes but with roguelike RNG? Yes please.',
   now() - interval '20 hours',
   now() - interval '23 hours'),

  ('c0000003-0000-0000-0000-000000000014'::uuid,
   'c0000002-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'Exactly that! I''ll share an early build when it''s playable. Might be a few weeks.',
   now() - interval '4 hours',
   now() - interval '21 hours'),

  ('c0000003-0000-0000-0000-000000000015'::uuid,
   'c0000002-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000006'::uuid,
   'Would love that. I''ll be your first tester.',
   null,
   now() - interval '2 hours'),

  ('c0000003-0000-0000-0000-000000000016'::uuid,
   'c0000002-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'deal 🤝',
   null,
   now() - interval '30 minutes')

on conflict (id) do nothing;

-- Update last_message_at explicitly for determinism
update public.conversations
   set last_message_at = now() - interval '4 hours'
 where id = 'c0000002-0000-0000-0000-000000000001'::uuid;

update public.conversations
   set last_message_at = now() - interval '6 hours'
 where id = 'c0000002-0000-0000-0000-000000000002'::uuid;

update public.conversations
   set last_message_at = now() - interval '30 minutes'
 where id = 'c0000002-0000-0000-0000-000000000003'::uuid;

-- ─── C. ~22 notifications (bypass fan-out triggers) ──────────────────────────
-- Notification UUID series: c0000004-0000-0000-0000-XXXXXXXXXXXX
-- Targeting mila (0001) for most; also one to noa (0007) for contact_accepted

set session_replication_role = 'replica';

insert into public.notifications (
  id, recipient_id, actor_id, kind,
  app_id, comment_id, contact_request_id, conversation_id,
  payload, read_at, created_at
) values

  -- 5 'like' notifs to mila from juno/rafa/pip/zee/ito on pixel-sushi
  ('c0000004-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
   'like',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid, null, null, null,
   jsonb_build_object('app_slug','pixel-sushi','app_title','Pixel Sushi'),
   null,
   now() - interval '3 days'),

  ('c0000004-0000-0000-0000-000000000002'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
   'like',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid, null, null, null,
   jsonb_build_object('app_slug','pixel-sushi','app_title','Pixel Sushi'),
   now() - interval '2 days 18 hours',
   now() - interval '3 days'),

  ('c0000004-0000-0000-0000-000000000003'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000004'::uuid,
   'like',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid, null, null, null,
   jsonb_build_object('app_slug','pixel-sushi','app_title','Pixel Sushi'),
   now() - interval '2 days 12 hours',
   now() - interval '2 days 18 hours'),

  ('c0000004-0000-0000-0000-000000000004'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000005'::uuid,
   'like',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid, null, null, null,
   jsonb_build_object('app_slug','pixel-sushi','app_title','Pixel Sushi'),
   null,
   now() - interval '1 day 12 hours'),

  ('c0000004-0000-0000-0000-000000000005'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000006'::uuid,
   'like',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid, null, null, null,
   jsonb_build_object('app_slug','pixel-sushi','app_title','Pixel Sushi'),
   null,
   now() - interval '22 hours'),

  -- 2 more 'like' notifs to mila — pip + zee on another app (focusfog)
  ('c0000004-0000-0000-0000-000000000006'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000004'::uuid,
   'like',
   'e5a0c9f7-7bf1-4429-9e2e-390212b9765b'::uuid, null, null, null,
   jsonb_build_object('app_slug','focusfog','app_title','FocusFog'),
   null,
   now() - interval '1 day'),

  ('c0000004-0000-0000-0000-000000000007'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000005'::uuid,
   'like',
   'e5a0c9f7-7bf1-4429-9e2e-390212b9765b'::uuid, null, null, null,
   jsonb_build_object('app_slug','focusfog','app_title','FocusFog'),
   now() - interval '20 hours',
   now() - interval '1 day'),

  -- 4 'comment' notifs to mila from juno/rafa/pip/noa on pixel-sushi
  ('c0000004-0000-0000-0000-000000000008'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
   'comment',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid,
   'c0000002-0000-0000-0000-000000000001'::uuid,
   null, null,
   jsonb_build_object('app_slug','pixel-sushi','app_title','Pixel Sushi','comment_preview','okay but how did you ship this in a weekend??'),
   now() - interval '2 days',
   now() - interval '3 days'),

  ('c0000004-0000-0000-0000-000000000009'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
   'comment',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid,
   'c0000003-0000-0000-0000-000000000001'::uuid,
   null, null,
   jsonb_build_object('app_slug','pixel-sushi','app_title','Pixel Sushi','comment_preview','love that you put effort into the daily seed'),
   now() - interval '1 day 18 hours',
   now() - interval '2 days 12 hours'),

  ('c0000004-0000-0000-0000-00000000000a'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000004'::uuid,
   'comment',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid,
   'c0000001-0000-0000-0000-000000000001'::uuid,
   null, null,
   jsonb_build_object('app_slug','pixel-sushi','app_title','Pixel Sushi','comment_preview','this is unhinged in the best way'),
   null,
   now() - interval '1 day'),

  ('c0000004-0000-0000-0000-00000000000b'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000007'::uuid,
   'comment',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid,
   'c0000002-0000-0000-0000-000000000001'::uuid,
   null, null,
   jsonb_build_object('app_slug','pixel-sushi','app_title','Pixel Sushi','comment_preview','okay but how did you ship this in a weekend??'),
   null,
   now() - interval '10 hours'),

  -- 2 'comment_reply' notifs to mila — zee + ito replied to mila's comment
  -- mila's comment: b0000001-0000-0000-0000-000000000001
  ('c0000004-0000-0000-0000-00000000000c'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000005'::uuid,
   'comment_reply',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid,
   'b0000001-0000-0000-0000-000000000001'::uuid,
   null, null,
   jsonb_build_object('app_slug','pixel-sushi','app_title','Pixel Sushi','comment_preview','lots of coffee + I cheated and started 4 weekends ago'),
   null,
   now() - interval '8 hours'),

  ('c0000004-0000-0000-0000-00000000000d'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000006'::uuid,
   'comment_reply',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid,
   'b0000001-0000-0000-0000-000000000001'::uuid,
   null, null,
   jsonb_build_object('app_slug','pixel-sushi','app_title','Pixel Sushi','comment_preview','lots of coffee + I cheated and started 4 weekends ago'),
   null,
   now() - interval '6 hours'),

  -- 3 'follow' notifs to mila — rafa/noa/ash followed mila
  ('c0000004-0000-0000-0000-00000000000e'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
   'follow',
   null, null, null, null,
   jsonb_build_object('actor_handle','rafaeth','actor_display_name','Rafa Ortiz'),
   now() - interval '2 days 6 hours',
   now() - interval '3 days'),

  ('c0000004-0000-0000-0000-00000000000f'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000007'::uuid,
   'follow',
   null, null, null, null,
   jsonb_build_object('actor_handle','noal','actor_display_name','Noa Lindqvist'),
   now() - interval '1 day',
   now() - interval '2 days'),

  ('c0000004-0000-0000-0000-000000000010'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-00000000000a'::uuid,
   'follow',
   null, null, null, null,
   jsonb_build_object('actor_handle','ashp','actor_display_name','Ash Petrov'),
   null,
   now() - interval '4 hours'),

  -- 3 'contact_request' notifs to mila — matching juno/rafa/zee pending requests
  ('c0000004-0000-0000-0000-000000000011'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
   'contact_request',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid, null,
   'c0000001-0000-0000-0000-000000000001'::uuid,
   null,
   jsonb_build_object('role','investor','note','Hey Mila — caught Pixel Sushi on the front page yesterday. I lead pre-seed at Slope Partners and would love 25 mins…','app_slug','pixel-sushi'),
   null,
   now() - interval '2 days'),

  ('c0000004-0000-0000-0000-000000000012'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
   'contact_request',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid, null,
   'c0000001-0000-0000-0000-000000000002'::uuid,
   null,
   jsonb_build_object('role','investor','note','Played for 40 mins last night. Doing some small angel checks ($10–50k). Would you be open to a chat?','app_slug','pixel-sushi'),
   null,
   now() - interval '1 day 8 hours'),

  ('c0000004-0000-0000-0000-000000000013'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000005'::uuid,
   'contact_request',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid, null,
   'c0000001-0000-0000-0000-000000000003'::uuid,
   null,
   jsonb_build_object('role','partner','note','I''m building a similar concept and would love to swap notes.','app_slug','pixel-sushi'),
   null,
   now() - interval '18 hours'),

  -- 2 'message' notifs to mila — from noa (conv 1) and from ito (conv 3)
  ('c0000004-0000-0000-0000-000000000014'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000007'::uuid,
   'message',
   null, null, null,
   'c0000002-0000-0000-0000-000000000001'::uuid,
   jsonb_build_object('message_preview','Thursday 3pm ET works perfectly. I''ll send a calendar invite.'),
   null,
   now() - interval '4 hours'),

  ('c0000004-0000-0000-0000-000000000015'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000006'::uuid,
   'message',
   null, null, null,
   'c0000002-0000-0000-0000-000000000003'::uuid,
   jsonb_build_object('message_preview','deal 🤝'),
   null,
   now() - interval '30 minutes'),

  -- 1 'contact_accepted' notif — mila accepted noa's request; notify noa
  ('c0000004-0000-0000-0000-000000000016'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000007'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'contact_accepted',
   'e3636b5d-a045-481b-a594-af4ee4b65239'::uuid, null,
   'c0000001-0000-0000-0000-000000000004'::uuid,
   'c0000002-0000-0000-0000-000000000001'::uuid,
   jsonb_build_object('app_slug','pixel-sushi','role','hire'),
   now() - interval '22 hours',
   now() - interval '1 day')

on conflict (id) do nothing;

set session_replication_role = 'origin';

-- ─── D. Update 3 seed users' notification_prefs ──────────────────────────────

-- mila: humans-only push (messages + contact_requests; no social noise)
update public.profiles
   set notification_prefs = jsonb_build_object(
     'push_enabled',          true,
     'push_messages',         true,
     'push_contact_requests', true,
     'push_likes',            false,
     'push_follows',          false,
     'push_comments',         false
   )
 where id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;

-- juno: everything off
update public.profiles
   set notification_prefs = jsonb_build_object(
     'push_enabled',          false,
     'push_likes',            false,
     'push_follows',          false,
     'push_comments',         false,
     'push_messages',         false,
     'push_contact_requests', false
   )
 where id = 'aaaaaaaa-0000-0000-0000-000000000002'::uuid;

-- rafa: everything on
update public.profiles
   set notification_prefs = jsonb_build_object(
     'push_enabled',          true,
     'push_likes',            true,
     'push_follows',          true,
     'push_comments',         true,
     'push_messages',         true,
     'push_contact_requests', true
   )
 where id = 'aaaaaaaa-0000-0000-0000-000000000003'::uuid;

commit;
