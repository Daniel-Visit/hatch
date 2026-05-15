// Phase 0 stub. Phase 1+ replaces with service-role client for server actions
// and webhooks ONLY. Never import this from a client component.

export function createSupabaseAdminClient(): never {
  throw new Error(
    '[supabase/admin] not implemented in Phase 0. ' + 'Phase 1 implements per SPEC.md §7.3.',
  );
}
