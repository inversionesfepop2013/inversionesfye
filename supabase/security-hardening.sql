-- Production hardening migration. Review duplicates before applying unique indexes.
-- This migration does not expose customer data to anon/authenticated roles.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  details text,
  ip_address inet,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid NOT NULL UNIQUE
);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_logs FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0)
);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.fye_consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  current_row public.api_rate_limits%ROWTYPE;
BEGIN
  IF p_key IS NULL OR length(p_key) > 200 OR p_limit < 1 OR p_window_seconds < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.api_rate_limits(bucket_key, window_started_at, request_count)
  VALUES (p_key, now(), 1)
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT * INTO current_row
  FROM public.api_rate_limits
  WHERE bucket_key = p_key
  FOR UPDATE;

  IF current_row.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN
    UPDATE public.api_rate_limits
    SET window_started_at = now(), request_count = 1
    WHERE bucket_key = p_key;
    RETURN true;
  END IF;

  IF current_row.request_count >= p_limit THEN
    RETURN false;
  END IF;

  UPDATE public.api_rate_limits
  SET request_count = request_count + 1
  WHERE bucket_key = p_key;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.fye_consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fye_consume_rate_limit(text, integer, integer) TO service_role;

-- Enforce uniqueness for registered profile identity fields when populated.
-- Any duplicate rows must be resolved before these indexes can be created.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_ci
  ON public.profiles (lower(btrim(email))) WHERE email IS NOT NULL AND btrim(email) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_digits
  ON public.profiles (regexp_replace(phone, '\\D', '', 'g')) WHERE phone IS NOT NULL AND regexp_replace(phone, '\\D', '', 'g') <> '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='document_number'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS profiles_document_number_unique_ci ON public.profiles (upper(regexp_replace(btrim(document_number), ''[^A-Za-z0-9]'', '''', ''g''))) WHERE document_number IS NOT NULL AND btrim(document_number) <> ''''';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='cedula'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS profiles_cedula_unique_ci ON public.profiles (upper(regexp_replace(btrim(cedula), ''[^A-Za-z0-9]'', '''', ''g''))) WHERE cedula IS NOT NULL AND btrim(cedula) <> ''''';
  END IF;
END $$;

-- Important: only the server-side service role can write audit logs or use the rate limiter.
