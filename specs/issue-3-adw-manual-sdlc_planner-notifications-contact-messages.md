# Feature: Notifications, contact requests, messages inbox, Web Push (Pair 3 = Phases 6 + 7)

## Metadata

issue_number: `3`
adw_id: `manual`
issue_json: `Feature`

## Feature Description

Layer the full notification + contact + messaging surface on top of the social/publish slice shipped in Pair 2 (Phases 4 + 5). Two roadmap phases fused into one spec/PR — same pattern Pair 1 used for Phases 2+3 and Pair 2 used for Phases 4+5:

- **Phase 6 — Contact + notifications + bell + Web Push**: `contact_requests`, `notifications`, `push_subscriptions` tables; Postgres triggers fan out `like / comment / follow / contact_request` events into `notifications`; Supabase Realtime broadcasts new rows to a per-user channel; topbar bell + dropdown + toast + `/notifications` page; `/settings/notifications` push toggle; VAPID Web Push fired from server actions for the 2 push-eligible kinds (`contact_request`, `message`).
- **Phase 7 — Messages / Inbox**: `conversations`, `messages` tables; `find_or_create_conversation` SECURITY DEFINER function (called only after a contact request is accepted, never directly client-side); Slack-style 2-pane inbox at `/messages` with conversation list left + thread right; per-thread Realtime channel; Cmd+Enter to send; optimistic UI on `sendMessage`.

**Why combined**: `SPEC.md §4.6 + §4.7` already designs contact_requests + conversations + messages + notifications as one coupled schema slice (notifications references contact_requests AND conversations via FKs). The prototype `contact.jsx` already ships `<NotificationsPanel>` titled "Inbox" + `<ContactModal>` + `<NotificationItem>` ready to verbatim-port. `shell.jsx:25,67` exposes an `onBell + unread` slot in the topbar already — Pair 1's port skipped that slot because there was no backend then; this batch wires it. Splitting Phase 6 from Phase 7 would create artificial seams across one notification fan-out domain.

**Hard, non-negotiable rule** (per `feedback_prototype_is_spec` memory + `.claude/rules/prototype-port-exception.md`): the 3 components ported from `contact.jsx` (`NotificationsPanel`, `NotificationItem`, `ContactModal`) MUST match the prototype byte-for-byte — same `className` strings, same JSX structure, same inline `style={{...}}` props, same icon names, same English copy. Pixel-perfect screenshot diff against the standalone prototype HTML is part of acceptance. Surfaces NOT in the prototype but living under `apps/web/app/_components/` (bell, toast wrapper, push prompt, service-worker registrar, realtime hooks) use plain CSS classes defined in the NEW file `apps/web/app/styles/phase6.css` — NOT Tailwind utility classes — because `no_tailwind_in_prototype_port.py` blanket-blocks Tailwind on every `.tsx` under `_components/`. Surfaces outside `_components/` (the route pages `/notifications`, `/messages`, `/settings/notifications`) DO follow Tailwind utility-class rules per `.claude/rules/frontend-components.md`. The phase6.css classes inherit prototype tokens (`--c-text`, `--c-bg`, `--c-border`, `--c-accent`) for visual consistency.

## User Story

As a **signed-in builder browsing Hatch**,
I want to **see a live bell badge when someone likes / comments / follows / contacts me, accept or decline contact requests, exchange messages with people whose contact requests I accepted, and (opt-in) receive native browser notifications when contacted off-site**,
So that **I never miss a high-signal event (a real human reaching out) but I'm not spammed by low-signal events (likes / follows)**.

As an **app owner who receives an investor contact request**,
I want to **read the requester's full note, role, link, and contact info in one bell-dropdown card and accept with one click to open a conversation thread**,
So that **the consent flow is explicit and the message inbox only contains people I deliberately opted into talking with**.

## Problem Statement

After Pair 2 merges, the platform has full social interactions but every event evaporates the moment the action completes — there is no inbox, no bell, no way to ever know that someone liked your app or wants to contact you. The topbar's `onBell` slot exists in the ported `shell.jsx` source but Pair 1 deliberately omitted it. There is no `/notifications` route, no `/messages` route, no `/settings/notifications` route. There is no `contact_requests` / `conversations` / `messages` / `notifications` / `push_subscriptions` schema. Without these, Hatch is a one-way broadcast tool — builders can publish but cannot talk back, defeating the "community gallery for builders" thesis.

## Solution Statement

1. **Migrations** (5 new files in `packages/db/migrations/`, applied via Supabase MCP `apply_migration` tool — never CLI):
   - `0013_contact_requests.sql` — `contact_role` enum (investor/partner/hire/fan), `contact_status` enum (pending/accepted/declined/expired), `contact_requests` table with `conversation_id uuid` (FK added later in 0014 after `conversations` exists). Per SPEC §4.6 verbatim.
   - `0014_conversations_messages.sql` — `conversations` (canonical order `participant_a < participant_b`, UNIQUE index on the pair), `messages` (body length 1..4000), `messages_bump_conversation` AFTER INSERT trigger (updates `conversations.last_message_at`), `find_or_create_conversation(user_a, user_b, app)` SECURITY DEFINER function, plus the deferred FK `contact_requests.conversation_id REFERENCES conversations(id) ON DELETE SET NULL`. Per SPEC §4.6 verbatim.
   - `0015_notifications.sql` — `notif_kind` enum (8 kinds: contact_request / contact_accepted / contact_declined / like / comment / comment_reply / follow / message), `notifications` table with FKs to apps, comments, contact_requests, conversations, indexes on `(recipient_id, created_at desc)` and `(recipient_id) WHERE read_at IS NULL`. Six fan-out triggers (one per source table event): `notify_on_like_insert`, `notify_on_comment_insert`, `notify_on_follow_insert`, `notify_on_contact_request_insert`, `notify_on_contact_request_update` (for status → accepted / declined), `notify_on_message_insert`. Each trigger snapshots a relevant `payload jsonb` (e.g., comment body, contact note) so the bell text doesn't drift after edits. Self-notification suppression (don't notify yourself when you like your own app, comment on your own app, etc.). Per SPEC §4.7.
   - `0016_push_subscriptions.sql` — `push_subscriptions` table (`user_id, endpoint UNIQUE per user, p256dh, auth, user_agent, created_at`). No new column on `profiles` — `notification_prefs jsonb` already exists in `0001_init.sql` line 19 with default `{"push_enabled": false, "push_likes": false, "push_follows": false, "push_comments": true, "push_messages": true, "push_contact_requests": true}` per the supabase expert's snapshot.
   - `0017_phase6_rls.sql` — RLS for all 5 new tables (contact_requests, conversations, messages, notifications, push_subscriptions) verbatim from SPEC §5.2. Crucial: `conversations` has NO client-side INSERT policy (creation is only via the SECURITY DEFINER `find_or_create_conversation` function called from server actions after consent). `messages` has a split UPDATE policy so the recipient can flip `read_at` but only the sender can edit body (the column-level restriction is enforced in app code, RLS just gates the row).
2. **Regenerate** `apps/web/lib/supabase/types.ts` via Supabase MCP `generate_typescript_types` after all migrations apply.
3. **Zod schemas** (5 new files in `apps/web/lib/zod/`): `contact-requests.ts`, `messages.ts`, `notifications.ts`, `push.ts`, `notification-prefs.ts`.
4. **Server actions** (5 new files in `apps/web/lib/actions/`):
   - `contact-requests.ts`: `sendContactRequest`, `acceptContactRequest` (calls `find_or_create_conversation` via RPC, updates status, returns conversation slug for redirect), `declineContactRequest`. Each action ALSO calls `pushToUser(recipientId, {...})` for push-eligible kinds (`contact_request`, `contact_accepted`, `contact_declined` — wait, scope says push only for `contact_request` + `message`. Re-confirming: push fires only on the INITIAL contact_request creation and on new messages; accept / decline transitions only fire bell + toast, not push).
   - `messages.ts`: `sendMessage(conversationId, body)`, `markConversationRead(conversationId)`. `sendMessage` calls `pushToUser` if `notification_prefs.push_messages = true` for the recipient.
   - `notifications.ts`: `markNotificationRead(id)`, `markAllRead()`, `getNotifications(filter, cursor)` for the `/notifications` page server-side pagination.
   - `push.ts`: `subscribeToPush(subscription)` (writes a row to `push_subscriptions`), `unsubscribeFromPush(endpoint)` (deletes by endpoint). The server-side send helper `pushToUser(userId, payload)` lives in `apps/web/lib/push/server.ts` (not exported as a server action — internal only).
   - `notification-prefs.ts`: `updateNotificationPrefs(prefsDelta)` (deep-merges into `profiles.notification_prefs`).
5. **Web Push library wiring** (`apps/web/lib/push/`):
   - `server.ts` — `pushToUser(userId, payload)` using the `web-push` npm package (new dep). Reads `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `process.env.VAPID_PRIVATE_KEY`, fetches all `push_subscriptions` rows for the user, sends in parallel, on `statusCode === 410` deletes the stale subscription.
   - `client.ts` — `subscribeToBrowserPush()` calls `Notification.requestPermission()`, then `navigator.serviceWorker.register('/sw.js')`, then `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` (decoded VAPID public key), then posts the subscription to the `subscribeToPush` server action.
   - `apps/web/public/sw.js` — service worker (hand-written, no compilation): `push` event → `showNotification(payload.title, { body, icon, badge, data: { url } })`. `notificationclick` event → close + focus existing tab matching `data.url` or open new window. `pushsubscriptionchange` event → re-subscribe and POST new subscription to `/api/push/refresh` (a simple route handler that calls `subscribeToPush`).
6. **UI components — VERBATIM PORTS** (3 new files in `apps/web/app/_components/`, all under `.claude/rules/prototype-port-exception.md`):
   - `notifications-panel.tsx` — verbatim port from `prototype/apps-gallery/contact.jsx:332-380` (title "Inbox", tab bar "All / Contact requests" with counts, mark-all-read button, list of `<NotificationItem>`, footer "Only people you accept can email you. Decline keeps your inbox tidy."). Replace the prototype's `useState` for `tab` with a controlled prop OR keep local state (port preserves behavior).
   - `notification-item.tsx` — verbatim port from `prototype/apps-gallery/contact.jsx:256-330` (two render branches: `kind === 'contact'` full card with accept/decline buttons + role pill + note + contact info; else mini-row with avatar + text + when). The accept/maybe-later/decline buttons wire to `acceptContactRequest` / no-op / `declineContactRequest` server actions via the `onAction` callback (parent decides what `onAction(id, 'accept'|'later'|'decline')` does).
   - `contact-modal.tsx` — verbatim port from `prototype/apps-gallery/contact.jsx:23-220` (3-stage flow: compose | done; compose has role picker, message textarea max 400 chars, link input, consent checkbox, send button; done has success card with role pill, note preview, footer). Wire submit to `sendContactRequest` server action; on success transition to `done` stage. RHF + Zod NOT used here — the prototype uses uncontrolled `useState` per field; preserve. The textarea / inputs ARE controlled (`useState`) per prototype — that's fine.
7. **UI components — NEW (no Tailwind — `no_tailwind_in_prototype_port.py` blanket-blocks `_components/*.tsx`)**: these live in `apps/web/app/_components/` alongside the ported components for cohesion with `shell.tsx`. They use plain CSS class names defined in a new file `apps/web/app/styles/phase6.css` (imported in `layout.tsx` after `prototype-contact.css`). Classes added: `.bell-btn`, `.bell-badge`, `.notifs-anchor` (positioning wrapper for the panel), `.push-prompt`, `.push-prompt-actions`. Sonner's `<Toaster />` uses its own CSS so no class invented. The `service-worker-registrar` renders null. No Tailwind utility class appears anywhere in these files — the prototype-port validator enforces this implicitly.
   - `notifications-bell.tsx` ('use client'): button with `aria-label="Notifications"`, badge counter (showing `unread` count, hidden when 0), `useState` for `open`. When open, renders `<NotificationsPanel>` with the user's last 20 notifs. Uses `useRealtimeNotifs` hook to live-update unread + the list. Renders inside `Shell`'s `bell` slot.
   - `notification-toast.tsx` — wraps `sonner` `<Toaster />`. New dep `sonner` (single ~3 KB import). Mounted at root layout.
   - `push-permission-prompt.tsx` ('use client'): small inline banner that renders ONLY if `Notification.permission === 'default'` AND user has `notification_prefs.push_enabled === false` AND user is signed in. "Get notified about contact requests" + "Enable" / "Not now" buttons.
   - `use-unread-title.ts` ('use client'): hook `useUnreadTitle(unreadCount, baseTitle = 'Hatch')` — sets `document.title = unreadCount > 0 ? \`(${unreadCount}) ${baseTitle}\` : baseTitle`in`useEffect([unreadCount])`. Tear-down restores baseTitle on unmount.
   - `use-realtime-notifs.ts` ('use client'): subscribes to `supabase.channel('notifs:' + userId)` listening to `postgres_changes` (`event: 'INSERT', schema: 'public', table: 'notifications', filter: 'recipient_id=eq.' + userId`). On each insert: prepends to local state, increments unread count, fires `sonner.toast(...)` based on `kind` per SPEC roadmap §5.3 surfacing rules (e.g., `like` → no toast; `contact_request` → high-priority toast; `message` → toast only if currently NOT in `/messages/{id}` for that conversation).
   - `use-realtime-thread.ts` ('use client'): subscribes to `supabase.channel('msgs:' + conversationId)` listening to `postgres_changes` filtered by `conversation_id=eq.{id}`. Auto-unsubscribes on unmount. Used inside `/messages/[conversationId]/message-thread.tsx`.
8. **Routes — `/notifications`** (`apps/web/app/notifications/`):
   - `page.tsx` (RSC, signed-in only — call `requireUser()` and redirect to `/sign-in?next=/notifications` if anon): fetch first page (20 rows) via the `getNotifications` server action with cursor pagination. Hand to client component.
   - `_components/notifications-page.tsx` ('use client'): filter tabs (All / Unread / Contact / Messages / Social), infinite scroll via cursor, optimistic mark-as-read on click. Uses `useRealtimeNotifs` to live-prepend new rows. PLAN-APPROVAL gate — this component owns both filtering UX and realtime hydration; cross-cutting.
9. **Routes — `/messages`** (`apps/web/app/messages/`):
   - `page.tsx` (RSC, signed-in only): fetch conversations the user participates in (`participant_a = uid OR participant_b = uid`), ordered by `last_message_at desc nulls last`, with last message preview + unread count per conversation. Render `<ConversationsList>` + empty state on the right pane.
   - `[conversationId]/page.tsx` (RSC): fetch the conversation (RLS auto-filters to participants), fetch last 50 messages ordered by `created_at desc`, fetch the other participant's profile for the header. Hand to client component.
   - `_components/conversations-list.tsx` ('use client'): left pane of the 2-pane layout — list of conversations with avatar + other participant name + last message preview + timestamp + unread badge. Selected conversation highlighted via URL state (`pathname === '/messages/' + id`).
   - `[conversationId]/_components/message-thread.tsx` ('use client'): right pane — header (other participant avatar + handle + role/firm if from accepted contact_request), scrollback (auto-scroll to bottom on mount + on new message), compose textarea + Send button + Cmd+Enter shortcut. `sendMessage` server action with `useOptimistic` (instant local push of the new message bubble; rollback on error). PLAN-APPROVAL gate — owns realtime sub + optimistic UI + scroll management.
10. **Routes — `/settings/notifications`** (`apps/web/app/settings/notifications/page.tsx`):
    - RSC + RHF client form. Master toggle "Enable browser notifications" — if turning ON, calls `subscribeToBrowserPush()` client-side; if turning OFF, calls `unsubscribeFromBrowserPush()`. Per-kind toggles (push_likes, push_follows, push_comments, push_messages, push_contact_requests) only enabled if master is on. Save calls `updateNotificationPrefs` server action.
11. **Layout wiring** (`apps/web/app/layout.tsx`):
    - Pass `<NotificationsBell userId={result.user.id} initialUnread={initialUnread} />` to `<Shell>` as the new `bell` prop. Pre-fetch the unread count server-side (one count query: `SELECT count(*) FROM notifications WHERE recipient_id = uid AND read_at IS NULL`). Mount `<NotificationToast />` (sonner Toaster) at root.
12. **Shell modification** (`apps/web/app/_components/shell.tsx`):
    - Add `bell?: React.ReactNode` prop AFTER `theme` props. Render `{bell}` between the theme-toggle button and the me-btn — verbatim from `prototype/apps-gallery/shell.jsx:67`. This is the only edit to a port-exception file and matches the prototype source exactly. The `unread` prop is NOT needed at Shell level since `NotificationsBell` manages its own badge state.
13. **Contact button wiring** (`apps/web/app/a/[slug]/_components/contact-cta.tsx` — new client component):
    - The detail page's `.author-side` already has a "Contact me" button rendered as a stub from Pair 2. Replace the stub with a client component that opens `<ContactModal>` controlled by local state. Pass the app + author into the modal. The detail page itself (`apps/web/app/a/[slug]/page.tsx`) is mostly RSC — keep that, just mount the new client wrapper.
14. **Service worker registration**: a one-liner script in root layout (or a `<ServiceWorkerRegistrar>` client component) that calls `navigator.serviceWorker.register('/sw.js')` on first client mount if signed in and `notification_prefs.push_enabled === true`. The actual subscribe-to-push flow happens lazily from the master toggle in `/settings/notifications`.
15. **Env**: add to `.env.sample`:
    ```
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=
    VAPID_PRIVATE_KEY=
    ```
    Document in README that user generates via `npx web-push generate-vapid-keys` (already done by the user — values already in `apps/web/.env.local`).
16. **Seed data** (`packages/db/migrations/0018_phase6_seed.sql`): 5-10 sample contact_requests, 3-5 sample accepted-conversations with 5-15 messages each, 20-30 sample notifications across the 8 kinds (using existing seed users `aaaaaaaa-0000-0000-0000-000000000001` through `00000000000a`). Without this, the bell + /notifications + /messages screens render empty and the screenshot diff fails.

The two locked design decisions from brainstorm that drive most file shapes:

- **Realtime topology = two channels**: one global `notifs:{userId}` for the bell/toast/page hydration; one per-thread `msgs:{conversationId}` only when the user is inside the thread route. Implementation: `postgres_changes` listeners with RLS-auto-filtering (recipient = auth.uid for notifs; participants for messages).
- **Fan-out = triggers + actions**: Postgres triggers handle the DB-derivable side (every event that creates a row in likes/comments/follows/contact_requests/messages auto-inserts the matching row in notifications). Server actions on top fire Web Push HTTP requests only for `contact_request` and `message` kinds — humano-a-humano only.

## Relevant Files

### Existing files (read for reference)

- `SPEC.md` (lines 499-620 for §4.6 + §4.7 schema; lines 750-790 for §5.2 RLS policies) — authoritative schema source, copy DDL verbatim.
- `docs/superpowers/specs/2026-05-15-hatch-roadmap-maestro-design.md` (§5.1-5.5) — notifications redesign, Web Push setup, per-kind surfacing rules.
- `prototype/apps-gallery/contact.jsx` (full file, 383 lines) — source for the 3 verbatim ports (`<ContactModal>` lines 23-220, `<NotificationItem>` lines 256-330, `<NotificationsPanel>` lines 332-380).
- `prototype/apps-gallery/shell.jsx` (lines 23-72) — confirms `onBell` is a ReactNode slot between theme-toggle and me-btn.
- `prototype/apps-gallery/Hatch - Apps Gallery.html` — standalone visual spec (bundles all prototype CSS for diff comparison).
- `apps/web/app/styles/prototype-contact.css` — already imported in `apps/web/app/layout.tsx`; contains all `.notifs`, `.notif-item`, `.cmodal*`, `.cm-*` styles needed by the ported components. DO NOT modify (css_verbatim_validator blocks).
- `apps/web/app/_components/shell.tsx` (line 65 `<nav className="topbar-actions">`) — insertion point for the `{bell}` slot at line 84 (between theme-toggle and me-btn).
- `apps/web/app/layout.tsx` — root layout, where `<Shell>` mounts and `<NotificationsBell>` will be passed as the `bell` prop.
- `apps/web/lib/auth.ts` — `getUser()` and `requireUser()` helpers; pattern for server-side auth in routes and actions.
- `apps/web/lib/supabase/server.ts` — `createSupabaseServerClient()`; used in RSC + server actions.
- `apps/web/lib/supabase/client.ts` — `createSupabaseBrowserClient()`; used in client components for realtime subscriptions.
- `apps/web/lib/actions/like.ts` (lines 1-42) — exact pattern to follow for new server actions: `'use server'` directive, `requireUser()` with try/catch returning `{ok:false,error:'unauthorized'}`, Zod parse, Supabase client, `revalidatePath()`, return `{ok:true,data:...}` shape.
- `apps/web/lib/actions/comment.ts` — pattern for actions that touch multiple tables (depth check, multi-step writes).
- `apps/web/lib/zod/social.ts` — pattern for Zod schemas: `z.object({...})` + `z.infer<typeof X>` type alias.
- `packages/db/migrations/0009_social.sql` — migration formatting pattern: header comment with source ref, `create table if not exists`, indexes, trigger functions, AFTER INSERT triggers.
- `packages/db/migrations/0010_social_rls.sql` — RLS migration pattern: `alter table enable row level security`, `drop policy if exists` for re-runnability, `create policy` blocks with `for select using (...)` and `for insert with check (...)`.
- `packages/db/migrations/0001_init.sql` (line 19) — confirms `profiles.notification_prefs jsonb` default already includes the 6 push keys; no schema change needed there.
- `specs/issue-2-adw-manual-sdlc_planner-social-and-publish.md` — template structure for this spec (waves, plan-approval gates, validation commands, RLS checklist).
- `.claude/agents/team/db-agent.md` — existing DB specialist used in Pair 2; reuse without modification.
- `.claude/agents/team/ui-port-agent.md` — existing verbatim-port specialist; reuse without modification.
- `.claude/agents/team/ui-validator.md` — existing E2E validator; reuse without modification.
- `.claude/rules/prototype-port-exception.md` — defines which files are under the byte-for-byte rule. Will need a minor update to add the 3 newly-ported files.
- `.claude/rules/frontend-components.md` — Tailwind rules for the new (non-port-exception) surfaces.
- `.claude/hooks/validators/migration_validator.py`, `rls_enabled_validator.py`, `css_verbatim_validator.py`, `no_tailwind_in_prototype_port.py`, `no_data_js_import.py` — existing validators, all reused.

### New files

**Migrations** (in `packages/db/migrations/`):

- `0013_contact_requests.sql` — enums + table; deferred FK to conversations added in 0014.
- `0014_conversations_messages.sql` — conversations + messages + bump trigger + `find_or_create_conversation` fn + deferred FK from contact_requests.
- `0015_notifications.sql` — notif_kind enum + notifications table + 6 fan-out triggers.
- `0016_push_subscriptions.sql` — push_subscriptions table only (notification_prefs already exists in profiles).
- `0017_phase6_rls.sql` — RLS on all 5 new tables verbatim from SPEC §5.2.
- `0018_phase6_seed.sql` — sample notifs / contact_requests / conversations / messages for visual validation.

**Zod schemas** (in `apps/web/lib/zod/`):

- `contact-requests.ts` — `ContactRequestCreate` (appId, recipientId, role, note ≤400, link?, consent), `ContactRequestRespond` (requestId, action: 'accept'|'decline').
- `messages.ts` — `MessageSend` (conversationId, body 1..4000), `ConversationMarkRead` (conversationId).
- `notifications.ts` — `NotificationRead` (id), `NotificationFilter` (kind?, unreadOnly?, cursor?).
- `push.ts` — `PushSubscribeInput` (endpoint, keys: {p256dh, auth}, userAgent?), `PushUnsubscribeInput` (endpoint).
- `notification-prefs.ts` — `NotificationPrefsUpdate` (partial object of the 6 boolean keys).

**Server actions** (in `apps/web/lib/actions/`):

- `contact-requests.ts` — `sendContactRequest`, `acceptContactRequest`, `declineContactRequest`.
- `messages.ts` — `sendMessage`, `markConversationRead`.
- `notifications.ts` — `markNotificationRead`, `markAllRead`, `getNotifications`.
- `push.ts` — `subscribeToPush`, `unsubscribeFromPush`.
- `notification-prefs.ts` — `updateNotificationPrefs`.

**Web Push library** (in `apps/web/lib/push/`):

- `server.ts` — `pushToUser(userId, payload)` using `web-push` npm package.
- `client.ts` — `subscribeToBrowserPush()`, `unsubscribeFromBrowserPush()`, `urlBase64ToUint8Array(base64)` helper.

**Service worker**:

- `apps/web/public/sw.js` — hand-written, vanilla JS, `push` + `notificationclick` + `pushsubscriptionchange` event handlers.

**UI components — verbatim ports** (in `apps/web/app/_components/`, port-exception applies):

- `notifications-panel.tsx`
- `notification-item.tsx`
- `contact-modal.tsx`

**UI components — new** (in `apps/web/app/_components/`, NO Tailwind — plain CSS classes from `phase6.css`. `no_tailwind_in_prototype_port.py` blanket-blocks Tailwind on all `_components/*.tsx`. `notification-toast.tsx` (sonner Toaster) and `service-worker-registrar.tsx` (renders null) ship zero classNames so they're exempt by construction):

- `notifications-bell.tsx`
- `notification-toast.tsx`
- `push-permission-prompt.tsx`
- `service-worker-registrar.tsx`
- `use-unread-title.ts`
- `use-realtime-notifs.ts`
- `use-realtime-thread.ts`

**Routes**:

- `apps/web/app/notifications/page.tsx` (RSC)
- `apps/web/app/notifications/_components/notifications-page.tsx` ('use client')
- `apps/web/app/messages/page.tsx` (RSC)
- `apps/web/app/messages/_components/conversations-list.tsx` ('use client')
- `apps/web/app/messages/_components/empty-thread.tsx`
- `apps/web/app/messages/[conversationId]/page.tsx` (RSC)
- `apps/web/app/messages/[conversationId]/_components/message-thread.tsx` ('use client')
- `apps/web/app/settings/notifications/page.tsx` (RSC + RHF client form)
- `apps/web/app/settings/notifications/_components/notifications-form.tsx` ('use client')
- `apps/web/app/a/[slug]/_components/contact-cta.tsx` ('use client') — wraps `<ContactModal>` and renders the "Contact me" trigger button on the detail page.

**Custom validators**:

- `.claude/hooks/validators/no_vapid_private_in_client.py` — PostToolUse on Write|Edit; blocks if `VAPID_PRIVATE_KEY` appears in a file that also contains `'use client'` directive.

**Rules update**:

- `.claude/rules/prototype-port-exception.md` — add the 3 newly-ported files to the scope list.

## Expert Context

Consulted before drafting this plan:

- **supabase** (`.claude/commands/experts/supabase/expertise.yaml`) — confirmed `profiles.notification_prefs jsonb` already exists in `0001_init.sql` with the 6 push-prefs default. Confirmed migration workflow: `mcp__supabase__apply_migration` (never `supabase db push` / CLI). Confirmed `apps/web/lib/supabase/types.ts` is regenerated via `mcp__supabase__generate_typescript_types`, never hand-edited. Project ref: `vcbdtjjkkwryvmqbflah`.
- **nextjs** (`.claude/commands/experts/nextjs/expertise.yaml`) — confirmed App Router layout: `apps/web/app/`, RSC default, `'use client'` only when needed, server actions in `apps/web/lib/actions/`, Zod schemas in `apps/web/lib/zod/`. Confirmed Supabase server client (`createSupabaseServerClient`) for RSC + actions, browser client (`createSupabaseBrowserClient`) for client components incl. Realtime subscriptions. Auth helpers: `getUser()` / `requireUser()` in `apps/web/lib/auth.ts`.
- **database** (implicit via SPEC.md §4.6+4.7+5.2) — schema DDL is copied verbatim from SPEC; no novel design.
- **testing** — confirmed no Vitest/Jest in this repo; validation = typecheck + lint + build + Playwright section diff + RLS checklist via `mcp__supabase__execute_sql` + smoke run of representative server action.
- **hooks** — `migration_validator.py`, `rls_enabled_validator.py`, `css_verbatim_validator.py`, `no_tailwind_in_prototype_port.py`, `no_data_js_import.py` are reused; one new validator `no_vapid_private_in_client.py` added.

After implementation, run `/experts:supabase:self-improve` and `/experts:nextjs:self-improve` to refresh both YAMLs with the actual shipped patterns (realtime subscription pattern, Web Push fan-out pattern, service worker registration pattern).

## Implementation Plan

### Phase 1: Foundation

Database schema first. All 6 migrations land in numeric order via `mcp__supabase__apply_migration`. Types regenerated immediately after, locking the TypeScript signature for downstream waves. Custom validator created in parallel.

### Phase 2: Core Implementation

Three parallel tracks once types are stable:

- **Track A (UI ports)**: 3 verbatim-port files into `apps/web/app/_components/` via `ui-port-agent`.
- **Track B (data layer)**: 5 Zod schemas + 5 server actions + web-push lib + service worker via `build-agent`.
- **Track C (new client surfaces)**: 7 new UI components (bell, toast, hooks, prompt, registrar) via `build-agent`.

### Phase 3: Integration

Routes wire the data layer + UI components together: `/notifications`, `/messages` (list + thread), `/settings/notifications`. Layout passes the bell into Shell. Detail page's "Contact me" button wires the modal. Service worker registers conditionally. Final wave: seed sample data + validate visually + run typecheck/lint/build + RLS check.

## Team Orchestration

This plan uses Claude Code's **agent teams** for coordinated parallel execution. The executor operates as the **team lead in delegate mode** — orchestrating teammates without writing code directly.

### Team Setup

This plan is executed via `/tac:implement` which uses **subagent-driven development**:

1. **Parse tasks**: The executor reads this plan, extracts all tasks with full context.
2. **Create task list**: `TaskCreate` for every task, with dependencies via `addBlockedBy`.
3. **Dispatch subagents**: Fresh subagent per task (no context pollution between tasks).
4. **Two-stage review**: Each task gets spec compliance review, then code quality review.
5. **Status handling**: Subagents report DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT.
6. **Final validation**: Run all Validation Commands after all tasks complete.

To execute: `/tac:implement specs/issue-3-adw-manual-sdlc_planner-notifications-contact-messages.md`

### Team Members

- **db-agent**
  - Role: Authors Supabase SQL migrations, applies them via Supabase MCP, regenerates TypeScript types, runs RLS verification queries. Reused unchanged from Pair 2 — definition lives at `.claude/agents/team/db-agent.md` (NOT the global `db-agent` — both exist; this team file scopes the agent to this repo's conventions).
  - Agent Type: `db-agent`
  - Model: sonnet
  - Owns Files: `packages/db/migrations/0013_*.sql`, `0014_*.sql`, `0015_*.sql`, `0016_*.sql`, `0017_*.sql`, `0018_*.sql`; `apps/web/lib/supabase/types.ts`.
  - Required Capabilities: shell execution (Bash) for `pnpm typecheck` / `pnpm install`; file write (Write, Edit) for SQL files; Supabase MCP (`mcp__supabase__apply_migration`, `mcp__supabase__generate_typescript_types`, `mcp__supabase__list_tables`, `mcp__supabase__execute_sql`, `mcp__supabase__get_advisors`).
  - Plan Approval: false
  - Hooks:
    - PostToolUse (Write|Edit on `.sql`): `.claude/hooks/validators/migration_validator.py`
    - PostToolUse (Write|Edit on `.sql`): `.claude/hooks/validators/rls_enabled_validator.py`

- **ui-port-agent**
  - Role: Byte-for-byte port of `prototype/apps-gallery/contact.jsx` sections (lines 23-220, 256-330, 332-380) into 3 new TSX files. Reused unchanged from Pair 2.
  - Agent Type: `ui-port-agent`
  - Model: opus
  - Owns Files: `apps/web/app/_components/notifications-panel.tsx`, `apps/web/app/_components/notification-item.tsx`, `apps/web/app/_components/contact-modal.tsx`.
  - Required Capabilities: file write (Write, Edit, MultiEdit), grep/glob, shell (Bash) for typecheck.
  - Plan Approval: true (for `contact-modal.tsx` only — see Plan-Approval gates below)
  - Hooks:
    - PostToolUse (Write|Edit): `.claude/hooks/validators/css_verbatim_validator.py`
    - PostToolUse (Write|Edit): `.claude/hooks/validators/no_tailwind_in_prototype_port.py`
    - PostToolUse (Write|Edit): `.claude/hooks/validators/no_data_js_import.py`

- **build-agent**
  - Role: Implements Zod schemas, server actions, library code (web-push wiring + service worker), new client UI components, route handlers, and final wiring. No prototype-port file is owned by this agent (those go to ui-port-agent). Definition at `.claude/agents/build-agent.md`. This is a real agent file with Bash + Write + Edit + Read + Grep + Glob + TodoWrite, NOT `general-purpose`. Task 0 extends its frontmatter to register the new `no_vapid_private_in_client.py` hook.
  - Agent Type: `build-agent`
  - Model: sonnet (opus for the 3 plan-approval files only)
  - Owns Files: `apps/web/lib/zod/*.ts` (new), `apps/web/lib/actions/*.ts` (new), `apps/web/lib/push/*.ts`, `apps/web/public/sw.js`, `apps/web/app/_components/notifications-bell.tsx`, `apps/web/app/_components/notification-toast.tsx`, `apps/web/app/_components/push-permission-prompt.tsx`, `apps/web/app/_components/service-worker-registrar.tsx`, `apps/web/app/_components/use-*.ts`, `apps/web/app/notifications/**`, `apps/web/app/messages/**`, `apps/web/app/settings/notifications/**`, `apps/web/app/a/[slug]/_components/contact-cta.tsx`, `apps/web/app/_components/shell.tsx` (the bell-slot enhancement only — touches one specific region), `apps/web/app/layout.tsx`.
  - Required Capabilities: all standard tools.
  - Plan Approval: true for 3 files specifically (see Plan-Approval gates)
  - Hooks: none specific (existing hooks like `no_vapid_private_in_client.py` apply globally on Write|Edit for `.tsx` / `.ts`).

- **ui-validator**
  - Role: Final E2E validation — starts dev server, drives Playwright via MCP, captures section-level screenshot diff against the standalone prototype HTML, runs typecheck + lint + build, runs RLS checklist via Supabase MCP. **Definition at `.claude/agents/team/ui-validator.md` is extended in task 0** to add `mcp__supabase__list_tables` and `mcp__supabase__get_advisors` to its tools list (currently only has `mcp__supabase__execute_sql`). Without that extension, task 28's advisor check would fail.
  - Agent Type: `ui-validator`
  - Model: sonnet
  - Owns Files: `agents/pair3/review_agent/review_img/*.png` (screenshots), no source files.
  - Required Capabilities: shell (Bash), file write for screenshots, browser automation (`mcp__playwright__*`), `mcp__supabase__execute_sql` (RLS check) + `mcp__supabase__list_tables` (table existence) + `mcp__supabase__get_advisors` (security advisor).
  - Plan Approval: false
  - Hooks: none.

### Plan-Approval gates

Three files in this plan are flagged as Plan Approval = true because they have cross-cutting impact that a careless single-shot edit can break:

1. **`apps/web/app/_components/contact-modal.tsx`** (Task 9) — the 3-stage flow (compose / done) drives the contact_request creation pipeline, the role enum mapping, the consent gate, the success-state UX, and the bridge between client form state and the `sendContactRequest` server action. A subagent owning this file MUST submit a short plan (state transitions, prop interface, error handling) before writing.
2. **`apps/web/app/notifications/_components/notifications-page.tsx`** (Task 21) — filter tabs + cursor pagination + realtime hydration + optimistic mark-as-read all converge here. A subagent owning this file MUST submit a plan covering filter URL state, pagination cursor format, realtime conflict resolution (incoming row already in list), and optimistic update rollback.
3. **`apps/web/app/messages/[conversationId]/_components/message-thread.tsx`** (Task 24) — owns realtime sub setup/teardown, `useOptimistic` for sendMessage, auto-scroll on new message, scroll position preservation on history load, Cmd+Enter handling. A subagent owning this file MUST submit a plan covering the optimistic message lifecycle, scroll behavior matrix, and how the local channel subscription handles re-renders.

## Plan-Approval Enforcement

The three Plan-Approval gates (tasks 9, 21, 24) are NOT enforced by an automated hook — the agent definitions (`.claude/agents/team/ui-port-agent.md`, `.claude/agents/build-agent.md`) do not have a mechanical plan-approval mechanism. Enforcement is procedural: the `/tac:implement` executor MUST inspect each subagent's first message for tasks 9, 21, 24 and confirm it's a plan (state machine, prop interface, error handling, file structure) BEFORE allowing the subagent to write files. If the subagent begins writing without submitting a plan, the executor cancels the subagent and re-dispatches with the plan-first instruction. This pattern is identical to Pair 2's plan-approval gates on `publish-screen.tsx`, `app/a/[slug]/page.tsx`, and `middleware.ts`.

## Validation Hooks

Problem-specific validation hooks that enforce quality automatically during execution. These run as Claude Code hooks — every Write/Edit is checked before work continues.

### Available Validators

Existing reusable validators in `.claude/hooks/validators/`:

- `migration_validator.py` — validates Supabase SQL migration syntax + naming + `IF NOT EXISTS` (PostToolUse, Write|Edit, `.sql`). Used by db-agent.
- `rls_enabled_validator.py` — blocks if a migration `CREATE TABLE` lacks `enable row level security` in the same file or a sibling `*_rls.sql`. Used by db-agent.
- `css_verbatim_validator.py` — blocks edits to `apps/web/app/styles/prototype-*.css`. Used by ui-port-agent.
- `no_tailwind_in_prototype_port.py` — blanket-blocks Tailwind utility classes inside `apps/web/app/_components/*.tsx`. Currently wired only on `ui-port-agent`; task 0 ALSO wires it on `build-agent` so the new non-port components (`notifications-bell.tsx`, `notification-toast.tsx`, `push-permission-prompt.tsx`, `service-worker-registrar.tsx`) are gated by the same rule when build-agent writes them.
- `no_data_js_import.py` — blocks `import from 'prototype/apps-gallery/data.js'`. Used by ui-port-agent.

### Custom Validators

- **`no_vapid_private_in_client.py`**
  - File: `.claude/hooks/validators/no_vapid_private_in_client.py`
  - Hook Type: PostToolUse
  - Matcher: `Write|Edit`
  - Checks: For files under `apps/web/`, reads the post-write content of `.ts` / `.tsx` files. If the file contains the string `VAPID_PRIVATE_KEY` AND the file also contains the directive `'use client'` (or `"use client"`) at any line position, block. Also blocks if the file's `process.env.VAPID_PRIVATE_KEY` reference is in a path under `apps/web/app/` that is NOT in `apps/web/lib/push/server.ts` (the only allowed location).
  - Blocks with: `BLOCKED: VAPID_PRIVATE_KEY is server-only. This file is a Client Component or lives outside apps/web/lib/push/server.ts. Move the push send to a server action and call it from this client component instead.`
  - Pattern: Follow the same structure as `ruff_validator.py` — read stdin JSON, extract `tool_input.file_path`, run check, output `{"decision": "block", "reason": "..."}` or `{}` to allow.
  - **Wiring**: task 0 ALSO edits `.claude/agents/build-agent.md` frontmatter `hooks:` block to register this validator as a PostToolUse `Write|Edit` entry. Without this wiring the hook never fires.

### Hook Assignments

| Team Member   | Hook Type   | Matcher     | Validator                                                      |
| ------------- | ----------- | ----------- | -------------------------------------------------------------- |
| db-agent      | PostToolUse | Write\|Edit | `.claude/hooks/validators/migration_validator.py`              |
| db-agent      | PostToolUse | Write\|Edit | `.claude/hooks/validators/rls_enabled_validator.py`            |
| ui-port-agent | PostToolUse | Write\|Edit | `.claude/hooks/validators/css_verbatim_validator.py`           |
| ui-port-agent | PostToolUse | Write\|Edit | `.claude/hooks/validators/no_tailwind_in_prototype_port.py`    |
| ui-port-agent | PostToolUse | Write\|Edit | `.claude/hooks/validators/no_data_js_import.py`                |
| build-agent   | PostToolUse | Write\|Edit | `.claude/hooks/validators/no_vapid_private_in_client.py` (new) |
| build-agent   | PostToolUse | Write\|Edit | `.claude/hooks/validators/no_tailwind_in_prototype_port.py`    |

## Step by Step Tasks

### 0. Create custom validator + wire hooks + extend agent tools + add deps + create phase6.css

- **Task ID**: setup-foundations
- **Depends On**: none
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `.claude/hooks/validators/no_vapid_private_in_client.py`, `.claude/agents/build-agent.md` (frontmatter edit only — adds TWO PostToolUse entries: `no_vapid_private_in_client.py` AND `no_tailwind_in_prototype_port.py`), `.claude/agents/team/ui-validator.md` (frontmatter edit), `apps/web/package.json`, `pnpm-lock.yaml`, `.env.sample`, `.claude/rules/prototype-port-exception.md`, `apps/web/app/styles/phase6.css`
- **Context**: Multiple setup tasks bundled here so Wave A can start cleanly.
  1. Create the `no_vapid_private_in_client.py` validator following the same Python `uv run --script` pattern as `.claude/hooks/validators/ruff_validator.py` (read existing file as template). Block when a `.ts`/`.tsx` file under `apps/web/` contains both `VAPID_PRIVATE_KEY` and `'use client'`, OR when `VAPID_PRIVATE_KEY` is referenced from any path other than `apps/web/lib/push/server.ts`. Output `{"decision":"block","reason":"..."}` on violation, `{}` on allow. `chmod +x` the file.
  2. **Edit `.claude/agents/build-agent.md`** frontmatter `hooks:` block. Currently it has only `ruff_validator.py`. Add TWO new PostToolUse `Write|Edit` entries: (a) `uv run $CLAUDE_PROJECT_DIR/.claude/hooks/validators/no_vapid_private_in_client.py` (block VAPID_PRIVATE_KEY in client code), (b) `uv run $CLAUDE_PROJECT_DIR/.claude/hooks/validators/no_tailwind_in_prototype_port.py` (block Tailwind in `_components/*.tsx` for the new non-port components build-agent owns). Without these edits, the validators never fire for build-agent-owned files.
  3. **Edit `.claude/agents/team/ui-validator.md`** frontmatter `tools:` list. Currently has `mcp__supabase__execute_sql` only on the Supabase side. Append `mcp__supabase__list_tables` and `mcp__supabase__get_advisors` so task 28 can run those checks.
  4. Add `web-push@^3.6.7` and `sonner@^1.7.0` to `apps/web/package.json` dependencies via `pnpm --filter @hatch/web add web-push sonner`. Add type defs: `pnpm --filter @hatch/web add -D @types/web-push`.
  5. Append to `.env.sample` under a new section header `# ─── apps/web — Web Push (Phase 6, opt-in) ───`: `NEXT_PUBLIC_VAPID_PUBLIC_KEY=` and `VAPID_PRIVATE_KEY=`.
  6. Edit `.claude/rules/prototype-port-exception.md` to add the 3 newly-ported files to the scope list: `apps/web/app/_components/notifications-panel.tsx`, `apps/web/app/_components/notification-item.tsx`, `apps/web/app/_components/contact-modal.tsx`.
  7. Create `apps/web/app/styles/phase6.css` (NEW CSS file, not a port). Define classes used by the new non-ported components: `.bell-btn` (transparent button matching topbar height + hover state matching `.btn-ghost`), `.bell-badge` (absolute-positioned red pill, top-right corner of bell, font 11px, white text), `.notifs-anchor` (relative wrapper for absolute-positioned `.notifs` dropdown, top: 100%; right: 0), `.push-prompt` (small floating card bottom-right, ~280px wide, matches `.cmodal` border/shadow tokens at smaller scale), `.push-prompt-actions` (flex row with 8px gap). Color tokens match existing prototype variables (`--c-text`, `--c-bg`, `--c-border`, `--c-accent` defined in `prototype-base.css`).
  8. DO NOT edit `apps/web/app/layout.tsx` here — task 26 owns that file. Task 26 will add the `import './styles/phase6.css';` line as part of its layout wiring. The phase6.css file existing on disk is sufficient for task 19 to compile; bundling occurs at build time once layout.tsx imports it.

- **Actions**:
  - Read `.claude/hooks/validators/ruff_validator.py` as a template.
  - Write `.claude/hooks/validators/no_vapid_private_in_client.py`. `chmod +x`.
  - Test the validator: pipe a sample JSON `{"tool_input":{"file_path":"apps/web/app/_components/test.tsx","content":"'use client';\nconst x = process.env.VAPID_PRIVATE_KEY;"}}` and confirm it returns `decision: block`.
  - Edit `.claude/agents/build-agent.md` to register the new hook in frontmatter.
  - Edit `.claude/agents/team/ui-validator.md` to extend the `tools:` list.
  - Run pnpm install commands.
  - Edit `.env.sample`.
  - Edit `.claude/rules/prototype-port-exception.md` scope list.
  - Write `apps/web/app/styles/phase6.css`.

### 1. Migration 0013 — contact_requests

- **Task ID**: mig-0013-contact-requests
- **Depends On**: none
- **Assigned To**: db-agent
- **Agent Type**: `db-agent`
- **Parallel**: true (parallel with task 0)
- **Owns Files**: `packages/db/migrations/0013_contact_requests.sql`
- **Context**: Create `packages/db/migrations/0013_contact_requests.sql` copying SPEC.md §4.6 (lines ~503-526) verbatim. Header comment: `-- migration 0013_contact_requests — Phase 6 schema: contact_role enum, contact_status enum, contact_requests table. Source: SPEC.md §4.6. RLS deferred to 0017_phase6_rls.sql.`. The `contact_requests.conversation_id` column is declared but its FK constraint is deferred to migration 0014 (after `conversations` exists). DDL elements: `contact_role` enum (`investor`, `partner`, `hire`, `fan`); `contact_status` enum (`pending`, `accepted`, `declined`, `expired`); `contact_requests` table with columns `id`, `app_id` (FK apps), `sender_id` (FK profiles), `recipient_id` (FK profiles), `role`, `note` (text default '', check length ≤ 600), `sender_link` (text nullable), `status` (default 'pending'), `responded_at`, `conversation_id` (uuid, FK deferred), `created_at`, plus check `sender_id <> recipient_id`. Index: `(recipient_id, status, created_at desc)`. Use `create table if not exists` and `create index if not exists` for re-runnability. DO NOT apply yet — apply happens in task 6.
- **Actions**:
  - Write the migration file with the exact DDL from SPEC §4.6.
  - DO NOT call `mcp__supabase__apply_migration` yet — wait for task 6 (batched apply).

### 2. Migration 0014 — conversations + messages + find_or_create_conversation

- **Task ID**: mig-0014-conversations-messages
- **Depends On**: mig-0013-contact-requests
- **Assigned To**: db-agent
- **Agent Type**: `db-agent`
- **Parallel**: false (sequential after task 1 because adds FK to 0013's table)
- **Owns Files**: `packages/db/migrations/0014_conversations_messages.sql`
- **Context**: Create `packages/db/migrations/0014_conversations_messages.sql` copying SPEC.md §4.6 (lines ~528-585) verbatim. DDL: `conversations` table (`id`, `participant_a` FK profiles, `participant_b` FK profiles, `app_id` FK apps nullable, `last_message_at`, `created_at`, `check (participant_a < participant_b)`); unique index `(participant_a, participant_b)`; indexes `(participant_a, last_message_at desc nulls last)` and `(participant_b, last_message_at desc nulls last)`. THEN ALTER `contact_requests` to add the deferred FK — wrap in `do $$ begin if not exists (select 1 from pg_constraint where conname = 'contact_requests_conversation_fk') then alter table public.contact_requests add constraint contact_requests_conversation_fk foreign key (conversation_id) references public.conversations(id) on delete set null; end if; end $$;` for idempotency. THEN `messages` table (`id`, `conversation_id` FK conversations, `sender_id` FK profiles, `body` (check length 1..4000), `read_at` nullable, `created_at`); index `(conversation_id, created_at desc)`. THEN `messages_bump_conversation` function (`create or replace function ... security definer set search_path = public`) — `create or replace` is idempotent. THEN trigger: `drop trigger if exists messages_after_insert on public.messages;` then `create trigger messages_after_insert after insert on public.messages for each row execute function public.messages_bump_conversation();` (Postgres has no `create trigger if not exists`). THEN `find_or_create_conversation(user_a uuid, user_b uuid, app uuid)` SECURITY DEFINER function returning uuid (canonical lo/hi order, SELECT-or-INSERT) — `create or replace` is fine. Tables use `create table if not exists`; indexes use `create index if not exists`; constraints guarded by `do $$ if not exists` blocks.
- **Realtime publication**: at the end of the migration, add `conversations` and `messages` to `supabase_realtime` publication via the guarded `do $$ ... if not exists ... alter publication ... add table` pattern (see task 3 for the template).
- **Actions**:
  - Write the migration file with the exact DDL from SPEC §4.6, plus the publication ALTERs.
  - Use `drop trigger if exists ... ; create trigger ...` (not `create trigger if not exists` — that syntax does not exist).
  - All FK constraint ALTERs wrapped in `do $$ if not exists` checks.

### 3. Migration 0015 — notifications + 6 fan-out triggers

- **Task ID**: mig-0015-notifications
- **Depends On**: mig-0014-conversations-messages
- **Assigned To**: db-agent
- **Agent Type**: `db-agent`
- **Parallel**: false (sequential after task 2 because notifications references conversations)
- **Owns Files**: `packages/db/migrations/0015_notifications.sql`
- **Context**: Create `packages/db/migrations/0015_notifications.sql` per SPEC.md §4.7. DDL: `notif_kind` enum with 8 values (`contact_request`, `contact_accepted`, `contact_declined`, `like`, `comment`, `comment_reply`, `follow`, `message`); `notifications` table (`id`, `recipient_id` FK profiles, `actor_id` FK profiles nullable, `kind`, `app_id` FK apps nullable, `comment_id` FK comments nullable, `contact_request_id` FK contact_requests nullable, `conversation_id` FK conversations nullable, `payload jsonb default '{}'`, `read_at` nullable, `created_at`); indexes: `(recipient_id, created_at desc)` and partial `(recipient_id) where read_at is null`. THEN six trigger functions + triggers (all `security definer set search_path = public`, all guard against actor==recipient where it would self-notify):
  - `notify_on_like()` AFTER INSERT on `public.likes`: lookup `app.author_id`, if `new.user_id <> author_id`, INSERT notif (recipient = author_id, actor = new.user_id, kind = 'like', app_id = new.app_id, payload `{}`).
  - `notify_on_comment()` AFTER INSERT on `public.comments`: if `new.parent_id IS NULL` → kind = 'comment', recipient = `app.author_id`. Else → kind = 'comment_reply', recipient = parent comment's `author_id`. In both branches: if recipient = new.author_id, skip. Payload = `jsonb_build_object('body', new.body)`.
  - `notify_on_follow()` AFTER INSERT on `public.follows`: recipient = new.followee_id, actor = new.follower_id, kind = 'follow'.
  - `notify_on_contact_request_insert()` AFTER INSERT on `public.contact_requests`: recipient = new.recipient_id, actor = new.sender_id, kind = 'contact_request', app_id = new.app_id, contact_request_id = new.id, payload = `jsonb_build_object('role', new.role, 'note', new.note)`.
  - `notify_on_contact_request_update()` AFTER UPDATE on `public.contact_requests` WHEN old.status = 'pending' AND new.status IN ('accepted', 'declined'): notify the ORIGINAL sender of the outcome. kind = 'contact_accepted' or 'contact_declined', recipient = new.sender_id, actor = new.recipient_id, contact_request_id = new.id, conversation_id = new.conversation_id (NULL if declined).
  - `notify_on_message()` AFTER INSERT on `public.messages`: lookup conversation participants, recipient = the participant who is NOT new.sender_id, kind = 'message', conversation_id = new.conversation_id, payload = `jsonb_build_object('preview', left(new.body, 200))`. Defense-in-depth: if computed `recipient_id = new.sender_id` (shouldn't happen due to the participant_a < participant_b check, but guard anyway) → `return null`.

**Explicit `WHEN` clauses on UPDATE triggers** (must use SQL clause, not in-function guard, so trigger does not even fire on irrelevant updates):

```sql
create trigger notify_on_contact_request_update_t
  after update on public.contact_requests
  for each row
  when (old.status = 'pending' and new.status in ('accepted', 'declined'))
  execute function public.notify_on_contact_request_update();
```

INSERT triggers use no `WHEN` clause (always fire). All trigger DROP-then-CREATE for re-runnability:

```sql
drop trigger if exists notify_on_like_t on public.likes;
create trigger notify_on_like_t after insert on public.likes
  for each row execute function public.notify_on_like();
```

(repeat pattern for all 6 triggers).

**Realtime publication membership** (CRITICAL — without this, `postgres_changes` subscriptions silently never fire): the migration MUST add the notifications table to the Supabase Realtime publication:

```sql
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
```

The same block applies to `public.messages` and `public.conversations` (added by migration 0014 — see updated task 2).

- **Actions**:
  - Write the migration file with the enum, table, indexes, all 6 trigger functions, all 6 triggers (drop-then-create pattern), the explicit `WHEN` clause on the UPDATE trigger, the publication ALTER for `notifications`.
  - Verify self-notification suppression branches in each function (including the defense-in-depth check in `notify_on_message`).
  - **At the end of the migration, add to the Realtime publication**:
    ```sql
    do $$ begin
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
      ) then
        alter publication supabase_realtime add table public.notifications;
      end if;
    end $$;
    ```
  - Confirm `payload` JSON shape matches what the bell dropdown / toast renders.
  - Add an FK constraint NAME on `notifications.actor_id` so PostgREST disambiguation works deterministically: `references public.profiles(id) on delete cascade` should be wrapped or named so the FK is called `notifications_actor_id_fkey` (Postgres default naming when you write the FK inline with no explicit constraint name — that's already the convention, just verify).

### 4. Migration 0016 — push_subscriptions

- **Task ID**: mig-0016-push-subscriptions
- **Depends On**: none
- **Assigned To**: db-agent
- **Agent Type**: `db-agent`
- **Parallel**: true (parallel with tasks 1-3 — no schema dependency on contact/conv/notif tables)
- **Owns Files**: `packages/db/migrations/0016_push_subscriptions.sql`
- **Context**: Create `packages/db/migrations/0016_push_subscriptions.sql` per roadmap §5.2: `push_subscriptions` table (`id` uuid pk, `user_id` FK profiles on delete cascade, `endpoint` text not null, `p256dh` text not null, `auth` text not null, `user_agent` text nullable, `created_at` timestamptz default now(), `unique (user_id, endpoint)`). Index `(user_id)`. No new column on `profiles` — `notification_prefs jsonb` already exists in `0001_init.sql` line 19 with the right default. Use `if not exists` throughout.
- **Actions**:
  - Write the migration file.
  - Confirm `profiles.notification_prefs` already exists by reading `packages/db/migrations/0001_init.sql` line 19 — do not add a duplicate column.

### 5. Migration 0017 — RLS for all 5 new tables

- **Task ID**: mig-0017-rls
- **Depends On**: mig-0013-contact-requests, mig-0014-conversations-messages, mig-0015-notifications, mig-0016-push-subscriptions
- **Assigned To**: db-agent
- **Agent Type**: `db-agent`
- **Parallel**: false
- **Owns Files**: `packages/db/migrations/0017_phase6_rls.sql`
- **Context**: Copy RLS policies verbatim from SPEC.md §5.2 for the 5 new tables. Pattern: `alter table public.X enable row level security; drop policy if exists "..." on public.X; create policy "..." on public.X ...;`.
  - `contact_requests`: SELECT for `recipient_id = auth.uid() or sender_id = auth.uid()`; INSERT with check `sender_id = auth.uid()`; UPDATE using `recipient_id = auth.uid()` with check `recipient_id = auth.uid()` (only the recipient can flip status); no DELETE.
  - `conversations`: SELECT for `participant_a = auth.uid() or participant_b = auth.uid()`; NO client INSERT policy (creation only via `find_or_create_conversation` SECURITY DEFINER fn called from server actions); no UPDATE/DELETE policies.
  - `messages`: SELECT using `public.is_participant(conversation_id)`; INSERT with check `sender_id = auth.uid() and public.is_participant(conversation_id)`; UPDATE split policy per SPEC.md §5.2 lines ~773-782 (sender can edit body OR recipient can flip read_at).
  - `notifications`: SELECT using `recipient_id = auth.uid()`; UPDATE using `recipient_id = auth.uid()` with check `recipient_id = auth.uid()` (so user can mark as read); no INSERT (triggers do the writes via SECURITY DEFINER bypass).
  - `push_subscriptions`: SELECT using `user_id = auth.uid()`; INSERT with check `user_id = auth.uid()`; DELETE using `user_id = auth.uid()`. **NOTE**: `push_subscriptions` RLS is NOT defined in SPEC.md §5.2 (the SPEC predates the push schema decision); this is plan-authored RLS following the same self-only owner pattern used by `saves` in `0010_social_rls.sql:43-45`. Document this clearly in the migration header comment.
  - Helper function: SPEC §5.1 defines `public.is_participant(c uuid)` SECURITY DEFINER. Include this function definition INSIDE 0017 (or 0014) so the messages policy can use it. Place it before the messages RLS section.
- **Actions**:
  - Write the migration file with the helper function + all policies.
  - Use `drop policy if exists` before each `create policy` so the migration is re-runnable.

### 6. Apply migrations 0013-0017 + regenerate types

- **Task ID**: apply-migrations
- **Depends On**: mig-0013-contact-requests, mig-0014-conversations-messages, mig-0015-notifications, mig-0016-push-subscriptions, mig-0017-rls
- **Assigned To**: db-agent
- **Agent Type**: `db-agent`
- **Parallel**: false
- **Owns Files**: `apps/web/lib/supabase/types.ts`
- **Context**: Apply migrations 0013-0017 in numeric order via `mcp__supabase__apply_migration({ project_id: 'vcbdtjjkkwryvmqbflah', name: '<filename-without-ext>', query: <file contents> })`. After all 5 succeed, **force PostgREST to reload its schema cache**: `mcp__supabase__execute_sql({ query: "notify pgrst, 'reload schema';" })` — without this, the newly-added tables may 404 from the REST API for up to 60 seconds. Then call `mcp__supabase__generate_typescript_types({ project_id: 'vcbdtjjkkwryvmqbflah' })` and write the output to `apps/web/lib/supabase/types.ts` (NEVER hand-edit). Then call `mcp__supabase__list_tables({ schemas: ['public'] })` to confirm `contact_requests`, `conversations`, `messages`, `notifications`, `push_subscriptions` all exist. Then call `mcp__supabase__execute_sql({ project_id: 'vcbdtjjkkwryvmqbflah', query: "select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('contact_requests','conversations','messages','notifications','push_subscriptions') order by tablename" })` to confirm `rowsecurity = true` on all 5. Verify Realtime publication membership: `mcp__supabase__execute_sql({ query: "select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'" })` — must include `notifications`, `messages`, `conversations`. Then call `mcp__supabase__get_advisors({ project_id: 'vcbdtjjkkwryvmqbflah', type: 'security' })` and verify no new advisories. Finally `pnpm typecheck` from repo root to confirm downstream code still compiles.
- **Actions**:
  - Apply each migration in order via `mcp__supabase__apply_migration`.
  - Regenerate types.
  - Verify rowsecurity on all 5 new tables.
  - Get advisors, confirm clean.
  - Run typecheck.

### 7. Verbatim port: `<NotificationItem>`

- **Task ID**: port-notification-item
- **Depends On**: apply-migrations
- **Assigned To**: ui-port-agent
- **Agent Type**: `ui-port-agent`
- **Parallel**: true (parallel with tasks 8, 9 — different files)
- **Owns Files**: `apps/web/app/_components/notification-item.tsx`
- **Context**: Verbatim port `prototype/apps-gallery/contact.jsx:256-330` into `apps/web/app/_components/notification-item.tsx`. CSS already exists in `apps/web/app/styles/prototype-contact.css` (imported in layout.tsx). Prop interface: `{ n: NotificationRow, onAction: (id: string, action: 'accept' | 'later' | 'decline') => void }`. Define `NotificationRow` type inline OR import from `@hatch/shared` if a type exists for the joined-and-flattened notification shape (you may need to author this type — joined from `notifications + actor profile + app + contact_request` rows). The prototype uses `userOf(id)` and `window.HATCH_APPS.find(...)` — replace with real props: `actor` (profile with name/handle/avatar), `app` (apps row with title + accent), `n` (notification row + payload). The 2 render branches stay: `kind === 'contact_request'` (full card) and ELSE (mini-row). Note: prototype's `kind === 'contact'` becomes `kind === 'contact_request'` in our schema; preserve the wording on screen by mapping at the prop level if needed, but the className-driving conditions must match the prototype.
  - All `className` strings must match prototype byte-for-byte: `notif notif-contact is-unread`, `notif-body`, `notif-head`, `notif-role` (with `data-role={role}`), `notif-when`, `notif-meta`, `notif-app`, `notif-app-dot`, `notif-note`, `notif-accepted`, `notif-contact-info`, `notif-actions`, `notif-btn`, `notif-x`, `notif-mini`, `notif-mini-text`.
  - Inline `style={{ background: app.accent }}` MUST be preserved.
  - SVG glyphs (close X, accept checkmark) MUST match prototype byte-for-byte.
- **Actions**:
  - Read prototype lines 256-330 carefully.
  - Write the TSX with TypeScript types but identical JSX/className/glyphs.
  - Validators will block any Tailwind utility class.

### 8. Verbatim port: `<NotificationsPanel>`

- **Task ID**: port-notifications-panel
- **Depends On**: apply-migrations
- **Assigned To**: ui-port-agent
- **Agent Type**: `ui-port-agent`
- **Parallel**: true (parallel with tasks 7, 9)
- **Owns Files**: `apps/web/app/_components/notifications-panel.tsx`
- **Context**: Verbatim port `prototype/apps-gallery/contact.jsx:332-380` into `apps/web/app/_components/notifications-panel.tsx`. Prop interface: `{ open: boolean, notifs: NotificationRow[], onAction: ..., onClose: () => void, onAll: () => void }`. The panel has: header h3 "Inbox" + "Mark all read" button; tabs bar with "All" + "Contact requests" with counts; ul listing `<NotificationItem>`; footer text "Only people you accept can email you. Decline keeps your inbox tidy.". The escape-key + outside-click close handlers MUST be preserved. The internal `useState` for `tab` MUST be preserved (the prototype tracks `tab` locally).
  - All `className` strings: `notifs`, `notifs-head`, `notifs-all`, `notifs-tabs`, `notifs-tab is-on`, `notifs-tab-c`, `notifs-list`, `notifs-foot`.
  - `role="dialog" aria-label="Notifications"` MUST be preserved.
  - Import the `<NotificationItem>` from task 7.
- **Actions**:
  - Read prototype lines 332-380 carefully.
  - Write the TSX. Imports `NotificationItem` from `./notification-item`.

### 9. Verbatim port: `<ContactModal>` [PLAN APPROVAL]

- **Task ID**: port-contact-modal
- **Depends On**: apply-migrations
- **Assigned To**: ui-port-agent
- **Agent Type**: `ui-port-agent`
- **Parallel**: true (parallel with tasks 7, 8)
- **Owns Files**: `apps/web/app/_components/contact-modal.tsx`
- **Plan Approval**: YES — submit a short plan first covering: (1) 3-stage state machine (compose | done; the prototype has a third `confirm` stage commented out — skip), (2) prop interface (`{ open, app, onClose, onSubmit }`), (3) bridge from `onSubmit` to the `sendContactRequest` server action (the action is called by the PARENT — modal just calls `onSubmit({role, note, link})`), (4) ESC handler + outside-click close, (5) consent gate (Send button disabled until consent), (6) accessibility (focus trap, return focus on close — keep prototype's behavior even if minimal).
- **Context**: Verbatim port `prototype/apps-gallery/contact.jsx:23-220` into `apps/web/app/_components/contact-modal.tsx`. Prop interface: `{ open: boolean, app: AppRow | null, author: ProfileRow | null, viewer: ProfileRow | null, onClose: () => void, onSubmit: (payload: { role: ContactRole, note: string, link: string }) => Promise<void> }`. The 3-stage state machine: `compose` (full form with role picker, note textarea max 400 chars, link input, consent checkbox, send button), `done` (success card with role tag, note preview, footer with viewer avatar/handle/firm).
  - Internal state: `stage`, `role`, `note`, `link`, `consent` — all `useState`.
  - ESC closes; outside-click on scrim closes.
  - All `className` strings: `cmodal-scrim`, `cmodal`, `cmodal-x`, `cmodal-head`, `cmodal-art`, `cmodal-body`, `cm-sect`, `cm-h`, `cm-h-opt`, `cm-me`, `cm-me-id`, `cm-me-edit`, `cm-roles`, `cm-role is-on`, `cm-role-dot`, `cm-textarea`, `cm-counter`, `cm-input`, `cm-warn`, `cm-warn-glyph`, `cm-consent`, `cmodal-foot`, `btn btn-ghost-2`, `btn btn-publish`, `cm-done`, `cm-done-bubble`, `cm-done-card`, `cm-done-tag`, `cm-done-when`, `cm-done-actions`.
  - Inline `style={{ '--ax': app.accent }}` on cmodal MUST be preserved (CSS var driving role-pill color).
  - Inline `style={{ background: app.accent }}` on `cm-done-bubble` and `cm-done-tag` MUST be preserved.
  - All SVG glyphs (close X, info circle, send arrow, accept checkmark) MUST match prototype byte-for-byte.
  - Replace the prototype's `window.HATCH_USERS.mila` (current viewer) with the `viewer` prop. Replace `window.HATCH_USERS[app.author]` with the `author` prop. Replace `<AppArt kind={app.art} accent={app.accent} glyphSize={36} />` with `<AppArt kind={...} accent={...} glyphSize={36} />` using existing `AppArt` from `_components/app-art.tsx`. **BEFORE writing, verify the actual column names** against `apps/web/lib/supabase/types.ts` post-Pair-2: run `grep -E "cover_art|accent" apps/web/lib/supabase/types.ts | head` to confirm whether the columns are `cover_art_kind` + `accent_color` (Pair 2 likely naming) or `cover_art` + `accent`. Use whichever the regenerated types declare. Do not invent names.
  - Replace `<Avatar user="mila" size={36} />` with `<Avatar user={viewer} size={36} />` using existing `Avatar` exported from `apps/web/app/_components/cards.tsx` (verified — that's where Pair 1 put it; not in a separate `avatars.tsx`). The current Avatar prop interface accepts a profile-like object; pass the `viewer` profile directly.
  - On `submit`: call `await onSubmit({ role, note, link })` then `setStage('done')`. If `onSubmit` throws, stay on `compose` with an error pill (prototype doesn't have this branch; add minimal error state).
- **Actions**:
  - Submit a plan covering the 6 points above.
  - On plan approval, write the TSX.
  - Confirm all className strings match prototype.

### 10. Zod schemas: contact-requests + messages + notifications + push + notification-prefs

- **Task ID**: zod-schemas
- **Depends On**: apply-migrations
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true (parallel with all other Wave B/C tasks)
- **Owns Files**: `apps/web/lib/zod/contact-requests.ts`, `apps/web/lib/zod/messages.ts`, `apps/web/lib/zod/notifications.ts`, `apps/web/lib/zod/push.ts`, `apps/web/lib/zod/notification-prefs.ts`
- **Context**: Follow the pattern in `apps/web/lib/zod/social.ts` (existing). Each schema is `z.object({...})` + `z.infer<typeof X>` type alias.
  - `contact-requests.ts`: `ContactRequestCreate` = `{ appId: uuid, recipientId: uuid, role: z.enum(['investor','partner','hire','fan']), note: z.string().max(600), link: z.string().url().optional(), consent: z.literal(true) }`. `ContactRequestRespond` = `{ requestId: uuid, action: z.enum(['accept','decline']) }`.
  - `messages.ts`: `MessageSend` = `{ conversationId: uuid, body: z.string().trim().min(1).max(4000) }`. `ConversationMarkRead` = `{ conversationId: uuid }`.
  - `notifications.ts`: `NotificationRead` = `{ id: uuid }`. `NotificationFilter` = `{ kind: z.enum(['contact_request','contact_accepted','contact_declined','like','comment','comment_reply','follow','message']).optional(), unreadOnly: z.boolean().optional(), cursor: z.string().optional() }`.
  - `push.ts`: `PushSubscribeInput` = `{ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }), userAgent: z.string().optional() }`. `PushUnsubscribeInput` = `{ endpoint: z.string().url() }`.
  - `notification-prefs.ts`: `NotificationPrefsUpdate` = `z.object({ push_enabled, push_likes, push_follows, push_comments, push_messages, push_contact_requests }).partial()` where each key is `z.boolean().optional()`.
- **Actions**:
  - Write all 5 schema files.

### 11. Server action: contact-requests

- **Task ID**: action-contact-requests
- **Depends On**: zod-schemas, push-lib
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/lib/actions/contact-requests.ts`
- **Context**: Follow pattern from `apps/web/lib/actions/like.ts`. Three exports:
  - `sendContactRequest(input: ContactRequestCreateT): Promise<Result<{ id: string }>>` — Zod parse, `requireUser()`, insert into `contact_requests` (status='pending', sender_id = user.id). The Postgres trigger fans out the notification. AFTER successful insert, also call `pushToUser(recipientId, { title: '<viewer name> wants to contact you', body: note.slice(0,200), url: '/notifications' })` from `@/lib/push/server` — wrap in try/catch and swallow errors (push failure must NOT fail the action). Return `{ ok:true, data:{ id } }`. `revalidatePath('/notifications')` for the recipient (best-effort; doesn't reach the recipient's RSC cache but updates ours).
  - `acceptContactRequest(input: ContactRequestRespondT): Promise<Result<{ conversationId: string }>>` — Zod parse with `action: 'accept'`. `requireUser()`. Verify the request's recipient_id = user.id (defense in depth even though RLS enforces). Call `find_or_create_conversation(sender_id, recipient_id, app_id)` via `sb.rpc('find_or_create_conversation', {...})` to get `conversationId`. Update `contact_requests` set status='accepted', responded_at=now(), conversation_id=conversationId where id=requestId. The Postgres UPDATE trigger fans out `contact_accepted` notif to the original sender. Return `{ ok:true, data:{ conversationId } }`. `revalidatePath('/notifications')` + `revalidatePath('/messages')`.
  - `declineContactRequest(input: ContactRequestRespondT): Promise<Result<{}>>` — Zod parse with `action: 'decline'`. `requireUser()`. Update set status='declined', responded_at=now() where id=requestId. Postgres trigger fans out `contact_declined`. Return `{ ok:true, data:{} }`. `revalidatePath('/notifications')`.
- **Actions**:
  - Write the 3-export action file.
  - Match the `Result<T>` type pattern from `like.ts`.

### 12. Server action: messages

- **Task ID**: action-messages
- **Depends On**: zod-schemas, push-lib
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/lib/actions/messages.ts`
- **Context**: Two exports following the `like.ts` pattern:
  - `sendMessage(input: MessageSendT): Promise<Result<{ id: string }>>` — Zod, requireUser, insert into messages (sender_id = user.id). Trigger updates conversations.last_message_at AND fans out notif. AFTER insert, query the OTHER participant's `notification_prefs.push_messages` flag — if true AND not the sender themselves, call `pushToUser(otherId, { title: '<sender name>', body: body.slice(0,200), url: '/messages/' + conversationId })`. Wrap in try/catch. Return `{ok:true, data:{id}}`. `revalidatePath('/messages/' + conversationId)`.
  - `markConversationRead(input: ConversationMarkReadT): Promise<Result<{}>>` — Zod, requireUser, update messages set read_at = now() where conversation_id = id AND sender_id <> user.id AND read_at IS NULL. ALSO update notifications set read_at = now() where recipient_id = user.id AND conversation_id = id AND read_at IS NULL. Return `{ok:true, data:{}}`. `revalidatePath('/messages')`.
- **Actions**:
  - Write the action file.

### 13. Server action: notifications

- **Task ID**: action-notifications
- **Depends On**: zod-schemas
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/lib/actions/notifications.ts`
- **Context**: Three exports:
  - `markNotificationRead(input: NotificationReadT): Promise<Result<{}>>` — Zod, requireUser, update notifications set read_at = now() where id = ... AND recipient_id = user.id. Return `{ok:true,data:{}}`. `revalidatePath('/notifications')`.
  - `markAllRead(): Promise<Result<{ count: number }>>` — requireUser, update notifications set read_at = now() where recipient_id = user.id AND read_at IS NULL. Return count.
  - `getNotifications(input: NotificationFilterT): Promise<Result<{ rows: NotificationRow[], nextCursor: string | null }>>` — Zod, requireUser. Build query: `from('notifications').select('*, actor:profiles!notifications_actor_id_fkey(*), app:apps(*), contact_request:contact_requests(*)').eq('recipient_id', user.id).order('created_at', {ascending:false}).limit(20)`. Apply filters: if kind → `.eq('kind', kind)`. If unreadOnly → `.is('read_at', null)`. If cursor → `.lt('created_at', cursor)` (cursor = ISO timestamp). Return rows + nextCursor (the `created_at` of the last row, or null if fewer than 20 results).
- **Actions**:
  - Write the action file.
  - Disambiguate the actor FK join using the FK constraint NAME `notifications_actor_id_fkey` (NOT the column name). This matches the established Pair 2 pattern — see `apps/web/app/page.tsx:44`, `apps/web/app/a/[slug]/page.tsx:59,161`, `apps/web/app/c/[category]/page.tsx:66` which all use `profiles!<table>_<column>_fkey`. Verify the actual generated FK name post-apply via `mcp__supabase__execute_sql({ query: "select conname from pg_constraint where conrelid = 'public.notifications'::regclass and contype = 'f'" })` and adjust the join string if Postgres named it differently.

### 14. Web Push lib (server + client)

- **Task ID**: push-lib
- **Depends On**: zod-schemas
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/lib/push/server.ts`, `apps/web/lib/push/client.ts`, `apps/web/lib/push/vapid-key.ts`
- **Context**:
  - `server.ts`: `pushToUser(userId, payload)` using `web-push` npm package per roadmap §5.2. `webpush.setVapidDetails('mailto:hello@hatch.dev', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)`. Query `push_subscriptions` for user, send in parallel via `Promise.all`. On `statusCode === 410`, delete the stale subscription. NEVER import or reference this file from a client component — the `no_vapid_private_in_client.py` validator enforces.
  - `client.ts`: `subscribeToBrowserPush()` — `await Notification.requestPermission()`; if 'granted', register `/sw.js`, then `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(NEXT_PUBLIC_VAPID_PUBLIC_KEY) })`, then call `subscribeToPush` server action with the subscription. `unsubscribeFromBrowserPush()` — get current subscription, unsubscribe, call `unsubscribeFromPush` action with the endpoint. Export `urlBase64ToUint8Array` as a helper (standard Web Push base64url-to-bytes converter).
  - `vapid-key.ts`: tiny module exporting `NEXT_PUBLIC_VAPID_PUBLIC_KEY` from `process.env` for use in client.ts. (Could be inline but separating helps the validator.)
- **Actions**:
  - Write all 3 files.
  - Confirm `server.ts` is the ONLY file that touches `VAPID_PRIVATE_KEY`.

### 15. Server action: push (subscribe + unsubscribe)

- **Task ID**: action-push
- **Depends On**: push-lib
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/lib/actions/push.ts`
- **Context**: Two exports:
  - `subscribeToPush(input: PushSubscribeInputT)` — Zod, requireUser, upsert into push_subscriptions (`{ user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent }`). On conflict (user_id, endpoint) → update `created_at` + `user_agent`. Return `{ok:true,data:{}}`.
  - `unsubscribeFromPush(input: PushUnsubscribeInputT)` — Zod, requireUser, delete from push_subscriptions where user_id = user.id AND endpoint = input.endpoint. Return `{ok:true,data:{}}`.
- **Actions**:
  - Write the action file.

### 16. Server action: notification-prefs

- **Task ID**: action-notification-prefs
- **Depends On**: zod-schemas
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/lib/actions/notification-prefs.ts`
- **Context**: One export `updateNotificationPrefs(input: NotificationPrefsUpdateT)` — Zod, requireUser. Read existing `notification_prefs` from profile, merge with input, update profiles set notification_prefs = merged where id = user.id. Return `{ok:true,data:{ notification_prefs: merged }}`. `revalidatePath('/settings/notifications')`.
- **Actions**:
  - Write the action file.

### 17. Service worker

- **Task ID**: service-worker
- **Depends On**: push-lib
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/public/sw.js`
- **Context**: Vanilla JS service worker. Three event handlers:
  - `push`: parse `event.data.json()`, call `self.registration.showNotification(payload.title, { body: payload.body, icon: '/icon-192.png', badge: '/badge-72.png', data: { url: payload.url }, tag: payload.tag })`. (`tag` lets the same notif type collapse — e.g., one "Mila" notif at a time.)
  - `notificationclick`: `event.notification.close()`, then `event.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then((clients) => { for (const c of clients) { if (c.url.includes(url) && 'focus' in c) return c.focus(); } return self.clients.openWindow(url); }))`.
  - `pushsubscriptionchange`: POST the new subscription to `/api/push/refresh` (a route handler that calls subscribeToPush — but for v1, skip this handler if the endpoint POST seems risky; document as TODO).
  - `install`: `self.skipWaiting()`. `activate`: `self.clients.claim()`.
- **Actions**:
  - Write `apps/web/public/sw.js`.
  - No icon files yet — reference `/icon-192.png` and `/badge-72.png` even though they don't exist; the browser falls back to the default. (Or note in the spec that icons are deferred to Phase 13.)

### 18. Client hooks: useUnreadTitle, useRealtimeNotifs, useRealtimeThread

- **Task ID**: realtime-hooks
- **Depends On**: zod-schemas
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/app/_components/use-unread-title.ts`, `apps/web/app/_components/use-realtime-notifs.ts`, `apps/web/app/_components/use-realtime-thread.ts`
- **Context**:
  - `use-unread-title.ts`: `'use client'`. Hook signature `useUnreadTitle(unreadCount: number, baseTitle = 'Hatch')`. In a `useEffect([unreadCount, baseTitle])`, set `document.title = unreadCount > 0 ? \`(${unreadCount}) ${baseTitle}\` : baseTitle`. Tear-down restores `baseTitle`.
  - `use-realtime-notifs.ts`: `'use client'`. Hook `useRealtimeNotifs(userId: string, onInsert: (row: NotificationRow) => void, onBackfill: (rows: NotificationRow[]) => void)`. Inside `useEffect([userId])`, create `supabase.channel('notifs:' + userId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'recipient_id=eq.' + userId }, payload => onInsert(payload.new as NotificationRow)).subscribe()`. **SPEC §8.3 visibilitychange refetch**: also register a `visibilitychange` listener — when `document.visibilityState === 'visible'` AND the page was hidden for > 30s, call `onBackfill(await fetchLatestNotifs(userId, 50))` and resubscribe the channel. Helper `fetchLatestNotifs(userId, limit)` returns the latest 50 rows from `notifications` ordered desc. Tear-down: `supabase.removeChannel(channel)` + `removeEventListener('visibilitychange', handler)`. Use `createSupabaseBrowserClient()` from `@/lib/supabase/client`. The parent (`<NotificationsBell>`) handles the dedupe-by-id when merging backfill into local state.
  - `use-realtime-thread.ts`: `'use client'`. Hook `useRealtimeThread(conversationId: string, onInsert: (row: MessageRow) => void, onBackfill: (rows: MessageRow[]) => void)`. Same pattern as above but channel = `'msgs:' + conversationId` and filter = `'conversation_id=eq.' + conversationId`. Same visibilitychange refetch via `fetchLatestMessages(conversationId, 50)` helper.
- **Actions**:
  - Write all 3 hook files.

### 19. NotificationsBell wrapper + toast + push-permission-prompt + service-worker-registrar

- **Task ID**: bell-and-toast
- **Depends On**: realtime-hooks, action-notifications, port-notifications-panel, port-notification-item
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/app/_components/notifications-bell.tsx`, `apps/web/app/_components/notification-toast.tsx`, `apps/web/app/_components/push-permission-prompt.tsx`, `apps/web/app/_components/service-worker-registrar.tsx`
- **Context**:
  - `notifications-bell.tsx`: `'use client'`. Props `{ userId: string, initialUnread: number, initialNotifs: NotificationRow[] }`. State: `open` (boolean), `unread` (number, init from initialUnread), `notifs` (array, init from initialNotifs). Renders a button with the bell icon (use existing `<Icon name="bell">` if available in `_components/icons.tsx`, else inline an SVG matching the prototype's bell glyph). If `unread > 0`, render a badge `<span className="bell-badge">{unread > 99 ? '99+' : unread}</span>`. On click, toggle `open`. When `open`, render `<NotificationsPanel open={open} notifs={notifs} onAction={handleAction} onClose={()=>setOpen(false)} onAll={handleMarkAll} />` — position absolutely below the bell. Wire `useRealtimeNotifs(userId, (newRow) => { setNotifs(prev=>[newRow,...prev].slice(0,20)); setUnread(u=>u+1); /* fire toast based on kind */ })`. Wire `useUnreadTitle(unread)`. `handleAction(id, action)` calls `acceptContactRequest` / `declineContactRequest` actions based on action. `handleMarkAll` calls `markAllRead`.
  - `notification-toast.tsx`: minimal wrapper around `sonner` Toaster — `'use client'`, exports `<NotificationToaster />` that renders `<Toaster position="top-right" />`. Mounted at root layout. Toasts fired via `toast(...)` from the realtime hook.
  - `push-permission-prompt.tsx`: `'use client'`. Props `{ userId: string, hasPushEnabled: boolean }`. If `Notification.permission !== 'default' || hasPushEnabled`, render null. Else render a tiny inline card: "🔔 Get notified about new contact requests" + "Enable" / "Not now" buttons. On "Enable" click → `subscribeToBrowserPush()` from `@/lib/push/client`. On "Not now" → sets `localStorage.setItem('hatch-push-prompt-dismissed', '1')` and renders null on next mount.
  - `service-worker-registrar.tsx`: `'use client'`. On mount, if `'serviceWorker' in navigator`, register `/sw.js`. Renders null. Mounted at root layout (after `NotificationToaster`).
- **Actions**:
  - Write all 4 files.
  - Confirm bell badge styling — if `prototype-contact.css` already defines `.bell-badge`, use that class verbatim; if not, define a small `<style jsx global>` snippet inline in the bell file (or add to globals.css with a one-liner — confirm with the project's CSS conventions).

### 20. /notifications route

- **Task ID**: route-notifications
- **Depends On**: action-notifications, bell-and-toast
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true (parallel with task 22, 23)
- **Owns Files**: `apps/web/app/notifications/page.tsx`, `apps/web/app/notifications/_components/notifications-page.tsx`
- **Context**:
  - `page.tsx` (RSC, signed-in only): call `requireUser()` (redirect to /sign-in?next=/notifications on failure). Call `getNotifications({})` to fetch first 20. Pass result + user.id to `<NotificationsPage>` client component.
  - `_components/notifications-page.tsx`: PLAN APPROVAL gate. Implements filter tabs (URL state via searchParams), cursor pagination, optimistic mark-as-read on click, realtime live-prepend via `useRealtimeNotifs`. See Plan-Approval gates section above for the plan submission requirement.
- **Actions**:
  - Write `page.tsx`.
  - Submit plan, then write `notifications-page.tsx`.

### 21. /notifications page client component [PLAN APPROVAL]

- **Task ID**: route-notifications-client
- **Depends On**: route-notifications
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: false
- **Owns Files**: `apps/web/app/notifications/_components/notifications-page.tsx` (same file as task 20 — task 20 just stubs it, task 21 fills it in after plan approval)
- **Plan Approval**: YES — submit a short plan first covering: (1) URL state for filter tab, (2) cursor pagination data flow (initial 20 from RSC, fetch next 20 via `getNotifications({cursor})`), (3) realtime conflict resolution (incoming INSERT might duplicate if user just hit "load more"; key by `notification.id` and dedupe), (4) optimistic mark-as-read (instant UI dim, rollback on error), (5) empty state markup.
- **Context**: See task 20 owns-files note.
- **Actions**:
  - Submit plan.
  - Implement on approval.

### 22. /messages route — list page + thread page

- **Task ID**: route-messages
- **Depends On**: action-messages, action-contact-requests
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/app/messages/page.tsx`, `apps/web/app/messages/_components/conversations-list.tsx`, `apps/web/app/messages/_components/empty-thread.tsx`, `apps/web/app/messages/[conversationId]/page.tsx`, `apps/web/app/messages/[conversationId]/_components/message-thread.tsx`
- **Context**:
  - `page.tsx`: requireUser, fetch conversations the user is in. PostgREST query: `from('conversations').select('id, last_message_at, participant_a:profiles!participant_a(*), participant_b:profiles!participant_b(*), messages(id, body, created_at, sender_id, read_at)').or(\`participant_a.eq.${userId},participant_b.eq.${userId}\`).order('last_message_at', {ascending:false, nullsLast: true}).limit(50)`. For each row, derive `other = participant_a.id === userId ? participant_b : participant_a`+`lastMessage = messages[0]`+`unreadCount = messages.filter(m => m.sender_id !== userId && m.read_at == null).length`. Render 2-pane layout with `<ConversationsList>`on left and`<EmptyThread>` on right.
  - `[conversationId]/page.tsx`: requireUser, fetch the conversation (RLS auto-filters), fetch last 50 messages, derive `other`. Render layout with `<ConversationsList>` on left (re-uses same component) + `<MessageThread>` on right. Call `markConversationRead(conversationId)` AFTER render via a small client effect (or via a server action triggered by `<form>` on visibility).
  - `_components/conversations-list.tsx`: `'use client'`. Renders list. Highlight active conversation. Click → `<Link href={'/messages/' + id}>`.
  - `_components/empty-thread.tsx`: simple empty state with "Select a conversation" or "You haven't started any conversations yet — accept a contact request to begin." copy.
  - `[conversationId]/_components/message-thread.tsx`: PLAN APPROVAL — see Plan-Approval gates section.
- **Actions**:
  - Write list page + conversations-list + empty-thread.
  - Write thread page (RSC skeleton).
  - For message-thread.tsx, submit plan first (covered in task 24).

### 23. /settings/notifications route

- **Task ID**: route-settings-notifications
- **Depends On**: action-notification-prefs, push-lib
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: true
- **Owns Files**: `apps/web/app/settings/notifications/page.tsx`, `apps/web/app/settings/notifications/_components/notifications-form.tsx`
- **Context**:
  - `page.tsx`: RSC, requireUser, read `result.profile.notification_prefs`. Pass to `<NotificationsForm initialPrefs={...} />`.
  - `_components/notifications-form.tsx`: `'use client'`. RHF + Zod (`NotificationPrefsUpdate`). Master toggle "Enable browser notifications" → on toggle to `true`: call `subscribeToBrowserPush()` from `@/lib/push/client`, only set `push_enabled: true` if browser-side subscription succeeded. On toggle to `false`: call `unsubscribeFromBrowserPush()`. Per-kind toggles (Likes, Follows, Comments, Messages, Contact requests) — disabled if master is off. Save button → `updateNotificationPrefs(formData)`. Toast on success/error.
- **Actions**:
  - Write both files.

### 24. /messages/[id] message-thread client component [PLAN APPROVAL]

- **Task ID**: message-thread-client
- **Depends On**: route-messages
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: false
- **Owns Files**: `apps/web/app/messages/[conversationId]/_components/message-thread.tsx`
- **Plan Approval**: YES — submit a short plan covering: (1) optimistic message lifecycle (push placeholder bubble immediately, replace with real row when server action returns, rollback on error), (2) auto-scroll behavior matrix (new message + I'm at bottom → auto-scroll; new message + I'm scrolled up → don't scroll, show "↓ new messages" pill), (3) realtime sub setup/teardown via `useRealtimeThread`, (4) Cmd+Enter handler (Enter inserts newline, Cmd+Enter sends), (5) sending state UX (disable send button + show spinner; preserve textarea content on error), (6) read-receipt update — call `markConversationRead` after mount + after scrollback completes loading.
- **Context**: See plan-approval gate above.
- **Actions**:
  - Submit plan.
  - Implement on approval.

### 25. ContactCTA wrapper + Shell bell-slot edit

- **Task ID**: contact-cta-and-shell
- **Depends On**: port-contact-modal, action-contact-requests, bell-and-toast
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: false
- **Owns Files**: `apps/web/app/a/[slug]/_components/contact-cta.tsx`, `apps/web/app/_components/shell.tsx` (the bell-slot edit only, one-region surgical addition)
- **Context**:
  - `contact-cta.tsx`: `'use client'`. Props `{ app, author, viewer }`. State: `open` (boolean). Renders the existing "Contact me" button styling (read the current detail page to find the trigger button — `apps/web/app/a/[slug]/page.tsx`'s author-side section). On click, set `open=true`. Renders `<ContactModal open={open} app={app} author={author} viewer={viewer} onClose={()=>setOpen(false)} onSubmit={async (data) => { await sendContactRequest({appId: app.id, recipientId: author.id, ...data, consent: true}); }} />`. Replace the current "Contact me" stub button in `apps/web/app/a/[slug]/page.tsx` with `<ContactCTA app={app} author={author} viewer={viewer} />` — viewer comes from `getUser()`.
  - Shell edit: in `apps/web/app/_components/shell.tsx`, add `bell?: React.ReactNode` to the Shell props destructure. In the JSX, between the `<button className="theme-toggle">...</button>` close tag and the `<button className="me-btn">` open tag, insert `{bell}` — exactly matching `prototype/apps-gallery/shell.jsx:67`. This is the ONLY shell.tsx edit; one location, one slot. The verbatim port discipline applies (the slot matches the prototype source).
- **Actions**:
  - Write `contact-cta.tsx`.
  - Edit `apps/web/app/a/[slug]/page.tsx` to mount it (or to keep RSC pattern, this edit lives in the page; otherwise create a tiny client subtree at the author-side).
  - Edit `shell.tsx` to add the bell prop + slot.

### 26. Layout wiring — pass NotificationsBell + Toaster + ServiceWorkerRegistrar

- **Task ID**: layout-wiring
- **Depends On**: bell-and-toast, contact-cta-and-shell
- **Assigned To**: build-agent
- **Agent Type**: `build-agent`
- **Parallel**: false
- **Owns Files**: `apps/web/app/layout.tsx`
- **Context**: Edit `apps/web/app/layout.tsx` to:
  - Add CSS import: `import './styles/phase6.css';` AFTER the existing `import './styles/prototype-contact.css';` line. This is the file task 0 created on disk; this edit makes it part of the bundle.
  - Compute `initialUnread` server-side (only if signed in): `const { count: initialUnread = 0 } = await sb.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient_id', user.id).is('read_at', null);`. Fetch first 20 notifs via `getNotifications({})` so the dropdown opens without a fetch.
  - Pass `bell={signedIn ? <NotificationsBell userId={user.id} initialUnread={initialUnread} initialNotifs={initialNotifs} /> : null}` to `<Shell>`.
  - Mount `<NotificationToaster />` + `<ServiceWorkerRegistrar />` + `<PushPermissionPrompt userId={user.id} hasPushEnabled={profile.notification_prefs.push_enabled} />` (only if signed-in) at the layout level, inside the body but outside the Shell main content.
- **Actions**:
  - Edit `layout.tsx`.

### 27. Seed sample data

- **Task ID**: seed-phase6
- **Depends On**: apply-migrations
- **Assigned To**: db-agent
- **Agent Type**: `db-agent`
- **Parallel**: true (parallel with all Wave B/C/D tasks)
- **Owns Files**: `packages/db/migrations/0018_phase6_seed.sql`
- **Context**: Write seed data using the existing 10 seed users `aaaaaaaa-0000-0000-0000-00000000000{1..a}` from `0008_apps_seed.sql` and the 12 seeded apps from the same file. Targets:
  - 5 `contact_requests` rows: 3 pending (audrey/marco-equivalents → mila for pixel-sushi), 1 accepted (greta → mila, status='accepted', conversation_id pointing to a real conversation), 1 declined. Use seed user UUIDs.
  - 3 `conversations` rows with 5-10 messages each (one from the accepted contact_request, two organic). Vary `last_message_at` so the list ordering is interesting.
  - 20-30 `notifications` rows seeded EXPLICITLY (we don't want to fire the triggers from seed because that creates write-amplification — instead bypass triggers via `set session_replication_role = 'replica'` around the inserts, then reset). The 20-30 rows span all 8 kinds, varying read/unread, varying ages (some "Just now", some "2h ago", etc., via different `created_at` values).
  - Update 3 seed users' `notification_prefs jsonb` to varied states so visual testing can exercise the per-kind toggle UI: e.g., user `aaaaaaaa-...-0001` (mila) has `push_enabled = true, push_messages = true, push_contact_requests = true, push_likes = false`; user `aaaaaaaa-...-0002` (juno) has `push_enabled = false` (everything off); user `aaaaaaaa-...-0003` (rafa) has `push_enabled = true, push_likes = true, push_comments = true, push_messages = true, push_follows = true, push_contact_requests = true` (everything on).
  - NO push_subscriptions seed (those are per-device per-user; can't fake).
- **Actions**:
  - Write the migration.
  - Apply it via `mcp__supabase__apply_migration`.

### 28. UI validation — Playwright section diff + typecheck/lint/build + RLS check

- **Task ID**: validate-all
- **Depends On**: route-notifications-client, route-messages, route-settings-notifications, message-thread-client, layout-wiring, seed-phase6
- **Assigned To**: ui-validator
- **Agent Type**: `ui-validator`
- **Parallel**: false
- **Owns Files**: `agents/pair3/review_agent/review_img/*.png`
- **Context**: Start dev server (`pnpm dev:web` in background, poll until :3000 returns 200). Open `file:///<repo>/prototype/apps-gallery/Hatch - Apps Gallery.html` in one Playwright tab, viewport 1440×900; open `http://localhost:3000` in another tab, sign in if needed (or use existing seed-user session — but OAuth-only so likely visual diff for the ported components only). Capture and diff:
  - `<NotificationsPanel>` rendered via the topbar bell button. Critical selectors: `.notifs`, `.notifs-head`, `.notifs-tabs`, `.notifs-tab.is-on`, `.notifs-list`, `.notif-item`. 0 pixel delta required.
  - `<NotificationItem>` (both branches: contact + mini) rendered inside the panel. Critical: `.notif-contact.is-unread`, `.notif-mini`, `.notif-role`, `.notif-app-dot`, `.notif-actions`, `.notif-btn`, `.notif-x`.
  - `<ContactModal>` opened via the detail page's Contact CTA. Critical: `.cmodal-scrim`, `.cmodal`, `.cmodal-head`, `.cm-roles`, `.cm-role.is-on`, `.cm-textarea`, `.cm-warn`, `.cm-consent`, `.cmodal-foot`. 0 pixel delta required.
  - For NEW (non-port) surfaces: `/notifications`, `/messages`, `/settings/notifications` — capture full-page screenshots for the human review record but DO NOT require pixel-diff against anything (they're net-new).
  - Run validation commands (`pnpm typecheck`, `pnpm lint`, `pnpm build`) — each must exit 0.
  - RLS check via `mcp__supabase__execute_sql`: confirm rowsecurity=true on all 5 new tables + the 5 old tables.
  - **Smoke run via Playwright** (NOT via `mcp__supabase__execute_sql` — server actions are Node code in Next.js, not Postgres functions, so SQL cannot reach them). Use the running dev server + an authenticated Playwright tab (sign in via OAuth happens out-of-band; for this validation either (a) the user pre-signs-in once and the ui-validator picks up the existing session cookie via `mcp__playwright__browser_get_cookies`, OR (b) ui-validator opens `/sign-in` and waits for the user to complete OAuth manually — the spec accepts this manual step for v1 because OAuth-headless is out of scope). Drive each action via its UI: post a contact request from a detail page, accept it from the bell, send a message in the resulting conversation, mark as read, mark notification read, toggle push prefs in /settings/notifications. Confirm each UI action completes without a console error and the resulting DB row exists (verify each via `mcp__supabase__execute_sql` SELECT). If headless OAuth is impossible, the validator reports `success: true` for the visual-diff portion and `success: skipped_smoke` for the action portion, with a notes block listing which actions could not be exercised — this matches the precedent set in Pair 2's /publish auth gate.
  - Save all PNGs to `agents/pair3/review_agent/review_img/` numbered `01_notifs_panel_local.png` / `01_notifs_panel_prototype.png`, etc.
  - Return JSON: `{success, review_summary, review_issues:[{number, screenshot_path, description, resolution, severity}], screenshots:[abs_paths]}`. `success=false` only if pixel deltas on critical selectors OR if any validation command failed OR if RLS check shows any new table with `rowsecurity=false`.
- **Actions**:
  - All of the above.

### 29. Final expert self-improvement

- **Task ID**: experts-self-improve
- **Depends On**: validate-all
- **Assigned To**: orchestrator (main thread)
- **Agent Type**: N/A — executed by the `/tac:implement` orchestrator directly, NOT delegated to a subagent. The `/experts:*:self-improve` skill is invoked via the Skill tool which lives on the main session, not in build-agent's tool list.
- **Parallel**: false
- **Owns Files**: `.claude/commands/experts/supabase/expertise.yaml`, `.claude/commands/experts/nextjs/expertise.yaml`
- **Context**: After all implementation tasks complete and validation passes, run the expert self-improvement commands so future planning has accurate context:
  - `/experts:supabase:self-improve` — refresh with: 5 new tables, `is_participant` helper fn, `find_or_create_conversation` fn, 6 fan-out triggers, Realtime channel patterns (`notifs:userId` postgres_changes, `msgs:conversationId` postgres_changes), the Web Push send pattern using `web-push` lib.
  - `/experts:nextjs:self-improve` — refresh with: Realtime subscription hook pattern in `_components/use-realtime-*.ts`, service-worker registration via client component, Web Push opt-in flow (browser permission → service worker → pushManager → server action), 3 new routes (/notifications, /messages, /settings/notifications), sonner Toaster mounted at root, `useUnreadTitle` hook.
- **Actions**:
  - Run both self-improve commands.
  - Verify the YAMLs reflect the actual shipped patterns.

## Testing Strategy

### Unit tests

No Vitest/Jest harness in this repo (consistent with Pair 1 + Pair 2). Behavior validated end-to-end via:

- TypeScript checker (`pnpm typecheck`) — enforces server action signatures + RPC return types + Zod-inferred input types.
- Production build (`pnpm build`) — catches "use client" / "use server" boundary violations + import cycles.
- ESLint (`pnpm lint --max-warnings=0`) — catches React hook misuse + unused imports.
- Playwright section-diff (task 28) — pixel-perfect verification of the 3 ported components.
- RLS checklist (task 28 via `mcp__supabase__execute_sql`) — confirms RLS enabled on all 5 new tables.
- Server action smoke run (task 28) — confirms each action returns `{ok:true,...}` for valid input.

### Edge cases

- **Self-notification suppression**: liking your own app, commenting on your own app, following yourself (blocked by check constraint anyway), commenting reply to your own comment — none should create a notification. Verified by trigger logic + smoke run.
- **Trigger fires on UPDATE-without-status-change**: `notify_on_contact_request_update` fires ONLY when `old.status = 'pending' AND new.status IN ('accepted','declined')` — other UPDATEs (e.g., recipient editing their own profile somehow touching a contact_request) must not create notifications.
- **Stale push subscription (410 Gone)**: `pushToUser` catches the 410 statusCode and deletes the stale row. Verified manually by simulating a 410 response.
- **Push fan-out without subscription**: `pushToUser(user, payload)` when the user has no `push_subscriptions` rows is a no-op — confirmed by SELECT-then-loop pattern; no error thrown.
- **Realtime channel duplicates a row that just came from the same client's INSERT**: dedupe by `notification.id` in the local state setter.
- **Markdown-style XSS in message body**: messages are rendered as plain text (NOT `<ReactMarkdown>`) for v1 — confirmed by `<MessageBubble>` rendering `{body}` directly inside a `<p>`.
- **conversations.participant_a < participant_b violation**: `find_or_create_conversation(user_a, user_b, app)` computes `lo = least(user_a, user_b)` and `hi = greatest(user_a, user_b)` and inserts in canonical order. Direct INSERT is blocked by RLS (no client policy), so the only path is via the SECURITY DEFINER function. Verified.
- **Cmd+Enter vs Enter**: Enter inserts a newline; Cmd+Enter (or Ctrl+Enter on non-Mac) sends. Verified in message-thread Cmd+Enter handler.
- **Service worker not registered before push subscribe**: `subscribeToBrowserPush` ALWAYS awaits `navigator.serviceWorker.register('/sw.js')` before calling `pushManager.subscribe`. Idempotent — re-register is a no-op.
- **Anonymous user clicks bell** (won't happen because bell only renders when signedIn, but defense in depth): `getNotifications` action returns `{ok:false,error:'unauthorized'}` if `requireUser` throws.

## Acceptance Criteria

- All 5 new migrations apply without errors via `mcp__supabase__apply_migration`.
- TypeScript types regenerated in `apps/web/lib/supabase/types.ts`, `pnpm typecheck` exits 0.
- `mcp__supabase__execute_sql` confirms `rowsecurity = true` on `contact_requests`, `conversations`, `messages`, `notifications`, `push_subscriptions`.
- `mcp__supabase__get_advisors({type:'security'})` returns no new advisories.
- 3 ported components (`<NotificationsPanel>`, `<NotificationItem>`, `<ContactModal>`) pass Playwright section-diff with 0 pixel delta on critical selectors at 1440×900.
- 3 new routes (`/notifications`, `/messages`, `/settings/notifications`) load without runtime errors when signed in; redirect to `/sign-in?next=...` when anon.
- Bell badge updates in real time when a notification is inserted into the database (manual test: insert a notif via Supabase MCP for the signed-in user; bell count increments within ~1s).
- Sending a contact_request fires (a) the bell badge for the recipient, (b) a toast, (c) a Web Push notification (if push enabled).
- Sending a message in an existing conversation updates the other participant's `/messages` last-message preview, bell badge, and (if push enabled) fires a Web Push.
- `/settings/notifications` master toggle ON → calls `Notification.requestPermission()` and registers the service worker; OFF → unsubscribes.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` all exit 0.
- Smoke run: each new server action returns `{ok:true,...}` for valid input.

## Validation Commands

Execute every command to validate the feature works correctly with zero regressions.

- `pnpm typecheck` — TypeScript checks across all workspaces; must exit 0.
- `pnpm lint` — ESLint + Prettier; must exit 0.
- `pnpm build` — production build of all workspaces; must exit 0.
- `mcp__supabase__execute_sql({ project_id: 'vcbdtjjkkwryvmqbflah', query: "select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename" })` — confirm RLS on all 5 new tables.
- `mcp__supabase__get_advisors({ project_id: 'vcbdtjjkkwryvmqbflah', type: 'security' })` — confirm no new security advisories.
- `mcp__supabase__list_tables({ schemas: ['public'] })` — confirm all 5 new tables exist with correct columns.
- Playwright section diff via `mcp__playwright__browser_take_screenshot` + `mcp__playwright__browser_evaluate` for getBoundingClientRect on critical selectors — 0 delta required on `.notifs`, `.notifs-head`, `.notifs-tab.is-on`, `.notif-item`, `.notif-contact.is-unread`, `.notif-mini`, `.cmodal`, `.cmodal-head`, `.cm-roles`, `.cm-role.is-on`, `.cm-warn`.
- Smoke run via Playwright UI interactions (NOT via `mcp__supabase__execute_sql` — server actions are Node code, not SQL functions). Drive each action through the actual UI: post a contact request from `/a/<slug>`, accept it from the bell dropdown, send a message in the resulting `/messages/<id>` thread, mark conversation read by viewing the thread, mark a notification read by clicking it, toggle push prefs in `/settings/notifications`. For each, verify the resulting DB row via `mcp__supabase__execute_sql` SELECT. If OAuth sign-in is impossible headlessly, ui-validator reports the smoke portion as `skipped_smoke` with a list of unexercised actions — visual-diff portion still must pass.

## Notes

- **New dependencies** (added via `pnpm --filter @hatch/web add`):
  - `web-push@^3.6.7` — server-side VAPID push send.
  - `@types/web-push` (dev) — TypeScript types for `web-push`.
  - `sonner@^1.7.0` — toast notifications (small, framework-agnostic, no portal headaches).
- **Env vars added** (to `.env.sample`):
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — exposed to browser, used by `pushManager.subscribe`.
  - `VAPID_PRIVATE_KEY` — SERVER ONLY, used by `web-push.setVapidDetails`. Leak protection enforced by `no_vapid_private_in_client.py` validator.
- **Migrations applied to cloud project** `vcbdtjjkkwryvmqbflah` via `mcp__supabase__apply_migration` only — never `supabase db push` or CLI per CLAUDE.md hard constraint.
- **Web Push behavior on iOS Safari**: requires the site to be installed as a PWA (added to home screen). The opt-in prompt only succeeds on iOS for installed PWAs. Documented as a known v1 limitation.
- **Service worker scope**: served from `/sw.js` at the root; controls all paths under `/`. No `Service-Worker-Allowed` header gymnastics needed.
- **Future Phase 13 polish**: icon files at `/icon-192.png` and `/badge-72.png` are referenced by sw.js but don't exist yet — browsers fall back to default icons. Deferred to Phase 13.
- **Future Phase 9 dependency**: the MCP server needs to read messages + notifications via API keys; this plan does NOT touch `apps/mcp/`. Phase 9 will add the read-side endpoints + `api_keys` table.
- **The roadmap §5.3 surfacing table** ("Notif kind → Toast / Bell / Push" matrix) IS implemented in this plan: `use-realtime-notifs.ts` decides toast firing per kind; `notifications-bell.tsx` always renders all kinds in the dropdown; push is fired in server actions for only `contact_request` + `message` per locked decision.
- **No SPEC.md edits** in this plan — the spec already designed everything we need in §4.6, §4.7, §5.1, §5.2. We only consume it.
- **Deviation from SPEC §4.7 (intentional, locked decision)**: SPEC.md:619 says "Triggers for `like` / `comment` / `comment_reply` / `follow` are cleanest. Server actions for `contact_*` and `message` so we can also fire the Resend email in the same code path." This plan overrides: all 6 fan-out paths use Postgres triggers (DB-consistent). Server actions ONLY layer Web Push HTTP for `contact_request` + `message`. Rationale: Phase 8 email is cut, so the SPEC's reason for app-layer fan-out (shared Resend code path) no longer applies. Triggers guarantee notification consistency even if a server action crashes between DB write and post-write logic.
- **Pixel tolerance for visual diff** (task 28): the user's `feedback_prototype_is_spec` rule mandates "0 pixel delta". In practice anti-aliasing on different platforms (font rasterizers, sub-pixel rendering) yields ~0.1% pixel deltas on rendered text. Acceptable tolerance: bounding-box delta ≤ 1 px in width/height/position (rounded), computed-style delta of 0 (font-family, color, padding, gap MUST match exactly). Any selector failing this is a blocker per the user's rule.
- **`/api/push/refresh` route handler** (referenced by sw.js `pushsubscriptionchange` handler in task 17): DEFERRED to Phase 13. For v1, the sw.js handler logs a console warning and does nothing; users who get a stale subscription must re-toggle the master push toggle in `/settings/notifications` to re-subscribe. This is acceptable because `pushsubscriptionchange` fires rarely (key rotation on the browser side, ~once per year).
- **Service worker scope and auth interference**: `/sw.js` registers at root scope `/` and therefore controls all routes including `/auth/callback`. The SW only listens to `push`, `notificationclick`, `pushsubscriptionchange`, `install`, `activate` events — it does NOT intercept `fetch` events, so OAuth redirects flow through normally. Documented for posterity.
- **RLS auto-filter + explicit `or()` in task 22**: PostgREST `.or('participant_a.eq.${uid},participant_b.eq.${uid}')` is technically redundant because RLS already filters `conversations` by participant. The explicit `or()` is kept for clarity (so the query reads correctly without depending on out-of-band knowledge of RLS) AND defense in depth (if a future RLS change accidentally widens the policy, the client-side filter still narrows correctly).
