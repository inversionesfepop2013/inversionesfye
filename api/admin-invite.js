const { getConfig, getServiceKey, readAdminSession, sendJson, sameOrigin } = require('../lib/admin-auth');
const ALLOWED_ROLES=['secretaria','inversionista','cliente'];
const ALLOWED_PERMISSIONS=['resumen','perfil','credito','ahorro','certificado','divisas','inversiones_view','inversiones_edit','retiros_view','retiros_request','retiros_approve','usuarios_view','usuarios_edit','documentos_view','documentos_edit'];
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function cleanPermissions(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some((key)=>!ALLOWED_PERMISSIONS.includes(key)))return null;const out={};ALLOWED_PERMISSIONS.forEach((key)=>{out[key]=value[key]===true;});return out;}
module.exports=async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return sendJson(res,405,{error:'Método no permitido.'});}
  if(!sameOrigin(req))return sendJson(res,403,{error:'Solicitud de origen no válido.'});
  const session=await readAdminSession(req,res).catch(()=>({ok:false,status:503,message:'No se pudo comprobar la sesión.'}));
  if(!session.ok)return sendJson(res,session.status,{error:session.message});
  const config=getConfig(),serviceKey=getServiceKey(),redirect=process.env.SUPABASE_INVITE_REDIRECT_URL||'';
  if(!serviceKey||!redirect)return sendJson(res,503,{error:'Falta configurar la clave privada o el destino de invitación en Vercel.'});
  let redirectUrl;try{redirectUrl=new URL(redirect);}catch{return sendJson(res,503,{error:'El destino de invitación no es válido.'});}
  if(redirectUrl.protocol!=='https:')return sendJson(res,503,{error:'El destino de invitación debe usar HTTPS.'});
  const email=String((req.body&&req.body.email)||'').trim().toLowerCase();
  const full_name=String((req.body&&req.body.full_name)||'').trim().slice(0,160);
  const role=String((req.body&&req.body.role)||'');
  const permissions=cleanPermissions(req.body&&req.body.permissions);
  if(!EMAIL_RE.test(email)||email==='inversionesfepop@gmail.com')return sendJson(res,400,{error:'Indica un correo válido distinto del administrador principal.'});
  if(!ALLOWED_ROLES.includes(role)||!permissions)return sendJson(res,400,{error:'Selecciona un rol y revisa los permisos.'});
  const invite=await fetch(config.url+'/auth/v1/invite?redirect_to='+encodeURIComponent(redirectUrl.toString()),{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({email,data:{full_name}})}).catch(()=>null);
  if(!invite||!invite.ok){const conflict=invite&&invite.status===422;return sendJson(res,conflict?409:502,{error:conflict?'Ya existe una cuenta con ese correo. Usa Guardar permisos.':'No se pudo enviar la invitación. Comprueba el correo y los destinos permitidos en Supabase.'});}
  const invitedData=await invite.json().catch(()=>null),invitedUser=invitedData&&(invitedData.user||invitedData),id=invitedUser&&invitedUser.id;
  if(!id)return sendJson(res,502,{error:'La invitación se envió, pero no se pudo asociar su perfil. El acceso seguirá bloqueado.'});
  const saved=await fetch(config.url+'/rest/v1/profiles?on_conflict=id',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id,email,full_name,role,is_active:true,permissions})}).catch(()=>null);
  if(!saved||!saved.ok)return sendJson(res,502,{error:'La invitación se envió, pero el perfil no quedó listo. El acceso seguirá bloqueado hasta corregirlo.'});
  return sendJson(res,201,{invited:true,email,role});
};
