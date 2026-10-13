CREATE OR REPLACE FUNCTION public.create_cliente_for_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  new_cedula text;
BEGIN
  new_cedula := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'cedula'), '');
  -- Staff and investor invitations do not require an identity document at account creation.
  -- KYC data is collected and reviewed through the private profiles/documents workflow.
  IF new_cedula IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.clientes (
    user_id, cedula, nombre, email, telefono, direccion, tipo_cliente
  ) VALUES (
    NEW.id,
    new_cedula,
    NEW.raw_user_meta_data ->> 'nombre',
    NEW.email,
    NEW.raw_user_meta_data ->> 'telefono',
    NEW.raw_user_meta_data ->> 'direccion',
    NEW.raw_user_meta_data ->> 'tipo_cliente'
  );
  RETURN NEW;
END;
$$;