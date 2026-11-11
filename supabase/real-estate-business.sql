-- Real Estate plans, trial and listing lifecycle.
-- Review existing duplicate/legacy rows and confirm property currency conventions before applying.

CREATE TABLE IF NOT EXISTS public.real_estate_trials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > started_at)
);
ALTER TABLE public.real_estate_trials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS real_estate_trials_owner_read ON public.real_estate_trials;
CREATE POLICY real_estate_trials_owner_read ON public.real_estate_trials
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.real_estate_trials FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.real_estate_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('searcher', 'publisher')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  amount_usd numeric(8,2) NOT NULL CHECK (amount_usd IN (0.50, 1.00)),
  starts_at timestamptz,
  ends_at timestamptz,
  provider text,
  provider_reference text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((plan = 'searcher' AND amount_usd = 0.50) OR (plan = 'publisher' AND amount_usd = 1.00)),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS real_estate_subscriptions_user_status_idx
  ON public.real_estate_subscriptions(user_id, status, ends_at DESC);
ALTER TABLE public.real_estate_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS real_estate_subscriptions_owner_read ON public.real_estate_subscriptions;
CREATE POLICY real_estate_subscriptions_owner_read ON public.real_estate_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.real_estate_subscriptions FROM anon, authenticated;

-- A trial is created exactly once for each NEW Auth account after this trigger is installed.
CREATE OR REPLACE FUNCTION public.fye_start_real_estate_trial()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
BEGIN
  INSERT INTO public.real_estate_trials(user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS fye_real_estate_trial_on_signup ON auth.users;
CREATE TRIGGER fye_real_estate_trial_on_signup
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.fye_start_real_estate_trial();
REVOKE ALL ON FUNCTION public.fye_start_real_estate_trial() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fye_real_estate_entitlement()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE
  uid uuid := auth.uid();
  trial_end timestamptz;
  search_end timestamptz;
  publish_end timestamptz;
  in_trial boolean := false;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('authenticated', false, 'trial_active', false,
      'can_view_premium', false, 'can_publish', false, 'access_level', 'economic_only');
  END IF;
  SELECT ends_at INTO trial_end FROM public.real_estate_trials WHERE user_id = uid;
  in_trial := trial_end IS NOT NULL AND now() < trial_end;
  SELECT max(ends_at) INTO search_end FROM public.real_estate_subscriptions
    WHERE user_id = uid AND status = 'active' AND starts_at <= now() AND ends_at > now() AND plan IN ('searcher','publisher');
  SELECT max(ends_at) INTO publish_end FROM public.real_estate_subscriptions
    WHERE user_id = uid AND status = 'active' AND starts_at <= now() AND ends_at > now() AND plan = 'publisher';
  RETURN jsonb_build_object(
    'authenticated', true,
    'trial_active', in_trial,
    'trial_ends_at', trial_end,
    'search_subscription_ends_at', search_end,
    'publisher_subscription_ends_at', publish_end,
    'can_view_premium', in_trial OR search_end IS NOT NULL,
    'can_publish', in_trial OR publish_end IS NOT NULL,
    'access_level', CASE WHEN in_trial THEN 'trial' WHEN search_end IS NOT NULL THEN 'subscriber' ELSE 'economic_only' END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.fye_real_estate_entitlement() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fye_real_estate_entitlement() TO anon, authenticated;

-- New publication lifecycle columns. A listing is extended only after trusted payment confirmation
-- sets publication_paid_at; never derive payment from a browser request.
ALTER TABLE public.properties_public
  ADD COLUMN IF NOT EXISTS publication_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS premium_until timestamptz,
  ADD COLUMN IF NOT EXISTS publication_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.fye_set_property_publication_dates()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.publication_paid_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.publication_paid_at IS DISTINCT FROM NEW.publication_paid_at) THEN
    NEW.premium_until := NEW.publication_paid_at + interval '1 year';
    NEW.publication_expires_at := NEW.publication_paid_at + interval '6 years';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS fye_property_publication_dates ON public.properties_public;
CREATE TRIGGER fye_property_publication_dates
  BEFORE INSERT OR UPDATE OF publication_paid_at ON public.properties_public
  FOR EACH ROW EXECUTE FUNCTION public.fye_set_property_publication_dates();

CREATE INDEX IF NOT EXISTS properties_public_listing_lifecycle_idx
  ON public.properties_public(publicada, publication_expires_at, premium_until, created_at DESC);

CREATE TABLE IF NOT EXISTS public.real_estate_listing_archive (
  property_id uuid PRIMARY KEY,
  archived_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'expired_after_six_years',
  record jsonb NOT NULL
);
ALTER TABLE public.real_estate_listing_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.real_estate_listing_archive FROM anon, authenticated;

-- Daily scheduler target. It retains a JSONB snapshot before removing expired listings.
-- JSONB retention is not a ZIP export; configure an external encrypted backup job if ZIP is required.
CREATE OR REPLACE FUNCTION public.fye_archive_expired_real_estate()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE archived_count integer;
BEGIN
  INSERT INTO public.real_estate_listing_archive(property_id, archived_at, record)
  SELECT p.id, now(), to_jsonb(p)
  FROM public.properties_public p
  WHERE p.publication_expires_at IS NOT NULL
    AND p.publication_expires_at <= now()
    AND p.archived_at IS NULL
  ON CONFLICT (property_id) DO NOTHING;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  UPDATE public.properties_public
  SET publicada = false, archived_at = now()
  WHERE publication_expires_at IS NOT NULL
    AND publication_expires_at <= now()
    AND archived_at IS NULL;
  RETURN archived_count;
END;
$$;
REVOKE ALL ON FUNCTION public.fye_archive_expired_real_estate() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fye_archive_expired_real_estate() TO service_role;

-- Public listing RPC: anonymous/non-entitled visitors only see USD listings in the economic range.
-- Authenticated trial/search subscribers can view higher prices. This is a read filter, not payment processing.
CREATE OR REPLACE FUNCTION public.fye_real_estate_listings()
RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE can_premium boolean := false;
BEGIN
  can_premium := COALESCE((public.fye_real_estate_entitlement()->>'can_view_premium')::boolean, false);
  RETURN QUERY
    SELECT to_jsonb(p)
    FROM public.properties_public p
    WHERE p.publicada IS TRUE
      AND (p.publication_expires_at IS NULL OR p.publication_expires_at > now())
      AND p.sold_at IS NULL
      AND (
        can_premium
        OR (upper(COALESCE(p.moneda, '')) = 'USD' AND p.precio BETWEEN 1000 AND 7500)
      )
    ORDER BY (p.premium_until IS NOT NULL AND p.premium_until > now()) DESC,
             p.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.fye_real_estate_listings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fye_real_estate_listings() TO anon, authenticated;

-- NOTE: configure Supabase pg_cron (or an external scheduler) to invoke
-- SELECT public.fye_archive_expired_real_estate() daily. A payment provider/webhook must
-- activate subscriptions and set publication_paid_at after verified payment.
