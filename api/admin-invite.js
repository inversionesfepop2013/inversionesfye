const { getConfig, readAdminSession, sendJson, sameOrigin } = require('../lib/admin-auth');
const ALLOWED = ['resumen', 'perfil', 'credito', 'ahorro', 'certificado', 'divisas', 'usuarios_view', 'usuarios_edit', 'documentos_view', 'documentos_edit'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { error: 'Método no permitido.' }); }
  if (!sameOrigin(req)) return sendJson(res, 403, { error: 'Solicitud de origen no válido.' });
  const session = await readAdminSession(req, res).catch(() => ({ ok: false, status: 503, message: 'No se pudo comprobar la sesión.' }));
  if (!session.ok) return sendJson(res, session.status, { error: session.message });
  const config = getConfig(), serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '', redirect = process.env.SUPABASE_INVITE_REDIRECT_URL || '';
  if (!serviceKey || !redirect) return sendJson(res, 503, { error: 'Falta configurar en Vercel la clave privada de Supabase y la dirección de regreso de invitaciones.' });
  let redirectUrl; try { redirectUrl = new URL(redirect); } catch { return sendJson(res, 503, { error: 'La dirección de regreso de invitaciones no es válida.' }); }
  if (redirectUrl.protocol !== 'https:') return sendJson(res, 503, { error: 'La dirección de regreso debe usar HTTPS.' });
  const email = String((req.body && req.body.email) || '').trim().toLowerCase(), permissions = req.body && req.body.permissions, active = req.body && req.body.active;
  if (!EMAIL_RE.test(email) || email === 'inversionesfepop@gmail.com') return sendJson(res, 400, { error: 'Indica un correo válido distinto del administrador principal.' });
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions) || Object.keys(permissions).some((key) => !ALLOWED.includes(key)) || typeof active !== 'boolean') return sendJson(res, 400, { error: 'Revisa los permisos seleccionados.' });
  const clean = {}; ALLOWED.forEach((key) => { clean[key] = permissions[key] === true; });
  const invited = await fetch(config.url + '/auth/v1/invite?redirect_to=' + encodeURIComponent(redirectUrl.toString()), { method: 'POST', headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => null);
  if (!invited || !invited.ok) { const conflict = invited && invited.status === 422; return sendJson(res, conflict ? 409 : 502, { error: conflict ? 'Ya existe una cuenta con ese correo. Usa Guardar permisos.' : 'No se pudo enviar la invitación. Comprueba el correo y los destinos permitidos en Supabase.' }); }
  const saved = await fetch(config.url + '/rest/v1/web_user_permissions?on_conflict=email', { method: 'POST', headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ email, permissions: clean, active, updated_by: session.user.id, updated_at: new Date().toISOString() }) }).catch(() => null);
  if (!saved || !saved.ok) return sendJson(res, 502, { error: 'La invitación se envió, pero no se guardaron los permisos. El acceso seguirá bloqueado hasta asignarlos.' });
  return sendJson(res, 201, { invited: true, email });
};
