// Endpoint deshabilitado de forma segura hasta implementar autenticación de servidor
// y conectar una fuente privada de datos reales. Nunca confiar en tokens de query.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // No exponer datos de ejemplo ni aceptar un token arbitrario como identidad.
  return res.status(503).json({
    error: 'Servicio deshabilitado hasta configurar autenticación y datos privados en el servidor.'
  });
};
