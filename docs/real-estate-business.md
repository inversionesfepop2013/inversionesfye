# Real Estate — configuración y límites de la entrega

- Ejecuta `supabase/real-estate-business.sql` en el SQL Editor de Supabase.
- Trial trigger: nuevos usuarios Auth reciben 3 días una sola vez. El SQL no otorga trial retroactivo a cuentas previas.
- La página consulta `fye_real_estate_entitlement()` y `fye_real_estate_listings()`; el filtrado de propiedades está en servidor. Sin entitlement, la función lista solo precios en USD de 1,000 a 7,500.
- Los planes modelados son searcher US$0.50/mes y publisher US$1.00/mes. **No se ha integrado procesador de pagos ni webhook**: no activar suscripciones desde el navegador.
- La vigencia inicia únicamente cuando un backend de pagos confiable establece `publication_paid_at`. El trigger asigna un año premium y una fecha límite total de seis años.
- La función de archivo retiene una copia JSONB y oculta anuncios expirados. No genera ZIP ni está programada automáticamente en este cambio; configura un scheduler y un respaldo externo cifrado antes de anunciar esta automatización comercial.
- Comisión publicada: 0% bajo RD$100,000 y 0.50% desde RD$100,000, sujeta a aceptación contractual por escrito y revisión legal.
- La página de términos no garantiza inmunidad legal. Solicita revisión por abogado de República Dominicana antes de exigir aceptación contractual.
- Confirma que `properties_public` tiene columnas `id` UUID, `publicada`, `precio`, `moneda`, `created_at`; el RPC filtra inmuebles USD para el umbral económico, pues no existe tipo de cambio configurado para normalizar DOP/USD.
