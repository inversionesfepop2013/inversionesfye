const { getConfig,getProfile,requestUser,setSessionCookies,clearSessionCookies,cookieMap,readInvestorSession,sendJson,sameOrigin }=require('../lib/admin-auth');
module.exports=async function handler(req,res){
  if(req.method==='GET'){
    const s=await readInvestorSession(req,res).catch(()=>({ok:false,status:503,message:'No se pudo comprobar la sesión.'}));
    if(!s.ok)return sendJson(res,s.status,{error:s.message});
    return sendJson(res,200,{authorized:true,name:s.profile.full_name||s.user.email});
  }
  if(req.method==='DELETE'){
    if(!sameOrigin(req))return sendJson(res,403,{error:'Solicitud de origen no válido.'});
    const config=getConfig(),cookies=cookieMap(req);
    if(config&&cookies.fye_session_access)await fetch(config.url+'/auth/v1/logout',{method:'POST',headers:{apikey:config.key,Authorization:'Bearer '+cookies.fye_session_access}}).catch(()=>null);
    clearSessionCookies(res);return sendJson(res,200,{signedOut:true});
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST, DELETE');return sendJson(res,405,{error:'Método no permitido.'});}
  if(!sameOrigin(req))return sendJson(res,403,{error:'Solicitud de origen no válido.'});
  const config=getConfig(),email=String((req.body&&req.body.email)||'').trim().toLowerCase(),password=typeof(req.body&&req.body.password)==='string'?req.body.password:'';
  if(!config||!email||!password||password.length>256)return sendJson(res,400,{error:'Escribe tu correo y contraseña.'});
  try{
    const response=await fetch(config.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    if(!response.ok)return sendJson(res,401,{error:'No se pudo iniciar sesión. Revisa el correo y la contraseña.'});
    const tokens=await response.json(),user=await requestUser(config,tokens.access_token).catch(()=>null);
    if(!user)return sendJson(res,401,{error:'La sesión no pudo validarse.'});
    const profile=await getProfile(config,user.id).catch(()=>null);
    if(!profile||profile.role!=='inversionista'||profile.is_active!==true)return sendJson(res,403,{error:'Esta cuenta no tiene acceso activo al portal de inversionistas.'});
    setSessionCookies(res,tokens);return sendJson(res,200,{authorized:true,name:profile.full_name||user.email});
  }catch{return sendJson(res,503,{error:'No fue posible conectar con el inicio de sesión.'});}
};
