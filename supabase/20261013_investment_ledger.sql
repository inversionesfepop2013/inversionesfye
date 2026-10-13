CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  full_name text,
  role text NOT NULL DEFAULT 'inversionista' CHECK (role IN ('admin','secretaria','inversionista','cliente')),
  is_active boolean NOT NULL DEFAULT true,
  document_type text CHECK (document_type IS NULL OR document_type IN ('cedula','passport')),
  document_number text,
  kyc_status text NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','in_review','verified','rejected')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(permissions) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.profiles IS 'INVERSIONES F Y E POP S.R.L.: identity, application role, access permissions and KYC review state linked to a verified Supabase Auth account.';
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO service_role;
DROP POLICY IF EXISTS fye_profiles_read_self ON public.profiles;
CREATE POLICY fye_profiles_read_self ON public.profiles FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.financial_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  product_type text NOT NULL CHECK (product_type IN ('savings','certificate','loan','foreign_exchange','investment')),
  currency_code text NOT NULL CHECK (currency_code IN ('DOP','USD')),
  monthly_rate_cap numeric(8,6) NOT NULL DEFAULT 0.03 CHECK (monthly_rate_cap >= 0 AND monthly_rate_cap <= 0.03),
  withholding_rate numeric(8,6) NOT NULL DEFAULT 0.18 CHECK (withholding_rate >= 0 AND withholding_rate <= 1),
  payout_day smallint NOT NULL DEFAULT 5 CHECK (payout_day = 5),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.financial_products IS 'INVERSIONES F Y E POP S.R.L.: DOP/USD products with the user-specified monthly cap, withholding parameter and payout day; rates are business configuration, not legal advice.';
ALTER TABLE public.financial_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_products FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.financial_products FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.financial_products TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.financial_products TO service_role;
DROP POLICY IF EXISTS fye_products_read_active ON public.financial_products;
CREATE POLICY fye_products_read_active ON public.financial_products FOR SELECT TO authenticated USING (active = true);

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.financial_products(id) ON DELETE RESTRICT,
  account_type text NOT NULL CHECK (account_type IN ('savings','certificate','loan','foreign_exchange','investment')),
  currency_code text NOT NULL CHECK (currency_code IN ('DOP','USD')),
  monthly_rate numeric(8,6) NOT NULL DEFAULT 0 CHECK (monthly_rate >= 0 AND monthly_rate <= 0.03),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','frozen','closed')),
  opened_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.accounts IS 'INVERSIONES F Y E POP S.R.L.: customer accounts by product and currency; balances come only from immutable ledger entries.';
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.accounts FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.accounts TO service_role;
DROP POLICY IF EXISTS fye_accounts_read_owner ON public.accounts;
CREATE POLICY fye_accounts_read_owner ON public.accounts FOR SELECT TO authenticated USING (owner_profile_id = (SELECT auth.uid()));
CREATE INDEX IF NOT EXISTS fye_accounts_owner_status_idx ON public.accounts(owner_profile_id,status);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  entry_type text NOT NULL CHECK (entry_type IN ('capital_contribution','capital_adjustment','monthly_profit','tax_withholding','profit_withdrawal','capital_withdrawal','loan_disbursement','loan_repayment')),
  amount numeric(20,2) NOT NULL CHECK (amount <> 0),
  currency_code text NOT NULL CHECK (currency_code IN ('DOP','USD')),
  period_month date CHECK (period_month IS NULL OR date_trunc('month',period_month)::date = period_month),
  idempotency_key text UNIQUE,
  reference text,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fye_ledger_amount_direction CHECK (
    (entry_type IN ('capital_contribution','monthly_profit','loan_repayment') AND amount > 0)
    OR (entry_type IN ('tax_withholding','profit_withdrawal','capital_withdrawal','loan_disbursement') AND amount < 0)
    OR (entry_type = 'capital_adjustment' AND amount <> 0)
  )
);
COMMENT ON TABLE public.ledger_entries IS 'INVERSIONES F Y E POP S.R.L.: append-only audit ledger for capital, gross monthly profit, 18% withholding and withdrawals; never edit or delete posted movements.';
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ledger_entries FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.ledger_entries TO authenticated;
GRANT SELECT, INSERT ON TABLE public.ledger_entries TO service_role;
DROP POLICY IF EXISTS fye_ledger_read_account_owner ON public.ledger_entries;
CREATE POLICY fye_ledger_read_account_owner ON public.ledger_entries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = ledger_entries.account_id AND a.owner_profile_id = (SELECT auth.uid())));
CREATE INDEX IF NOT EXISTS fye_ledger_account_period_idx ON public.ledger_entries(account_id,period_month,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS fye_ledger_monthly_profit_once_idx ON public.ledger_entries(account_id,period_month) WHERE entry_type = 'monthly_profit' AND period_month IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fye_ledger_monthly_withholding_once_idx ON public.ledger_entries(account_id,period_month) WHERE entry_type = 'tax_withholding' AND period_month IS NOT NULL;
CREATE OR REPLACE FUNCTION public.fye_reject_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries are immutable; add a correcting entry instead.';
END;
$$;
DROP TRIGGER IF EXISTS fye_ledger_immutable ON public.ledger_entries;
CREATE TRIGGER fye_ledger_immutable BEFORE UPDATE OR DELETE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.fye_reject_ledger_mutation();
REVOKE UPDATE, DELETE ON TABLE public.ledger_entries FROM service_role;

CREATE TABLE IF NOT EXISTS public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  document_type text NOT NULL CHECK (document_type IN ('identity_front','identity_back','passport','proof_of_address','contract','payment_receipt','other')),
  storage_path text NOT NULL UNIQUE,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','in_review','approved','rejected')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.client_documents IS 'INVERSIONES F Y E POP S.R.L.: private document metadata and manual review status; file paths never imply public access.';
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_documents FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.client_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_documents TO service_role;
DROP POLICY IF EXISTS fye_documents_read_owner ON public.client_documents;
CREATE POLICY fye_documents_read_owner ON public.client_documents FOR SELECT TO authenticated USING (owner_profile_id = (SELECT auth.uid()));
CREATE INDEX IF NOT EXISTS fye_documents_owner_status_idx ON public.client_documents(owner_profile_id,review_status);

CREATE OR REPLACE VIEW public.fye_investor_account_summary WITH (security_invoker = true) AS
WITH ledger_totals AS (
  SELECT account_id,
    COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('capital_contribution','capital_adjustment','capital_withdrawal')),0)::numeric(20,2) AS invested_capital,
    COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('monthly_profit','tax_withholding','profit_withdrawal')),0)::numeric(20,2) AS available_net_profit,
    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'monthly_profit'),0)::numeric(20,2) AS gross_profit_total,
    COALESCE(-SUM(amount) FILTER (WHERE entry_type = 'tax_withholding'),0)::numeric(20,2) AS tax_withheld_total,
    COALESCE(-SUM(amount) FILTER (WHERE entry_type = 'profit_withdrawal'),0)::numeric(20,2) AS profit_withdrawn_total
  FROM public.ledger_entries GROUP BY account_id
), balances AS (
  SELECT a.id AS account_id,a.owner_profile_id,a.product_id,a.account_type,a.currency_code,a.monthly_rate,a.status,a.opened_on,
    p.email AS owner_email,fp.name AS product_name,fp.monthly_rate_cap,fp.withholding_rate,fp.payout_day,
    COALESCE(lt.invested_capital,0)::numeric(20,2) AS invested_capital,
    COALESCE(lt.available_net_profit,0)::numeric(20,2) AS available_net_profit,
    COALESCE(lt.gross_profit_total,0)::numeric(20,2) AS gross_profit_total,
    COALESCE(lt.tax_withheld_total,0)::numeric(20,2) AS tax_withheld_total,
    COALESCE(lt.profit_withdrawn_total,0)::numeric(20,2) AS profit_withdrawn_total
  FROM public.accounts a JOIN public.profiles p ON p.id=a.owner_profile_id JOIN public.financial_products fp ON fp.id=a.product_id LEFT JOIN ledger_totals lt ON lt.account_id=a.id
)
SELECT b.*,
  round(b.invested_capital * least(b.monthly_rate,b.monthly_rate_cap),2)::numeric(20,2) AS monthly_gross_profit_cap,
  round(b.invested_capital * least(b.monthly_rate,b.monthly_rate_cap) * b.withholding_rate,2)::numeric(20,2) AS estimated_monthly_withholding,
  round(b.invested_capital * least(b.monthly_rate,b.monthly_rate_cap) * (1-b.withholding_rate),2)::numeric(20,2) AS monthly_net_withdrawal_cap
FROM balances b;
COMMENT ON VIEW public.fye_investor_account_summary IS 'Investor screen: capital and ledger-derived net profit, gross profit, tax withheld and prior withdrawals; monthly gross is capped at the configured contract rate up to 3%, with the configured 18% withholding. The date period covered by the fifth-day payout is intentionally not scheduled until business policy is confirmed.';
REVOKE ALL ON public.fye_investor_account_summary FROM PUBLIC, anon;
GRANT SELECT ON public.fye_investor_account_summary TO authenticated, service_role;

INSERT INTO public.financial_products(code,name,product_type,currency_code,monthly_rate_cap,withholding_rate,payout_day,active)
VALUES ('investment_dop','Inversión DOP','investment','DOP',0.03,0.18,5,true),('investment_usd','Inversión USD','investment','USD',0.03,0.18,5,true)
ON CONFLICT (code) DO NOTHING;