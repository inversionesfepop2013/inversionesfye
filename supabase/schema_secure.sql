CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number TEXT NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  doc_type TEXT NOT NULL DEFAULT 'cedula',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  email TEXT NOT NULL,
  otp_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  reason TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS withdrawal_requests_set_updated_at ON public.withdrawal_requests;
CREATE TRIGGER withdrawal_requests_set_updated_at
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "profiles_read_authenticated"
ON public.profiles
FOR SELECT
USING (true);

CREATE POLICY "profiles_write_authenticated"
ON public.profiles
FOR INSERT
WITH CHECK (true);

CREATE POLICY "profiles_update_authenticated"
ON public.profiles
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "contact_messages_insert_public"
ON public.contact_messages
FOR INSERT
WITH CHECK (true);

CREATE POLICY "withdrawal_requests_insert_public"
ON public.withdrawal_requests
FOR INSERT
WITH CHECK (true);

CREATE POLICY "admin_actions_insert_admin"
ON public.admin_actions
FOR INSERT
WITH CHECK (true);
