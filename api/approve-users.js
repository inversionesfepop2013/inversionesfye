// API para gestionar aprobación de usuarios - SOLO ADMIN Y SECRETARIA
// Verificar que el usuario sea INVERSIONESFEPOP@gmail.com o FLAQUITABELLA875@gmail.com

const ALLOWED_MANAGERS = [
  'inversionesfepop@gmail.com',
  'flaquitabella875@gmail.com'
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action, cedula, userEmail, token } = req.body;

  // Validar token de sesión
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'Token no válido' });
  }

  // Validar que el usuario sea admin o secretaria
  const normalizedEmail = String(userEmail || '').trim().toLowerCase();
  if (!ALLOWED_MANAGERS.includes(normalizedEmail)) {
    return res.status(403).json({ error: 'No tienes permisos para esta acción' });
  }

  if (action === 'approve') {
    // Lógica de aprobación
    return res.status(200).json({ success: true, message: 'Usuario aprobado' });
  }

  if (action === 'reject') {
    // Lógica de rechazo
    return res.status(200).json({ success: true, message: 'Usuario rechazado' });
  }

  return res.status(400).json({ error: 'Acción no válida' });
};