-- Shakti least-privilege boundary for credential lifecycle mutation.
-- Runtime routes mutate only lifecycle status. Authority/value fields are not
-- writable through the generic runtime role.
revoke update on public.credentials from rupaykg_app_runtime;
grant update (status) on public.credentials to rupaykg_app_runtime;


-- Shakti least-privilege safety: runtime must not delete credentials.
-- Lifecycle mutation is status-only; authority/value fields remain non-writable.
revoke delete on public.credentials from rupaykg_app_runtime;
