# Prototype-Port Exception

`.claude/rules/frontend-components.md` mandates Tailwind utility classes and forbids inline styles. This exception scopes that rule OUT for the prototype port.

## Scope of exception

The following paths are byte-for-byte ports of `prototype/apps-gallery/`. They MUST keep their original CSS class strings, inline `style={{...}}` props, and JSX structure:

- `apps/web/app/_components/*.tsx` (icons, app-art, cards, shell, theme-controller, markdown)
- `apps/web/app/styles/prototype-*.css` (verbatim copies of prototype CSS)
- `apps/web/app/page.tsx` (gallery wired to Supabase)
- `apps/web/app/a/[slug]/page.tsx` (detail wired to Supabase)
- `apps/web/app/u/[handle]/page.tsx` (profile wired to Supabase)
- `apps/web/app/c/[category]/page.tsx` (category-filtered gallery)
- `apps/web/app/_components/notifications-panel.tsx`
- `apps/web/app/_components/notification-item.tsx`
- `apps/web/app/_components/contact-modal.tsx`
- `apps/web/app/_landing/*.tsx` (all landing sections — atoms, hero, bento, agents, footer, etc.)
- `apps/web/app/_landing/bento/*.tsx` (5 bento vis cells)
- `apps/web/app/(shell)/wanted/**/*.tsx` (refiner UI — verbatim port of mockups.html #refiner)
- `apps/web/app/styles/wanted.css` (verbatim CSS from the #refiner mockup)

For these files:
- Tailwind utility classes are FORBIDDEN.
- Inline `style={{...}}` is REQUIRED where the prototype uses it.
- CSS classNames must match the prototype source byte-for-byte.

For all OTHER `apps/web/**` files (e.g., auth pages, future non-prototype features), `.claude/rules/frontend-components.md` applies normally — Tailwind is the rule.

## Rationale

The user explicitly chose this trade-off: the prototype is the spec, not a guide. See the user-memory note `feedback_prototype_is_spec`. Pixel-for-pixel reproduction would be impossible without preserving the CSS-classes-and-inline-styles approach.
