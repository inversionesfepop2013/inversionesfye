const { getConfig, readAdminSession, sendJson, sameOrigin } = require('../lib/admin-auth');
const ALLOWED = ['resumen', 'perfil', 'credito', 'ahorro', 'certificado', 'divisas', 'usuarios_view', 'usuarios_edit', 'documentos_view', 'documentos_edit'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function cleanPermissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !ALLOWED.includes(key))) return null;
  const out = {}; ALLOWED.forEach((key) => { out[key] = value[key] === true; }); return out;
}
module.exports = async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) { res.setHeader('Allow', 'GET, POST, DELETE'); return sendJson(res, 405, { error: 'Método no permitido.' }); }
  if (req.method !== 'GET' && !sameOrigin(req)) return sendJson(res, 403, { error: 'Solicitud de origen no válido.' });
  const session = await readAdminSession(req, res).catch(() => ({ ok: false, status: 503, message: 'No se pudo comprobar la sesión.' }));
  if (!session.ok) return sendJson(res, session.status, { error: session.message });
  const config = getConfig(), base = config.url + '/rest/v1/web_user_permissions';
  const headers = { apikey: config.key, Authorization: 'Bearer ' + session.accessToken, 'Content-Type': 'application/json' };
  if (req.method === 'GET') {
    const response = await fetch(base + '?select=email,permissions,active,updated_at&order=email.asc', { headers }).catch(() => null);
    if (!response || !response.ok) return sendJson(res, 503, { error: 'No se pudo cargar la lista. Aplica primero la configuración de permisos en Supabase.' });
    const users = await response.json().catch(() => null);
    if (!Array.isArray(users)) return sendJson(res, 503, { error: 'La respuesta de permisos no es válida.' });
    return sendJson(res, 200, { users });
  }
  if (req.method === 'POST') {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase(), permissions = cleanPermissions(req.body && req.body.permissions), active = req.body && req.body.active;
    if (!EMAIL_RE.test(email) || email === 'inversionesfepop@gmail.com') return sendJson(res, 400, { error: 'Indica un correo válido distinto del administrador principal.' });
    if (!permissions || typeof active !== 'boolean') return sendJson(res, 400, { error: 'Revisa los permisos seleccionados.' });
    const response = await fetch(base + '?on_conflict=email', { method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ email, permissions, active, updated_by: session.user.id, updated_at: new Date().toISOString() }) }).catch(() => null);
    if (!response || !response.ok) return sendJson(res, 503, { error: 'No se pudieron guardar los permisos. Confirma que la migración esté aplicada.' });
    const rows = await response.json().catch(() => []); return sendJson(res, 200, { user: Array.isArray(rows) ? rows[0] : null });
  }
  const email = String((req.query && req.query.email) || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email === 'inversionesfepop@gmail.com') return sendJson(res, 400, { error: 'Indica un correo válido distinto del administrador principal.' });
  const response = await fetch(base + '?email=eq.' + encodeURIComponent(email), { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } }).catch(() => null);
  if (!response || !response.ok) return sendJson(res, 503, { error: 'No se pudo retirar el acceso.' });
  return sendJson(res, 200, { removed: true });
};
