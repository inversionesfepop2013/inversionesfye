// Endpoint deshabilitado: el flujo anterior no enviaba correo y aceptaba
// solicitudes sin autenticar. Conectar un proveedor solo después de verificar
// el rol del usuario en el servidor y validar los datos de entrada.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  return res.status(503).json({
    error: 'Envío deshabilitado hasta configurar un servicio de correo con autorización de servidor.'
  });
};
