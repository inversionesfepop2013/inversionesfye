# Acceso seguro — INVERSIONES F Y E POP S.R.L.

Esta rama implementa una consola de equipo y un portal de inversionistas con sesión verificada en Supabase Auth y cookies Secure, HttpOnly y SameSite=Strict. El correo inversionesfepop@gmail.com es el único que puede abrir la consola y asignar roles y permisos. Las invitaciones se crean en Supabase Auth; las claves administrativas solo viven en variables sensibles de Vercel y nunca en el navegador.

## Datos y permisos

- Supabase es la fuente de datos según la especificación proporcionada. La hoja Base_Datos_Inversiones_FYE se revisó y contiene solo encabezados; no se copiaron registros.
- Ejecutar supabase/20261013_investment_ledger.sql una sola vez con el historial de migraciones habilitado. La migración crea profiles, financial_products, accounts, ledger_entries, client_documents y la vista del inversionista; activa RLS y crea productos vacíos DOP/USD. No crea inversores ni importes inventados.
- ledger_entries rechaza UPDATE y DELETE; las correcciones se registran con asientos nuevos.
- El panel permite invitar roles secretaria, inversionista y cliente, y asignar permisos por pantalla/operación. Nadie puede otorgar el rol admin desde el panel.
- El portal de inversores solo lee cuentas vinculadas al perfil autenticado y muestra el historial del libro. No procesa pagos ni retiros reales.
- El tope de 3% mensual, retención de 18% y día 5 son parámetros indicados por la empresa, no una verificación legal/fiscal. El periodo de rendimiento que cubre el día 5 sigue pendiente de confirmación; no se programó una contabilización automática.

## Estado pendiente antes de producción

1. Invitar inversionesfepop@gmail.com y comprobar la activación de la cuenta administradora.
2. Confirmar el periodo al que corresponde el pago del día 5 y la hora/zona de ejecución antes de automatizar rendimientos.
3. Migrar o desactivar de forma controlada el inicio de sesión antiguo del portal principal: todavía contiene autenticación propia y permisos calculados en navegador.
4. Implementar y probar aprobaciones de retiros, documentos, KYC y los flujos de depósitos/préstamos antes de usar dinero real.
5. Aplicar variables sensibles en producción solo después de revisar y aprobar esta rama.
6. La compra del dominio requiere los datos reales del titular registrante; no se inventarán.
