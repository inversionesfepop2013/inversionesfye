const { ADMIN_EMAIL, getConfig, cookieMap, setSessionCookies, clearSessionCookies, requestUser, readAdminSession, sendJson, sameOrigin } = require('../lib/admin-auth');
module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    try { const s = await readAdminSession(req, res); if (!s.ok) return sendJson(res, s.status, { error: s.message }); return sendJson(res, 200, { authorized: true, email: s.user.email }); }
    catch { return sendJson(res, 503, { error: 'No se pudo comprobar la sesión.' }); }
  }
  if (req.method === 'DELETE') {
    if (!sameOrigin(req)) return sendJson(res, 403, { error: 'Solicitud de origen no válido.' });
    const config = getConfig(), cookies = cookieMap(req);
    if (config && cookies.fye_admin_access) await fetch(config.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: config.key, Authorization: 'Bearer ' + cookies.fye_admin_access } }).catch(() => null);
    clearSessionCookies(res); return sendJson(res, 200, { signedOut: true });
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST, DELETE'); return sendJson(res, 405, { error: 'Método no permitido.' }); }
  if (!sameOrigin(req)) return sendJson(res, 403, { error: 'Solicitud de origen no válido.' });
  const config = getConfig();
  if (!config) return sendJson(res, 503, { error: 'Falta configurar Supabase en Vercel.' });
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const password = typeof (req.body && req.body.password) === 'string' ? req.body.password : '';
  if (email !== ADMIN_EMAIL) return sendJson(res, 403, { error: 'Solo el correo principal puede abrir este panel.' });
  if (!password || password.length > 256) return sendJson(res, 400, { error: 'Escribe la contraseña de la cuenta administrativa.' });
  try {
    const response = await fetch(config.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: config.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!response.ok) return sendJson(res, 401, { error: 'No se pudo iniciar sesión. Revisa la cuenta y la contraseña.' });
    const tokens = await response.json();
    if (!tokens.access_token || !tokens.refresh_token) return sendJson(res, 401, { error: 'Supabase no devolvió una sesión válida.' });
    const user = await requestUser(config, tokens.access_token).catch(() => null);
    if (!user || String(user.email || '').trim().toLowerCase() !== ADMIN_EMAIL) return sendJson(res, 403, { error: 'Solo el correo principal puede abrir este panel.' });
    setSessionCookies(res, tokens); return sendJson(res, 200, { authorized: true, email: user.email });
  } catch { return sendJson(res, 503, { error: 'No fue posible conectar con el inicio de sesión.' }); }
};
