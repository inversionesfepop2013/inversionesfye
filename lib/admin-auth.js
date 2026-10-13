const ADMIN_EMAIL = 'inversionesfepop@gmail.com';
function getConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  return url && key ? { url, key } : null;
}
function getServiceKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY || ''; }
function cookieMap(req) {
  const out = {};
  String((req.headers && req.headers.cookie) || '').split(';').forEach((part) => {
    const i = part.indexOf('='); if (i < 0) return;
    const key = part.slice(0, i).trim(), value = part.slice(i + 1).trim();
    try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
  });
  return out;
}
function appendCookies(res, entries) {
  const old = res.getHeader('Set-Cookie');
  const list = Array.isArray(old) ? old : old ? [old] : [];
  res.setHeader('Set-Cookie', list.concat(entries));
}
function setSessionCookies(res, tokens) {
  const age = Math.max(60, Math.min(3600, Number(tokens.expires_in) || 3600));
  const suffix = '; Path=/api/; HttpOnly; Secure; SameSite=Strict; Max-Age=';
  appendCookies(res, [
    'fye_session_access=' + encodeURIComponent(tokens.access_token) + suffix + age,
    'fye_session_refresh=' + encodeURIComponent(tokens.refresh_token) + suffix + 2592000,
  ]);
}
function clearSessionCookies(res) {
  appendCookies(res, [
    'fye_session_access=; Path=/api/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
    'fye_session_refresh=; Path=/api/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
  ]);
}
async function requestUser(config, accessToken) {
  const response = await fetch(config.url + '/auth/v1/user', { headers: { apikey: config.key, Authorization: 'Bearer ' + accessToken } });
  if (!response.ok) return null;
  return response.json();
}
async function getProfile(config, userId) {
  const key = getServiceKey();
  if (!key) return null;
  const url = config.url + '/rest/v1/profiles?id=eq.' + encodeURIComponent(userId) + '&select=id,email,full_name,role,is_active,permissions&limit=1';
  const response = await fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}
async function readAppSession(req, res) {
  const config = getConfig();
  if (!config || !getServiceKey()) return { ok: false, status: 503, message: 'Falta configurar Supabase de forma segura en Vercel.' };
  const cookies = cookieMap(req);
  let accessToken = cookies.fye_session_access || '';
  const refreshToken = cookies.fye_session_refresh || '';
  let user = accessToken ? await requestUser(config, accessToken).catch(() => null) : null;
  if (!user && refreshToken) {
    const response = await fetch(config.url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { apikey: config.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => null);
    if (response && response.ok) {
      const tokens = await response.json();
      if (tokens.access_token && tokens.refresh_token) {
        accessToken = tokens.access_token; setSessionCookies(res, tokens);
        user = await requestUser(config, accessToken).catch(() => null);
      }
    }
  }
  if (!user) return { ok: false, status: 401, message: 'Inicia sesión de nuevo.' };
  const profile = await getProfile(config, user.id).catch(() => null);
  if (!profile || profile.is_active !== true) return { ok: false, status: 403, message: 'La cuenta no tiene acceso activo.' };
  return { ok: true, config, accessToken, refreshToken, user, profile };
}
async function readAdminSession(req, res) {
  const session = await readAppSession(req, res);
  if (!session.ok) return session;
  if (String(session.user.email || '').trim().toLowerCase() !== ADMIN_EMAIL || session.profile.role !== 'admin') {
    return { ok: false, status: 403, message: 'Solo el correo principal puede administrar los accesos.' };
  }
  return session;
}
async function readInvestorSession(req, res) {
  const session = await readAppSession(req, res);
  if (!session.ok) return session;
  if (session.profile.role !== 'inversionista') return { ok: false, status: 403, message: 'Esta cuenta no tiene el rol de inversionista.' };
  return session;
}
function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return res.status(status).json(body);
}
function sameOrigin(req) {
  const origin = req.headers && req.headers.origin, host = req.headers && req.headers.host;
  if (!origin || !host) return false;
  try { const parsed = new URL(origin); return parsed.protocol === 'https:' && parsed.host.toLowerCase() === String(host).toLowerCase(); } catch { return false; }
}
module.exports = { ADMIN_EMAIL, getConfig, getServiceKey, cookieMap, setSessionCookies, clearSessionCookies, requestUser, getProfile, readAppSession, readAdminSession, readInvestorSession, sendJson, sameOrigin };
