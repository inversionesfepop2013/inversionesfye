# Panel de permisos — INVERSIONES F Y E POP S.R.L.

Esta rama añade un panel de permisos separado:

- Solo la cuenta autenticada inversionesfepop@gmail.com puede iniciar sesión y administrar asignaciones. El servidor confirma la identidad con Supabase Auth.
- La sesión del panel utiliza cookies HttpOnly, Secure y SameSite=Strict. Las contraseñas no se guardan en el navegador ni en el repositorio.
- La clave privada de Supabase se usa solo en Vercel para enviar invitaciones y nunca se incluye en la página.
- Los permisos seleccionables son Resumen, Perfil, Crédito, Ahorro, Certificado, Divisas, ver/editar usuarios y ver/editar documentos. Solo el correo principal puede administrar permisos.
- La migración activa RLS y no concede acceso a usuarios anónimos. Secretaría parte con los permisos de trabajo actuales; el administrador puede ajustarlos.

## Activación tras revisar la rama

1. En Supabase Auth, invita primero a inversionesfepop@gmail.com como cuenta administrativa. El proyecto no tiene cuentas registradas y el registro público está desactivado.
2. Aplica supabase/20261013_admin_permissions.sql en la base de datos.
3. Configura en Vercel las variables SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY y SUPABASE_INVITE_REDIRECT_URL. La clave de servicio no debe añadirse a GitHub ni enviarse por chat. La dirección de regreso debe usar HTTPS y estar permitida en las redirecciones de Supabase.
4. Prueba primero la rama en vista previa y confirma los flujos antes de fusionarla con main.

## Alcance pendiente — importante

El portal principal todavía autentica usuarios y aplica varios permisos desde el navegador y localStorage. Esta rama crea la consola segura y la tabla de asignaciones, pero no convierte por sí sola todas las pantallas y datos existentes en controles protegidos por servidor. No uses la tabla nueva como única protección para balances, expedientes ni documentos hasta completar la migración del portal principal a sesiones verificadas y comprobaciones de permisos del lado del servidor. Las rutas de ejemplo api/customer-data, api/approve-users y api/send-email permanecen cerradas mientras no tengan autenticación real.
