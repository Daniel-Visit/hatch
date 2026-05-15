// Phase 0 stub. Phase 1 (auth) replaces this with @supabase/ssr cookie-bound client.
// See SPEC.md §6.2 and §7.3.

export async function createSupabaseServerClient(): Promise<never> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      '[supabase/server] NEXT_PUBLIC_SUPABASE_URL is not set. ' +
        'Phase 1 wires this stub to @supabase/ssr.',
    );
  }
  throw new Error(
    '[supabase/server] not implemented in Phase 0. ' + 'Phase 1 implements per SPEC.md §6.2.',
  );
}
