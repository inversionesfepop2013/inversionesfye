const { getConfig, readAppSession, sendJson, sameOrigin } = require('../lib/admin-auth');
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { error: 'Método no permitido.' }); }
  if (!sameOrigin(req)) return sendJson(res, 403, { error: 'Solicitud de origen no válido.' });
  const session = await readAppSession(req, res).catch(() => ({ ok: false, status: 503, message: 'No se pudo comprobar la sesión.' }));
  if (!session.ok) return sendJson(res, session.status, { error: session.message });
  const password = typeof (req.body && req.body.password) === 'string' ? req.body.password : '';
  if (password.length < 12 || password.length > 256 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) return sendJson(res, 400, { error: 'La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo.' });
  const response = await fetch(session.config.url + '/auth/v1/user', { method: 'PUT', headers: { apikey: session.config.key, Authorization: 'Bearer ' + session.accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }).catch(() => null);
  if (!response || !response.ok) return sendJson(res, 400, { error: 'No se pudo guardar la nueva contraseña. Solicita otra invitación si el enlace venció.' });
  return sendJson(res, 200, { passwordUpdated: true, role: session.profile.role });
};
