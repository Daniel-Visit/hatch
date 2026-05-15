-- Phase 1 hardening fixup: PUBLIC has a default EXECUTE grant on
-- handle_new_user. Revoke it so the function can't be invoked via
-- /rest/v1/rpc/. The trigger still fires because it runs as table owner.

revoke execute on function public.handle_new_user() from public;
