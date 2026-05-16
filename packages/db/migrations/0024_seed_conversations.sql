-- Seed conversations on apps that had no comments, plus extend a couple of
-- existing threads. All authors are seed profiles (aaaaaaaa-…). The
-- bump_comments_count trigger will auto-update apps.comments_count.

with
  authors as (
    select
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid as mila,
      'aaaaaaaa-0000-0000-0000-000000000002'::uuid as juno,
      'aaaaaaaa-0000-0000-0000-000000000003'::uuid as rafa,
      'aaaaaaaa-0000-0000-0000-000000000004'::uuid as pip,
      'aaaaaaaa-0000-0000-0000-000000000005'::uuid as zee,
      'aaaaaaaa-0000-0000-0000-000000000006'::uuid as ito,
      'aaaaaaaa-0000-0000-0000-000000000007'::uuid as noa,
      'aaaaaaaa-0000-0000-0000-000000000008'::uuid as vex,
      'aaaaaaaa-0000-0000-0000-000000000009'::uuid as kim,
      'aaaaaaaa-0000-0000-0000-00000000000a'::uuid as ash
  ),
  app_ids as (
    select slug, id from public.apps where slug in (
      'focusfog','bento-bingo','snail-mail','pasta-db',
      'tinydraw','karaoke-court'
    )
  ),
  top_comments as (
    insert into public.comments (app_id, author_id, body, parent_id, likes_count, created_at)
    select x.app_id, x.author_id, x.body, null, x.likes, x.created_at
    from (
      values
        ((select id from app_ids where slug = 'focusfog'),
         (select juno from authors),
         'The lo-fi ambient layer is what sold me — focus timers with mood is genius. Any plans for spatial audio?',
         12, now() - interval '4 days'),
        ((select id from app_ids where slug = 'focusfog'),
         (select pip from authors),
         'Been using this for two weeks. Battery hit is minimal, which is rare for an ambient app. 🐝',
         7, now() - interval '3 days'),
        ((select id from app_ids where slug = 'focusfog'),
         (select kim from authors),
         'Would pay for a Mac menubar version honestly.',
         4, now() - interval '2 days'),

        ((select id from app_ids where slug = 'bento-bingo'),
         (select rafa from authors),
         'Played 12 rounds last night — somehow my code review patterns are now bingo-able. Send help.',
         9, now() - interval '5 days'),
        ((select id from app_ids where slug = 'bento-bingo'),
         (select ash from authors),
         'Loving the color palette. Did you sample those from a real bento or just vibes?',
         3, now() - interval '2 days'),

        ((select id from app_ids where slug = 'snail-mail'),
         (select noa from authors),
         'I miss when shipping a feature wasn''t instant. This app made me write a letter to my future self.',
         15, now() - interval '6 days'),
        ((select id from app_ids where slug = 'snail-mail'),
         (select vex from authors),
         'The 30-day delay is the killer feature. Forces you to mean it.',
         6, now() - interval '3 days'),

        ((select id from app_ids where slug = 'pasta-db'),
         (select ito from authors),
         'I cannot believe a relational DB of pasta shapes exists. I cannot believe it''s good. I cannot believe I''m commenting.',
         18, now() - interval '7 days'),
        ((select id from app_ids where slug = 'pasta-db'),
         (select mila from authors),
         'Saved. Now I have an excuse to argue with my partner about rigatoni vs paccheri.',
         5, now() - interval '4 days'),

        ((select id from app_ids where slug = 'tinydraw'),
         (select zee from authors),
         'The 32×32 canvas constraint is doing god''s work. Killed my urge to over-design 5 logos this week.',
         11, now() - interval '2 days'),

        ((select id from app_ids where slug = 'karaoke-court'),
         (select mila from authors),
         'My team tried this at offsite. We are no longer speaking to whoever picked "Mr. Brightside".',
         8, now() - interval '5 days')
    ) as x(app_id, author_id, body, likes, created_at)
    returning id, app_id, author_id, body
  ),
  replies_to_focusfog_juno as (
    insert into public.comments (app_id, author_id, body, parent_id, likes_count, created_at)
    select
      tc.app_id,
      (select pip from authors),
      'Seconding spatial audio — even just stereo widening would help.',
      tc.id,
      3,
      now() - interval '3 days'
    from top_comments tc where tc.body like 'The lo-fi ambient layer%'
    returning id
  ),
  replies_to_focusfog_juno_author as (
    insert into public.comments (app_id, author_id, body, parent_id, likes_count, created_at)
    select
      tc.app_id,
      a.author_id,
      'Spatial audio is on the roadmap! Targeting next month — needs more testing across devices.',
      tc.id,
      6,
      now() - interval '2 days 12 hours'
    from top_comments tc
    join public.apps a on a.id = tc.app_id
    where tc.body like 'The lo-fi ambient layer%'
    returning id
  ),
  replies_to_pasta as (
    insert into public.comments (app_id, author_id, body, parent_id, likes_count, created_at)
    select
      tc.app_id,
      (select rafa from authors),
      'Wait until you discover the regional sauce-pairing table. It''s contentious.',
      tc.id,
      4,
      now() - interval '6 days'
    from top_comments tc where tc.body like 'I cannot believe a relational DB%'
    returning id
  ),
  replies_to_snail as (
    insert into public.comments (app_id, author_id, body, parent_id, likes_count, created_at)
    select
      tc.app_id,
      (select mila from authors),
      'Same. Wrote one yesterday. Bracing myself.',
      tc.id,
      2,
      now() - interval '5 days'
    from top_comments tc where tc.body like 'I miss when shipping a feature%'
    returning id
  )
select 'seeded' as status;
