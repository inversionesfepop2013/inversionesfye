-- Migration for the customer balances endpoint.
-- Existing account data is read from public.fye_account_balances, populated by the internal panel.
-- The service-role key is server-only; customers must not query this table with a public key.

ALTER TABLE public.fye_account_balances ENABLE ROW LEVEL SECURITY;

-- Keep authorization in the API using Supabase Auth and the server-side service role.
-- Do not create public SELECT policies on this financial table.

CREATE INDEX IF NOT EXISTS fye_account_balances_owner_status_idx
ON public.fye_account_balances (owner_profile_id, status);

CREATE INDEX IF NOT EXISTS fye_account_balances_opened_on_idx
ON public.fye_account_balances (owner_profile_id, opened_on);
