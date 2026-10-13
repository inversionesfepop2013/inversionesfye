const { getConfig, getServiceKey, readAdminSession, sendJson, sameOrigin } = require('../lib/admin-auth');
const ALLOWED_ROLES = ['secretaria','inversionista','cliente'];
const ALLOWED_PERMISSIONS = ['resumen','perfil','credito','ahorro','certificado','divisas','inversiones_view','inversiones_edit','retiros_view','retiros_request','retiros_approve','usuarios_view','usuarios_edit','documentos_view','documentos_edit'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function cleanPermissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !ALLOWED_PERMISSIONS.includes(key))) return null;
  const out = {}; ALLOWED_PERMISSIONS.forEach((key) => { out[key] = value[key] === true; }); return out;
}
module.exports = async function handler(req, res) {
  if (!['GET','POST','DELETE'].includes(req.method)) { res.setHeader('Allow','GET, POST, DELETE'); return sendJson(res,405,{error:'Método no permitido.'}); }
  if (req.method !== 'GET' && !sameOrigin(req)) return sendJson(res,403,{error:'Solicitud de origen no válido.'});
  const session=await readAdminSession(req,res).catch(()=>({ok:false,status:503,message:'No se pudo comprobar la sesión.'}));
  if(!session.ok)return sendJson(res,session.status,{error:session.message});
  const config=getConfig(),key=getServiceKey(),base=config.url+'/rest/v1/profiles';
  if(!key)return sendJson(res,503,{error:'Falta configurar el acceso seguro a la base de datos.'});
  const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  if(req.method==='GET'){
    const response=await fetch(base+'?select=email,full_name,role,is_active,permissions,created_at,updated_at&order=email.asc&limit=200',{headers}).catch(()=>null);
    if(!response||!response.ok)return sendJson(res,503,{error:'No se pudo cargar la lista del equipo.'});
    const users=await response.json().catch(()=>null);
    if(!Array.isArray(users))return sendJson(res,503,{error:'La respuesta de usuarios no es válida.'});
    return sendJson(res,200,{users});
  }
  if(req.method==='POST'){
    const email=String((req.body&&req.body.email)||'').trim().toLowerCase();
    const role=String((req.body&&req.body.role)||'');
    const full_name=String((req.body&&req.body.full_name)||'').trim().slice(0,160);
    const permissions=cleanPermissions(req.body&&req.body.permissions),is_active=req.body&&req.body.active;
    if(!EMAIL_RE.test(email)||email==='inversionesfepop@gmail.com')return sendJson(res,400,{error:'Indica un correo válido distinto del administrador principal.'});
    if(!ALLOWED_ROLES.includes(role)||!permissions||typeof is_active!=='boolean')return sendJson(res,400,{error:'Revisa el rol y los permisos seleccionados.'});
    const response=await fetch(base+'?email=eq.'+encodeURIComponent(email),{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({full_name,role,permissions,is_active,updated_at:new Date().toISOString()})}).catch(()=>null);
    if(!response||!response.ok)return sendJson(res,503,{error:'No se pudieron guardar los permisos.'});
    const rows=await response.json().catch(()=>[]);
    if(!Array.isArray(rows)||!rows.length)return sendJson(res,404,{error:'Primero invita esta cuenta desde el panel.'});
    return sendJson(res,200,{user:rows[0]});
  }
  const email=String((req.query&&req.query.email)||'').trim().toLowerCase();
  if(!EMAIL_RE.test(email)||email==='inversionesfepop@gmail.com')return sendJson(res,400,{error:'Indica un correo válido distinto del administrador principal.'});
  const response=await fetch(base+'?email=eq.'+encodeURIComponent(email),{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({is_active:false,updated_at:new Date().toISOString()})}).catch(()=>null);
  if(!response||!response.ok)return sendJson(res,503,{error:'No se pudo retirar el acceso.'});
  const rows=await response.json().catch(()=>[]);
  if(!Array.isArray(rows)||!rows.length)return sendJson(res,404,{error:'No se encontró esa cuenta.'});
  return sendJson(res,200,{removed:true});
};
