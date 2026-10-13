const { getConfig, getProfile, requestUser, setSessionCookies, sendJson, sameOrigin, ADMIN_EMAIL } = require('../lib/admin-auth');
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { error: 'Método no permitido.' }); }
  if (!sameOrigin(req)) return sendJson(res, 403, { error: 'Solicitud de origen no válido.' });
  const config = getConfig();
  const accessToken = String((req.body && req.body.access_token) || ''), refreshToken = String((req.body && req.body.refresh_token) || '');
  if (!config || !accessToken || !refreshToken || accessToken.length > 8192 || refreshToken.length > 8192) return sendJson(res, 400, { error: 'El enlace de invitación no contiene una sesión válida.' });
  try {
    const user = await requestUser(config, accessToken).catch(() => null);
    if (!user) return sendJson(res, 401, { error: 'No se pudo verificar la invitación.' });
    const profile = await getProfile(config, user.id).catch(() => null);
    if (!profile || profile.is_active !== true) return sendJson(res, 403, { error: 'La cuenta aún no tiene permisos activos.' });
    const email = String(user.email || '').trim().toLowerCase();
    if ((email === ADMIN_EMAIL) !== (profile.role === 'admin')) return sendJson(res, 403, { error: 'El rol de esta cuenta no coincide con el acceso autorizado.' });
    setSessionCookies(res, { access_token: accessToken, refresh_token: refreshToken, expires_in: 3600 });
    return sendJson(res, 200, { accepted: true, role: profile.role });
  } catch { return sendJson(res, 503, { error: 'No se pudo comprobar el enlace de invitación.' }); }
};
