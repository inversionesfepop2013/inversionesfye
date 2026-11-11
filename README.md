# Inversiones FYE

Sitio web oficial de Inversiones F Y E: servicios financieros, préstamos y soluciones integrales.

## Seguridad y despliegue

Este proyecto se ha reestructurado para separar la lógica sensible del cliente y del servidor.

- Frontend: HTML5, CSS3 y JavaScript vanilla.
- Backend: Python + FastAPI (serverless en Vercel).
- Base de datos: Supabase Postgres, protegida de lado servidor.
- Variables de entorno: obligatorias en Vercel y no visibles en el cliente.
- Ruta administrativa: `admin-secret/` como URL oculta y separada.

## Variables requeridas

Copia `.env.example` y configura tus valores reales antes del despliegue:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SECRET_KEY`
- `ADMIN_SECRET`
- `ALLOWED_ORIGINS`
- `SMTP_*`
- `CONTACT_EMAIL`
- `SUPPORT_PHONE`

## Despliegue

1. Configura las variables de entorno en Vercel.
2. Despliega el proyecto con `vercel.json` y `api/index.py`.
3. Asegúrate de que todas las llamadas sensibles pasen por la API backend.
4. No expongas claves públicas sensibles en HTML, JS o localStorage.

## Endpoints mínimos seguros

- `GET /api/health`
- `POST /api/contact`
- `POST /api/withdrawal-request`
- `POST /api/recover-password`
- `POST /api/admin/approvals`

## Recomendación importante

La lógica financiera completa, validación de identidad y movimientos de cuenta debe ejecutarse con Supabase y backend seguro. Esta base se prepara para que la app quede protegida antes de conectar datos reales.
