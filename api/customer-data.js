// API para traer datos del cliente desde Google Sheets
// PRIVADA - Solo datos del usuario autenticado

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { email, telefono, token } = req.query;

  // Validar token de sesión
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (!email && !telefono) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  // TODO: Aquí consultar Google Sheets con API privada
  // Usar: google-auth-library y google-sheets-api
  // Solo devolver datos del usuario autenticado

  const mockData = {
    email: email || '',
    telefono: telefono || '',
    nombre: 'Cliente Ejemplo',
    balance: 5000.50,
    certificado: {
      tipo: 'Certificado de Inversión',
      monto: 10000,
      rendimiento: 12.5,
      vencimiento: '2026-12-31'
    },
    propuestas: [
      {
        id: 1,
        tipo: 'Préstamo Personal',
        monto: 25000,
        tasa: 18.5,
        plazo: '24 meses'
      }
    ]
  };

  return res.status(200).json(mockData);
};