## Balances de clientes (Supabase)

El portal de clientes debe usar `GET /api/customer-balances` con el access token de la sesión de Supabase. El endpoint solo devuelve filas cuyo `owner_profile_id` coincide con el usuario autenticado y no publica consultas de balances al cliente.

1. Configura `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como variables privadas en Vercel.
2. Ejecuta `supabase/customer-balances.sql` en Supabase SQL Editor. No habilites una política pública de lectura para balances.
3. En el HTML que contiene el dashboard, elimina la consulta Google Sheets (`loadTab`, `SHEET_ID`, `BAL_ERR`) y carga `assets/customer-balances.js` después del cliente Supabase. El portal debe inicializar el cliente como `sb` y llamar `renderCustomerBalances()` tras el login.
4. Asegúrate de que el usuario autenticado tenga un `id` igual al `owner_profile_id` de la fila en `fye_account_balances`. El panel administrativo debe crear/actualizar esa misma tabla.

El archivo está preparado para ocultar el error técnico al cliente. No se debe mostrar balance cero como si fuese real si falla la API.
