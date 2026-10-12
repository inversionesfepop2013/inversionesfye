// Endpoint deshabilitado: el flujo anterior confiaba en un email enviado por
// el navegador y aceptaba cualquier texto como token de sesión.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  return res.status(503).json({
    error: 'Aprobaciones deshabilitadas hasta verificar la identidad y el rol en el servidor.'
  });
};
