const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://inversionesfye.vercel.app')
  .split(',').map(value => value.trim()).filter(Boolean);

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
}

async function supabase(path, { method = 'GET', token, body, service = false } = {}) {
  const key = service ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${service ? SUPABASE_SERVICE_ROLE_KEY : token || key}`,
      'Content-Type': 'application/json',
      ...(method !== 'GET' ? { Prefer: 'return=representation' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const error = new Error('Supabase request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw ? raw.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido.' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return send(res, 503, { error: 'Servicio administrativo no configurado.' });
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token || !req.body || typeof req.body !== 'object') return send(res, 401, { error: 'Sesión inválida.' });

  try {
    const caller = await supabase('/auth/v1/user', { token });
    if (!caller?.id) return send(res, 401, { error: 'Sesión inválida.' });

    const profiles = await supabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(caller.id)}&select=id,role,is_active,approval_status`, { service: true });
    const profile = Array.isArray(profiles) ? profiles[0] : null;
    if (!profile || !['admin', 'secretaria'].includes(profile.role) || profile.is_active === false || profile.approval_status === 'pendiente') {
      return send(res, 403, { error: 'No autorizado.' });
    }

    const ip = clientIp(req);
    const rate = await supabase('/rest/v1/rpc/fye_consume_rate_limit', {
      method: 'POST', service: true,
      body: { p_key: `admin:${caller.id}:${ip}`, p_limit: 30, p_window_seconds: 60 }
    });
    if (rate !== true && rate?.allowed !== true) return send(res, 429, { error: 'Demasiadas solicitudes. Intenta más tarde.' });

    const { action, user_id: userId, reason } = req.body;
    const allowedActions = ['approve', 'reject', 'block', 'reset_password'];
    if (!allowedActions.includes(action) || typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId)) {
      return send(res, 400, { error: 'Acción o usuario inválido.' });
    }

    let result = { ok: true };
    if (action === 'approve' || action === 'reject' || action === 'block') {
      const updates = action === 'approve'
        ? { is_active: true, approval_status: 'aprobado', approved_by: caller.id, approved_at: new Date().toISOString() }
        : action === 'reject'
          ? { is_active: false, approval_status: 'rechazado' }
          : { is_active: false, approval_status: 'bloqueado' };
      await supabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH', service: true, body: updates
      });
    } else if (action === 'reset_password') {
      const targets = await supabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=email`, { service: true });
      const email = Array.isArray(targets) ? targets[0]?.email : null;
      if (!email || typeof email !== 'string') return send(res, 404, { error: 'No se encontró el correo del cliente.' });
      // Supabase Auth sends its official recovery email; the password itself is never handled here.
      await supabase('/auth/v1/recover', {
        method: 'POST', token: SUPABASE_ANON_KEY,
        body: { email, redirect_to: `${process.env.PUBLIC_SITE_URL || 'https://inversionesfye.vercel.app'}/auth/callback/` }
      });
      result = { ok: true, message: 'Enlace de recuperación enviado al correo registrado.' };
    }

    await supabase('/rest/v1/admin_audit_logs', {
      method: 'POST', service: true,
      body: {
        actor_id: caller.id,
        action,
        target_user_id: userId,
        details: typeof reason === 'string' ? reason.slice(0, 500) : null,
        ip_address: ip,
        occurred_at: new Date().toISOString(),
        request_id: crypto.randomUUID()
      }
    });
    return send(res, 200, result);
  } catch (error) {
    const status = error.status === 401 ? 401 : 503;
    return send(res, status, { error: status === 401 ? 'Sesión inválida.' : 'No se pudo completar la acción.' });
  }
};
