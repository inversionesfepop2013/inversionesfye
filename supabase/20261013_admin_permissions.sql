-- INVERSIONES F Y E POP S.R.L. — permisos del portal web.
-- Aplicar después de revisar esta rama. No guarda contraseñas ni claves.
CREATE TABLE IF NOT EXISTS public.web_user_permissions (
  email text PRIMARY KEY CHECK (email = lower(btrim(email)) AND email <> ''),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(permissions) = 'object'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.web_user_permissions IS 'Permisos por correo para el portal web; la cuenta principal administra y cada usuario solo puede leer su propia asignación.';
ALTER TABLE public.web_user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_user_permissions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.web_user_permissions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.web_user_permissions TO authenticated, service_role;
DROP POLICY IF EXISTS web_permissions_read_self_or_owner ON public.web_user_permissions;
CREATE POLICY web_permissions_read_self_or_owner ON public.web_user_permissions FOR SELECT TO authenticated
USING (lower(email) = lower((SELECT auth.jwt() ->> 'email')) OR lower((SELECT auth.jwt() ->> 'email')) = 'inversionesfepop@gmail.com');
DROP POLICY IF EXISTS web_permissions_insert_owner_only ON public.web_user_permissions;
CREATE POLICY web_permissions_insert_owner_only ON public.web_user_permissions FOR INSERT TO authenticated
WITH CHECK (lower((SELECT auth.jwt() ->> 'email')) = 'inversionesfepop@gmail.com' AND lower(email) <> 'inversionesfepop@gmail.com');
DROP POLICY IF EXISTS web_permissions_update_owner_only ON public.web_user_permissions;
CREATE POLICY web_permissions_update_owner_only ON public.web_user_permissions FOR UPDATE TO authenticated
USING (lower((SELECT auth.jwt() ->> 'email')) = 'inversionesfepop@gmail.com')
WITH CHECK (lower((SELECT auth.jwt() ->> 'email')) = 'inversionesfepop@gmail.com' AND lower(email) <> 'inversionesfepop@gmail.com');
DROP POLICY IF EXISTS web_permissions_delete_owner_only ON public.web_user_permissions;
CREATE POLICY web_permissions_delete_owner_only ON public.web_user_permissions FOR DELETE TO authenticated
USING (lower((SELECT auth.jwt() ->> 'email')) = 'inversionesfepop@gmail.com' AND lower(email) <> 'inversionesfepop@gmail.com');
-- Mantiene en secretaría el alcance que ya figura en la web, sin conceder administración de permisos.
INSERT INTO public.web_user_permissions (email, permissions, active) VALUES (
  'flaquitabella875@gmail.com',
  '{"resumen":true,"perfil":true,"credito":true,"ahorro":true,"certificado":true,"divisas":false,"usuarios_view":true,"usuarios_edit":true,"documentos_view":true,"documentos_edit":true}'::jsonb,
  true
) ON CONFLICT (email) DO NOTHING;
